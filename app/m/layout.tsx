import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import MobileNav from './components/MobileNav'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#090d16' },
  ],
}

export const metadata: Metadata = {
  title: 'SenExam Mobile | m.senexam.me',
  description: 'Giao diện thi cử và học tập thuần Mobile tối ưu 100% cho điện thoại',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SenExam Mobile',
  },
}

export default function MobileRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-start antialiased selection:bg-violet-500 selection:text-white">
      {/* Khung giả lập điện thoại khi mở trên màn hình máy tính rộng (> 768px) */}
      <div className="w-full max-w-[480px] min-h-screen bg-white dark:bg-slate-900 shadow-2xl flex flex-col relative border-x border-black/5 dark:border-white/5 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <main className="flex-1 w-full flex flex-col">
          <Suspense fallback={<div className="p-6 text-center text-xs text-slate-400">Đang tải giao diện di động...</div>}>
            {children}
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
      </div>
    </div>
  )
}
