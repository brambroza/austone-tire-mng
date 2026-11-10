import { Suspense } from 'react'
import { Star, Truck, Gauge, Warehouse } from 'lucide-react'
import { LoginForm } from './login-form'
import { LoginScene, TireMark } from './login-motion'

export const metadata = { title: 'เข้าสู่ระบบ · Austone Tire' }

/** จุดเด่นของระบบ แสดงเป็น chip ใต้หัวข้อฝั่งซ้าย */
const HIGHLIGHTS = [
  { icon: Truck, text: 'เลือกตำแหน่งล้อจากแผนผังรถ' },
  { icon: Warehouse, text: 'รู้ทุกเส้นว่าอยู่รถคันไหนหรือในคลัง' },
  { icon: Gauge, text: 'สรุประยะวิ่งและต้นทุนต่อกิโลเมตร' },
]

/**
 * หน้า login โทนเหลือง Austone — พื้นเหลืองพาสเทลเต็มจอ, การ์ดฟอร์มสีขาว,
 * จุดเน้นสีดำถ่านตามโลโก้ (กล่องดำ + ดาวเหลือง)
 */
export default function LoginPage() {
  return (
    <LoginScene>
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-brand-300 text-ink-900">
        {/* พื้นหลัง: ไล่เฉดเหลือง + ลายจุด + ล้อยางหมุนช้า ๆ */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 600px at 0% 0%, var(--color-brand-200), transparent 70%), ' +
              'radial-gradient(800px 700px at 100% 100%, var(--color-brand-400), transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(var(--color-ink-900) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)',
          }}
        />
        <div
          data-float
          className="pointer-events-none absolute -left-32 top-1/3 size-[30rem] rounded-full bg-white/50 blur-3xl"
        />
        <div
          data-float
          className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-brand-500/40 blur-3xl"
        />
        <TireMark className="pointer-events-none absolute -bottom-40 -right-28 size-[34rem] text-ink-900/[0.07] lg:-bottom-56 lg:size-[46rem]" />

        {/* แถบบน: โลโก้ */}
        <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
          <div data-anim className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-ink-900 shadow-[0_12px_28px_-12px_rgba(26,26,26,0.6)]">
              <Star className="size-5 fill-brand-500 text-brand-500" strokeWidth={1.5} />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-bold uppercase tracking-[0.18em]">Austone</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-700">Thailand</p>
            </div>
          </div>
          <span
            data-anim
            className="hidden rounded-full border border-ink-900/15 px-3.5 py-1.5 text-xs font-medium tracking-wide text-ink-700 sm:inline-flex"
          >
            Tire Management
          </span>
        </header>

        {/* เนื้อหา */}
        <main className="relative z-10 flex flex-1 items-center px-6 pb-10 sm:px-10 lg:px-14">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[1.15fr_minmax(0,26rem)] lg:gap-20">
            {/* ฝั่งซ้าย: หัวเรื่อง */}
            <section className="min-w-0 max-w-xl">
              <p
                data-anim
                className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand-300"
              >
                <span className="size-1.5 rounded-full bg-brand-500" />
                ระบบจัดการยาง
              </p>
            {/*   <h1
                data-anim
                className="mt-6 text-[2.6rem] font-bold leading-[1.08] tracking-tight sm:text-6xl"
              >
                ยางทุกเส้น
                <br />
                รู้ว่าอยู่ตรงไหน
                <br />
                <span className="whitespace-nowrap text-ink-900/40">วิ่งไปเท่าไร</span>
              </h1> */}
              <p data-anim className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-700 sm:text-base">
                บันทึกการถอด-ใส่ยางหน้างานด้วย iPad ติดตามระยะใช้งานรายเส้น
                และแจ้งเตือนอัตโนมัติเมื่อถึงเกณฑ์ที่กำหนด
              </p>

              <ul className="mt-8 flex flex-wrap gap-2.5">
                {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    data-anim
                    className="inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white/60 px-3.5 py-2 text-[13px] font-medium text-ink-800 backdrop-blur"
                  >
                    <Icon className="size-4 text-ink-900" strokeWidth={2} />
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            {/* ฝั่งขวา: การ์ดฟอร์ม */}
            <section
              data-anim
              className="relative min-w-0 rounded-[1.75rem] bg-white p-6 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.35)] ring-1 ring-ink-900/5 sm:p-9"
            >
              <span className="absolute -top-3 right-8 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-900">
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

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 pb-6 text-xs text-ink-900/55 sm:px-10 lg:px-14">
          <p data-anim>© Austone Thailand · Austone Tire Management</p>
          <p data-anim className="hidden sm:block"></p>
        </footer>
      </div>
    </LoginScene>
  )
}
