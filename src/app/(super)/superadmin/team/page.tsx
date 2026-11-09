import { requireSession } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { AUSTONE_ROLES, TEAM_MANAGER_ROLES } from '@/lib/roles'
import { TeamClient, type TeamRow } from './team-client'
import type { Profile } from '@/lib/database.types'

export const metadata = { title: 'ผู้ใช้งาน · Austone Tire Admin' }

/**
 * หน้าจัดการบัญชีทีม Austone — เฉพาะ super admin
 * แสดงทุก role ของทีม (รวม super admin เพื่อให้เห็นภาพรวม) แต่แก้ไขได้เฉพาะแอดมิน Austone / เซล
 */
export default async function TeamPage() {
  const { userId } = await requireSession(TEAM_MANAGER_ROLES)
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .in('role', AUSTONE_ROLES)
    .order('role')
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
    // ไม่มี service role → ไม่แสดงอีเมล
  }

  const rows: TeamRow[] = members.map((m) => ({ ...m, email: emails.size > 0 ? emails.get(m.id) ?? null : undefined }))

  return (
    <>
      <PageHeader
        title="ผู้ใช้งาน"
        subtitle="บัญชีแอดมินและเซล — แอดมินทำได้ทุกอย่างยกเว้นหน้านี้ · เซลดูได้ทุกหน้าและจัดการร้านค้า/ดีลเลอร์"
      />
      <TeamClient members={rows} currentUserId={userId} />
    </>
  )
}
