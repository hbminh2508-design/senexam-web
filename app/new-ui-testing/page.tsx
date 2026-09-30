'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { processAutoRenew } from '@/lib/autoRenewService'
import {
  ArrowLeft,
  Sparkles,
  Crown,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Rocket,
  Brain,
  Clock,
  Compass,
  CheckCircle2,
  Lock,
  ChevronRight,
  Sun,
  Moon,
  Flame,
  Coins,
  RefreshCw,
  Sliders,
  Award,
  Calendar,
  AlertCircle,
  Eye,
  Check,
  TrendingUp,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-testing-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-testing-body' })

export default function NewUiTestingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [hasVipPremiumPlus, setHasVipPremiumPlus] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [activeTheme, setActiveTheme] = useState<'emerald' | 'gold' | 'aurora' | 'obsidian'>('gold')
  const [autoRenewVip, setAutoRenewVip] = useState(false)
  const [autoRenewSenAi, setAutoRenewSenAi] = useState(false)
  const [renewStatusMsg, setRenewStatusMsg] = useState<string | null>(null)
  const [updatingSetting, setUpdatingSetting] = useState(false)

  useEffect(() => {
    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') !== 'light')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))

    const init = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth?.user) {
          router.replace('/new-sign')
          return
        }

        const user = auth.user
        setCurrentUser(user)

        // Lấy profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profile) {
          setUserProfile(profile)
          setUserRole(profile.role || 'student')
          setHasVipPremiumPlus(Boolean(profile.is_vip_premium_plus || profile.role === 'admin' || profile.role === 'collab'))
          setAutoRenewVip(Boolean(profile.auto_renew_vip))
          setAutoRenewSenAi(Boolean(profile.auto_renew_senai))

          // Chạy kiểm tra tự động gia hạn bằng SC
          const renewRes = await processAutoRenew(user.id)
          if (renewRes.messages.length > 0) {
            setRenewStatusMsg(renewRes.messages.join(' • '))
          }
        }
      } catch (err) {
        console.error('Lỗi khởi tạo new-ui-testing:', err)
      } finally {
        setLoading(false)
      }
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

  // Bật/tắt tự động gia hạn
  const handleToggleAutoRenew = async (type: 'vip' | 'senai') => {
    if (!currentUser || updatingSetting) return
    setUpdatingSetting(true)
    try {
      const nextVal = type === 'vip' ? !autoRenewVip : !autoRenewSenAi
      const updateData: Record<string, any> = {}
      if (type === 'vip') {
        updateData.auto_renew_vip = nextVal
        setAutoRenewVip(nextVal)
      } else {
        updateData.auto_renew_senai = nextVal
        setAutoRenewSenAi(nextVal)
      }

      await supabase.from('profiles').update(updateData).eq('id', currentUser.id)
      setRenewStatusMsg(`Đã ${nextVal ? 'bật' : 'tắt'} tự động gia hạn bằng SC cho gói ${type.toUpperCase()}.`)
    } catch (e: any) {
      alert('Lỗi cập nhật thiết lập: ' + e.message)
    } finally {
      setUpdatingSetting(false)
    }
  }

  const isAdminOrCollab = userRole === 'admin' || userRole === 'collab'
  const isAuthorized = isAdminOrCollab || hasVipPremiumPlus

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080D1A] text-slate-200">
        <Sparkles className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-black tracking-widest uppercase text-amber-400/80">
          Đang khởi tạo Engine Sen 3.0 & Cổng Thử Nghiệm...
        </p>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#070B14] text-slate-100 font-sans selection:bg-amber-500 selection:text-black`}
    >
      {/* BACKGROUND GRADIENTS HIỆN ĐẠI SEN 3.0 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-transparent blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-indigo-600/15 via-purple-600/10 to-transparent blur-[160px]" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-emerald-500/15 to-transparent blur-[130px]" />
      </div>

      {/* TOPBAR ĐIỀU HƯỚNG */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070B14]/85 backdrop-blur-2xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            prefetch={false}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 shadow-sm transition"
            title="Quay lại Dashboard chính"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <Crown className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                  SEN 3.0 BETA LAB
                </span>
              </span>

              {isAdminOrCollab && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Admin Exclusive
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-black tracking-tight mt-0.5">
              Cổng Thử Nghiệm Giao Diện Mới & Roadmap VIP Premium+
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* HUD Performance */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> 120 FPS
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300">Latency: 8ms</span>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
          </button>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* THÔNG BÁO TỰ ĐỘNG GIA HẠN NẾU CÓ */}
        {renewStatusMsg && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-bold flex items-center gap-2.5 shadow-lg animate-in slide-in-from-top-2">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{renewStatusMsg}</span>
          </div>
        )}

        {/* NẾU KHÔNG PHẢI ADMIN HOẶC CHƯA CÓ VÉ VIP PREMIUM+: HIỂN THỊ CỔNG GIỚI THIỆU ROADMAP */}
        {!isAuthorized ? (
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-black/40 to-black/60 p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6 shadow-2xl backdrop-blur-2xl">
            <div className="h-16 w-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <Lock className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2">
                Trang Ẩn Đang Thử Nghiệm
              </span>
              <h2 className="text-2xl sm:text-4xl font-black" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                Khu Vực Dành Riêng Cho Admin & Gói VIP Premium+
              </h2>
              <p className="mt-3 text-sm text-slate-300 max-w-lg mx-auto">
                SenExam 3.0 đang trong giai đoạn Alpha thử nghiệm nội bộ. Tính năng này sẽ chính thức khả dụng trước tiên cho người dùng sở hữu <strong>Gói VIP Premium+</strong> ra mắt vào cuối Năm 2026.
              </p>
            </div>

            {/* Thẻ Roadmap tóm lược cho học sinh */}
            <div className="text-left rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Lộ Trình Phát Hành Gói VIP Premium+ (Q4 / 2026)
              </h3>
              <ul className="text-xs space-y-2 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <strong>Tháng 10/2026:</strong> Trải nghiệm trước giao diện Sen 3.0 siêu mượt 120 FPS.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <strong>Tháng 11/2026:</strong> Trợ lý gia sư AI Sen Tutor 24/7 cá nhân hóa từng đề thi.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <strong>Tháng 12/2026:</strong> Chính thức mở bán gói VIP Premium+ với vô vàn đặc quyền tối thượng!
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <Link
                href="/new-vip"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition"
              >
                <Crown className="h-4 w-4" /> Tham gia Danh sách chờ VIP Premium+
              </Link>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* GIAO DIỆN BẢNG ĐIỀU KHIỂN SEN 3.0 TOÀN NĂNG (ADMIN & VIP PREMIUM+)  */
          /* ================================================================= */
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* HERO BANNER SEN 3.0 */}
            <div className="relative overflow-hidden rounded-[36px] border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-purple-500/10 p-6 sm:p-10 shadow-[0_20px_60px_rgba(245,158,11,0.15)] backdrop-blur-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-md flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 fill-black" /> SenExam 3.0 Next-Gen
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-white/20 bg-white/10 text-white">
                      Bản Xem Trước Kiến Trúc Mới
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                    Bứt Phá Giao Diện & Tối Ưu Tốc Độ ⚡
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl" style={{ fontFamily: 'var(--font-testing-body)' }}>
                    Sen 3.0 ứng dụng công nghệ render phân tán thế hệ mới, loại bỏ độ trễ DOM, tích hợp trợ lý gia sư AI đa luồng và kho đề thi đồng bộ hóa tức thì.
                  </p>
                </div>

                {/* Theme Selector */}
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-2 shrink-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    Đổi Phong Cách Sen 3.0:
                  </span>
                  <div className="flex items-center gap-2">
                    {[
                      { key: 'gold', label: 'Vàng Hoàng Gia', color: 'from-amber-400 to-yellow-500' },
                      { key: 'emerald', label: 'Ngọc Lục Bảo', color: 'from-emerald-400 to-teal-500' },
                      { key: 'aurora', label: 'Bắc Cực Quang', color: 'from-indigo-400 to-purple-500' },
                      { key: 'obsidian', label: 'Hắc Thạch', color: 'from-slate-600 to-slate-800' },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTheme(t.key as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          activeTheme === t.key
                            ? 'border-white/40 bg-white/15 text-white shadow-sm'
                            : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${t.color}`} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* THIẾT LẬP TỰ ĐỘNG GIA HẠN BẰNG SC (VIP & SEN AI)                             */}
            {/* ========================================================================= */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">
                      Tính Năng Tự Động Gia Hạn Bằng SenCash (SC)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tự động trích trừ SC từ ví khi đến hạn. Nếu số dư SC không đủ, hệ thống sẽ tự động hủy gói để tránh gián đoạn trải nghiệm.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                  <Coins className="h-3.5 w-3.5" /> Ví: {userProfile?.sencash_balance || 0} SC
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Switch Tự động gia hạn VIP */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <strong className="text-sm font-black">Gói Sen VIP (30 SC / 30 ngày)</strong>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {autoRenewVip ? 'Đang bật: Sẽ tự trừ 30 SC khi hết hạn.' : 'Đang tắt: Không tự động gia hạn.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleAutoRenew('vip')}
                    disabled={updatingSetting}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                      autoRenewVip
                        ? 'bg-amber-500 text-black hover:bg-amber-400'
                        : 'border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {autoRenewVip ? 'Đang Bật' : 'Bật Ngay'}
                  </button>
                </div>

                {/* Switch Tự động gia hạn Sen AI */}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-4 w-4 text-indigo-400" />
                      <strong className="text-sm font-black">Gói Trợ Lý Sen AI (20 SC / 30 ngày)</strong>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {autoRenewSenAi ? 'Đang bật: Sẽ tự trừ 20 SC khi hết hạn.' : 'Đang tắt: Không tự động gia hạn.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleAutoRenew('senai')}
                    disabled={updatingSetting}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                      autoRenewSenAi
                        ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                        : 'border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {autoRenewSenAi ? 'Đang Bật' : 'Bật Ngay'}
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* ROADMAP Q4 - 2026: GÓI ĐẶC QUYỀN VIP PREMIUM+ (SEN 3.0)                   */}
            {/* ========================================================================= */}
            <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 via-black/40 to-transparent p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Chiến Lược Sản Phẩm
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                    Roadmap Q4 - 2026: Gói Đặc Quyền VIP Premium+
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Kế hoạch ra mắt các tiện ích đỉnh cao của hệ sinh thái SenExam 3.0 trong 3 tháng cuối năm 2026.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 text-amber-300 text-xs font-black">
                    Dự kiến mở bán: Tháng 12/2026
                  </span>
                </div>
              </div>

              {/* 3 CỘT GIAI ĐOẠN ROADMAP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                
                {/* Giai đoạn 1: Tháng 10/2026 */}
                <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Tháng 10 / 2026
                    </span>
                    <span className="text-xs font-black text-emerald-400">Alpha Core</span>
                  </div>
                  <h4 className="text-base font-black text-white">Nền Tảng Sen 3.0 Core</h4>
                  <ul className="text-xs text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Kiến trúc giao diện siêu nhẹ, cắt giảm 70% dung lượng DOM.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Tối ưu hóa mượt mà chuẩn 120 FPS trên mọi thiết bị di động & PC.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Đồng bộ hóa phiên thi và nhận diện thiết bị tức thì.</span>
                    </li>
                  </ul>
                </div>

                {/* Giai đoạn 2: Tháng 11/2026 */}
                <div className="relative rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Tháng 11 / 2026
                    </span>
                    <span className="text-xs font-black text-indigo-400">AI Intelligence</span>
                  </div>
                  <h4 className="text-base font-black text-white">Gia Sư AI Sen Tutor 24/7</h4>
                  <ul className="text-xs text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Phân tích lỗ hổng kiến thức tự động sau mỗi bài thi.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Thuật toán sinh đề cá nhân hóa theo từng chuyên đề hổng.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Hỏi đáp giọng nói và hình ảnh tương tác thời gian thực.</span>
                    </li>
                  </ul>
                </div>

                {/* Giai đoạn 3: Tháng 12/2026 */}
                <div className="relative rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-500/5 p-5 space-y-3 shadow-lg shadow-amber-500/10">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-black font-black">
                      Tháng 12 / 2026
                    </span>
                    <span className="text-xs font-black text-amber-300">Official Release</span>
                  </div>
                  <h4 className="text-base font-black text-amber-200">Phát Hành VIP Premium+</h4>
                  <ul className="text-xs text-slate-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>Toàn quyền mở khóa 100% kho đề khảo thí đặc quyền 2027.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>SEB Ultra Safe Exam bảo mật chống gian lận đa luồng.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>Dung lượng lưu trữ đám mây đề thi và lời giải riêng không giới hạn.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>Huy hiệu Rồng Vàng Hoàng Gia VIP Premium+ trên toàn hệ thống.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* LỐI TẮT KHẢO THÍ SIÊU TỐC SEN 3.0 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/new-exams"
                prefetch={false}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 transition hover:scale-[1.02] flex flex-col justify-between"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <h4 className="font-black text-sm">Kho Đề Thi Mới</h4>
                  <p className="text-xs text-slate-400 mt-1">Truy cập toàn bộ đề thi chuẩn THPTQG, HSA, TSA.</p>
                </div>
                <span className="text-[11px] font-bold text-amber-400 mt-3 group-hover:underline flex items-center gap-1">
                  Mở ngay <ChevronRight className="h-3 w-3" />
                </span>
              </Link>

              <Link
                href="/new-setup-course"
                prefetch={false}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 transition hover:scale-[1.02] flex flex-col justify-between"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h4 className="font-black text-sm">Soạn Đề KaTeX 3.0</h4>
                  <p className="text-xs text-slate-400 mt-1">Cổng thiết lập đề thi thông minh không cần PDF.</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 mt-3 group-hover:underline flex items-center gap-1">
                  Soạn đề ngay <ChevronRight className="h-3 w-3" />
                </span>
              </Link>

              <Link
                href="/new-senai-studio"
                prefetch={false}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 transition hover:scale-[1.02] flex flex-col justify-between"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-3">
                    <Brain className="h-5 w-5" />
                  </div>
                  <h4 className="font-black text-sm">Gia Sư Sen AI Studio</h4>
                  <p className="text-xs text-slate-400 mt-1">Trợ lý AI đa tầng giải thích chi tiết từng bước.</p>
                </div>
                <span className="text-[11px] font-bold text-indigo-400 mt-3 group-hover:underline flex items-center gap-1">
                  Hỏi đáp ngay <ChevronRight className="h-3 w-3" />
                </span>
              </Link>

              <Link
                href="/new-history"
                prefetch={false}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 transition hover:scale-[1.02] flex flex-col justify-between"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center mb-3">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <h4 className="font-black text-sm">Phân Tích Tiến Độ</h4>
                  <p className="text-xs text-slate-400 mt-1">Bảng điểm, lịch sử và phân tích điểm mạnh yếu.</p>
                </div>
                <span className="text-[11px] font-bold text-teal-400 mt-3 group-hover:underline flex items-center gap-1">
                  Xem chi tiết <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
