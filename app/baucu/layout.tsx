import type { Metadata } from 'next'
import { Suspense } from 'react'
import BauCuHeader from './components/BauCuHeader'

export const metadata: Metadata = {
  title: 'Bầu cử FEPN - Ban Cán Sự & BCH Lâm Thời',
  description: 'Hệ thống bầu cử trực tuyến Ban Cán Sự & Ban Chấp Hành Lâm Thời các lớp - Khoa Vật lý Kỹ thuật & Công nghệ Nano (FEPN - VNU-UET)',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function BauCuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#fcfdff] text-slate-800 flex flex-col selection:bg-blue-600 selection:text-white"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      }}
    >
      {/* Header FEPN chuẩn trang trọng, hỗ trợ chế độ khóa lớp chống phiếu ma */}
      <Suspense
        fallback={
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs h-14" />
        }
      >
        <BauCuHeader />
      </Suspense>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer FEPN chuẩn trang trọng */}
      <footer className="border-t border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/fepn-logo.png" alt="FEPN" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-700">
              Chi đoàn & Chi hội Sinh viên • Khoa Vật lý Kỹ thuật & Công nghệ Nano (FEPN)
            </span>
          </div>
          <div>Trường Đại học Công nghệ - Đại học Quốc gia Hà Nội (VNU-UET)</div>
        </div>
      </footer>
    </div>
  )
}
