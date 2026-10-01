'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  ChevronLeft,
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
  BookOpen,
  GraduationCap,
  FlaskConical,
  Gem,
  Gift,
  ArrowRight,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-testing-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-testing-body' })

interface SenUiFeature {
  id: string
  title: string
  subtitle: string
  description: string
  href: string
  badge: string
  icon: any
  category: 'exam' | 'senai' | 'study' | 'tool'
  accentGradient: string
  glassBorder: string
  glowColor: string
  stats: string
}

const SEN_30_FEATURES: SenUiFeature[] = [
  {
    id: 'exams',
    title: 'Kho Đề Thi Chuẩn Hoá',
    subtitle: 'Chuẩn ma trận THPTQG, HSA & TSA',
    description: 'Ngân hàng hơn 5.000+ đề thi tuyển chọn từ các trường chuyên toàn quốc. Hỗ trợ bấm giờ tự động, chống gian lận SEB và xem giải chi tiết từng câu.',
    href: '/new-exams',
    badge: 'Khảo Thí 2026',
    icon: Rocket,
    category: 'exam',
    accentGradient: 'from-rose-500 via-pink-500 to-amber-500',
    glassBorder: 'border-rose-500/40 hover:border-rose-400',
    glowColor: 'rgba(244,63,94,0.3)',
    stats: '5.200+ đề khả dụng',
  },
  {
    id: 'setup-course',
    title: 'Soạn Đề & Khoá Học KaTeX',
    subtitle: 'Bộ công cụ sáng tạo câu hỏi chuyên nghiệp',
    description: 'Thiết kế đề thi tương tác với bàn phím công thức toán KaTeX thông minh, chèn hình ảnh kéo thả, chia thang điểm linh hoạt và xuất đề định dạng chuẩn.',
    href: '/new-setup-course',
    badge: 'Creator Studio',
    icon: Layers,
    category: 'exam',
    accentGradient: 'from-indigo-500 via-purple-500 to-pink-500',
    glassBorder: 'border-indigo-500/40 hover:border-indigo-400',
    glowColor: 'rgba(99,102,241,0.3)',
    stats: 'Soạn công thức 1-chạm',
  },
  {
    id: 'senai-studio',
    title: 'SenAI Studio Siêu Trợ Lý',
    subtitle: 'Trí tuệ nhân tạo giải đáp & định hướng học',
    description: 'Gia sư AI đồng hành 24/7 phân tích cặn kẽ từng bước giải bài, phát hiện lỗ hổng kiến thức và gợi ý các chuyên đề cần bổ sung sau mỗi bài thi.',
    href: '/new-senai-studio',
    badge: 'SenAI Plus / Ultra',
    icon: Brain,
    category: 'senai',
    accentGradient: 'from-sky-400 via-indigo-500 to-purple-600',
    glassBorder: 'border-sky-500/40 hover:border-sky-400',
    glowColor: 'rgba(14,165,233,0.3)',
    stats: 'Gia sư riêng 24/7',
  },
  {
    id: 'library',
    title: 'Thư Viện Tài Liệu VIP',
    subtitle: 'Tài liệu độc quyền & đề thi chính thức',
    description: 'Kho lưu trữ 10.000+ chuyên đề, tài liệu ôn thi độc quyền định dạng PDF chuẩn. Đặc quyền tải không giới hạn từ Thứ 6 đến Chủ Nhật cho gói Sen One.',
    href: '/legacy-library',
    badge: 'VIP Documents',
    icon: BookOpen,
    category: 'study',
    accentGradient: 'from-amber-400 via-orange-500 to-red-500',
    glassBorder: 'border-amber-500/40 hover:border-amber-400',
    glowColor: 'rgba(245,158,11,0.3)',
    stats: '10.000+ file tuyển chọn',
  },
  {
    id: 'sengraph',
    title: 'SenGraph Phổ Điểm & Dự Đoán',
    subtitle: 'Phân tích dữ liệu & định vị năng lực',
    description: 'Mô hình hóa biểu đồ năng lực theo từng môn học, dự đoán phổ điểm thi tốt nghiệp và so sánh tỉ lệ chọi vào các trường đại học hàng đầu.',
    href: '/new-sengraph',
    badge: 'Phân Tích AI',
    icon: TrendingUp,
    category: 'senai',
    accentGradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    glassBorder: 'border-emerald-500/40 hover:border-emerald-400',
    glowColor: 'rgba(16,185,129,0.3)',
    stats: 'Chính xác 96.8%',
  },
  {
    id: 'student-portal',
    title: 'Lớp Học & Bảng Xếp Hạng',
    subtitle: 'Kết nối giảng viên & cộng đồng ôn thi',
    description: 'Tham gia lớp học thông qua mã mời, nhận bài thi định kỳ từ thầy cô, theo dõi bảng vàng điểm số và thi đấu xếp hạng với bạn bè toàn quốc.',
    href: '/new-student',
    badge: 'Học Trực Tuyến',
    icon: GraduationCap,
    category: 'study',
    accentGradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    glassBorder: 'border-cyan-500/40 hover:border-cyan-400',
    glowColor: 'rgba(6,182,212,0.3)',
    stats: 'Đồng bộ thời gian thực',
  },
  {
    id: 'virtual-labs',
    title: 'Phòng Thí Nghiệm Ảo 3D',
    subtitle: 'Trực quan hoá định luật Lý - Hoá - Sinh',
    description: 'Thực hành các thí nghiệm khó, độc hại hoặc tốn kém thông qua mô phỏng tương tác 3D chân thực, giúp khắc sâu kiến thức thực tế.',
    href: '/new-labs',
    badge: 'Mô Phỏng 3D',
    icon: FlaskConical,
    category: 'study',
    accentGradient: 'from-purple-400 via-fuchsia-500 to-pink-500',
    glassBorder: 'border-purple-500/40 hover:border-purple-400',
    glowColor: 'rgba(168,85,247,0.3)',
    stats: 'Mô phỏng vật lý 60 FPS',
  },
  {
    id: 'focus-mode',
    title: 'Chế Độ Tập Trung Focus',
    subtitle: 'Pomodoro & không gian học tĩnh lặng',
    description: 'Bộ đếm thời gian Pomodoro khoa học kết hợp âm thanh tự nhiên lofi, chặn các thông báo gây xao nhãng và tích lũy điểm thưởng năng suất mỗi ngày.',
    href: '/new-focus',
    badge: 'Pomodoro',
    icon: Clock,
    category: 'tool',
    accentGradient: 'from-amber-400 via-yellow-500 to-lime-500',
    glassBorder: 'border-yellow-500/40 hover:border-yellow-400',
    glowColor: 'rgba(234,179,8,0.3)',
    stats: 'Tăng 2.5x năng suất',
  },
  {
    id: 'exclusive-store',
    title: 'Cửa Hàng Độc Quyền Flash Sale',
    subtitle: 'Ưu đãi nâng cấp SenAI & vật phẩm VIP',
    description: 'Cửa hàng dành riêng cho hội viên VIP & SenCash: Mua gói trợ lý SenAI với mức giảm giá 30%, đổi vật phẩm tăng EXP và huy hiệu cá nhân hoá.',
    href: '/new-exclusive-store',
    badge: 'Hot Deal',
    icon: Gem,
    category: 'tool',
    accentGradient: 'from-pink-500 via-rose-500 to-purple-600',
    glassBorder: 'border-pink-500/40 hover:border-pink-400',
    glowColor: 'rgba(236,72,153,0.3)',
    stats: 'Flash Sale giảm 30%',
  },
  {
    id: 'gift-codes',
    title: 'Đổi Mã Quà Tặng Gift Code',
    subtitle: 'Nhận thưởng SenCash & ngày sử dụng VIP',
    description: 'Nhập mã kích hoạt 16 ký tự để nhận quà tặng sự kiện, điểm danh cộng thưởng và chia sẻ mã ưu đãi với cộng đồng học sinh.',
    href: '/new-codes',
    badge: 'Nhận Quà',
    icon: Gift,
    category: 'tool',
    accentGradient: 'from-orange-400 via-amber-500 to-yellow-500',
    glassBorder: 'border-orange-500/40 hover:border-orange-400',
    glowColor: 'rgba(249,115,22,0.3)',
    stats: 'Nhận quà 1-chạm',
  },
]

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

  // 3D Carousel Navigation
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'exam' | 'senai' | 'study' | 'tool'>('all')

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
          setHasVipPremiumPlus(
            Boolean(
              profile.is_vip_premium_plus ||
              profile.plan_tier === 'premium_plus' ||
              profile.plan_tier === 'sen_one' ||
              profile.role === 'admin' ||
              profile.role === 'collab'
            )
          )
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

  const filteredFeatures = useMemo(() => {
    if (selectedCategory === 'all') return SEN_30_FEATURES
    return SEN_30_FEATURES.filter((f) => f.category === selectedCategory)
  }, [selectedCategory])

  // Reset index when category changes
  useEffect(() => {
    setCarouselIndex(0)
  }, [selectedCategory])

  const handleNext = useCallback(() => {
    setCarouselIndex((prev) => (prev + 1) % filteredFeatures.length)
  }, [filteredFeatures.length])

  const handlePrev = useCallback(() => {
    setCarouselIndex((prev) => (prev - 1 + filteredFeatures.length) % filteredFeatures.length)
  }, [filteredFeatures.length])

  // Lắng nghe phím mũi tên bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev])

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070B14] text-slate-200">
        <Sparkles className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-black tracking-widest uppercase text-amber-400/80">
          Đang khởi tạo Engine Sen UI 3.0 & Vòng Xoay 3D...
        </p>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#070B14] text-slate-100 font-sans selection:bg-amber-500 selection:text-black`}
    >
      {/* BACKGROUND GRADIENTS HIỆN ĐẠI SEN 3.0 VỚI HIỆU ỨNG KÍNH ĐA TẦNG */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-[650px] w-[650px] rounded-full bg-gradient-to-bl from-indigo-600/20 via-purple-600/15 to-transparent blur-[160px]" />
        <div className="absolute bottom-10 left-10 h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent blur-[140px]" />
      </div>

      {/* TOPBAR ĐIỀU HƯỚNG HIỆU ỨNG KÍNH FROSTED GLASS */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B14]/75 backdrop-blur-3xl px-4 sm:px-8 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            prefetch={false}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/5 hover:bg-white/15 backdrop-blur-xl shadow-lg transition active:scale-95"
            title="Quay lại Dashboard chính"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              {/* TAG PREMIUM+ VỚI DẤU + ÁNH KIM VÀNG PHÁT SÁNG NỔI BẬT */}
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-400/25 via-yellow-300/35 to-amber-500/25 dark:from-amber-500/20 dark:via-yellow-400/20 dark:to-amber-500/20 border border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.35)] text-amber-950 dark:text-amber-300 backdrop-blur-2xl">
                <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-500/40 animate-pulse" />
                <span className="bg-gradient-to-r from-amber-950 via-amber-800 to-yellow-900 dark:from-amber-200 dark:via-yellow-100 dark:to-amber-300 bg-clip-text text-transparent font-black tracking-widest flex items-center">
                  PREMIUM<span className="text-amber-500 dark:text-yellow-300 font-black ml-0.5 text-sm drop-shadow-[0_0_10px_rgba(245,158,11,1)]">+</span>
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs">
                <Zap className="h-3 w-3 text-indigo-400" /> Sen UI 3.0 Next-Gen
              </span>

              {isAdminOrCollab && (
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Admin Exclusive
                </span>
              )}
            </div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-300 mt-0.5 line-clamp-1">
              Bản Thử Nghiệm Giao Diện Sen 3.0 • Vòng Xoay 3D & Kính Mờ Đa Tầng
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* HUD Performance & Sen Heart 1.0.2 */}
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-[11px] font-mono text-slate-300 shadow-inner">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> 120 FPS
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300">Sen Heart 1.0.2</span>
            <span className="text-slate-600">|</span>
            <span className="text-teal-300">Latency: 5ms</span>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
          </button>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* THÔNG BÁO TỰ ĐỘNG GIA HẠN NẾU CÓ */}
        {renewStatusMsg && (
          <div className="p-4 rounded-3xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-2xl text-amber-200 text-xs font-bold flex items-center gap-2.5 shadow-lg animate-in slide-in-from-top-2">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{renewStatusMsg}</span>
          </div>
        )}

        {/* NẾU CHƯA CÓ QUYỀN TRUY CẬP: HIỂN THỊ CỔNG GIỚI THIỆU ROADMAP */}
        {!isAuthorized ? (
          <div className="rounded-[36px] border border-amber-500/30 bg-gradient-to-b from-amber-500/15 via-black/40 to-black/70 p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6 shadow-2xl backdrop-blur-3xl">
            <div className="h-16 w-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <Lock className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2">
                Không Gian Ẩn Thử Nghiệm
              </span>
              <h2 className="text-2xl sm:text-4xl font-black" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                Khu Vực Dành Riêng Cho Admin & Gói VIP Premium+
              </h2>
              <p className="mt-3 text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                SenExam 3.0 với bố cục tái tổ chức và Vòng xoay tính năng 3D đang trong giai đoạn Alpha thử nghiệm nội bộ. Tính năng này sẽ chính thức khả dụng trước tiên cho người dùng sở hữu <strong>Gói VIP Premium+</strong> ra mắt vào cuối Năm 2026.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/new-vip"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition"
              >
                <Crown className="h-4 w-4" /> Tham gia Danh sách chờ VIP Premium+
              </Link>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* GIAO DIỆN BẢNG ĐIỀU KHIỂN SEN UI 3.0 TOÀN NĂNG                      */
          /* ================================================================= */
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* 1. HERO BANNER SEN 3.0: HIỆU ỨNG KÍNH ĐA TẦNG & GREETING */}
            <div className="relative overflow-hidden rounded-[36px] border border-white/20 dark:border-white/10 bg-white/[0.08] dark:bg-slate-900/[0.6] p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-3xl">
              {/* Ánh sáng phản chiếu kính specular gradient */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full pointer-events-none opacity-25 bg-[radial-gradient(circle,rgba(245,158,11,0.5)_0%,transparent_70%)]" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-md flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 fill-black" /> Sen UI 3.0 Preview
                    </span>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-bold border border-white/20 bg-white/10 text-white backdrop-blur-xl">
                      Kiến Trúc Điều Phối Sen Heart 1.0.2
                    </span>
                  </div>

                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                    Bứt Phá Không Gian Khảo Thí ⚡
                  </h2>
                  <p className="mt-2.5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed" style={{ fontFamily: 'var(--font-testing-body)' }}>
                    Tổ chức lại toàn bộ tính năng theo mô hình Vòng Xoay Thẻ 3D tương tác. Tối ưu hoá từng micro-animation, phủ kính mờ sang trọng và giữ vững hiệu năng 120 FPS.
                  </p>
                </div>

                {/* 4 Chỉ số nhanh dạng Glass Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-3.5 text-center shadow-inner">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-400">
                      <Flame className="h-3.5 w-3.5 text-amber-500" /> Chuỗi học
                    </div>
                    <p className="text-lg font-black mt-0.5 text-white" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                      {userProfile?.streak_days || 1} ngày
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-3.5 text-center shadow-inner">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-teal-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> Điểm Focus
                    </div>
                    <p className="text-lg font-black mt-0.5 text-white" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                      98 pts
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-3.5 text-center shadow-inner">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-pink-400">
                      <Coins className="h-3.5 w-3.5 text-pink-400" /> SenCash
                    </div>
                    <p className="text-lg font-black mt-0.5 text-white" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                      {userProfile?.sencash_balance || 0} SC
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-2xl p-3.5 text-center shadow-inner">
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-300">
                      <Crown className="h-3.5 w-3.5 text-amber-400" /> Hạng Gói
                    </div>
                    <p className="text-base font-black mt-0.5 text-amber-300 truncate" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                      {userProfile?.plan_tier === 'sen_one'
                        ? 'Sen One'
                        : userProfile?.plan_tier === 'premium_plus' || hasVipPremiumPlus
                        ? 'Premium+'
                        : userProfile?.plan_tier === 'premium'
                        ? 'Premium'
                        : 'Sen VIP'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. VÒNG XOAY TÍNH NĂNG 3D (3D INTERACTIVE ROTATING CAROUSEL DECK)           */}
            {/* ========================================================================= */}
            <div className="rounded-[40px] border border-white/15 dark:border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-6 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-3xl space-y-6 relative overflow-hidden">
              
              {/* Header Vòng Xoay Tính Năng */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      Trung Tâm Điều Phối
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      Thẻ ({carouselIndex + 1}/{filteredFeatures.length})
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-4xl font-black mt-1" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                    Vòng Xoay Tính Năng Sen 3.0 🔄
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Nhấn nút mũi tên <strong>&lt;</strong> hoặc <strong>&gt;</strong> (hoặc phím mũi tên bàn phím) để xoay chuyển giữa các tính năng.
                  </p>
                </div>

                {/* Bộ lọc chuyên mục */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl overflow-x-auto">
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'exam', label: 'Khảo thí' },
                    { key: 'senai', label: 'SenAI' },
                    { key: 'study', label: 'Học tập' },
                    { key: 'tool', label: 'Tiện ích' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedCategory(tab.key as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        selectedCategory === tab.key
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* VÙNG 3D CAROUSEL DECK */}
              <div className="relative min-h-[360px] sm:min-h-[400px] flex items-center justify-center py-6 select-none" style={{ perspective: '1200px' }}>
                
                {/* Nút Xoay Trái (<) */}
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 sm:left-4 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-white/25 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:scale-110 active:scale-95 group cursor-pointer"
                  title="Tính năng trước (Phím ←)"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7 group-hover:-translate-x-0.5 transition-transform" />
                </button>

                {/* Nút Xoay Phải (>) */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 sm:right-4 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-white/25 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:scale-110 active:scale-95 group cursor-pointer"
                  title="Tính năng tiếp theo (Phím →)"
                >
                  <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Danh sách thẻ được render xoay 3D */}
                <div className="relative w-full max-w-xl h-[330px] sm:h-[360px] flex items-center justify-center">
                  {filteredFeatures.map((feature, idx) => {
                    const len = filteredFeatures.length
                    let offset = (idx - carouselIndex + len) % len
                    if (offset > len / 2) offset -= len

                    const isCenter = offset === 0
                    const isVisible = Math.abs(offset) <= 2

                    if (!isVisible) return null

                    // Tọa độ 3D động GPU
                    const translateX = offset * (typeof window !== 'undefined' && window.innerWidth < 640 ? 110 : 210)
                    const translateZ = -Math.abs(offset) * 120
                    const rotateY = offset * -25
                    const scale = isCenter ? 1.05 : 0.88 - Math.abs(offset) * 0.08
                    const opacity = isCenter ? 1 : Math.max(0.2, 0.7 - Math.abs(offset) * 0.3)
                    const zIndex = 30 - Math.abs(offset) * 10

                    const IconComp = feature.icon

                    return (
                      <div
                        key={feature.id}
                        onClick={() => {
                          if (!isCenter) {
                            setCarouselIndex(idx)
                          }
                        }}
                        style={{
                          transform: `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex,
                          transition: 'all 450ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                        }}
                        className={`absolute w-[290px] sm:w-[380px] h-[310px] sm:h-[340px] rounded-[32px] p-6 flex flex-col justify-between cursor-pointer backdrop-blur-3xl shadow-2xl ${
                          isCenter
                            ? 'border-2 border-amber-400/60 bg-gradient-to-b from-white/[0.12] via-black/60 to-black/80 shadow-[0_20px_50px_rgba(245,158,11,0.25)]'
                            : 'border border-white/15 bg-black/50 hover:bg-black/70'
                        }`}
                      >
                        {/* Viền sáng trên đỉnh thẻ */}
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-t-[32px]" />

                        {/* Top phần thẻ: Icon & Badge */}
                        <div>
                          <div className="flex items-center justify-between">
                            <div
                              className={`h-14 w-14 rounded-2xl bg-gradient-to-tr ${feature.accentGradient} p-0.5 shadow-lg flex items-center justify-center text-white`}
                            >
                              <div className="h-full w-full rounded-[14px] bg-black/30 flex items-center justify-center backdrop-blur-sm">
                                <IconComp className="h-7 w-7 text-white" />
                              </div>
                            </div>

                            <div className="text-right space-y-1">
                              <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 border border-white/15">
                                {feature.badge}
                              </span>
                              <p className="text-[10px] font-mono text-slate-400 block">{feature.stats}</p>
                            </div>
                          </div>

                          {/* Tiêu đề & Mô tả */}
                          <div className="mt-4">
                            <h4 className="text-lg sm:text-xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                              {feature.title}
                            </h4>
                            <p className="text-[11px] font-bold text-amber-400/90 mt-0.5">{feature.subtitle}</p>
                            <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed" style={{ fontFamily: 'var(--font-testing-body)' }}>
                              {feature.description}
                            </p>
                          </div>
                        </div>

                        {/* Nút Hành Động Ở Đáy Thẻ */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            {isCenter ? 'Bấm để mở tính năng' : 'Bấm để xoay vào giữa'}
                          </span>

                          {isCenter ? (
                            <Link
                              href={feature.href}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r ${feature.accentGradient} text-white shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1.5`}
                            >
                              Mở Ngay <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span className="text-xs font-bold text-amber-400">Chọn →</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Indicator Dots Ở Đáy Vòng Xoay */}
              <div className="flex items-center justify-center gap-2 pt-2">
                {filteredFeatures.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselIndex(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === carouselIndex
                        ? 'w-8 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    title={`Chuyển tới thẻ ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. THIẾT LẬP TỰ ĐỘNG GIA HẠN BẰNG SC (VIP & SEN AI)                          */}
            {/* ========================================================================= */}
            <div className="rounded-[36px] border border-white/15 dark:border-white/10 bg-white/[0.05] p-6 sm:p-8 backdrop-blur-3xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25 shadow-sm">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-testing-heading)' }}>
                      Tính Năng Tự Động Gia Hạn Bằng SenCash (SC)
                    </h3>
                    <p className="text-xs text-slate-300">
                      Tự động trích trừ SC từ ví khi đến hạn. Nếu số dư SC không đủ, hệ thống sẽ tự động hủy gói để tránh gián đoạn trải nghiệm.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold backdrop-blur-xl">
                  <Coins className="h-4 w-4" /> Ví: {userProfile?.sencash_balance || 0} SC
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Switch Tự động gia hạn VIP */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex items-center justify-between gap-4 backdrop-blur-xl">
                  <div>
                    <div className="flex items-center gap-2">
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
                    className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      autoRenewVip
                        ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-md'
                        : 'border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {autoRenewVip ? 'Đang Bật' : 'Bật Ngay'}
                  </button>
                </div>

                {/* Switch Tự động gia hạn Sen AI */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex items-center justify-between gap-4 backdrop-blur-xl">
                  <div>
                    <div className="flex items-center gap-2">
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
                    className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      autoRenewSenAi
                        ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-md'
                        : 'border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {autoRenewSenAi ? 'Đang Bật' : 'Bật Ngay'}
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. ROADMAP Q4 - 2026: GÓI ĐẶC QUYỀN VIP PREMIUM+ (SEN 3.0)                 */}
            {/* ========================================================================= */}
            <div className="rounded-[36px] border border-amber-400/30 bg-gradient-to-b from-amber-500/10 via-black/40 to-transparent p-6 sm:p-8 space-y-6 backdrop-blur-3xl">
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
                  <span className="px-3.5 py-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 text-amber-300 text-xs font-black backdrop-blur-xl">
                    Dự kiến mở bán: Tháng 12/2026
                  </span>
                </div>
              </div>

              {/* 3 CỘT GIAI ĐOẠN ROADMAP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                
                {/* Giai đoạn 1: Tháng 10/2026 */}
                <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3 backdrop-blur-2xl">
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
                <div className="relative rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-3 backdrop-blur-2xl">
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
                <div className="relative rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-500/5 p-5 space-y-3 shadow-lg shadow-amber-500/10 backdrop-blur-2xl">
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

          </div>
        )}
      </div>
    </main>
  )
}
