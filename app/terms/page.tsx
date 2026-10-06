'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  Lock,
  Sparkles,
  Scale,
  AlertTriangle,
  CreditCard,
  UserCheck,
  HelpCircle,
  Sun,
  Moon,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-terms-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-terms-body' })

export default function TermsOfServicePage() {
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
        fontFamily: 'var(--font-terms-body), sans-serif',
      }}
    >
      {/* Background Glow Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-amber-500/10 dark:bg-amber-600/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 dark:bg-emerald-600/10 blur-3xl" />
      </div>

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/new-idp"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại Đăng nhập
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">SenExam Legal</span>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xs hover:scale-105 transition cursor-pointer"
              title="Chuyển chế độ sáng/tối"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        {/* Title Banner */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Scale className="h-4 w-4" /> Quy Chế & Điều Khoản Sử Dụng
          </div>
          <h1
            className="text-3xl sm:text-5xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-terms-heading)' }}
          >
            Điều Khoản Dịch Vụ SenExam
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Hiệu lực từ ngày 01 tháng 01 năm 2026. Áp dụng cho toàn bộ nền tảng hệ sinh thái SenExam, cổng định danh IDP, Safe Exam Browser (SEB) và chuyên trang FEPN.
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-12 shadow-2xl backdrop-blur-2xl space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">1</span>
              Chấp Thuận Các Điều Khoản
            </h2>
            <p>
              Chào mừng bạn đến với hệ thống <strong>SenExam</strong> (gọi tắt là "Chúng tôi", "Nền tảng" hoặc "SenExam.ME"). Bằng việc truy cập, tạo tài khoản tại Cổng Định Danh Tập Trung (IDP), hoặc sử dụng bất kỳ dịch vụ thi cử, luyện đề, phân tích điểm số hay trợ lý SenAI nào của SenExam, bạn xác nhận rằng bạn đã đọc, hiểu và đồng ý chịu sự ràng buộc bởi các Điều khoản Dịch vụ này.
            </p>
            <p>
              Nếu bạn không đồng ý với bất kỳ phần nào của Điều khoản này, vui lòng ngừng sử dụng hệ thống ngay lập tức.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">2</span>
              Tài Khoản & Cổng Định Danh Tập Trung (IDP)
            </h2>
            <p>
              Cổng Định Danh <strong>SenExam IDP</strong> là hệ thống xác thực tập trung duy nhất cho toàn bộ hệ sinh thái (bao gồm SenExam Web, SEB Khảo Thí, và chuyên trang FEPN VNU).
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li><strong>Trách nhiệm người dùng:</strong> Bạn có trách nhiệm bảo mật thông tin đăng nhập (email, mật khẩu, mã OTP) và hoàn toàn chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của mình.</li>
              <li><strong>Tính chính xác của thông tin:</strong> Người học khi đăng ký phải cung cấp đầy đủ và trung thực họ tên, số điện thoại, trường lớp để phục vụ công tác tổ chức thi và cấp chứng nhận.</li>
              <li><strong>Không chia sẻ tài khoản:</strong> Nghiêm cấm hành vi cho mượn, bán hoặc chia sẻ tài khoản làm bài thi cho người khác để trục lợi điểm số hoặc vượt rào kiểm soát.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">3</span>
              Quy Chế Phòng Thi SEB & Giám Sát Chống Gian Lận
            </h2>
            <p>
              Để đảm bảo sự công bằng tuyệt đối trong các kỳ thi đánh giá năng lực (HSA, TSA) và THPT Quốc gia, SenExam áp dụng cơ chế giám sát nghiêm ngặt:
            </p>
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Quy tắc ứng xử trong phòng thi trực tuyến:
              </div>
              <ul className="list-disc pl-4 space-y-1">
                <li>Khi đề thi yêu cầu <strong>Safe Exam Browser (SEB)</strong>, thí sinh phải tuân thủ việc khóa màn hình, không mở phần mềm thứ ba hoặc chuyển đổi cửa sổ.</li>
                <li>Hệ thống <strong>AI Gemini Live Proctoring</strong> có thể quét phát hiện thiết bị lạ (điện thoại di động, tai nghe Bluetooth) và theo dõi hành vi rời khỏi khung hình.</li>
                <li>Mọi bằng chứng vi phạm (ảnh chụp, thời điểm vi phạm) sẽ được lưu trữ tự động trong 07 ngày để hội đồng thi thẩm định và có quyền hủy kết quả bài thi ngay lập tức.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">4</span>
              Gói Đăng Ký VIP & Cơ Chế SenCash (SC)
            </h2>
            <p>
              SenExam cung cấp các gói dịch vụ nâng cao bao gồm: <strong>Sen VIP</strong>, <strong>Premium+</strong>, <strong>Sen One</strong> và <strong>Sen One Lite</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
              <li><strong>SenCash (SC):</strong> Đơn vị số dư dùng để thanh toán các dịch vụ độc quyền, mở khóa ngân hàng đề đặc biệt, hoặc gia hạn gói thành viên.</li>
              <li><strong>Tự động gia hạn (Auto-Renew):</strong> Nếu người dùng bật tính năng tự động gia hạn, hệ thống sẽ tự động trừ số dư SC khi đến ngày hết hạn gói VIP. Nếu số dư SC không đủ, gói sẽ tự động trở về gói Miễn phí mà không phát sinh thêm nợ.</li>
              <li><strong>Chính sách hoàn tiền:</strong> Do tính chất phân phối tài nguyên số tức thì (đáp án, lời giải KaTeX chi tiết, công nghệ AI), các khoản nạp SC hoặc kích hoạt gói VIP không thể hoàn lại sau khi đã được sử dụng.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">5</span>
              Quyền Sở Hữu Trí Tuệ & Ngân Hàng Câu Hỏi
            </h2>
            <p>
              Toàn bộ nội dung đề thi, định dạng công thức KaTeX, cấu trúc đề thi, thuật toán phân chia điểm, mã nguồn giao diện Sen UI 3.0 và logo biểu tượng SenExam thuộc quyền sở hữu trí tuệ độc quyền của SenExam hoặc các đối tác giáo dục liên kết.
            </p>
            <p>
              Nghiêm cấm sao chép, thu thập dữ liệu tự động (scraping), phân phối lại hoặc bán lại dữ liệu câu hỏi và đáp án của SenExam mà không có sự đồng ý bằng văn bản.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">6</span>
              Giới Hạn Trách Nhiệm & Bảo Trì Hệ Thống
            </h2>
            <p>
              SenExam nỗ lực duy trì tính sẵn sàng của hệ thống đạt 99.9%. Tuy nhiên, chúng tôi không chịu trách nhiệm đối với sự cố đường truyền mạng cá nhân của thí sinh, sự cố thiết bị đầu cuối, hoặc trường hợp bất khả kháng gây gián đoạn phiên làm bài ngoài tầm kiểm soát của hệ thống máy chủ.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5" style={{ fontFamily: 'var(--font-terms-heading)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black">7</span>
              Thông Tin Liên Hệ & Trợ Giúp Pháp Lý
            </h2>
            <p>
              Nếu bạn có bất kỳ thắc mắc nào liên quan đến Điều khoản Dịch vụ này, vui lòng gửi phản hồi về ban quản trị:
            </p>
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs space-y-1 font-mono">
              <p>Hòm thư hỗ trợ: <strong>legal@senexam.me</strong> hoặc <strong>support@senexam.me</strong></p>
              <p>Đường dây nóng: <strong>(+84) 98-765-4321</strong></p>
              <p>Trụ sở vận hành: Hà Nội, Việt Nam</p>
            </div>
          </section>

        </div>

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 SenExam.ME — Nền Tảng Khảo Thí & Luyện Thi Thông Minh. Mọi quyền được bảo lưu.</p>
          <div className="flex items-center justify-center gap-3 mt-2 font-bold">
            <Link href="/privacy" className="hover:underline text-indigo-600 dark:text-indigo-400">Chính sách quyền riêng tư</Link>
            <span>•</span>
            <Link href="/home" className="hover:underline text-indigo-600 dark:hover:text-indigo-400">Giới thiệu SenExam</Link>
            <span>•</span>
            <Link href="/new-idp" className="hover:underline text-indigo-600 dark:hover:text-indigo-400">Cổng IDP</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
