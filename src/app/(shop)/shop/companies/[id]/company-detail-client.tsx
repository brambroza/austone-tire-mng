'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Pencil, Plus, Users } from 'lucide-react'
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Table, TableWrap, Td, Th,
} from '@/components/ui'
import { Modal } from '@/components/ui/modal'
import { createShopCompanyUser, updateShopCompany, type ShopCompanyInput } from '../../actions'
import { ShopCompanyFormFields } from '../../shop-companies-client'
import type { CreateUserInput } from '@/app/(app)/technicians/actions'
import type { Company, Profile } from '@/lib/database.types'

const ROLE_LABEL: Record<string, string> = { admin: 'แอดมิน', technician: 'ช่าง' }

/** ปุ่ม + modal แก้ข้อมูลติดต่อของลูกค้า */
export function CompanyEditButton({ company }: { company: Company }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<ShopCompanyInput>({
    name: company.name,
    contact_name: company.contact_name ?? '',
    phone: company.phone ?? '',
    tax_id: company.tax_id ?? '',
    address: company.address ?? '',
  })

  const set = <K extends keyof ShopCompanyInput>(key: K, value: ShopCompanyInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const result = await updateShopCompany(company.id, form)
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        แก้ไขข้อมูล
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="แก้ไขข้อมูลลูกค้า"
        description={company.code}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="shop-company-edit-form" loading={loading}>บันทึก</Button>
          </>
        }
      >
        <ShopCompanyFormFields form={form} set={set} error={error} fieldErrors={fieldErrors} onSubmit={handleSubmit} formId="shop-company-edit-form" />
      </Modal>
    </>
  )
}

const EMPTY_USER: CreateUserInput = { email: '', password: '', full_name: '', phone: '', employee_no: '', role: 'admin' }

/**
 * บัญชีผู้ใช้ของลูกค้า — ร้านค้าสร้างให้เมื่อลูกค้าพร้อมเข้าระบบดูข้อมูลรถตัวเอง
 * แก้ไข/รีเซ็ตรหัสผ่านทำได้โดยแอดมินของลูกค้าเองหรือ Austone Thailand
 */
export function CompanyAccountsClient({
  companyId,
  users,
  currentUserId,
}: {
  companyId: string
  users: Profile[]
  currentUserId: string
}) {
  void currentUserId
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [form, setForm] = React.useState<CreateUserInput>(EMPTY_USER)

  const set = <K extends keyof CreateUserInput>(key: K, value: CreateUserInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})
    const result = await createShopCompanyUser(companyId, form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setOpen(false)
    setForm(EMPTY_USER)
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader
          title="บัญชีผู้ใช้ของลูกค้า"
          description={
            users.length === 0
              ? 'ยังไม่ได้ลงทะเบียน — สร้างบัญชีเมื่อลูกค้าพร้อมเข้าระบบดูข้อมูลรถของตัวเอง'
              : `ทั้งหมด ${users.length} บัญชี · ลูกค้าเข้าระบบเพื่อดูรถและประวัติยางของตัวเองได้`
          }
          action={
            <Button size="sm" onClick={() => { setError(null); setFieldErrors({}); setOpen(true) }}>
              <Plus className="size-4" />
              สร้างบัญชี
            </Button>
          }
        />
        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="ยังไม่มีบัญชีผู้ใช้"
            description="ลูกค้ายังไม่ต้องมีบัญชีก็บันทึกงานได้ — สร้างให้ภายหลังเมื่อลูกค้าต้องการดูข้อมูลเอง"
          />
        ) : (
          <TableWrap>
            <Table className="min-w-[520px]">
              <thead>
                <tr>
                  <Th>ชื่อ-นามสกุล</Th>
                  <Th>สิทธิ์</Th>
                  <Th>เบอร์โทร</Th>
                  <Th>สถานะ</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-brand-50/40">
                    <Td className="font-medium text-ink-900">{u.full_name}</Td>
                    <Td><Badge tone={u.role === 'admin' ? 'brand' : 'sky'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></Td>
                    <Td>{u.phone ?? '-'}</Td>
                    <Td>
                      <Badge tone={u.is_active ? 'emerald' : 'slate'}>{u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge>
                    </Td>
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
        title="สร้างบัญชีให้ลูกค้า"
        description="ไม่ต้องรอยืนยันอีเมล ล็อกอินได้ทันทีด้วยรหัสผ่านนี้ — แจ้งรหัสผ่านให้ลูกค้าทางช่องทางที่ปลอดภัย"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="shop-company-user-form" loading={loading}>สร้างบัญชี</Button>
          </>
        }
      >
        <form id="shop-company-user-form" onSubmit={handleSubmit} className="space-y-5">
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
            <Field label="อีเมล (ใช้เข้าระบบ)" required error={fieldErrors.email}>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="รหัสผ่านเริ่มต้น" required error={fieldErrors.password} hint="อย่างน้อย 6 ตัวอักษร">
              <Input value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="เบอร์โทร" error={fieldErrors.phone}>
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label="สิทธิ์การใช้งาน" required>
              <Select value={form.role} onChange={(e) => set('role', e.target.value as CreateUserInput['role'])}>
                <option value="admin">แอดมิน (ดูรถ ยาง รายงาน จัดการช่าง)</option>
                <option value="technician">ช่าง (บันทึกถอด-ใส่ยาง)</option>
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
