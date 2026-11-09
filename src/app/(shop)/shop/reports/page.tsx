import { Filter } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { positionLabel } from '@/lib/axle-layouts'
import { vehicleLabel } from '@/lib/vehicle-display'
import { isUnknownSerial } from '@/lib/shop-rules'
import { ShopReportClient } from './shop-report-client'
import type { ShopReportCompanyOption, ShopReportFilters, ShopReportRow } from './shop-report-types'
import { SHOP_EVENT_SELECT, type ShopEventRecord } from '../shop-queries'
import type { AxleType } from '@/lib/database.types'

export const metadata = { title: 'รายงานการเปลี่ยนยาง · Austone Tire Shop' }

/** จำนวนรายการสูงสุดที่ดึงมาต่อครั้ง — กรองช่วงวันที่ให้แคบลงถ้าเกิน */
const REPORT_LIMIT = 2000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * รายงานการเปลี่ยนยางของร้านค้า แยกตามลูกค้า/ช่วงวันที่ (ผ่าน query string) พร้อมส่งออก Excel
 */
export default async function ShopReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>
}) {
  const { shop } = await requireSession(['shop'])
  const params = await searchParams
  const filters: ShopReportFilters = {
    companyId: params.company && UUID.test(params.company) ? params.company : '',
    from: params.from && ISO_DATE.test(params.from) ? params.from : '',
    to: params.to && ISO_DATE.test(params.to) ? params.to : '',
  }
  const supabase = await createClient()

  let eventQuery = supabase
    .from('tire_events')
    .select(SHOP_EVENT_SELECT)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(REPORT_LIMIT)
  if (filters.companyId) eventQuery = eventQuery.eq('company_id', filters.companyId)
  if (filters.from) eventQuery = eventQuery.gte('event_date', filters.from)
  if (filters.to) eventQuery = eventQuery.lte('event_date', filters.to)

  const [{ data: companyData }, { data: eventData }, { data: axleTypeData }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    eventQuery,
    supabase.from('axle_types').select('*'),
  ])

  const companies: ShopReportCompanyOption[] = companyData ?? []
  const companyName = new Map(companies.map((c) => [c.id, c.name]))
  const axleTypes = (axleTypeData ?? []) as AxleType[]

  const rows: ShopReportRow[] = ((eventData ?? []) as unknown as ShopEventRecord[]).map((e) => ({
    id: e.id,
    companyId: e.company_id,
    companyName: companyName.get(e.company_id) ?? '-',
    eventType: e.event_type === 'mount' ? 'mount' : 'unmount',
    eventDate: e.event_date,
    vehicleLabel: vehicleLabel(e.vehicles, 'รถถูกลบ'),
    province: e.vehicles?.province ?? null,
    positionLabel: positionLabel(e.position_code, e.vehicles?.axle_type ?? null, axleTypes),
    serialNo: e.tires?.serial_no ?? '-',
    unknownSerial: isUnknownSerial(e.tires?.serial_no),
    brandName: e.tires?.brand_name ?? null,
    modelName: e.tires?.model_name ?? null,
    size: e.tires?.size ?? null,
    odometer: e.odometer,
    treadMm: e.tread_mm,
    distanceKm: e.distance_km,
    reasonName: e.removal_reasons?.name ?? null,
    note: e.note,
    recordedBy: e.profiles?.full_name ?? null,
  }))

  return (
    <>
      <PageHeader
        title="รายงานการเปลี่ยนยาง"
        subtitle="ประวัติถอด-ใส่ยางที่ร้านบันทึกให้แต่ละลูกค้า — เลือกลูกค้าและช่วงวันที่แล้วกดกรอง"
      />

      <Card className="mb-6 p-5">
        {/* ฟอร์ม GET ธรรมดา: ตัวกรองอยู่ใน URL แชร์/บุ๊กมาร์กได้ ไม่ต้องใช้ JS */}
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <Field label="ลูกค้า">
            <Select name="company" defaultValue={filters.companyId}>
              <option value="">ทุกราย</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="ตั้งแต่วันที่">
            <Input type="date" name="from" defaultValue={filters.from} />
          </Field>
          <Field label="ถึงวันที่">
            <Input type="date" name="to" defaultValue={filters.to} />
          </Field>
          <Button type="submit">
            <Filter className="size-4" />
            กรอง
          </Button>
        </form>
        {rows.length >= REPORT_LIMIT && (
          <p className="mt-3 text-sm text-amber-700">
            แสดงได้สูงสุด {REPORT_LIMIT.toLocaleString('en-US')} รายการล่าสุด — เลือกลูกค้าหรือช่วงวันที่ให้แคบลงเพื่อดูครบ
          </p>
        )}
      </Card>

      <ShopReportClient shopName={shop?.name ?? 'ร้านค้า'} rows={rows} companies={companies} filters={filters} />
    </>
  )
}
