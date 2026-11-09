'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Building2, ChevronRight, Plus, Wrench } from 'lucide-react'
import {
  Badge, Button, Card, EmptyState, Field, Input, Table, TableWrap, Td, Textarea, Th,
} from '@/components/ui'
import { Modal } from '@/components/ui/modal'
import { SearchInput } from '@/components/search-input'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { formatNumber, formatThaiDate } from '@/lib/utils'
import { createShopCompany, type ShopCompanyInput } from './actions'
import type { ShopCompanyRow } from './shop-queries'

const EMPTY: ShopCompanyInput = { name: '', contact_name: '', phone: '', tax_id: '', address: '' }

/** ตารางลูกค้าของร้าน + ฟอร์มเพิ่มลูกค้า (กรอกแค่ชื่อก็พอ) */
export function ShopCompaniesClient({ companies }: { companies: ShopCompanyRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSearching = Boolean(searchParams.get('q'))
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<ShopCompanyInput>(EMPTY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const pagination = usePagination(companies)

  const set = <K extends keyof ShopCompanyInput>(key: K, value: ShopCompanyInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function openCreate() {
    setForm(EMPTY)
    setError(null)
    setFieldErrors({})
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const result = await createShopCompany(form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="ค้นหาชื่อลูกค้า, รหัส, ผู้ติดต่อ, เบอร์โทร..." className="sm:max-w-md" />
        <Button onClick={openCreate} className="sm:ml-auto">
          <Plus className="size-4.5" />
          เพิ่มลูกค้า
        </Button>
      </div>

      <Card>
        {companies.length === 0 ? (
          isSearching ? (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="ไม่พบลูกค้าตามคำค้นหา"
              description="ลองเปลี่ยนคำค้นหา เช่น ชื่อลูกค้า รหัส หรือเบอร์โทร"
            />
          ) : (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="ยังไม่มีลูกค้า"
              description="เพิ่มชื่อลูกค้าที่เข้ามาเปลี่ยนยางที่ร้าน แล้วเริ่มบันทึกงานได้ทันที"
              action={<Button onClick={openCreate}><Plus className="size-4.5" />เพิ่มลูกค้า</Button>}
            />
          )
        ) : (
          <TableWrap>
            <Table className="min-w-[860px]">
              <thead>
                <tr>
                  <Th>ลูกค้า</Th>
                  <Th>รหัส</Th>
                  <Th>ผู้ติดต่อ</Th>
                  <Th className="text-right">รถ</Th>
                  <Th>ลิงก์ลูกค้า</Th>
                  <Th>เปลี่ยนยางล่าสุด</Th>
                  <Th className="text-right">จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                    <Td>
                      <Link href={`/shop/companies/${c.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {c.name}
                      </Link>
                      {c.phone && <p className="text-xs text-ink-400">{c.phone}</p>}
                    </Td>
                    <Td><Badge tone="brand">{c.code}</Badge></Td>
                    <Td>{c.contact_name ?? '-'}</Td>
                    <Td className="text-right">{formatNumber(c.vehicle_count)}</Td>
                    <Td>
                      {c.has_public_link
                        ? <Badge tone="emerald">ส่งลิงก์ได้</Badge>
                        : <Badge tone="slate">ยังไม่สร้าง</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap">{c.last_service_date ? formatThaiDate(c.last_service_date) : '-'}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/shop/service?company=${c.id}`}
                          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-400 px-3 text-sm font-medium text-ink-900 hover:bg-brand-500"
                        >
                          <Wrench className="size-4" />
                          บันทึกยาง
                        </Link>
                        <Link
                          href={`/shop/companies/${c.id}`}
                          aria-label="ดูรายละเอียด"
                          className="flex size-10 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <ChevronRight className="size-5" />
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination state={pagination} itemLabel="ลูกค้า" />
          </TableWrap>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มลูกค้า"
        description="กรอกชื่อลูกค้าก็เริ่มบันทึกงานได้ — บัญชีผู้ใช้ของลูกค้าสร้างภายหลังได้จากหน้ารายละเอียด"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="shop-company-form" loading={loading}>เพิ่มลูกค้า</Button>
          </>
        }
      >
        <ShopCompanyFormFields form={form} set={set} error={error} fieldErrors={fieldErrors} onSubmit={handleSubmit} formId="shop-company-form" />
      </Modal>
    </>
  )
}

/**
 * ช่องกรอกข้อมูลลูกค้า — ใช้ร่วมกันระหว่างฟอร์มเพิ่มและฟอร์มแก้ไข
 */
export function ShopCompanyFormFields({
  form,
  set,
  error,
  fieldErrors,
  onSubmit,
  formId,
}: {
  form: ShopCompanyInput
  set: <K extends keyof ShopCompanyInput>(key: K, value: ShopCompanyInput[K]) => void
  error: string | null
  fieldErrors: Record<string, string>
  onSubmit: (e: React.FormEvent) => void
  formId: string
}) {
  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Field label="ชื่อลูกค้า" required error={fieldErrors.name}>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="เช่น บริษัท ขนส่งดี จำกัด หรือ คุณสมชาย" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ผู้ติดต่อ" error={fieldErrors.contact_name}>
          <Input value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} />
        </Field>
        <Field label="เบอร์โทร" error={fieldErrors.phone}>
          <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
      </div>
      <Field label="เลขประจำตัวผู้เสียภาษี" error={fieldErrors.tax_id}>
        <Input value={form.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} />
      </Field>
      <Field label="ที่อยู่" error={fieldErrors.address}>
        <Textarea value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </Field>
    </form>
  )
}
