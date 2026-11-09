import { redirect } from 'next/navigation'
import { getSession, homePathFor, redirectToLogin } from '@/lib/auth'

/** หน้าแรก — ส่งผู้ใช้ไปยังหน้าเริ่มต้นตาม role (ไม่มี session = ไป login, sign out ก่อนถ้าบัญชีถูกปิด) */
export default async function RootPage() {
  const session = await getSession()
  if (!session) await redirectToLogin()
  redirect(homePathFor(session!.profile.role))
}
