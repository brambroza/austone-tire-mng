/**
 * กฎเฉพาะของฝั่งร้านค้า (shop/dealer) — ไม่พึ่ง framework เพื่อให้ทดสอบด้วย node --test ได้
 *
 * - Austone (super admin) กำหนดรุ่นยางให้ร้านแต่ละแห่ง (`shop_tire_models`) — ร้านใส่ได้เฉพาะรุ่นเหล่านั้น
 *   เลือกได้ทุกยี่ห้อในแคตตาล็อกกลาง (กฎ "AUSTONE เท่านั้น" ปลดแล้ว 2026-11-09 — `isShopMountBrand` คงไว้เผื่อเปิดกลับ)
 * - ยางที่ถอดออกอาจอ่านซีรีย์ไม่ได้ → ระบบตั้งซีรีย์แทนให้ (UNK-...) เพื่อให้ยังมีประวัติ
 */

/** ยี่ห้อเดียวที่ Austone กำหนดให้ร้านค้าใส่ได้ (ชื่อในแคตตาล็อกกลางเก็บเป็นตัวพิมพ์ใหญ่) */
export const SHOP_MOUNT_BRAND = 'AUSTONE'

/** ข้อความเมื่อพยายามกำหนด/ใส่ยางยี่ห้ออื่นในฝั่งร้านค้า */
export const SHOP_MOUNT_BRAND_MESSAGE = `ร้านค้าใส่ยางให้ลูกค้าได้เฉพาะยี่ห้อ ${SHOP_MOUNT_BRAND} เท่านั้น`

/** ข้อความเมื่อร้านค้าพยายามใส่รุ่นที่ Austone ไม่ได้กำหนดให้ร้าน */
export const SHOP_MOUNT_GRANT_MESSAGE = 'ร้านค้าใส่ยางได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน'

/** รุ่นยางเท่าที่ต้องรู้เพื่อตรวจสิทธิ์การใส่ */
export interface ShopGrantModel {
  id: string
  brand_name: string | null
  model_name: string | null
}

/** ยางเท่าที่ต้องรู้เพื่อตรวจว่าร้านใส่ได้ไหม (ยางเก่าในระบบอาจไม่มี tire_model_id) */
export interface ShopGrantTire {
  tire_model_id?: string | null
  brand_name?: string | null
  model_name?: string | null
}

/** สิทธิ์การใส่ยางของร้าน — เทียบได้ทั้งจากรหัสรุ่นและจากชื่อยี่ห้อ+รุ่น (snapshot บนยาง) */
export interface ShopMountGrant {
  modelIds: Set<string>
  nameKeys: Set<string>
}

/**
 * คีย์เทียบชื่อยี่ห้อ+รุ่น — ไม่สนตัวพิมพ์และช่องว่าง
 * @param brandName ชื่อยี่ห้อ
 * @param modelName ชื่อรุ่น
 */
export function tireNameKey(brandName: string | null | undefined, modelName: string | null | undefined): string {
  const norm = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '').toUpperCase()
  return `${norm(brandName)}|${norm(modelName)}`
}

/**
 * สร้างชุดสิทธิ์จากรุ่นที่ Austone กำหนดให้ร้าน
 * @param models รุ่นจาก shop_tire_models (join tire_models/tire_brands แล้ว)
 */
export function buildShopMountGrant(models: ShopGrantModel[]): ShopMountGrant {
  const grant: ShopMountGrant = { modelIds: new Set(), nameKeys: new Set() }
  for (const m of models) {
    grant.modelIds.add(m.id)
    if (m.brand_name && m.model_name) grant.nameKeys.add(tireNameKey(m.brand_name, m.model_name))
  }
  return grant
}

/**
 * ร้านใส่ยางเส้น/รุ่นนี้ให้ลูกค้าได้ไหม — ตรงรหัสรุ่น หรือชื่อยี่ห้อ+รุ่นตรงกับรุ่นที่ได้รับ
 * ยางที่ไม่มีทั้งรหัสรุ่นและชื่อครบ = ใส่ไม่ได้ (ร้านต้องเลือกรุ่นจากรายการเสมอ)
 * @param grant สิทธิ์ของร้าน
 * @param tire ยางหรือรุ่นที่จะใส่
 */
export function tireMatchesGrant(grant: ShopMountGrant, tire: ShopGrantTire): boolean {
  if (tire.tire_model_id && grant.modelIds.has(tire.tire_model_id)) return true
  if (tire.brand_name && tire.model_name) return grant.nameKeys.has(tireNameKey(tire.brand_name, tire.model_name))
  return false
}

/**
 * ยี่ห้อนี้ร้านค้าใส่ให้ลูกค้าได้หรือไม่ (ไม่สนตัวพิมพ์และช่องว่าง)
 * @param brandName ชื่อยี่ห้อจากแคตตาล็อกหรือ snapshot บนยาง
 */
export function isShopMountBrand(brandName: string | null | undefined): boolean {
  return (brandName ?? '').replace(/\s+/g, '').toUpperCase() === SHOP_MOUNT_BRAND
}

/** คำนำหน้าซีรีย์ที่ระบบตั้งให้เมื่อไม่ทราบซีรีย์จริง */
export const UNKNOWN_SERIAL_PREFIX = 'UNK-'

/** ตัวอักษรที่ใช้สุ่มท้ายซีรีย์ (ตัดตัวที่สับสนง่าย 0/O, 1/I ออก) */
const UNKNOWN_SERIAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const UNKNOWN_SERIAL_SUFFIX_LENGTH = 5

/**
 * สร้างซีรีย์แทนสำหรับยางที่อ่านซีรีย์ไม่ได้ เช่น UNK-260131-7KQ2M
 * รูปแบบผ่าน SERIAL_PATTERN (A-Z 0-9 ขีด) และไม่เกิน SERIAL_MAX (30)
 * @param date วันที่ทำรายการ (ใช้ 6 หลัก YYMMDD เพื่อให้เรียงตามเวลาได้)
 * @param random ฟังก์ชันสุ่ม 0 ≤ x < 1 (ส่งเองได้ตอนทดสอบ)
 */
export function generateUnknownSerial(date: Date = new Date(), random: () => number = Math.random): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  let suffix = ''
  for (let i = 0; i < UNKNOWN_SERIAL_SUFFIX_LENGTH; i++) {
    const index = Math.min(UNKNOWN_SERIAL_ALPHABET.length - 1, Math.floor(random() * UNKNOWN_SERIAL_ALPHABET.length))
    suffix += UNKNOWN_SERIAL_ALPHABET[index]
  }
  return `${UNKNOWN_SERIAL_PREFIX}${yy}${mm}${dd}-${suffix}`
}

/**
 * ซีรีย์นี้เป็นซีรีย์แทนที่ระบบตั้งให้หรือไม่ — ใช้แสดงป้าย "ไม่ทราบซีรีย์" ในรายงาน
 * @param serial ซีรีย์ที่บันทึกไว้
 */
export function isUnknownSerial(serial: string | null | undefined): boolean {
  return (serial ?? '').toUpperCase().startsWith(UNKNOWN_SERIAL_PREFIX)
}
