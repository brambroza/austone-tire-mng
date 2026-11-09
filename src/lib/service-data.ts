/**
 * โหลดข้อมูลให้หน้าบันทึกถอด-ใส่ยาง (ServiceWizard) — ใช้ร่วมกันระหว่าง
 *   - หน้าช่าง/แอดมินของบริษัท (`/service`) : RLS คัดให้เหลือบริษัทตัวเอง แคตตาล็อก = รุ่นที่ได้รับสิทธิ์
 *   - หน้าร้านค้า (`/shop/service`)         : ต้องระบุลูกค้า แคตตาล็อก = รุ่นกลางทั้งหมด
 *     (ร้านค้าถอดยางยี่ห้อใดก็ได้ ส่วนการใส่จำกัดที่รุ่นซึ่ง Austone กำหนดให้ร้าน — loadShopMountGrant)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { signVehiclePhotoUrls } from '@/lib/vehicle-photos'
import { buildShopMountGrant, type ShopGrantModel, type ShopMountGrant } from '@/lib/shop-rules'
import type { AxleType, Database, Vehicle } from '@/lib/database.types'
import type {
  ReasonOption, TireLite, TireModelLite, VehicleLite,
} from '@/app/(app)/service/service-wizard'

type Supabase = SupabaseClient<Database>

/** แถวรุ่นยางจากแคตตาล็อก (join ยี่ห้อมาด้วย) */
interface ModelRow {
  id: string
  name: string
  size: string | null
  new_tread_mm: number | null
  created_by_company: string | null
  tire_brands: { name: string; is_active: boolean } | null
}

/** แถว shop_tire_models ที่ join รุ่น+ยี่ห้อมาแล้ว */
interface ShopGrantRow {
  tire_model_id: string
  tire_models: { name: string; is_active: boolean; tire_brands: { name: string } | null } | null
}

/**
 * รุ่นยางที่ Austone กำหนดให้ร้านใส่ได้ (เฉพาะรุ่นที่ยังเปิดใช้งาน)
 * @param supabase client ของพนักงานร้าน (RLS ให้เห็นเฉพาะแถวของร้านตัวเอง) หรือ super admin
 * @param shopId ร้านค้า
 */
export async function loadShopGrantModels(supabase: Supabase, shopId: string): Promise<ShopGrantModel[]> {
  const { data } = await supabase
    .from('shop_tire_models')
    .select('tire_model_id, tire_models(name, is_active, tire_brands(name))')
    .eq('shop_id', shopId)
  return ((data ?? []) as unknown as ShopGrantRow[])
    .filter((r) => r.tire_models?.is_active !== false)
    .map((r) => ({
      id: r.tire_model_id,
      brand_name: r.tire_models?.tire_brands?.name ?? null,
      model_name: r.tire_models?.name ?? null,
    }))
}

/**
 * ชุดสิทธิ์การใส่ยางของร้าน (ใช้ตรวจฝั่ง server ตอนบันทึกงาน)
 * @param supabase client ของพนักงานร้าน
 * @param shopId ร้านค้า
 */
export async function loadShopMountGrant(supabase: Supabase, shopId: string): Promise<ShopMountGrant> {
  return buildShopMountGrant(await loadShopGrantModels(supabase, shopId))
}

export interface ServiceWizardData {
  vehicles: VehicleLite[]
  tires: TireLite[]
  reasons: ReasonOption[]
  axleTypes: AxleType[]
  models: TireModelLite[]
}

/**
 * ดึงรถ ยาง สาเหตุ ประเภทเพลา และแคตตาล็อกของบริษัทที่ระบุ
 * @param supabase client ของผู้ใช้ปัจจุบัน (RLS ยังคุมสิทธิ์อยู่)
 * @param companyId บริษัทเจ้าของรถ/ยาง
 * @param catalog 'granted' = รุ่นกลางที่ super admin เปิดสิทธิ์ให้บริษัท · 'central' = รุ่นกลางทั้งหมด (ร้านค้า)
 */
export async function loadServiceWizardData(
  supabase: Supabase,
  companyId: string,
  catalog: 'granted' | 'central',
): Promise<ServiceWizardData> {
  const [
    { data: vehicleData },
    { data: tireData },
    { data: reasonData },
    { data: axleTypeData },
    { data: modelData },
    { data: grantData },
  ] = await Promise.all([
    supabase
      .from('vehicles')
      // ใช้ * เพื่อให้หน้าไม่พังก่อนรัน migration 019 (ยังไม่มีคอลัมน์ image_path)
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('plate_no', { nullsFirst: false })
      .order('nickname'),
    supabase
      .from('tire_overview')
      .select('id, serial_no, brand_name, model_name, size, status, tread_mm, new_tread_mm, ' +
        'lifetime_km, current_run_km, has_been_mounted, vehicle_id, position_code, plate_no, nickname, image_url')
      .eq('company_id', companyId)
      .neq('status', 'scrapped')
      .order('serial_no')
      .limit(3000),
    supabase
      .from('removal_reasons')
      .select('id, name, is_scrap')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('axle_types').select('*').order('sort_order').order('name'),
    // แคตตาล็อก — RLS ให้เห็นรุ่นที่ได้รับสิทธิ์ + รุ่นที่บริษัทสร้างเอง จึงต้องกรองซ้ำด้วยสิทธิ์ด้านล่าง
    supabase
      .from('tire_models')
      .select('id, name, size, new_tread_mm, created_by_company, tire_brands(name, is_active)')
      .eq('is_active', true)
      .order('name'),
    catalog === 'granted'
      ? supabase.from('company_tire_models').select('tire_model_id').eq('company_id', companyId)
      : Promise.resolve({ data: [] as { tire_model_id: string }[] }),
  ])

  // ตัวเลือกรุ่นยาง = เฉพาะรุ่นกลาง (ไม่รวมรุ่นที่บริษัทสร้างเอง และรุ่นที่ยี่ห้อถูกปิดใช้งาน)
  // โหมดบริษัท: เพิ่มเงื่อนไขต้องได้รับสิทธิ์จาก super admin (กฎเดียวกับหน้า "ข้อมูลยาง")
  const granted = new Set((grantData ?? []).map((g) => g.tire_model_id))
  const visibleModels = ((modelData ?? []) as unknown as ModelRow[]).filter(
    (m) =>
      m.created_by_company === null &&
      m.tire_brands?.is_active !== false &&
      (catalog === 'central' || granted.has(m.id)),
  )

  const models: TireModelLite[] = visibleModels.map((m) => ({
    id: m.id,
    brand_name: m.tire_brands?.name ?? '',
    model_name: m.name,
    size: m.size,
    new_tread_mm: m.new_tread_mm,
  }))

  const vehicleList = (vehicleData ?? []) as Vehicle[]
  // ลิงก์รูปอายุสั้น — เซ็นเฉพาะรถที่ดึงผ่าน RLS ได้แล้ว
  const photoUrls = await signVehiclePhotoUrls(vehicleList.map((v) => v.image_path))
  const vehicles: VehicleLite[] = vehicleList.map((v) => ({
    id: v.id,
    plate_no: v.plate_no,
    nickname: v.nickname,
    province: v.province,
    brand: v.brand,
    model: v.model,
    axle_type: v.axle_type,
    current_mileage: v.current_mileage,
    photo_url: v.image_path ? photoUrls.get(v.image_path) ?? null : null,
  }))

  return {
    vehicles,
    tires: (tireData ?? []) as unknown as TireLite[],
    reasons: reasonData ?? [],
    axleTypes: (axleTypeData ?? []) as AxleType[],
    models,
  }
}
