import { CircleDot, GitBranch, LayoutDashboard, ShieldCheck, SlidersHorizontal, Store } from 'lucide-react'
import { AppShell, type NavItem } from '@/components/app-shell'
import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES, canManageAustoneTeam } from '@/lib/roles'

const ICON = 'size-5'

const SUPER_NAV: NavItem[] = [
  { href: '/superadmin',           label: 'ภาพรวมระบบ',      icon: <LayoutDashboard className={ICON} />, exact: true },
  // ลูกค้าของ Austone = ร้านค้า/ดีลเลอร์ — เมนูเดียว ลูกค้าปลายทาง (companies) ดูได้จากในหน้าร้านแต่ละแห่ง
  { href: '/superadmin/shops',     label: 'ร้านค้า/ดีลเลอร์', icon: <Store className={ICON} /> },
  { href: '/superadmin/catalog',   label: 'ข้อมูลยาง',    icon: <CircleDot className={ICON} /> },
  { href: '/superadmin/axle-types', label: 'ประเภทเพลา',      icon: <GitBranch className={ICON} /> },
  { href: '/superadmin/reasons',   label: 'สาเหตุการถอดยาง', icon: <SlidersHorizontal className={ICON} /> },
]

/** Layout ฝั่ง Austone Thailand (super admin) — ออกแบบสำหรับเดสก์ท็อป */
export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSession(AUSTONE_ROLES)
  // เมนู "ผู้ใช้งาน" (บัญชีทีม Austone) เห็นเฉพาะ super admin (คนเดียวที่จัดการบัญชีเซล/แอดมิน Austone ได้)
  const nav = canManageAustoneTeam(profile.role)
    ? [...SUPER_NAV, { href: '/superadmin/team', label: 'ผู้ใช้งาน', icon: <ShieldCheck className={ICON} /> }]
    : SUPER_NAV

  return (
    <AppShell nav={nav} userName={profile.full_name} role={profile.role} companyName="Austone Thailand">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </AppShell>
  )
}
