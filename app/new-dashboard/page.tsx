'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Baloo_2, Nunito } from 'next/font/google'
import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calendar,
  Compass,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  Flame,
  FlaskConical,
  Gauge,
  HelpCircle,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Moon,
  Palette,
  PlaySquare,
  RefreshCw,
  Rocket,
  School,
  Settings,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  User,
  Video,
  Zap,
  FileCheck,
  Gift,
  ShieldCheck,
  Gem,
  GraduationCap,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { linkWithGoogle } from '@/lib/authHelper'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newdash-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newdash-body' })

type QuickAction = {
  key: string
  title: string
  description: string
  href: string
  tone: string
  badge?: string
  icon: ComponentType<{ className?: string }>
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'new-exams',
    title: 'Kho đề thi mới',
    description: 'Khám phá ngân hàng đề thi bám sát ma trận 2026 và làm bài trực tuyến.',
    href: '/new-exams',
    tone: 'from-[#FFD166] via-[#F9A03F] to-[#EF476F]',
    badge: 'Mới',
    icon: Rocket,
  },
  {
    key: 'new-history',
    title: 'Lịch sử bài thi',
    description: 'Tra cứu bảng điểm, xem lại lời giải chi tiết và tải đề thi PDF.',
    href: '/new-history',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    badge: 'Hồ sơ',
    icon: BadgeCheck,
  },
  {
    key: 'senai',
    title: 'SenAI Studio',
    description: 'Xưởng AI cá nhân hoá để tạo đề, chấm bài và giải thích chi tiết.',
    href: '/new-senai-studio',
    tone: 'from-[#3DA9FC] via-[#00C2A8] to-[#5EEAD4]',
    badge: 'AI 2.0',
    icon: Sparkles,
  },
  {
    key: 'submissions',
    title: 'Quản lý bài thi',
    description: 'Tra cứu, đối chiếu đáp án chi tiết và xem lại các bài thi đã làm.',
    href: '/new-submissions',
    tone: 'from-[#6366F1] via-[#8B5CF6] to-[#EC4899]',
    badge: 'Mới',
    icon: FileCheck,
  },
  {
    key: 'library',
    title: 'Thư viện thông minh',
    description: 'Kho tài liệu chuyên sâu được sắp xếp theo môn và mục tiêu thi cử.',
    href: '/new-library',
    tone: 'from-[#95D5B2] via-[#52B788] to-[#2D6A4F]',
    icon: BookOpen,
  },
  {
    key: 'senvideo',
    title: 'Sen Video',
    description: 'Video bài giảng ngắn gọn, sinh động giúp nắm bắt trọng tâm nhanh.',
    href: '/new-video',
    tone: 'from-[#F472B6] via-[#EC4899] to-[#DB2777]',
    badge: 'Mới',
    icon: Video,
  },
  {
    key: 'media',
    title: 'Sen Media 2.0',
    description: 'Cộng đồng sĩ tử, diễn đàn hỏi đáp bài tập và phòng chat thảo luận toàn quốc.',
    href: '/new-media',
    tone: 'from-[#818CF8] via-[#6366F1] to-[#38BDF8]',
    badge: 'Media',
    icon: MessageSquare,
  },
  {
    key: 'schedule',
    title: 'Lịch Học & Lịch Thi',
    description: 'Quản lý thời khóa biểu, lịch thi thử, cài đặt nhắc nhở và lặp lại thông minh.',
    href: '/new-schedule',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]',
    badge: 'Mới',
    icon: Calendar,
  },
  {
    key: 'focus',
    title: 'Chế độ Focus',
    description: 'Không gian học tập yên tĩnh, đếm giờ Pomodoro tăng hiệu suất tối đa.',
    href: '/new-focus',
    tone: 'from-[#F9C74F] via-[#F9844A] to-[#F3722C]',
    icon: Gauge,
  },
  {
    key: 'beta',
    title: 'Kênh Thử Nghiệm Beta',
    description: 'Trải nghiệm sớm các tính năng tương lai 2026, xem roadmap cập nhật và quản lý tham gia.',
    href: '/new-beta',
    tone: 'from-[#EC4899] via-[#8B5CF6] to-[#6366F1]',
    badge: 'Beta',
    icon: Sparkles,
  },
  {
    key: 'tinhdiem',
    title: 'Tính điểm thi',
    description: 'Công cụ tính điểm tốt nghiệp THPT, TSA và HSA chính xác nhất.',
    href: '/new-mark-calculate',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    icon: TrendingUp,
  },
  {
    key: 'student',
    title: 'Lớp Học Của Tôi',
    description: 'Tham gia lớp học bằng mã mời, xem các kỳ thi được giao và bảng điểm lớp.',
    href: '/new-student',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]',
    badge: 'Lớp học',
    icon: GraduationCap,
  },
  {
    key: 'phongthinghiem',
    title: 'Phòng thí nghiệm ảo',
    description: 'Trực quan hoá các định luật Lý - Hoá - Sinh qua mô phỏng tương tác.',
    href: '/new-labs',
    tone: 'from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED]',
    icon: FlaskConical,
  },
  {
    key: 'exclusive_store',
    title: 'Cửa Hàng Độc Quyền',
    description: 'Ưu đãi Flash Sale giảm 30% nâng cấp SenAI Plus/Ultra dành riêng cho VIP & SenCash.',
    href: '/new-exclusive-store',
    tone: 'from-[#EC4899] via-[#D946EF] to-[#8B5CF6]',
    badge: 'Hot Deal',
    icon: Gem,
  },
  {
    key: 'vip',
    title: 'Gói nâng cấp VIP',
    description: 'Mở khoá trọn vẹn đặc quyền AI, đề độc quyền và hỗ trợ 24/7.',
    href: '/new-vip',
    tone: 'from-[#FBBF24] via-[#F59E0B] to-[#D97706]',
    badge: 'Ưu đãi',
    icon: Crown,
  },
  {
    key: 'teacher',
    title: 'Cổng Giảng Viên',
    description: 'Soạn đề thi, quản lý lớp học, cấp mã mời và giám sát vi phạm thi cử.',
    href: '/new-teacher',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#0284C7]',
    badge: 'Teacher',
    icon: School,
  },
  {
    key: 'codes',
    title: 'Đổi Mã Quà Tặng',
    description: 'Nhập mã Gift Code 16 chữ số để nhận quà SenCash và ngày VIP.',
    href: '/new-codes',
    tone: 'from-[#F472B6] via-[#EC4899] to-[#BE185D]',
    badge: 'Code',
    icon: Gift,
  },
  {
    key: 'admin',
    title: 'Quản Trị Tối Cao',
    description: 'Giám sát hệ thống thời gian thực, giveaway SenCash và quản lý đề toàn trường.',
    href: '/new-admin',
    tone: 'from-[#EF4444] via-[#DC2626] to-[#991B1B]',
    badge: 'Admin',
    icon: ShieldCheck,
  },
]

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

export default function NewDashboardPage() {
  const router = useRouter()
  const { isBetaTester: hookBeta } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [query, setQuery] = useState('')
  const [streakDays, setStreakDays] = useState(0)
  const [submissionCount, setSubmissionCount] = useState(0)
  const [activeAnnouncements, setActiveAnnouncements] = useState(0)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [bootTs] = useState<number>(() => Date.now())

  // User profile state
  const [fullName, setFullName] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')
  const [targetExams, setTargetExams] = useState<string[]>([])
  const [senCash, setSenCash] = useState<number>(0)
  const [userRole, setUserRole] = useState<string>('student')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  // Google link state
  const [linkedGoogle, setLinkedGoogle] = useState(false)
  const [googleLinkingLoading, setGoogleLinkingLoading] = useState(false)
  const [showGoogleGuide, setShowGoogleGuide] = useState(false)

  // Quick settings modal state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordText, setShowPasswordText] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let disposed = false
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

      if (!disposed) {
        setUserEmail(user.email || '')
        setUserId(user.id)
        const isGoogle = user.app_metadata?.provider === 'google' || user.identities?.some((id) => id.provider === 'google')
        setLinkedGoogle(!!isGoogle)
      }

      await ensureStudentProfile(user.id)

      const [profileRes, submissionsRes, announcementsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_beta_tester, full_name, theme_color, ui_mode, vip_expires_at, target_exams, school, province, sencash_balance, role')
          .eq('id', user.id)
          .single(),
        supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('announcements')
          .select('id')
          .order('created_at', { ascending: false }),
      ])

      const profile = profileRes.data
      const beta = profile ? profile.is_beta_tester === true : (localStorage.getItem('senexam_beta_tester') === '1')

      if (!disposed) {
        setIsBetaTester(beta)
        if (typeof window !== 'undefined') {
          localStorage.setItem('senexam_beta_tester', beta ? '1' : '0')
        }
        setFullName(profile?.full_name?.trim() || user.user_metadata?.full_name || 'Bạn')
        setSchool(profile?.school || '')
        setProvince(profile?.province || '')
        setTargetExams(Array.isArray(profile?.target_exams) ? profile.target_exams : [])
        setSenCash(profile?.sencash_balance || 0)
        const role = profile?.role || 'student'
        setUserRole(role)
        setVipUntil(profile?.vip_expires_at || null)
        setSubmissionCount(submissionsRes.count || 0)
        
        // Tính thông báo chưa đọc của riêng user này
        const readIds: string[] = JSON.parse(localStorage.getItem(`sen_read_announcements_${user.id}`) || '[]')
        const unreadCount = (announcementsRes.data || []).filter((a) => !readIds.includes(a.id)).length
        setActiveAnnouncements(unreadCount)

        const examsLen = Array.isArray(profile?.target_exams) ? profile.target_exams.length : 0
        setStreakDays(Math.max(2, Math.min(28, (submissionsRes.count || 0) + examsLen * 3)))
        setLoading(false)
      }
    }

    init()

    return () => {
      disposed = true
    }
  }, [router, hookBeta])

  const filteredActions = useMemo(() => {
    // Ẩn nút Admin & Teacher nếu user không có quyền
    const allowedActions = QUICK_ACTIONS.filter((item) => {
      if (item.key === 'admin') {
        return userRole === 'admin' || userRole === 'collab'
      }
      if (item.key === 'teacher') {
        return userRole === 'teacher' || userRole === 'admin' || userRole === 'collab'
      }
      return true
    })

    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) return allowedActions
    return allowedActions.filter((item) => {
      const hay = `${item.title} ${item.description}`.toLowerCase()
      return hay.includes(normalized)
    })
  }, [deferredQuery, userRole])

  const focusScore = useMemo(() => {
    const base = submissionCount * 12 + streakDays * 4
    return clampPercent(base)
  }, [submissionCount, streakDays])

  const vipLabel = useMemo(() => {
    if (!vipUntil) return 'Gói Miễn phí'
    const expires = new Date(vipUntil)
    if (Number.isNaN(expires.getTime()) || expires.getTime() < bootTs) return 'Gói Miễn phí'
    return `VIP đến ${expires.toLocaleDateString('vi-VN')}`
  }, [bootTs, vipUntil])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Chào buổi sáng'
    if (hour < 18) return 'Chào buổi chiều'
    return 'Chào buổi tối'
  }, [])

  // Chuyển đổi Dark Mode
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

  // Liên kết tài khoản Google
  const handleLinkGoogle = async () => {
    setGoogleLinkingLoading(true)
    try {
      if (linkedGoogle) {
        alert('Tài khoản của bạn đã được liên kết với Google!')
        return
      }
      await linkWithGoogle('/new-dashboard')
    } catch (err: any) {
      alert(`Không thể liên kết Google: ${err.message || 'Vui lòng cấu hình Google Provider trên Supabase.'}`)
    } finally {
      setGoogleLinkingLoading(false)
    }
  }

  // Đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    setSavingSettings(true)
    setPasswordMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setNewPassword('')
      setTimeout(() => setShowPasswordChange(false), 2000)
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Đổi mật khẩu thất bại.' })
    } finally {
      setSavingSettings(false)
    }
  }

  // Đăng xuất
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/new-sign')
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#0F172A] text-[#2B2B2B] dark:text-slate-100 transition-colors">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-base">Đang tải SenExam Dashboard...</span>
        </div>
      </div>
    )
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 12% 8%, rgba(56, 189, 248, 0.15), transparent 35%), radial-gradient(circle at 88% 12%, rgba(168, 85, 247, 0.15), transparent 28%), radial-gradient(circle at 80% 75%, rgba(99, 102, 241, 0.18), transparent 32%), var(--bg)'
          : 'radial-gradient(circle at 12% 8%, rgba(255, 187, 120, 0.45), transparent 35%), radial-gradient(circle at 88% 12%, rgba(94, 234, 212, 0.34), transparent 28%), radial-gradient(circle at 80% 75%, rgba(129, 140, 248, 0.32), transparent 32%), var(--bg)',
      }}
    >
      <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        
        {/* Banner Chào Mừng & Thống Kê Tổng Quan */}
        <div className="relative overflow-hidden rounded-[30px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-slate-900/75 p-6 shadow-[0_20px_45px_rgba(16,24,40,0.1)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-rose-400/30 dark:bg-rose-500/20 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-teal-400/30 dark:bg-teal-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <Zap className="h-3.5 w-3.5" /> SenExam
                </span>
                {isBetaTester && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Sparkles className="h-3 w-3" /> Beta Member
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                {greeting}, {fullName}! 👋
              </h1>
              <p className="mt-2 text-sm text-[#4B5563] dark:text-slate-300 sm:text-base" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                Sẵn sàng cho các buổi ôn luyện hiệu quả hôm nay. Khám phá kho tài liệu và đề thi bám sát kỳ thi của bạn.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Flame className="h-4 w-4" /> Chuỗi học tập
                </div>
                <p className="mt-1 text-2xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{streakDays} ngày</p>
              </div>
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <Crown className="h-4 w-4" /> Trạng thái
                </div>
                <p className="mt-1 text-lg font-black truncate" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{vipLabel}</p>
              </div>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="relative mt-6 grid gap-3.5 sm:grid-cols-3">
            <Link
              href="/new-history"
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-amber-500/10 dark:bg-amber-500/15 p-4 transition hover:scale-[1.02] cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Đề thi đã hoàn thành</p>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">Xem lịch sử →</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{submissionCount}</strong>
                <BadgeCheck className="h-7 w-7 text-amber-600 dark:text-amber-400 opacity-80" />
              </div>
            </Link>
            <Link
              href="/new-announcement"
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-teal-500/10 dark:bg-teal-500/15 p-4 transition hover:scale-[1.02] cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">Thông báo mới</p>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 group-hover:underline">Xem bản tin →</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{activeAnnouncements}</strong>
                <Star className="h-7 w-7 text-teal-600 dark:text-teal-400 opacity-80" />
              </div>
            </Link>
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-indigo-500/10 dark:bg-indigo-500/15 p-4 transition hover:scale-[1.01]">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Chỉ số tập trung (Focus)</p>
              <div className="mt-2 flex items-center justify-between">
                <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{focusScore}%</strong>
                <TrendingUp className="h-7 w-7 text-indigo-600 dark:text-indigo-400 opacity-80" />
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Main Layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
          
          {/* CỘT TRÁI: Playground Điều Hướng Tính Năng */}
          <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-slate-900/75 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                  Không gian học tập & Tính năng
                </h2>
                <p className="text-sm text-[#4B5563] dark:text-slate-300" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                  Tìm nhanh phòng thi, tài liệu hoặc công cụ luyện tập mong muốn.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Compass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280] dark:text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm: thi thử, thư viện, AI..."
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-9 pr-3 text-sm outline-none transition focus:border-amber-500 dark:focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredActions.map((item, index) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="newdash-card group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-4 transition-all duration-200"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-700/80 p-2.5 shadow-sm">
                        <Icon className="h-5 w-5 text-[#111827] dark:text-white" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {item.badge}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-[#6B7280] dark:text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </div>
                    <h3 className="mt-3 text-lg font-black leading-tight" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#4B5563] dark:text-slate-300" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                      {item.description}
                    </p>
                  </Link>
                )
              })}
              {filteredActions.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-800/50 p-6 text-center text-sm text-[#4B5563] dark:text-slate-400">
                  Không tìm thấy tính năng phù hợp. Vui lòng thử từ khoá khác ngắn gọn hơn.
                </div>
              ) : null}
            </div>
          </div>

          {/* CỘT PHẢI: Tab Thông Tin Cá Nhân, Ví Sen, Sen VIP, Cài Đặt & Liên Kết Google */}
          <aside className="space-y-5">
            
            {/* Card 1: Thông tin cá nhân & Ví Sen / VIP */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
                <Link href="/new-profile" className="flex items-center gap-3 group transition">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md transition group-hover:scale-105">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                      {fullName}
                    </h3>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate max-w-[170px]">{userEmail}</p>
                  </div>
                </Link>
                <Link
                  href="/new-profile"
                  className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
                >
                  {userRole === 'admin' ? 'Quản trị' : userRole === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                </Link>
              </div>

              {/* Thông tin trường lớp */}
              <div className="mt-3.5 space-y-2 text-xs text-[#4B5563] dark:text-slate-300">
                {school && (
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">Trường: <strong>{school}</strong></span>
                  </div>
                )}
                {province && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>Tỉnh/Thành: <strong>{province}</strong></span>
                  </div>
                )}
                {targetExams.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] font-bold text-[#6B7280] dark:text-slate-400">Mục tiêu:</span>
                    {targetExams.map((ex) => (
                      <span key={ex} className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2 Nút Hành Động Lớn: Ví Sen & Sen VIP */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 pt-3 border-t border-black/10 dark:border-white/10">
                <Link
                  href="/new-sencash"
                  className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-3 transition hover:scale-[1.02] group"
                >
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ví Sen</span>
                  </div>
                  <div className="mt-2">
                    <strong className="text-base font-black text-amber-900 dark:text-amber-200 block truncate" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                      {senCash.toLocaleString('vi-VN')} SC
                    </strong>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
                      Nạp thêm SenCash →
                    </span>
                  </div>
                </Link>

                <Link
                  href="/new-vip"
                  className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/15 p-3 transition hover:scale-[1.02] group"
                >
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                    <Crown className="h-4 w-4 text-rose-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sen VIP</span>
                  </div>
                  <div className="mt-2">
                    <strong className="text-base font-black text-rose-900 dark:text-rose-200 block truncate" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                      {vipUntil ? 'VIP Active' : 'Chưa kích hoạt'}
                    </strong>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 group-hover:underline">
                      Nâng cấp VIP ngay →
                    </span>
                  </div>
                </Link>
              </div>

              {/* Lối tắt: Lịch sử làm bài, Kho đề thi mới & Hồ sơ cá nhân */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link
                  href="/new-history"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2 px-1.5 text-[11px] font-bold transition hover:bg-black/10 dark:hover:bg-white/10 text-center"
                >
                  <BadgeCheck className="h-3.5 w-3.5 text-teal-500" /> Lịch sử
                </Link>
                <Link
                  href="/new-exams"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2 px-1.5 text-[11px] font-bold transition hover:bg-black/10 dark:hover:bg-white/10 text-center"
                >
                  <Rocket className="h-3.5 w-3.5 text-indigo-500" /> Kho đề
                </Link>
                <Link
                  href="/new-profile"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 py-2 px-1.5 text-[11px] font-bold transition hover:bg-indigo-500/20 text-center"
                >
                  <User className="h-3.5 w-3.5" /> Hồ sơ
                </Link>
              </div>
            </div>

            {/* Card 2: Liên kết tài khoản Google */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <h3 className="font-bold text-sm">Tài khoản Google</h3>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${linkedGoogle ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                  {linkedGoogle ? '✓ Đã liên kết' : 'Chưa liên kết'}
                </span>
              </div>

              <p className="mt-2 text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {linkedGoogle
                  ? 'Tài khoản của bạn đã được kết nối an toàn với Google. Bạn có thể đăng nhập 1-chạm bất cứ lúc nào.'
                  : 'Liên kết với Google giúp bạn đăng nhập nhanh chóng chỉ với 1 click, không lo quên mật khẩu.'}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={googleLinkingLoading || linkedGoogle}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-black/15 dark:border-white/15 px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white shadow-sm transition hover:bg-black/5 disabled:opacity-50"
                >
                  {googleLinkingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : linkedGoogle ? 'Đã liên kết thành công' : 'Liên kết tài khoản Google'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                  title="Xem thông tin bảo mật & lợi ích"
                  className="rounded-xl border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-2 text-xs font-bold transition hover:bg-black/10"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>

              {/* Hướng Dẫn & Thông Tin Dành Cho Học Sinh */}
              {showGoogleGuide && (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-[#4B5563] dark:text-slate-300 space-y-2 animate-in fade-in zoom-in-95">
                  <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Lợi ích khi liên kết Google:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                    <li>Đăng nhập tức thì 1-chạm không cần nhập mật khẩu.</li>
                    <li>Bảo mật tài khoản 2 lớp chuẩn Google Security.</li>
                    <li>Tự động đồng bộ tiến độ học tập và bài thi trên mọi thiết bị.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Card 3: Cài đặt hệ thống & Tiện ích Web */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-500" /> Cài đặt & Tiện ích Web
                </h3>
                {savingSettings && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />}
              </div>

              {/* Chế độ Sáng / Tối */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">Chế độ hiển thị:</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400">Tuỳ chỉnh giao diện sáng hoặc tối</p>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-bold transition hover:bg-black/10"
                >
                  {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                  {isDark ? 'Giao diện Tối' : 'Giao diện Sáng'}
                </button>
              </div>

              {/* Đổi mật khẩu toggle */}
              <div className="pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#4B5563] dark:text-slate-300 hover:text-black dark:hover:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4" /> Đổi mật khẩu tài khoản
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                {showPasswordChange && (
                  <form onSubmit={handleChangePassword} className="mt-3 space-y-2 animate-in fade-in zoom-in-95">
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                        className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 py-2 pl-3 pr-8 text-xs outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPasswordText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {passwordMsg && (
                      <p className={`text-[11px] font-bold ${passwordMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {passwordMsg.text}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={savingSettings || !newPassword}
                      className="w-full rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                    >
                      {savingSettings ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                    </button>
                  </form>
                )}
              </div>

              {/* Nút Đăng xuất */}
              <div className="pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 py-2.5 text-xs font-bold transition border border-rose-500/20"
                >
                  <LogOut className="h-4 w-4" /> Đăng xuất khỏi tài khoản
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <style jsx>{`
        .newdash-card {
          animation: rise-in 420ms ease both;
          will-change: transform;
        }

        .newdash-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 18px 32px rgba(2, 6, 23, 0.12);
        }

        @keyframes rise-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .newdash-card {
            animation: none;
          }

          .newdash-card:hover {
            transform: none;
          }
        }
      `}</style>
    </main>
  )
}