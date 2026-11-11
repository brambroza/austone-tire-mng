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

/* ============================================================
 * event "บันทึกย้อนหลัง"
 *
 * เมื่อช่างถอดยางที่ระบบไม่รู้ว่าอยู่บนรถ (ยางเก่าของลูกค้า / ไม่ทราบซีรีย์)
 * ระบบจะแทรก event ใส่ยางย้อนหลังให้ก่อน 1 รายการ (วันเดียวกัน ตำแหน่งเดียวกัน)
 * เพื่อให้ประวัติของยางเส้นนั้นต่อเนื่อง — ไม่ใช่งานที่ช่างทำจริงในวันนั้น
 * รายงาน/สรุปงานจึงต้องตัดออกก่อน ไม่งั้นยอด "ใส่ยาง" เกินจริง และจับคู่แถวผิด
 * ============================================================ */

/** คำขึ้นต้นหมายเหตุของ event ที่ระบบบันทึกย้อนหลังให้ (ใช้ร่วมกันระหว่างตอนบันทึกและตอนอ่าน) */
export const BACKFILL_NOTE_PREFIX = 'บันทึกย้อนหลัง'

/**
 * event นี้เป็นรายการที่ระบบบันทึกย้อนหลังให้หรือไม่
 * @param note หมายเหตุของ event
 */
export function isBackfillEvent(note: string | null | undefined): boolean {
  return (note ?? '').startsWith(BACKFILL_NOTE_PREFIX)
}

/** ข้อมูลขั้นต่ำของ event ที่ใช้ตัดรายการย้อนหลัง */
export interface BackfillAwareEvent {
  event_type: string
  event_date: string
  note: string | null
  /** id ยาง — ใช้จับว่า unmount ไหนคู่กับ mount ย้อนหลัง */
  tire_id: string
  odometer: number
  distance_km: number | null
}

/**
 * ตัด event ใส่ยางย้อนหลังออก และถ้าเลขไมล์ตอนใส่ย้อนหลังเท่ากับตอนถอด
 * (ช่างไม่ได้คีย์เลขไมล์ตอนใส่) ระยะรอบนี้ของรายการถอดจะเป็น 0 ทั้งที่จริงคือ "ไม่ทราบ"
 * → ตั้งเป็น null ให้แสดง "-" แทน ไม่สร้าง object ใหม่ถ้าไม่ต้องเปลี่ยนอะไร
 * @param events รายการ event (ลำดับใดก็ได้)
 */
export function hideBackfillEvents<T extends BackfillAwareEvent>(events: readonly T[]): T[] {
  /** ยาง|วันที่ ของ mount ย้อนหลังที่ไม่รู้เลขไมล์จริง → เลขไมล์ที่ใช้แทน */
  const unknownDistance = new Map<string, number>()
  for (const e of events) {
    if (e.event_type === 'mount' && isBackfillEvent(e.note)) {
      unknownDistance.set(`${e.tire_id}|${e.event_date}`, e.odometer)
    }
  }
  if (unknownDistance.size === 0) return [...events]

  const result: T[] = []
  for (const e of events) {
    if (e.event_type === 'mount' && isBackfillEvent(e.note)) continue
    const mountedOdometer = e.event_type === 'unmount' ? unknownDistance.get(`${e.tire_id}|${e.event_date}`) : undefined
    if (mountedOdometer !== undefined && mountedOdometer === e.odometer && e.distance_km !== null) {
      result.push({ ...e, distance_km: null })
      continue
    }
    result.push(e)
  }
  return result
}
