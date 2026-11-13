/**
 * กฎเลือก/สร้างรถจากหน้าช่าง (ใช้ร่วมกันทั้งตอนตรวจสอบและตอนบันทึกจริง)
 *
 * แยกเป็นฟังก์ชันล้วน ไม่แตะฐานข้อมูล เพื่อให้ตรวจล่วงหน้าได้โดยไม่บันทึกอะไร
 * และทดสอบด้วย node --test ได้
 */

/** ข้อความเมื่อเลือกรถเดิมด้วย vehicle_id แต่ไม่พบ */
export const SERVICE_VEHICLE_NOT_FOUND_MESSAGE = 'ไม่พบรถที่เลือก หรือคุณไม่มีสิทธิ์'
/** ข้อความเมื่อรถถูกปิดใช้งาน */
export const SERVICE_VEHICLE_INACTIVE_MESSAGE = 'รถคันนี้ถูกปิดใช้งานแล้ว'

/** ผลการตัดสินว่าต้องทำอะไรกับรถเมื่อช่างกดยืนยันบันทึก */
export type ServiceVehiclePlan =
  /** ยังไม่มีในระบบ — สร้างรถใหม่ตอนยืนยันบันทึก */
  | { kind: 'create' }
  /** รถเดิม แบบรถตรงกันแล้ว — ไม่ต้องแก้อะไร */
  | { kind: 'use' }
  /** รถเดิม แต่ช่างเลือกแบบรถใหม่ — แก้แบบรถตอนยืนยันบันทึก (เก็บค่าเดิมไว้คืนถ้าบันทึกไม่สำเร็จ) */
  | { kind: 'change_type'; previousAxleType: string }
  | { kind: 'error'; error: string }

/**
 * ตัดสินว่ารถที่ช่างเลือก/คีย์ต้องสร้างใหม่ ใช้ตามเดิม หรือเปลี่ยนแบบรถ
 * @param input.requestedVehicleId รหัสรถที่ช่างเลือกจากรายการ (ไม่มี = คีย์ทะเบียน/ชื่อเรียกเอง)
 * @param input.existing รถที่หาเจอในบริษัท (null = ไม่พบ)
 * @param input.axleType แบบรถที่ช่างเลือก
 * @param input.mountedCount จำนวนยางที่ติดอยู่บนรถ (ใช้เฉพาะเมื่อจะเปลี่ยนแบบรถ)
 */
export function planServiceVehicle(input: {
  requestedVehicleId?: string | null
  existing: { axle_type: string; is_active: boolean } | null
  axleType: string
  mountedCount: number
}): ServiceVehiclePlan {
  const { requestedVehicleId, existing, axleType, mountedCount } = input
  if (!existing) {
    return requestedVehicleId
      ? { kind: 'error', error: SERVICE_VEHICLE_NOT_FOUND_MESSAGE }
      : { kind: 'create' }
  }
  if (!existing.is_active) return { kind: 'error', error: SERVICE_VEHICLE_INACTIVE_MESSAGE }
  if (existing.axle_type === axleType) return { kind: 'use' }

  // เปลี่ยนประเภทรถได้เฉพาะตอนที่ยังไม่มียางติดตั้งอยู่ ไม่งั้นตำแหน่งล้อเดิมจะเพี้ยน
  if (mountedCount > 0) {
    return {
      kind: 'error',
      error:
        `รถคันนี้บันทึกไว้เป็นประเภทอื่น และมียางติดตั้งอยู่ ${mountedCount} เส้น ` +
        'จึงเปลี่ยนประเภทรถจากหน้าช่างไม่ได้ — แจ้งแอดมินให้แก้ข้อมูลรถ',
    }
  }
  return { kind: 'change_type', previousAxleType: existing.axle_type }
}
