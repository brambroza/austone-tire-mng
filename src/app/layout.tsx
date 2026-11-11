import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import './globals.css'

const thai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Austone Tire — ระบบจัดการยางรถบรรทุก',
  description: 'บันทึกถอด-ใส่ยางและติดตามระยะวิ่งของยางแต่ละเส้น แจ้งเตือนเมื่อถึงเกณฑ์',
  applicationName: 'Austone Tire',
  appleWebApp: { capable: true, title: 'Austone Tire', statusBarStyle: 'black' },
  // favicon.ico / icon.png / apple-icon.png ใน src/app ถูก Next ใส่ <link> ให้อัตโนมัติ (มาสคอตบนพื้นเหลือง)
}

export const viewport: Viewport = {
  themeColor: '#f5e907',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // กัน iPad zoom ตอนโฟกัส input
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
