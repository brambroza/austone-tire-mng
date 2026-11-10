import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, CircleDot, Phone, Repeat, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isPublicTokenFormat } from '@/lib/public-link'
import { getLayout, positionLabel, type AxleTypeLayoutSource } from '@/lib/axle-layouts'
import { vehicleLabel } from '@/lib/vehicle-display'
import { tireBrandModelLabel } from '@/lib/tire-display'
import { isUnknownSerial } from '@/lib/shop-rules'
import { pairTireChanges, primaryEvent } from '@/lib/tire-change-rows'
import { formatKm, formatNumber, formatThaiDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata = { title: 'ประวัติการเปลี่ยนยาง · Austone Tire' }

/** ผลจาก RPC public_company_history (jsonb) */
interface PublicHistory {
  company: { name: string; code: string }
  shop: { name: string; phone: string | null } | null
  axle_types: AxleTypeLayoutSource[]
  vehicles: Array<{
    id: string
    plate_no: string | null
    nickname: string | null
    province: string | null
    axle_type: string
    brand: string | null
    model: string | null
    current_mileage: number
  }>
  events: Array<{
    id: string
    event_type: 'mount' | 'unmount'
    event_date: string
    position_code: string | null
    odometer: number
    tread_mm: number | null
    distance_km: number | null
    note: string | null
    vehicle_id: string | null
    serial_no: string
    brand_name: string | null
    model_name: string | null
    size: string | null
    reason: string | null
  }>
  generated_at: string
}

/** หน้าแจ้งว่าลิงก์ใช้ไม่ได้ — ไม่บอกว่าเพราะอะไร (กันเดา token) */
function InvalidLink() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-line">
        <CircleDot className="size-7" />
      </span>
      <h1 className="mt-6 text-xl font-semibold">ลิงก์นี้ใช้ไม่ได้</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
        ลิงก์อาจพิมพ์ไม่ครบ หมดอายุ หรือร้านค้าสร้างลิงก์ใหม่แล้ว กรุณาติดต่อร้านที่เปลี่ยนยางให้เพื่อขอลิงก์ล่าสุด
      </p>
    </div>
  )
}

/**
 * หน้า public ให้ลูกค้าดูประวัติถอด-ใส่ยางของตัวเองผ่านลิงก์ส่วนตัวที่ร้านส่งให้ — ไม่ต้อง login
 * ข้อมูลมาจาก RPC security definer ที่กรองด้วย token อย่างเดียว · ?v=<vehicle id> กรองเฉพาะรถคันเดียว
 */
export default async function PublicHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const { token } = await params
  const { v: vehicleFilter } = await searchParams
  if (!isPublicTokenFormat(token)) return <InvalidLink />

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('public_company_history', { p_token: token })
  if (error || !data) return <InvalidLink />
  const history = data as unknown as PublicHistory

  const vehicleById = new Map(history.vehicles.map((v) => [v.id, v]))
  const selected = vehicleFilter && vehicleById.has(vehicleFilter) ? vehicleFilter : null
  const events = selected ? history.events.filter((e) => e.vehicle_id === selected) : history.events
  const mountCount = events.filter((e) => e.event_type === 'mount').length
  const unmountCount = events.length - mountCount
  const serviceDays = new Set(events.map((e) => e.event_date)).size
  // งานเปลี่ยนยาง (ถอด+ใส่ ตำแหน่งเดียวกัน วันเดียวกัน) แสดงเป็นรายการเดียว
  const changeRows = pairTireChanges(events, (e) => e.vehicle_id)

  /** จำนวนครั้งที่เปลี่ยนต่อคัน — โชว์บน chip ตัวกรอง */
  const countByVehicle = new Map<string, number>()
  for (const e of history.events) {
    if (e.vehicle_id) countByVehicle.set(e.vehicle_id, (countByVehicle.get(e.vehicle_id) ?? 0) + 1)
  }

  const base = `/p/${token}`

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      {/* หัวเรื่อง */}
      <header className="rounded-2xl bg-ink-900 p-5 text-white shadow-sm sm:p-7">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-200/80">ประวัติการเปลี่ยนยาง</p>
        <h1 className="mt-1.5 text-2xl font-semibold leading-tight sm:text-3xl">{history.company.name}</h1>
        <p className="mt-1 text-sm text-white/60">รหัสลูกค้า {history.company.code}</p>
        {history.shop && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
            <span>เปลี่ยนยางโดย <span className="font-medium text-white">{history.shop.name}</span></span>
            {history.shop.phone && (
              <a href={`tel:${history.shop.phone}`} className="inline-flex items-center gap-1.5 hover:text-white">
                <Phone className="size-3.5" />
                {history.shop.phone}
              </a>
            )}
          </div>
        )}
      </header>

      {/* ตัวเลขสรุป */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="รถทั้งหมด" value={formatNumber(history.vehicles.length)} unit="คัน" />
        <Tile label="วันที่เข้ารับบริการ" value={formatNumber(serviceDays)} unit="ครั้ง" />
        <Tile label="ใส่ยาง" value={formatNumber(mountCount)} unit="เส้น" tone="brand" />
        <Tile label="ถอดยาง" value={formatNumber(unmountCount)} unit="เส้น" tone="amber" />
      </section>

      {/* กรองรายคัน */}
      {history.vehicles.length > 0 && (
        <section className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink-700">เลือกรถ</p>
          <div className="flex flex-wrap gap-2">
            <Chip href={base} active={!selected} label="ทุกคัน" count={history.events.length} />
            {history.vehicles.map((v) => (
              <Chip
                key={v.id}
                href={`${base}?v=${v.id}`}
                active={selected === v.id}
                label={vehicleLabel(v)}
                count={countByVehicle.get(v.id) ?? 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* รายละเอียดคันที่เลือก */}
      {selected && (() => {
        const v = vehicleById.get(selected)!
        const layout = getLayout(v.axle_type, history.axle_types)
        return (
          <section className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Truck className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{vehicleLabel(v)}</p>
              <p className="text-sm text-ink-500">
                {[v.province, [v.brand, v.model].filter(Boolean).join(' '), `${layout.name} · ${layout.wheelCount} ล้อ`, `เลขไมล์ ${formatKm(v.current_mileage)}`]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
          </section>
        )
      })()}

      {/* รายการประวัติ — 1 รายการ = 1 งานเปลี่ยนยาง (ถอดออก + ใส่เข้า) */}
      <section className="mt-5">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-base font-semibold">รายการถอด-ใส่ยาง</h2>
          <span className="text-xs text-ink-400">{formatNumber(changeRows.length)} รายการ · ล่าสุดขึ้นก่อน</span>
        </div>
        {changeRows.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-sm ring-1 ring-line">
            ยังไม่มีประวัติการเปลี่ยนยาง
          </div>
        ) : (
          <ul className="space-y-2.5">
            {changeRows.map((row) => {
              const main = primaryEvent(row)
              const vehicle = main.vehicle_id ? vehicleById.get(main.vehicle_id) ?? null : null
              const kind = row.unmount && row.mount ? 'change' : row.mount ? 'mount' : 'unmount'
              const title = kind === 'change' ? 'เปลี่ยนยาง' : kind === 'mount' ? 'ใส่ยาง' : 'ถอดยาง'
              const Icon = kind === 'change' ? Repeat : kind === 'mount' ? ArrowDownToLine : ArrowUpFromLine
              return (
                <li key={row.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                      kind === 'unmount' ? 'bg-amber-50 text-amber-600 ring-amber-100' : 'bg-brand-50 text-brand-600 ring-brand-100',
                    )}>
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="font-semibold">
                          {title}
                          <span className="font-normal text-ink-500"> · {positionLabel(row.position_code, vehicle?.axle_type, history.axle_types)}</span>
                        </p>
                        <p className="text-sm text-ink-500">{formatThaiDate(row.event_date)}</p>
                      </div>
                      {!selected && (
                        <p className="mt-0.5 text-sm text-ink-700">{vehicleLabel(vehicle, 'รถถูกลบ')}</p>
                      )}
                      <div className={cn('mt-2 grid gap-2', kind === 'change' && 'sm:grid-cols-2')}>
                        {row.unmount && <PublicSide label="ถอดออก" tone="amber" e={row.unmount} />}
                        {row.mount && <PublicSide label="ใส่เข้า" tone="brand" e={row.mount} />}
                      </div>
                      <p className="mt-2 text-xs text-ink-500">เลขไมล์ {formatKm(main.odometer)}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <footer className="mt-10 text-center text-xs text-ink-400">
        ข้อมูล ณ {formatThaiDate(history.generated_at, true)} · ลิงก์นี้เป็นลิงก์ส่วนตัวของบริษัท กรุณาอย่าส่งต่อ
        <br />
        Austone Tire
      </footer>
    </div>
  )
}

/** ยาง 1 ฝั่งของงาน (ถอดออก / ใส่เข้า) ในการ์ดประวัติหน้า public */
function PublicSide({ label, tone, e }: { label: string; tone: 'amber' | 'brand'; e: PublicHistory['events'][number] }) {
  const facts = [
    e.event_type === 'unmount' && e.distance_km !== null ? `วิ่งรอบนี้ ${formatKm(e.distance_km)}` : null,
    e.tread_mm !== null ? `ดอกยาง ${e.tread_mm} มม.` : null,
    e.event_type === 'unmount' && e.reason ? `สาเหตุ: ${e.reason}` : null,
  ].filter(Boolean)
  return (
    <div className={cn('rounded-xl px-3 py-2 ring-1 ring-inset', tone === 'amber' ? 'bg-amber-50/60 ring-amber-100' : 'bg-brand-50/60 ring-brand-100')}>
      <p className={cn('text-[11px] font-medium uppercase tracking-wide', tone === 'amber' ? 'text-amber-700' : 'text-brand-700')}>{label}</p>
      <p className="mt-0.5 text-sm">
        <span className="font-mono uppercase text-ink-900">{isUnknownSerial(e.serial_no) ? 'ไม่ทราบซีรีย์' : e.serial_no}</span>
        <span className="text-ink-500"> · {tireBrandModelLabel(e.brand_name, e.model_name)}{e.size ? ` · ${e.size}` : ''}</span>
      </p>
      {facts.length > 0 && <p className="mt-0.5 text-xs text-ink-500">{facts.join(' · ')}</p>}
      {e.note && <p className="mt-0.5 text-xs text-ink-500">{e.note}</p>}
    </div>
  )
}

/** ตัวเลขสรุปแบบกะทัดรัด (ไม่ใช้ StatTile เพราะหน้า public ไม่มี AppShell) */
function Tile({ label, value, unit, tone = 'ink' }: { label: string; value: string; unit: string; tone?: 'ink' | 'brand' | 'amber' }) {
  const color = tone === 'brand' ? 'text-brand-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>
        {value} <span className="text-sm font-normal text-ink-400">{unit}</span>
      </p>
    </div>
  )
}

/** chip เลือกรถ (ลิงก์ธรรมดา — ไม่ต้องใช้ JS) */
function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        active ? 'border-brand-400 bg-brand-400 text-ink-900' : 'border-line bg-white text-ink-700 hover:border-brand-300',
      )}
    >
      {label}
      <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-brand-50 text-brand-700')}>{count}</span>
    </Link>
  )
}
