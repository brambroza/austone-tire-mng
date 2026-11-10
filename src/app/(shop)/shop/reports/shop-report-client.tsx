'use client'

import * as React from 'react'
import { AlertCircle, ArrowDownUp, Building2, CalendarRange, Truck } from 'lucide-react'
import { Button, Card, EmptyState, Select, StatTile, Table, TableWrap, Td, Th } from '@/components/ui'
import { ExcelLogo } from '@/components/export-buttons'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { ChangeSideCell, ChangeSideHeaders, type ChangeSideInfo } from '@/components/tire-event-table'
import { pairTireChanges, primaryEvent } from '@/lib/tire-change-rows'
import { tireBrandModelLabel } from '@/lib/tire-display'
import { formatKm, formatNumber, formatThaiDate } from '@/lib/utils'
import { dateRangeLabel } from '@/app/(app)/dashboard/removal-report-types'
import { exportShopReportExcel } from './shop-report-export'
import {
  summarizeShopRows, type ShopReportCompanyOption, type ShopReportEventType, type ShopReportFilters, type ShopReportRow,
} from './shop-report-types'

/** แปลงแถวรายงานเป็นข้อมูลฝั่งสำหรับ ChangeSideCell */
function reportSide(row: ShopReportRow | null): ChangeSideInfo | null {
  if (!row) return null
  return {
    serialNo: row.serialNo,
    brandModel: tireBrandModelLabel(row.brandName, row.modelName),
    size: row.size,
    treadMm: row.treadMm,
    distanceKm: row.eventType === 'unmount' ? row.distanceKm : null,
    reason: row.reasonName,
    note: row.note,
  }
}

const EVENT_TYPE_LABEL: Record<ShopReportEventType, string> = {
  all: 'ถอดและใส่',
  unmount: 'ถอดยาง',
  mount: 'ใส่ยาง',
}

/**
 * ตารางรายงานการเปลี่ยนยางของร้าน — กรองประเภทรายการฝั่ง client, ส่งออก Excel
 * (ลูกค้าและช่วงวันที่กรองมาจาก server ผ่าน query string แล้ว)
 */
export function ShopReportClient({
  shopName,
  rows,
  companies,
  filters,
}: {
  shopName: string
  rows: ShopReportRow[]
  companies: ShopReportCompanyOption[]
  filters: ShopReportFilters
}) {
  const [eventType, setEventType] = React.useState<ShopReportEventType>('all')
  const [exporting, setExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)

  const filteredRows = React.useMemo(
    () => rows.filter((row) => eventType === 'all' || row.eventType === eventType),
    [rows, eventType],
  )
  const summary = React.useMemo(() => summarizeShopRows(filteredRows), [filteredRows])
  // ตารางบนจอรวมถอด+ใส่ของงานเดียวกันเป็นแถวเดียว (ไฟล์ Excel ยังแยก 1 แถวต่อ 1 รายการ)
  const changeRows = React.useMemo(
    () => pairTireChanges(
      filteredRows.map((row) => ({ id: row.id, event_type: row.eventType, event_date: row.eventDate, position_code: row.positionCode, row })),
      (e) => e.row.vehicleId,
    ),
    [filteredRows],
  )
  const pagination = usePagination(changeRows, 20)

  const companyName = companies.find((c) => c.id === filters.companyId)?.name ?? 'ทุกราย'
  const filterLabel = [companyName, EVENT_TYPE_LABEL[eventType], dateRangeLabel(filters, formatThaiDate)].join(' · ')

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      await exportShopReportExcel({ shopName, filterLabel, filters, rows: filteredRows })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="รายการทั้งหมด" value={formatNumber(summary.totalEvents)} unit="รายการ" icon={<ArrowDownUp className="size-4.5" />} />
        <StatTile label="ถอด / ใส่" value={`${formatNumber(summary.unmountCount)} / ${formatNumber(summary.mountCount)}`} tone="amber" icon={<ArrowDownUp className="size-4.5" />} />
        <StatTile label="รถที่เข้ารับบริการ" value={formatNumber(summary.vehicleCount)} unit="คัน" tone="sky" icon={<Truck className="size-4.5" />} />
        <StatTile label="ลูกค้า" value={formatNumber(summary.companyCount)} unit="ราย" tone="emerald" icon={<Building2 className="size-4.5" />} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900">รายการเปลี่ยนยาง</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
              <CalendarRange className="size-4" />
              {filterLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={eventType} onChange={(e) => setEventType(e.target.value as ShopReportEventType)} className="w-40">
              {(Object.keys(EVENT_TYPE_LABEL) as ShopReportEventType[]).map((key) => (
                <option key={key} value={key}>{EVENT_TYPE_LABEL[key]}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={filteredRows.length === 0}>
              <ExcelLogo className="size-5" />
              ส่งออก Excel
            </Button>
          </div>
        </div>

        {exportError && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {filteredRows.length === 0 ? (
          <EmptyState title="ไม่มีรายการตามตัวกรอง" description="ลองขยายช่วงวันที่ หรือเลือกทุกราย" />
        ) : (
          <TableWrap>
            <Table className="min-w-[1000px]">
              <thead>
                <tr>
                  <Th>วันที่</Th>
                  <Th>ลูกค้า</Th>
                  <Th>รถ · ตำแหน่ง</Th>
                  <ChangeSideHeaders />
                  <Th className="text-right">เลขไมล์</Th>
                  <Th>ผู้บันทึก</Th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((item) => {
                  const main = primaryEvent(item).row
                  return (
                    <tr key={item.key} className="hover:bg-brand-50/40">
                      <Td className="whitespace-nowrap">{formatThaiDate(item.event_date)}</Td>
                      <Td className="font-medium text-ink-900">{main.companyName}</Td>
                      <Td>
                        <span className="font-medium text-ink-900">{main.vehicleLabel}</span>
                        <p className="text-xs text-ink-500">{main.positionLabel}</p>
                      </Td>
                      <Td><ChangeSideCell side={reportSide(item.unmount?.row ?? null)} emptyText="ใส่ลงตำแหน่งว่าง" /></Td>
                      <Td><ChangeSideCell side={reportSide(item.mount?.row ?? null)} emptyText="ถอดเก็บ ไม่ใส่แทน" /></Td>
                      <Td className="text-right">{formatKm(main.odometer)}</Td>
                      <Td>{main.recordedBy ?? '-'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination state={pagination} itemLabel="งาน" />
          </TableWrap>
        )}
      </Card>
    </div>
  )
}
