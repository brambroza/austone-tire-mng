import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** ออกจากระบบแล้วกลับไปหน้า login */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}

/**
 * ออกจากระบบแบบ redirect (ใช้เมื่อ auth user ยังอยู่แต่ profile ถูกปิดใช้งาน/ร้านถูกปิด)
 * กันลูป /login ↔ / เพราะ middleware เห็นว่ายัง login อยู่ · ส่ง ?reason= ต่อไปให้หน้า login แสดงข้อความ
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL('/login', request.url)
  const reason = request.nextUrl.searchParams.get('reason')
  if (reason === 'inactive') url.searchParams.set('reason', reason)
  return NextResponse.redirect(url, { status: 303 })
}
