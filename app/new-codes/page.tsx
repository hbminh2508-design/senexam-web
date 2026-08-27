'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Gift,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Coins,
  Crown,
  History,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newcodes-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newcodes-body' })

export default function NewCodesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [successReward, setSuccessReward] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [redemptions, setRedemptions] = useState<any[]>([])

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

      // Fetch user redemption history
      const { data } = await supabase
        .from('gift_code_redemptions')
        .select('*, gift_codes(*)')
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false })

      setRedemptions(data || [])
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

  // Tự động định dạng mã 16 chữ số dạng XXXX-XXXX-XXXX-XXXX
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (raw.length > 16) raw = raw.slice(0, 16)

    // Nhóm thành các cụm 4 ký tự
    const parts = raw.match(/.{1,4}/g) || []
    setCode(parts.join('-'))
    setErrorMsg(null)
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = code.trim().replace(/-/g, '')
    if (cleanCode.length < 8) {
      setErrorMsg('Vui lòng nhập đúng định dạng mã quà tặng (16 ký tự).')
      return
    }

    setRedeeming(true)
    setErrorMsg(null)
    setSuccessReward(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/gift-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Mã quà tặng không hợp lệ hoặc đã hết hạn.')
      }

      setSuccessReward(data.reward || 'Đổi mã quà tặng thành công!')
      setCode('')

      // Cập nhật lại lịch sử
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const { data: updated } = await supabase
          .from('gift_code_redemptions')
          .select('*, gift_codes(*)')
          .eq('user_id', auth.user.id)
          .order('redeemed_at', { ascending: false })
        setRedemptions(updated || [])
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kích hoạt mã quà tặng.')
    } finally {
      setRedeeming(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải cổng kích hoạt mã quà tặng...</span>
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
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-sencash"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Ví Sen"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Gift className="inline h-3 w-3 mr-1" /> Trung Tâm Mã Quà Tặng
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newcodes-heading)' }}>
                Đổi Thưởng Gift Code
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Nhập mã quà tặng 16 ký tự từ các sự kiện Giveaway để nhận SenCash, đặc quyền VIP hoặc SenAI Ultra.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
          </button>
        </div>

        {/* REDEEM FORM CARD */}
        <div className="mt-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-pink-500 text-white shadow-xl animate-bounce-short">
            <Gift className="h-8 w-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'var(--font-newcodes-heading)' }}>
              Nhập Mã Quà Tặng 16 Chữ & Số
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Định dạng chuẩn: <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">XXXX-XXXX-XXXX-XXXX</code>
            </p>
          </div>

          <form onSubmit={handleRedeem} className="max-w-md mx-auto space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={handleCodeChange}
                maxLength={19}
                disabled={redeeming}
                className="h-16 w-full rounded-2xl border-2 border-black/15 dark:border-white/20 bg-white dark:bg-slate-800 px-4 text-center font-mono text-xl sm:text-2xl font-black tracking-widest uppercase outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
              />
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successReward && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center space-y-1 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-1.5 text-sm font-black">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Kích hoạt thành công!
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200">
                  Phần thưởng đã cộng vào tài khoản: <strong className="text-amber-500">{successReward}</strong>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={redeeming || !code.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-4 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {redeeming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra & kích hoạt...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-400" /> Nhận Thưởng Ngay
                </>
              )}
            </button>
          </form>
        </div>

        {/* REDEMPTION HISTORY CARD */}
        <div className="mt-8 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-black/10 dark:border-white/10">
            <History className="h-5 w-5 text-indigo-500" />
            <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newcodes-heading)' }}>
              Lịch Sử Đổi Mã Quà Tặng ({redemptions.length})
            </h3>
          </div>

          {redemptions.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center py-6">
              Bạn chưa kích hoạt mã quà tặng nào.
            </p>
          ) : (
            <div className="space-y-2.5">
              {redemptions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-xs font-bold"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {item.gift_codes?.code || 'MÃ QUÀ TẶNG'}
                    </span>
                    <span className="text-[11px] text-[#6B7280] dark:text-slate-400 block">
                      Đã đổi lúc {new Date(item.redeemed_at).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <span className="rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-black">
                    Thành công
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
