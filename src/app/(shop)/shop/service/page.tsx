import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Building2, ChevronRight, Repeat } from 'lucide-react'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadServiceWizardData, loadShopGrantModels } from '@/lib/service-data'
import { PageHeader } from '@/components/app-shell'
import { Card, EmptyState } from '@/components/ui'
import { ServiceWizard } from '@/app/(app)/service/service-wizard'
import { CustomerSearch } from '@/components/customer-search'
import { loadShopCompanies } from '../shop-queries'
import type { Company } from '@/lib/database.types'

export const metadata = { title: 'บันทึกถอด-ใส่ยาง · Austone Tire Shop' }

/**
 * หน้าบันทึกถอด-ใส่ยางของร้านค้า
 * ไม่มี ?company= → ให้เลือกลูกค้าก่อน · มีแล้ว → เปิด wizard เดียวกับช่างของลูกค้า
 * แต่ใช้กฎร้านค้า: ใส่ได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน และถอดยางที่ไม่ทราบซีรีย์ได้
 */
export default async function ShopServicePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; vehicle?: string }>
}) {
  const { profile } = await requireSession(['shop'])
  const { company: companyId, vehicle } = await searchParams
  const supabase = await createClient()

  if (!companyId) {
    const companies = await loadShopCompanies(supabase)
    const active = companies.filter((c) => c.is_active)
    return (
      <>
        <PageHeader title="บันทึกการถอด-ใส่ยาง" subtitle="เลือกลูกค้าที่รถเข้ามาเปลี่ยนยาง" />
        <Card>
          {companies.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="ยังไม่มีลูกค้า"
              description="เพิ่มลูกค้าที่หน้า “ลูกค้า” ก่อน แล้วกลับมาบันทึกงาน"
              action={
                <Link href="/shop" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-400 px-4 text-[15px] font-medium text-ink-900 hover:bg-brand-500">
                  ไปหน้าลูกค้า
                </Link>
              }
            />
          ) : (
            <>
              <div className="border-b border-line px-5 py-4">
                <CustomerSearch
                  customers={active.map((c) => ({
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    contact_name: c.contact_name,
                    phone: c.phone,
                    detail: [c.code, `${c.vehicle_count} คัน`, c.contact_name].filter(Boolean).join(' · '),
                  }))}
                  autoFocus
                  hrefTemplate="/shop/service?company={id}"
                />
                <p className="mt-2 text-sm text-ink-500">พิมพ์ค้นหาแล้วเลือก หรือแตะจากรายชื่อด้านล่าง ({active.length} ราย)</p>
              </div>
            <ul className="divide-y divide-line">
              {active.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/shop/service?company=${c.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/60"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Building2 className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-ink-900">{c.name}</span>
                      <span className="block text-sm text-ink-500">
                        {[c.code, `${c.vehicle_count} คัน`, c.contact_name].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
            </>
          )}
        </Card>
      </>
    )
  }

  // RLS คัดให้เหลือลูกค้าภายใต้ร้าน — ไม่พบ = ไม่ใช่ของร้านนี้
  const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
  if (!companyData) notFound()
  const company = companyData as Company

  const [data, grantModels] = await Promise.all([
    loadServiceWizardData(supabase, company.id, 'central'),
    loadShopGrantModels(supabase, profile.shop_id ?? ''),
  ])
  const mountModelIds = grantModels.map((m) => m.id)

  return (
    <>
      <PageHeader
        title="บันทึกการถอด-ใส่ยาง"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink-800">{company.name}</span>
            <span className="text-ink-400">·</span>
            <span>ใส่ได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน ({mountModelIds.length} รุ่น) · ยางที่ถอดเลือก “ไม่ทราบซีรีย์” ได้</span>
          </span>
        }
        action={
          <Link
            href="/shop/service"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink-700 hover:bg-brand-50"
          >
            <Repeat className="size-4" />
            เปลี่ยนลูกค้า
          </Link>
        }
      />
      {mountModelIds.length === 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Austone ยังไม่ได้กำหนดรุ่นยางให้ร้านนี้ — บันทึกการถอดยางได้ แต่จะยังใส่ยางไม่ได้ กรุณาติดต่อ Austone
          </span>
        </div>
      )}
      <ServiceWizard
        vehicles={data.vehicles}
        tires={data.tires}
        reasons={data.reasons}
        axleTypes={data.axleTypes}
        models={data.models}
        initialVehicleId={vehicle}
        companyId={company.id}
        mountModelIds={mountModelIds}
        allowUnknownSerial
      />
    </>
  )
}
