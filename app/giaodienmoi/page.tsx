'use client'

import React, { useState, useEffect, useMemo, ComponentType } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Home,
  Search,
  Settings,
  User,
  Sparkles,
  Rocket,
  BookOpen,
  Crown,
  ShieldCheck,
  Box,
  Video,
  MessageSquare,
  Calendar,
  Gauge,
  TrendingUp,
  GraduationCap,
  FlaskConical,
  School,
  Sun,
  Moon,
  Zap,
  Check,
  X,
  ChevronRight,
  CreditCard,
  Brain,
  Flame,
  MapPin,
  Lock,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  RefreshCw,
  LogOut,
  HelpCircle,
  FolderKanban,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'

// Định nghĩa phân hệ tính năng
type FeatureCategory = 'all' | 'study' | 'math_exam' | 'senai' | 'community'

interface QuickAction {
  key: string
  title: string
  description: string
  href: string
  tone: string
  badge?: string
  icon: ComponentType<{ className?: string }>
  category: 'study' | 'math_exam' | 'senai' | 'community'
  keywords?: string[]
}

const CATEGORIES: { key: FeatureCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'Tất cả tính năng', icon: '⚡' },
  { key: 'study', label: 'Học tập & Luyện thi', icon: '📚' },
  { key: 'math_exam', label: 'Toán học & Khảo thí', icon: '📐' },
  { key: 'senai', label: 'SenAI & Quota', icon: '🤖' },
  { key: 'community', label: 'Cộng đồng & Tiện ích', icon: '🌐' },
]

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'new-sen-ground',
    title: 'Tạo đề, Khảo thí và Lịch sử làm bài',
    description: 'Hợp nhất toàn diện: Soạn đề KaTeX & SEB, khảo thí kho đề tập trung và tra cứu toàn bộ lịch sử thi cử.',
    href: '/new-sen-ground',
    tone: 'from-sky-500 via-cyan-500 to-teal-500',
    badge: 'Mới 2.0',
    icon: Rocket,
    category: 'study',
    keywords: ['soan de', 'khao thi', 'katex', 'seb', 'lich su', 'thi thu'],
  },
  {
    key: 'sen-read',
    title: 'Phòng Đọc SenRead',
    description: 'Không gian đọc sách & bản thảo Canvas siêu nhẹ 60FPS, AI chia chương, dịch thuật song ngữ và giọng đọc.',
    href: '/read',
    tone: 'from-emerald-500 via-teal-500 to-cyan-500',
    badge: 'Canvas',
    icon: BookOpen,
    category: 'study',
    keywords: ['sach', 'doc sach', 'pdf', 'dich thuat', 'giao trinh'],
  },
  {
    key: 'senai',
    title: 'SenAI Studio',
    description: 'Xưởng AI cá nhân hoá để tạo đề, chấm bài và giải thích chi tiết đáp án câu hỏi.',
    href: '/new-senai-studio',
    tone: 'from-sky-500 via-indigo-500 to-cyan-400',
    badge: 'AI 2.0',
    icon: Sparkles,
    category: 'senai',
    keywords: ['senai', 'studio', 'giai de', 'hoi bai', 'tro ly'],
  },
  {
    key: 'sen-store',
    title: 'Cửa Hàng Sen',
    description: 'Trung tâm mua sắm: Nâng cấp Hội viên VIP, Gói SenAI & Quota, Ví SenCash và Gift Code.',
    href: '/new-pay',
    tone: 'from-cyan-600 via-sky-600 to-blue-600',
    badge: 'Store 5-in-1',
    icon: Crown,
    category: 'senai',
    keywords: ['nap tien', 'vip', 'premium', 'sen one', 'quota', 'sencash'],
  },
  {
    key: 'seb-security',
    title: 'Sen Exam Canvas',
    description: 'Môi trường khảo thí trực tuyến bảo mật cao chống gian lận 100% qua Sen Exam Canvas.',
    href: 'https://seb.thicu.tailieufepn.senexam.me',
    tone: 'from-sky-600 via-blue-600 to-indigo-600',
    badge: 'Canvas',
    icon: ShieldCheck,
    category: 'math_exam',
    keywords: ['canvas', 'bao mat', 'seb', 'chong gian lan'],
  },
  {
    key: 'sengraph',
    title: 'SenGraph',
    description: 'Vẽ đồ thị hàm số 2D và mô hình không gian 3D tương tác cao cấp, tích hợp Sen AI Toán học.',
    href: 'https://sengraph.senexam.me',
    tone: 'from-cyan-500 via-sky-500 to-indigo-600',
    badge: '2D & 3D',
    icon: Box,
    category: 'math_exam',
    keywords: ['do thi', 'hinh hoc', '3d', '2d', 'ham so', 'toan hoc'],
  },
  {
    key: 'senvideo',
    title: 'Sen Video',
    description: 'Video bài giảng ngắn gọn, sinh động giúp nắm bắt trọng tâm bài học nhanh chóng.',
    href: '/new-video',
    tone: 'from-sky-400 via-cyan-500 to-blue-500',
    badge: 'Video',
    icon: Video,
    category: 'study',
    keywords: ['video', 'bai giang', 'clip', 'on thi'],
  },
  {
    key: 'media',
    title: 'Sen Media 2.0',
    description: 'Cộng đồng sĩ tử, diễn đàn hỏi đáp bài tập và phòng chat thảo luận học thuật toàn quốc.',
    href: '/new-media',
    tone: 'from-indigo-500 via-sky-500 to-cyan-400',
    badge: 'Cộng đồng',
    icon: MessageSquare,
    category: 'community',
    keywords: ['dien dan', 'chat', 'hoi dap', 'cong dong'],
  },
  {
    key: 'schedule',
    title: 'Lịch Học & Lịch Thi',
    description: 'Quản lý thời khóa biểu, lịch thi thử, cài đặt nhắc nhở và lặp lại thông minh.',
    href: '/new-schedule',
    tone: 'from-cyan-500 via-sky-500 to-blue-500',
    badge: 'Lịch',
    icon: Calendar,
    category: 'community',
    keywords: ['lich hoc', 'lich thi', 'thoi khoa bieu', 'nhac nho'],
  },
  {
    key: 'focus',
    title: 'Chế độ Focus',
    description: 'Không gian học tập yên tĩnh, đồng hồ đếm giờ Pomodoro tăng hiệu suất tối đa.',
    href: '/new-focus',
    tone: 'from-amber-500 via-sky-500 to-cyan-500',
    icon: Gauge,
    category: 'study',
    keywords: ['pomodoro', 'tap trung', 'dong ho', 'focus'],
  },
  {
    key: 'beta',
    title: 'Kênh Thử Nghiệm Beta',
    description: 'Trải nghiệm sớm các tính năng tương lai 2027, xem roadmap cập nhật và quản lý tham gia.',
    href: '/new-beta',
    tone: 'from-sky-500 via-indigo-500 to-cyan-500',
    badge: 'Beta 2027',
    icon: Sparkles,
    category: 'community',
    keywords: ['beta', 'thu nghiem', 'roadmap', 'tinh nang moi'],
  },
  {
    key: 'tinhdiem',
    title: 'Tính điểm thi',
    description: 'Công cụ tính điểm tốt nghiệp THPT, TSA và HSA chính xác theo barem chuẩn.',
    href: '/new-mark-calculate',
    tone: 'from-teal-500 via-cyan-500 to-sky-500',
    icon: TrendingUp,
    category: 'math_exam',
    keywords: ['tinh diem', 'hsa', 'tsa', 'thptqg', 'diem chuan'],
  },
  {
    key: 'student',
    title: 'Lớp Học Của Tôi',
    description: 'Tham gia lớp học bằng mã mời, xem các kỳ thi được giao và bảng điểm lớp.',
    href: '/new-student',
    tone: 'from-cyan-500 via-sky-500 to-indigo-500',
    badge: 'Lớp học',
    icon: GraduationCap,
    category: 'study',
    keywords: ['lop hoc', 'sinh vien', 'hoc sinh', 'bai tap', 'bang diem'],
  },
  {
    key: 'phongthinghiem',
    title: 'Phòng thí nghiệm ảo',
    description: 'Trực quan hoá các định luật Lý - Hoá - Sinh qua mô phỏng 3D tương tác sống động.',
    href: '/new-labs',
    tone: 'from-sky-500 via-cyan-500 to-teal-500',
    icon: FlaskConical,
    category: 'math_exam',
    keywords: ['labs', 'thi nghiem', 'mo phong', 'vat ly', 'hoa hoc', 'sinh hoc'],
  },
  {
    key: 'breathe-u',
    title: 'BREATHE U - Sức Khỏe Học Đường',
    description: 'Không gian nâng cao sức khỏe tinh thần, môi trường không khói thuốc và lối sống xanh.',
    href: '/breathe-u',
    tone: 'from-emerald-500 via-teal-500 to-sky-500',
    badge: 'Campus Green',
    icon: ShieldCheck,
    category: 'community',
    keywords: ['breathe u', 'suc khoe', 'song xanh', 'khong khoi thuoc'],
  },
  {
    key: 'baucu',
    title: 'Hệ Thống Bầu Cử FEPN',
    description: 'Bỏ phiếu ban cán sự, ban chấp hành lâm thời chi đoàn K71P-ME2 trực tuyến an toàn & minh bạch.',
    href: '/baucu',
    tone: 'from-sky-600 via-blue-600 to-indigo-700',
    badge: 'K71P-ME2',
    icon: FolderKanban,
    category: 'community',
    keywords: ['bau cu', 'bo phieu', 'fepn', 'k71p-me2', 'can su lop'],
  },
  {
    key: 'nopquylop',
    title: 'Cổng Quỹ Lớp ME2',
    description: 'Cổng tài chính sinh viên, nộp quỹ lớp minh bạch và theo dõi thu chi trực quan.',
    href: '/nopquylop',
    tone: 'from-cyan-600 via-teal-600 to-sky-600',
    badge: 'Quỹ lớp',
    icon: CreditCard,
    category: 'community',
    keywords: ['nop quy lop', 'tai chinh', 'thu chi', 'me2'],
  },
]

export default function GiaoDienMoiPage() {
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isLiquidGlass, setIsLiquidGlass] = useState(true)
  const [isEcoMode, setIsEcoMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('all')

  // Modals & Popups
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // User Profile Data
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<{
    full_name?: string
    role?: string
    school?: string
    province?: string
    sencash_balance?: number
    plan_tier?: string
    is_vip?: boolean
    streak_days?: number
    senai_tier?: string
  } | null>(null)

  // Khởi tạo trạng thái và theme từ localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedDark = localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark')
    setIsDark(storedDark)

    const storedLiquid = localStorage.getItem('sen_liquid_glass')
    if (storedLiquid !== null) {
      setIsLiquidGlass(storedLiquid === '1')
    }

    const storedEco = localStorage.getItem('sen_eco_mode') === '1'
    setIsEcoMode(storedEco)

    // Lắng nghe phím tắt Ctrl+K hoặc Cmd+K mở tìm kiếm
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchModalOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsSearchModalOpen(false)
        setIsProfileModalOpen(false)
        setIsSettingsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Tải dữ liệu người dùng
    const fetchUserData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user) {
          setUser(authData.user)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role, school, province, sencash_balance, plan_tier, vip_expires_at, streak_days, senai_tier')
            .eq('id', authData.user.id)
            .single()

          if (profile) {
            const isVip = Boolean(
              profile.plan_tier && profile.plan_tier !== 'free' ||
              (profile.vip_expires_at && new Date(profile.vip_expires_at) > new Date())
            )
            setUserProfile({
              full_name: profile.full_name || 'Học viên SenExam',
              role: profile.role || 'student',
              school: profile.school || 'Trường THPT',
              province: profile.province || 'Hà Nội',
              sencash_balance: profile.sencash_balance || 0,
              plan_tier: profile.plan_tier || 'free',
              is_vip: isVip,
              streak_days: profile.streak_days || 1,
              senai_tier: profile.senai_tier || 'free',
            })
          }
        }
      } catch (err) {
        console.warn('Lỗi lấy profile:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Toggle kính lỏng khúc xạ iOS 27
  const toggleLiquidGlass = () => {
    const nextVal = !isLiquidGlass
    setIsLiquidGlass(nextVal)
    localStorage.setItem('sen_liquid_glass', nextVal ? '1' : '0')
  }

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Lọc tính năng theo category
  const filteredActions = useMemo(() => {
    if (activeCategory === 'all') return QUICK_ACTIONS
    return QUICK_ACTIONS.filter((item) => item.category === activeCategory)
  }, [activeCategory])

  // Lọc kết quả tìm kiếm modal
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return QUICK_ACTIONS.slice(0, 8)
    return QUICK_ACTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.includes(q))
    )
  }, [searchQuery])

  // Render tên thương hiệu SenExam theo gói (như Dashboard hiện tại)
  const renderBrandTitle = () => {
    const tier = userProfile?.plan_tier
    const isVip = userProfile?.is_vip

    if (isVip && tier === 'sen_one') {
      return (
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-400/25 via-pink-400/25 to-sky-500/25 dark:from-amber-500/20 dark:via-pink-500/20 dark:to-sky-500/20 border border-amber-500/40 shadow-[0_2px_14px_rgba(245,158,11,0.25)] text-amber-950 dark:text-amber-200">
          <span className="bg-gradient-to-r from-amber-700 via-rose-600 to-sky-600 dark:from-amber-300 dark:via-rose-300 dark:to-sky-300 bg-clip-text text-transparent font-black tracking-widest">
            SEN ONE
          </span>
        </span>
      )
    }

    if (isVip && tier === 'premium_plus') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-400/30 via-yellow-300/40 to-amber-500/30 dark:from-amber-500/25 dark:via-yellow-400/25 dark:to-amber-500/25 border border-amber-500/50 shadow-[0_2px_14px_rgba(217,119,6,0.3)] text-amber-950 dark:text-amber-300">
          <Crown className="h-4 w-4 text-amber-700 dark:text-amber-300 fill-amber-500/40 animate-pulse" />
          <span className="bg-gradient-to-r from-amber-950 via-amber-800 to-yellow-900 dark:from-amber-200 dark:via-yellow-100 dark:to-amber-300 bg-clip-text text-transparent font-black flex items-center">
            PREMIUM<span className="text-amber-600 dark:text-yellow-300 font-black ml-0.5 text-sm drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]">+</span>
          </span>
        </span>
      )
    }

    if (isVip && tier === 'premium') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-400/25 via-amber-300/35 to-yellow-400/25 dark:from-amber-500/20 dark:via-yellow-400/20 dark:to-amber-500/20 border border-amber-600/40 dark:border-amber-400/50 shadow-[0_2px_12px_rgba(217,119,6,0.2)] text-amber-950 dark:text-amber-400">
          <Crown className="h-4 w-4 text-amber-700 dark:text-amber-400 fill-amber-500/30 animate-pulse" />
          <span className="bg-gradient-to-r from-amber-950 via-amber-800 to-yellow-900 dark:from-amber-300 dark:via-yellow-200 dark:to-amber-400 bg-clip-text text-transparent font-black">
            PREMIUM
          </span>
        </span>
      )
    }

    if (isVip) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 text-amber-900 dark:text-amber-300">
          <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-black">SEN VIP</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 shadow-xs">
        <Zap className="h-3.5 w-3.5 text-sky-500" /> SenExam
      </span>
    )
  }

  if (loading) {
    return <ModernLoading title="SenExam 2027" subtitle="Đang khởi tạo giao diện kính lỏng khúc xạ..." />
  }

  // Base card class tuỳ biến theo chế độ kính lỏng
  const glassCardClass = isLiquidGlass
    ? 'glass-refract-card glass-specular-edge rounded-3xl transition-all duration-300'
    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl transition-all duration-300'

  const glassTopBarClass = isLiquidGlass
    ? 'glass-floating-bar rounded-2xl'
    : 'bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl'

  return (
    <div className={`min-h-screen text-slate-900 dark:text-slate-100 transition-colors ${isDark ? 'dark bg-[#080C14]' : 'bg-[#F4F9FD]'}`}>
      {/* Background orbs cho hiệu ứng khúc xạ kính lỏng iOS 27 */}
      {isLiquidGlass && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-sky-400/20 via-cyan-400/15 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-400/15 via-blue-500/15 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-gradient-to-tr from-teal-400/15 via-sky-500/15 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. HEADER: LOGO CÙNG TÊN SENEXAM Ở GIỮA TRÊN ĐẦU               */}
      {/* ============================================================== */}
      <header className="relative z-20 pt-5 pb-3 px-4">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-2">
          {/* Logo SenExam & Tên gói thành viên tương ứng */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-10 w-10">
              <img
                src="/logo.png"
                alt="SenExam Logo"
                className="h-10 w-10 object-contain drop-shadow-md select-none transition-transform hover:scale-105"
              />
              {isLiquidGlass && (
                <div className="absolute inset-0 rounded-full ring-2 ring-sky-400/30 animate-pulse pointer-events-none" />
              )}
            </div>
            {renderBrandTitle()}
          </div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center tracking-wide">
            Hệ thống Khảo thí & Luyện thi Thông minh • {isLiquidGlass ? 'Chế độ Kính lỏng iOS 27' : 'Chế độ Gọn gàng Clean'}
          </p>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. TOP BAR: BÊN TRÁI [HOME SQUIRCLE + SEN GROUND/CATEGORIES/SENAI] */}
      {/*             BÊN PHẢI [KÍNH LÚP + PROFILE TRÒN + CÀI ĐẶT SQUIRCLE]  */}
      {/* ============================================================== */}
      <nav className="sticky top-3 z-30 px-4 max-w-6xl mx-auto mb-6">
        <div className={`px-3 py-2.5 flex items-center justify-between gap-3 ${glassTopBarClass}`}>
          {/* --- BÊN TRÁI TOP BAR --- */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Home ở bên trái cùng nhất: Được bao bởi hình vuông bo góc (Squircle) */}
            <Link
              href="/new-dashboard"
              title="Về Trang chủ (Home)"
              className="relative flex items-center justify-center h-10 w-10 rounded-2xl border border-sky-200/50 dark:border-sky-800/50 bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-300 transition-all duration-200 hover:scale-105 active:scale-95 shadow-xs shrink-0"
            >
              <Home className="h-5 w-5" />
            </Link>

            {/* Phân cách nhẹ */}
            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700/60 hidden sm:block" />

            {/* Các chữ: Sen Ground, Sen Categories, SenAI được sắp xếp ngăn nắp */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/new-sen-ground"
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10 dark:hover:bg-sky-500/15 transition flex items-center gap-1.5"
              >
                <Rocket className="h-4 w-4 text-sky-500" />
                <span>Sen Ground</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('sen-categories-section')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 transition flex items-center gap-1.5"
              >
                <Layers className="h-4 w-4 text-cyan-500" />
                <span>Sen Categories</span>
              </button>

              <Link
                href="/new-senai-studio"
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15 transition flex items-center gap-1.5"
              >
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span>SenAI</span>
              </Link>
            </div>
          </div>

          {/* --- BÊN PHẢI TOP BAR --- */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Nút Kính lúp (Search): Cạnh nút profile, bấm hiện thanh tìm kiếm */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              title="Tìm kiếm tính năng (Ctrl + K)"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
            >
              <Search className="h-4 w-4 text-sky-500" />
              <span className="hidden md:inline text-slate-400">Tìm kiếm...</span>
              <kbd className="hidden lg:inline text-[10px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* Nút Profile: Được bo tròn (Avatar circle) cạnh nút Cài đặt */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="Hồ sơ cá nhân & Bảo mật"
              className="relative flex items-center justify-center h-10 w-10 rounded-full border-2 border-sky-400/60 dark:border-sky-500/60 bg-gradient-to-tr from-sky-500 via-cyan-500 to-blue-600 text-white shadow-xs transition hover:scale-105 active:scale-95 shrink-0"
            >
              <User className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </button>

            {/* Nút Cài đặt ở bên phải cùng nhất: Được bọc trong hình vuông bo góc (Squircle) */}
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              title="Cài đặt hệ thống & Tùy biến Kính lỏng khúc xạ"
              className="flex items-center justify-center h-10 w-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition hover:scale-105 active:scale-95 shadow-xs shrink-0"
            >
              <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 3. THÂN CHÍNH: CÁC Ô LƯỚI TÍNH NĂNG (GRID CARDS)               */}
      {/*    ĐÃ ĐƯA CÁC CÀI ĐẶT BÊN PHẢI CŨ VÀO TRONG PROFILE & SETTINGS  */}
      {/* ============================================================== */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 pb-20 space-y-8">
        {/* Banner tóm tắt số liệu & Chào mừng ngắn gọn đồng bộ màu logo SenExam */}
        <section className={`p-5 sm:p-6 ${glassCardClass} border-sky-100 dark:border-sky-950/40`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                  Thế hệ mới 2027
                </span>
                <span className="text-xs text-slate-400 font-medium">Đồng nhất nhận diện thương hiệu</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Chào mừng bạn trở lại, {userProfile?.full_name || 'Học viên SenExam'}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Toàn bộ tính năng khảo thí, luyện thi và xưởng AI đều sẵn sàng trong tầm tay bạn.
              </p>
            </div>

            {/* Các thẻ chỉ số nhanh: Streak, SenCash, SenAI */}
            <div className="grid grid-cols-3 gap-2.5 w-full md:w-auto">
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 text-center min-w-[90px]">
                <Flame className="h-5 w-5 text-amber-500 mb-1" />
                <span className="text-sm font-black text-slate-900 dark:text-white">{userProfile?.streak_days || 1} ngày</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Chuỗi học tập</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/20 text-center min-w-[90px]">
                <CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400 mb-1" />
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {(userProfile?.sencash_balance || 0).toLocaleString('vi-VN')}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Ví SenCash</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-center min-w-[90px]">
                <Brain className="h-5 w-5 text-indigo-500 mb-1" />
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {userProfile?.senai_tier === 'pro' ? 'Pro' : userProfile?.senai_tier === 'ultra' ? 'Ultra' : 'Free'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">SenAI Quota</span>
              </div>
            </div>
          </div>
        </section>

        {/* Thanh chuyển phân hệ tính năng (Tabs) */}
        <section id="sen-categories-section" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Danh mục tính năng SenExam
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Hiển thị {filteredActions.length} tính năng
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Lưới các ô tính năng (Grid Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActions.map((action) => {
              const Icon = action.icon
              const isExternal = action.href.startsWith('http')
              const Component = isExternal ? 'a' : Link
              const extraProps = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}

              return (
                <Component
                  key={action.key}
                  href={action.href}
                  {...extraProps}
                  className={`group relative overflow-hidden p-5 flex flex-col justify-between ${glassCardClass} hover:-translate-y-1 hover:shadow-lg`}
                >
                  {/* Dải gradient xanh ngọc logo SenExam trên đầu card */}
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${action.tone}`} />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="h-10 w-10 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-300 group-hover:scale-110 transition-transform">
                        <Icon className="h-5 w-5" />
                      </div>
                      {action.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          {action.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors leading-snug">
                      {action.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {action.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
                    <span>Khám phá ngay</span>
                    {isExternal ? (
                      <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    )}
                  </div>
                </Component>
              )
            })}
          </div>
        </section>
      </main>

      {/* ============================================================== */}
      {/* 4. MODAL: PROFILE SETTING (HIỆN LUÔN KHÔNG CHUYỂN TAB)          */}
      {/* ============================================================== */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-6 ${glassCardClass} bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-900/60 shadow-2xl relative`}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-sky-500 text-white flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">Hồ sơ cá nhân & Bảo mật</h3>
                  <p className="text-xs text-slate-400">Thông tin tài khoản và phân quyền trên SenExam</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="h-8 w-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Thông tin chính */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20">
              <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-sky-500 to-cyan-500 text-white flex items-center justify-center text-xl font-black">
                {userProfile?.full_name?.charAt(0) || 'S'}
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-lg text-slate-900 dark:text-white">{userProfile?.full_name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Chưa đăng nhập'}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-700 dark:text-sky-300">
                    {userProfile?.role === 'admin' ? 'Quản trị viên' : userProfile?.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                  </span>
                  {renderBrandTitle()}
                </div>
              </div>
            </div>

            {/* Trường học & Tỉnh thành */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-sky-500" /> Trường học:
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{userProfile?.school || 'Chưa cập nhật'}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-cyan-500" /> Tỉnh/Thành:
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{userProfile?.province || 'Chưa cập nhật'}</p>
              </div>
            </div>

            {/* Quản lý ví & Gói dịch vụ */}
            <div className="space-y-2">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">Tài chính & Gói dịch vụ</h5>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/new-pay?tab=wallet"
                  className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">Ví SenCash</span>
                    <strong className="text-base font-black text-amber-900 dark:text-amber-200">
                      {(userProfile?.sencash_balance || 0).toLocaleString('vi-VN')} SC
                    </strong>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/new-pay?tab=vip"
                  className="p-3.5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/25 flex items-center justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300 block">Hội viên VIP</span>
                    <strong className="text-base font-black text-sky-900 dark:text-sky-200">
                      {userProfile?.is_vip ? userProfile?.plan_tier?.toUpperCase() : 'Miễn phí'}
                    </strong>
                  </div>
                  <ChevronRight className="h-4 w-4 text-sky-600 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Thông tin Bảo mật Sen 2FA & Đổi mật khẩu */}
            <div className="space-y-3 pt-3 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Xác thực bảo mật Sen 2FA:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Chuẩn TOTP RFC 6238
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tài khoản được bảo vệ bằng mã bảo mật nâng cao và mã hóa end-to-end trên toàn hệ sinh thái SenExam.
              </p>
            </div>

            {/* Nút Đóng & Xem đầy đủ */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition"
              >
                Đóng
              </button>
              <Link
                href="/new-profile"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white transition flex items-center gap-1.5 shadow-sm"
              >
                <span>Hồ sơ chi tiết</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: CÀI ĐẶT HỆ THỐNG & KÍNH LỎNG KHÚC XẠ IOS 27           */}
      {/* ============================================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-6 ${glassCardClass} bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-900/60 shadow-2xl relative`}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-sky-500 text-white flex items-center justify-center">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">Cài đặt & Tùy biến Giao diện</h3>
                  <p className="text-xs text-slate-400">Tùy chỉnh hiệu ứng hiển thị và tiện ích trên trang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="h-8 w-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* MỤC QUAN TRỌNG: BẬT / TẮT GIAO DIỆN KÍNH LỎNG KHÚC XẠ NHƯ IOS 27 */}
            <div className="p-4 rounded-2xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/30 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-black text-sm text-sky-900 dark:text-sky-200">Kính lỏng khúc xạ iOS 27:</p>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-500 text-white">
                    {isLiquidGlass ? 'Đang Bật' : 'Đang Tắt'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Hiệu ứng quang học khúc xạ ánh sáng, đổ bóng thấu kính và ánh sáng quang phổ đa lớp.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleLiquidGlass}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isLiquidGlass ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isLiquidGlass ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Chế độ Sáng / Tối */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">Giao diện Sáng / Tối:</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isDark ? 'Đang dùng giao diện Dark tối ưu mắt' : 'Đang dùng giao diện Light tươi sáng'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-sky-500" />}
                <span>{isDark ? 'Tối' : 'Sáng'}</span>
              </button>
            </div>

            {/* Chế độ Siêu Mượt Eco Mode */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-xs text-slate-900 dark:text-white">Siêu Mượt & Tiết Kiệm Pin:</p>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    Eco
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Giảm thiểu hoạt ảnh nền và đổ bóng để tối ưu máy yếu
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const n = !isEcoMode
                  setIsEcoMode(n)
                  localStorage.setItem('sen_eco_mode', n ? '1' : '0')
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  isEcoMode
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isEcoMode ? 'Đang Bật' : 'Tắt'}
              </button>
            </div>

            {/* Phiên bản hệ thống */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-center space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Phiên bản SenExam 2027 • Refraction Engine 2.1
              </span>
              <p className="text-[10px] text-slate-400">Đã đồng bộ hóa thiết kế thương hiệu cùng biểu trưng SenExam</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white transition shadow-sm"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: SEARCH PALETTE (KÍNH LÚP TÌM KIẾM TOÀN BỘ TÍNH NĂNG) */}
      {/* ============================================================== */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl p-4 space-y-4 ${glassCardClass} bg-white dark:bg-slate-900 border-sky-300 dark:border-sky-800 shadow-2xl relative`}
          >
            {/* Input tìm kiếm */}
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-5 w-5 text-sky-500" />
              <input
                type="text"
                autoFocus
                placeholder="Tìm nhanh tính năng, đề thi, phòng lab, công cụ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Danh sách kết quả */}
            <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy tính năng nào khớp với &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((action) => {
                  const Icon = action.icon
                  const isExternal = action.href.startsWith('http')
                  const Comp = isExternal ? 'a' : Link
                  const props = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}

                  return (
                    <Comp
                      key={action.key}
                      href={action.href}
                      onClick={() => setIsSearchModalOpen(false)}
                      {...props}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-sky-500/10 dark:hover:bg-sky-500/15 border border-transparent hover:border-sky-500/20 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">
                            {action.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate max-w-sm">{action.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </Comp>
                  )
                })
              )}
            </div>

            <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Nhấn ESC để đóng</span>
              <span>Hệ sinh thái SenExam 2027</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
