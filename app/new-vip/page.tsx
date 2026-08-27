'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  VIP_PLANS,
  PREMIUM_PLANS,
  LITE_PLANS,
  isVipActive,
  getEffectivePlanTier,
  type PlanGroup,
  type VipOrder,
} from '@/lib/vipMembership'
import { vndToSenCash, fetchSenCashBalance } from '@/lib/senCash'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Crown,
  Gem,
  Zap,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  Coins,
  Wallet,
  Sparkles,
  AlertCircle,
  Sun,
  Moon,
  ChevronRight,
  ShieldCheck,
  Flame,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newvip-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newvip-body' })

type PlanOption = { code: string; name: string; priceVnd: number; durationDays: number }

const GROUP_META: Record<PlanGroup, { label: string; icon: typeof Crown; badge: string; color: string; plans: PlanOption[] }> = {
  lite: { label: 'Lite', icon: Zap, badge: 'Tiết kiệm', color: 'text-sky-500 bg-sky-500/10 border-sky-500/20', plans: LITE_PLANS },
  vip: { label: 'Sen VIP', icon: Crown, badge: 'Phổ biến nhất', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', plans: VIP_PLANS },
  premium: { label: 'Premium', icon: Gem, badge: 'Đẳng cấp nhất', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', plans: PREMIUM_PLANS },
}

const GROUP_PERKS: Record<PlanGroup, string[]> = {
  lite: [
    'Mở khoá xem kho tài liệu VIP và đề thi độc quyền',
    'Không chứa banner quảng cáo phiền toái',
    'Mức giá học sinh siêu rẻ — chỉ từ 1.000đ/ngày',
  ],
  vip: [
    'Trọn vẹn không quảng cáo trên toàn bộ hệ thống',
    'Tải tài liệu VIP không giới hạn: 5 lượt tải miễn phí/ngày',
    'Tặng thêm +50 câu hỏi SenAI giải bài thông minh mỗi ngày',
    'Tặng kèm gói tài khoản SenAI Lite khi mua theo tháng/năm',
    'Giảm giá 10% khi mua gói SenAI Plus/Ultra',
  ],
  premium: [
    'Đầy đủ mọi đặc quyền cao cấp của hạng VIP',
    'Logo đổi thành "Premium" mạ vàng độc quyền trên Dashboard',
    'Tặng thẳng gói SenAI Plus / SenAI Ultra độc quyền (250 câu hỏi/ngày)',
    'Giảm giá 15% không giới hạn trong Cửa hàng SenAI',
    'Hỗ trợ giải đáp ưu tiên 24/7 từ đội ngũ học thuật SenExam',
  ],
}

export default function NewVipPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<PlanGroup | null>(null)
  const [senCashBalance, setSenCashBalance] = useState(0)

  const [activeGroup, setActiveGroup] = useState<PlanGroup>('vip')
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(VIP_PLANS[2])
  const [creating, setCreating] = useState(false)
  const [redeemingPlan, setRedeemingPlan] = useState<string | null>(null)
  const [order, setOrder] = useState<VipOrder | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshStatus = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('vip_expires_at, plan_tier').eq('id', userId).single()
    setVipExpiresAt(profile?.vip_expires_at || null)
    setCurrentTier(getEffectivePlanTier(profile))
    setSenCashBalance(await fetchSenCashBalance(userId))
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/new-sign'); return }
      await ensureStudentProfile(user.id)
      await refreshStatus(user.id)
      setLoading(false)
    }
    init()

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
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

  const switchGroup = (group: PlanGroup) => {
    setActiveGroup(group)
    const plans = GROUP_META[group].plans
    setSelectedPlan(plans[Math.min(2, plans.length - 1)])
    setErrorMsg('')
    setInfoMsg('')
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const pollOrderStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/vip/order-status?orderId=${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (!res.ok) return
        setOrder(json.order)
        if (json.order.status === 'paid') {
          stopPolling()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) await refreshStatus(user.id)
        } else if (json.order.status === 'expired' || json.order.status === 'cancelled') {
          stopPolling()
        }
      } catch (err) {
        console.error('Error polling vip status:', err)
      }
    }, 2500)
  }

  const handleBuy = async () => {
    setCreating(true)
    setErrorMsg('')
    try {
      const token = await getToken()
      if (!token) { router.replace('/new-sign'); return }
      const res = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planGroup: activeGroup, planCode: selectedPlan.code }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không tạo được đơn hàng'); return }
      setOrder(json.order)
      setQrUrl(json.qrUrl)
      pollOrderStatus(json.order.id, token)
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
  }

  const handleRedeemWithSenCash = async (plan: PlanOption) => {
    setRedeemingPlan(plan.code)
    setErrorMsg('')
    setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.replace('/new-sign'); return }
      const res = await fetch('/api/vip/redeem-sencash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: plan.code, planGroup: activeGroup }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không đổi được VIP'); return }
      setInfoMsg(`Đã đổi thành công ${vndToSenCash(plan.priceVnd)} SenCash lấy gói ${plan.name}!`)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await refreshStatus(user.id)
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra')
    } finally {
      setRedeemingPlan(null)
    }
  }

  const handleCopyCode = () => {
    if (!order) return
    navigator.clipboard.writeText(order.order_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentlyActive = isVipActive({ vip_expires_at: vipExpiresAt })
  const meta = GROUP_META[activeGroup]
  const GroupIcon = meta.icon

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải thông tin gói VIP...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.15), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.15), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.4), transparent 30%), radial-gradient(circle at 90% 20%, rgba(244, 114, 182, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Crown className="inline h-3 w-3 mr-1" /> Nâng Cấp Thành Viên
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                Đặc Quyền Thành Viên Sen VIP
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Mở khóa không giới hạn tài liệu, trợ lý AI thông minh và học tập không quảng cáo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
            <Link
              href="/new-sencash"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold shadow-sm transition hover:bg-black/5"
            >
              <Wallet className="h-4 w-4 text-amber-500" /> Ví Sen: {senCashBalance.toLocaleString('vi-VN')} SC
            </Link>
          </div>
        </div>

        {/* Current VIP Status Card */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 dark:from-amber-500/20 dark:via-rose-500/15 dark:to-indigo-500/20 p-6 shadow-md backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400">Trạng thái hiện tại:</span>
                  <span className="rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2.5 py-0.5 text-xs font-black">
                    {currentlyActive ? (currentTier ? `Hạng ${currentTier.toUpperCase()}` : 'VIP Đang Hoạt Động') : 'Gói Miễn Phí'}
                  </span>
                </div>
                <h2 className="text-xl font-black mt-1" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                  {currentlyActive && vipExpiresAt
                    ? `Hạn sử dụng đến: ${new Date(vipExpiresAt).toLocaleDateString('vi-VN')}`
                    : 'Nâng cấp ngay để mở khóa toàn bộ kho đề và AI'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/new-sencash"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold shadow-sm transition hover:scale-105"
              >
                Nạp SenCash ({senCashBalance} SC)
              </Link>
            </div>
          </div>
        </div>

        {/* Plan Group Tabs */}
        <div className="mt-8">
          <div className="flex justify-center">
            <div className="inline-flex rounded-[22px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-1.5 shadow-sm backdrop-blur-xl">
              {(['lite', 'vip', 'premium'] as PlanGroup[]).map((group) => {
                const item = GROUP_META[group]
                const Icon = item.icon
                const active = activeGroup === group
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => switchGroup(group)}
                    className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-black transition-all ${
                      active
                        ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md scale-105'
                        : 'text-[#4B5563] dark:text-slate-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Perks Box */}
        <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
              <GroupIcon className="h-5 w-5 text-amber-500" /> Đặc quyền gói {meta.label}:
            </h3>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black border ${meta.color}`}>
              {meta.badge}
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {GROUP_PERKS[activeGroup].map((perk, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {infoMsg}
          </div>
        )}

        {/* Plan Pricing Cards Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meta.plans.map((plan) => {
            const scNeeded = vndToSenCash(plan.priceVnd)
            const canRedeem = senCashBalance >= scNeeded
            const isSelected = selectedPlan.code === plan.code

            return (
              <div
                key={plan.code}
                className={`relative overflow-hidden rounded-[26px] border p-5 transition-all duration-200 backdrop-blur-xl flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-lg scale-102'
                    : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 hover:border-black/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                      {plan.durationDays >= 365 ? 'Gói 1 Năm' : plan.durationDays >= 30 ? `Gói ${Math.round(plan.durationDays / 30)} Tháng` : `Gói ${plan.durationDays} Ngày`}
                    </span>
                    <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold">
                      {scNeeded} SC
                    </span>
                  </div>

                  <h3 className="mt-2 text-xl font-black" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                    {plan.name}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[#1A1A1A] dark:text-white" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                      {plan.priceVnd.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-xs font-bold text-[#6B7280]">VNĐ</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2 pt-4 border-t border-black/10 dark:border-white/10">
                  {/* Buy with VietQR */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan)
                      handleBuy()
                    }}
                    disabled={creating}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-2.5 text-xs font-black uppercase tracking-wider shadow transition hover:opacity-90 disabled:opacity-50"
                  >
                    {creating && selectedPlan.code === plan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Quét VietQR <ChevronRight className="h-3.5 w-3.5" /></>
                    )}
                  </button>

                  {/* Redeem with SenCash */}
                  <button
                    type="button"
                    onClick={() => handleRedeemWithSenCash(plan)}
                    disabled={redeemingPlan === plan.code || !canRedeem}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-2 text-xs font-bold transition hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    {redeemingPlan === plan.code ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        {canRedeem ? `Đổi bằng ${scNeeded} SenCash` : `Cần ${scNeeded} SC (Thiếu ${scNeeded - senCashBalance})`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* VIETQR PAYMENT MODAL */}
      {order && qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            
            {order.status === 'paid' ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                  Kích Hoạt VIP Thành Công!
                </h3>
                <p className="text-xs text-[#4B5563] dark:text-slate-300">
                  Tài khoản của bạn đã được nâng cấp thành viên VIP thành công.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOrder(null)
                    setQrUrl('')
                  }}
                  className="mt-4 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 text-xs font-bold shadow transition hover:opacity-90"
                >
                  Xác nhận & Đóng
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                  <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newvip-heading)' }}>
                    Quét mã VietQR để nâng cấp VIP
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      stopPolling()
                      setOrder(null)
                      setQrUrl('')
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white"
                  >
                    ✕ Đóng
                  </button>
                </div>

                <div className="flex justify-center p-2 bg-white rounded-2xl border border-black/10">
                  <img src={qrUrl} alt="Mã VietQR" className="w-56 h-56 object-contain" />
                </div>

                <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-slate-400">Gói nâng cấp:</span>
                    <strong className="font-bold">{order.plan_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-slate-400">Số tiền:</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-black">{order.amount_vnd.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                    <span className="text-[#6B7280] dark:text-slate-400">Nội dung CK:</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 font-mono font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {order.order_code} {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280] dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span>Đang tự động kiểm tra và kích hoạt gói...</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
