import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { ShopUsersClient } from '../shop-users-client'
import type { Profile } from '@/lib/database.types'

export const metadata = { title: 'ผู้ใช้งานร้าน · Austone Tire Admin' }

/** แท็บผู้ใช้งานของร้าน — บัญชีพนักงาน/ช่างของร้าน (role shop) · ร้านเพิ่มเองได้ที่เมนู "ช่างของร้าน" ด้วย */
export default async function ShopUsersPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(AUSTONE_ROLES)
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('profiles').select('*').eq('shop_id', id).order('full_name')

  return <ShopUsersClient shopId={id} users={(data ?? []) as Profile[]} />
}
