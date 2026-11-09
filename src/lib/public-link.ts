/**
 * ลิงก์ส่วนตัวให้ลูกค้าดูประวัติถอด-ใส่ยางของตัวเองโดยไม่ต้อง login (/p/<token>)
 * ใช้ Web Crypto เพื่อให้ทำงานได้ทั้ง Node และ browser และทดสอบด้วย node --test ได้
 *
 * token = 32 ตัวอักษร base64url (24 ไบต์สุ่ม ≈ 192 บิต) — เดาไม่ได้ในทางปฏิบัติ
 * ร้านสุ่มใหม่ได้ทุกเมื่อ (ลิงก์เก่าใช้ไม่ได้ทันที) หรือปิดลิงก์ด้วยการตั้งค่าเป็น null
 */

/** จำนวนไบต์สุ่มของ token */
const PUBLIC_TOKEN_BYTES = 24

/** ความยาว token เมื่อเข้ารหัส base64url (24 ไบต์ → 32 ตัวอักษร) */
export const PUBLIC_TOKEN_LENGTH = 32

/** รูปแบบที่ยอมรับ — base64url ล้วน ความยาวตายตัว (RPC ฝั่ง DB กัน token สั้นกว่า 20 ซ้ำอีกชั้น) */
export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/

/** path ของหน้า public (ไม่มี domain) */
export const PUBLIC_HISTORY_BASE_PATH = '/p'

/**
 * แปลงไบต์เป็น base64url (ไม่มี = ท้ายสาย) โดยไม่พึ่ง Buffer ของ Node
 * @param bytes ไบต์สุ่ม
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * สุ่ม token ใหม่สำหรับลิงก์ส่วนตัว
 * @param fill ฟังก์ชันเติมไบต์สุ่ม (ส่งเองได้ตอนทดสอบ) — ค่าเริ่มต้นใช้ crypto.getRandomValues
 */
export function generatePublicToken(
  fill: (bytes: Uint8Array) => void = (bytes) => globalThis.crypto.getRandomValues(bytes),
): string {
  const bytes = new Uint8Array(PUBLIC_TOKEN_BYTES)
  fill(bytes)
  return toBase64Url(bytes)
}

/**
 * token นี้มีรูปแบบถูกต้องไหม — ใช้คัดคำขอขยะทิ้งก่อนถึงฐานข้อมูล
 * @param token ค่าจาก URL
 */
export function isPublicTokenFormat(token: string | null | undefined): boolean {
  return typeof token === 'string' && PUBLIC_TOKEN_PATTERN.test(token)
}

/**
 * path ของหน้า public สำหรับ token นี้ เช่น /p/AbC...
 * @param token token ของบริษัท
 */
export function publicHistoryPath(token: string): string {
  return `${PUBLIC_HISTORY_BASE_PATH}/${token}`
}

/**
 * URL เต็มของลิงก์ส่วนตัว
 * @param baseUrl origin ของแอป เช่น https://tire.example.com (ตัด / ท้ายให้)
 * @param token token ของบริษัท
 */
export function publicHistoryUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${publicHistoryPath(token)}`
}
