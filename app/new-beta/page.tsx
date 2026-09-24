'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import RoadmapTimeline from '@/app/components/RoadmapTimeline'
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
  Crown,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newbeta-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newbeta-body' })

export default function NewBetaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [updatingBeta, setUpdatingBeta] = useState(false)

  // Mã mời Beta (chặn người bình thường)
  const [inviteCode, setInviteCode] = useState('')
  const [verifyingInvite, setVerifyingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Feedback form state
  const [betaFeedback, setBetaFeedback] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

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
        .select('is_beta_tester, role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'student'
      setUserRole(role)
      const isBeta = (profile ? profile.is_beta_tester === true : (localStorage.getItem('senexam_beta_tester') === '1')) || role === 'admin'
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

  // Kích hoạt Beta bằng mã mời (Dành cho thành viên được cấp mã)
  const handleVerifyInviteKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) {
      setInviteError('Vui lòng nhập mã mời Beta')
      return
    }

    setVerifyingInvite(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/beta/verify-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key: inviteCode.trim() }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Mã mời thử nghiệm Beta không hợp lệ')
      }

      setIsBetaTester(true)
      localStorage.setItem('senexam_beta_tester', '1')
      localStorage.setItem('sen_beta_user', 'true')
      window.dispatchEvent(new Event('senexam-ui-prefs-changed'))
      setInviteSuccess('🎉 Kích hoạt quyền truy cập Beta thành công!')
    } catch (err: any) {
      setInviteError(err.message || 'Mã mời không chính xác')
    } finally {
      setVerifyingInvite(false)
    }
  }

  // Rời khỏi Kênh Beta
  const handleLeaveBeta = async () => {
    if (!confirm('Bạn có chắc chắn muốn rời khỏi Kênh Thử Nghiệm Beta không? Bạn sẽ cần mã mời để tham gia lại.')) return
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
                  2027 Preview
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

        {/* NẾU LÀ NGƯỜI DÙNG BÌNH THƯỜNG -> HIỂN THỊ MÀN HÌNH KHÓA PRIVATE BETA (CHẶN TRUY CẬP) */}
        {!isBetaTester && userRole !== 'admin' ? (
          <div className="mx-auto max-w-xl text-center space-y-6 py-6 sm:py-12 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white shadow-2xl shadow-purple-500/25">
              <Lock className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                🔒 Private Beta Access Only
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                Kênh Thử Nghiệm Giới Hạn
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
                Kênh Beta chỉ dành cho các thành viên được cấp quyền hoặc có Mã Mời Kích Hoạt (Beta Invite Key). Người dùng thông thường vui lòng quay lại Dashboard hoặc nhập mã mời để tiếp tục.
              </p>
            </div>

            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-xl text-left space-y-4">
              <form onSubmit={handleVerifyInviteKey} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1.5">
                    Nhập mã mời thử nghiệm Beta:
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="VD: SENBETA2027"
                    className="w-full text-center text-lg sm:text-xl font-black tracking-widest uppercase rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 p-3.5 outline-none focus:border-purple-500 transition"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                    Gợi ý mã thử nghiệm nội bộ: <code className="font-mono font-bold text-purple-600 dark:text-purple-400">SENBETA2027</code>
                  </p>
                </div>

                {inviteError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {inviteSuccess && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{inviteSuccess}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href="/new-dashboard"
                    className="flex-1 text-center rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 py-3 text-xs font-bold transition hover:bg-black/5 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Quay Về Dashboard
                  </Link>

                  <button
                    type="submit"
                    disabled={verifyingInvite || !inviteCode.trim()}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {verifyingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                    Kích Hoạt Mã Mời
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* NẾU LÀ THÀNH VIÊN BETA HOẶC ADMIN -> HIỂN THỊ ĐẦY ĐỦ ROADMAP TIMELINE VÀ ĐẶC QUYỀN */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* HERO STATUS CARD */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-3 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md">
                      <CheckCircle2 className="h-4 w-4" />
                      Bạn Đang Là Thành Viên Beta
                    </span>
                    {userRole === 'admin' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Admin Access
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                    Cảm ơn bạn đã tiên phong cùng SenExam!
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                    Bạn có quyền truy cập sớm nhất vào các tính năng thử nghiệm, trải nghiệm lộ trình Roadmap 2027 và đóng góp ý kiến để định hình các phiên bản tiếp theo của SenExam.
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleLeaveBeta}
                    disabled={updatingBeta}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-6 py-3.5 text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {updatingBeta ? <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> : <X className="inline h-4 w-4 mr-1" />}
                    Rời Khỏi Kênh Beta
                  </button>
                </div>
              </div>
            </div>

            {/* ROADMAP 2027: DẠNG ĐƯỜNG THẲNG DI CHUYỂN VÀO MỚI ĐẦY ĐỦ LỘ TRÌNH */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <Rocket className="h-6 w-6 text-purple-500" />
                  <div>
                    <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newbeta-heading)' }}>
                      Lộ Trình & Bản Cập Nhật Năm 2027 (Roadmap 2027)
                    </h3>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400">
                      Đường thẳng tương tác: Di chuyển chuột hoặc chạm vào từng mốc thời gian để xem chi tiết toàn bộ tính năng.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 self-start sm:self-auto">
                  ⚡ Đặc quyền Beta: Trải nghiệm sớm ngay hôm nay
                </span>
              </div>

              {/* ROADMAP TIMELINE STRAIGHT LINE COMPONENT */}
              <RoadmapTimeline isBetaTester={isBetaTester} initialQuarter="Q1_2027" />
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
        )}
      </div>
    </main>
  )
}
