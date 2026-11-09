'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession, type SessionContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { ActionResult, fail, optionalText, zodFail } from '@/lib/action-result'

/**
 * ร้านค้าจัดการบัญชีช่าง/พนักงานของร้านตัวเอง (role = 'shop' ทุกคน)
 *
 * RLS ไม่เปิดให้บัญชีร้านเขียนตาราง profiles โดยตรง จึงทำผ่าน service role
 * และตรวจเองทุกครั้งว่าเป้าหมายอยู่ร้านเดียวกับผู้เรียก (`assertSameShop`)
 * พนักงานร้านทุกคนจัดการบัญชีร้านได้เท่ากัน — ถ้าต้องแยก "หัวหน้าร้าน" ต้องเพิ่ม role ภายหลัง
 */

const createSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัวอักษร'),
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone: optionalText,
  employee_no: optionalText,
})

const updateSchema = createSchema.pick({ full_name: true, phone: true, employee_no: true })

export type ShopStaffInput = z.input<typeof createSchema>
export type ShopStaffUpdateInput = z.input<typeof updateSchema>

function revalidateStaff() {
  revalidatePath('/shop/staff')
}

/** session ของพนักงานร้านพร้อม shop_id ที่ยืนยันแล้ว */
async function requireShopSession(): Promise<
  | { ok: true; session: SessionContext; shopId: string }
  | { ok: false; error: string }
> {
  const session = await requireSession(['shop'])
  if (!session.profile.shop_id || !session.shop) return { ok: false, error: 'บัญชีนี้ยังไม่ได้ผูกกับร้านค้า' }
  return { ok: true, session, shopId: session.profile.shop_id }
}

/** service-role client หรือข้อความแจ้งเมื่อยังไม่ได้ตั้งค่า */
function adminOrError(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

/**
 * ตรวจว่าบัญชีเป้าหมายเป็นพนักงานของร้านเดียวกัน
 * @param admin service-role client
 * @param id รหัสผู้ใช้เป้าหมาย
 * @param shopId ร้านของผู้เรียก
 */
async function assertSameShop(
  admin: NonNullable<ReturnType<typeof adminOrError>>,
  id: string,
  shopId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const parsedId = z.string().uuid('รหัสผู้ใช้ไม่ถูกต้อง').safeParse(id)
  if (!parsedId.success) return { ok: false, error: 'รหัสผู้ใช้ไม่ถูกต้อง' }
  const { data, error } = await admin
    .from('profiles')
    .select('id, role, shop_id')
    .eq('id', parsedId.data)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data || data.role !== 'shop' || data.shop_id !== shopId) {
    return { ok: false, error: 'ไม่พบบัญชีนี้ในร้านของคุณ' }
  }
  return { ok: true, id: data.id }
}

/**
 * เพิ่มช่าง/พนักงานร้านใหม่ — สร้าง auth user แล้วผูก profile กับร้านของผู้เรียก
 * @param input ข้อมูลบัญชี
 */
export async function createShopStaff(input: ShopStaffInput): Promise<ActionResult> {
  const scope = await requireShopSession()
  if (!scope.ok) return scope
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const admin = adminOrError()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงสร้างบัญชีไม่ได้' }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !created.user) return fail(authError ?? 'สร้างผู้ใช้ไม่สำเร็จ')

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    company_id: null,
    shop_id: scope.shopId,
    role: 'shop',
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    employee_no: parsed.data.employee_no,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return fail(profileError)
  }

  revalidateStaff()
  return { ok: true }
}

/**
 * แก้ไขชื่อ เบอร์โทร รหัสพนักงาน ของพนักงานร้าน
 * @param id รหัสผู้ใช้
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateShopStaff(id: string, input: ShopStaffUpdateInput): Promise<ActionResult> {
  const scope = await requireShopSession()
  if (!scope.ok) return scope
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const admin = adminOrError()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงแก้ไขไม่ได้' }
  const target = await assertSameShop(admin, id, scope.shopId)
  if (!target.ok) return target

  const { error } = await admin.from('profiles').update(parsed.data).eq('id', target.id)
  if (error) return fail(error)

  revalidateStaff()
  return { ok: true }
}

/**
 * เปิด/ปิดการใช้งานบัญชีพนักงานร้าน (ปิดตัวเองไม่ได้)
 * @param id รหัสผู้ใช้
 * @param isActive สถานะที่ต้องการ
 */
export async function setShopStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  const scope = await requireShopSession()
  if (!scope.ok) return scope
  if (id === scope.session.userId) return { ok: false, error: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' }

  const admin = adminOrError()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงแก้ไขไม่ได้' }
  const target = await assertSameShop(admin, id, scope.shopId)
  if (!target.ok) return target

  const { error } = await admin.from('profiles').update({ is_active: isActive }).eq('id', target.id)
  if (error) return fail(error)

  revalidateStaff()
  return { ok: true }
}

/**
 * ตั้งรหัสผ่านใหม่ให้พนักงานร้าน
 * @param id รหัสผู้ใช้
 * @param password รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
 */
export async function resetShopStaffPassword(id: string, password: string): Promise<ActionResult> {
  const scope = await requireShopSession()
  if (!scope.ok) return scope
  if (password.length < 6) return { ok: false, error: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร' }

  const admin = adminOrError()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงรีเซ็ตรหัสผ่านไม่ได้' }
  const target = await assertSameShop(admin, id, scope.shopId)
  if (!target.ok) return target

  const { error } = await admin.auth.admin.updateUserById(target.id, { password })
  if (error) return fail(error)
  return { ok: true }
}

/**
 * ลบบัญชีพนักงานร้านถาวร (ลบ auth user → profile ถูกลบตาม FK)
 * ประวัติที่เคยบันทึกยังอยู่ แต่ช่อง "ผู้บันทึก" จะว่าง — แนะนำใช้ "ปิดใช้งาน" แทน
 * @param id รหัสผู้ใช้
 */
export async function deleteShopStaff(id: string): Promise<ActionResult> {
  const scope = await requireShopSession()
  if (!scope.ok) return scope
  if (id === scope.session.userId) return { ok: false, error: 'ไม่สามารถลบบัญชีของตัวเองได้' }

  const admin = adminOrError()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY จึงลบบัญชีไม่ได้' }
  const target = await assertSameShop(admin, id, scope.shopId)
  if (!target.ok) return target

  const { error } = await admin.auth.admin.deleteUser(target.id)
  if (error) return fail(error)

  revalidateStaff()
  return { ok: true }
}
