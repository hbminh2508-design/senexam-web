'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getEffectivePlanTier, type PlanTier } from '@/lib/vipMembership'
import { SENAI_PLANS, SENAI_TIER_LABEL, type SenAiPlan } from '@/lib/senaiTiers'
import {
  canAccessExclusiveStore,
  BLACK_FRIDAY_DEALS,
  applyDiscount,
  type BlackFridayDealCode,
} from '@/lib/exclusiveStore'
import { fetchSenCashBalance } from '@/lib/senCash'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Gem,
  Sparkles,
  Flame,
  Loader2,
  Wallet,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  Coins,
  Crown,
  Zap,
  ShoppingBag,
  Gift,
  Tag,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newstore-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newstore-body' })

const ELIGIBLE_PLANS = SENAI_PLANS.filter(
  (p) => (p.tier === 'plus' || p.tier === 'ultra') && p.duration !== 'trial_3d'
)

export default function NewExclusiveStorePage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

  const [planTier, setPlanTier] = useState<PlanTier | null>(null)
  const [senCashBalance, setSenCashBalance] = useState(0)
  const [monthlyFlash, setMonthlyFlash] = useState<{
    used: number
    quota: number
    remaining: number
    discountPercent: number
  } | null>(null)
  const [isBlackFriday, setIsBlackFriday] = useState(false)
  const [claimed, setClaimed] = useState<Record<string, number>>({})

  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const fetchStatus = async (token: string) => {
    try {
      const res = await fetch('/api/exclusive-store/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok) {
        setIsBlackFriday(json.isBlackFriday)
        setClaimed(json.claimed || {})
        setMonthlyFlash(json.monthlyFlash)
      }
    } catch {}
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('vip_expires_at, plan_tier')
        .eq('id', user.id)
        .single()

      setPlanTier(getEffectivePlanTier(profile))
      setSenCashBalance(await fetchSenCashBalance(user.id))

      const token = await getToken()
      if (token) await fetchStatus(token)
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

  const refreshAfterPurchase = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) setSenCashBalance(await fetchSenCashBalance(user.id))
    const token = await getToken()
    if (token) await fetchStatus(token)
  }

  const buyFlashSale = async (plan: SenAiPlan) => {
    setBuyingCode(plan.code)
    setErrorMsg('')
    setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-sign')
        return
      }

      const res = await fetch('/api/exclusive-store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dealType: 'monthly_flash', planCode: plan.code }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không mua được gói')
        return
      }

      setInfoMsg(`🎉 Chúc mừng! Bạn đã nâng cấp lên ${SENAI_TIER_LABEL[plan.tier]}, chỉ với ${json.pricePaid} SenCash!`)
      await refreshAfterPurchase()
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra')
    } finally {
      setBuyingCode(null)
    }
  }

  const buyBlackFriday = async (dealCode: BlackFridayDealCode) => {
    setBuyingCode(dealCode)
    setErrorMsg('')
    setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-sign')
        return
      }

      const res = await fetch('/api/exclusive-store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dealType: 'black_friday', blackFridayDeal: dealCode }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không mua được gói')
        return
      }

      setInfoMsg(`🔥 Săn thành công ưu đãi độc quyền! Chỉ ${json.pricePaid} SenCash.`)
      await refreshAfterPurchase()
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra')
    } finally {
      setBuyingCode(null)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          <span className="font-bold text-sm">Đang tải Cửa Hàng Độc Quyền...</span>
        </div>
      </div>
    )
  }

  const discountPercent = monthlyFlash?.discountPercent ?? 30
  const canBuyFlashSale = (monthlyFlash?.remaining ?? 1) > 0

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300 pb-16`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(168, 85, 247, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(236, 72, 153, 0.15), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(243, 232, 255, 0.6), transparent 30%), radial-gradient(circle at 90% 20%, rgba(252, 231, 243, 0.6), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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
                <span className="rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-3 py-0.5 text-[11px] font-black text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                  <Gem className="inline h-3.5 w-3.5 mr-1 text-purple-500" /> Exclusive Deals
                </span>
                <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                  Dành Riêng VIP & SenCash
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newstore-heading)' }}>
                Cửa Hàng Độc Quyền SenExam
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/new-sencash"
              className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-700 dark:text-amber-300 shadow-sm transition hover:scale-105"
            >
              <Wallet className="h-4 w-4 text-amber-500" />
              <span>Ví Sen: {senCashBalance} SC</span>
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

        {/* NOTIFICATIONS */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* FLASH SALE HERO CARD */}
        <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl relative overflow-hidden space-y-6">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Flame className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newstore-heading)' }}>
                  Ưu Đãi Flash Sale Tháng Này
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Giảm ngay {discountPercent}% khi nâng cấp gói SenAI Plus / Ultra bằng SenCash
                </p>
              </div>
            </div>
            <span className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 px-3 py-1 text-xs font-black uppercase">
              🔥 Giảm {discountPercent}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ELIGIBLE_PLANS.map((plan) => {
              const basePrice = plan.priceVnd / 1000 // Quy đổi 1000 VNĐ = 1 SC
              const discounted = Math.round(basePrice * (1 - discountPercent / 100))
              const isBuying = buyingCode === plan.code

              return (
                <div
                  key={plan.code}
                  className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-5 space-y-4 flex flex-col justify-between transition hover:shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {plan.tier.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{plan.duration}</span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {SENAI_TIER_LABEL[plan.tier]}
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 font-medium">
                      Mở khóa toàn bộ tính năng giải đề, KaTeX LaTeX và phân tích chuyên sâu.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 line-through mr-1.5">{basePrice} SC</span>
                      <span className="text-base font-black text-purple-600 dark:text-purple-400">
                        {discounted} SC
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isBuying || !canBuyFlashSale || senCashBalance < discounted}
                      onClick={() => buyFlashSale(plan)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-40"
                    >
                      {isBuying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                      Đổi Ngay
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SPECIAL VIP & EXCLUSIVE PERKS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newstore-heading)' }}>
                  Gói Hội Viên Sen VIP Pro
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Truy cập không giới hạn kho đề thi chuẩn hóa & tải tài liệu miễn phí
                </p>
              </div>
            </div>
            <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
              Thành viên VIP nhận đặc quyền tải tài liệu ôn thi độc quyền, không quảng cáo trên toàn bộ hệ thống và tặng kèm 50 câu hỏi SenAI mỗi ngày.
            </p>
            <Link
              href="/new-vip"
              className="inline-flex items-center gap-1.5 text-xs font-black text-purple-600 dark:text-purple-400 hover:underline"
            >
              Xem chi tiết các gói Sen VIP <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Card 2 */}
          <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newstore-heading)' }}>
                  Nạp Thêm SenCash
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Nạp nhanh qua VietQR tự động cộng số dư sau 5 giây
                </p>
              </div>
            </div>
            <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
              Sử dụng SenCash để linh hoạt nâng cấp các gói AI, đổi mã quà tặng hoặc mua sắm trong các đợt Flash Sale độc quyền.
            </p>
            <Link
              href="/new-sencash"
              className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Nạp SenCash ngay <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
