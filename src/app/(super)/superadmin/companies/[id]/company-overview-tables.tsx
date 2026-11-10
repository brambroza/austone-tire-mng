'use client'

import { vehicleLabel } from '@/lib/vehicle-display'
import { Badge, Table, TableWrap, Td, Th } from '@/components/ui'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { TireSpec } from '@/components/tire-spec'
import { positionLabel } from '@/lib/axle-layouts'
import { ChangeSideCell, ChangeSideHeaders, type ChangeSideInfo } from '@/components/tire-event-table'
import { pairTireChanges, primaryEvent } from '@/lib/tire-change-rows'
import { TIRE_STATUS_LABEL, TIRE_STATUS_TONE, formatKm, formatThaiDate } from '@/lib/utils'
import type { TireOverview } from '@/lib/database.types'

export interface EventRow {
  id: string
  event_type: string
  event_date: string
  position_code: string | null
  odometer: number
  tread_mm: number | null
  distance_km: number | null
  note: string | null
  tires: { serial_no: string; brand_name: string | null; model_name: string | null } | null
  vehicles: { id: string; nickname: string | null; plate_no: string | null; axle_type: string } | null
  removal_reasons: { name: string } | null
  profiles: { full_name: string } | null
}

/** แปลง event เป็นข้อมูลฝั่งสำหรับ ChangeSideCell */
function eventSide(e: EventRow | null): ChangeSideInfo | null {
  if (!e) return null
  return {
    serialNo: e.tires?.serial_no,
    brandModel: [e.tires?.brand_name, e.tires?.model_name].filter(Boolean).join(' ') || null,
    treadMm: e.tread_mm,
    distanceKm: e.event_type === 'unmount' ? e.distance_km : null,
    reason: e.removal_reasons?.name,
    note: e.note,
  }
}

/** ตารางประวัติถอด-ใส่ยางของลูกค้า — งานเปลี่ยนยางรวมถอด+ใส่เป็นแถวเดียว พร้อมแบ่งหน้า (10 / 20 / ทั้งหมด) */
export function RecentEventsTable({ events }: { events: EventRow[] }) {
  const rows = pairTireChanges(events, (e) => e.vehicles?.id)
  const pagination = usePagination(rows)

  return (
    <TableWrap>
      <Table className="min-w-[820px]">
        <thead>
          <tr>
            <Th>วันที่</Th>
            <Th>รถ / ตำแหน่ง</Th>
            <ChangeSideHeaders />
            <Th className="text-right">เลขไมล์</Th>
            <Th>ผู้บันทึก</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((row) => {
            const main = primaryEvent(row)
            return (
              <tr key={row.key} className="transition-colors hover:bg-brand-50/40">
                <Td className="whitespace-nowrap">{formatThaiDate(row.event_date)}</Td>
                <Td>
                  {vehicleLabel(main.vehicles)}
                  <p className="text-xs text-ink-400">{positionLabel(row.position_code, main.vehicles?.axle_type)}</p>
                </Td>
                <Td><ChangeSideCell side={eventSide(row.unmount)} emptyText="ใส่ลงตำแหน่งว่าง" /></Td>
                <Td><ChangeSideCell side={eventSide(row.mount)} emptyText="ถอดเก็บ ไม่ใส่แทน" /></Td>
                <Td className="text-right">{formatKm(main.odometer)}</Td>
                <Td className="text-ink-500">{main.profiles?.full_name ?? '-'}</Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <Pagination state={pagination} itemLabel="งาน" />
    </TableWrap>
  )
}

/** ตารางยางเรียงตามระยะสะสม พร้อมแบ่งหน้า (10 / 20 / ทั้งหมด) */
export function TopTiresTable({ tires }: { tires: TireOverview[] }) {
  const pagination = usePagination(tires)

  return (
    <TableWrap>
      <Table className="min-w-[820px]">
        <thead>
          <tr>
            <Th>เลขยาง</Th>
            <Th>ขนาด / ยี่ห้อ รุ่น</Th>
            <Th>สถานะ</Th>
            <Th>อยู่ที่</Th>
            <Th>ดอกยาง</Th>
            <Th className="text-right">ระยะรอบนี้</Th>
            <Th className="text-right">ระยะสะสม</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((t) => (
            <tr key={t.id} className="transition-colors hover:bg-brand-50/40">
              <Td className="font-medium text-ink-900">{t.serial_no}</Td>
              <Td>
                <TireSpec size={t.size} brandName={t.brand_name} modelName={t.model_name} />
              </Td>
              <Td><Badge tone={TIRE_STATUS_TONE[t.status]}>{TIRE_STATUS_LABEL[t.status]}</Badge></Td>
              <Td>
                {t.status === 'mounted'
                  ? `${vehicleLabel(t)} · ${positionLabel(t.position_code)}`
                  : 'คลังสินค้า'}
              </Td>
              <Td>{t.tread_mm !== null ? `${t.tread_mm} มม.` : '-'}</Td>
              <Td className="text-right">
                {t.status === 'mounted' ? formatKm(t.current_run_km) : '-'}
              </Td>
              <Td className="text-right font-medium">{formatKm(t.lifetime_km)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination state={pagination} itemLabel="เส้น" />
    </TableWrap>
  )
}
