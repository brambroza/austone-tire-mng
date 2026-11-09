import Link from 'next/link'
import { Building2, CircleDot, Gauge, Truck, Users } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { loadShopGrantModels } from '@/lib/service-data'
import { Badge, Card, CardHeader, EmptyState, StatTile, Table, TableWrap, Td, Th } from '@/components/ui'
import { positionLabel } from '@/lib/axle-layouts'
import { vehicleLabel } from '@/lib/vehicle-display'
import { formatKm, formatNumber, formatThaiDate } from '@/lib/utils'
import { companyNameMap, loadShopCustomers } from './shop-data'
import type { AxleType } from '@/lib/database.types'

export const metadata = { title: 'ร้านค้า/ดีลเลอร์ · Austone Tire Admin' }

/** จำนวนประวัติล่าสุดที่แสดงในแท็บภาพรวม */
const RECENT_LIMIT = 20

interface EventRow {
  id: string
  company_id: string
  event_type: string
  event_date: string
  position_code: string | null
  odometer: number
  tires: { serial_no: string; brand_name: string | null; model_name: string | null } | null
  vehicles: { nickname: string | null; plate_no: string | null; axle_type: string } | null
  removal_reasons: { name: string } | null
  profiles: { full_name: string } | null
}

/** แท็บภาพรวมของร้านค้า/ดีลเลอร์: ตัวเลขรวมทุกลูกค้าของร้าน รุ่นยางที่กำหนด และงานล่าสุด */
export default async function ShopOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const customers = await loadShopCustomers(supabase, id)
  const companyIds = customers.map((c) => c.id)
  const names = companyNameMap(customers)
  const noCustomers = companyIds.length === 0

  const [grantModels, { count: userCount }, { count: vehicleCount }, { data: tireStatus }, { data: eventData }, { data: axleTypeData }] =
    await Promise.all([
      loadShopGrantModels(supabase, id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('shop_id', id),
      noCustomers
        ? Promise.resolve({ count: 0 })
        : supabase.from('vehicles').select('id', { count: 'exact', head: true }).in('company_id', companyIds).eq('is_active', true),
      noCustomers
        ? Promise.resolve({ data: [] as { status: string }[] })
        : supabase.from('tires').select('status').in('company_id', companyIds).limit(5000),
      noCustomers
        ? Promise.resolve({ data: [] as EventRow[] })
        : supabase
            .from('tire_events')
            .select('id, company_id, event_type, event_date, position_code, odometer, ' +
              'tires(serial_no, brand_name, model_name), vehicles(nickname, plate_no, axle_type), removal_reasons(name), profiles(full_name)')
            .in('company_id', companyIds)
            .order('event_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(RECENT_LIMIT),
      supabase.from('axle_types').select('*').order('sort_order'),
    ])

  const statuses = (tireStatus ?? []) as { status: string }[]
  const mounted = statuses.filter((t) => t.status === 'mounted').length
  const inStock = statuses.filter((t) => t.status === 'in_stock').length
  const events = (eventData ?? []) as unknown as EventRow[]
  const axleTypes = (axleTypeData ?? []) as AxleType[]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="ลูกค้าของร้าน" value={formatNumber(customers.length)} unit="ราย" icon={<Building2 className="size-4.5" />} />
        <StatTile label="รถทั้งหมด" value={formatNumber(vehicleCount ?? 0)} unit="คัน" tone="sky" icon={<Truck className="size-4.5" />} />
        <StatTile label="ยางบนรถ" value={formatNumber(mounted)} unit="เส้น" tone="emerald" icon={<CircleDot className="size-4.5" />} />
        <StatTile label="ยางในคลัง" value={formatNumber(inStock)} unit="เส้น" tone="amber" icon={<Gauge className="size-4.5" />} />
        <StatTile label="ผู้ใช้งานร้าน" value={formatNumber(userCount ?? 0)} unit="บัญชี" tone="slate" icon={<Users className="size-4.5" />} />
      </div>

      <Card>
        <CardHeader
          title="รุ่นยางที่กำหนดให้ร้าน"
          description={
            grantModels.length === 0
              ? 'ยังไม่ได้กำหนด — ร้านจะบันทึกการถอดได้ แต่ยังใส่ยางให้ลูกค้าไม่ได้'
              : `${grantModels.length} รุ่น — ร้านใส่ยางให้ลูกค้าได้เฉพาะรุ่นเหล่านี้`
          }
          action={
            <Link
              href={`/superadmin/shops/${id}/tires`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <CircleDot className="size-4" />
              กำหนดรุ่นยาง
            </Link>
          }
        />
        {grantModels.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {grantModels.map((m) => (
              <Badge key={m.id} tone="brand">{[m.brand_name, m.model_name].filter(Boolean).join(' ')}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="งานถอด-ใส่ยางล่าสุดของร้าน"
          description={`${RECENT_LIMIT} รายการล่าสุด รวมทุกลูกค้า — ดูรายคันได้ในแท็บ “ลูกค้าของร้าน”`}
        />
        {events.length === 0 ? (
          <EmptyState title="ยังไม่มีประวัติการเปลี่ยนยาง" description="ร้านยังไม่ได้บันทึกงานให้ลูกค้ารายใด" />
        ) : (
          <TableWrap>
            <Table className="min-w-[900px]">
              <thead>
                <tr>
                  <Th>วันที่</Th>
                  <Th>ลูกค้า</Th>
                  <Th>รายการ</Th>
                  <Th>รถ · ตำแหน่ง</Th>
                  <Th>ซีรีย์ / รุ่น</Th>
                  <Th className="text-right">เลขไมล์</Th>
                  <Th>สาเหตุ</Th>
                  <Th>ผู้บันทึก</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-brand-50/40">
                    <Td className="whitespace-nowrap">{formatThaiDate(e.event_date)}</Td>
                    <Td>
                      <Link href={`/superadmin/companies/${e.company_id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {names.get(e.company_id) ?? '-'}
                      </Link>
                    </Td>
                    <Td><Badge tone={e.event_type === 'mount' ? 'brand' : 'amber'}>{e.event_type === 'mount' ? 'ใส่ยาง' : 'ถอดยาง'}</Badge></Td>
                    <Td>
                      {vehicleLabel(e.vehicles, 'รถถูกลบ')}
                      <p className="text-xs text-ink-500">{positionLabel(e.position_code, e.vehicles?.axle_type ?? null, axleTypes)}</p>
                    </Td>
                    <Td>
                      <span className="font-mono uppercase">{e.tires?.serial_no ?? '-'}</span>
                      <p className="text-xs text-ink-500">{[e.tires?.brand_name, e.tires?.model_name].filter(Boolean).join(' ') || '-'}</p>
                    </Td>
                    <Td className="text-right">{formatKm(e.odometer)}</Td>
                    <Td>{e.removal_reasons?.name ?? '-'}</Td>
                    <Td>{e.profiles?.full_name ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  )
}
