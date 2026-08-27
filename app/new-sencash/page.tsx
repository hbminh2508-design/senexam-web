'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  VND_PER_SENCASH,
  MIN_TOPUP_VND,
  vndToSenCash,
  senCashToVnd,
  isValidTopupAmount,
  fetchSenCashBalance,
  fetchMyTransactions,
  type SenCashTransaction,
  type SenCashTopupOrder,
} from '@/lib/senCash'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Coins,
  CreditCard,
  Crown,
  Wallet,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newsencash-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newsencash-body' })

const PRESET_AMOUNTS = [
  { vnd: 10_000, sc: 20, popular: false },
  { vnd: 20_000, sc: 40, popular: false },
  { vnd: 50_000, sc: 100, popular: true },
  { vnd: 100_000, sc: 200, popular: false },
  { vnd: 200_000, sc: 400, popular: false },
  { vnd: 500_000, sc: 1_000, popular: false },
]

export default function NewSenCashPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<SenCashTransaction[]>([])

  // Top-up state
  const [selectedVnd, setSelectedVnd] = useState<number>(50_000)
  const [customVnd, setCustomVnd] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)

  // Order & QR modal
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [order, setOrder] = useState<SenCashTopupOrder | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const loadData = async (userId: string) => {
    try {
      const bal = await fetchSenCashBalance(userId)
      setBalance(bal)
      const txs = await fetchMyTransactions(userId)
      setTransactions(txs)
    } catch (e) {
      console.error('Error fetching sencash data:', e)
    }
  }

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

      await ensureStudentProfile(user.id)
      await loadData(user.id)
      setLoading(false)
    }

    init()

    return () => {
      stopPolling()
    }
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

  const pollOrderStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sencash/topup-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) return

        if (json.order?.status === 'paid') {
          setOrder(json.order)
          stopPolling()
          const { data: auth } = await supabase.auth.getUser()
          if (auth.user) await loadData(auth.user.id)
        } else if (json.order?.status === 'expired' || json.order?.status === 'cancelled') {
          setOrder(json.order)
          stopPolling()
        }
      } catch (err) {
        console.error('Error polling topup status:', err)
      }
    }, 2500)
  }

  const handleCreateTopupOrder = async () => {
    const amount = isCustom ? parseInt(customVnd, 10) : selectedVnd
    if (!amount || !isValidTopupAmount(amount)) {
      setErrorMsg(`Số tiền nạp phải là bội số của ${MIN_TOPUP_VND.toLocaleString('vi-VN')}đ (tối thiểu ${MIN_TOPUP_VND.toLocaleString('vi-VN')}đ).`)
      return
    }

    setCreatingOrder(true)
    setErrorMsg('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.replace('/new-sign')
        return
      }

      const res = await fetch('/api/sencash/create-topup-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountVnd: amount }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không thể tạo đơn nạp SenCash')
        return
      }

      setOrder(json.order)
      setQrUrl(json.qrUrl)
      pollOrderStatus(json.order.id, token)
    } catch (e: any) {
      setErrorMsg(e.message || 'Đã có lỗi xảy ra.')
    } finally {
      setCreatingOrder(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải Ví Sen (SenCash)...</span>
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
          ? 'radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(99, 102, 241, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
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
                  <Coins className="inline h-3 w-3 mr-1" /> Ví SenCash Tiện Ích
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                Ví Sen & Nạp SenCash
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Tỉ giá cố định 500đ = 1 SC. Nạp nhanh qua VietQR tự động kích hoạt 24/7.
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
              href="/new-vip"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:opacity-90"
            >
              <Crown className="h-4 w-4" /> Nâng cấp VIP
            </Link>
          </div>
        </div>

        {/* Balance Card & Utility Intro */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          
          {/* Main Balance Widget */}
          <div className="relative overflow-hidden rounded-[28px] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-white/80 to-white/90 dark:from-amber-500/20 dark:via-slate-900/85 dark:to-slate-900/90 p-6 shadow-md backdrop-blur-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-sm">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Số dư khả dụng</span>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">Ví SenExam của bạn</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 px-3 py-1 text-xs font-black">
                500đ = 1 SC
              </span>
            </div>

            <div className="mt-6 mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-amber-600 dark:text-amber-400" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                  {balance.toLocaleString('vi-VN')}
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white">SenCash</span>
              </div>
              <p className="mt-1 text-xs text-[#6B7280] dark:text-slate-400 font-semibold">
                Tương đương ≈ {(balance * VND_PER_SENCASH).toLocaleString('vi-VN')} VNĐ
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-black/10 dark:border-white/10 text-xs">
              <Link
                href="/new-vip"
                className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Đổi gói VIP ngay <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Perks of SenCash */}
          <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                <Sparkles className="h-4 w-4 text-amber-500" /> SenCash dùng để làm gì?
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Đổi gói VIP / Premium:</strong> Trừ thẳng từ số dư SenCash mà không cần chuyển khoản lại.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Tải tài liệu độc quyền:</strong> Mở khóa các bộ đề & chuyên đề nâng cao trong Thư viện.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Nâng hạn mức SenAI:</strong> Tăng thêm câu hỏi tương tác giải bài tập thông minh.</span>
                </li>
              </ul>
            </div>
            <p className="mt-4 text-[11px] text-[#6B7280] dark:text-slate-400 italic">
              💡 SenCash không có hạn sử dụng, được lưu trữ vĩnh viễn trong tài khoản của bạn.
            </p>
          </div>
        </div>

        {/* Top-up Form Section */}
        <div className="mt-8 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
            <div>
              <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                Nạp SenCash qua VietQR
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                Chọn mệnh giá nạp bên dưới để tạo mã quét ngân hàng tự động.
              </p>
            </div>
          </div>

          {/* Presets Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {PRESET_AMOUNTS.map((item) => {
              const active = !isCustom && selectedVnd === item.vnd
              return (
                <button
                  key={item.vnd}
                  type="button"
                  onClick={() => {
                    setIsCustom(false)
                    setSelectedVnd(item.vnd)
                  }}
                  className={`relative rounded-2xl border p-3.5 text-center transition-all ${
                    active
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 shadow-sm scale-105'
                      : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {item.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                      Phổ biến
                    </span>
                  )}
                  <p className="text-sm font-black" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                    {item.vnd.toLocaleString('vi-VN')}đ
                  </p>
                  <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    +{item.sc} SC
                  </p>
                </button>
              )
            })}
          </div>

          {/* Custom Input */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4B5563] dark:text-slate-300">
              <span>Hoặc nhập số tiền:</span>
            </div>
            <div className="relative flex-1 w-full max-w-xs">
              <input
                type="number"
                step={MIN_TOPUP_VND}
                min={MIN_TOPUP_VND}
                placeholder="VD: 30000"
                value={customVnd}
                onChange={(e) => {
                  setCustomVnd(e.target.value)
                  setIsCustom(true)
                }}
                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-3 pr-10 text-xs font-bold outline-none focus:border-amber-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">
                VNĐ
              </span>
            </div>
            {isCustom && customVnd && parseInt(customVnd, 10) >= MIN_TOPUP_VND && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                = +{vndToSenCash(parseInt(customVnd, 10))} SenCash
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{errorMsg}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleCreateTopupOrder}
              disabled={creatingOrder}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Tạo mã thanh toán VietQR
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="mt-8 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
          <h2 className="text-xl font-black mb-4" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
            Lịch sử biến động SenCash
          </h2>

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center text-xs text-[#6B7280] dark:text-slate-400">
              Chưa có giao dịch SenCash nào trong tài khoản của bạn.
            </div>
          ) : (
            <div className="divide-y divide-black/10 dark:divide-white/10">
              {transactions.map((tx) => {
                const isPositive = tx.delta > 0
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                        {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold">
                          {tx.reason === 'topup' ? 'Nạp tiền qua VietQR' : tx.reason === 'vip_redeem' ? 'Đổi gói thành viên VIP' : tx.reason === 'admin_gift' ? 'Quà tặng từ SenExam' : tx.reason === 'gift_code' ? 'Nhập mã Giftcode' : 'Sử dụng dịch vụ'}
                        </p>
                        <p className="text-[10px] text-[#6B7280] dark:text-slate-400">
                          {new Date(tx.created_at).toLocaleString('vi-VN')} {tx.reference ? `• ${tx.reference}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                      {isPositive ? `+${tx.delta}` : tx.delta} SC
                    </span>
                  </div>
                )
              })}
            </div>
          )}
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
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                  Nạp Tiền Thành Công!
                </h3>
                <p className="text-xs text-[#4B5563] dark:text-slate-300">
                  Bạn đã được cộng <strong>+{order.sencash_amount} SenCash</strong> vào ví thành công.
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
                  <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newsencash-heading)' }}>
                    Quét mã VietQR để nạp
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
                    <span className="text-[#6B7280] dark:text-slate-400">Số tiền:</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-black">{order.amount_vnd.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280] dark:text-slate-400">SenCash nhận được:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-black">+{order.sencash_amount} SC</strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                    <span className="text-[#6B7280] dark:text-slate-400">Nội dung CK:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.order_code)}
                      className="inline-flex items-center gap-1 font-mono font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {order.order_code} {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280] dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span>Hệ thống đang tự động kiểm tra thanh toán...</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
