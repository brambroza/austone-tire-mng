import { requireSession } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { ShopStaffClient, type ShopStaffRow } from './shop-staff-client'
import type { Profile } from '@/lib/database.types'

export const metadata = { title: 'ช่างของร้าน · Austone Tire Shop' }

/**
 * หน้าจัดการช่าง/พนักงานของร้าน — RLS ให้พนักงานร้านเห็นเพื่อนร่วมร้านอยู่แล้ว
 * อีเมลเข้าระบบอยู่ใน auth.users จึงดึงผ่าน service role (ถ้าตั้งค่าไว้) เพื่อให้ร้านบอกช่างได้ว่าใช้อีเมลไหน
 */
export default async function ShopStaffPage() {
  const { userId, shop, profile } = await requireSession(['shop'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('shop_id', profile.shop_id ?? '')
    .order('full_name')
  const members = (data ?? []) as Profile[]

  const emails = new Map<string, string | null>()
  try {
    const admin = createAdminClient()
    await Promise.all(members.map(async (m) => {
      const { data: u } = await admin.auth.admin.getUserById(m.id)
      emails.set(m.id, u.user?.email ?? null)
    }))
  } catch {
    // ไม่มี service role → ไม่แสดงคอลัมน์อีเมล
  }

  const rows: ShopStaffRow[] = members.map((m) => ({
    ...m,
    email: emails.size > 0 ? emails.get(m.id) ?? null : undefined,
  }))

  return (
    <>
      <PageHeader
        title="ช่างของร้าน"
        subtitle={`บัญชีเข้าระบบของ ${shop?.name ?? 'ร้าน'} — เพิ่มช่างใหม่ ตั้งรหัสผ่าน หรือปิดการใช้งานได้ที่นี่`}
      />
      <ShopStaffClient members={rows} currentUserId={userId} />
    </>
  )
}
