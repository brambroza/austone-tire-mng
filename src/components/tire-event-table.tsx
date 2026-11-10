/**
 * ตารางประวัติการถอด-ใส่ยาง (ledger `tire_events`)
 *
 * มี 2 มุมมองที่ใช้คนละชุดคอลัมน์
 *   - TireEventTable    : ยาง 1 เส้น เคยไปอยู่รถคันไหน ตำแหน่งใด
 *   - VehicleEventTable : รถ 1 คัน เคยถอด-ใส่ยางเส้นไหน ตำแหน่งใด
 *
 * ใช้ร่วมกันระหว่างหน้ารายละเอียดฝั่งลูกค้าและ modal ประวัติฝั่ง super admin
 */

import { vehicleLabel } from '@/lib/vehicle-display'
import { Badge, EmptyState, Table, TableWrap, Td, Th } from '@/components/ui'
import { positionLabel, type AxleTypeLayoutSource } from '@/lib/axle-layouts'
import { isUnknownSerial } from '@/lib/shop-rules'
import { pairTireChanges, primaryEvent } from '@/lib/tire-change-rows'
import { cn, formatKm, formatThaiDate } from '@/lib/utils'
import type { TireEventRow, VehicleEventRow } from '@/lib/tire-events'

/** ป้ายชนิดรายการ mount/unmount — ใช้สีเดียวกันทุกตาราง */
function EventBadge({ type }: { type: string }) {
  return (
    <Badge tone={type === 'mount' ? 'brand' : 'amber'}>
      {type === 'mount' ? 'ใส่ยาง' : 'ถอดยาง'}
    </Badge>
  )
}

/**
 * สาเหตุที่ถอด + หมายเหตุที่ช่างบันทึก (ถ้ามี) — ใช้ในคอลัมน์เดียวกันทั้งสองมุมมอง
 * @param reason ชื่อสาเหตุจาก removal_reasons
 * @param note หมายเหตุจาก tire_events.note
 */
function ReasonNote({ reason, note }: { reason?: string | null; note?: string | null }) {
  return (
    <>
      <span>{reason ?? '-'}</span>
      {note && (
        <p className="max-w-64 whitespace-normal text-xs text-ink-500" title={note}>
          {note}
        </p>
      )}
    </>
  )
}

/**
 * ประวัติของยาง 1 เส้น — เรียงล่าสุดขึ้นก่อน
 * @param events รายการ event ที่ query มาแล้ว
 * @param axleTypes นิยามเพลาจากฐานข้อมูล ใช้แปลรหัสตำแหน่งเป็นชื่อไทย
 */
export function TireEventTable({
  events,
  axleTypes,
  emptyTitle = 'ยางเส้นนี้ยังไม่เคยถูกติดตั้ง',
}: {
  events: TireEventRow[]
  axleTypes?: readonly AxleTypeLayoutSource[]
  emptyTitle?: string
}) {
  if (events.length === 0) return <EmptyState title={emptyTitle} />

  return (
    <TableWrap>
      <Table className="min-w-[720px]">
        <thead>
          <tr>
            <Th>วันที่</Th>
            <Th>รายการ</Th>
            <Th>รถ / ตำแหน่ง</Th>
            <Th className="text-right">เลขไมล์</Th>
            <Th className="text-right">ระยะรอบนี้</Th>
            <Th>ดอกยาง</Th>
            <Th>สาเหตุ / หมายเหตุ</Th>
            <Th>ผู้บันทึก</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="transition-colors hover:bg-brand-50/40">
              <Td className="whitespace-nowrap">{formatThaiDate(e.event_date)}</Td>
              <Td><EventBadge type={e.event_type} /></Td>
              <Td>
                {vehicleLabel(e.vehicles)}
                <p className="text-xs text-ink-400">
                  {positionLabel(e.position_code, e.vehicles?.axle_type, axleTypes)}
                </p>
              </Td>
              <Td className="text-right">{formatKm(e.odometer)}</Td>
              <Td className="text-right">{e.distance_km !== null ? formatKm(e.distance_km) : '-'}</Td>
              <Td>{e.tread_mm !== null ? `${e.tread_mm} มม.` : '-'}</Td>
              <Td><ReasonNote reason={e.removal_reasons?.name} note={e.note} /></Td>
              <Td className="text-ink-500">{e.profiles?.full_name ?? '-'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  )
}

/** ข้อมูลยาง 1 ฝั่ง (ถอดออก / ใส่เข้า) ในแถวประวัติแบบจับคู่ */
export interface ChangeSideInfo {
  serialNo: string | null | undefined
  brandModel?: string | null
  size?: string | null
  treadMm?: number | null
  /** ระยะที่วิ่งในรอบนี้ — มีเฉพาะฝั่งถอด */
  distanceKm?: number | null
  /** สาเหตุที่ถอด — มีเฉพาะฝั่งถอด */
  reason?: string | null
  note?: string | null
}

/**
 * เซลล์ฝั่ง "ถอดออก" หรือ "ใส่เข้า" ของแถวประวัติแบบจับคู่
 * @param side ข้อมูลยางฝั่งนั้น (null = งานนี้ไม่มีฝั่งนี้ เช่น ถอดเข้าคลังอย่างเดียว)
 * @param emptyText ข้อความเมื่อไม่มีฝั่งนี้
 */
export function ChangeSideCell({ side, emptyText = '-' }: { side: ChangeSideInfo | null; emptyText?: string }) {
  if (!side) return <span className="text-ink-400">{emptyText}</span>
  const unknown = isUnknownSerial(side.serialNo)
  const facts = [
    side.distanceKm !== null && side.distanceKm !== undefined ? `วิ่ง ${formatKm(side.distanceKm)}` : null,
    side.treadMm !== null && side.treadMm !== undefined ? `ดอก ${side.treadMm} มม.` : null,
    side.reason ? `สาเหตุ: ${side.reason}` : null,
  ].filter(Boolean)
  return (
    <div className="min-w-40">
      <span className={cn('font-mono uppercase', unknown ? 'text-ink-500' : 'font-medium text-ink-900')}>
        {unknown ? 'ไม่ทราบซีรีย์' : side.serialNo ?? '-'}
      </span>
      {(side.brandModel || side.size) && (
        <p className="text-xs text-ink-600">{[side.brandModel, side.size].filter(Boolean).join(' · ')}</p>
      )}
      {facts.length > 0 && <p className="text-xs text-ink-500">{facts.join(' · ')}</p>}
      {side.note && <p className="max-w-64 whitespace-normal text-xs text-ink-500" title={side.note}>{side.note}</p>}
    </div>
  )
}

/** หัวคอลัมน์คู่ "ถอดออก / ใส่เข้า" — ใช้ร่วมกันทุกตารางประวัติแบบจับคู่ */
export function ChangeSideHeaders() {
  return (
    <>
      <Th><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />ถอดออก</span></Th>
      <Th><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-500" />ใส่เข้า</span></Th>
    </>
  )
}

/**
 * ประวัติการถอด-ใส่ยางของรถ 1 คัน — เรียงล่าสุดขึ้นก่อน
 * งานเปลี่ยนยาง (ถอด+ใส่ ตำแหน่งเดียวกัน วันเดียวกัน) รวมเป็น 1 แถว
 * @param events รายการ event ที่ query มาแล้ว
 * @param axleType ประเภทเพลาของรถคันนี้ ใช้แปลรหัสตำแหน่งเป็นชื่อไทย
 * @param axleTypes นิยามเพลาจากฐานข้อมูล
 */
export function VehicleEventTable({
  events,
  axleType,
  axleTypes,
  emptyTitle = 'ยังไม่มีประวัติ',
}: {
  events: VehicleEventRow[]
  axleType?: string | null
  axleTypes?: readonly AxleTypeLayoutSource[]
  emptyTitle?: string
}) {
  if (events.length === 0) return <EmptyState title={emptyTitle} />
  const rows = pairTireChanges(events, () => '')

  /** แปลง event เป็นข้อมูลฝั่งสำหรับ ChangeSideCell */
  const side = (e: VehicleEventRow | null): ChangeSideInfo | null =>
    e && {
      serialNo: e.tires?.serial_no,
      brandModel: [e.tires?.brand_name, e.tires?.model_name].filter(Boolean).join(' ') || null,
      treadMm: e.tread_mm,
      distanceKm: e.event_type === 'unmount' ? e.distance_km : null,
      reason: e.removal_reasons?.name,
      note: e.note,
    }

  return (
    <TableWrap>
      <Table className="min-w-[760px]">
        <thead>
          <tr>
            <Th>วันที่</Th>
            <Th>ตำแหน่ง</Th>
            <ChangeSideHeaders />
            <Th className="text-right">เลขไมล์</Th>
            <Th>ผู้บันทึก</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const main = primaryEvent(row)
            return (
              <tr key={row.key} className="transition-colors hover:bg-brand-50/40">
                <Td className="whitespace-nowrap">{formatThaiDate(row.event_date)}</Td>
                <Td>{positionLabel(row.position_code, axleType, axleTypes)}</Td>
                <Td><ChangeSideCell side={side(row.unmount)} emptyText="ใส่ลงตำแหน่งว่าง" /></Td>
                <Td><ChangeSideCell side={side(row.mount)} emptyText="ถอดเก็บ ไม่ใส่แทน" /></Td>
                <Td className="text-right">{formatKm(main.odometer)}</Td>
                <Td className="text-ink-500">{main.profiles?.full_name ?? '-'}</Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableWrap>
  )
}
