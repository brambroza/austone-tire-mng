import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES, canEditCentral } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { CompaniesClient, type CompanyRow } from './companies-client'
import type { Company, Shop } from '@/lib/database.types'

export const metadata = { title: 'ลูกค้าปลายทาง · Austone Tire Admin' }

/** นับจำนวนแถวตาม company_id */
function countBy(rows: Array<{ company_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.company_id) continue
    map.set(r.company_id, (map.get(r.company_id) ?? 0) + 1)
  }
  return map
}

/** หน้ารายการลูกค้า (super admin) — ค้นหาด้วย ?q= จากชื่อ รหัส ผู้ติดต่อ เบอร์โทร อีเมล เลขผู้เสียภาษี */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { profile } = await requireSession(AUSTONE_ROLES)
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('companies').select('*').order('name')
  if (q?.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(
      `name.ilike.${term},code.ilike.${term},contact_name.ilike.${term},phone.ilike.${term},email.ilike.${term},tax_id.ilike.${term}`,
    )
  }

  const [{ data: companyData }, { data: vehicles }, { data: tires }, { data: profiles }, { data: shopData }] =
    await Promise.all([
      query,
      supabase.from('vehicles').select('company_id'),
      supabase.from('tires').select('company_id'),
      supabase.from('profiles').select('company_id'),
      supabase.from('shops').select('*').order('name'),
    ])
  const shops = (shopData ?? []) as Shop[]
  const shopName = new Map(shops.map((s) => [s.id, s.name]))

  const vehicleCount = countBy(vehicles ?? [])
  const tireCount = countBy(tires ?? [])
  const userCount = countBy(profiles ?? [])

  const companies: CompanyRow[] = ((companyData ?? []) as Company[]).map((c) => ({
    ...c,
    vehicle_count: vehicleCount.get(c.id) ?? 0,
    tire_count: tireCount.get(c.id) ?? 0,
    user_count: userCount.get(c.id) ?? 0,
    shop_name: c.shop_id ? shopName.get(c.shop_id) ?? null : null,
  }))

  return (
    <>
      <Link href="/superadmin/shops" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="size-4" />
        กลับไปร้านค้า/ดีลเลอร์
      </Link>
      <PageHeader
        title="ลูกค้าปลายทางทั้งหมด"
        subtitle="ลูกค้าของทุกร้านค้า/ดีลเลอร์ในที่เดียว — แพ็กเกจ สถานะ และร้านที่ดูแล"
      />
      <CompaniesClient companies={companies} shops={shops} readOnly={!canEditCentral(profile.role)} />
    </>
  )
}
