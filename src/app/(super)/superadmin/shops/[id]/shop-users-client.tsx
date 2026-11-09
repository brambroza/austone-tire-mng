'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Plus, Users } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Table, TableWrap, Td, Th } from '@/components/ui'
import { Modal } from '@/components/ui/modal'
import { createShopUser, type ShopUserInput } from '../../actions'
import type { Profile } from '@/lib/database.types'

/** บัญชีพนักงานร้านค้า + สร้างบัญชีใหม่ (super admin) */
export function ShopUsersClient({ shopId, users }: { shopId: string; users: Profile[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const EMPTY: ShopUserInput = { shop_id: shopId, email: '', password: '', full_name: '', phone: '' }
  const [form, setForm] = React.useState<ShopUserInput>(EMPTY)

  const set = <K extends keyof ShopUserInput>(key: K, value: ShopUserInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const result = await createShopUser({ ...form, shop_id: shopId })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setOpen(false)
    setForm(EMPTY)
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader
          title="บัญชีพนักงานร้าน"
          description={`ทั้งหมด ${users.length} บัญชี — เข้าระบบแล้วเห็นเฉพาะลูกค้าภายใต้ร้านนี้`}
          action={
            <Button size="sm" onClick={() => { setError(null); setFieldErrors({}); setOpen(true) }}>
              <Plus className="size-4" />
              สร้างบัญชี
            </Button>
          }
        />
        {users.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="ยังไม่มีบัญชีพนักงานร้าน" description="สร้างบัญชีแรกให้ร้านเพื่อเริ่มใช้งาน" />
        ) : (
          <TableWrap>
            <Table className="min-w-[480px]">
              <thead>
                <tr>
                  <Th>ชื่อ-นามสกุล</Th>
                  <Th>เบอร์โทร</Th>
                  <Th>สถานะ</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-brand-50/40">
                    <Td className="font-medium text-ink-900">{u.full_name}</Td>
                    <Td>{u.phone ?? '-'}</Td>
                    <Td><Badge tone={u.is_active ? 'emerald' : 'slate'}>{u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="สร้างบัญชีพนักงานร้าน"
        description="ไม่ต้องรอยืนยันอีเมล ล็อกอินได้ทันทีด้วยรหัสผ่านนี้"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="shop-user-form" loading={loading}>สร้างบัญชี</Button>
          </>
        }
      >
        <form id="shop-user-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Field label="ชื่อ-นามสกุล" required error={fieldErrors.full_name}>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="อีเมล" required error={fieldErrors.email}>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="รหัสผ่านเริ่มต้น" required error={fieldErrors.password} hint="อย่างน้อย 6 ตัวอักษร">
              <Input value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <Field label="เบอร์โทร" error={fieldErrors.phone}>
            <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
          </Field>
        </form>
      </Modal>
    </>
  )
}
