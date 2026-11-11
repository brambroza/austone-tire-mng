import { Suspense } from 'react'
import { Truck, Gauge, Warehouse } from 'lucide-react'
import { LoginForm } from './login-form'
import { LoginScene, TireMark } from './login-motion'
import { BrandLogo, BrandMascot } from '@/components/brand'

export const metadata = { title: 'เข้าสู่ระบบ · Austone Tire' }

/** จุดเด่นของระบบ แสดงเป็น chip ใต้หัวข้อฝั่งซ้าย */
const HIGHLIGHTS = [
  { icon: Truck, text: 'เลือกตำแหน่งล้อจากแผนผังรถ' },
  { icon: Warehouse, text: 'รู้ทุกเส้นว่าอยู่รถคันไหนหรือในคลัง' },
  { icon: Gauge, text: 'สรุประยะวิ่งและต้นทุนต่อกิโลเมตร' },
]

/**
 * หน้า login สีแบรนด์ Austone — พื้นเหลือง Austone เต็มจอ (#F5E907)
 * ฝั่งซ้ายเป็นแผงดำถ่านใส่โลโก้ทางการ + มาสคอตหุ่นยาง, ฝั่งขวาการ์ดฟอร์มสีขาวขอบดำ
 */
export default function LoginPage() {
  return (
    <LoginScene>
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-500 text-ink-900">
        {/* พื้นหลัง: เหลืองแท้ + ลายจุดดำจาง + ล้อยางหมุนช้า ๆ */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: 'radial-gradient(var(--color-ink-900) 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, black 10%, transparent 85%)',
          }}
        />
        <div
          data-float
          className="pointer-events-none absolute -left-32 top-1/3 size-[30rem] rounded-full bg-brand-300/70 blur-3xl"
        />
        <TireMark className="pointer-events-none absolute -bottom-40 -right-28 size-[34rem] text-ink-900/[0.08] lg:-bottom-56 lg:size-[46rem]" />

        {/* แถบบน: โลโก้บนแถบดำ */}
        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
          <div data-anim className="flex items-center">
            <BrandLogo lockup highlight width={230} priority />
          </div>
          <span
            data-anim
            className="hidden rounded-full border-2 border-ink-900 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ink-900 sm:inline-flex"
          >
            Tire Management
          </span>
        </header>

        {/* เนื้อหา */}
        <main className="relative z-10 flex flex-1 items-center px-6 pb-10 sm:px-10 lg:px-14">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[1.15fr_minmax(0,26rem)] lg:gap-16">
            {/* ฝั่งซ้าย: แผงดำ โลโก้ใหญ่ + มาสคอต */}
            <section
              data-anim
              className="relative min-w-0 overflow-hidden rounded-[2rem] bg-ink-900 p-7 text-white shadow-[0_30px_80px_-30px_rgba(26,26,26,0.6)] sm:p-10"
            >
              {/* แถบเหลืองเฉียงมุมขวาบน */}
              <div className="pointer-events-none absolute -right-20 -top-24 size-72 rotate-12 rounded-[2.5rem] bg-brand-500/15" />
              <div className="pointer-events-none absolute -right-28 -top-16 size-72 rotate-12 rounded-[2.5rem] border-2 border-brand-500/25" />

              <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <BrandLogo width={300} priority className="max-w-full" />
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-bold tracking-wide text-ink-900">
                    <span className="size-1.5 rounded-full bg-ink-900" />
                    ระบบจัดการยางรถบรรทุก
                  </p>
                  <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/75 sm:text-base">
                    บันทึกการถอด-ใส่ยางหน้างานด้วย iPad ติดตามระยะใช้งานรายเส้น
                    และแจ้งเตือนอัตโนมัติเมื่อถึงเกณฑ์ที่กำหนด
                  </p>

                  <ul className="mt-7 flex flex-wrap gap-2.5">
                    {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                      <li
                        key={text}
                        className="inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-white/5 px-3.5 py-2 text-[13px] font-medium text-white"
                      >
                        <Icon className="size-4 text-brand-500" strokeWidth={2} />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* มาสคอตชูนิ้วโป้ง บนแสงเหลืองนุ่ม ๆ */}
                <div className="relative mx-auto flex w-[280px] shrink-0 items-end justify-center xl:mx-0 xl:w-[300px]">
                  <div className="pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-3xl" />
                  <div data-float className="relative">
                    <BrandMascot size={270} priority className="drop-shadow-[0_22px_26px_rgba(0,0,0,0.55)]" />
                  </div>
                </div>
              </div>
            </section>

            {/* ฝั่งขวา: การ์ดฟอร์ม */}
            <section
              data-anim
              className="relative min-w-0 rounded-[1.75rem] border-[3px] border-ink-900 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)] sm:p-9"
            >
              <span className="absolute -top-3.5 right-8 rounded-full bg-ink-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-500">
                Sign in
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">เข้าสู่ระบบ</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                กรอกอีเมลและรหัสผ่านที่ได้รับจากผู้ดูแลระบบ
              </p>
              <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-brand-50" />}>
                <LoginForm />
              </Suspense>
            </section>
          </div>
        </main>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 pb-6 text-xs font-medium text-ink-900/70 sm:px-10 lg:px-14">
          <p data-anim>© Austone Thailand · Austone Tire Management</p>
          <p data-anim className="hidden sm:block">ยางคุณภาพ ที่สัมผัสได้</p>
        </footer>
      </div>
    </LoginScene>
  )
}
