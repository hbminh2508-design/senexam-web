'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { VIP_PLANS, VipPlan, VipOrder, isVipActive } from '@/lib/vipMembership'
import { ArrowLeft, Crown, Check, Loader2, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react'

export default function VipPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<VipPlan>(VIP_PLANS[2])
  const [creating, setCreating] = useState(false)
  const [order, setOrder] = useState<VipOrder | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('vip_expires_at').eq('id', user.id).single()
      setVipExpiresAt(profile?.vip_expires_at || null)
      setLoading(false)
    }
    init()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [router])

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

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
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('vip_expires_at').eq('id', user.id).single()
          setVipExpiresAt(profile?.vip_expires_at || null)
        }
      } else if (json.order.status === 'expired' || json.order.status === 'cancelled') {
        stopPolling()
      }
    }, 3000)
  }

  const handleCreateOrder = async () => {
    setCreating(true)
    setErrorMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      const res = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: selectedPlan.code }),
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

  const handleCopyCode = () => {
    if (!order) return
    navigator.clipboard.writeText(order.order_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentlyVip = isVipActive({ vip_expires_at: vipExpiresAt })

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0d0d] text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="p-2.5 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" /> Thành viên VIP
            </h1>
            <p className="text-sm text-slate-500 mt-1">Nâng cấp để mở khoá kho tài liệu VIP và các đặc quyền độc quyền.</p>
          </div>
        </div>

        {currentlyVip && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              Bạn đang là thành viên VIP, hết hạn lúc {new Date(vipExpiresAt!).toLocaleString('vi-VN')}.
            </p>
          </div>
        )}

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/5 mb-6">
          <h2 className="font-bold text-sm mb-3 text-slate-700 dark:text-slate-300">Đặc quyền VIP</h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {['Không quảng cáo', 'Kho tài liệu riêng dành cho VIP, 5 lượt tải/ngày', 'Nhận bản cập nhật sớm hơn', 'Tính năng độc quyền trong tương lai'].map(f => (
              <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}</li>
            ))}
          </ul>
        </div>

        {!order || order.status === 'expired' || order.status === 'cancelled' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {VIP_PLANS.map(plan => (
                <button
                  key={plan.code}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 rounded-2xl border text-left transition-all ${selectedPlan.code === plan.code ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-[#161616] hover:border-amber-300'}`}
                >
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{plan.name}</p>
                  <p className="text-lg font-black mt-1">{plan.priceVnd.toLocaleString('vi-VN')}đ</p>
                </button>
              ))}
            </div>

            {errorMsg && <p className="text-sm text-rose-500 font-bold mb-4">{errorMsg}</p>}

            <button
              onClick={handleCreateOrder}
              disabled={creating}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              Nâng cấp {selectedPlan.name} — {selectedPlan.priceVnd.toLocaleString('vi-VN')}đ
            </button>
          </>
        ) : (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/5 text-center">
            {order.status === 'paid' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-black text-lg mb-1">Thanh toán thành công!</p>
                <p className="text-sm text-slate-500">Tài khoản của bạn đã được nâng cấp VIP.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm mb-4">Quét mã QR bên dưới bằng app ngân hàng để hoàn tất thanh toán</p>
                {qrUrl && <img src={qrUrl} alt="VietQR" className="w-64 h-auto mx-auto rounded-xl border border-slate-200 dark:border-white/10 mb-4" />}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs text-slate-500">Nội dung chuyển khoản:</span>
                  <span className="font-mono font-black text-sm">{order.order_code}</span>
                  <button onClick={handleCopyCode} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1 mb-4">
                  <Clock className="w-3.5 h-3.5" /> Đơn hàng hết hạn lúc {new Date(order.expires_at).toLocaleTimeString('vi-VN')}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chờ xác nhận thanh toán tự động...
                </div>
              </>
            )}
            {order.status !== 'paid' && (
              <button onClick={() => { stopPolling(); setOrder(null) }} className="mt-5 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto">
                <XCircle className="w-3.5 h-3.5" /> Huỷ, chọn lại gói
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
