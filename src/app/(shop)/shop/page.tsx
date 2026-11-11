import { requireSession } from '@/lib/auth'
import { SHOP_ADMIN_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { ShopCompaniesClient } from './shop-companies-client'
import { loadShopCompanies } from './shop-queries'

export const metadata = { title: 'ลูกค้า · Austone Tire Shop' }

/** หน้าแรกของร้านค้า — รายชื่อลูกค้าภายใต้ร้าน + เพิ่มลูกค้าใหม่ (ค้นหาด้วย ?q=) */
export default async function ShopHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { shop } = await requireSession(SHOP_ADMIN_ROLES)
  const { q } = await searchParams
  const supabase = await createClient()
  const companies = await loadShopCompanies(supabase, q)

  return (
    <>
      <PageHeader
        title="ลูกค้า"
        subtitle={`ลูกค้าที่ ${shop?.name ?? 'ร้าน'} เปลี่ยนยางให้ — เพิ่มชื่อลูกค้าก่อน แล้วค่อยสร้างบัญชีให้ลูกค้าภายหลัง`}
      />
      <ShopCompaniesClient companies={companies} />
    </>
  )
}
