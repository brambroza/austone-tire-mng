'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, KeyRound, Pencil, Plus, Power, PowerOff, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, Select, Table, TableWrap, Td, Th } from '@/components/ui'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { formatThaiDate } from '@/lib/utils'
import { ROLE_LABEL, type AustoneTeamRole } from '@/lib/roles'
import {
  createTeamMember, deleteTeamMember, resetTeamMemberPassword, setTeamMemberActive, updateTeamMember,
  type TeamMemberInput,
} from './actions'
import type { Profile } from '@/lib/database.types'

const EMPTY: TeamMemberInput = { email: '', password: '', full_name: '', phone: '', role: 'sales' }

/** คำอธิบายสิทธิ์แต่ละ role ที่เลือกได้ */
const ROLE_HINT: Record<AustoneTeamRole, string> = {
  austone_admin: 'ทำได้ทุกอย่าง ยกเว้นจัดการผู้ใช้งานหน้านี้',
  sales: 'ดูได้ทุกหน้า + จัดการร้านค้า/ดีลเลอร์ (สร้างร้าน กำหนดรุ่นยาง บัญชีร้าน)',
}

/** แถวสมาชิกทีม — มีอีเมลเมื่อ server ดึงจาก auth ได้ */
export type TeamRow = Profile & { email?: string | null }

/** จัดการทีม Austone: เพิ่ม แก้ไข(รวมสลับสิทธิ์) ตั้งรหัสผ่าน เปิด/ปิด ลบ — super admin เท่านั้น */
export function TeamClient({ members, currentUserId }: { members: TeamRow[]; currentUserId: string }) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Profile | null>(null)
  const [form, setForm] = React.useState<TeamMemberInput>(EMPTY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [confirm, setConfirm] = React.useState<Profile | null>(null)
  const [deleting, setDeleting] = React.useState<Profile | null>(null)
  const [pwTarget, setPwTarget] = React.useState<Profile | null>(null)
  const [newPassword, setNewPassword] = React.useState('')
  const [notice, setNotice] = React.useState<string | null>(null)

  const showEmail = members.some((m) => m.email !== undefined)
  const set = <K extends keyof TeamMemberInput>(key: K, value: TeamMemberInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  /** super admin และตัวเอง แก้ไขจากหน้านี้ไม่ได้ */
  const locked = (m: Profile) => m.role === 'super_admin' || m.id === currentUserId

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setFieldErrors({}); setFormOpen(true) }
  function openEdit(m: Profile) {
    setEditing(m)
    setForm({ email: '', password: '', full_name: m.full_name, phone: m.phone ?? '', role: m.role === 'austone_admin' ? 'austone_admin' : 'sales' })
    setError(null); setFieldErrors({}); setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setFieldErrors({})
    const result = editing
      ? await updateTeamMember(editing.id, { full_name: form.full_name, phone: form.phone, role: form.role })
      : await createTeamMember(form)
    setLoading(false)
    if (!result.ok) { setError(result.error); setFieldErrors(result.fieldErrors ?? {}); return }
    setFormOpen(false)
    router.refresh()
  }

  async function toggleActive(m: Profile) {
    setLoading(true)
    const result = await setTeamMemberActive(m.id, !m.is_active)
    setLoading(false); setConfirm(null)
    if (!result.ok) setNotice(result.error)
    else router.refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    setLoading(true)
    const result = await deleteTeamMember(deleting.id)
    setLoading(false); setDeleting(null)
    if (!result.ok) setNotice(result.error)
    else { setNotice(`ลบบัญชี ${deleting.full_name} เรียบร้อยแล้ว`); router.refresh() }
  }

  async function handleResetPassword() {
    if (!pwTarget) return
    setLoading(true)
    const result = await resetTeamMemberPassword(pwTarget.id, newPassword)
    setLoading(false)
    if (!result.ok) { setNotice(result.error); return }
    setPwTarget(null); setNewPassword('')
    setNotice('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว')
  }

  const roleTone = (role: string) => (role === 'super_admin' ? 'brand' : role === 'austone_admin' ? 'sky' : 'amber')

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}><Plus className="size-4.5" />เพิ่มผู้ใช้งาน</Button>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">{notice}</div>
      )}

      <Card>
        {members.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-6" />} title="ยังไม่มีผู้ใช้งาน" />
        ) : (
          <TableWrap>
            <Table className="min-w-[760px]">
              <thead>
                <tr>
                  <Th>ชื่อ-นามสกุล</Th>
                  {showEmail && <Th>อีเมล</Th>}
                  <Th>สิทธิ์</Th>
                  <Th>เบอร์โทร</Th>
                  <Th>สถานะ</Th>
                  <Th>เพิ่มเมื่อ</Th>
                  <Th className="text-right">จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-brand-50/40">
                    <Td className="font-medium text-ink-900">
                      {m.full_name}
                      {m.id === currentUserId && <span className="ml-2 text-xs text-ink-400">(คุณ)</span>}
                    </Td>
                    {showEmail && <Td className="text-ink-600">{m.email ?? '-'}</Td>}
                    <Td><Badge tone={roleTone(m.role)}>{ROLE_LABEL[m.role]}</Badge></Td>
                    <Td>{m.phone ?? '-'}</Td>
                    <Td><Badge tone={m.is_active ? 'emerald' : 'slate'}>{m.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge></Td>
                    <Td className="whitespace-nowrap text-ink-500">{formatThaiDate(m.created_at)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEdit(m)} aria-label="แก้ไข" disabled={locked(m)}
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30">
                          <Pencil className="size-4.5" />
                        </button>
                        <button type="button" onClick={() => { setPwTarget(m); setNewPassword('') }} aria-label="ตั้งรหัสผ่านใหม่" disabled={locked(m)}
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30">
                          <KeyRound className="size-4.5" />
                        </button>
                        <button type="button" onClick={() => setConfirm(m)} aria-label={m.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} disabled={locked(m)}
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-30">
                          {m.is_active ? <PowerOff className="size-4.5" /> : <Power className="size-4.5" />}
                        </button>
                        <button type="button" onClick={() => setDeleting(m)} aria-label="ลบบัญชี" disabled={locked(m)}
                          className="flex size-11 items-center justify-center rounded-lg text-ink-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                          <Trash2 className="size-4.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}
        description={editing ? editing.full_name : 'ระบบสร้างบัญชีเข้าใช้งานให้ทันที'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="team-form" loading={loading}>{editing ? 'บันทึกการแก้ไข' : 'สร้างบัญชี'}</Button>
          </>
        }
      >
        <form id="team-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!editing && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="อีเมล (ใช้เข้าสู่ระบบ)" required error={fieldErrors.email}>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
              </Field>
              <Field label="รหัสผ่านเริ่มต้น" required error={fieldErrors.password} hint="อย่างน้อย 6 ตัวอักษร">
                <Input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล" required error={fieldErrors.full_name}>
              <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
            </Field>
            <Field label="เบอร์โทร" error={fieldErrors.phone}>
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <Field label="สิทธิ์" required error={fieldErrors.role} hint={ROLE_HINT[form.role]}>
            <Select value={form.role} onChange={(e) => set('role', e.target.value as AustoneTeamRole)}>
              <option value="sales">{ROLE_LABEL.sales}</option>
              <option value="austone_admin">{ROLE_LABEL.austone_admin}</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(pwTarget)}
        onClose={() => setPwTarget(null)}
        title="ตั้งรหัสผ่านใหม่"
        description={pwTarget?.full_name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwTarget(null)}>ยกเลิก</Button>
            <Button onClick={handleResetPassword} loading={loading}>ตั้งรหัสผ่าน</Button>
          </>
        }
      >
        <Field label="รหัสผ่านใหม่" required hint="อย่างน้อย 6 ตัวอักษร">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="ลบบัญชีนี้ถาวร?"
        confirmLabel="ลบบัญชี"
        message={<>บัญชีของ <strong>{deleting?.full_name}</strong> จะถูกลบและเข้าสู่ระบบไม่ได้อีก — หากต้องการเก็บไว้ ให้ใช้ “ปิดใช้งาน” แทน</>}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && toggleActive(confirm)}
        loading={loading}
        title={confirm?.is_active ? 'ปิดใช้งานบัญชีนี้?' : 'เปิดใช้งานบัญชีนี้?'}
        confirmLabel={confirm?.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        message={confirm?.is_active ? `${confirm?.full_name} จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง` : `${confirm?.full_name} จะกลับมาเข้าสู่ระบบได้ตามปกติ`}
      />
    </>
  )
}
