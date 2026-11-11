import { requireSession, type SessionContext } from '@/lib/auth'
import { AUSTONE_WRITE_ROLES, SHOP_ROLES, canEditCentral, isShopStaff } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { UserRole } from '@/lib/database.types'

type ScopeResult =
  | { ok: true; session: SessionContext; companyId: string }
  | (ActionResult<never> & { ok: false })

/**
 * ตรวจว่าบริษัทที่ระบุอยู่ภายใต้ร้านค้าของผู้ใช้ปัจจุบันจริง
 * (RLS กันไว้อีกชั้น แต่ตรวจที่นี่เพื่อให้ข้อความผิดพลาดชัดเจน)
 * @param session session ของพนักงานร้านค้า
 * @param companyId บริษัทเป้าหมาย
 */
async function assertCompanyInShop(session: SessionContext, companyId: string): Promise<ScopeResult> {
  if (!session.profile.shop_id || !session.shop) {
    return { ok: false, error: 'บัญชีนี้ยังไม่ได้ผูกกับร้านค้า' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, shop_id, is_active')
    .eq('id', companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data || data.shop_id !== session.profile.shop_id) {
    return { ok: false, error: 'ไม่พบลูกค้ารายนี้ภายใต้ร้านค้าของคุณ' }
  }
  if (!data.is_active) return { ok: false, error: 'ลูกค้ารายนี้ถูกปิดใช้งานแล้ว' }
  return { ok: true, session, companyId }
}

/**
 * ตรวจสิทธิ์แล้วหาว่า action นี้ทำงานกับบริษัทไหน
 *
 * - แอดมิน/ช่างของลูกค้า → ทำได้เฉพาะบริษัทตัวเอง (ค่า companyId ที่ส่งมาถูกละเว้น)
 * - super admin → ต้องระบุ companyId เสมอ เพราะไม่ได้สังกัดบริษัทใด
 * - ร้านค้า (แอดมินร้าน/ช่างร้าน เมื่ออยู่ใน allowed) → ต้องระบุ companyId และบริษัทนั้นต้องอยู่ภายใต้ร้าน
 *
 * @param allowed role ที่เข้าถึง action นี้ได้ (super_admin จะถูกเติมให้อัตโนมัติ)
 * @param companyId บริษัทเป้าหมาย ใช้กรณี super admin และร้านค้า
 */
export async function resolveCompanyScope(
  allowed: UserRole[],
  companyId?: string,
): Promise<ScopeResult> {
  const session = await requireSession([...allowed, ...AUSTONE_WRITE_ROLES])

  if (canEditCentral(session.profile.role)) {
    if (!companyId) {
      return { ok: false, error: 'กรุณาระบุบริษัทที่ต้องการจัดการ' }
    }
    return { ok: true, session, companyId }
  }

  if (isShopStaff(session.profile.role)) {
    if (!companyId) return { ok: false, error: 'กรุณาเลือกลูกค้าก่อน' }
    return assertCompanyInShop(session, companyId)
  }

  if (!session.profile.company_id) {
    return { ok: false, error: 'บัญชีนี้ยังไม่ได้ผูกกับบริษัท' }
  }

  return { ok: true, session, companyId: session.profile.company_id }
}

/**
 * ขอบเขตของงานหน้าช่าง (บันทึกถอด-ใส่ยาง)
 *
 * - แอดมิน/ช่าง → บริษัทตัวเอง
 * - ร้านค้า (แอดมินร้านและช่างร้าน) → ลูกค้าที่เลือก (ต้องอยู่ภายใต้ร้าน) และเปิดกฎร้านค้า:
 *   ใส่ได้เฉพาะยาง AUSTONE, ถอดยางที่ไม่ทราบซีรีย์ได้
 *
 * super admin ไม่บันทึกงานหน้างานแทนลูกค้า (เหมือนเดิม)
 * @param companyId ลูกค้าที่ร้านค้าเลือก (แอดมิน/ช่างไม่ต้องส่ง)
 */
export async function resolveServiceScope(
  companyId?: string,
): Promise<ScopeResult & ({ ok: true; isShop: boolean } | { ok: false })> {
  const session = await requireSession(['admin', 'technician', ...SHOP_ROLES])

  if (isShopStaff(session.profile.role)) {
    if (!companyId) return { ok: false, error: 'กรุณาเลือกลูกค้าก่อนบันทึกงาน' }
    const scope = await assertCompanyInShop(session, companyId)
    return scope.ok ? { ...scope, isShop: true } : scope
  }

  if (!session.profile.company_id) {
    return { ok: false, error: 'บัญชีนี้ยังไม่ได้ผูกกับบริษัท' }
  }
  return { ok: true, session, companyId: session.profile.company_id, isShop: false }
}
