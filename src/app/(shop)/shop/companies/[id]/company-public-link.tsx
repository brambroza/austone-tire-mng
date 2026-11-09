'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/modal'
import { publicHistoryUrl } from '@/lib/public-link'
import { formatThaiDate } from '@/lib/utils'
import { revokeCompanyPublicLink, rotateCompanyPublicLink } from '../../actions'

/**
 * การ์ด "ลิงก์สำหรับลูกค้า" — ร้านสร้างลิงก์ส่วนตัว ส่งให้ลูกค้า (เช่น ทาง Line) ลูกค้าเปิดดูประวัติถอด-ใส่ยาง
 * ของตัวเองได้โดยไม่ต้อง login · สุ่มใหม่ = ลิงก์เก่าตาย · ปิดลิงก์ = เปิดไม่ได้จนกว่าจะสร้างใหม่
 */
export function CompanyPublicLinkCard({
  companyId,
  token,
  createdAt,
  baseUrl,
}: {
  companyId: string
  token: string | null
  createdAt: string | null
  baseUrl: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [confirm, setConfirm] = React.useState<'rotate' | 'revoke' | null>(null)

  const url = token ? publicHistoryUrl(baseUrl, token) : null

  /** คัดลอกลิงก์ — fallback เป็นเลือกข้อความในช่องเมื่อ clipboard ใช้ไม่ได้ (http ที่ไม่ใช่ localhost) */
  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.getElementById('company-public-link') as HTMLInputElement | null
      input?.select()
      setError('คัดลอกอัตโนมัติไม่ได้ — กด Ctrl/Cmd+C เพื่อคัดลอกจากช่องด้านบน')
    }
  }

  async function run(kind: 'rotate' | 'revoke') {
    setLoading(true)
    setError(null)
    const result = kind === 'rotate'
      ? await rotateCompanyPublicLink(companyId)
      : await revokeCompanyPublicLink(companyId)
    setLoading(false)
    setConfirm(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader
          title="ลิงก์สำหรับลูกค้า"
          description={
            url
              ? `ส่งลิงก์นี้ให้ลูกค้าเปิดดูประวัติถอด-ใส่ยางของตัวเองได้ทันที ไม่ต้อง login · สร้างเมื่อ ${formatThaiDate(createdAt, true)}`
              : 'ยังไม่ได้สร้าง — ลูกค้าจะดูประวัติรถของตัวเองได้ผ่านลิงก์ส่วนตัวนี้โดยไม่ต้องมีบัญชี'
          }
          action={
            url ? (
              <Badge tone="emerald">เปิดใช้งาน</Badge>
            ) : (
              <Button size="sm" onClick={() => run('rotate')} loading={loading}>
                <Link2 className="size-4" />
                สร้างลิงก์
              </Button>
            )
          }
        />
        {(url || error) && (
          <CardBody className="space-y-3">
            {error && (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</div>
            )}
            {url && (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="company-public-link"
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-brand-50/40 px-4 font-mono text-sm text-ink-800"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={copy}>
                      {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </Button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink-700 hover:bg-brand-50"
                    >
                      <ExternalLink className="size-4" />
                      เปิดดู
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <button type="button" onClick={() => setConfirm('rotate')} className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-600">
                    <RefreshCw className="size-4" />
                    สร้างลิงก์ใหม่ (ลิงก์เดิมใช้ไม่ได้)
                  </button>
                  <button type="button" onClick={() => setConfirm('revoke')} className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700">
                    <Link2Off className="size-4" />
                    ปิดลิงก์
                  </button>
                </div>
              </>
            )}
          </CardBody>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === 'rotate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('rotate')}
        loading={loading}
        title="สร้างลิงก์ใหม่"
        confirmLabel="สร้างลิงก์ใหม่"
        message="ลิงก์เดิมที่ส่งให้ลูกค้าไปแล้วจะเปิดไม่ได้ทันที ต้องส่งลิงก์ใหม่ให้ลูกค้าอีกครั้ง"
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('revoke')}
        loading={loading}
        title="ปิดลิงก์สำหรับลูกค้า"
        confirmLabel="ปิดลิงก์"
        message="ลูกค้าจะเปิดลิงก์เดิมไม่ได้จนกว่าร้านจะสร้างลิงก์ใหม่ — ข้อมูลประวัติยังอยู่ครบ"
      />
    </>
  )
}
