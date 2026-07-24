'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { VIP_PLANS, VipPlan, VipOrder, isVipActive } from '@/lib/vipMembership'
import {
  TOPUP_PRESETS_VND, MIN_TOPUP_VND, isValidTopupAmount, vndToSenCash,
  SenCashTopupOrder, SenCashTransaction, fetchSenCashBalance, fetchMyTransactions,
} from '@/lib/senCash'
import { isVipFeatureEnabled } from '@/lib/systemRelease'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import { ArrowLeft, Crown, Check, Loader2, Copy, CheckCircle2, XCircle, Clock, Coins, Wallet } from 'lucide-react'

type PendingPayment =
  | { kind: 'vip'; order: VipOrder; qrUrl: string }
  | { kind: 'sencash'; order: SenCashTopupOrder; qrUrl: string }

export default function VipPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null)
  const [senCashBalance, setSenCashBalance] = useState(0)
  const [transactions, setTransactions] = useState<SenCashTransaction[]>([])

  const [selectedPlan, setSelectedPlan] = useState<VipPlan>(VIP_PLANS[2])
  const [topupAmount, setTopupAmount] = useState(TOPUP_PRESETS_VND[0])
  const [customTopup, setCustomTopup] = useState('')

  const [creating, setCreating] = useState(false)
  const [redeemingPlan, setRedeemingPlan] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshWallet = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('vip_expires_at').eq('id', userId).single()
    setVipExpiresAt(profile?.vip_expires_at || null)
    const [balance, txs] = await Promise.all([fetchSenCashBalance(userId), fetchMyTransactions(userId)])
    setSenCashBalance(balance)
    setTransactions(txs)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('is_beta_tester').eq('id', user.id).maybeSingle()
      const enabled = await isVipFeatureEnabled(!!profile?.is_beta_tester)
      if (!enabled) { router.push('/dashboard'); return }
      await refreshWallet(user.id)
      setLoading(false)
    }
    init()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [router])

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const pollStatus = (kind: 'vip' | 'sencash', orderId: string, token: string) => {
    stopPolling()
    const endpoint = kind === 'vip' ? '/api/vip/order-status' : '/api/sencash/topup-status'
    pollRef.current = setInterval(async () => {
      const res = await fetch(`${endpoint}?orderId=${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) return
      setPending(prev => prev ? { ...prev, order: json.order } as PendingPayment : prev)
      if (json.order.status === 'paid') {
        stopPolling()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await refreshWallet(user.id)
      } else if (json.order.status === 'expired' || json.order.status === 'cancelled') {
        stopPolling()
      }
    }, 3000)
  }

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const handleBuyVip = async () => {
    setCreating(true); setErrorMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: selectedPlan.code }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không tạo được đơn hàng'); return }
      setPending({ kind: 'vip', order: json.order, qrUrl: json.qrUrl })
      pollStatus('vip', json.order.id, token)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
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
      setPending({ kind: 'sencash', order: json.order, qrUrl: json.qrUrl })
      pollStatus('sencash', json.order.id, token)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
  }

  const handleRedeemWithSenCash = async (plan: VipPlan) => {
    setRedeemingPlan(plan.code); setErrorMsg(''); setInfoMsg('')
    try {
      const token = await getToken()
      if (!token) { router.push('/login'); return }
      const res = await fetch('/api/vip/redeem-sencash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: plan.code }),
      })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Không đổi được VIP'); return }
      setInfoMsg(`Đã đổi ${vndToSenCash(plan.priceVnd)} SenCash lấy gói ${plan.name}!`)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await refreshWallet(user.id)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setRedeemingPlan(null)
    }
  }

  const handleCopyCode = () => {
    if (!pending) return
    navigator.clipboard.writeText(pending.order.order_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentlyVip = isVipActive({ vip_expires_at: vipExpiresAt })
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
    if (isModern) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải ví SenCash..." />
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
              <Crown className="w-6 h-6 text-amber-500" /> VIP &amp; Ví SenCash
            </h1>
            <p className={`text-sm mt-1 ${mutedClass}`} style={mutedStyle}>Nâng cấp VIP hoặc nạp SenCash để đổi VIP và thêm lượt tải tài liệu.</p>
          </div>
        </div>

        {currentlyVip && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-3 shadow-lg shadow-amber-500/20">
            <Crown className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">
              Bạn đang là thành viên VIP, hết hạn lúc {new Date(vipExpiresAt!).toLocaleString('vi-VN')}.
            </p>
          </div>
        )}

        {/* Ví SenCash */}
        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-500" /> Ví SenCash</h2>
            <span className="flex items-center gap-1.5 font-black text-lg text-amber-600 dark:text-amber-400">
              <Coins className="w-4 h-4" /> {senCashBalance}
            </span>
          </div>
          <p className={`text-xs mb-3 ${mutedClass}`} style={mutedStyle}>Tỉ giá: 500đ = 1 SenCash (tối thiểu nạp {MIN_TOPUP_VND.toLocaleString('vi-VN')}đ). Dùng SenCash để đổi VIP ngay lập tức hoặc mua thêm lượt tải tài liệu VIP (2 SenCash/lượt sau khi hết 5 lượt free/ngày).</p>
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
          <div className="flex items-center gap-2 mb-4">
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

          {transactions.length > 0 && (
            <div className="border-t pt-3" style={{ borderColor: isModern ? 'var(--border)' : undefined }}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${mutedClass}`} style={mutedStyle}>Giao dịch gần đây</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <span className={mutedClass} style={mutedStyle}>
                      {tx.reason === 'topup' ? 'Nạp ví' : tx.reason === 'vip_redeem' ? 'Đổi VIP' : 'Tải tài liệu VIP'} · {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <span className={`font-bold ${tx.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{tx.delta > 0 ? '+' : ''}{tx.delta} SC</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${cardClass} mb-6`} style={cardStyle}>
          <h2 className={`font-bold text-sm mb-3 ${mutedClass}`} style={mutedStyle}>Đặc quyền VIP</h2>
          <ul className={`space-y-2 text-sm ${mutedClass}`} style={mutedStyle}>
            {['Không quảng cáo', 'Kho tài liệu riêng dành cho VIP, 5 lượt tải free/ngày', 'Nhận bản cập nhật sớm hơn', 'Tính năng độc quyền trong tương lai'].map(f => (
              <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}</li>
            ))}
          </ul>
        </div>

        {errorMsg && <p className="text-sm text-rose-500 font-bold mb-4">{errorMsg}</p>}
        {infoMsg && <p className="text-sm text-emerald-500 font-bold mb-4">{infoMsg}</p>}

        {!pending || pending.order.status === 'expired' || pending.order.status === 'cancelled' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {VIP_PLANS.map(plan => (
                <button
                  key={plan.code}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 rounded-2xl border text-left transition-all ${selectedPlan.code === plan.code ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500' : 'border-slate-200 dark:border-white/5 hover:border-amber-300'}`}
                  style={selectedPlan.code !== plan.code ? cardStyle : undefined}
                >
                  <p className={`text-xs font-bold uppercase tracking-wide ${mutedClass}`} style={mutedStyle}>{plan.name}</p>
                  <p className="text-lg font-black mt-1">{plan.priceVnd.toLocaleString('vi-VN')}đ</p>
                  <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${mutedClass}`} style={mutedStyle}><Coins className="w-3 h-3" /> hoặc {vndToSenCash(plan.priceVnd)} SC</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleBuyVip}
                disabled={creating}
                className="flex-1 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                Chuyển khoản {selectedPlan.priceVnd.toLocaleString('vi-VN')}đ
              </button>
              <button
                onClick={() => handleRedeemWithSenCash(selectedPlan)}
                disabled={redeemingPlan === selectedPlan.code || senCashBalance < vndToSenCash(selectedPlan.priceVnd)}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 border-2 border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                {redeemingPlan === selectedPlan.code ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                Đổi {vndToSenCash(selectedPlan.priceVnd)} SenCash
              </button>
            </div>
          </>
        ) : (
          <div className={cardClass} style={{ ...cardStyle, textAlign: 'center' }}>
            {pending.order.status === 'paid' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-black text-lg mb-1">Thanh toán thành công!</p>
                <p className={`text-sm ${mutedClass}`} style={mutedStyle}>
                  {pending.kind === 'vip' ? 'Tài khoản của bạn đã được nâng cấp VIP.' : 'Ví SenCash của bạn đã được cộng tiền.'}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm mb-4">Quét mã QR bên dưới bằng app ngân hàng để hoàn tất thanh toán</p>
                {pending.qrUrl && <img src={pending.qrUrl} alt="VietQR" className="w-64 h-auto mx-auto rounded-xl border border-slate-200 dark:border-white/10 mb-4" />}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`text-xs ${mutedClass}`} style={mutedStyle}>Nội dung chuyển khoản:</span>
                  <span className="font-mono font-black text-sm">{pending.order.order_code}</span>
                  <button onClick={handleCopyCode} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
                <p className={`text-xs flex items-center justify-center gap-1 mb-4 ${mutedClass}`} style={mutedStyle}>
                  <Clock className="w-3.5 h-3.5" /> Đơn hàng hết hạn lúc {new Date(pending.order.expires_at).toLocaleTimeString('vi-VN')}
                </p>
                <div className={`flex items-center justify-center gap-2 text-xs ${mutedClass}`} style={mutedStyle}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chờ xác nhận thanh toán tự động...
                </div>
              </>
            )}
            {pending.order.status !== 'paid' && (
              <button onClick={() => { stopPolling(); setPending(null) }} className={`mt-5 text-xs font-bold flex items-center justify-center gap-1 mx-auto hover:text-slate-600 ${mutedClass}`} style={mutedStyle}>
                <XCircle className="w-3.5 h-3.5" /> Huỷ, chọn lại
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
