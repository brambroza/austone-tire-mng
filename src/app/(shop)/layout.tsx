import { BarChart3, Building2, Users, Wrench } from 'lucide-react'
import { AppShell, type NavItem } from '@/components/app-shell'
import { requireSession } from '@/lib/auth'

const ICON = 'size-5'

const SHOP_NAV: NavItem[] = [
  { href: '/shop',         label: 'ลูกค้า',        icon: <Building2 className={ICON} />, exact: true },
  { href: '/shop/service', label: 'บันทึกถอด-ใส่ยาง',    icon: <Wrench className={ICON} /> },
  { href: '/shop/reports', label: 'รายงานการเปลี่ยนยาง', icon: <BarChart3 className={ICON} /> },
  { href: '/shop/staff',   label: 'ช่างของร้าน',         icon: <Users className={ICON} /> },
]

/**
 * Layout ฝั่งร้านค้า (shop) — ร้านเปลี่ยนยางให้ลูกค้าหลายราย
 * หน้าที่ของร้าน: เพิ่มลูกค้า, บันทึกถอด-ใส่ยางให้รถที่เข้าร้าน, ดูรายงานต่อลูกค้า, จัดการบัญชีช่างของร้านเอง
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { profile, shop } = await requireSession(['shop'])

  return (
    <AppShell
      nav={SHOP_NAV}
      userName={profile.full_name}
      role={profile.role}
      companyName={shop?.name ?? 'ร้านค้า'}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </AppShell>
  )
}
