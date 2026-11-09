'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { SHOP_MOUNT_BRAND_MESSAGE, isShopMountBrand } from '@/lib/shop-rules'
import { requireSession } from '@/lib/auth'
import { AUSTONE_WRITE_ROLES, DEALER_MANAGER_ROLES } from '@/lib/roles'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { removeTireImage, storeTireImage } from '@/lib/tire-images'
import { ActionResult, fail, optionalNumber, optionalText, zodFail } from '@/lib/action-result'

/* ============================================================ ลูกค้า */

/** รูปแบบวันที่ YYYY-MM-DD ที่ฟอร์ม (input type="date") ส่งมา */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * ตรวจว่าข้อความเป็นวันที่ YYYY-MM-DD ที่มีอยู่จริง (กัน 2026-02-30 เป็นต้น)
 * @param value ข้อความวันที่
 */
function isValidISODate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** วันที่ YYYY-MM-DD ที่เว้นว่างได้ — ว่าง = null (ไม่มีกำหนด) */
const optionalDate = optionalText.refine((v) => v === null || isValidISODate(v), 'วันที่ไม่ถูกต้อง')

/** แพ็กเกจ + วันหมดอายุ — super admin เท่านั้นที่เปลี่ยนได้ (DB trigger กันแอดมินบริษัทไว้แล้ว) */
const planFields = {
  plan: z.enum(['standard', 'premium']).default('standard'),
  /** วันสุดท้ายที่ premium มีผล — มีความหมายเฉพาะแพ็กเกจ premium */
  plan_expires_at: optionalDate,
}

/**
 * วันหมดอายุมีความหมายเฉพาะ premium — แพ็กเกจ standard เก็บเป็น null เสมอ
 * @param data ค่าที่ผ่าน schema แล้ว
 */
function normalizePlan<T extends { plan: 'standard' | 'premium'; plan_expires_at: string | null }>(
  data: T,
): T {
  return { ...data, plan_expires_at: data.plan === 'premium' ? data.plan_expires_at : null }
}

/** uuid ที่เว้นว่างได้ — ว่าง = null */
const optionalUuid = optionalText.refine(
  (v) => v === null || z.string().uuid().safeParse(v).success,
  'รหัสไม่ถูกต้อง',
)

const companySchema = z.object({
  code: z.string().trim().min(2, 'รหัสบริษัทอย่างน้อย 2 ตัวอักษร').max(20),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อบริษัท'),
  /** ร้านค้าที่ดูแลบริษัทนี้ — null = ลูกค้าตรงของ Austone Thailand (migration 021) */
  shop_id: optionalUuid,
  tax_id: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  contact_name: optionalText,
  alert_km: z.number().int().min(1).default(10000),
  alert_tread_mm: z.number().min(0).default(3),
  ...planFields,
})

export type SuperCompanyInput = z.input<typeof companySchema>
const companyAutoCodeSchema = companySchema.omit({ code: true })

const companyPlanSchema = z.object(planFields)

export type CompanyPlanInput = z.input<typeof companyPlanSchema>

/**
 * เพิ่มลูกค้าใหม่
 * @param input ข้อมูลบริษัท
 */
export async function createCompany(input: SuperCompanyInput): Promise<ActionResult<{ id: string }>> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = companyAutoCodeSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .insert(normalizePlan(parsed.data))
    .select('id')
    .single()

  if (error) return fail(error)

  // ตั้งต้นให้บริษัทใหม่เห็นประเภทเพลาที่เปิดใช้งานอยู่ทั้งหมด แล้วค่อยไปปรับที่แท็บสิทธิ์
  const { data: axleTypes } = await supabase
    .from('axle_types')
    .select('id')
    .eq('is_active', true)
  if (axleTypes && axleTypes.length > 0) {
    await supabase
      .from('company_axle_types')
      .insert(axleTypes.map((axleType) => ({ company_id: data.id, axle_type_id: axleType.id })))
  }

  revalidatePath('/superadmin/companies')
  return { ok: true, data: { id: data.id } }
}

/**
 * แก้ไขข้อมูลลูกค้า
 * @param id รหัสบริษัท
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateCompany(id: string, input: SuperCompanyInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = companyAutoCodeSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update(normalizePlan(parsed.data))
    .eq('id', id)

  if (error) return fail(error)
  revalidatePath('/superadmin/companies')
  revalidatePath(`/superadmin/companies/${id}`)
  return { ok: true }
}

/**
 * เปลี่ยนแพ็กเกจของลูกค้าอย่างเดียว (ปุ่มเปลี่ยนด่วนในตาราง)
 * @param id รหัสบริษัท
 * @param input แพ็กเกจและวันหมดอายุ
 */
export async function setCompanyPlan(id: string, input: CompanyPlanInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsedId = z.string().uuid('รหัสบริษัทไม่ถูกต้อง').safeParse(id)
  if (!parsedId.success) return zodFail(parsedId.error)
  const parsed = companyPlanSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update(normalizePlan(parsed.data))
    .eq('id', parsedId.data)

  if (error) return fail(error)
  revalidatePath('/superadmin/companies')
  revalidatePath(`/superadmin/companies/${parsedId.data}`)
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานลูกค้า
 * @param id รหัสบริษัท
 * @param isActive สถานะที่ต้องการ
 */
export async function setCompanyActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from('companies').update({ is_active: isActive }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/superadmin/companies')
  return { ok: true }
}

/* ================================================== ผู้ใช้ของลูกค้า */

const companyAdminSchema = z.object({
  company_id: z.string().uuid(),
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัวอักษร'),
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  role: z.enum(['admin', 'technician']),
})

export type CompanyAdminInput = z.input<typeof companyAdminSchema>

/**
 * สร้างบัญชีผู้ใช้ให้ลูกค้า (มักใช้สร้างแอดมินคนแรก)
 * @param input ข้อมูลผู้ใช้
 */
export async function createCompanyUser(input: CompanyAdminInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = companyAdminSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงสร้างผู้ใช้ไม่ได้' }
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !created.user) return fail(authError ?? 'สร้างผู้ใช้ไม่สำเร็จ')

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    company_id: parsed.data.company_id,
    role: parsed.data.role,
    full_name: parsed.data.full_name,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return fail(profileError)
  }

  revalidatePath(`/superadmin/companies/${parsed.data.company_id}`)
  return { ok: true }
}

/* ======================================== ข้อมูลยาง (ยี่ห้อ/รุ่น) */

/**
 * เพิ่มยี่ห้อยางในแคตตาล็อกกลาง
 * @param name ชื่อยี่ห้อ
 */
export async function createBrand(name: string): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const value = name.trim().toUpperCase()
  if (!value) return { ok: false, error: 'กรุณากรอกชื่อยี่ห้อ' }

  const supabase = await createClient()
  const { error } = await supabase.from('tire_brands').insert({ name: value })
  if (error) return fail(error)

  revalidatePath('/superadmin/catalog')
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานยี่ห้อยาง
 * @param id รหัสยี่ห้อ
 * @param isActive สถานะที่ต้องการ
 */
export async function setBrandActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from('tire_brands').update({ is_active: isActive }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/superadmin/catalog')
  return { ok: true }
}

const modelSchema = z.object({
  brand_id: z.string().uuid('กรุณาเลือกยี่ห้อ'),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อรุ่น'),
  size: optionalText,
  pattern_code: optionalText,
  new_tread_mm: optionalNumber
    .refine((value) => value === null || value >= 0, 'ดอกยางตอนใหม่ต้องไม่ติดลบ')
    .refine((value) => value === null || value <= 99.9, 'ดอกยางตอนใหม่ต้องไม่เกิน 99.9 มม.'),
  image_url: optionalText,
})

/**
 * อัปโหลดรูปยางของแคตตาล็อกกลางขึ้น Supabase Storage แล้วคืน public URL
 * @param formData ต้องมี field ชื่อ "file"
 */
export async function uploadTireImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await requireSession(AUSTONE_WRITE_ROLES)
  return storeTireImage(formData.get('file'), 'models')
}

/**
 * ลบรูปยางออกจาก Storage (ใช้ตอนผู้ใช้กดเอารูปออก) — super admin ลบได้ทุกรูปใน bucket
 * @param url public URL ของรูปที่ต้องการลบ
 */
export async function deleteTireImage(url: string): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const result = await removeTireImage(url)
  if (result.ok) revalidatePath('/superadmin/catalog')
  return result
}

export type ModelInput = z.input<typeof modelSchema>

/**
 * เพิ่มรุ่นยางในแคตตาล็อกกลาง
 * @param input ข้อมูลรุ่นยาง
 */
export async function createModel(input: ModelInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = modelSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('tire_models').insert(parsed.data)
  if (error) return fail(error)

  revalidatePath('/superadmin/catalog')
  return { ok: true }
}

/**
 * แก้ไขรุ่นยาง
 * @param id รหัสรุ่นยาง
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateModel(id: string, input: ModelInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = modelSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('tire_models').update(parsed.data).eq('id', id)
  if (error) return fail(error)

  revalidatePath('/superadmin/catalog')
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานรุ่นยาง
 * @param id รหัสรุ่นยาง
 * @param isActive สถานะที่ต้องการ
 */
export async function setModelActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from('tire_models').update({ is_active: isActive }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/superadmin/catalog')
  return { ok: true }
}

/* ============================ สิทธิ์การมองเห็นยางของแต่ละบริษัท */

/**
 * กำหนดว่าลูกค้าเห็นยางรุ่นใดได้บ้าง (แทนที่รายการเดิมทั้งหมด)
 * @param companyId รหัสบริษัท
 * @param modelIds รายการรุ่นยางที่อนุญาต
 */
export async function setCompanyTireModels(
  companyId: string,
  modelIds: string[],
): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('company_tire_models')
    .delete()
    .eq('company_id', companyId)
  if (deleteError) return fail(deleteError)

  if (modelIds.length > 0) {
    const { error } = await supabase
      .from('company_tire_models')
      .insert(modelIds.map((id) => ({ company_id: companyId, tire_model_id: id })))
    if (error) return fail(error)
  }

  revalidatePath(`/superadmin/companies/${companyId}`)
  return { ok: true }
}

/* ======================================= สิทธิ์การมองเห็นประเภทเพลา */

const axleAccessSchema = z.object({
  companyId: z.string().uuid('รหัสบริษัทไม่ถูกต้อง'),
  axleTypeIds: z.array(z.string().uuid('รหัสประเภทเพลาไม่ถูกต้อง')),
})

/**
 * กำหนดว่าลูกค้าเห็นประเภทเพลาใดได้บ้าง (แทนที่รายการเดิมทั้งหมด)
 * ประเภทเพลาที่มีรถของบริษัทใช้อยู่จะถูกคงไว้เสมอ เพื่อไม่ให้ข้อมูลรถเดิมพัง
 * @param companyId รหัสบริษัท
 * @param axleTypeIds รายการประเภทเพลาที่อนุญาต
 */
export async function setCompanyAxleTypes(
  companyId: string,
  axleTypeIds: string[],
): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = axleAccessSchema.safeParse({ companyId, axleTypeIds })
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()

  // เพลาที่รถของบริษัทใช้อยู่ ต้องอยู่ในรายการเสมอ
  const { data: inUse, error: inUseError } = await supabase
    .from('vehicles')
    .select('axle_type')
    .eq('company_id', parsed.data.companyId)
  if (inUseError) return fail(inUseError)

  const requiredIds = new Set(parsed.data.axleTypeIds)
  const inUseCodes = [...new Set((inUse ?? []).map((vehicle) => vehicle.axle_type))]
  if (inUseCodes.length > 0) {
    const { data: inUseTypes, error: inUseTypeError } = await supabase
      .from('axle_types')
      .select('id')
      .in('code', inUseCodes)
    if (inUseTypeError) return fail(inUseTypeError)
    for (const axleType of inUseTypes ?? []) requiredIds.add(axleType.id)
  }

  const { error: deleteError } = await supabase
    .from('company_axle_types')
    .delete()
    .eq('company_id', parsed.data.companyId)
  if (deleteError) return fail(deleteError)

  if (requiredIds.size > 0) {
    const { error } = await supabase
      .from('company_axle_types')
      .insert(
        [...requiredIds].map((axleTypeId) => ({
          company_id: parsed.data.companyId,
          axle_type_id: axleTypeId,
        })),
      )
    if (error) return fail(error)
  }

  revalidatePath(`/superadmin/companies/${parsed.data.companyId}`)
  revalidatePath(`/superadmin/companies/${parsed.data.companyId}/axle-access`)
  return { ok: true }
}

/* ================================================ สาเหตุการถอดยาง */

const reasonSchema = z.object({
  code: z.string().trim().min(1, 'กรุณากรอกรหัส').max(30),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อสาเหตุ'),
  is_scrap: z.boolean().default(false),
  sort_order: z.number().int().default(0),
})

export type ReasonInput = z.input<typeof reasonSchema>

/**
 * เพิ่มสาเหตุการถอดยาง
 * @param input ข้อมูลสาเหตุ
 */
export async function createReason(input: ReasonInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = reasonSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase
    .from('removal_reasons')
    .insert({ ...parsed.data, code: parsed.data.code.toUpperCase() })
  if (error) return fail(error)

  revalidatePath('/superadmin/reasons')
  return { ok: true }
}

/**
 * แก้ไขสาเหตุการถอดยาง
 * @param id รหัสสาเหตุ
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateReason(id: string, input: ReasonInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = reasonSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase
    .from('removal_reasons')
    .update({ ...parsed.data, code: parsed.data.code.toUpperCase() })
    .eq('id', id)
  if (error) return fail(error)

  revalidatePath('/superadmin/reasons')
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานสาเหตุการถอดยาง
 * @param id รหัสสาเหตุ
 * @param isActive สถานะที่ต้องการ
 */
export async function setReasonActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from('removal_reasons').update({ is_active: isActive }).eq('id', id)
  if (error) return fail(error)
  revalidatePath('/superadmin/reasons')
  return { ok: true }
}

/* ===================================================== ประเภทเพลา */

const axleTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกรหัส')
    .max(30, 'รหัสต้องไม่เกิน 30 ตัวอักษร')
    .regex(/^[A-Za-z0-9_]+$/, 'ใช้ได้เฉพาะ A-Z, 0-9 และ _'),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อประเภทเพลา').max(120),
  axle_kinds: z
    .array(z.enum(['single', 'dual']))
    .min(1, 'ต้องมีอย่างน้อย 1 เพลา')
    .max(8, 'กำหนดได้ไม่เกิน 8 เพลา'),
  /** หมวดที่ช่างเลือกหน้างาน — หัว หาง หรือ บัส */
  category: z.enum(['head', 'trailer', 'bus'], { message: 'กรุณาเลือกประเภท หัว หาง หรือ บัส' }),
  /** รูปผังล้อที่ช่างใช้อ้างอิง (ว่างได้) */
  image_url: optionalText,
  sort_order: z.number().int().min(0, 'ลำดับต้องไม่ติดลบ').default(0),
})
const axleTypeIdSchema = z.string().uuid('รหัสประเภทเพลาไม่ถูกต้อง')

export type AxleTypeInput = z.input<typeof axleTypeSchema>

function revalidateAxleTypes() {
  revalidatePath('/superadmin/axle-types')
  revalidatePath('/vehicles', 'layout')
  revalidatePath('/service')
  revalidatePath('/superadmin/companies/[id]/vehicles', 'page')
}

function axleTypeFail(error: { code?: string; message?: string }): ActionResult<never> {
  if (error.code === '23505') {
    return { ok: false, error: 'รหัสประเภทเพลานี้มีอยู่ในระบบแล้ว' }
  }
  if (error.code === '23503') {
    return { ok: false, error: 'ประเภทเพลานี้มีรถใช้งานอยู่ จึงยังลบไม่ได้' }
  }
  return fail(error)
}

/** เพิ่มประเภทเพลา */
export async function createAxleType(input: AxleTypeInput): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = axleTypeSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('axle_types').insert({
    ...parsed.data,
    code: parsed.data.code.toUpperCase(),
  })
  if (error) return axleTypeFail(error)

  revalidateAxleTypes()
  return { ok: true }
}

/** แก้ไขประเภทเพลา โดยไม่ยอมให้เปลี่ยนผังของประเภทที่มีรถใช้งานแล้ว */
export async function updateAxleType(
  id: string,
  input: AxleTypeInput,
): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsedId = axleTypeIdSchema.safeParse(id)
  if (!parsedId.success) return zodFail(parsedId.error)
  const parsed = axleTypeSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('axle_types')
    .select('code, axle_kinds')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (currentError) return fail(currentError)
  if (!current) return { ok: false, error: 'ไม่พบประเภทเพลาที่ต้องการแก้ไข' }

  const layoutChanged =
    current.axle_kinds.length !== parsed.data.axle_kinds.length ||
    current.axle_kinds.some((kind, index) => kind !== parsed.data.axle_kinds[index])

  if (layoutChanged) {
    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('axle_type', current.code)
    if (countError) return fail(countError)
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `มีรถใช้ประเภทเพลานี้อยู่ ${count} คัน จึงเปลี่ยนรูปแบบเพลาไม่ได้ (แก้ชื่อ รหัส และลำดับได้)`,
      }
    }
  }

  const { error } = await supabase
    .from('axle_types')
    .update({ ...parsed.data, code: parsed.data.code.toUpperCase() })
    .eq('id', parsedId.data)
  if (error) return axleTypeFail(error)

  revalidateAxleTypes()
  return { ok: true }
}

/** เปิด/ปิดประเภทเพลา (รถเดิมและประวัติยังคงแสดงตามปกติ) */
export async function setAxleTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsed = z.object({ id: axleTypeIdSchema, isActive: z.boolean() }).safeParse({ id, isActive })
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('axle_types')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle()

  if (error) return fail(error)
  if (!data) return { ok: false, error: 'ไม่พบประเภทเพลาที่ต้องการเปลี่ยนสถานะ' }
  revalidateAxleTypes()
  return { ok: true }
}

/** ลบประเภทเพลาที่ไม่มีรถอ้างอิงอยู่ */
export async function deleteAxleType(id: string): Promise<ActionResult> {
  await requireSession(AUSTONE_WRITE_ROLES)
  const parsedId = axleTypeIdSchema.safeParse(id)
  if (!parsedId.success) return zodFail(parsedId.error)

  const supabase = await createClient()
  const { data: axleType, error: findError } = await supabase
    .from('axle_types')
    .select('code')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (findError) return fail(findError)
  if (!axleType) return { ok: false, error: 'ไม่พบประเภทเพลาที่ต้องการลบ' }

  const { count, error: countError } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('axle_type', axleType.code)
  if (countError) return fail(countError)
  if ((count ?? 0) > 0) {
    return { ok: false, error: `ประเภทเพลานี้มีรถใช้งานอยู่ ${count} คัน จึงลบไม่ได้` }
  }

  const { error } = await supabase.from('axle_types').delete().eq('id', parsedId.data)
  if (error) return axleTypeFail(error)

  revalidateAxleTypes()
  return { ok: true }
}

/* ============================================================ ร้านค้า (migration 021) */

const shopSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อร้านค้า').max(200),
  tax_id: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  contact_name: optionalText,
})

export type ShopInput = z.input<typeof shopSchema>

function revalidateShops(id?: string) {
  revalidatePath('/superadmin/shops')
  if (id) revalidatePath(`/superadmin/shops/${id}`)
}

/**
 * เพิ่มร้านค้าใหม่ (รหัส S0001.. สร้างอัตโนมัติ)
 * @param input ข้อมูลร้านค้า
 */
export async function createShop(input: ShopInput): Promise<ActionResult<{ id: string }>> {
  await requireSession(DEALER_MANAGER_ROLES)
  const parsed = shopSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.from('shops').insert(parsed.data).select('id').single()
  if (error) return fail(error)

  revalidateShops()
  return { ok: true, data: { id: data.id } }
}

/**
 * แก้ไขข้อมูลร้านค้า
 * @param id รหัสร้านค้า
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateShop(id: string, input: ShopInput): Promise<ActionResult> {
  await requireSession(DEALER_MANAGER_ROLES)
  const parsedId = z.string().uuid('รหัสร้านค้าไม่ถูกต้อง').safeParse(id)
  if (!parsedId.success) return zodFail(parsedId.error)
  const parsed = shopSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('shops').update(parsed.data).eq('id', parsedId.data)
  if (error) return fail(error)

  revalidateShops(parsedId.data)
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานร้านค้า — ปิดแล้วพนักงานร้านเข้าระบบไม่ได้ แต่ข้อมูลลูกค้ายังอยู่ครบ
 * @param id รหัสร้านค้า
 * @param isActive สถานะที่ต้องการ
 */
export async function setShopActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireSession(DEALER_MANAGER_ROLES)
  const parsedId = z.string().uuid('รหัสร้านค้าไม่ถูกต้อง').safeParse(id)
  if (!parsedId.success) return zodFail(parsedId.error)

  const supabase = await createClient()
  const { error } = await supabase.from('shops').update({ is_active: isActive }).eq('id', parsedId.data)
  if (error) return fail(error)

  revalidateShops(parsedId.data)
  return { ok: true }
}

/* ------------------------------------------------ รุ่นยางที่กำหนดให้ร้าน (migration 022) */

const shopTireModelsSchema = z.object({
  shopId: z.string().uuid('รหัสร้านค้าไม่ถูกต้อง'),
  modelIds: z.array(z.string().uuid('รหัสรุ่นยางไม่ถูกต้อง')),
})

/**
 * Austone กำหนดว่าร้านนี้ใส่ยางรุ่นใดให้ลูกค้าได้บ้าง (แทนที่รายการเดิมทั้งหมด)
 * - รับเฉพาะรุ่นกลางยี่ห้อ AUSTONE ที่ยังเปิดใช้งาน
 * - รุ่นที่เพิ่มจะถูกเปิดสิทธิ์ให้ลูกค้าทุกรายภายใต้ร้านด้วย (บริษัทจะได้เห็นรุ่นที่ร้านใส่ให้)
 *   ส่วนรุ่นที่ถอดออกจากร้านจะไม่ถอนจากบริษัท เพราะอาจมียางรุ่นนั้นติดรถอยู่แล้ว
 * @param shopId รหัสร้านค้า
 * @param modelIds รายการรุ่นยางที่อนุญาต
 */
export async function setShopTireModels(shopId: string, modelIds: string[]): Promise<ActionResult> {
  await requireSession(DEALER_MANAGER_ROLES)
  const parsed = shopTireModelsSchema.safeParse({ shopId, modelIds })
  if (!parsed.success) return zodFail(parsed.error)
  const supabase = await createClient()

  const unique = [...new Set(parsed.data.modelIds)]
  if (unique.length > 0) {
    const { data: models, error: modelError } = await supabase
      .from('tire_models')
      .select('id, is_active, created_by_company, tire_brands(name)')
      .in('id', unique)
    if (modelError) return fail(modelError)
    const rows = (models ?? []) as unknown as Array<{
      id: string; is_active: boolean; created_by_company: string | null; tire_brands: { name: string } | null
    }>
    const byId = new Map(rows.map((m) => [m.id, m]))
    for (const id of unique) {
      const m = byId.get(id)
      if (!m || !m.is_active || m.created_by_company !== null) {
        return { ok: false, error: 'มีรุ่นยางที่ไม่อยู่ในแคตตาล็อกกลางหรือถูกปิดใช้งานแล้ว' }
      }
      if (!isShopMountBrand(m.tire_brands?.name)) return { ok: false, error: SHOP_MOUNT_BRAND_MESSAGE }
    }
  }

  const { error: deleteError } = await supabase.from('shop_tire_models').delete().eq('shop_id', parsed.data.shopId)
  if (deleteError) return fail(deleteError)

  if (unique.length > 0) {
    const { error } = await supabase
      .from('shop_tire_models')
      .insert(unique.map((id) => ({ shop_id: parsed.data.shopId, tire_model_id: id })))
    if (error) return fail(error)
    // สิทธิ์ของลูกค้าทุกรายของร้านถูกเปิดให้โดย trigger `propagate_shop_tire_model` (migration 025)
  }

  revalidateShops(parsed.data.shopId)
  revalidatePath(`/superadmin/shops/${parsed.data.shopId}/tires`)
  return { ok: true }
}

const shopUserSchema = z.object({
  shop_id: z.string().uuid(),
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัวอักษร'),
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  phone: optionalText,
})

export type ShopUserInput = z.input<typeof shopUserSchema>

/**
 * สร้างบัญชีพนักงานร้านค้า (role = shop) — ใช้ service role สร้าง auth user แล้วผูก profile กับร้าน
 * @param input ข้อมูลผู้ใช้
 */
export async function createShopUser(input: ShopUserInput): Promise<ActionResult> {
  await requireSession(DEALER_MANAGER_ROLES)
  const parsed = shopUserSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงสร้างผู้ใช้ไม่ได้' }
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !created.user) return fail(authError ?? 'สร้างผู้ใช้ไม่สำเร็จ')

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    company_id: null,
    shop_id: parsed.data.shop_id,
    role: 'shop',
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return fail(profileError)
  }

  revalidateShops(parsed.data.shop_id)
  return { ok: true }
}
