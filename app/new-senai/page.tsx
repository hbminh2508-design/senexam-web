'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  SENAI_PLANS,
  SENAI_TIER_DAILY_LIMIT,
  SENAI_TIER_LABEL,
  SENGRAPH_AI_DAILY_LIMIT,
  getEffectiveSenaiTier,
  type SenAiTierCode,
} from '@/lib/senaiTiers'
import {
  ROADMAP_ITEMS_2027,
  isRoadmapDateReached,
  canAccessSenMaxPlan,
} from '@/lib/roadmapSchedule'
import RoadmapTimeline from '@/app/components/RoadmapTimeline'
import {
  ArrowLeft,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Calendar,
  CreditCard,
  Crown,
  ChevronRight,
  Sun,
  Moon,
  Loader2,
  TrendingUp,
  Brain,
  Box,
  MessageCircle,
  HelpCircle,
  Rocket,
  ShieldCheck,
  Star,
  Lock,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-quota-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-quota-body' })

export default function SenAiQuotaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [todayQuestionsCount, setTodayQuestionsCount] = useState(0)
  const [todaySenGraphAiCount, setTodaySenGraphAiCount] = useState(0)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      setUserId(user.id)
      await ensureStudentProfile(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_beta_tester, sencash_balance, senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
        .eq('id', user.id)
        .single()

      setProfile(prof || null)
      const isBeta = prof ? prof.is_beta_tester === true : (localStorage.getItem('senexam_beta_tester') === '1')
      setIsBetaTester(isBeta)

      // Đếm số câu hỏi SenAI đã dùng hôm nay
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count: qCount } = await supabase
        .from('senai_question_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('asked_at', startOfToday.toISOString())

      setTodayQuestionsCount(qCount || 0)

      // Kiểm tra hạn mức SenGraph AI hôm nay
      try {
        const res = await fetch('/api/sengraph/ai', { method: 'GET' })
        if (res.ok) {
          const gData = await res.json()
          setTodaySenGraphAiCount(gData.usedCount || 0)
        }
      } catch (err) {
        console.warn('Lỗi tải quota SenGraph:', err)
      }

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

  // Phân tích trạng thái hạng hiện tại
  const effectiveTier: SenAiTierCode = useMemo(() => {
    return getEffectiveSenaiTier(profile)
  }, [profile])

  const tierLabel = SENAI_TIER_LABEL[effectiveTier] || 'SenAI'
  const dailyQuestionLimit = SENAI_TIER_DAILY_LIMIT[effectiveTier] || 10
  const dailyGraphAiLimit = SENGRAPH_AI_DAILY_LIMIT[effectiveTier] || 0

  const remainingQuestions = Math.max(0, dailyQuestionLimit - todayQuestionsCount)
  const remainingGraphQuestions = Math.max(0, dailyGraphAiLimit - todaySenGraphAiCount)

  const isMaxAccessible = canAccessSenMaxPlan(isBetaTester)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
          <span className="font-bold text-sm">Đang tải hạn mức Quota SenAI...</span>
        </div>
      </div>
    )
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 pb-16`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 15% 10%, rgba(236, 72, 153, 0.12), transparent 35%), radial-gradient(circle at 85% 15%, rgba(139, 92, 246, 0.15), transparent 30%), var(--bg)'
          : 'radial-gradient(circle at 15% 10%, rgba(254, 205, 211, 0.45), transparent 35%), radial-gradient(circle at 85% 15%, rgba(216, 180, 254, 0.35), transparent 30%), var(--bg)',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* TOP BAR / NAVIGATION */}
        <div className="flex items-center justify-between">
          <Link
            href="/new-dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm transition hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại Dashboard
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/new-beta"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-pink-500/20 bg-pink-500/10 px-3.5 py-2 text-xs font-bold text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 transition"
            >
              <Sparkles className="h-4 w-4 text-pink-500" />
              <span>{isBetaTester ? 'Beta Tester' : 'Tham gia Beta'}</span>
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* HERO BANNER: TỔNG QUAN QUOTA HIỆN TẠI */}
        <div className="relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm">
                  <Brain className="h-3.5 w-3.5" /> Quản Lý Quota SenAI
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {tierLabel}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                Hạn mức câu hỏi & Bản quyền trí tuệ SenAI
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                Theo dõi dung lượng truy vấn AI trong ngày, lượt phân tích hình học trong SenGraph và quản lý các đặc quyền nâng cao của bạn.
              </p>
            </div>

            {/* Ví SenCash Quick Balance */}
            <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Số dư SenCash</p>
                <p className="text-xl font-black text-amber-900 dark:text-amber-200" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                  {(profile?.sencash_balance || 0).toLocaleString('vi-VN')} SC
                </p>
                <Link href="/new-sencash" className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  Nạp thêm SenCash →
                </Link>
              </div>
            </div>
          </div>

          {/* QUOTA STAT CARDS */}
          <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* Thẻ 1: SenAI Chat Hàng Ngày */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                  <MessageCircle className="h-4 w-4" /> SenAI Chat / Ngày
                </span>
                <span>{todayQuestionsCount} / {dailyQuestionLimit} câu</span>
              </div>
              <div className="flex items-baseline justify-between">
                <strong className="text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                  {remainingQuestions}
                </strong>
                <span className="text-xs font-semibold text-slate-500">lượt còn lại hôm nay</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, (todayQuestionsCount / dailyQuestionLimit) * 100)}%` }}
                />
              </div>
            </div>

            {/* Thẻ 2: SenGraph AI Hàng Ngày */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Box className="h-4 w-4" /> SenGraph AI (2D & 3D)
                </span>
                <span>{todaySenGraphAiCount} / {dailyGraphAiLimit} câu</span>
              </div>
              <div className="flex items-baseline justify-between">
                <strong className="text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                  {remainingGraphQuestions}
                </strong>
                <span className="text-xs font-semibold text-slate-500">lượt còn lại hôm nay</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                  style={{
                    width: dailyGraphAiLimit === 0 ? '0%' : `${Math.min(100, (todaySenGraphAiCount / dailyGraphAiLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Thẻ 3: Trạng thái gói & Thời hạn */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Crown className="h-4 w-4" /> Bản Quyền Gói
                </span>
                <span className="capitalize">{effectiveTier}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <strong className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                  {profile?.senai_tier_permanent
                    ? 'Bản Quyền Vĩnh Viễn'
                    : profile?.senai_tier_expires_at
                    ? `Hết hạn ${new Date(profile.senai_tier_expires_at).toLocaleDateString('vi-VN')}`
                    : 'Gói Miễn Phí (Cơ Bản)'}
                </strong>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {effectiveTier === 'max'
                  ? 'Gói Sen Max cao cấp nhất — 500 câu/ngày & 15 lần SenGraph'
                  : effectiveTier === 'ultra'
                  ? 'Gói SenAI Ultra — 200 câu/ngày & 5 lần SenGraph'
                  : effectiveTier === 'plus'
                  ? 'Gói SenAI Plus — 50 câu/ngày & 1 lần SenGraph'
                  : 'Nâng cấp lên Plus, Ultra hoặc Sen Max để mở khoá tính năng phân tích hình ảnh và đồ thị.'}
              </p>
            </div>

          </div>
        </div>

        {/* ROADMAP 2027 BANNER (TỰ ĐỘNG CẬP NHẬT THEO LỊCH) */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-purple-500" />
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                Lộ Trình Tự Động Kích Hoạt (Roadmap 2027)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {isBetaTester ? '⚡ Bạn đang truy cập qua Kênh Beta' : '🔒 Tự động kích hoạt đúng ngày phát hành'}
            </span>
          </div>

          <RoadmapTimeline isBetaTester={isBetaTester} initialQuarter="Q1_2027" />
        </div>

        {/* BẢNG SO SÁNH & DANH SÁCH GÓI CƯỚC SENAI */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                Bảng So Sánh Quyền Lợi & Gói Cước SenAI
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Nâng cấp trực tiếp bằng SenCash để nhận thêm lượt hỏi mỗi ngày và các quyền năng đặc biệt.
              </p>
            </div>

            <Link
              href="/new-exclusive-store"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow transition hover:scale-105 self-start sm:self-auto"
            >
              <Crown className="h-4 w-4" /> Cửa Hàng SenAI Độc Quyền
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* GÓI 1: LITE */}
            <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition">
              <div className="space-y-3">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-700 dark:text-slate-300">
                  Cơ bản
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Lite</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">29</span>
                  <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>20 câu hỏi</strong> / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Giải bài và tóm tắt lý thuyết</span>
                  </li>
                  <li className="flex items-center gap-2 opacity-50">
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Không có SenGraph AI</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/new-exclusive-store"
                className="w-full text-center py-2.5 rounded-xl border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-xs font-black uppercase tracking-wider hover:bg-black/10 transition"
              >
                Nâng cấp Lite
              </Link>
            </div>

            {/* GÓI 2: PLUS */}
            <div className="rounded-[26px] border border-pink-500/30 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Phổ biến
              </div>
              <div className="space-y-3">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:text-pink-400">
                  Nâng cao
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Plus</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">100</span>
                  <span className="text-xs font-bold text-slate-500">SC / tháng (hoặc vĩnh viễn)</span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>50 câu hỏi</strong> / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>1 câu hỏi / ngày</strong> trong SenGraph AI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Có bản Vĩnh viễn (2.999 SC)</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/new-exclusive-store"
                className="w-full text-center py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black uppercase tracking-wider transition shadow-sm"
              >
                Nâng cấp Plus
              </Link>
            </div>

            {/* GÓI 3: ULTRA */}
            <div className="rounded-[26px] border border-purple-500/30 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition">
              <div className="space-y-3">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  Chuyên sâu
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Ultra</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">159</span>
                  <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>200 câu hỏi</strong> / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>5 câu hỏi / ngày</strong> trong SenGraph AI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Mở khóa toàn bộ SenAI Studio</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/new-exclusive-store"
                className="w-full text-center py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition shadow-sm"
              >
                Nâng cấp Ultra
              </Link>
            </div>

            {/* GÓI 4: SEN MAX (BẢN CAO CẤP NHẤT) */}
            <div className="rounded-[26px] border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-white/80 to-purple-500/10 dark:from-amber-500/20 dark:via-slate-900/80 dark:to-purple-900/20 p-5 flex flex-col justify-between space-y-4 hover:shadow-2xl transition relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-rose-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                <Crown className="h-3 w-3" /> Cao cấp nhất
              </div>

              <div className="space-y-3">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Đỉnh cao công nghệ
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5" style={{ fontFamily: 'var(--font-quota-heading)' }}>
                  Sen Max <Sparkles className="h-5 w-5 text-amber-500" />
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400">318</span>
                  <span className="text-xs font-bold text-slate-500">SC / tháng (x2 Ultra)</span>
                </div>
                <ul className="text-xs text-slate-700 dark:text-slate-200 space-y-2 pt-2 border-t border-amber-500/20 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <span><strong>500 câu hỏi</strong> / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <span><strong>15 lần hỏi AI</strong> trong SenGraph / ngày</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Deep Think siêu tốc độ cao</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Ưu tiên trải nghiệm SenGraph 2.0</span>
                  </li>
                </ul>
              </div>

              <div>
                {isMaxAccessible ? (
                  <Link
                    href="/new-exclusive-store"
                    className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Crown className="h-4 w-4" /> Nâng Cấp Sen Max
                  </Link>
                ) : (
                  <div className="w-full text-center py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                    Khởi chạy chính thức: 05/12/2027 (Beta mở sớm)
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}
