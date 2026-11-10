/** ข้อมูลขั้นต่ำของลูกค้าที่ใช้ค้นหาในช่อง autocomplete */
export interface CustomerSearchItem {
  id: string
  name: string
  code?: string | null
  contact_name?: string | null
  phone?: string | null
  /** ข้อความเสริมใต้ชื่อในรายการ (ไม่ส่ง = รหัส · ผู้ติดต่อ) */
  detail?: string | null
}

/** ปรับข้อความให้เทียบกันได้: ตัดช่องว่าง/ขีดกลาง/จุด แปลงเป็นตัวพิมพ์เล็ก */
function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[\s\-.()]/g, '')
}

/**
 * ลูกค้าตรงกับคำค้นหรือไม่ — เทียบชื่อ รหัส ผู้ติดต่อ และเบอร์โทร
 * คำค้นหลายคำ (คั่นช่องว่าง) ต้องเจอครบทุกคำ เช่น "ขนส่ง C0001"
 * @param customer ลูกค้าที่จะตรวจ
 * @param query คำค้นจากผู้ใช้ (ว่าง = ไม่ตรง)
 */
export function matchesCustomer(customer: CustomerSearchItem, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return false
  const haystack = [customer.name, customer.code, customer.contact_name, customer.phone].map(normalize)
  return terms.every((term) => {
    const t = normalize(term)
    return t !== '' && haystack.some((field) => field.includes(t))
  })
}

/**
 * กรองและจัดอันดับลูกค้าตามคำค้น — ชื่อ/รหัสที่ขึ้นต้นด้วยคำค้นมาก่อน แล้วเรียงตามชื่อ
 * @param customers รายชื่อทั้งหมด
 * @param query คำค้น (ว่าง = คืนทั้งหมดตามลำดับเดิม)
 * @param limit จำนวนสูงสุดที่คืน
 */
export function searchCustomers<T extends CustomerSearchItem>(customers: readonly T[], query: string, limit = 20): T[] {
  const q = normalize(query)
  if (q === '') return customers.slice(0, limit)
  const rank = (c: T) => {
    if (normalize(c.name).startsWith(q) || normalize(c.code).startsWith(q)) return 0
    return 1
  }
  return customers
    .filter((c) => matchesCustomer(c, query))
    .map((c, index) => ({ c, index, rank: rank(c) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.c)
}
