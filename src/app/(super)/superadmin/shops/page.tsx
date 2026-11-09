import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { ShopsClient, type ShopRow } from './shops-client'
import type { Shop } from '@/lib/database.types'

export const metadata = { title: 'ร้านค้า/ดีลเลอร์ · Austone Tire Admin' }

/** นับจำนวนแถวตาม key */
function countBy(rows: Array<{ shop_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.shop_id) continue
    map.set(r.shop_id, (map.get(r.shop_id) ?? 0) + 1)
  }
  return map
}

/** รายชื่อร้านค้า (super admin) — ร้านที่เปลี่ยนยางให้ลูกค้าหลายราย */
export default async function ShopsPage() {
  await requireSession(AUSTONE_ROLES)
  const supabase = await createClient()

  const [{ data: shopData }, { data: companies }, { data: profiles }] = await Promise.all([
    supabase.from('shops').select('*').order('name'),
    supabase.from('companies').select('shop_id').not('shop_id', 'is', null),
    supabase.from('profiles').select('shop_id').eq('role', 'shop'),
  ])

  const companyCount = countBy(companies ?? [])
  const userCount = countBy(profiles ?? [])
  const shops: ShopRow[] = ((shopData ?? []) as Shop[]).map((s) => ({
    ...s,
    company_count: companyCount.get(s.id) ?? 0,
    user_count: userCount.get(s.id) ?? 0,
  }))

  return (
    <>
      <PageHeader
        title="ร้านค้า/ดีลเลอร์"
        subtitle="ดีลเลอร์ของ Austone ที่เปลี่ยนยางให้ลูกค้าปลายทาง — กำหนดรุ่นยางให้แต่ละร้าน สร้างบัญชีร้าน และดูลูกค้าของร้านได้จากหน้าร้านแต่ละแห่ง"
        action={
          <Link
            href="/superadmin/companies"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink-700 hover:bg-brand-50"
          >
            <Building2 className="size-4" />
            ลูกค้าปลายทางทั้งหมด
          </Link>
        }
      />
      <ShopsClient shops={shops} />
    </>
  )
}
