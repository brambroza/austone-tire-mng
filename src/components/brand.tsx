'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * ไฟล์ brand asset ใน public/brand (ตัดจากไฟล์ที่ลูกค้าส่งให้ 2026-11-11)
 * - logo        : wordmark ตัวอักษรขาว + ดาวเหลือง สำหรับวางบนพื้นดำ/เข้ม
 * - logoDark    : wordmark ตัวอักษรดำ + วงรีเหลืองดาวขาว สำหรับวางบนพื้นเหลือง/ขาว
 * - lockup      : wordmark ขาว + มาสคอตด้านขวา (ชุดโลโก้ทางการแถวพื้นดำ)
 * - lockupDark  : wordmark ดำ + มาสคอตด้านขวา (ชุดโลโก้ทางการแถวพื้นขาว)
 * - mascot      : มาสคอตหุ่นยาง Austone ชูนิ้วโป้ง (พื้นโปร่ง มีขอบขาวแบบสติกเกอร์)
 * - star        : ตราดาวดำบนวงรีเหลือง ใช้เป็นสัญลักษณ์ย่อ
 * - mark        : หัว+อกมาสคอตบนกระเบื้องดำ = โลโก้แอป (ชุดเดียวกับ favicon ใน src/app/icon.png)
 * - tire        : รูปยาง hero ใช้ประกอบหน้า login
 */
export const BRAND_ASSETS = {
  logo: '/brand/austone-logo.png',
  logoDark: '/brand/austone-logo-dark.png',
  lockup: '/brand/austone-lockup.png',
  lockupDark: '/brand/austone-lockup-dark.png',
  mascot: '/brand/austone-mascot.png',
  star: '/brand/austone-star.png',
  tire: '/brand/austone-tire.png',
  /** หัว+อกมาสคอตบนกระเบื้องดำถ่านมุมมน (256×256) — โลโก้แอป ใช้ชุดเดียวกับ favicon/app icon */
  mark: '/brand/austone-mark.png',
} as const

/** ขนาดต้นฉบับของแต่ละไฟล์ (กว้าง × สูง) ใช้คำนวณสัดส่วนไม่ให้รูปบิด */
const NATURAL = {
  logo: { w: 905, h: 162 },
  logoDark: { w: 932, h: 168 },
  lockup: { w: 1203, h: 244 },
  lockupDark: { w: 1220, h: 246 },
  mascot: { w: 573, h: 521 },
  star: { w: 212, h: 177 },
  tire: { w: 1000, h: 938 },
} as const

type LogoVariant = 'light' | 'dark'

/**
 * โลโก้ AUSTONE THAILAND (ตัดจากชุดโลโก้ทางการที่ลูกค้าส่งให้)
 * @param variant light = ตัวอักษรขาว (วางบนพื้นดำ) · dark = ตัวอักษรดำ (วางบนพื้นเหลือง/ขาว)
 * @param lockup true = รวมมาสคอตด้านขวาด้วย, false = wordmark อย่างเดียว
 * @param highlight ใส่กรอบพื้นตัดสีให้โลโก้ไม่กลืนกับพื้นหลัง — light ได้กรอบดำถ่าน, dark ได้กรอบขาว
 *   (ใช้เมื่อวางโลโก้บนพื้นเหลือง เพราะดาว/มาสคอตเป็นสีเหลืองเดียวกับพื้น)
 * @param width ความกว้างที่ต้องการ (px) ความสูงคำนวณตามสัดส่วนให้เอง
 * @param priority โหลดก่อน (ใช้กับโลโก้ที่อยู่เหนือ fold เช่นหน้า login)
 */
export function BrandLogo({
  variant = 'light',
  lockup = false,
  highlight = false,
  width = 160,
  priority = false,
  className,
}: {
  variant?: LogoVariant
  lockup?: boolean
  highlight?: boolean
  width?: number
  priority?: boolean
  className?: string
}) {
  const key = lockup ? (variant === 'dark' ? 'lockupDark' : 'lockup') : variant === 'dark' ? 'logoDark' : 'logo'
  const nat = NATURAL[key]
  const image = (
    <Image
      src={BRAND_ASSETS[key]}
      alt="Austone Thailand"
      width={width}
      height={Math.round((width * nat.h) / nat.w)}
      priority={priority}
      // เสิร์ฟตรงจาก /public — ไฟล์เล็กและกัน image optimizer cache รูปเก่าเวลาเปลี่ยนไฟล์ชื่อเดิม
      unoptimized
      className={cn('h-auto select-none', !highlight && className)}
      style={{ width, height: 'auto' }}
    />
  )
  if (!highlight) return image
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-2xl px-4 py-2.5 shadow-[0_12px_28px_-12px_rgba(26,26,26,0.55)]',
        variant === 'dark' ? 'bg-white ring-2 ring-ink-900' : 'bg-ink-900 ring-2 ring-brand-500/70',
        className,
      )}
    >
      {image}
    </span>
  )
}

/**
 * มาสคอต Austone (หุ่นยางชูนิ้วโป้ง) — ถ้าไฟล์โหลดไม่ขึ้นจะไม่แสดงอะไรเลย เพื่อไม่ให้มีรูปแตก
 * @param size ความกว้างของรูป (px)
 */
export function BrandMascot({
  size = 240,
  priority = false,
  className,
}: {
  size?: number
  priority?: boolean
  className?: string
}) {
  const [missing, setMissing] = React.useState(false)
  if (missing) return null
  const nat = NATURAL.mascot
  return (
    <Image
      src={BRAND_ASSETS.mascot}
      alt="มาสคอต Austone"
      width={size}
      height={Math.round((size * nat.h) / nat.w)}
      priority={priority}
      onError={() => setMissing(true)}
      className={cn('h-auto select-none', className)}
      style={{ width: size, height: 'auto' }}
    />
  )
}

/**
 * โลโก้แอป — หัว+อกมาสคอตบนกระเบื้องดำถ่านมุมมน (รูปเดียวกับ favicon/app icon)
 * บนพื้นดำควรใส่ className ring สีเหลืองให้เห็นขอบกระเบื้อง
 * @param size ด้านของกระเบื้อง (px)
 */
export function BrandMark({ size = 40, priority = false, className }: { size?: number; priority?: boolean; className?: string }) {
  return (
    <Image
      src={BRAND_ASSETS.mark}
      alt="Austone Tire"
      width={size}
      height={size}
      priority={priority}
      // ไฟล์เล็ก (256px) เสิร์ฟตรงจาก /public — ข้าม image optimizer ที่ cache รูปเก่าไว้หลายชั่วโมง
      unoptimized
      className={cn('select-none rounded-[22%]', className)}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * ตราดาว Austone (ดาวดำบนวงรีเหลือง) — ใช้แทนโลโก้เต็มเมื่อพื้นที่แคบ เช่น sidebar แบบย่อ
 * @param size ความกว้างของรูป (px)
 */
export function BrandStar({ size = 40, className }: { size?: number; className?: string }) {
  const nat = NATURAL.star
  return (
    <Image
      src={BRAND_ASSETS.star}
      alt="Austone"
      width={size}
      height={Math.round((size * nat.h) / nat.w)}
      className={cn('h-auto select-none', className)}
      style={{ width: size, height: 'auto' }}
    />
  )
}

/**
 * รูปยาง Austone (พื้นหลังโปร่ง) ใช้เป็นภาพประกอบหน้า login
 * @param size ความกว้างของรูป (px)
 */
export function BrandTire({
  size = 420,
  priority = false,
  className,
}: {
  size?: number
  priority?: boolean
  className?: string
}) {
  const nat = NATURAL.tire
  return (
    <Image
      src={BRAND_ASSETS.tire}
      alt=""
      aria-hidden
      width={size}
      height={Math.round((size * nat.h) / nat.w)}
      priority={priority}
      className={cn('h-auto select-none', className)}
      style={{ width: size, height: 'auto' }}
    />
  )
}
