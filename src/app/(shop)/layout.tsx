import { BarChart3, Building2, Users, Wrench } from 'lucide-react'
import { AppShell, type NavItem } from '@/components/app-shell'
import { requireSession } from '@/lib/auth'
import { SHOP_ROLES, isShopAdmin } from '@/lib/roles'

const ICON = 'size-5'

/** เมนูของแอดมินร้าน (ทุกหน้า) */
const SHOP_ADMIN_NAV: NavItem[] = [
  { href: '/shop',         label: 'ลูกค้า',        icon: <Building2 className={ICON} />, exact: true },
  { href: '/shop/service', label: 'บันทึกถอด-ใส่ยาง',    icon: <Wrench className={ICON} /> },
  { href: '/shop/reports', label: 'รายงานการเปลี่ยนยาง', icon: <BarChart3 className={ICON} /> },
  { href: '/shop/staff',   label: 'ช่างของร้าน',         icon: <Users className={ICON} /> },
]

/** เมนูของช่างร้าน — บันทึกถอด-ใส่ยางอย่างเดียว */
const SHOP_TECHNICIAN_NAV: NavItem[] = SHOP_ADMIN_NAV.filter((item) => item.href === '/shop/service')

/**
 * Layout ฝั่งร้านค้า (shop) — ร้านเปลี่ยนยางให้ลูกค้าหลายราย
 * แอดมินร้าน: เพิ่มลูกค้า, บันทึกถอด-ใส่ยาง, ดูรายงานต่อลูกค้า, จัดการบัญชีช่างของร้านเอง
 * ช่างร้าน: บันทึกถอด-ใส่ยางให้รถที่เข้าร้านเท่านั้น (หน้าอื่นเด้งกลับหน้าบันทึกงาน)
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { profile, shop } = await requireSession(SHOP_ROLES)

  return (
    <AppShell
      nav={isShopAdmin(profile.role) ? SHOP_ADMIN_NAV : SHOP_TECHNICIAN_NAV}
      userName={profile.full_name}
      role={profile.role}
      companyName={shop?.name ?? 'ร้านค้า'}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </AppShell>
  )
}
