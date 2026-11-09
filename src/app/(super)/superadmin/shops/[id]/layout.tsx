import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { Badge } from '@/components/ui'
import { ShopTabs } from './shop-tabs'
import type { Shop } from '@/lib/database.types'

/**
 * โครงหน้าจัดการร้านค้า/ดีลเลอร์ 1 ราย — หัวข้อร้าน + แท็บย่อย
 * (ภาพรวม / ลูกค้าของร้าน / คลังยาง / สิทธิ์ยาง / ผู้ใช้งาน) แบบเดียวกับหน้าลูกค้าปลายทาง
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const shop = data as Shop

  return (
    <>
      <Link href="/superadmin/shops" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="size-4" />
        กลับไปร้านค้า/ดีลเลอร์
      </Link>

      <PageHeader
        title={shop.name}
        subtitle={[shop.code, shop.contact_name, shop.phone].filter(Boolean).join(' · ')}
        action={<Badge tone={shop.is_active ? 'emerald' : 'slate'}>{shop.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge>}
      />

      <ShopTabs shopId={id} />

      {children}
    </>
  )
}
