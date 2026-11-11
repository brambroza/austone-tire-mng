import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Truck, Wrench } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { SHOP_ADMIN_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { SearchInput } from '@/components/search-input'
import { Card, CardHeader, EmptyState, Table, TableWrap, Td, Th } from '@/components/ui'
import { ChangeSideCell, ChangeSideHeaders } from '@/components/tire-event-table'
import { hideBackfillEvents, pairTireChanges, primaryEvent } from '@/lib/tire-change-rows'
import { getLayout, positionLabel } from '@/lib/axle-layouts'
import { matchesVehicle, vehicleLabel } from '@/lib/vehicle-display'
import { formatKm, formatThaiDate } from '@/lib/utils'
import { CompanyEditButton } from './company-detail-client'
import { CompanyPublicLinkCard } from './company-public-link'
import { getAppBaseUrl } from '@/lib/app-url'
import { SHOP_EVENT_SELECT, shopEventSide, type ShopEventRecord } from '../../shop-queries'
import type { AxleType, Company, Vehicle } from '@/lib/database.types'

export const metadata = { title: 'ลูกค้า · Austone Tire Shop' }

/**
 * รายละเอียดลูกค้า 1 ราย: รถที่เคยเข้าร้าน + ประวัติเปลี่ยนยางล่าสุด
 * ค้นหาด้วย ?q= (ทะเบียน/ชื่อเรียก) — กรองทั้งตารางรถและประวัติ
 */
export default async function ShopCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}) {
  await requireSession(SHOP_ADMIN_ROLES)
  const { id } = await params
  const { q = '' } = await searchParams
  const query = q.trim()
  const supabase = await createClient()

  // RLS คัดให้เหลือลูกค้าภายใต้ร้าน — ไม่พบ = ไม่ใช่ของร้านนี้
  const { data: companyData } = await supabase.from('companies').select('*').eq('id', id).maybeSingle()
  if (!companyData) notFound()
  const company = companyData as Company

  const [{ data: vehicleData }, { data: eventData }, { data: axleTypeData }] =
    await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', id).eq('is_active', true)
        .order('plate_no', { nullsFirst: false }).order('nickname'),
      supabase.from('tire_events').select(SHOP_EVENT_SELECT).eq('company_id', id)
        .order('event_date', { ascending: false }).order('created_at', { ascending: false }).limit(60),
      supabase.from('axle_types').select('*').order('sort_order'),
    ])

  const baseUrl = await getAppBaseUrl()
  const vehicles = (vehicleData ?? []) as Vehicle[]
  // ตัด event ใส่ยางย้อนหลังที่ระบบแทรกให้ — ไม่ใช่งานที่ร้านทำ (ดู hideBackfillEvents)
  const events = hideBackfillEvents((eventData ?? []) as unknown as ShopEventRecord[])
  const axleTypes = (axleTypeData ?? []) as AxleType[]
  // งานเปลี่ยนยาง (ถอด+ใส่ ตำแหน่งเดียวกัน วันเดียวกัน) แสดงเป็นแถวเดียว
  const changeRows = pairTireChanges(events, (e) => e.vehicles?.id)

  // กรองตามคำค้น — ใช้เงื่อนไขเดียวกันทั้งตารางรถและประวัติ
  const filteredVehicles = query ? vehicles.filter((v) => matchesVehicle(v, query)) : vehicles
  const filteredRows = query
    ? changeRows.filter((row) => {
        const vehicle = primaryEvent(row).vehicles
        return Boolean(vehicle && matchesVehicle(vehicle, query))
      })
    : changeRows

  /** วันที่เปลี่ยนยางล่าสุดของแต่ละคัน (จาก 60 รายการล่าสุด) */
  const lastEventByVehicle = new Map<string, string>()
  for (const e of events) {
    const vid = e.vehicles?.id
    if (vid && !lastEventByVehicle.has(vid)) lastEventByVehicle.set(vid, e.event_date)
  }

  return (
    <>
      <Link href="/shop" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="size-4" />
        กลับไปรายชื่อลูกค้า
      </Link>

      <PageHeader
        title={company.name}
        subtitle={[company.code, company.contact_name, company.phone].filter(Boolean).join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CompanyEditButton company={company} />
            <Link
              href={`/shop/service?company=${company.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-4 text-[15px] font-medium text-ink-900 hover:bg-ink-900 hover:text-brand-500"
            >
              <Wrench className="size-4.5" />
              บันทึกถอด-ใส่ยาง
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <CompanyPublicLinkCard
          companyId={company.id}
          token={company.public_token}
          createdAt={company.public_token_created_at}
          baseUrl={baseUrl}
        />

        <Card>
          <CardHeader
            title="รถของลูกค้า"
            description={
              query
                ? `พบ ${filteredVehicles.length} จาก ${vehicles.length} คัน`
                : `${vehicles.length} คัน — รถใหม่เพิ่มได้ตอนบันทึกงาน (คีย์ทะเบียนหรือชื่อเรียก)`
            }
          />
          {vehicles.length > 0 && (
            <div className="border-b border-line px-5 py-3">
              <Suspense fallback={null}>
                <SearchInput placeholder="ค้นหาทะเบียน หรือชื่อเรียกรถ..." className="sm:max-w-md" />
              </Suspense>
            </div>
          )}
          {vehicles.length === 0 ? (
            <EmptyState icon={<Truck className="size-6" />} title="ยังไม่มีรถ" description="รถจะถูกเพิ่มอัตโนมัติเมื่อบันทึกการเปลี่ยนยางครั้งแรก" />
          ) : filteredVehicles.length === 0 ? (
            <EmptyState icon={<Truck className="size-6" />} title={`ไม่พบรถที่ตรงกับ "${query}"`} description="ลองค้นด้วยทะเบียนบางส่วน หรือล้างคำค้นหา" />
          ) : (
            <TableWrap>
              <Table className="min-w-[720px]">
                <thead>
                  <tr>
                    <Th>รถ</Th>
                    <Th>ประเภทรถ</Th>
                    <Th className="text-right">เลขไมล์ล่าสุด</Th>
                    <Th>เปลี่ยนยางล่าสุด</Th>
                    <Th className="text-right">จัดการ</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => {
                    const layout = getLayout(v.axle_type, axleTypes)
                    return (
                      <tr key={v.id} className="transition-colors hover:bg-brand-50/40">
                        <Td className="font-medium text-ink-900">
                          {vehicleLabel(v)}
                          {v.province && <p className="text-xs text-ink-400">{v.province}</p>}
                        </Td>
                        <Td>{layout.name} · {layout.wheelCount} ล้อ</Td>
                        <Td className="text-right">{formatKm(v.current_mileage)}</Td>
                        <Td className="whitespace-nowrap">
                          {lastEventByVehicle.get(v.id) ? formatThaiDate(lastEventByVehicle.get(v.id)) : '-'}
                        </Td>
                        <Td>
                          <div className="flex justify-end">
                            <Link
                              href={`/shop/service?company=${company.id}&vehicle=${v.id}`}
                              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink-700 hover:bg-brand-50"
                            >
                              <Wrench className="size-4" />
                              บันทึกยาง
                            </Link>
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader
            title="ประวัติถอด-ใส่ยางล่าสุด"
            description={
              query
                ? `กรองตามคำค้น "${query}" — ${filteredRows.length} รายการ จาก 60 รายการล่าสุด`
                : '60 รายการล่าสุด — ดูทั้งหมดและส่งออกได้ที่เมนูรายงาน'
            }
            action={
              <Link href={`/shop/reports?company=${company.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                ดูรายงานทั้งหมด
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState title="ยังไม่มีประวัติการเปลี่ยนยาง" />
          ) : filteredRows.length === 0 ? (
            <EmptyState title={`ไม่พบประวัติของรถที่ตรงกับ "${query}"`} />
          ) : (
            <TableWrap>
              <Table className="min-w-[960px]">
                <thead>
                  <tr>
                    <Th>วันที่</Th>
                    <Th>รถ · ตำแหน่ง</Th>
                    <ChangeSideHeaders />
                    <Th className="text-right">เลขไมล์</Th>
                    <Th>ผู้บันทึก</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const main = primaryEvent(row)
                    return (
                      <tr key={row.key} className="hover:bg-brand-50/40">
                        <Td className="whitespace-nowrap">{formatThaiDate(row.event_date)}</Td>
                        <Td>
                          <span className="font-medium text-ink-900">{vehicleLabel(main.vehicles, 'รถถูกลบ')}</span>
                          <p className="text-xs text-ink-500">{positionLabel(row.position_code, main.vehicles?.axle_type ?? null, axleTypes)}</p>
                        </Td>
                        <Td><ChangeSideCell side={shopEventSide(row.unmount)} emptyText="ใส่ลงตำแหน่งว่าง" /></Td>
                        <Td><ChangeSideCell side={shopEventSide(row.mount)} emptyText="ถอดเก็บ ไม่ใส่แทน" /></Td>
                        <Td className="text-right">{formatKm(main.odometer)}</Td>
                        <Td>{main.profiles?.full_name ?? '-'}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* บัญชีผู้ใช้ของลูกค้า (CompanyAccountsClient ใน company-detail-client.tsx) ปิดไว้ก่อน — เปิดเมื่อพร้อมให้ร้านสร้างบัญชีให้ลูกค้า */}
      </div>
    </>
  )
}
