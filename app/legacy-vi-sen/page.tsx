'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  TOPUP_PRESETS_VND, MIN_TOPUP_VND, isValidTopupAmount, vndToSenCash,
  SenCashTopupOrder, SenCashTransaction, fetchSenCashBalance, fetchMyTransactions,
} from '@/lib/senCash'
import {
  SENAI_PLANS, SENAI_TIER_LABEL, SENAI_TIER_DAILY_LIMIT, getEffectiveSenaiTier,
  type SenAiTierCode, type SenAiProfileFields,
} from '@/lib/senaiTiers'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import { ArrowLeft, Coins, Wallet, Loader2, Copy, CheckCircle2, XCircle, Clock, Sparkles, Crown, Check, Ticket, Gift } from 'lucide-react'

const TIER_ORDER: SenAiTierCode[] = ['lite', 'plus_lite', 'plus', 'ultra']

export default function ViSenPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

  const [senCashBalance, setSenCashBalance] = useState(0)
  const [transactions, setTransactions] = useState<SenCashTransaction[]>([])
  const [senaiProfile, setSenaiProfile] = useState<SenAiProfileFields & { senai_trial_used?: boolean }>({})
  const [hasPlusYearlyVoucher, setHasPlusYearlyVoucher] = useState(false)
  const [quota, setQuota] = useState<{ used: number, limit: number, remaining: number } | null>(null)

  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [topupAmount, setTopupAmount] = useState(TOPUP_PRESETS_VND[0])
  const [customTopup, setCustomTopup] = useState('')
  const [creating, setCreating] = useState(false)
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null)
  const [pendingOrder, setPendingOrder] = useState<SenCashTopupOrder | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshWallet = async (userId: string) => {
    const [balance, txs, { data: profile }, { data: voucher }] = await Promise.all([
      fetchSenCashBalance(userId),
      fetchMyTransactions(userId),
      supabase.from('profiles').select('senai_tier, senai_tier_expires_at, senai_tier_permanent, senai_trial_used').eq('id', userId).maybeSingle(),
      supabase.from('sencash_vouchers').select('id').eq('user_id', userId).eq('kind', 'senai_plus_yearly_30off').eq('used', false).limit(1).maybeSingle(),
    ])
    setSenCashBalance(balance)
    setTransactions(txs)
    setSenaiProfile(profile || {})
    setHasPlusYearlyVoucher(!!voucher)
  }

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const refreshQuota = async () => {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/senai/quota', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json().catch(() => null)
    if (res.ok && json) setQuota({ used: json.used, limit: json.limit, remaining: json.remaining })
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await Promise.all([refreshWallet(user.id), refreshQuota()])
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [router])

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const pollTopupStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/sencash/topup-status?orderId=${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) return
      setPendingOrder(json.order)
      if (json.order.status === 'paid') {
        stopPolling()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await refreshWallet(user.id)
      } else if (json.order.status === 'expired' || json.order.status === 'cancelled') {
        stopPolling()
      }
    }, 3000)
  }

  const handleTopup = async () => {
    const amount = customTopup ? parseInt(customTopup, 10) : topupAmount
    if (!isValidTopupAmount(amount)) { setErrorMsg(`Số tiền nạp phải là bội số của ${MIN_TOPUP_VND.toLocaleString('vi-VN')}đ`); return }
    setCreating(true); setErrorMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/sencash/create-topup-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountVnd: amount }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không tạo được đơn nạp'); return }
      setPendingOrder(json.order)
      setQrUrl(json.qrUrl)
      pollTopupStatus(json.order.id, token)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
  }

  const handlePurchasePlan = async (planCode: string) => {
    setPurchasingPlan(planCode); setErrorMsg(''); setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/senai/purchase-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không mua được gói'); return }
      setInfoMsg(json.voucherApplied ? `Đã áp dụng voucher giảm 30%! Thanh toán ${json.pricePaid} SC.` : 'Đã cập nhật gói SenAI thành công!')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await refreshWallet(user.id)
      await refreshQuota()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setPurchasingPlan(null)
    }
  }

  const handleCopyCode = () => {
    if (!pendingOrder) return
    navigator.clipboard.writeText(pendingOrder.order_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRedeemCode = async () => {
    if (!redeemCode.trim() || redeeming) return
    setRedeeming(true); setRedeemMsg(null)
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/gift-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: redeemCode }),
      })
      const json = await res.json()
      if (!res.ok) { setRedeemMsg({ type: 'error', text: json.error || 'Không đổi được mã' }); return }
      setRedeemMsg({ type: 'success', text: `Đã nhận: ${json.reward}` })
      setRedeemCode('')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await refreshWallet(user.id)
      await refreshQuota()
    } catch (e) {
      setRedeemMsg({ type: 'error', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    } finally {
      setRedeeming(false)
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
    if (isModern) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải Ví Sen..." />
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>
  }

  const effectiveTier = getEffectiveSenaiTier(senaiProfile)

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className={backBtnClass} style={backBtnStyle}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-amber-500" /> Ví Sen
            </h1>
            <p className={`text-sm mt-1 ${mutedClass}`} style={mutedStyle}>Quản lý SenCash, nạp thêm và nâng cấp gói SenAI.</p>
          </div>
          <button onClick={() => router.push('/vip')} className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <Crown className="w-3.5 h-3.5" /> Trang VIP
          </button>
        </div>

        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-500" /> Số dư SenCash</h2>
            <span className="flex items-center gap-1.5 font-black text-2xl text-amber-600 dark:text-amber-400">
              <Coins className="w-5 h-5" /> {senCashBalance}
            </span>
          </div>
          <p className={`text-xs mb-3 ${mutedClass}`} style={mutedStyle}>Tỉ giá: 500đ = 1 SenCash (tối thiểu nạp {MIN_TOPUP_VND.toLocaleString('vi-VN')}đ).</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            {TOPUP_PRESETS_VND.map(v => (
              <button
                key={v}
                onClick={() => { setTopupAmount(v); setCustomTopup('') }}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${!customTopup && topupAmount === v ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500' : 'border-slate-200 dark:border-white/10 hover:border-amber-300'}`}
              >
                {(v / 1000)}k
                <div className={`text-[10px] font-medium ${mutedClass}`} style={mutedStyle}>{vndToSenCash(v)} SC</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={`Số khác (bội số ${MIN_TOPUP_VND.toLocaleString('vi-VN')}đ)`}
              value={customTopup}
              onChange={e => setCustomTopup(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-xl text-sm ${isModern ? '' : 'bg-slate-50 dark:bg-[#101010] border border-slate-200 dark:border-white/10'}`}
              style={isModern ? { background: 'var(--bg)', border: '1px solid var(--border)' } : undefined}
            />
            <button
              onClick={handleTopup}
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shrink-0 disabled:opacity-60 flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />} Nạp SenCash
            </button>
          </div>
        </div>

        {errorMsg && <p className="text-sm text-rose-500 font-bold mb-4">{errorMsg}</p>}
        {infoMsg && <p className="text-sm text-emerald-500 font-bold mb-4">{infoMsg}</p>}

        {pendingOrder && pendingOrder.status !== 'expired' && pendingOrder.status !== 'cancelled' && (
          <div className={`${cardClass} mb-6 text-center`} style={cardStyle}>
            {pendingOrder.status === 'paid' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-black text-lg mb-1">Nạp SenCash thành công!</p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm mb-4">Quét mã QR bên dưới bằng app ngân hàng để hoàn tất thanh toán</p>
                {qrUrl && <img src={qrUrl} alt="VietQR" className="w-64 h-auto mx-auto rounded-xl border border-slate-200 dark:border-white/10 mb-4" />}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`text-xs ${mutedClass}`} style={mutedStyle}>Nội dung chuyển khoản:</span>
                  <span className="font-mono font-black text-sm">{pendingOrder.order_code}</span>
                  <button onClick={handleCopyCode} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
                <p className={`text-xs flex items-center justify-center gap-1 mb-4 ${mutedClass}`} style={mutedStyle}>
                  <Clock className="w-3.5 h-3.5" /> Đơn hàng hết hạn lúc {new Date(pendingOrder.expires_at).toLocaleTimeString('vi-VN')}
                </p>
                <div className={`flex items-center justify-center gap-2 text-xs ${mutedClass}`} style={mutedStyle}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chờ xác nhận thanh toán tự động...
                </div>
                <button onClick={() => { stopPolling(); setPendingOrder(null) }} className={`mt-5 text-xs font-bold flex items-center justify-center gap-1 mx-auto hover:text-slate-600 ${mutedClass}`} style={mutedStyle}>
                  <XCircle className="w-3.5 h-3.5" /> Huỷ
                </button>
              </>
            )}
          </div>
        )}

        {quota && (
          <div className={`${cardClass} mb-6`} style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm flex items-center gap-2"><Ticket className="w-4 h-4 text-indigo-500" /> Hạn mức câu hỏi SenAI hôm nay</h2>
              <span className="font-black text-sm">{quota.used}/{quota.limit}</span>
            </div>
            <div className={`w-full h-2 rounded-full overflow-hidden ${isModern ? '' : 'bg-slate-100 dark:bg-slate-800'}`} style={isModern ? { background: 'var(--bg)' } : undefined}>
              <div
                className={`h-full rounded-full transition-all ${quota.remaining === 0 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%` }}
              />
            </div>
            <p className={`text-xs mt-2 ${mutedClass}`} style={mutedStyle}>
              {quota.remaining > 0 ? `Còn ${quota.remaining} câu hỏi hôm nay` : 'Đã hết lượt hỏi hôm nay, hạn mức làm mới vào 0h ngày mai'}
            </p>
          </div>
        )}

        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <h2 className="font-bold text-sm mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" /> Gói SenAI</h2>
          <p className={`text-xs mb-4 ${mutedClass}`} style={mutedStyle}>
            Hạng đang dùng: <strong>{SENAI_TIER_LABEL[effectiveTier]}</strong> ({quota?.limit ?? SENAI_TIER_DAILY_LIMIT[effectiveTier]} câu/ngày)
            {senaiProfile.senai_tier_permanent && effectiveTier !== 'free' ? ' · Vĩnh viễn' : ''}
            {!senaiProfile.senai_tier_permanent && senaiProfile.senai_tier_expires_at && effectiveTier !== 'free'
              ? ` · Hết hạn ${new Date(senaiProfile.senai_tier_expires_at).toLocaleDateString('vi-VN')}`
              : ''}
          </p>

          <div className="space-y-4">
            {TIER_ORDER.map(tierCode => {
              const plans = SENAI_PLANS.filter(p => p.tier === tierCode)
              const isCurrentTier = effectiveTier === tierCode
              return (
                <div key={tierCode} className={`p-4 rounded-2xl border ${isCurrentTier ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-white/5'}`} style={!isCurrentTier ? cardStyle : undefined}>
                  <p className="font-black text-sm flex items-center gap-1.5 mb-3">
                    {SENAI_TIER_LABEL[tierCode]} {isCurrentTier && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                    <span className={`font-normal text-xs ${mutedClass}`} style={mutedStyle}>· {SENAI_TIER_DAILY_LIMIT[tierCode]} câu/ngày</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {plans.map(plan => {
                      const isTrialUsed = plan.duration === 'trial_3d' && senaiProfile.senai_trial_used
                      const isActivePlanState = isCurrentTier && (
                        (plan.duration === 'permanent' && senaiProfile.senai_tier_permanent) ||
                        (plan.duration !== 'permanent' && !senaiProfile.senai_tier_permanent)
                      )
                      const hasVoucher = plan.code === 'plus_yearly' && hasPlusYearlyVoucher
                      const priceToShow = hasVoucher ? Math.round(plan.priceSenCash * 0.7) : plan.priceSenCash
                      const disabled = purchasingPlan === plan.code || isTrialUsed || senCashBalance < priceToShow
                      return (
                        <button
                          key={plan.code}
                          onClick={() => handlePurchasePlan(plan.code)}
                          disabled={disabled}
                          title={isTrialUsed ? 'Bạn đã dùng lượt dùng thử này rồi' : hasVoucher ? 'Áp dụng voucher giảm 30% (tặng khi mua VIP từ 3 tháng trở lên)' : undefined}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${isActivePlanState ? 'bg-indigo-600 text-white' : hasVoucher ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 ring-1 ring-emerald-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'}`}
                        >
                          {purchasingPlan === plan.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                          {plan.duration === 'trial_3d' ? (isTrialUsed ? 'Đã dùng thử' : 'Dùng thử 3 ngày — Miễn phí')
                            : hasVoucher ? <>1 năm — <s className="opacity-60">{plan.priceSenCash}</s> {priceToShow} SC (-30%)</>
                            : plan.duration === 'monthly' ? `1 tháng — ${plan.priceSenCash} SC`
                            : plan.duration === 'yearly' ? `1 năm — ${plan.priceSenCash} SC`
                            : `Vĩnh viễn — ${plan.priceSenCash} SC`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Gift className="w-4 h-4 text-emerald-500" /> Đổi mã quà tặng</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRedeemCode() }}
              placeholder="Nhập mã (VD: SEN-XXXX-XXXX)"
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-mono uppercase ${isModern ? '' : 'bg-slate-50 dark:bg-[#101010] border border-slate-200 dark:border-white/10'}`}
              style={isModern ? { background: 'var(--bg)', border: '1px solid var(--border)' } : undefined}
            />
            <button
              onClick={handleRedeemCode}
              disabled={redeeming || !redeemCode.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shrink-0 disabled:opacity-60 flex items-center gap-1.5"
            >
              {redeeming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />} Đổi mã
            </button>
          </div>
          {redeemMsg && (
            <p className={`text-sm font-bold mt-3 ${redeemMsg.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{redeemMsg.text}</p>
          )}
        </div>

        {transactions.length > 0 && (
          <div className={cardClass} style={cardStyle}>
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${mutedClass}`} style={mutedStyle}>Giao dịch gần đây</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-xs">
                  <span className={mutedClass} style={mutedStyle}>
                    {tx.reason === 'topup' ? 'Nạp ví'
                      : tx.reason === 'vip_redeem' ? 'Đổi VIP'
                      : tx.reason === 'vip_download_spend' ? 'Tải tài liệu VIP'
                      : tx.reason === 'senai_tier_purchase' ? 'Mua gói SenAI'
                      : tx.reason === 'gift_code' ? 'Đổi mã quà tặng'
                      : 'Admin tặng'} · {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                  </span>
                  <span className={`font-bold ${tx.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{tx.delta > 0 ? '+' : ''}{tx.delta} SC</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
