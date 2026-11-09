import Link from 'next/link'
import { Building2, CircleDot, Truck } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, CardHeader, EmptyState, Table, TableWrap, Td, Th } from '@/components/ui'
import { PlanBadge } from '@/app/(super)/superadmin/companies/companies-client'
import { formatNumber, formatThaiDate } from '@/lib/utils'
import { loadShopCustomers } from '../shop-data'

export const metadata = { title: 'ลูกค้าของร้าน · Austone Tire Admin' }

/** นับจำนวนแถวตาม company_id */
function countBy(rows: Array<{ company_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) if (r.company_id) map.set(r.company_id, (map.get(r.company_id) ?? 0) + 1)
  return map
}

/** แท็บลูกค้าของร้าน — รายชื่อลูกค้าปลายทางที่ร้านดูแล พร้อมจำนวนรถ/ยาง และทางลัดไปหน้าลูกค้ารายนั้น */
export default async function ShopCustomersPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const customers = await loadShopCustomers(supabase, id)
  const ids = customers.map((c) => c.id)
  const [{ data: vehicles }, { data: tires }, { data: events }] = ids.length === 0
    ? [{ data: [] }, { data: [] }, { data: [] }]
    : await Promise.all([
        supabase.from('vehicles').select('company_id').in('company_id', ids).eq('is_active', true),
        supabase.from('tires').select('company_id').in('company_id', ids).neq('status', 'scrapped').limit(5000),
        supabase.from('tire_events').select('company_id, event_date').in('company_id', ids).order('event_date', { ascending: false }).limit(2000),
      ])
  const vehicleCount = countBy(vehicles ?? [])
  const tireCount = countBy(tires ?? [])
  const lastService = new Map<string, string>()
  for (const e of (events ?? []) as { company_id: string; event_date: string }[]) {
    if (!lastService.has(e.company_id)) lastService.set(e.company_id, e.event_date)
  }

  return (
    <Card>
      <CardHeader
        title="ลูกค้าของร้าน"
        description={`${customers.length} ราย — ร้านเพิ่มเองได้ หรือกำหนด “ร้านค้าที่ดูแล” ในฟอร์มลูกค้าปลายทาง · กดชื่อเพื่อดูรถ คลังยาง ผู้ใช้ และสิทธิ์ของลูกค้ารายนั้น`}
      />
      {customers.length === 0 ? (
        <EmptyState icon={<Building2 className="size-6" />} title="ยังไม่มีลูกค้าภายใต้ร้านนี้" description="ร้านเพิ่มลูกค้าได้จากหน้า “ลูกค้า” ของร้าน" />
      ) : (
        <TableWrap>
          <Table className="min-w-[880px]">
            <thead>
              <tr>
                <Th>ลูกค้า</Th>
                <Th>รหัส</Th>
                <Th>ผู้ติดต่อ</Th>
                <Th className="text-right">รถ</Th>
                <Th className="text-right">ยาง</Th>
                <Th>เปลี่ยนยางล่าสุด</Th>
                <Th>แพ็กเกจ</Th>
                <Th>สถานะ</Th>
                <Th className="text-right">ดูข้อมูล</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-brand-50/40">
                  <Td>
                    <Link href={`/superadmin/companies/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600">{c.name}</Link>
                    <p className="text-xs text-ink-400">เพิ่มเมื่อ {formatThaiDate(c.created_at)}</p>
                  </Td>
                  <Td><Badge tone="brand">{c.code}</Badge></Td>
                  <Td>{[c.contact_name, c.phone].filter(Boolean).join(' · ') || '-'}</Td>
                  <Td className="text-right">{formatNumber(vehicleCount.get(c.id) ?? 0)}</Td>
                  <Td className="text-right">{formatNumber(tireCount.get(c.id) ?? 0)}</Td>
                  <Td className="whitespace-nowrap">{lastService.get(c.id) ? formatThaiDate(lastService.get(c.id)) : '-'}</Td>
                  <Td><PlanBadge company={c} /></Td>
                  <Td><Badge tone={c.is_active ? 'emerald' : 'slate'}>{c.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge></Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/superadmin/companies/${c.id}/vehicles`} aria-label="รถ" title="รถของลูกค้า"
                        className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600">
                        <Truck className="size-4.5" />
                      </Link>
                      <Link href={`/superadmin/companies/${c.id}/tires`} aria-label="คลังยาง" title="คลังยางของลูกค้า"
                        className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600">
                        <CircleDot className="size-4.5" />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  )
}
