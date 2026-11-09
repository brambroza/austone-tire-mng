'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { ActionResult, fail, optionalText, zodFail } from '@/lib/action-result'
import { AUSTONE_TEAM_ASSIGNABLE_ROLES, TEAM_MANAGER_ROLES } from '@/lib/roles'

/**
 * จัดการบัญชีทีม Austone (แอดมิน Austone / เซล) — เฉพาะ super admin
 * ทำผ่าน service role เพราะต้องสร้าง auth user และ RLS จำกัดการเขียน profiles ของทีม Austone ไว้ที่ super admin
 */

const roleSchema = z.enum(AUSTONE_TEAM_ASSIGNABLE_ROLES, { message: 'สิทธิ์ไม่ถูกต้อง' })

const createSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัวอักษร'),
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone: optionalText,
  role: roleSchema,
})

const updateSchema = createSchema.pick({ full_name: true, phone: true, role: true })

export type TeamMemberInput = z.input<typeof createSchema>
export type TeamMemberUpdateInput = z.input<typeof updateSchema>

function revalidateTeam() {
  revalidatePath('/superadmin/team')
}

/** service-role client หรือ null เมื่อยังไม่ได้ตั้งค่า */
function adminOrNull() {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

const NO_SERVICE_ROLE = 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงจัดการบัญชีไม่ได้'

/**
 * ตรวจว่าเป้าหมายเป็นบัญชีทีม Austone ที่แก้ไขได้ (ไม่ใช่ super admin และไม่ใช่ตัวเอง)
 * @param admin service-role client
 * @param id รหัสผู้ใช้เป้าหมาย
 * @param selfId รหัสผู้เรียก
 */
async function assertEditableTeamMember(
  admin: NonNullable<ReturnType<typeof adminOrNull>>,
  id: string,
  selfId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'รหัสผู้ใช้ไม่ถูกต้อง' }
  if (id === selfId) return { ok: false, error: 'ไม่สามารถแก้ไขบัญชีของตัวเองจากหน้านี้ได้' }
  const { data, error } = await admin.from('profiles').select('id, role').eq('id', id).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data || !(AUSTONE_TEAM_ASSIGNABLE_ROLES as readonly string[]).includes(data.role)) {
    return { ok: false, error: 'ไม่พบผู้ใช้งานที่ระบุ (บัญชี super admin แก้ไขจากหน้านี้ไม่ได้)' }
  }
  return { ok: true, id: data.id }
}

/**
 * เพิ่มสมาชิกทีม Austone (แอดมิน Austone หรือเซล)
 * @param input ข้อมูลบัญชี
 */
export async function createTeamMember(input: TeamMemberInput): Promise<ActionResult> {
  await requireSession(TEAM_MANAGER_ROLES)
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)
  const admin = adminOrNull()
  if (!admin) return { ok: false, error: NO_SERVICE_ROLE }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !created.user) return fail(authError ?? 'สร้างผู้ใช้ไม่สำเร็จ')

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    company_id: null,
    shop_id: null,
    role: parsed.data.role,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return fail(profileError)
  }

  revalidateTeam()
  return { ok: true }
}

/**
 * แก้ไขชื่อ เบอร์โทร และสิทธิ์ (สลับระหว่างแอดมิน Austone ↔ เซล)
 * @param id รหัสผู้ใช้
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateTeamMember(id: string, input: TeamMemberUpdateInput): Promise<ActionResult> {
  const { userId } = await requireSession(TEAM_MANAGER_ROLES)
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)
  const admin = adminOrNull()
  if (!admin) return { ok: false, error: NO_SERVICE_ROLE }
  const target = await assertEditableTeamMember(admin, id, userId)
  if (!target.ok) return target

  const { error } = await admin.from('profiles').update(parsed.data).eq('id', target.id)
  if (error) return fail(error)
  revalidateTeam()
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานบัญชีทีม Austone
 * @param id รหัสผู้ใช้
 * @param isActive สถานะที่ต้องการ
 */
export async function setTeamMemberActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { userId } = await requireSession(TEAM_MANAGER_ROLES)
  const admin = adminOrNull()
  if (!admin) return { ok: false, error: NO_SERVICE_ROLE }
  const target = await assertEditableTeamMember(admin, id, userId)
  if (!target.ok) return target

  const { error } = await admin.from('profiles').update({ is_active: isActive }).eq('id', target.id)
  if (error) return fail(error)
  revalidateTeam()
  return { ok: true }
}

/**
 * ตั้งรหัสผ่านใหม่ให้สมาชิกทีม Austone
 * @param id รหัสผู้ใช้
 * @param password รหัสผ่านใหม่
 */
export async function resetTeamMemberPassword(id: string, password: string): Promise<ActionResult> {
  const { userId } = await requireSession(TEAM_MANAGER_ROLES)
  if (password.length < 6) return { ok: false, error: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร' }
  const admin = adminOrNull()
  if (!admin) return { ok: false, error: NO_SERVICE_ROLE }
  const target = await assertEditableTeamMember(admin, id, userId)
  if (!target.ok) return target

  const { error } = await admin.auth.admin.updateUserById(target.id, { password })
  if (error) return fail(error)
  return { ok: true }
}

/**
 * ลบบัญชีทีม Austone ถาวร
 * @param id รหัสผู้ใช้
 */
export async function deleteTeamMember(id: string): Promise<ActionResult> {
  const { userId } = await requireSession(TEAM_MANAGER_ROLES)
  const admin = adminOrNull()
  if (!admin) return { ok: false, error: NO_SERVICE_ROLE }
  const target = await assertEditableTeamMember(admin, id, userId)
  if (!target.ok) return target

  const { error } = await admin.auth.admin.deleteUser(target.id)
  if (error) return fail(error)
  revalidateTeam()
  return { ok: true }
}
