/**
 * ยี่ห้อ "อื่นๆ" = ยางที่ไม่ระบุยี่ห้อในแคตตาล็อกกลาง (สร้างโดย migration 010 / seed)
 * แยกไฟล์ไว้ไม่พึ่ง alias เพื่อให้ทดสอบด้วย node --test ได้
 */

/** ชื่อยี่ห้อกลางสำหรับยางที่ไม่ระบุยี่ห้อ */
export const OTHER_BRAND = 'อื่นๆ'

/**
 * ยี่ห้อนี้คือ "อื่นๆ" หรือไม่
 * รับทุกการสะกดที่ใช้กันจริง: "อื่นๆ", "อื่น ๆ", "ยางอื่นๆ", "ยางอื่น ๆ", "OTHER" — ตัดช่องว่างและคำว่า "ยาง" นำหน้าก่อนเทียบ
 * @param brand ชื่อยี่ห้อ
 */
export function isOtherBrand(brand: string | null | undefined): boolean {
  const normalized = (brand ?? '').replace(/\s+/g, '').replace(/^ยาง/, '').toUpperCase()
  return normalized === OTHER_BRAND || normalized === 'OTHER' || normalized === 'OTHERS'
}
