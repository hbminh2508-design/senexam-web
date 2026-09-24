'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Rocket,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  Check,
  X,
  MessageSquare,
  Send,
  FlaskConical,
  Award,
  Layers,
  Bot,
  Brain,
  Calendar,
  Swords,
  BookOpen,
  Box,
  MessageCircle,
  Crown,
} from 'lucide-react'
import { isRoadmapDateReached } from '@/lib/roadmapSchedule'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newbeta-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newbeta-body' })

export default function NewBetaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [updatingBeta, setUpdatingBeta] = useState(false)

  // Feedback form state
  const [betaFeedback, setBetaFeedback] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  // OTP Email Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSentEmail, setOtpSentEmail] = useState<string>('')
  const [otpHintCode, setOtpHintCode] = useState<string | null>(null)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      setUserId(user.id)
      await ensureStudentProfile(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_beta_tester')
        .eq('id', user.id)
        .single()

      const isBeta = profile ? profile.is_beta_tester === true : (localStorage.getItem('senexam_beta_tester') === '1')
      setIsBetaTester(isBeta)
      localStorage.setItem('senexam_beta_tester', isBeta ? '1' : '0')
      setLoading(false)
    }

    init()
  }, [router])

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

  // Khởi động luồng gửi mã OTP về email để tham gia Beta
  const handleStartJoinBeta = async () => {
    setSendingOtp(true)
    setOtpError(null)
    setOtpHintCode(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/beta/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Không thể gửi mã xác minh email')
      }

      setOtpSentEmail(data.email || 'Email của bạn')
      setOtpHintCode(data.previewCode || null)
      setShowOtpModal(true)
      setOtpInput('')
    } catch (e: any) {
      alert(`Lỗi gửi mã xác nhận: ${e.message}`)
    } finally {
      setSendingOtp(false)
    }
  }

  // Xác thực OTP để kích hoạt Beta
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpInput.trim()) {
      setOtpError('Vui lòng nhập đủ 6 chữ số mã xác minh.')
      return
    }

    setVerifyingOtp(true)
    setOtpError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/beta/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: otpInput }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Mã xác minh không chính xác')
      }

      // Kích hoạt Beta thành công
      setIsBetaTester(true)
      localStorage.setItem('senexam_beta_tester', '1')
      localStorage.setItem('sen_beta_user', 'true')
      window.dispatchEvent(new Event('senexam-ui-prefs-changed'))
      setShowOtpModal(false)
      alert('🎉 Chúc mừng bạn đã xác minh email và gia nhập Kênh Thử Nghiệm Beta thành công!')
    } catch (err: any) {
      setOtpError(err.message || 'Lỗi xác minh mã')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Rời khỏi Kênh Beta
  const handleLeaveBeta = async () => {
    if (!confirm('Bạn có chắc chắn muốn rời khỏi Kênh Thử Nghiệm Beta không?')) return
    if (!userId) return

    setUpdatingBeta(true)
    try {
      await supabase
        .from('profiles')
        .update({
          is_beta_tester: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      localStorage.setItem('senexam_beta_tester', '0')
      localStorage.removeItem('sen_beta_user')
      window.dispatchEvent(new Event('senexam-ui-prefs-changed'))
      setIsBetaTester(false)
      alert('Bạn đã rời khỏi Kênh Thử Nghiệm Beta.')
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`)
    } finally {
      setUpdatingBeta(false)
    }
  }

  const handleSendBetaFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!betaFeedback.trim() || !userId) return

    setSendingFeedback(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userEmail = auth.user?.email || ''

      // Gửi feedback an toàn
      const insertObj: any = {
        user_id: userId,
        user_email: userEmail,
        content: `[BETA FEEDBACK] ${betaFeedback.trim()}`,
      }

      let { error } = await supabase.from('feedback').insert({
        ...insertObj,
        category: 'feature',
      })

      if (error && error.message?.includes('category')) {
        const fallbackRes = await supabase.from('feedback').insert(insertObj)
        error = fallbackRes.error
      }

      if (error) throw error

      setFeedbackSuccess(true)
      setBetaFeedback('')
      setTimeout(() => setFeedbackSuccess(false), 5000)
    } catch (err: any) {
      alert(`Lỗi gửi phản hồi: ${err.message}`)
    } finally {
      setSendingFeedback(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          <span className="font-bold text-sm">Đang tải trung tâm trải nghiệm Beta...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(236, 72, 153, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(139, 92, 246, 0.15), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(251, 207, 232, 0.5), transparent 30%), radial-gradient(circle at 90% 20%, rgba(221, 214, 254, 0.5), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-0.5 text-[11px] font-black text-pink-600 dark:text-pink-400 border border-pink-500/30 uppercase tracking-wider">
                  <Sparkles className="inline h-3.5 w-3.5 mr-1 text-purple-500" /> SenExam Insider
                </span>
                <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">
                  2026 Preview
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                Chương Trình Trải Nghiệm Thử Nghiệm (Beta Program)
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* HERO STATUS CARD */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isBetaTester
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                    : 'bg-black/5 dark:bg-white/10 text-[#6B7280] dark:text-slate-400'
                }`}>
                  {isBetaTester ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {isBetaTester ? 'Bạn Đang Là Thành Viên Beta' : 'Chưa Tham Gia Kênh Beta'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                {isBetaTester ? 'Cảm ơn bạn đã tiên phong cùng SenExam!' : 'Khám phá sớm các công nghệ ôn thi tương lai'}
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                {isBetaTester
                  ? 'Bạn có quyền truy cập sớm nhất vào các tính năng thử nghiệm, trực tiếp trải nghiệm roadmap các bản cập nhật mới và đóng góp ý kiến để định hình SenExam 2026.'
                  : 'Tham gia chương trình Beta miễn phí để mở khóa huy hiệu Beta Member và trải nghiệm trước các bản cập nhật tính năng mới nhất trước khi phát hành chính thức.'}
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              {isBetaTester ? (
                <button
                  type="button"
                  onClick={handleLeaveBeta}
                  disabled={updatingBeta}
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-6 py-3.5 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {updatingBeta ? <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> : <X className="inline h-4 w-4 mr-1" />}
                  Rời Khỏi Kênh Beta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartJoinBeta}
                  disabled={sendingOtp}
                  className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white px-8 py-4 text-xs font-black uppercase tracking-wider transition shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Đăng Ký Tham Gia Beta (Xác Minh Email)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROADMAP 2027: LỘ TRÌNH VÀ CÁC BẢN CẬP NHẬT TƯƠNG LAI */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <Rocket className="h-6 w-6 text-purple-500" />
              <div>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                  Lộ Trình & Bản Cập Nhật Năm 2027 (Roadmap 2027)
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Hệ thống tự động kích hoạt cho bản chính thức đúng ngày. Thành viên Beta được tiếp cận sớm ngay hôm nay:
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 self-start sm:self-auto">
              {isBetaTester ? '⚡ Bạn đang có quyền truy cập sớm' : '🔒 Tự động mở đúng ngày'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* GIAI ĐOẠN Q1/2027 */}
            <div className="rounded-2xl border-2 border-pink-500/30 bg-pink-500/5 dark:bg-pink-500/10 p-5 space-y-4 transition hover:shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 font-bold">
                    <Box className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                    isRoadmapDateReached('Q1_2027')
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isBetaTester
                      ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400'
                      : 'bg-black/10 dark:bg-white/10 text-slate-500'
                  }`}>
                    {isRoadmapDateReached('Q1_2027') ? '✅ Đã Phát Hành' : isBetaTester ? '⚡ Beta Trải Nghiệm' : 'Q1 • 30/01/2027'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider block">
                    Giai đoạn 1 • Tự động: 30/01/2027
                  </span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                    SenGraph & Bong Bóng Chat Sen Chat
                  </h4>
                </div>

                <ul className="text-xs text-[#4B5563] dark:text-slate-300 space-y-2 leading-relaxed font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                    <span><strong>SenGraph:</strong> Vẽ đồ thị 2D & mô hình không gian 3D tương tác, tích hợp Sen AI Toán học giải bài từ ảnh đề thi.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                    <span><strong>Bong bóng chat Sen Chat:</strong> Nổi góc màn hình tiện lợi, tự động lưu trữ và đồng bộ phiên trò chuyện về SenAI Studio.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                    <span><strong>Quản lý Quota SenAI:</strong> Bảng theo dõi hạn mức câu hỏi ngày tại <Link href="/new-senai" className="font-bold underline text-pink-600 dark:text-pink-400">/new-senai</Link>.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-pink-500/20 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Trạng thái:</span>
                <span className="font-bold text-pink-600 dark:text-pink-400">
                  {isRoadmapDateReached('Q1_2027') ? 'Chính thức khả dụng' : 'Khởi chạy 30/01/2027'}
                </span>
              </div>
            </div>

            {/* GIAI ĐOẠN Q2/2027 */}
            <div className="rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/10 p-5 space-y-4 transition hover:shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                    isRoadmapDateReached('Q2_2027')
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isBetaTester
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                      : 'bg-black/10 dark:bg-white/10 text-slate-500'
                  }`}>
                    {isRoadmapDateReached('Q2_2027') ? '✅ Đã Phát Hành' : isBetaTester ? '⚡ Beta Có Sẵn Ngay' : 'Q2 • 19/05/2027'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                    Giai đoạn 2 • Tự động: 19/05/2027
                  </span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                    Sen Exam Canvas & Phân Nhóm Dashboard
                  </h4>
                </div>

                <ul className="text-xs text-[#4B5563] dark:text-slate-300 space-y-2 leading-relaxed font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Sen Exam Canvas:</strong> Môi trường thi bảo mật cao chống gian lận 100%, khóa màn hình và chống chuyển tab.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Dashboard theo nhóm công năng:</strong> Tái tổ chức nút tính năng theo 4 nhóm (Học tập, Toán & Khảo thí, SenAI, Tiện ích) tránh bị loạn giao diện.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Đặc quyền Beta:</strong> Thành viên Beta được trải nghiệm bố cục công năng này <em>ngay hôm nay trên Dashboard</em>.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Trạng thái:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {isRoadmapDateReached('Q2_2027') ? 'Chính thức khả dụng' : 'Khởi chạy 19/05/2027'}
                </span>
              </div>
            </div>

            {/* GIAI ĐOẠN Q4/2027 */}
            <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-5 space-y-4 transition hover:shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold">
                    <Crown className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                    isRoadmapDateReached('Q4_2027')
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isBetaTester
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-black/10 dark:bg-white/10 text-slate-500'
                  }`}>
                    {isRoadmapDateReached('Q4_2027') ? '✅ Đã Phát Hành' : isBetaTester ? '⚡ Beta Đặc Quyền' : 'Q4 • 05/12/2027'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    Giai đoạn 3 • Tự động: 05/12/2027
                  </span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                    Gói Sen Max & Lộ Trình SenGraph 2.0
                  </h4>
                </div>

                <ul className="text-xs text-[#4B5563] dark:text-slate-300 space-y-2 leading-relaxed font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span><strong>Gói Sen Max:</strong> Bản cao cấp nhất trong hệ sinh thái SenAI với <strong>500 câu hỏi/ngày</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span><strong>Giá cước & Đặc quyền:</strong> Giá 318 SenCash/tháng (gấp đôi gói Ultra) và được <strong>15 lượt hỏi AI trong SenAI Graph</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span><strong>Giới thiệu SenGraph 2.0:</strong> Công bố kiến trúc thế hệ tiếp theo của SenGraph (các tính năng chi tiết sẽ được cập nhật sau).</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Trạng thái:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {isRoadmapDateReached('Q4_2027') ? 'Chính thức khả dụng' : 'Khởi chạy 05/12/2027'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* BETA FEEDBACK & BUG REPORT */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-black/10 dark:border-white/10">
            <MessageSquare className="h-5 w-5 text-pink-500" />
            <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
              Đóng Góp Ý Kiến & Báo Lỗi Cho Kênh Thử Nghiệm
            </h3>
          </div>

          <form onSubmit={handleSendBetaFeedback} className="space-y-3 text-xs font-bold">
            <div>
              <label className="text-[#6B7280] dark:text-slate-400 block mb-1">
                Ý kiến đóng góp hoặc tính năng bạn mong muốn xuất hiện trên SenExam:
              </label>
              <textarea
                rows={3}
                value={betaFeedback}
                onChange={(e) => setBetaFeedback(e.target.value)}
                placeholder="VD: Tôi muốn có thêm phần hẹn giờ thi thử theo nhóm bạn bè..."
                className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3.5 outline-none focus:border-pink-500 text-xs font-semibold"
              />
            </div>

            {feedbackSuccess && (
              <div className="rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 p-3 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Cảm ơn bạn! Ý kiến của bạn đã được gửi trực tiếp đến đội ngũ phát triển SenExam.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sendingFeedback || !betaFeedback.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 text-xs font-black uppercase tracking-wider shadow transition hover:scale-105 disabled:opacity-50"
            >
              {sendingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi Ý Kiến Thử Nghiệm
            </button>
          </form>
        </div>
      </div>

      {/* MODAL XÁC MINH EMAIL THAM GIA BETA */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-md">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                  Xác Minh Email Tham Gia Beta
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 font-semibold">
                  Mã 6 chữ số đã gửi đến: <strong className="text-purple-600 dark:text-purple-400">{otpSentEmail}</strong>
                </p>
              </div>
            </div>

            {otpHintCode && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs font-bold text-purple-700 dark:text-purple-300">
                <span>💡 Mã xác minh của bạn: </span>
                <strong className="tracking-widest font-black text-sm bg-purple-600 text-white px-2 py-0.5 rounded-lg ml-1">
                  {otpHintCode}
                </strong>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Nhập mã xác minh (6 chữ số):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full text-center text-2xl font-black tracking-widest rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 p-3 outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              {otpError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleStartJoinBeta}
                  disabled={sendingOtp}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 py-3 text-xs font-bold transition hover:bg-black/5"
                >
                  {sendingOtp ? 'Đang gửi lại...' : 'Gửi lại mã'}
                </button>

                <button
                  type="submit"
                  disabled={verifyingOtp || otpInput.length < 6}
                  className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow-lg transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Xác Nhận & Kích Hoạt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
