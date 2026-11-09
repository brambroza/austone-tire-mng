import { tireSpecLabel } from '@/lib/tire-display'
import { formatThaiDate, todayISO } from '@/lib/utils'
import { summarizeShopRows, type ShopReportFilters, type ShopReportRow } from './shop-report-types'
import type { Cell, Row, Sheet, SheetData } from 'write-excel-file/browser'

interface ShopExportInput {
  shopName: string
  /** ข้อความตัวกรองที่ใช้ (ลูกค้า + ประเภทรายการ + ช่วงวันที่) สำหรับหัวรายงาน */
  filterLabel: string
  filters: ShopReportFilters
  rows: ShopReportRow[]
}

const BRAND = '#1A1A1A'
const BRAND_LIGHT = '#FEFCE6'
const INK = '#1A1A1A'
const MUTED = '#7A7878'
const LINE = '#E8E8E4'

/**
 * ชื่อไฟล์ส่งออก เช่น dream-tire-shop-report_2569-08-01_2569-09-15.xlsx
 * @param filters ตัวกรองที่ใช้ (ช่วงวันที่ว่าง = ใช้วันที่ส่งออก)
 */
export function shopReportFilename(filters: ShopReportFilters) {
  const suffix = filters.from || filters.to
    ? `_${filters.from || 'start'}_${filters.to || todayISO()}`
    : `-${todayISO()}`
  return `dream-tire-shop-report${suffix}.xlsx`
}

/** สร้างไฟล์ .xlsx สองชีต: สรุป และรายการที่ผ่านตัวกรอง */
export function buildShopReportExcelSheets(input: ShopExportInput, exportedAt = new Date()): Sheet<Blob>[] {
  const summary = summarizeShopRows(input.rows)

  const titleRow: Row = [
    {
      value: 'รายงานการเปลี่ยนยางของร้านค้า',
      columnSpan: 6,
      height: 34,
      fontSize: 18,
      fontWeight: 'bold',
      textColor: INK,
      alignVertical: 'center',
    },
    null, null, null, null, null,
  ]
  const metaRow: Row = [
    {
      value: `${input.shopName} · ตัวกรอง: ${input.filterLabel} · ส่งออก ${formatThaiDate(exportedAt, true)}`,
      columnSpan: 6,
      height: 24,
      fontSize: 10,
      textColor: MUTED,
    },
    null, null, null, null, null,
  ]
  const metricLabel = (value: string): Cell => ({ value, textColor: MUTED, height: 25 })
  const metricValue = (value: number): Cell => ({
    value, fontWeight: 'bold', fontSize: 14, textColor: INK, align: 'right', format: '#,##0', height: 25,
  })
  const summaryData: SheetData = [
    titleRow,
    metaRow,
    [],
    [metricLabel('จำนวนรายการ'), metricValue(summary.totalEvents), null, metricLabel('ถอดยาง'), metricValue(summary.unmountCount)],
    [metricLabel('ใส่ยาง'), metricValue(summary.mountCount), null, metricLabel('จำนวนรถ'), metricValue(summary.vehicleCount)],
    [metricLabel('จำนวนลูกค้า'), metricValue(summary.companyCount)],
  ]

  const headers = [
    'วันที่', 'ลูกค้า', 'รายการ', 'รถ', 'ตำแหน่ง', 'ซีรีย์', 'ขนาด / ยี่ห้อ รุ่น',
    'เลขไมล์รถ (กม.)', 'ระยะรอบนี้ (กม.)', 'ดอกยาง (มม.)', 'สาเหตุ', 'หมายเหตุ', 'ผู้บันทึก',
  ]
  const detailData: SheetData = [
    headers.map((value) => ({
      value,
      height: 29,
      fontWeight: 'bold' as const,
      textColor: '#FFFFFF',
      backgroundColor: BRAND,
      alignVertical: 'center' as const,
      wrap: true,
    })),
    ...input.rows.map((row, index): Row => {
      const backgroundColor = index % 2 === 1 ? BRAND_LIGHT : '#FFFFFF'
      const base = {
        height: 24,
        backgroundColor,
        bottomBorderColor: LINE,
        bottomBorderStyle: 'hair' as const,
        alignVertical: 'center' as const,
      }
      return [
        { ...base, value: new Date(row.eventDate), type: Date, format: 'dd/mm/yyyy' },
        { ...base, value: row.companyName, wrap: true },
        { ...base, value: row.eventType === 'mount' ? 'ใส่ยาง' : 'ถอดยาง' },
        { ...base, value: [row.vehicleLabel, row.province].filter(Boolean).join(' · '), wrap: true },
        { ...base, value: row.positionLabel, wrap: true },
        { ...base, value: row.unknownSerial ? `${row.serialNo} (ไม่ทราบซีรีย์)` : row.serialNo, type: String },
        {
          ...base,
          value: tireSpecLabel(
            { size: row.size, brandName: row.brandName, modelName: row.modelName },
            { sizeFallback: '-', brandModelFallback: '-' },
          ),
          wrap: true,
        },
        { ...base, value: row.odometer, format: '#,##0', align: 'right' },
        row.distanceKm === null ? { ...base, value: '-' } : { ...base, value: row.distanceKm, format: '#,##0', align: 'right' },
        row.treadMm === null ? { ...base, value: '-' } : { ...base, value: row.treadMm, format: '0.0', align: 'right' },
        { ...base, value: row.reasonName ?? '', wrap: true },
        { ...base, value: row.note ?? '', wrap: true },
        { ...base, value: row.recordedBy ?? '' },
      ]
    }),
  ]

  return [
    {
      data: summaryData,
      sheet: 'สรุป',
      columns: [24, 16, 4, 24, 16, 4].map((width) => ({ width })),
      showGridLines: false,
      zoomScale: 1,
    },
    {
      data: detailData,
      sheet: 'รายการเปลี่ยนยาง',
      columns: [14, 28, 10, 22, 22, 22, 28, 16, 16, 14, 22, 30, 18].map((width) => ({ width })),
      stickyRowsCount: 1,
      showGridLines: false,
      orientation: 'landscape',
      zoomScale: 0.9,
    },
  ]
}

/** ส่งออก Excel จากรายการที่ผ่านตัวกรองแล้ว */
export async function exportShopReportExcel(input: ShopExportInput) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(buildShopReportExcelSheets(input), { fontFamily: 'Aptos', fontSize: 11 })
    .toFile(shopReportFilename(input.filters))
}
