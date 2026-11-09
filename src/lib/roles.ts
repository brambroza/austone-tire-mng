/**
 * สิทธิ์ตาม role — ไม่พึ่ง framework เพื่อให้ทดสอบด้วย node --test ได้
 *
 * ทีม Austone (migration 024/025):
 *   super_admin   ทุกอย่าง + จัดการบัญชีทีม Austone
 *   austone_admin ทุกอย่างเหมือน super_admin ยกเว้นจัดการบัญชีทีม Austone
 *   sales         ดูได้ทุกหน้าของ Austone + จัดการร้านค้า/ดีลเลอร์ (สร้าง/แก้ร้าน กำหนดรุ่นยาง บัญชีร้าน)
 * ฝั่ง DB: is_super_admin() = super_admin + austone_admin · is_austone_staff() = รวม sales
 */

import type { UserRole } from '@/lib/database.types'

/** ทุก role ของทีม Austone — เข้าหน้า /superadmin ได้ (อย่างน้อยอ่าน) */
export const AUSTONE_ROLES: UserRole[] = ['super_admin', 'austone_admin', 'sales']

/** role ที่แก้ข้อมูลกลางได้ (แคตตาล็อก เพลา สาเหตุ ลูกค้าปลายทาง แพ็กเกจ) */
export const AUSTONE_WRITE_ROLES: UserRole[] = ['super_admin', 'austone_admin']

/** role ที่จัดการร้านค้า/ดีลเลอร์ได้ (รวมเซล) */
export const DEALER_MANAGER_ROLES: UserRole[] = ['super_admin', 'austone_admin', 'sales']

/** role ที่จัดการบัญชีทีม Austone ได้ */
export const TEAM_MANAGER_ROLES: UserRole[] = ['super_admin']

/** role ของทีม Austone ที่ super admin สร้างให้ได้จากหน้า "ผู้ใช้งาน" */
export const AUSTONE_TEAM_ASSIGNABLE_ROLES = ['austone_admin', 'sales'] as const
export type AustoneTeamRole = (typeof AUSTONE_TEAM_ASSIGNABLE_ROLES)[number]

/** ชื่อ role ภาษาไทย */
export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  austone_admin: 'แอดมิน',
  sales: 'เซล',
  admin: 'แอดมินบริษัท',
  technician: 'ช่าง',
  shop: 'ร้านค้า',
}

/** เป็นทีม Austone (เข้าหน้า /superadmin ได้) */
export function isAustoneStaff(role: UserRole): boolean {
  return AUSTONE_ROLES.includes(role)
}

/** แก้ข้อมูลกลาง/ลูกค้าปลายทางได้ */
export function canEditCentral(role: UserRole): boolean {
  return AUSTONE_WRITE_ROLES.includes(role)
}

/** จัดการร้านค้า/ดีลเลอร์ได้ */
export function canManageDealers(role: UserRole): boolean {
  return DEALER_MANAGER_ROLES.includes(role)
}

/** จัดการบัญชีทีม Austone ได้ */
export function canManageAustoneTeam(role: UserRole): boolean {
  return TEAM_MANAGER_ROLES.includes(role)
}
