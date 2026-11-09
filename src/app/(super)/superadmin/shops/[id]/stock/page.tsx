import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, EmptyState, Select } from '@/components/ui'
import { TiresClient } from '@/app/(app)/tires/tires-client'
import type { ModelOption } from '@/app/(app)/tires/tire-form'
import { fetchLastRemovals } from '@/lib/tire-events'
import { computeTireStats, filterTiresByDate, filterTiresByStatus, parseTireDateFilter } from '@/app/(app)/tires/tire-filters'
import { loadShopCustomers } from '../shop-data'
import type { AxleType, Tire, TireOverview } from '@/lib/database.types'

export const metadata = { title: 'คลังยางของร้าน · Austone Tire Admin' }

interface ModelRow {
  id: string
  name: string
  size: string | null
  pattern_code: string | null
  new_tread_mm: number | null
  image_url: string | null
  tire_brands: { name: string } | null
}

/**
 * แท็บคลังยางของร้าน — ยางทุกเส้นของลูกค้าทุกรายที่ร้านดูแล (ดูอย่างเดียว)
 * แก้ไข/ตัดจำหน่ายทำที่แท็บคลังยางของลูกค้ารายนั้น เพราะยางผูกกับลูกค้าปลายทาง · เลือกดูเฉพาะลูกค้าได้ด้วย ?company=
 */
export default async function ShopStockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ company?: string; q?: string; status?: string; date_field?: string; from?: string; to?: string }>
}) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const { company, q, status, date_field, from, to } = await searchParams
  const supabase = await createClient()

  const customers = await loadShopCustomers(supabase, id)
  const selected = customers.find((c) => c.id === company) ?? null
  const companyIds = selected ? [selected.id] : customers.map((c) => c.id)

  if (companyIds.length === 0) {
    return (
      <Card>
        <EmptyState title="ร้านนี้ยังไม่มีลูกค้า" description="คลังยางจะแสดงเมื่อร้านเพิ่มลูกค้าและบันทึกงานแล้ว" />
      </Card>
    )
  }

  const [{ data: overviewData }, { data: rawData }, { data: modelData }, { data: axleTypeData }, { data: shopData }] = await Promise.all([
    supabase.from('tire_overview').select('*').in('company_id', companyIds).order('serial_no').limit(3000),
    supabase.from('tires').select('*').in('company_id', companyIds).limit(3000),
    supabase.from('tire_models').select('id, name, size, pattern_code, new_tread_mm, image_url, tire_brands(name)').eq('is_active', true).order('name'),
    supabase.from('axle_types').select('*').order('sort_order').order('name'),
    supabase.from('shops').select('name').eq('id', id).maybeSingle(),
  ])

  let tires = (overviewData ?? []) as TireOverview[]
  const stats = computeTireStats(tires)
  const lastRemovals = await fetchLastRemovals(supabase, tires.filter((t) => t.status !== 'mounted').map((t) => t.id))

  const term = q?.trim().toLowerCase()
  if (term) {
    tires = tires.filter((t) =>
      [t.serial_no, t.brand_name, t.model_name, t.size, t.nickname, t.plate_no, t.dot, lastRemovals[t.id]?.nickname, lastRemovals[t.id]?.plate_no]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    )
  }
  tires = filterTiresByStatus(tires, status)

  const rawTires: Record<string, Tire> = {}
  for (const t of (rawData ?? []) as Tire[]) rawTires[t.id] = t
  tires = filterTiresByDate(tires, rawTires, parseTireDateFilter({ date_field, from, to }))

  const models: ModelOption[] = ((modelData ?? []) as unknown as ModelRow[]).map((m) => ({
    id: m.id,
    brand: m.tire_brands?.name ?? '',
    model: m.name,
    size: m.size,
    pattern_code: m.pattern_code,
    new_tread_mm: m.new_tread_mm,
    image_url: m.image_url,
  }))

  const basePath = `/superadmin/shops/${id}/stock${selected ? `?company=${selected.id}` : ''}`

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="คลังยางของลูกค้าที่ร้านดูแล"
          description={selected ? `เฉพาะ ${selected.name}` : `รวมทุกลูกค้า ${customers.length} ราย — แก้ไข/ตัดจำหน่ายทำที่หน้าของลูกค้ารายนั้น`}
          action={
            <form method="get" className="flex items-center gap-2">
              {q && <input type="hidden" name="q" value={q} />}
              {status && <input type="hidden" name="status" value={status} />}
              <Select name="company" defaultValue={selected?.id ?? ''} className="min-w-56">
                <option value="">ทุกลูกค้า</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <button type="submit" className="h-12 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink-700 hover:bg-brand-50">
                แสดง
              </button>
            </form>
          }
        />
      </Card>
      <TiresClient
        tires={tires}
        rawTires={rawTires}
        models={models}
        lastRemovals={lastRemovals}
        canManage={false}
        basePath={basePath}
        enableLinks={false}
        enableHistory
        axleTypes={(axleTypeData ?? []) as AxleType[]}
        companyName={selected?.name ?? shopData?.name ?? 'Austone Tire'}
        stats={stats}
      />
    </>
  )
}
