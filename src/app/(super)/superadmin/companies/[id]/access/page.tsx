import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES, canEditCentral } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { TireAccessClient, type AccessModel } from '../tire-access-client'

export const metadata = { title: 'สิทธิ์การมองเห็นยาง · Austone Tire Admin' }

interface ModelRow {
  id: string
  name: string
  size: string | null
  pattern_code: string | null
  tire_brands: { name: string; is_active: boolean } | null
}

/** แท็บกำหนดว่าลูกค้ารายนี้เห็นยางรุ่นใดในแคตตาล็อกกลางได้บ้าง */
export default async function CompanyAccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { profile } = await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const [{ data: modelData }, { data: accessData }] = await Promise.all([
    supabase
      .from('tire_models')
      .select('id, name, size, pattern_code, tire_brands(name, is_active)')
      .is('created_by_company', null)
      .eq('is_active', true)
      .order('name'),
    supabase.from('company_tire_models').select('tire_model_id').eq('company_id', id),
  ])

  // รุ่นของยี่ห้อที่ปิดใช้งานไม่ให้ติ๊ก — หน้าบันทึกถอด-ใส่ซ่อนรุ่นเหล่านั้นอยู่แล้ว
  const models: AccessModel[] = ((modelData ?? []) as unknown as ModelRow[])
    .filter((m) => m.tire_brands?.is_active !== false)
    .map((m) => ({
    id: m.id,
    brand: m.tire_brands?.name ?? 'ไม่ระบุยี่ห้อ',
    model: m.name,
    size: m.size,
    pattern_code: m.pattern_code,
  }))

  return (
    <TireAccessClient
      readOnly={!canEditCentral(profile.role)}
      companyId={id}
      models={models}
      allowed={(accessData ?? []).map((a) => a.tire_model_id)}
    />
  )
}
