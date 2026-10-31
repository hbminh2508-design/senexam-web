import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bầu cử FEPN - Ban Cán Sự & BCH Lâm Thời K71-P-ME2',
  description: 'Hệ thống bầu cử trực tuyến Ban Cán Sự & Ban Chấp Hành Lâm Thời Lớp K71-P-ME2 - Khoa Vật lý Kỹ thuật & Công nghệ Nano (FEPN - VNU-UET)',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function BauCuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fcfdff] text-slate-800 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Header FEPN chuẩn trang trọng */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <Link href="/baucu" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition shrink-0">
              <img
                src="/fepn-logo.png"
                alt="Logo Khoa FEPN"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-sm">
                  K71-P-ME2
                </span>
                <span className="text-[10px] text-slate-400 font-medium">NH 2026-2027</span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#002b66] leading-tight tracking-tight">
                BẦU CỬ FEPN
              </h1>
            </div>
          </Link>

          {/* 3 Nút chuyển nhanh giữa 3 trang (Không làm bottom navigation) */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/baucu/tranhcu"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
            >
              <span>1. Tranh cử</span>
            </Link>
            <Link
              href="/baucu/bophieu"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-[#002b66] text-white hover:bg-[#001f4d] rounded-lg shadow-xs transition flex items-center gap-1"
            >
              <span>2. Bỏ phiếu</span>
            </Link>
            <Link
              href="/baucu/tongket"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1"
            >
              <span>3. Tổng kết</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Footer FEPN chuẩn trang trọng */}
      <footer className="border-t border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/fepn-logo.png" alt="FEPN" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-700">
              Chi đoàn & Chi hội Lớp K71-P-ME2 • Khoa Vật lý Kỹ thuật & Công nghệ Nano (FEPN)
            </span>
          </div>
          <div>Trường Đại học Công nghệ - ĐHQGHN</div>
        </div>
      </footer>
    </div>
  )
}
