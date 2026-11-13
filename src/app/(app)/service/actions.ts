'use server'

import {
  normalizeVehicleIdentity, refineVehicleIdentity, vehicleIdentityFields, vehicleUniqueViolation,
} from '@/lib/vehicle-schema'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { resolveServiceScope } from '@/lib/company-scope'
import { createClient } from '@/lib/supabase/server'
import { ActionResult, fail, optionalNumber, optionalText, zodFail } from '@/lib/action-result'
import { ensureBrandModelFor, insertStockTire, resolveModelSnapshot } from '@/lib/tire-stock'
import { isOtherBrand } from '@/lib/tire-import'
import { SHOP_MOUNT_GRANT_MESSAGE, generateUnknownSerial, tireMatchesGrant, type ShopGrantTire } from '@/lib/shop-rules'
import { loadShopMountGrant } from '@/lib/service-data'
import { BACKFILL_NOTE_PREFIX } from '@/lib/tire-change-rows'
import { planServiceVehicle, type ServiceVehiclePlan } from '@/lib/service-vehicle'
import {
  ODOMETER_DIGITS, ODOMETER_MAX, ODOMETER_MAX_MESSAGE,
  SERIAL_MAX, SERIAL_PATTERN, SERIAL_PATTERN_MESSAGE,
} from '@/lib/utils'

/** เลขไมล์: จำนวนเต็ม 0 ถึง ODOMETER_MAX (ไม่เกิน ODOMETER_DIGITS หลัก) */
const odometerSchema = z
  .number({ message: `กรุณากรอกเลขไมล์เป็นตัวเลขไม่เกิน ${ODOMETER_DIGITS} หลัก` })
  .int()
  .min(0, 'กรุณากรอกเลขไมล์')
  .max(ODOMETER_MAX, ODOMETER_MAX_MESSAGE)

/** ซีรีย์ยาง: แปลงเป็นตัวพิมพ์ใหญ่ก่อน แล้วรับเฉพาะ A-Z 0-9 ขีด */
const serialSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'กรุณากรอกเลขยาง (ซีเรียล)')
  .max(SERIAL_MAX, `ซีรีย์ยางยาวได้ไม่เกิน ${SERIAL_MAX} ตัว`)
  .regex(SERIAL_PATTERN, SERIAL_PATTERN_MESSAGE)

const unmountSchema = z.object({
  tire_id: z.string().uuid(),
  odometer: odometerSchema,
  tread_mm: optionalNumber,
  reason_id: optionalText,
  note: optionalText,
  event_date: z.string().min(1),
})

const mountSchema = z.object({
  tire_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  position_code: z.string().min(1, 'กรุณาเลือกตำแหน่งล้อ'),
  odometer: odometerSchema,
  tread_mm: optionalNumber,
  note: optionalText,
  event_date: z.string().min(1),
})

export type UnmountInput = z.input<typeof unmountSchema>
export type MountInput = z.input<typeof mountSchema>

/**
 * ถอดยางออกจากรถ — ระบบจะคำนวณระยะวิ่งของรอบนี้และสะสมให้อัตโนมัติ
 * @param input ข้อมูลการถอดยาง
 */
export async function unmountTireAction(input: UnmountInput): Promise<ActionResult> {
  await requireSession(['admin', 'technician'])
  const parsed = unmountSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.rpc('unmount_tire', {
    p_tire_id: parsed.data.tire_id,
    p_odometer: parsed.data.odometer,
    p_tread_mm: parsed.data.tread_mm,
    p_reason_id: parsed.data.reason_id,
    p_note: parsed.data.note,
    p_event_date: parsed.data.event_date,
  })

  if (error) return fail(error)
  revalidateService()
  return { ok: true }
}

/**
 * ใส่ยางเข้าตำแหน่งล้อที่เลือก
 * @param input ข้อมูลการใส่ยาง
 */
export async function mountTireAction(input: MountInput): Promise<ActionResult> {
  await requireSession(['admin', 'technician'])
  const parsed = mountSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mount_tire', {
    p_tire_id: parsed.data.tire_id,
    p_vehicle_id: parsed.data.vehicle_id,
    p_position_code: parsed.data.position_code,
    p_odometer: parsed.data.odometer,
    p_tread_mm: parsed.data.tread_mm,
    p_note: parsed.data.note,
    p_event_date: parsed.data.event_date,
  })

  if (error) return fail(error)
  revalidateService()
  return { ok: true }
}

const manualUnmountSchema = z.object({
  vehicle_id: z.string().uuid(),
  position_code: z.string().min(1, 'กรุณาเลือกตำแหน่งล้อ'),
  /** ข้อมูลยางที่ช่างคีย์เองหน้างาน */
  serial_no: serialSchema,
  tire_model_id: optionalText,
  brand_name: optionalText,
  model_name: optionalText,
  size: optionalText,
  dot: optionalText,
  new_tread_mm: optionalNumber,
  /** เลขไมล์ตอนที่ยางเส้นนี้ถูกใส่ (ถ้าทราบ) — ใช้คำนวณระยะวิ่งรอบนี้ */
  mounted_odometer: optionalNumber,
  odometer: odometerSchema,
  tread_mm: optionalNumber,
  reason_id: optionalText,
  note: optionalText,
  event_date: z.string().min(1),
})

export type ManualUnmountInput = z.input<typeof manualUnmountSchema>

/**
 * ถอดยางที่ "ยังไม่มีข้อมูลในระบบ"
 * สร้างประวัติยางเส้นนั้นขึ้นมาก่อน แล้วบันทึกใส่-ถอดย้อนหลังให้ครบ
 * เพื่อให้ตำแหน่งล้อและระยะวิ่งตรงกับหน้างานจริง
 * @param input ข้อมูลยางที่คีย์เอง + รายละเอียดการถอด
 */
export async function unmountManualTireAction(input: ManualUnmountInput): Promise<ActionResult> {
  const { profile } = await requireSession(['admin', 'technician'])
  const parsed = manualUnmountSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)
  const data = parsed.data
  const supabase = await createClient()

  const mountedOdometer = data.mounted_odometer ?? data.odometer
  if (mountedOdometer > data.odometer) {
    return {
      ok: false,
      error: 'เลขไมล์ตอนใส่ยางต้องไม่มากกว่าเลขไมล์ปัจจุบัน',
      fieldErrors: { mounted_odometer: 'ต้องไม่มากกว่าเลขไมล์ปัจจุบัน' },
    }
  }

  // ยังไม่มีรุ่นในแคตตาล็อกแต่ช่างพิมพ์ยี่ห้อมา → สร้างยี่ห้อ/รุ่นให้อัตโนมัติ
  let modelId = data.tire_model_id
  if (!modelId && data.brand_name) {
    const ensured = await ensureBrandModelFor(supabase, profile.company_id!, data.brand_name, data.model_name, data.size)
    if (!ensured.ok) return ensured
    modelId = ensured.data?.modelId ?? null
  }

  // ยางที่ช่างคีย์หน้างานสร้างได้ทุกแพ็กเกจ (ด่าน Premium มีเฉพาะฟอร์มคลังยาง)
  const created = await insertStockTire(supabase, profile.company_id!, {
    serial_no: data.serial_no,
    tire_model_id: modelId,
    brand_name: data.brand_name,
    model_name: data.model_name,
    size: data.size,
    dot: data.dot,
    new_tread_mm: data.new_tread_mm,
    tread_mm: data.tread_mm,
    note: data.note,
  })
  if (!created.ok) return created

  const tireId = created.data!.id

  // ใส่ย้อนหลังเพื่อผูกยางเข้าตำแหน่งเดิมก่อน แล้วจึงถอดออกตามจริง
  const { error: mountError } = await supabase.rpc('mount_tire', {
    p_tire_id: tireId,
    p_vehicle_id: data.vehicle_id,
    p_position_code: data.position_code,
    p_odometer: mountedOdometer,
    p_tread_mm: null,
    p_note: `${BACKFILL_NOTE_PREFIX} (ยางไม่มีข้อมูลในระบบ)`,
    p_event_date: data.event_date,
  })
  if (mountError) {
    // ลบยางที่เพิ่งสร้างทิ้ง เพื่อไม่ให้ค้างเป็นข้อมูลขยะในคลัง
    await supabase.from('tires').delete().eq('id', tireId).eq('status', 'in_stock')
    return fail(mountError)
  }

  const { error: unmountError } = await supabase.rpc('unmount_tire', {
    p_tire_id: tireId,
    p_odometer: data.odometer,
    p_tread_mm: data.tread_mm,
    p_reason_id: data.reason_id,
    p_note: data.note,
    p_event_date: data.event_date,
  })
  if (unmountError) return fail(unmountError)

  revalidateService()
  return { ok: true }
}

/**
 * เปลี่ยนยาง: ถอดเส้นเดิมออกแล้วใส่เส้นใหม่ในตำแหน่งเดียวกัน
 * @param unmount ข้อมูลการถอดเส้นเดิม
 * @param mount ข้อมูลการใส่เส้นใหม่
 */
export async function replaceTireAction(
  unmount: UnmountInput,
  mount: MountInput,
): Promise<ActionResult> {
  const removed = await unmountTireAction(unmount)
  if (!removed.ok) return removed
  return mountTireAction(mount)
}

/* ============================================================
 * บันทึกหลายรายการในครั้งเดียว (ถอด/ใส่ หลายเส้นต่อรถ 1 คัน)
 * ============================================================ */

const manualTireSchema = z.object({
  /**
   * ซีรีย์ยาง — เว้นว่างได้เฉพาะเมื่อ unknown_serial = true (ยางที่ถอดออกอ่านซีรีย์ไม่ได้)
   * ระบบจะตั้งซีรีย์แทนให้ (UNK-...) ก่อนบันทึก
   */
  serial_no: z
    .string()
    .trim()
    .toUpperCase()
    .max(SERIAL_MAX, `ซีรีย์ยางยาวได้ไม่เกิน ${SERIAL_MAX} ตัว`),
  /** true = ไม่ทราบซีรีย์ของยางที่ถอดออก (ใช้ได้กับรายการถอดเท่านั้น) */
  unknown_serial: z.boolean().optional(),
  tire_model_id: optionalText,
  brand_name: optionalText,
  model_name: optionalText,
  size: optionalText,
  dot: optionalText,
  new_tread_mm: optionalNumber,
  /** เลขไมล์ตอนที่ยางเส้นนี้ถูกใส่ (ถ้าทราบ) ใช้คำนวณระยะวิ่งย้อนหลัง */
  mounted_odometer: optionalNumber,
  /** หมายเหตุที่เก็บกับยางเส้นใหม่ (tires.note) เช่น ยี่ห้อ/รุ่นจริงของยาง "อื่นๆ" */
  note: optionalText,
}).superRefine((data, ctx) => {
  if (data.unknown_serial && data.serial_no === '') return
  if (data.serial_no === '') {
    ctx.addIssue({ code: 'custom', path: ['serial_no'], message: 'กรุณากรอกเลขยาง (ซีเรียล)' })
    return
  }
  if (!SERIAL_PATTERN.test(data.serial_no)) {
    ctx.addIssue({ code: 'custom', path: ['serial_no'], message: SERIAL_PATTERN_MESSAGE })
  }
})

/* ============================================================
 * หน้าช่าง: คีย์ทะเบียนแล้วเริ่มงานได้เลย
 *
 * รถที่ยังไม่มีในระบบ (หรือการเปลี่ยนแบบรถ) จะยังไม่ถูกบันทึกจนกว่าช่างกดยืนยันบันทึกงานยาง
 * ระหว่างกรอกใช้ checkServiceVehicleAction ตรวจล่วงหน้าได้โดยไม่เขียนฐานข้อมูล
 * ============================================================ */

/** รถจากหน้าช่าง: ต้องมีทะเบียน (ตามรูปแบบมาตรฐาน + จังหวัด) หรือชื่อเรียกอย่างใดอย่างหนึ่ง · เลือกรถเดิมด้วย vehicle_id ไม่ต้องตรวจ */
const serviceVehicleSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  ...vehicleIdentityFields,
  axle_type: z.string().trim().min(1, 'กรุณาเลือกประเภทรถ').max(30),
}).superRefine((data, ctx) => {
  if (!data.vehicle_id) refineVehicleIdentity(true)(data, ctx)
}).transform(normalizeVehicleIdentity)

/** ตรวจรถล่วงหน้า (ไม่บันทึก) */
const serviceVehicleCheckSchema = z.object({
  /** ลูกค้าที่ร้านค้าเลือก — แอดมิน/ช่างไม่ต้องส่ง */
  company_id: z.string().uuid().optional(),
  vehicle: serviceVehicleSchema,
})

export type ServiceVehicleInput = z.input<typeof serviceVehicleSchema>
export type ServiceVehicleCheckInput = z.input<typeof serviceVehicleCheckSchema>
type ServiceVehicleData = z.output<typeof serviceVehicleSchema>
type SupabaseServer = Awaited<ReturnType<typeof createClient>>

const VEHICLE_COLUMNS = 'id, plate_no, nickname, province, axle_type, current_mileage, is_active'

interface ServiceVehicleRow {
  id: string
  plate_no: string | null
  nickname: string | null
  province: string | null
  axle_type: string
  current_mileage: number
  is_active: boolean
}

export interface ServiceVehicleCheckResult {
  /** รถเดิมในระบบ · null = ยังไม่มี ระบบจะสร้างให้ตอนยืนยันบันทึก */
  vehicle: Omit<ServiceVehicleRow, 'is_active'> | null
  /** แบบรถที่จะใช้ */
  axle_type: string
}

/** รถที่หาเจอ + สิ่งที่ต้องทำตอนยืนยันบันทึก (ยังไม่เขียนอะไรลงฐานข้อมูล) */
interface ResolvedServiceVehicle {
  existing: ServiceVehicleRow | null
  plan: Exclude<ServiceVehiclePlan, { kind: 'error' }>
}

/**
 * หารถจากรหัส ทะเบียน+จังหวัด หรือชื่อเรียก แล้วตัดสินว่าต้องสร้าง/ใช้ตามเดิม/เปลี่ยนแบบรถ — อ่านอย่างเดียว
 * @param supabase client ของผู้ใช้ (ผ่าน RLS)
 * @param companyId บริษัทเจ้าของรถ
 * @param data รถที่ช่างเลือกหรือคีย์ พร้อมแบบรถ
 */
async function resolveServiceVehicle(
  supabase: SupabaseServer,
  companyId: string,
  data: ServiceVehicleData,
): Promise<ActionResult<ResolvedServiceVehicle>> {
  const { data: axleType, error: axleTypeError } = await supabase
    .from('axle_types')
    .select('code, is_active')
    .eq('code', data.axle_type)
    .maybeSingle()
  if (axleTypeError) return fail(axleTypeError)
  if (!axleType?.is_active) {
    return { ok: false, error: 'ประเภทรถนี้ถูกปิดใช้งานแล้ว — แจ้งแอดมินเพื่อเปิดใช้งาน' }
  }

  let vehicleQuery = supabase.from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('company_id', companyId)
  if (data.vehicle_id) {
    vehicleQuery = vehicleQuery.eq('id', data.vehicle_id)
  } else if (data.plate_no) {
    vehicleQuery = vehicleQuery.eq('plate_no', data.plate_no).eq('province', data.province ?? '')
  } else {
    // รถไม่มีทะเบียน: ชื่อเรียกไม่ซ้ำกันในบริษัท (ไม่สนตัวพิมพ์เล็ก–ใหญ่) — escape อักขระพิเศษของ LIKE
    const literal = (data.nickname ?? '').replace(/[\\%_]/g, '\\$&')
    vehicleQuery = vehicleQuery.is('plate_no', null).ilike('nickname', literal)
  }
  const { data: existing, error: findError } = await vehicleQuery.maybeSingle<ServiceVehicleRow>()
  if (findError) return fail(findError)

  let mountedCount = 0
  if (existing && existing.is_active && existing.axle_type !== data.axle_type) {
    const { count, error: countError } = await supabase
      .from('tires')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', existing.id)
      .eq('status', 'mounted')
    if (countError) return fail(countError)
    mountedCount = count ?? 0
  }

  const plan = planServiceVehicle({
    requestedVehicleId: data.vehicle_id,
    existing,
    axleType: data.axle_type,
    mountedCount,
  })
  if (plan.kind === 'error') return { ok: false, error: plan.error }
  return { ok: true, data: { existing, plan } }
}

/**
 * บันทึกรถตามแผน (สร้างใหม่ / เปลี่ยนแบบรถ) — เรียกตอนยืนยันบันทึกงานยางเท่านั้น
 * @returns รหัสรถ และฟังก์ชันคืนค่าเดิม ใช้เมื่อบันทึกงานยางไม่สำเร็จ
 */
async function commitServiceVehicle(
  supabase: SupabaseServer,
  companyId: string,
  data: ServiceVehicleData,
  resolved: ResolvedServiceVehicle,
): Promise<ActionResult<{ id: string; undo: () => Promise<void> }>> {
  const { existing, plan } = resolved

  if (plan.kind === 'create') {
    const { data: created, error: createError } = await supabase
      .from('vehicles')
      .insert({
        company_id: companyId,
        plate_no: data.plate_no,
        nickname: data.nickname,
        province: data.province,
        axle_type: data.axle_type,
        current_mileage: 0,
      })
      .select('id')
      .single()
    if (createError) {
      const duplicate = vehicleUniqueViolation(createError)
      if (duplicate) return { ok: false, error: `${duplicate.error} — ลองค้นหาใหม่อีกครั้ง` }
      return fail(createError)
    }
    return {
      ok: true,
      data: {
        id: created.id,
        undo: async () => {
          await supabase.from('vehicles').delete().eq('id', created.id)
        },
      },
    }
  }

  const vehicleId = existing!.id
  if (plan.kind === 'change_type') {
    const { error: updateError } = await supabase
      .from('vehicles')
      .update({ axle_type: data.axle_type })
      .eq('id', vehicleId)
    if (updateError) return fail(updateError)
    return {
      ok: true,
      data: {
        id: vehicleId,
        undo: async () => {
          await supabase.from('vehicles').update({ axle_type: plan.previousAxleType }).eq('id', vehicleId)
        },
      },
    }
  }

  return { ok: true, data: { id: vehicleId, undo: async () => {} } }
}

/**
 * ตรวจรถที่ช่างเลือก/คีย์หน้างานกับแบบรถที่เลือก โดยไม่บันทึกอะไร
 *
 * ช่างทำงานกับรถที่แอดมินยังไม่ได้บันทึกไว้ได้ — รถใหม่จะถูกสร้างตอนยืนยันบันทึกงานยาง
 * (applyServiceBatchAction) ถ้าออกจากหน้ากลางทาง จะไม่มีรถค้างในระบบ
 *
 * @param input บริษัท (ร้านค้า) + รหัสรถเดิม หรือทะเบียน+จังหวัด หรือชื่อเรียก พร้อมแบบรถ
 */
export async function checkServiceVehicleAction(
  input: ServiceVehicleCheckInput,
): Promise<ActionResult<ServiceVehicleCheckResult>> {
  const parsed = serviceVehicleCheckSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  // แอดมิน/ช่าง = บริษัทตัวเอง · ร้านค้า = ลูกค้าที่เลือก (ต้องอยู่ภายใต้ร้าน)
  const scope = await resolveServiceScope(parsed.data.company_id)
  if (!scope.ok) return scope

  const supabase = await createClient()
  const resolved = await resolveServiceVehicle(supabase, scope.companyId, parsed.data.vehicle)
  if (!resolved.ok) return resolved

  const existing = resolved.data!.existing
  return {
    ok: true,
    data: {
      vehicle: existing
        ? {
            id: existing.id,
            plate_no: existing.plate_no,
            nickname: existing.nickname,
            province: existing.province,
            axle_type: existing.axle_type,
            current_mileage: existing.current_mileage,
          }
        : null,
      axle_type: parsed.data.vehicle.axle_type,
    },
  }
}

const batchItemSchema = z.object({
  kind: z.enum(['unmount', 'mount', 'manual_unmount', 'manual_mount']),
  tire_id: optionalText,
  /** ตำแหน่งต้นทาง (ถอด) หรือปลายทาง (ใส่) */
  position_code: optionalText,
  tread_mm: optionalNumber,
  reason_id: optionalText,
  note: optionalText,
  manual: manualTireSchema.nullable().optional(),
  /** true = ช่างเลือก "ยางใหม่" — ต้องใช้รุ่นจากแคตตาล็อกของ super admin และซีรีย์ต้องไม่ซ้ำ */
  new_tire: z.boolean().optional(),
})

const batchSchema = z.object({
  /** ลูกค้าที่ร้านค้าเลือก — แอดมิน/ช่างไม่ต้องส่ง (ใช้บริษัทตัวเองเสมอ) */
  company_id: z.string().uuid().optional(),
  /** รถเดิมที่ไม่ต้องแก้อะไร */
  vehicle_id: z.string().uuid().optional(),
  /** รถที่ช่างคีย์/เปลี่ยนแบบรถหน้างาน — สร้างหรือแก้ตอนบันทึกนี้ (ส่งอย่างใดอย่างหนึ่งกับ vehicle_id) */
  vehicle: serviceVehicleSchema.optional(),
  odometer: odometerSchema,
  event_date: z.string().min(1),
  items: z.array(batchItemSchema).min(1, 'กรุณาเพิ่มอย่างน้อย 1 รายการ').max(60),
}).refine((data) => Boolean(data.vehicle_id) !== Boolean(data.vehicle), {
  message: 'กรุณาเลือกรถ',
  path: ['vehicle_id'],
})

export type ServiceBatchItem = z.input<typeof batchItemSchema>
export type ServiceBatchInput = z.input<typeof batchSchema>

/** op ที่จะส่งให้ RPC apply_tire_ops ทำงานตามลำดับ */
interface TireOp {
  op: 'mount' | 'unmount'
  tire_id: string
  position_code?: string
  odometer: number
  tread_mm?: number | null
  reason_id?: string | null
  note?: string | null
}

/**
 * บันทึกงานยางหลายรายการของรถ 1 คันในครั้งเดียว
 *
 * ลำดับการทำงานถูกจัดให้อัตโนมัติ เพื่อให้ตำแหน่งล้อไม่ชนกันระหว่างทาง
 *   1) ผูกยางที่ช่างคีย์เอง (ยังไม่มีในระบบ) เข้าตำแหน่งเดิมย้อนหลัง
 *   2) ถอดยางทุกเส้นที่ต้องถอด
 *   3) ใส่ยางทุกเส้นตามตำแหน่งที่เลือก
 *
 * ทั้งหมดรันใน RPC เดียว = ทรานแซกชันเดียว ถ้าพลาดรายการใดจะ rollback ทั้งชุด
 *
 * รถที่ช่างคีย์ใหม่ (หรือเปลี่ยนแบบรถ) ส่งมาเป็น input.vehicle — ระบบบันทึกรถก่อนเรียก RPC
 * และคืนค่าเดิม (ลบรถใหม่ / คืนแบบรถเดิม) ถ้าบันทึกงานยางไม่สำเร็จ
 *
 * @param input รถ เลขไมล์ วันที่ และรายการงานทั้งหมด
 * @returns จำนวนรายการที่บันทึก
 */
export async function applyServiceBatchAction(
  input: ServiceBatchInput,
): Promise<ActionResult<{ count: number }>> {
  const parsed = batchSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  // แอดมิน/ช่าง = บริษัทตัวเอง · ร้านค้า = ลูกค้าที่เลือก (ต้องอยู่ภายใต้ร้าน)
  const scope = await resolveServiceScope(parsed.data.company_id)
  if (!scope.ok) return scope

  const { odometer, event_date, items } = parsed.data
  const supabase = await createClient()
  /** บริษัทเจ้าของรถ/ยาง — ยางที่ช่างคีย์หน้างานสร้างได้ทุกแพ็กเกจ */
  const companyId = scope.companyId

  /** รถที่ช่างคีย์/เปลี่ยนแบบรถหน้างาน — ยังไม่บันทึก จะบันทึกก่อนเรียก RPC */
  let pendingVehicle: ResolvedServiceVehicle | null = null
  /** รหัสรถ · null = รถใหม่ที่ยังไม่ได้สร้าง (จึงยังไม่มียางเส้นใดติดอยู่) */
  let vehicle_id: string | null = parsed.data.vehicle_id ?? null
  if (parsed.data.vehicle) {
    const resolved = await resolveServiceVehicle(supabase, companyId, parsed.data.vehicle)
    if (!resolved.ok) return resolved
    pendingVehicle = resolved.data!
    vehicle_id = pendingVehicle.existing?.id ?? null
  }
  /** กฎร้านค้า: ใส่ได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน (ยางที่ถอดออกเป็นยี่ห้อใดก็ได้) */
  const shopRules = scope.isShop
  const shopGrant = shopRules && scope.session.profile.shop_id
    ? await loadShopMountGrant(supabase, scope.session.profile.shop_id)
    : null

  // รถต้องเป็นของบริษัทนี้จริง — ร้านค้าเห็นรถหลายบริษัท จึงกันส่ง vehicle_id ข้ามบริษัท
  // (รถจาก input.vehicle ตรวจบริษัท/สถานะใน resolveServiceVehicle แล้ว)
  if (!pendingVehicle) {
    const { data: vehicleRow, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, company_id, is_active')
      .eq('id', vehicle_id!)
      .maybeSingle()
    if (vehicleError) return fail(vehicleError)
    if (!vehicleRow || vehicleRow.company_id !== companyId) {
      return { ok: false, error: 'ไม่พบรถคันนี้ในบริษัทที่เลือก' }
    }
    if (!vehicleRow.is_active) return { ok: false, error: 'รถคันนี้ถูกปิดใช้งานแล้ว' }
  }

  /**
   * ตรวจว่ายาง/รุ่นที่จะใส่อยู่ในสิทธิ์ที่ Austone กำหนดให้ร้าน (เฉพาะเมื่อผู้บันทึกเป็นร้านค้า)
   * @param tire รหัสรุ่น + snapshot ยี่ห้อ/รุ่นของยาง
   * @param at ป้ายตำแหน่งรายการสำหรับข้อความผิดพลาด
   */
  function shopGrantViolation(tire: ShopGrantTire, at: string): ActionResult<never> | null {
    if (!shopRules) return null
    if (shopGrant && tireMatchesGrant(shopGrant, tire)) return null
    return { ok: false, error: `${at}: ${SHOP_MOUNT_GRANT_MESSAGE}` }
  }

  /**
   * ตั้งซีรีย์แทนให้ยางที่ถอดออกแต่อ่านซีรีย์ไม่ได้ — สุ่มใหม่ถ้าชนกับซีรีย์ที่มีอยู่ในบริษัทนี้
   * @returns ซีรีย์ที่ไม่ซ้ำ หรือ null เมื่อสุ่มชนติดกันหลายครั้ง (แทบเป็นไปไม่ได้)
   */
  async function nextUnknownSerial(): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateUnknownSerial(new Date(`${event_date}T00:00:00`))
      const { data: clash } = await supabase
        .from('tires')
        .select('id')
        .eq('company_id', companyId)
        .ilike('serial_no', candidate)
        .maybeSingle()
      if (!clash) return candidate
    }
    return null
  }

  const preMounts: TireOp[] = []
  const unmounts: TireOp[] = []
  const mounts: TireOp[] = []
  /** ยางที่สร้างใหม่ในรอบนี้ ใช้ลบทิ้งถ้าบันทึกไม่สำเร็จ */
  const createdTireIds: string[] = []

  /** ลบยางที่เพิ่งสร้าง เพื่อไม่ให้ค้างเป็นข้อมูลขยะเมื่อบันทึกไม่สำเร็จ */
  async function rollbackCreatedTires() {
    for (const id of createdTireIds) {
      await supabase.from('tires').delete().eq('id', id).eq('status', 'in_stock')
    }
  }

  for (const [index, item] of items.entries()) {
    const at = `รายการที่ ${index + 1}`

    if (item.kind === 'manual_unmount') {
      const manual = item.manual
      if (!manual) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: ไม่มีข้อมูลยางที่คีย์เอง` }
      }
      if (!item.position_code) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: กรุณาเลือกตำแหน่งล้อ` }
      }

      const mountedOdometer = manual.mounted_odometer ?? odometer
      if (mountedOdometer > odometer) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: เลขไมล์ตอนใส่ยางต้องไม่มากกว่าเลขไมล์ปัจจุบัน` }
      }

      // ไม่ทราบซีรีย์ของยางที่ถอด → ตั้งซีรีย์แทน (UNK-...) เพื่อให้ยังมีประวัติการถอดและเหตุผล
      let unmountSerial = manual.serial_no
      if (manual.unknown_serial && unmountSerial === '') {
        const generated = await nextUnknownSerial()
        if (!generated) {
          await rollbackCreatedTires()
          return { ok: false, error: `${at}: ตั้งซีรีย์แทนไม่สำเร็จ กรุณาลองใหม่` }
        }
        unmountSerial = generated
      }

      // ซีรีย์นี้อาจมีอยู่แล้วแต่หน้าช่างมองไม่เห็น (เช่น ตัดจำหน่ายแล้ว หรืออยู่ในคลัง)
      // ต้องใช้เส้นเดิม ไม่งั้นชน unique (company_id, serial_no) และประวัติยางขาดตอน
      // จำกัดด้วย company_id เพราะร้านค้ามองเห็นยางของหลายบริษัท
      const { data: existingTire, error: existingError } = await supabase
        .from('tires')
        .select('id, serial_no, status, vehicle_id, position_code')
        .eq('company_id', companyId)
        // ilike = ไม่สนตัวพิมพ์ ครอบคลุมยางเก่าที่บันทึกไว้เป็นตัวพิมพ์เล็กก่อน migration 008
        .ilike('serial_no', unmountSerial)
        .maybeSingle()
      if (existingError) {
        await rollbackCreatedTires()
        return fail(existingError)
      }

      if (existingTire) {
        if (existingTire.status === 'mounted' && existingTire.vehicle_id !== vehicle_id) {
          await rollbackCreatedTires()
          return {
            ok: false,
            error: `${at}: ซีรีย์ ${existingTire.serial_no} ติดตั้งอยู่บนรถคันอื่น — ตรวจสอบซีรีย์ยางอีกครั้ง`,
          }
        }

        // ติดตั้งอยู่ที่ล้อนี้อยู่แล้ว = ถอดได้เลย ไม่ต้องผูกย้อนหลัง
        const alreadyHere =
          existingTire.status === 'mounted' && existingTire.position_code === item.position_code
        if (!alreadyHere) {
          preMounts.push({
            op: 'mount',
            tire_id: existingTire.id,
            position_code: item.position_code,
            odometer: mountedOdometer,
            note: `${BACKFILL_NOTE_PREFIX} (ระบบไม่มีข้อมูลว่ายางเส้นนี้อยู่ที่ล้อนี้)`,
          })
        }
        unmounts.push({
          op: 'unmount',
          tire_id: existingTire.id,
          odometer,
          tread_mm: item.tread_mm,
          reason_id: item.reason_id,
          note: item.note,
        })
        continue
      }

      // ยังไม่มีรุ่นในแคตตาล็อกแต่ช่างพิมพ์ยี่ห้อมา → สร้างยี่ห้อ/รุ่นให้อัตโนมัติ
      let modelId = manual.tire_model_id
      if (!modelId && manual.brand_name) {
        const ensured = await ensureBrandModelFor(supabase, companyId, manual.brand_name, manual.model_name, manual.size)
        if (!ensured.ok) {
          await rollbackCreatedTires()
          return ensured
        }
        modelId = ensured.data?.modelId ?? null
      }

      const created = await insertStockTire(supabase, companyId, {
        serial_no: unmountSerial,
        tire_model_id: modelId,
        brand_name: manual.brand_name,
        model_name: manual.model_name,
        size: manual.size,
        dot: manual.dot,
        new_tread_mm: manual.new_tread_mm,
        tread_mm: item.tread_mm,
        note: manual.unknown_serial
          ? ['ไม่ทราบซีรีย์ (ระบบตั้งให้)', item.note].filter(Boolean).join(' · ')
          : item.note,
      })
      if (!created.ok) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: ${created.error}` }
      }

      const tireId = created.data!.id
      createdTireIds.push(tireId)

      preMounts.push({
        op: 'mount',
        tire_id: tireId,
        position_code: item.position_code,
        odometer: mountedOdometer,
        note: `${BACKFILL_NOTE_PREFIX} (ยางไม่มีข้อมูลในระบบ)`,
      })
      unmounts.push({
        op: 'unmount',
        tire_id: tireId,
        odometer,
        tread_mm: item.tread_mm,
        reason_id: item.reason_id,
        note: item.note,
      })
      continue
    }

    if (item.kind === 'manual_mount') {
      // ยางที่ช่างคีย์เองตอนใส่ (ยังไม่มีในคลัง) → สร้างเข้าระบบก่อนแล้วค่อยใส่
      const manual = item.manual
      if (!manual) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: ไม่มีข้อมูลยางที่คีย์เอง` }
      }
      if (!item.position_code) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: กรุณาเลือกตำแหน่งล้อที่จะใส่ยาง` }
      }
      // ยางที่ใส่ต้องมีซีรีย์เสมอ — "ไม่ทราบซีรีย์" ใช้ได้เฉพาะยางที่ถอดออก
      if (manual.serial_no === '') {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: กรุณากรอกซีรีย์ของยางที่จะใส่` }
      }

      // เช็คซ้ำจากซีรีย์ยางอย่างเดียว — ครอบคลุมยางที่หน้าช่างมองไม่เห็น (เช่น ตัดจำหน่ายแล้ว)
      // จำกัดด้วย company_id เพราะร้านค้ามองเห็นยางของหลายบริษัท
      const { data: existingTire, error: existingError } = await supabase
        .from('tires')
        .select('id, serial_no, status, vehicle_id, brand_name, model_name, tire_model_id')
        .eq('company_id', companyId)
        // ilike = ไม่สนตัวพิมพ์ ครอบคลุมยางเก่าที่บันทึกไว้เป็นตัวพิมพ์เล็กก่อน migration 008
        .ilike('serial_no', manual.serial_no)
        .maybeSingle()
      if (existingError) {
        await rollbackCreatedTires()
        return fail(existingError)
      }

      if (existingTire) {
        const violation = shopGrantViolation(existingTire, at)
        if (violation) {
          await rollbackCreatedTires()
          return violation
        }
        if (item.new_tire) {
          await rollbackCreatedTires()
          return {
            ok: false,
            error: `${at}: ซีรีย์ ${existingTire.serial_no} มีอยู่ในระบบแล้ว — ยางใหม่ต้องเป็นซีรีย์ที่ยังไม่เคยบันทึก`,
          }
        }
        // ยางเก่า: ซ้ำเฉพาะเมื่อซีรีย์นั้นยังติดตั้งอยู่บนรถ ต้องถอดออกก่อนถึงจะเอาไปใส่ที่อื่นได้
        if (existingTire.status === 'mounted') {
          await rollbackCreatedTires()
          return {
            ok: false,
            error: `${at}: ซีรีย์ ${existingTire.serial_no} ติดตั้งอยู่บนรถคันอื่น — ต้องถอดออกก่อน`,
          }
        }
        // ไม่ได้ติดตั้งอยู่ = ใช้ยางเส้นเดิม ไม่สร้างซ้ำ ประวัติยางจะได้ต่อเนื่อง
        mounts.push({
          op: 'mount',
          tire_id: existingTire.id,
          position_code: item.position_code,
          odometer,
          tread_mm: item.tread_mm,
          note: item.note,
        })
        continue
      }

      // ร้านค้า: รุ่นที่ใส่ต้องอยู่ในสิทธิ์ของร้าน — เช็คจากรุ่นในแคตตาล็อกก่อน (เชื่อถือได้กว่าค่าที่ client ส่งมา)
      if (shopRules) {
        const snapshot = await resolveModelSnapshot(supabase, manual.tire_model_id)
        const violation = shopGrantViolation({
          tire_model_id: manual.tire_model_id,
          brand_name: snapshot.brand_name ?? manual.brand_name,
          model_name: snapshot.model_name ?? manual.model_name,
        }, at)
        if (violation) {
          await rollbackCreatedTires()
          return violation
        }
      }

      let modelId = manual.tire_model_id
      if (!modelId && manual.brand_name) {
        const ensured = await ensureBrandModelFor(supabase, companyId, manual.brand_name, manual.model_name, manual.size)
        if (!ensured.ok) {
          await rollbackCreatedTires()
          return ensured
        }
        modelId = ensured.data?.modelId ?? null
      }

      const created = await insertStockTire(supabase, companyId, {
        serial_no: manual.serial_no,
        tire_model_id: modelId,
        brand_name: manual.brand_name,
        model_name: manual.model_name,
        size: manual.size,
        dot: manual.dot,
        new_tread_mm: manual.new_tread_mm,
        tread_mm: item.tread_mm,
        // หมายเหตุของยางเส้นใหม่ (ยี่ห้อ/รุ่นจริงของยาง "อื่นๆ") — ถ้าไม่ส่งแยกมา ใช้หมายเหตุของรายการใส่
        // ยาง "อื่นๆ" บังคับตัวพิมพ์ใหญ่ฝั่ง server ด้วย กันข้อมูลจาก client ที่ไม่ผ่านฟอร์ม
        note: isOtherBrand(manual.brand_name) ? (manual.note ?? item.note)?.toUpperCase() ?? null : manual.note ?? item.note,
      })
      if (!created.ok) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: ${created.error}` }
      }

      const tireId = created.data!.id
      createdTireIds.push(tireId)

      mounts.push({
        op: 'mount',
        tire_id: tireId,
        position_code: item.position_code,
        odometer,
        tread_mm: item.tread_mm,
        note: item.note,
      })
      continue
    }

    if (!item.tire_id) {
      await rollbackCreatedTires()
      return { ok: false, error: `${at}: ไม่ได้ระบุยาง` }
    }

    // ยางที่อ้างด้วย id ต้องเป็นของบริษัทนี้ (ร้านค้าเห็นยางหลายบริษัท) และถ้าใส่ต้องอยู่ในสิทธิ์รุ่นของร้าน
    const { data: referenced, error: referencedError } = await supabase
      .from('tires')
      .select('id, company_id, brand_name, model_name, tire_model_id')
      .eq('id', item.tire_id)
      .maybeSingle()
    if (referencedError) {
      await rollbackCreatedTires()
      return fail(referencedError)
    }
    if (!referenced || referenced.company_id !== companyId) {
      await rollbackCreatedTires()
      return { ok: false, error: `${at}: ไม่พบยางเส้นนี้ในบริษัทที่เลือก` }
    }
    if (item.kind === 'mount') {
      const violation = shopGrantViolation(referenced, at)
      if (violation) {
        await rollbackCreatedTires()
        return violation
      }
    }

    if (item.kind === 'unmount') {
      unmounts.push({
        op: 'unmount',
        tire_id: item.tire_id,
        odometer,
        tread_mm: item.tread_mm,
        reason_id: item.reason_id,
        note: item.note,
      })
    } else {
      if (!item.position_code) {
        await rollbackCreatedTires()
        return { ok: false, error: `${at}: กรุณาเลือกตำแหน่งล้อที่จะใส่ยาง` }
      }
      if (item.new_tire) {
        // เลือกยางเส้นที่มีอยู่แล้วมาใส่เป็น "ยางใหม่" ไม่ได้ — ซีรีย์ซ้ำกับของเดิม
        await rollbackCreatedTires()
        return {
          ok: false,
          error: `${at}: ซีรีย์นี้มีอยู่ในระบบแล้ว — ยางใหม่ต้องเป็นซีรีย์ที่ยังไม่เคยบันทึก`,
        }
      }
      mounts.push({
        op: 'mount',
        tire_id: item.tire_id,
        position_code: item.position_code,
        odometer,
        tread_mm: item.tread_mm,
        note: item.note,
      })
    }
  }

  const ops = [...preMounts, ...unmounts, ...mounts]

  // บันทึกรถตอนนี้ — หลังตรวจรายการยางผ่านหมดแล้ว และช่างกดยืนยันบันทึกแล้วเท่านั้น
  let undoVehicle = async () => {}
  if (pendingVehicle) {
    const committed = await commitServiceVehicle(supabase, companyId, parsed.data.vehicle!, pendingVehicle)
    if (!committed.ok) {
      await rollbackCreatedTires()
      return committed
    }
    vehicle_id = committed.data!.id
    undoVehicle = committed.data!.undo
  }

  const { error } = await supabase.rpc('apply_tire_ops', {
    p_vehicle_id: vehicle_id!,
    p_event_date: event_date,
    p_ops: ops,
  })

  if (error) {
    await rollbackCreatedTires()
    await undoVehicle()
    return fail(error)
  }

  revalidateService()
  return { ok: true, data: { count: items.length } }
}

function revalidateService() {
  revalidatePath('/service')
  revalidatePath('/dashboard')
  revalidatePath('/tires')
  revalidatePath('/vehicles')
  // ฝั่งร้านค้าใช้ข้อมูลชุดเดียวกัน
  revalidatePath('/shop')
  revalidatePath('/shop/service')
  revalidatePath('/shop/reports')
}
