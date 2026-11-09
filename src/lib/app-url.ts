import { headers } from 'next/headers'

/**
 * origin ของแอปสำหรับสร้างลิงก์เต็ม (เช่น ลิงก์ส่วนตัวให้ลูกค้า)
 * ใช้ NEXT_PUBLIC_APP_URL ถ้าตั้งไว้ ไม่งั้นอ่านจาก header ของ request ปัจจุบัน (รองรับ reverse proxy)
 */
export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
