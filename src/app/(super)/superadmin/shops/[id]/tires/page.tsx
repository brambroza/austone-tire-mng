import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { TireAccessClient, type AccessModel } from '@/app/(super)/superadmin/companies/[id]/tire-access-client'
import { setShopTireModels } from '@/app/(super)/superadmin/actions'
import type { Shop } from '@/lib/database.types'

export const metadata = { title: 'รุ่นยางที่กำหนดให้ร้าน · Austone Tire Admin' }

interface ModelRow {
  id: string
  name: string
  size: string | null
  pattern_code: string | null
  tire_brands: { name: string; is_active: boolean } | null
}

/**
 * Austone กำหนดรุ่นยางที่ร้าน (dealer) แต่ละแห่งใส่ให้ลูกค้าได้ — เลือกได้ทุกยี่ห้อในแคตตาล็อกกลาง
 * (จัดกลุ่มตามยี่ห้อ เลือกทั้งยี่ห้อได้ในคลิกเดียว)
 */
export default async function ShopTiresPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const { data: shopData } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
  if (!shopData) notFound()
  const shop = shopData as Shop

  const [{ data: modelData }, { data: grantData }, { data: brandData }] = await Promise.all([
    supabase
      .from('tire_models')
      .select('id, name, size, pattern_code, tire_brands(name, is_active)')
      .is('created_by_company', null)
      .eq('is_active', true)
      .order('name'),
    supabase.from('shop_tire_models').select('tire_model_id').eq('shop_id', id),
    // ยี่ห้อทั้งหมดในแคตตาล็อกกลาง — ให้เห็นยี่ห้อที่ยังไม่มีรุ่นด้วย จะได้รู้ว่าต้องไปเพิ่มรุ่นก่อน
    supabase.from('tire_brands').select('name').is('created_by_company', null).eq('is_active', true).order('name'),
  ])

  // รุ่นของยี่ห้อที่ปิดใช้งานไม่ให้ติ๊ก — หน้าบันทึกถอด-ใส่ซ่อนรุ่นเหล่านั้นอยู่แล้ว จะได้ไม่สับสนว่ากำหนดแล้วทำไมไม่ขึ้น
  const models: AccessModel[] = ((modelData ?? []) as unknown as ModelRow[])
    .filter((m) => m.tire_brands?.is_active !== false)
    .map((m) => ({
      id: m.id,
      brand: m.tire_brands?.name ?? 'ไม่ระบุยี่ห้อ',
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
        allBrands={(brandData ?? []).map((b) => b.name)}
        title="สิทธิ์ยาง — รุ่นที่ร้านใส่ให้ลูกค้าได้"
        description="ติ๊กรุ่น (ทุกยี่ห้อ) ที่อนุญาตให้ร้านนี้ใส่ให้ลูกค้า — รุ่นที่เพิ่มจะเปิดสิทธิ์ให้ลูกค้าทุกรายของร้านอัตโนมัติ"
        emptyText="ยังไม่มีรุ่นยางในแคตตาล็อกกลาง — เพิ่มได้ที่เมนู “ข้อมูลยาง”"
      />
    </>
  )
}
