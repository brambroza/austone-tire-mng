import type { Metadata } from 'next'

export const metadata: Metadata = {
  // ลิงก์ส่วนตัวของลูกค้า — ห้าม search engine เก็บ
  robots: { index: false, follow: false },
}

/** Layout หน้า public (ไม่ต้อง login) — ไม่มีเมนู ไม่มี AppShell ใช้ได้บนมือถือเป็นหลัก */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh">{children}</main>
}
