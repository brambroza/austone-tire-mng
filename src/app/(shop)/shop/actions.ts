'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { resolveCompanyScope } from '@/lib/company-scope'
import { createClient } from '@/lib/supabase/server'
import { ActionResult, fail, optionalText, zodFail } from '@/lib/action-result'
import { createTeamMember, type CreateUserInput } from '@/app/(app)/technicians/actions'
import { generatePublicToken } from '@/lib/public-link'

/** ข้อมูลลูกค้าที่ร้านค้ากรอก — บังคับแค่ชื่อ ที่เหลือเติมภายหลังได้ */
const shopCompanySchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อลูกค้า').max(200, 'ชื่อลูกค้ายาวเกินไป'),
  contact_name: optionalText,
  phone: optionalText,
  tax_id: optionalText,
  address: optionalText,
})

export type ShopCompanyInput = z.input<typeof shopCompanySchema>

function revalidateShop(companyId?: string) {
  revalidatePath('/shop')
  revalidatePath('/shop/service')
  revalidatePath('/shop/reports')
  if (companyId) revalidatePath(`/shop/companies/${companyId}`)
}

/**
 * ร้านค้าเพิ่มลูกค้าภายใต้ร้าน — ยังไม่มีบัญชีผู้ใช้ สร้างภายหลังได้จากหน้ารายละเอียดลูกค้า
 * ทำผ่าน RPC `shop_create_company` ซึ่งเปิดสิทธิ์เพลาทุกแบบและรุ่น AUSTONE ให้ลูกค้าใหม่ด้วย
 * @param input ข้อมูลลูกค้า
 */
export async function createShopCompany(input: ShopCompanyInput): Promise<ActionResult<{ id: string }>> {
  await requireSession(['shop'])
  const parsed = shopCompanySchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('shop_create_company', {
    p_name: parsed.data.name,
    p_contact_name: parsed.data.contact_name,
    p_phone: parsed.data.phone,
    p_tax_id: parsed.data.tax_id,
    p_address: parsed.data.address,
  })
  if (error) return fail(error)

  revalidateShop()
  return { ok: true, data: { id: data } }
}

/**
 * แก้ข้อมูลติดต่อของลูกค้าภายใต้ร้าน (RLS กันไม่ให้แก้ลูกค้าของร้านอื่น)
 * @param companyId ลูกค้าเป้าหมาย
 * @param input ข้อมูลที่แก้ไข
 */
export async function updateShopCompany(companyId: string, input: ShopCompanyInput): Promise<ActionResult> {
  const scope = await resolveCompanyScope(['shop'], companyId)
  if (!scope.ok) return scope
  const parsed = shopCompanySchema.safeParse(input)
  if (!parsed.success) return zodFail(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.from('companies').update(parsed.data).eq('id', scope.companyId)
  if (error) return fail(error)

  revalidateShop(scope.companyId)
  return { ok: true }
}

/**
 * ร้านค้าสร้างบัญชีให้ลูกค้า (แอดมิน/ช่าง) เมื่อลูกค้าพร้อมเข้าใช้ระบบเอง
 * ใช้ตัวสร้างบัญชีชุดเดียวกับแอดมินลูกค้า — สิทธิ์ตรวจซ้ำใน resolveCompanyScope ว่าลูกค้าอยู่ภายใต้ร้านจริง
 * @param companyId ลูกค้าเป้าหมาย
 * @param input ข้อมูลบัญชี
 */
export async function createShopCompanyUser(companyId: string, input: CreateUserInput): Promise<ActionResult> {
  await requireSession(['shop'])
  const result = await createTeamMember(input, companyId)
  if (result.ok) revalidateShop(companyId)
  return result
}

/* ------------------------------------------------ ลิงก์ส่วนตัวให้ลูกค้า (migration 022) */

/**
 * สร้าง/สุ่มลิงก์ส่วนตัวใหม่ให้ลูกค้า — ลูกค้าเปิด /p/<token> ดูประวัติถอด-ใส่ยางของตัวเองได้โดยไม่ต้อง login
 * สุ่มใหม่ทุกครั้งที่เรียก = ลิงก์เก่าใช้ไม่ได้ทันที (ใช้เมื่อลิงก์หลุดไปถึงคนนอก)
 * @param companyId ลูกค้าเป้าหมาย (ต้องอยู่ภายใต้ร้าน)
 */
export async function rotateCompanyPublicLink(companyId: string): Promise<ActionResult<{ token: string }>> {
  const scope = await resolveCompanyScope(['shop'], companyId)
  if (!scope.ok) return scope

  const token = generatePublicToken()
  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({ public_token: token, public_token_created_at: new Date().toISOString() })
    .eq('id', scope.companyId)
  if (error) return fail(error)

  revalidateShop(scope.companyId)
  return { ok: true, data: { token } }
}

/**
 * ปิดลิงก์ส่วนตัวของลูกค้า — ลิงก์ที่ส่งไปแล้วจะเปิดไม่ได้จนกว่าจะสร้างใหม่
 * @param companyId ลูกค้าเป้าหมาย (ต้องอยู่ภายใต้ร้าน)
 */
export async function revokeCompanyPublicLink(companyId: string): Promise<ActionResult> {
  const scope = await resolveCompanyScope(['shop'], companyId)
  if (!scope.ok) return scope

  const supabase = await createClient()
  const { error } = await supabase
    .from('companies')
    .update({ public_token: null, public_token_created_at: null })
    .eq('id', scope.companyId)
  if (error) return fail(error)

  revalidateShop(scope.companyId)
  return { ok: true }
}
