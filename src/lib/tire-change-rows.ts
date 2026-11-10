/**
 * จับคู่ event ถอด (unmount) กับ ใส่ (mount) ที่เกิดจากงานเปลี่ยนยางเดียวกัน
 * — รถคันเดียวกัน ตำแหน่งล้อเดียวกัน วันเดียวกัน — ให้แสดงเป็น 1 แถว "ถอด X → ใส่ Y"
 * event ที่ไม่มีคู่ (ถอดเข้าคลังอย่างเดียว / ใส่ยางลงตำแหน่งว่าง) แสดงเป็นแถวที่มีฝั่งเดียว
 */

/** ข้อมูลขั้นต่ำของ event ที่ใช้จับคู่ */
export interface ChangeEventLike {
  id: string
  event_type: string
  event_date: string
  position_code: string | null
}

/** 1 แถวในตารางประวัติแบบจับคู่แล้ว */
export interface TireChangeRow<T extends ChangeEventLike> {
  /** key สำหรับ React — id ของ event แรกที่เจอในคู่ */
  key: string
  event_date: string
  position_code: string | null
  /** event ถอดยางออก (null = ใส่ลงตำแหน่งว่าง) */
  unmount: T | null
  /** event ใส่ยางเข้า (null = ถอดเข้าคลังโดยไม่ใส่แทน) */
  mount: T | null
}

/**
 * จับคู่รายการถอด-ใส่ให้เป็นแถวเดียว — คงลำดับเดิมของ event แรกในแต่ละคู่
 * @param events รายการ event เรียงตามที่ต้องการแสดง (ปกติล่าสุดขึ้นก่อน)
 * @param vehicleKey ฟังก์ชันคืน id รถของ event (ตารางรถคันเดียวส่งค่าคงที่ได้)
 */
export function pairTireChanges<T extends ChangeEventLike>(
  events: readonly T[],
  vehicleKey: (event: T) => string | null | undefined,
): TireChangeRow<T>[] {
  const rows: TireChangeRow<T>[] = []
  /** แถวที่ยังขาดอีกฝั่ง แยกตาม รถ|ตำแหน่ง|วันที่ */
  const open = new Map<string, TireChangeRow<T>[]>()

  for (const event of events) {
    const isMount = event.event_type === 'mount'
    const isUnmount = event.event_type === 'unmount'
    // ไม่รู้ตำแหน่ง หรือชนิดอื่น — จับคู่ไม่ได้ แสดงเดี่ยว
    if (!event.position_code || (!isMount && !isUnmount)) {
      rows.push({ key: event.id, event_date: event.event_date, position_code: event.position_code, unmount: isUnmount ? event : null, mount: isMount ? event : null })
      continue
    }
    const groupKey = `${vehicleKey(event) ?? ''}|${event.position_code}|${event.event_date}`
    const candidates = open.get(groupKey) ?? []
    const slot = isMount ? 'mount' : 'unmount'
    const index = candidates.findIndex((row) => row[slot] === null)
    if (index >= 0) {
      candidates[index][slot] = event
      candidates.splice(index, 1)
      continue
    }
    const row: TireChangeRow<T> = { key: event.id, event_date: event.event_date, position_code: event.position_code, unmount: null, mount: null }
    row[slot] = event
    rows.push(row)
    open.set(groupKey, [...candidates, row])
  }
  return rows
}

/**
 * event ใดฝั่งหนึ่งของแถว สำหรับข้อมูลที่ทั้งคู่มีเหมือนกัน (เลขไมล์ ผู้บันทึก)
 * — ใช้ฝั่งใส่ก่อนเพราะบันทึกทีหลังสุด
 */
export function primaryEvent<T extends ChangeEventLike>(row: TireChangeRow<T>): T {
  return (row.mount ?? row.unmount) as T
}
