import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Company, Profile, Shop, UserRole } from '@/lib/database.types'

export interface SessionContext {
  userId: string
  email: string | null
  profile: Profile
  company: Company | null
  /** ร้านค้าที่สังกัด — มีค่าเฉพาะบัญชีร้านค้า (role = 'shop' / 'shop_technician') */
  shop: Shop | null
}

/**
 * อ่าน session + profile + company ของผู้ใช้ปัจจุบัน
 * @returns null ถ้ายังไม่ได้ login หรือ profile ถูกปิดใช้งาน
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) return null

  let company: Company | null = null
  if (profile.company_id) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()
    company = data
  }

  let shop: Shop | null = null
  if (profile.shop_id) {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('id', profile.shop_id)
      .single()
    shop = data
    // ร้านค้าที่ถูกปิดใช้งาน = พนักงานร้านเข้าระบบไม่ได้
    if (!shop || !shop.is_active) return null
  }

  return { userId: user.id, email: user.email ?? null, profile, company, shop }
})

/**
 * ส่งผู้ใช้ที่ไม่มี session ไปหน้า login
 * ถ้ายังมี auth user อยู่ (profile ถูกปิดใช้งาน / ร้านถูกปิด / ไม่มี profile) ต้อง sign out ก่อน
 * ไม่งั้น middleware จะเด้งจาก /login กลับมา / วนไม่รู้จบ
 */
export async function redirectToLogin(): Promise<never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/auth/signout?reason=inactive' : '/login')
}

/**
 * บังคับให้ต้อง login และ (ถ้าระบุ) ต้องมี role ที่อนุญาต
 * @param allowed รายการ role ที่เข้าถึงหน้านี้ได้
 */
export async function requireSession(allowed?: UserRole[]): Promise<SessionContext> {
  const session = await getSession()
  if (!session) await redirectToLogin()
  if (allowed && !allowed.includes(session!.profile.role)) redirect('/')
  return session!
}

/** หน้าแรกเริ่มต้นของแต่ละ role */
export function homePathFor(role: UserRole): string {
  switch (role) {
    case 'super_admin':
    case 'austone_admin':
    case 'sales':       return '/superadmin'
    case 'admin':       return '/dashboard'
    case 'technician':  return '/service'
    case 'shop':        return '/shop'
    case 'shop_technician': return '/shop/service'
  }
}
