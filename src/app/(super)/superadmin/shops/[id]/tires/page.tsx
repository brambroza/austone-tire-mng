import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { SHOP_MOUNT_BRAND, isShopMountBrand } from '@/lib/shop-rules'
import { TireAccessClient, type AccessModel } from '@/app/(super)/superadmin/companies/[id]/tire-access-client'
import { setShopTireModels } from '@/app/(super)/superadmin/actions'
import type { Shop } from '@/lib/database.types'

export const metadata = { title: 'รุ่นยางที่กำหนดให้ร้าน · Austone Tire Admin' }

interface ModelRow {
  id: string
  name: string
  size: string | null
  pattern_code: string | null
  tire_brands: { name: string } | null
}

/**
 * Austone กำหนดรุ่นยางที่ร้าน (dealer) แต่ละแห่งใส่ให้ลูกค้าได้ — เลือกได้เฉพาะรุ่นกลางยี่ห้อ AUSTONE
 * (กฎยี่ห้ออยู่ที่ `isShopMountBrand` ทั้งฝั่งหน้าและ action)
 */
export default async function ShopTiresPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const { data: shopData } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
  if (!shopData) notFound()
  const shop = shopData as Shop

  const [{ data: modelData }, { data: grantData }] = await Promise.all([
    supabase
      .from('tire_models')
      .select('id, name, size, pattern_code, tire_brands(name)')
      .is('created_by_company', null)
      .eq('is_active', true)
      .order('name'),
    supabase.from('shop_tire_models').select('tire_model_id').eq('shop_id', id),
  ])

  const models: AccessModel[] = ((modelData ?? []) as unknown as ModelRow[])
    .filter((m) => isShopMountBrand(m.tire_brands?.name))
    .map((m) => ({
      id: m.id,
      brand: m.tire_brands?.name ?? SHOP_MOUNT_BRAND,
      model: m.name,
      size: m.size,
      pattern_code: m.pattern_code,
    }))

  const save = setShopTireModels.bind(null, shop.id)

  return (
    <>
      <TireAccessClient
        companyId={shop.id}
        models={models}
        allowed={(grantData ?? []).map((g) => g.tire_model_id)}
        save={save}
        title={`สิทธิ์ยาง — รุ่น ${SHOP_MOUNT_BRAND} ที่ร้านใส่ให้ลูกค้าได้`}
        description="ติ๊กรุ่นที่อนุญาตให้ร้านนี้ใส่ให้ลูกค้า — รุ่นที่เพิ่มจะเปิดสิทธิ์ให้ลูกค้าทุกรายของร้านอัตโนมัติ"
        emptyText={`ยังไม่มีรุ่น ${SHOP_MOUNT_BRAND} ในแคตตาล็อกกลาง — เพิ่มได้ที่เมนู “ข้อมูลยาง”`}
      />
    </>
  )
}
