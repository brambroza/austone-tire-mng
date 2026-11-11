/** ข้อมูลรายงานการเปลี่ยนยางของร้านค้า — รูปแบบที่ปลอดภัยสำหรับส่งจาก Server ไป Client Component */

export type ShopReportEventType = 'all' | 'unmount' | 'mount'

export interface ShopReportRow {
  id: string
  companyId: string
  companyName: string
  eventType: 'mount' | 'unmount'
  eventDate: string
  /** id รถ (null = รถถูกลบ) — ใช้จับคู่ถอด/ใส่เป็นแถวเดียว */
  vehicleId: string | null
  /** รหัสตำแหน่งล้อดิบ — ใช้จับคู่ถอด/ใส่ */
  positionCode: string | null
  /** ป้ายรถ (ชื่อเรียก · ทะเบียน) */
  vehicleLabel: string
  province: string | null
  /** ชื่อตำแหน่งล้อที่แปลแล้ว เช่น "เพลา 2 ซ้ายนอก" */
  positionLabel: string
  serialNo: string
  /** true = ระบบตั้งซีรีย์แทนให้ (ถอดยางที่อ่านซีรีย์ไม่ได้) */
  unknownSerial: boolean
  brandName: string | null
  modelName: string | null
  size: string | null
  odometer: number
  treadMm: number | null
  distanceKm: number | null
  reasonName: string | null
  note: string | null
  recordedBy: string | null
}

export interface ShopReportCompanyOption {
  id: string
  name: string
  /** ใช้ค้นหาในช่องเลือกลูกค้า */
  code?: string | null
  contact_name?: string | null
  phone?: string | null
}

/** ช่วงวันที่ที่กรอง (YYYY-MM-DD, ว่าง = ไม่จำกัดด้านนั้น) */
export interface ShopReportFilters {
  companyId: string
  from: string
  to: string
}

export interface ShopReportSummary {
  totalEvents: number
  unmountCount: number
  mountCount: number
  vehicleCount: number
  companyCount: number
}

/**
 * สรุปตัวเลขจากรายการที่ผ่านตัวกรองแล้ว ให้หน้าเว็บและไฟล์ส่งออกใช้ยอดชุดเดียวกัน
 * @param rows รายการที่ผ่านตัวกรอง
 */
export function summarizeShopRows(rows: ShopReportRow[]): ShopReportSummary {
  const vehicles = new Set<string>()
  const companies = new Set<string>()
  let unmountCount = 0
  let mountCount = 0
  for (const row of rows) {
    // นับตาม id รถ — รถคนละคันอาจมีป้ายซ้ำกัน (เช่น ไม่มีทะเบียน / รถถูกลบ)
    vehicles.add(row.vehicleId ?? `${row.companyId}:${row.vehicleLabel}`)
    companies.add(row.companyId)
    if (row.eventType === 'unmount') unmountCount++
    else mountCount++
  }
  return {
    totalEvents: rows.length,
    unmountCount,
    mountCount,
    vehicleCount: vehicles.size,
    companyCount: companies.size,
  }
}
