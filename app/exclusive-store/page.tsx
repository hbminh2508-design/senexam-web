'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getEffectivePlanTier, type PlanTier } from '@/lib/vipMembership'
import { SENAI_PLANS, SENAI_TIER_LABEL, type SenAiPlan } from '@/lib/senaiTiers'
import {
  canAccessExclusiveStore, isMonthlyFlashSaleDay, isBlackFridayDate,
  MONTHLY_FLASH_SALE_DISCOUNT_PERCENT, BLACK_FRIDAY_DEALS, applyDiscount,
  type BlackFridayDealCode,
} from '@/lib/exclusiveStore'
import { fetchSenCashBalance } from '@/lib/senCash'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import { ArrowLeft, Gem, Sparkles, Flame, Loader2, Wallet, Lock, CheckCircle2 } from 'lucide-react'

const ELIGIBLE_PLANS = SENAI_PLANS.filter(p => (p.tier === 'plus' || p.tier === 'ultra') && p.duration !== 'trial_3d')

export default function ExclusiveStorePage() {
  const router = useRouter()
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

  const [planTier, setPlanTier] = useState<PlanTier | null>(null)
  const [senCashBalance, setSenCashBalance] = useState(0)
  const [isFlashSaleDay, setIsFlashSaleDay] = useState(false)
  const [isBlackFriday, setIsBlackFriday] = useState(false)
  const [claimed, setClaimed] = useState<Record<string, number>>({})

  const [buyingCode, setBuyingCode] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('vip_expires_at, plan_tier')
        .eq('id', user.id)
        .single()
      setPlanTier(getEffectivePlanTier(profile))
      setSenCashBalance(await fetchSenCashBalance(user.id))

      const res = await fetch('/api/exclusive-store/status')
      const json = await res.json()
      if (res.ok) {
        setIsFlashSaleDay(json.isFlashSaleDay)
        setIsBlackFriday(json.isBlackFriday)
        setClaimed(json.claimed || {})
      }
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [router])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const refreshAfterPurchase = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setSenCashBalance(await fetchSenCashBalance(user.id))
    const res = await fetch('/api/exclusive-store/status')
    const json = await res.json()
    if (res.ok) setClaimed(json.claimed || {})
  }

  const buyFlashSale = async (plan: SenAiPlan) => {
    setBuyingCode(plan.code); setErrorMsg(''); setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/exclusive-store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dealType: 'monthly_flash', planCode: plan.code }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không mua được gói'); return }
      setInfoMsg(`Đã nâng cấp lên ${SENAI_TIER_LABEL[plan.tier]}, chỉ với ${json.pricePaid} SenCash!`)
      await refreshAfterPurchase()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBuyingCode(null)
    }
  }

  const buyBlackFriday = async (dealCode: BlackFridayDealCode) => {
    setBuyingCode(dealCode); setErrorMsg(''); setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/exclusive-store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dealType: 'black_friday', blackFridayDeal: dealCode }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không mua được gói'); return }
      setInfoMsg(`Săn thành công ưu đãi Black Friday! Chỉ ${json.pricePaid} SenCash.`)
      await refreshAfterPurchase()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBuyingCode(null)
    }
  }

  const isModern = newUiEnabled
  const wrapperStyle = isModern ? { ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties : undefined
  const wrapperClass = isModern ? 'min-h-screen font-sans pb-16' : 'min-h-screen bg-slate-50 dark:bg-[#0d0d0d] text-slate-900 dark:text-slate-100 pb-16'
  const cardClass = isModern ? 'rounded-2xl p-5' : 'rounded-2xl p-5 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/5'
  const cardStyle = isModern ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined
  const mutedClass = isModern ? '' : 'text-slate-500'
  const mutedStyle = isModern ? { color: 'var(--text-muted)' } : undefined
  const backBtnClass = isModern ? 'p-2.5 rounded-full transition-colors' : 'p-2.5 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm'
  const backBtnStyle = isModern ? { border: '1px solid var(--border)' } : undefined

  if (loading) {
    if (isModern) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải Cửa hàng cao cấp..." />
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>
  }

  if (!canAccessExclusiveStore(planTier)) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: isModern ? 'var(--accent-soft)' : '#F3E8FF' }}>
            <Lock className="w-8 h-8" style={{ color: isModern ? 'var(--accent)' : '#7C3AED' }} />
          </div>
          <h1 className="text-xl font-black mb-2">Cửa hàng cao cấp</h1>
          <p className={`text-sm mb-6 ${mutedClass}`} style={mutedStyle}>Chỉ dành cho thành viên VIP hoặc Premium — nâng cấp để mở khoá ưu đãi SenAI Plus/Ultra giá rẻ hơn tới 30%.</p>
          <button onClick={() => router.push('/vip')} className="px-6 py-3 rounded-2xl font-black text-sm text-white" style={{ background: isModern ? 'var(--accent)' : '#7C3AED' }}>Xem gói VIP/Premium</button>
        </div>
      </div>
    )
  }

  const discountPercent = MONTHLY_FLASH_SALE_DISCOUNT_PERCENT[planTier as 'vip' | 'premium']

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className={backBtnClass} style={backBtnStyle}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Gem className="w-6 h-6 text-violet-500" /> Cửa hàng cao cấp
            </h1>
            <p className={`text-sm mt-1 ${mutedClass}`} style={mutedStyle}>Ưu đãi SenAI Plus/Ultra dành riêng cho thành viên {planTier === 'premium' ? 'Premium' : 'VIP'}.</p>
          </div>
        </div>

        <button onClick={() => router.push('/vi-sen')} className={`${cardClass} mb-6 w-full flex items-center justify-between transition-colors hover:border-violet-300`} style={cardStyle}>
          <span className="flex items-center gap-2 font-bold text-sm"><Wallet className="w-4 h-4 text-violet-500" /> Ví Sen — {senCashBalance} SC</span>
        </button>

        {errorMsg && <p className="text-sm text-rose-500 font-bold mb-4">{errorMsg}</p>}
        {infoMsg && <p className="text-sm text-emerald-500 font-bold mb-4">{infoMsg}</p>}

        {/* Ngày sale hàng tháng */}
        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-black text-sm">Ngày sale hàng tháng — giảm {discountPercent}%</h2>
          </div>
          <p className={`text-xs mb-4 ${mutedClass}`} style={mutedStyle}>
            {isFlashSaleDay
              ? `Hôm nay là ngày sale! Giá dưới đây đã áp dụng ưu đãi ${discountPercent}% dành cho ${planTier === 'premium' ? 'Premium' : 'VIP'}.`
              : 'Áp dụng vào các ngày 1/1, 2/2, 3/3 ... 12/12 hàng năm. Quay lại đúng ngày để nhận giá ưu đãi.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ELIGIBLE_PLANS.map(plan => {
              const finalPrice = isFlashSaleDay ? applyDiscount(plan.priceSenCash, discountPercent) : plan.priceSenCash
              return (
                <div key={plan.code} className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={cardStyle}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide truncate" style={mutedStyle}>{plan.label}</p>
                    <p className="text-base font-black mt-0.5 flex items-center gap-2">
                      {isFlashSaleDay && <span className={`line-through text-xs font-bold ${mutedClass}`} style={mutedStyle}>{plan.priceSenCash} SC</span>}
                      {finalPrice} SC
                    </p>
                  </div>
                  <button
                    onClick={() => buyFlashSale(plan)}
                    disabled={!isFlashSaleDay || buyingCode === plan.code}
                    className="shrink-0 px-4 py-2.5 rounded-xl font-black text-xs text-white disabled:opacity-40 flex items-center gap-1.5"
                    style={{ background: isModern ? 'var(--accent)' : '#7C3AED' }}
                  >
                    {buyingCode === plan.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mua'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Black Friday */}
        <div className={`${cardClass} mb-6 border-2`} style={{ ...cardStyle, borderColor: isBlackFriday ? '#DC2626' : cardStyle?.border }}>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-rose-500" />
            <h2 className="font-black text-sm">Black Friday — giảm sốc, giới hạn suất</h2>
          </div>
          <p className={`text-xs mb-4 ${mutedClass}`} style={mutedStyle}>
            {isBlackFriday ? 'Hôm nay là Black Friday! Nhanh tay săn ưu đãi trước khi hết suất.' : 'Chỉ diễn ra 1 ngày duy nhất mỗi năm (thứ Sáu sau Lễ Tạ ơn, cuối tháng 11).'}
          </p>
          <div className="space-y-3">
            {(Object.keys(BLACK_FRIDAY_DEALS) as BlackFridayDealCode[]).map(code => {
              const deal = BLACK_FRIDAY_DEALS[code]
              const plan = SENAI_PLANS.find(p => p.code === deal.senaiPlanCode)!
              const finalPrice = applyDiscount(plan.priceSenCash, deal.discountPercent)
              const claimedCount = claimed[code] || 0
              const soldOut = claimedCount >= deal.maxClaims
              return (
                <div key={code} className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={cardStyle}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide truncate" style={mutedStyle}>{deal.label}</p>
                    <p className="text-base font-black mt-0.5 flex items-center gap-2">
                      <span className={`line-through text-xs font-bold ${mutedClass}`} style={mutedStyle}>{plan.priceSenCash} SC</span>
                      {finalPrice} SC
                    </p>
                    <p className="text-[11px] font-bold text-rose-500 mt-1">{soldOut ? 'Đã hết suất' : `Còn ${deal.maxClaims - claimedCount}/${deal.maxClaims} suất`}</p>
                  </div>
                  <button
                    onClick={() => buyBlackFriday(code)}
                    disabled={!isBlackFriday || soldOut || buyingCode === code}
                    className="shrink-0 px-4 py-2.5 rounded-xl font-black text-xs text-white disabled:opacity-40 flex items-center gap-1.5 bg-rose-600"
                  >
                    {buyingCode === code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Săn ngay'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`${cardClass} flex items-start gap-2 text-xs font-medium ${mutedClass}`} style={mutedStyle}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" /> Các đặc quyền khác của Cửa hàng cao cấp sẽ tiếp tục được cập nhật trong thời gian tới.
        </div>
      </div>
    </div>
  )
}
