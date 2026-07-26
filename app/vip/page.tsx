'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  VIP_PLANS, PREMIUM_PLANS, LITE_PLANS,
  getPlanByGroup, isVipActive, getEffectivePlanTier,
  type PlanGroup, type VipOrder,
} from '@/lib/vipMembership'
import { vndToSenCash, fetchSenCashBalance } from '@/lib/senCash'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import { ArrowLeft, Crown, Gem, Zap, Check, Loader2, Copy, CheckCircle2, XCircle, Clock, Coins, Wallet, ChevronRight } from 'lucide-react'

type PlanOption = { code: string; name: string; priceVnd: number; durationDays: number }

const GROUP_META: Record<PlanGroup, { label: string; icon: typeof Crown; accent: string; plans: PlanOption[] }> = {
  lite: { label: 'Lite', icon: Zap, accent: '#0284C7', plans: LITE_PLANS },
  vip: { label: 'VIP', icon: Crown, accent: '#D97706', plans: VIP_PLANS },
  premium: { label: 'Premium', icon: Gem, accent: '#7C3AED', plans: PREMIUM_PLANS },
}

const GROUP_PERKS: Record<PlanGroup, string[]> = {
  lite: [
    'Mở khoá xem kho tài liệu VIP (tải thêm cần trả bằng SenCash, không có lượt miễn phí/ngày)',
    'Không có gói SenAI tặng kèm, không cộng thêm câu hỏi SenAI/ngày',
    'Không vào được Cửa hàng cao cấp (giá sale SenAI hàng tháng)',
    'Quảng cáo vẫn hiển thị, nhưng đóng lại thì sang ngày mới mới thấy lại',
    'Giá rẻ nhất — chỉ từ 1.000đ',
  ],
  vip: [
    'Không quảng cáo',
    'Kho tài liệu VIP, 5 lượt tải miễn phí/ngày',
    'Cộng thêm 50 câu hỏi SenAI/ngày (cộng thẳng vào hạn mức gói SenAI đang có, không thay thế)',
    'Mua từ 1 tháng tặng gói SenAI Lite, mua theo năm tặng SenAI Plus Lite',
    'Vào Cửa hàng cao cấp: mua gói SenAI Plus/Ultra giảm 10%, 1 lần/tháng (mua ngày nào cũng được)',
  ],
  premium: [
    'Trọn vẹn mọi đặc quyền VIP',
    'Logo đổi thành "Premium" mạ vàng độc quyền trên Dashboard',
    'Mua từ 3 tháng tặng thẳng hạng SenAI Plus, mua theo năm tặng thẳng hạng SenAI Ultra (200 câu/ngày, cộng thêm 50 từ Premium = 250 câu/ngày)',
    'Cửa hàng cao cấp giá tốt hơn VIP: giảm 15% gói SenAI Plus/Ultra, 2 lần/tháng',
  ],
}

export default function VipPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await refreshStatus(user.id)
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [router])

  const switchGroup = (group: PlanGroup) => {
    setActiveGroup(group)
    const plans = GROUP_META[group].plans
    setSelectedPlan(plans[Math.min(2, plans.length - 1)])
    setErrorMsg(''); setInfoMsg('')
  }

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const pollOrderStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
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
    }, 3000)
  }

  const handleBuy = async () => {
    setCreating(true); setErrorMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
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
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
  }

  const handleRedeemWithSenCash = async (plan: PlanOption) => {
    setRedeemingPlan(plan.code); setErrorMsg(''); setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/vip/redeem-sencash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: plan.code, planGroup: activeGroup }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không đổi được VIP'); return }
      setInfoMsg(`Đã đổi ${vndToSenCash(plan.priceVnd)} SenCash lấy gói ${plan.name}!`)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await refreshStatus(user.id)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
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
  const isModern = newUiEnabled
  const meta = GROUP_META[activeGroup]
  const GroupIcon = meta.icon

  const wrapperStyle = isModern ? { ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties : undefined
  const wrapperClass = isModern ? 'min-h-screen font-sans pb-16' : 'min-h-screen bg-slate-50 dark:bg-[#0d0d0d] text-slate-900 dark:text-slate-100 pb-16'
  const cardClass = isModern ? 'rounded-2xl p-5' : 'rounded-2xl p-5 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/5'
  const cardStyle = isModern ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined
  const mutedClass = isModern ? '' : 'text-slate-500'
  const mutedStyle = isModern ? { color: 'var(--text-muted)' } : undefined
  const backBtnClass = isModern ? 'p-2.5 rounded-full transition-colors' : 'p-2.5 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm'
  const backBtnStyle = isModern ? { border: '1px solid var(--border)' } : undefined

  if (loading) {
    if (isModern) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải các gói thành viên..." />
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className={backBtnClass} style={backBtnStyle}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" /> Gói thành viên
            </h1>
            <p className={`text-sm mt-1 ${mutedClass}`} style={mutedStyle}>Chọn gói Lite, VIP hoặc Premium — mở khoá kho tài liệu và đặc quyền SenAI.</p>
          </div>
        </div>

        {currentlyActive && (
          <div className="mb-6 p-4 rounded-2xl text-white flex items-center gap-3 shadow-lg" style={{ background: `linear-gradient(to right, ${GROUP_META[currentTier || 'vip'].accent}, ${GROUP_META[currentTier || 'vip'].accent}cc)` }}>
            <GroupIcon className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">
              Bạn đang là thành viên {GROUP_META[currentTier || 'vip'].label}, hết hạn lúc {new Date(vipExpiresAt!).toLocaleString('vi-VN')}.
            </p>
          </div>
        )}

        <button onClick={() => router.push('/vi-sen')} className={`${cardClass} mb-6 w-full flex items-center justify-between transition-colors hover:border-amber-300`} style={cardStyle}>
          <span className="flex items-center gap-2 font-bold text-sm"><Wallet className="w-4 h-4 text-amber-500" /> Ví Sen — {senCashBalance} SC</span>
          <span className={`flex items-center gap-1 text-xs font-bold ${mutedClass}`} style={mutedStyle}>Quản lý ví, nạp SenCash, mua gói SenAI <ChevronRight className="w-3.5 h-3.5" /></span>
        </button>

        {(currentTier === 'vip' || currentTier === 'premium') && currentlyActive && (
          <button onClick={() => router.push('/exclusive-store')} className={`${cardClass} mb-6 w-full flex items-center justify-between transition-colors hover:border-violet-300`} style={cardStyle}>
            <span className="flex items-center gap-2 font-bold text-sm"><Gem className="w-4 h-4 text-violet-500" /> Cửa hàng cao cấp</span>
            <span className={`flex items-center gap-1 text-xs font-bold ${mutedClass}`} style={mutedStyle}>Ưu đãi SenAI Plus/Ultra giá rẻ hơn tới 30% <ChevronRight className="w-3.5 h-3.5" /></span>
          </button>
        )}

        {/* Bộ chọn nhóm gói */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {(Object.keys(GROUP_META) as PlanGroup[]).map(group => {
            const m = GROUP_META[group]
            const Icon = m.icon
            const active = activeGroup === group
            return (
              <button
                key={group}
                onClick={() => switchGroup(group)}
                className="p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  borderColor: active ? m.accent : 'transparent',
                  background: active ? `${m.accent}1a` : (isModern ? 'var(--surface)' : undefined),
                  ...(active ? {} : cardStyle),
                }}
              >
                <Icon className="w-5 h-5" style={{ color: m.accent }} />
                <span className="text-sm font-black" style={{ color: active ? m.accent : undefined }}>{m.label}</span>
                {currentTier === group && currentlyActive && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md text-white" style={{ background: m.accent }}>Đang dùng</span>
                )}
              </button>
            )
          })}
        </div>

        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: meta.accent }}><GroupIcon className="w-4 h-4" /> Đặc quyền gói {meta.label}</h2>
          <ul className={`space-y-2 text-sm ${mutedClass}`} style={mutedStyle}>
            {GROUP_PERKS[activeGroup].map(f => (
              <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>
            ))}
          </ul>
        </div>

        {errorMsg && <p className="text-sm text-rose-500 font-bold mb-4">{errorMsg}</p>}
        {infoMsg && <p className="text-sm text-emerald-500 font-bold mb-4">{infoMsg}</p>}

        {!order || order.status === 'expired' || order.status === 'cancelled' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {meta.plans.map(plan => (
                <button
                  key={plan.code}
                  onClick={() => setSelectedPlan(plan)}
                  className="p-4 rounded-2xl border text-left transition-all"
                  style={selectedPlan.code === plan.code
                    ? { borderColor: meta.accent, background: `${meta.accent}14`, boxShadow: `0 0 0 2px ${meta.accent}` }
                    : cardStyle}
                >
                  <p className={`text-xs font-bold uppercase tracking-wide ${mutedClass}`} style={mutedStyle}>{plan.name}</p>
                  <p className="text-lg font-black mt-1">{plan.priceVnd.toLocaleString('vi-VN')}đ</p>
                  <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${mutedClass}`} style={mutedStyle}><Coins className="w-3 h-3" /> hoặc {vndToSenCash(plan.priceVnd)} SC</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleBuy}
                disabled={creating}
                className="flex-1 py-3.5 rounded-2xl text-white font-black text-sm shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: meta.accent, boxShadow: `0 10px 25px ${meta.accent}4d` }}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <GroupIcon className="w-4 h-4" />}
                Chuyển khoản {selectedPlan.priceVnd.toLocaleString('vi-VN')}đ
              </button>
              <button
                onClick={() => handleRedeemWithSenCash(selectedPlan)}
                disabled={redeemingPlan === selectedPlan.code || senCashBalance < vndToSenCash(selectedPlan.priceVnd)}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 border-2"
                style={{ borderColor: meta.accent, color: meta.accent }}
              >
                {redeemingPlan === selectedPlan.code ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                Đổi {vndToSenCash(selectedPlan.priceVnd)} SenCash
              </button>
            </div>
          </>
        ) : (
          <div className={cardClass} style={{ ...cardStyle, textAlign: 'center' }}>
            {order.status === 'paid' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-black text-lg mb-1">Thanh toán thành công!</p>
                <p className={`text-sm ${mutedClass}`} style={mutedStyle}>Tài khoản của bạn đã được nâng cấp {meta.label}.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm mb-4">Quét mã QR bên dưới bằng app ngân hàng để hoàn tất thanh toán</p>
                {qrUrl && <img src={qrUrl} alt="VietQR" className="w-64 h-auto mx-auto rounded-xl border border-slate-200 dark:border-white/10 mb-4" />}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`text-xs ${mutedClass}`} style={mutedStyle}>Nội dung chuyển khoản:</span>
                  <span className="font-mono font-black text-sm">{order.order_code}</span>
                  <button onClick={handleCopyCode} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
                <p className={`text-xs flex items-center justify-center gap-1 mb-4 ${mutedClass}`} style={mutedStyle}>
                  <Clock className="w-3.5 h-3.5" /> Đơn hàng hết hạn lúc {new Date(order.expires_at).toLocaleTimeString('vi-VN')}
                </p>
                <div className={`flex items-center justify-center gap-2 text-xs ${mutedClass}`} style={mutedStyle}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chờ xác nhận thanh toán tự động...
                </div>
              </>
            )}
            {order.status !== 'paid' && (
              <button onClick={() => { stopPolling(); setOrder(null) }} className={`mt-5 text-xs font-bold flex items-center justify-center gap-1 mx-auto hover:text-slate-600 ${mutedClass}`} style={mutedStyle}>
                <XCircle className="w-3.5 h-3.5" /> Huỷ, chọn lại
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
