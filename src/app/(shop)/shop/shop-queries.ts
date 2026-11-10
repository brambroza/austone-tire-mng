/**
 * Query และ type ที่หน้าฝั่งร้านค้าใช้ร่วมกัน (server only)
 */

import type { ChangeSideInfo } from '@/components/tire-event-table'
import { tireBrandModelLabel } from '@/lib/tire-display'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Company, Database } from '@/lib/database.types'

type Supabase = SupabaseClient<Database>

/** ลูกค้าภายใต้ร้าน + ตัวเลขสรุปสำหรับตาราง */
export interface ShopCompanyRow {
  id: string
  code: string
  name: string
  contact_name: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  vehicle_count: number
  /** จำนวนบัญชีผู้ใช้ (0 = ยังไม่ได้ลงทะเบียน) */
  user_count: number
  /** วันที่เปลี่ยนยางครั้งล่าสุด (null = ยังไม่เคย) */
  last_service_date: string | null
  /** เปิดลิงก์ส่วนตัวให้ลูกค้าดูประวัติแล้วหรือยัง */
  has_public_link: boolean
}

/** นับจำนวนแถวตาม company_id */
function countBy(rows: Array<{ company_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.company_id) continue
    map.set(r.company_id, (map.get(r.company_id) ?? 0) + 1)
  }
  return map
}

/**
 * รายชื่อลูกค้าของร้าน (RLS คัดให้เหลือ shop_id ของผู้ใช้) พร้อมจำนวนรถ บัญชี และวันเปลี่ยนยางล่าสุด
 * @param supabase client ของพนักงานร้านค้า
 * @param q คำค้น (ชื่อ รหัส ผู้ติดต่อ เบอร์โทร)
 */
export async function loadShopCompanies(supabase: Supabase, q?: string): Promise<ShopCompanyRow[]> {
  let query = supabase.from('companies').select('*').order('name')
  if (q?.trim()) {
    const term = `%${q.trim().replace(/[%_,()]/g, '')}%`
    query = query.or(`name.ilike.${term},code.ilike.${term},contact_name.ilike.${term},phone.ilike.${term}`)
  }

  const [{ data: companies }, { data: vehicles }, { data: profiles }, { data: events }] = await Promise.all([
    query,
    supabase.from('vehicles').select('company_id').eq('is_active', true),
    supabase.from('profiles').select('company_id').not('company_id', 'is', null),
    // เรียงล่าสุดก่อน แล้วเก็บวันแรกที่เจอของแต่ละลูกค้า
    supabase.from('tire_events').select('company_id, event_date').order('event_date', { ascending: false }).limit(3000),
  ])

  const vehicleCount = countBy(vehicles ?? [])
  const userCount = countBy(profiles ?? [])
  const lastService = new Map<string, string>()
  for (const e of events ?? []) {
    if (!lastService.has(e.company_id)) lastService.set(e.company_id, e.event_date)
  }

  return ((companies ?? []) as Company[]).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    contact_name: c.contact_name,
    phone: c.phone,
    is_active: c.is_active,
    created_at: c.created_at,
    vehicle_count: vehicleCount.get(c.id) ?? 0,
    user_count: userCount.get(c.id) ?? 0,
    last_service_date: lastService.get(c.id) ?? null,
    has_public_link: Boolean(c.public_token),
  }))
}

/** 1 แถวประวัติถอด-ใส่ในมุมมองร้านค้า (ข้ามหลายลูกค้า) */
export interface ShopEventRecord {
  id: string
  company_id: string
  event_type: string
  event_date: string
  position_code: string | null
  odometer: number
  tread_mm: number | null
  distance_km: number | null
  note: string | null
  tires: { serial_no: string; brand_name: string | null; model_name: string | null; size: string | null } | null
  vehicles: { id: string; nickname: string | null; plate_no: string | null; province: string | null; axle_type: string } | null
  removal_reasons: { name: string } | null
  profiles: { full_name: string } | null
}

/**
 * แปลง event ของร้านเป็นข้อมูลฝั่ง "ถอดออก/ใส่เข้า" สำหรับ ChangeSideCell
 * @param e event (null = งานนี้ไม่มีฝั่งนี้)
 */
export function shopEventSide(e: ShopEventRecord | null): ChangeSideInfo | null {
  if (!e) return null
  return {
    serialNo: e.tires?.serial_no,
    brandModel: tireBrandModelLabel(e.tires?.brand_name, e.tires?.model_name),
    size: e.tires?.size,
    treadMm: e.tread_mm,
    distanceKm: e.event_type === 'unmount' ? e.distance_km : null,
    reason: e.removal_reasons?.name,
    note: e.note,
  }
}

export const SHOP_EVENT_SELECT =
  'id, company_id, event_type, event_date, position_code, odometer, tread_mm, distance_km, note, ' +
  'tires(serial_no, brand_name, model_name, size), vehicles(id, nickname, plate_no, province, axle_type), ' +
  'removal_reasons(name), profiles(full_name)'
