'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import {
  Shield,
  ArrowLeft,
  Lock,
  Eye,
  Camera,
  Server,
  KeyRound,
  FileCheck,
  Sun,
  Moon,
  Database,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-privacy-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-privacy-body' })

export default function PrivacyPolicyPage() {
  const { themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))
  }, [])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const themeVars = getModernThemeVars(themeColor || 'indigo', isDark)

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#F4F7FB] dark:bg-[#080D1A] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 relative`}
      style={{
        ...themeVars,
        fontFamily: 'var(--font-privacy-body), sans-serif',
      }}
    >
      {/* Background Glow Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 dark:bg-emerald-600/15 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-sky-500/10 dark:bg-sky-600/10 blur-3xl" />
      </div>

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/new-idp"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại Đăng nhập
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">SenExam Privacy</span>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xs hover:scale-105 transition cursor-pointer"
              title="Chuyển chế độ sáng/tối"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-emerald-500" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        {/* Title Banner */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Shield className="h-4 w-4" /> Nghị Định 13/2023/NĐ-CP • Tiêu Chuẩn Bảo Mật 256-bit
          </div>
          <h1
            className="text-3xl sm:text-5xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-privacy-heading)' }}
          >
            Chính Sách Quyền Riêng Tư
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Cam kết bảo vệ dữ liệu cá nhân, quyền riêng tư của học sinh, phụ huynh và giáo viên trên toàn bộ hệ thống SenExam.
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-12 shadow-2xl backdrop-blur-2xl space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">1</span>
              Nguyên Tắc Thu Thập Dữ Liệu
            </h2>
            <p>
              SenExam tôn trọng quyền riêng tư của bạn và cam kết tuân thủ nghiêm ngặt <strong>Nghị định số 13/2023/NĐ-CP</strong> của Chính phủ Việt Nam về bảo vệ dữ liệu cá nhân. Chúng tôi chỉ thu thập các thông tin tối thiểu cần thiết để vận hành tài khoản, cung cấp dịch vụ thi thử trực tuyến và phân tích kết quả học tập.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">2</span>
              Các Loại Dữ Liệu Được Thu Thập
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1.5">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-500" /> Dữ liệu hồ sơ học sinh
                </p>
                <ul className="list-disc pl-4 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <li>Họ và tên, địa chỉ email, số điện thoại liên lạc.</li>
                  <li>Lớp học, trường THPT/Đại học, tỉnh/thành phố sinh sống.</li>
                  <li>Lịch sử điểm số bài thi, biểu đồ tiến độ năng lực.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1.5">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="h-4 w-4 text-amber-500" /> Dữ liệu giám sát phòng thi (Proctoring)
                </p>
                <ul className="list-disc pl-4 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <li>Luồng webcam thời gian thực trong thời gian diễn ra bài thi có bật giám sát.</li>
                  <li>Nhật ký hành vi vi phạm (chuyển tab, phát hiện thiết bị lạ).</li>
                  <li>Ảnh chụp bằng chứng nghi vấn gian lận.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">3</span>
              Quy Trình Xử Lý & Thời Hạn Hủy Dữ Liệu Camera
            </h2>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4" /> Cơ chế tự động hủy sau 07 ngày:
              </p>
              <p className="leading-relaxed">
                Để bảo vệ quyền hình ảnh cá nhân của học sinh, toàn bộ các bản ghi hình ảnh giám sát vi phạm từ hệ thống <strong>Gemini Live Proctoring</strong> chỉ được lưu giữ tạm thời trên đám mây trong vòng <strong>07 ngày</strong> kể từ khi kết thúc ca thi. Sau 07 ngày, hệ thống sẽ thực thi lệnh tiêu hủy vĩnh viễn không thể khôi phục.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">4</span>
              Biện Pháp Bảo Mật Kỹ Thuật (Sen Heart Armor)
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li><strong>Mã hóa đầu cuối:</strong> Dữ liệu truyền tải giữa thiết bị của bạn và máy chủ SenExam luôn được mã hóa thông qua giao thức TLS 1.3 và thuật toán mã hóa 256-bit chuẩn ngân hàng.</li>
              <li><strong>Bảo vệ cơ sở dữ liệu:</strong> Sử dụng cơ chế Row Level Security (RLS) của Supabase Cloud, đảm bảo thí sinh chỉ có thể truy xuất dữ liệu cá nhân của chính mình.</li>
              <li><strong>Phòng chống tấn công brute-force:</strong> Cổng IDP tích hợp khóa phiên tự động 60 giây sau 5 lần nhập sai mật khẩu để triệt tiêu nguy cơ chiếm đoạt tài khoản.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">5</span>
              Quyền Lợi Của Chủ Thể Dữ Liệu
            </h2>
            <p>
              Theo quy định pháp luật Việt Nam, bạn có các quyền sau đối với dữ liệu cá nhân của mình:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Quyền được biết & tiếp cận:</strong> Xem toàn bộ dữ liệu cá nhân được lưu trữ trong trang Cài đặt hồ sơ.</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Quyền chỉnh sửa:</strong> Tự do cập nhật họ tên, trường lớp, số điện thoại bất kỳ lúc nào.</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Quyền yêu cầu xóa bỏ:</strong> Gửi yêu cầu xóa toàn bộ tài khoản và lịch sử bài thi khỏi máy chủ.</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Quyền rút lại sự đồng ý:</strong> Dừng quyền truy cập camera giám sát bất kỳ lúc nào (đồng nghĩa rời phòng thi).</span>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-privacy-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">6</span>
              Đơn Vị Chịu Trách Nhiệm Bảo Vệ Dữ Liệu
            </h2>
            <p>
              Mọi yêu cầu thực thi quyền riêng tư hoặc phản ánh về bảo mật dữ liệu, xin vui lòng liên hệ:
            </p>
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs space-y-1 font-mono">
              <p>Phụ trách bảo vệ dữ liệu: <strong>Data Protection Officer (DPO) - SenExam</strong></p>
              <p>Email chuyên trách: <strong>privacy@senexam.me</strong></p>
              <p>Địa chỉ liên hệ: Khu Đô thị Đại học Quốc gia Hà Nội, Hòa Lạc, Thạch Thất, Hà Nội</p>
            </div>
          </section>

        </div>

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 SenExam.ME — Cam Kết Bảo Mật Tuyệt Đối Dữ Liệu Giáo Dục.</p>
          <div className="flex items-center justify-center gap-3 mt-2 font-bold">
            <Link href="/terms" className="hover:underline text-emerald-600 dark:text-emerald-400">Điều khoản dịch vụ</Link>
            <span>•</span>
            <Link href="/home" className="hover:underline text-emerald-600 dark:hover:text-emerald-400">Giới thiệu SenExam</Link>
            <span>•</span>
            <Link href="/new-idp" className="hover:underline text-emerald-600 dark:hover:text-emerald-400">Cổng IDP</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
