'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Pencil, Plus, Power, PowerOff, Store, Users } from 'lucide-react'
import {
  Badge, Button, Card, EmptyState, Field, Input, Table, TableWrap, Td, Textarea, Th,
} from '@/components/ui'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { formatNumber } from '@/lib/utils'
import { createShop, setShopActive, updateShop, type ShopInput } from '../actions'
import type { Shop } from '@/lib/database.types'

const EMPTY: ShopInput = { name: '', tax_id: '', phone: '', email: '', address: '', contact_name: '' }

export interface ShopRow extends Shop {
  company_count: number
  user_count: number
}

/** ตารางร้านค้า + ฟอร์มเพิ่ม/แก้ไข (super admin) */
export function ShopsClient({ shops }: { shops: ShopRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Shop | null>(null)
  const [form, setForm] = React.useState<ShopInput>(EMPTY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [confirm, setConfirm] = React.useState<ShopRow | null>(null)
  const pagination = usePagination(shops)

  const set = <K extends keyof ShopInput>(key: K, value: ShopInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setFieldErrors({})
    setOpen(true)
  }

  function openEdit(s: Shop) {
    setEditing(s)
    setForm({
      name: s.name,
      tax_id: s.tax_id ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      contact_name: s.contact_name ?? '',
    })
    setError(null)
    setFieldErrors({})
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const result = editing ? await updateShop(editing.id, form) : await createShop(form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setOpen(false)
    router.refresh()
  }

  async function toggleActive(s: ShopRow) {
    setLoading(true)
    await setShopActive(s.id, !s.is_active)
    setLoading(false)
    setConfirm(null)
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4.5" />
          เพิ่มร้านค้า
        </Button>
      </div>

      <Card>
        {shops.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" />}
            title="ยังไม่มีร้านค้าในระบบ"
            description="เพิ่มร้านค้า แล้วสร้างบัญชีพนักงานร้านในหน้ารายละเอียด"
            action={<Button onClick={openCreate}><Plus className="size-4.5" />เพิ่มร้านค้า</Button>}
          />
        ) : (
          <TableWrap>
            <Table className="min-w-[860px]">
              <thead>
                <tr>
                  <Th>ร้านค้า</Th>
                  <Th>รหัส</Th>
                  <Th>ผู้ติดต่อ</Th>
                  <Th className="text-right">ลูกค้า</Th>
                  <Th className="text-right">บัญชีพนักงาน</Th>
                  <Th>สถานะ</Th>
                  <Th className="text-right">จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-brand-50/40">
                    <Td>
                      <Link href={`/superadmin/shops/${s.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {s.name}
                      </Link>
                      {s.phone && <p className="text-xs text-ink-400">{s.phone}</p>}
                    </Td>
                    <Td><Badge tone="brand">{s.code}</Badge></Td>
                    <Td>{s.contact_name ?? '-'}</Td>
                    <Td className="text-right">{formatNumber(s.company_count)}</Td>
                    <Td className="text-right">
                      <Link
                        href={`/superadmin/shops/${s.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-brand-600 hover:bg-brand-50"
                      >
                        <Users className="size-4" />
                        {formatNumber(s.user_count)}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={s.is_active ? 'emerald' : 'slate'}>{s.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button" onClick={() => openEdit(s)} aria-label="แก้ไข"
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Pencil className="size-4.5" />
                        </button>
                        <button
                          type="button" onClick={() => setConfirm(s)}
                          aria-label={s.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          {s.is_active ? <PowerOff className="size-4.5" /> : <Power className="size-4.5" />}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination state={pagination} itemLabel="ร้านค้า" />
          </TableWrap>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? 'แก้ไขข้อมูลร้านค้า' : 'เพิ่มร้านค้า'}
        description={editing ? `${editing.code} · ${editing.name}` : 'รหัสร้านค้าสร้างให้อัตโนมัติ (S0001, S0002, ...)'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="shop-form" loading={loading}>{editing ? 'บันทึกการแก้ไข' : 'เพิ่มร้านค้า'}</Button>
          </>
        }
      >
        <form id="shop-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Field label="ชื่อร้านค้า" required error={fieldErrors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="ผู้ติดต่อ">
              <Input value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} />
            </Field>
            <Field label="เลขประจำตัวผู้เสียภาษี">
              <Input value={form.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} />
            </Field>
            <Field label="เบอร์โทร">
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label="อีเมล">
              <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
          <Field label="ที่อยู่">
            <Textarea value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && toggleActive(confirm)}
        loading={loading}
        title={confirm?.is_active ? 'ปิดใช้งานร้านค้านี้?' : 'เปิดใช้งานร้านค้านี้?'}
        confirmLabel={confirm?.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        message={`${confirm?.name} — ปิดแล้วพนักงานร้านเข้าระบบไม่ได้ ข้อมูลลูกค้ายังอยู่ครบ`}
      />
    </>
  )
}
