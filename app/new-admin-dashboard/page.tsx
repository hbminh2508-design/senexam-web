'use client'

import React, { useState, useEffect, useMemo, useRef, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { linkWithGoogle } from '@/lib/authHelper'
import {
  ShieldCheck,
  Users,
  FileText,
  Coins,
  Gift,
  AlertCircle,
  Sparkles,
  Clock,
  Eye,
  Trash2,
  CheckCircle2,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  Zap,
  TrendingUp,
  Award,
  Crown,
  Lock,
  Unlock,
  KeyRound,
  Layers,
  Megaphone,
  BookOpen,
  ArrowRight,
  LayoutDashboard,
  Smartphone,
  Laptop,
  Globe,
  LogOut,
  RefreshCw,
  UserPlus,
  Download,
  FileSpreadsheet,
  Settings,
  GraduationCap,
  Briefcase,
  Flame,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Server,
  Activity,
  Radio,
  Sliders,
  FileCode,
  UserCheck,
  Compass,
  CreditCard,
  Rocket,
  BadgeCheck,
  School,
  MapPin,
  MessageCircle,
  Video,
  Star,
  PlaySquare,
  FlaskConical,
  Box,
  Brain,
  Gauge,
  Calendar,
  MessageSquare,
  EyeOff,
  QrCode,
  X,
} from 'lucide-react'

const headingFont = Baloo_2({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-newdash-heading',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
})

const bodyFont = Nunito({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-newdash-body',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
})

type Perspective = 'admin' | 'student' | 'teacher'
type AdminWorkbenchTab = 'sessions' | 'batch_provision' | 'single_provision' | 'exams' | 'users' | 'giftcodes'

interface SessionItem {
  id: string
  user_id: string
  user_email?: string
  user_full_name?: string
  user_role?: string
  device_id: string
  device_name: string
  device_type?: string
  browser: string
  os: string
  ip_address: string
  is_active: boolean
  last_active_at: string
  created_at: string
}

type ActionCategory = 'admin_core' | 'study' | 'math_exam' | 'senai' | 'community'

interface QuickAction {
  key: string
  title: string
  description: string
  href?: string
  actionTab?: AdminWorkbenchTab
  tone: string
  badge?: string
  icon: ComponentType<{ className?: string }>
  category: ActionCategory
}

// 1. Phân hệ Admin
const ADMIN_ACTION_CATEGORIES: { key: ActionCategory; label: string; icon: string }[] = [
  { key: 'admin_core', label: 'An Ninh & Quản Trị Hệ Thống', icon: '⚡' },
  { key: 'study', label: 'Khảo Thí & Ngân Hàng Đề Thi', icon: '📚' },
  { key: 'senai', label: 'SenAI & Trí Tuệ Nhân Tạo', icon: '🤖' },
  { key: 'community', label: 'Quà Tặng, Thông Báo & Tiện Ích', icon: '🎁' },
]

const ADMIN_ACTIONS: QuickAction[] = [
  {
    key: 'act-sessions',
    title: 'Quản Lý Phiên Đăng Nhập',
    description: 'Giám sát phiên làm việc trực tuyến, thiết bị, IP mạng và ngắt kết nối từ xa tức thì.',
    actionTab: 'sessions',
    tone: 'from-[#3B82F6] via-[#6366F1] to-[#8B5CF6]',
    badge: 'Bảo Mật',
    icon: Smartphone,
    category: 'admin_core',
  },
  {
    key: 'act-batch-provision',
    title: 'Cấp Hàng Loạt 0001 - 9999',
    description: 'Tạo hàng loạt tài khoản học sinh chạy theo dải số tuần tự kèm tên miền tùy chọn.',
    actionTab: 'batch_provision',
    tone: 'from-[#EF476F] via-[#F78C6C] to-[#FFD166]',
    badge: 'Nổi Bật',
    icon: Users,
    category: 'admin_core',
  },
  {
    key: 'act-single-provision',
    title: 'Cấp 1 Tài Khoản Trực Tiếp',
    description: 'Khởi tạo nhanh tài khoản với phân quyền Giáo viên, Quản trị hoặc Học sinh VIP.',
    actionTab: 'single_provision',
    tone: 'from-[#10B981] via-[#059669] to-[#047857]',
    badge: 'Trực Tiếp',
    icon: UserPlus,
    category: 'admin_core',
  },
  {
    key: 'act-user-roles',
    title: 'Phân Quyền & Cấp Sen VIP',
    description: 'Nâng cấp gói Premium / Sen One, cộng SenCash và quản lý vai trò thành viên.',
    actionTab: 'users',
    tone: 'from-[#F59E0B] via-[#D97706] to-[#B45309]',
    badge: 'Đặc Quyền',
    icon: ShieldCheck,
    category: 'admin_core',
  },
  {
    key: 'act-new-exams',
    title: 'Kho Đề Thi KaTeX & PDF',
    description: 'Ngân hàng đề thi bám sát ma trận 2026, hỗ trợ đề truyền thống PDF 2 cột và KaTeX.',
    href: '/new-exams',
    actionTab: 'exams',
    tone: 'from-[#FFD166] via-[#F9A03F] to-[#EF476F]',
    badge: 'Kho Đề',
    icon: Rocket,
    category: 'study',
  },
  {
    key: 'act-setup-course',
    title: 'Soạn Đề & Khóa Học SEB',
    description: 'Soạn đề KaTeX trực tiếp, tải đề PDF, cấu hình kỳ thi chống gian lận SEB v3.8.',
    href: '/new-setup-courses',
    tone: 'from-[#10B981] via-[#059669] to-[#047857]',
    badge: 'Soạn Đề',
    icon: Sparkles,
    category: 'study',
  },
  {
    key: 'act-history-submissions',
    title: 'Lịch Sử Bài Nộp Hệ Thống',
    description: 'Tra cứu bảng điểm, xem lại lời giải chi tiết, đối chiếu đáp án toàn bộ thí sinh.',
    href: '/new-history-submissions',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    badge: 'Khảo Thí',
    icon: BadgeCheck,
    category: 'study',
  },
  {
    key: 'act-senai-quota',
    title: 'Hạn Mức SenAI & Quota',
    description: 'Quản trị gói SenAI Studio Ultra/Max, định mức câu hỏi hàng ngày và token AI.',
    href: '/new-pay?tab=quota',
    tone: 'from-[#8B5CF6] via-[#A855F7] to-[#EC4899]',
    badge: 'AI Engine',
    icon: Brain,
    category: 'senai',
  },
  {
    key: 'act-giftcodes',
    title: 'Kho Mã Quà Tặng (Giftcodes)',
    description: 'Tạo mã kích hoạt Sen VIP và tặng SenCash cho học sinh nạp thưởng sự kiện.',
    actionTab: 'giftcodes',
    tone: 'from-[#EC4899] via-[#F43F5E] to-[#FB7185]',
    badge: 'Giftcode',
    icon: Gift,
    category: 'community',
  },
  {
    key: 'act-announcement',
    title: 'Phát Hành Thông Báo Hệ Thống',
    description: 'Đăng tải bản tin, hướng dẫn ôn thi và thông báo quan trọng đến học sinh.',
    href: '/new-announcement',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]',
    badge: 'Bản Tin',
    icon: Megaphone,
    category: 'community',
  },
]

// 2. Phân hệ Sinh viên THẬT LẤY TỪ NEW-DASHBOARD
const STUDENT_ACTION_CATEGORIES: { key: ActionCategory; label: string; icon: string }[] = [
  { key: 'study', label: 'Học tập & Luyện thi', icon: '📚' },
  { key: 'math_exam', label: 'Toán học & Khảo thí', icon: '📐' },
  { key: 'senai', label: 'SenAI & Quota', icon: '🤖' },
  { key: 'community', label: 'Cộng đồng & Tiện ích', icon: '🌐' },
]

const STUDENT_ACTIONS: QuickAction[] = [
  {
    key: 'st-new-exams',
    title: 'Kho đề thi mới',
    description: 'Khám phá ngân hàng đề thi bám sát ma trận 2026 và làm bài trực tuyến.',
    href: '/new-exams',
    tone: 'from-[#FFD166] via-[#F9A03F] to-[#EF476F]',
    badge: 'Mới',
    icon: Rocket,
    category: 'study',
  },
  {
    key: 'st-setup-course',
    title: 'Soạn Đề & Khóa Học',
    description: 'Soạn đề KaTeX trực tiếp, tải đề PDF & SEB, cấu hình kỳ thi và quản lý thí sinh.',
    href: '/new-setup-courses',
    tone: 'from-[#10B981] via-[#059669] to-[#047857]',
    badge: 'Mới',
    icon: Sparkles,
    category: 'study',
  },
  {
    key: 'st-history',
    title: 'Lịch sử Bài nộp',
    description: 'Tra cứu bảng điểm, xem lại lời giải chi tiết, đối chiếu đáp án và tải đề thi PDF.',
    href: '/new-history-submissions',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    badge: 'Hồ sơ',
    icon: BadgeCheck,
    category: 'study',
  },
  {
    key: 'st-sen-read',
    title: 'Phòng Đọc SenRead',
    description: 'Không gian đọc sách & bản thảo Canvas siêu nhẹ 60FPS, AI chia chương, dịch thuật song ngữ và giọng đọc Google.',
    href: '/read',
    tone: 'from-[#059669] via-[#10B981] to-[#34D399]',
    badge: 'Mới',
    icon: BookOpen,
    category: 'study',
  },
  {
    key: 'st-senai-studio',
    title: 'SenAI Studio',
    description: 'Xưởng AI cá nhân hoá để tạo đề, chấm bài và giải thích chi tiết.',
    href: '/new-senai-studio',
    tone: 'from-[#3DA9FC] via-[#00C2A8] to-[#5EEAD4]',
    badge: 'AI 2.0',
    icon: Sparkles,
    category: 'senai',
  },
  {
    key: 'st-sen-store',
    title: 'Cửa Hàng Sen',
    description: 'Trung tâm mua sắm 5-in-1: Nâng cấp Hội viên VIP, Gói SenAI & Quota, Ví SenCash, Ưu đãi độc quyền và Đổi Gift Code.',
    href: '/new-pay',
    tone: 'from-[#6366F1] via-[#8B5CF6] to-[#EC4899]',
    badge: 'Cửa hàng 5-in-1',
    icon: Crown,
    category: 'senai',
  },
  {
    key: 'st-seb-security',
    title: 'Sen Exam Canvas',
    description: 'Môi trường khảo thí trực tuyến bảo mật cao chống gian lận 100% qua Sen Exam Canvas.',
    href: 'https://seb.thicu.tailieufepn.senexam.me',
    tone: 'from-[#0EA5E9] via-[#0284C7] to-[#1D4ED8]',
    badge: 'Canvas',
    icon: ShieldCheck,
    category: 'math_exam',
  },
  {
    key: 'st-sengraph',
    title: 'SenGraph',
    description: 'Vẽ đồ thị hàm số 2D và mô hình không gian 3D tương tác cao cấp, tích hợp Sen AI Toán học.',
    href: 'https://sengraph.senexam.me',
    tone: 'from-[#06B6D4] via-[#0284C7] to-[#4F46E5]',
    badge: '2D & 3D',
    icon: Box,
    category: 'math_exam',
  },
  {
    key: 'st-library',
    title: 'Thư viện thông minh',
    description: 'Kho tài liệu chuyên sâu được sắp xếp theo môn và mục tiêu thi cử.',
    href: '/new-library',
    tone: 'from-[#95D5B2] via-[#52B788] to-[#2D6A4F]',
    icon: BookOpen,
    category: 'study',
  },
  {
    key: 'st-senvideo',
    title: 'Sen Video',
    description: 'Video bài giảng ngắn gọn, sinh động giúp nắm bắt trọng tâm nhanh.',
    href: '/new-video',
    tone: 'from-[#F472B6] via-[#EC4899] to-[#DB2777]',
    badge: 'Mới',
    icon: Video,
    category: 'study',
  },
  {
    key: 'st-media',
    title: 'Sen Media 2.0',
    description: 'Cộng đồng sĩ tử, diễn đàn hỏi đáp bài tập và phòng chat thảo luận toàn quốc.',
    href: '/new-media',
    tone: 'from-[#818CF8] via-[#6366F1] to-[#38BDF8]',
    badge: 'Media',
    icon: MessageSquare,
    category: 'community',
  },
  {
    key: 'st-schedule',
    title: 'Lịch Học & Lịch Thi',
    description: 'Quản lý thời khóa biểu, lịch thi thử, cài đặt nhắc nhở và lặp lại thông minh.',
    href: '/new-schedule',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]',
    badge: 'Mới',
    icon: Calendar,
    category: 'community',
  },
  {
    key: 'st-focus',
    title: 'Chế độ Focus',
    description: 'Không gian học tập yên tĩnh, đếm giờ Pomodoro tăng hiệu suất tối đa.',
    href: '/new-focus',
    tone: 'from-[#F9C74F] via-[#F9844A] to-[#F3722C]',
    icon: Gauge,
    category: 'study',
  },
  {
    key: 'st-tinhdiem',
    title: 'Tính điểm thi',
    description: 'Công cụ tính điểm tốt nghiệp THPT, TSA và HSA chính xác nhất.',
    href: '/new-mark-calculate',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    icon: TrendingUp,
    category: 'math_exam',
  },
  {
    key: 'st-student',
    title: 'Lớp Học Của Tôi',
    description: 'Tham gia lớp học bằng mã mời, xem các kỳ thi được giao và bảng điểm lớp.',
    href: '/new-student',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]',
    badge: 'Lớp học',
    icon: GraduationCap,
    category: 'study',
  },
  {
    key: 'st-phongthinghiem',
    title: 'Phòng thí nghiệm ảo',
    description: 'Trực quan hoá các định luật Lý - Hoá - Sinh qua mô phỏng tương tác.',
    href: '/new-labs',
    tone: 'from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED]',
    icon: FlaskConical,
    category: 'math_exam',
  },
]

// 3. Phân hệ Giảng viên THẬT LẤY TỪ NEW-DASHBOARD
const TEACHER_ACTION_CATEGORIES: { key: ActionCategory; label: string; icon: string }[] = [
  { key: 'study', label: 'Giảng Dạy & Khảo Thí', icon: '👨‍🏫' },
  { key: 'math_exam', label: 'Ngân Hàng Đề & Giám Thị SEB', icon: '📐' },
  { key: 'senai', label: 'Trợ Giảng AI & Studio', icon: '🤖' },
  { key: 'community', label: 'Quản Lý Lớp Học & Bảng Điểm', icon: '📊' },
]

const TEACHER_ACTIONS: QuickAction[] = [
  {
    key: 'tc-teacher-portal',
    title: 'Cổng Giảng Viên',
    description: 'Soạn đề thi, quản lý lớp học, cấp mã mời và giám sát vi phạm thi cử.',
    href: '/new-teacher',
    tone: 'from-[#06B6D4] via-[#0EA5E9] to-[#0284C7]',
    badge: 'Teacher',
    icon: School,
    category: 'study',
  },
  {
    key: 'tc-setup',
    title: 'Soạn Đề & Khóa Học SEB',
    description: 'Biên soạn đề KaTeX trực tiếp, tải đề PDF, thiết lập phòng thi và ma trận điểm.',
    href: '/new-setup-courses',
    tone: 'from-[#10B981] via-[#059669] to-[#047857]',
    badge: 'Soạn Đề',
    icon: Sparkles,
    category: 'study',
  },
  {
    key: 'tc-exams',
    title: 'Ngân Hàng Kho Đề Thi',
    description: 'Quản lý kho đề toàn diện, kiểm tra định dạng PDF 2 cột và KaTeX cho học sinh.',
    href: '/new-exams',
    tone: 'from-[#FFD166] via-[#F9A03F] to-[#EF476F]',
    badge: 'Kho Đề',
    icon: Rocket,
    category: 'math_exam',
  },
  {
    key: 'tc-seb',
    title: 'Giám Thị Trực Tuyến Canvas SEB',
    description: 'Giám sát màn hình thi trực tiếp, chống gian lận và khóa ứng dụng ngoại vi.',
    href: 'https://seb.thicu.tailieufepn.senexam.me',
    tone: 'from-[#0EA5E9] via-[#0284C7] to-[#1D4ED8]',
    badge: 'Canvas',
    icon: ShieldCheck,
    category: 'math_exam',
  },
  {
    key: 'tc-results',
    title: 'Lịch Sử Bài Nộp & Phổ Điểm',
    description: 'Theo dõi tiến độ nộp bài của học sinh, xuất bảng điểm và chấm điểm tự động.',
    href: '/new-history-submissions',
    tone: 'from-[#34D399] via-[#10B981] to-[#059669]',
    badge: 'Bảng Điểm',
    icon: BadgeCheck,
    category: 'community',
  },
  {
    key: 'tc-senai',
    title: 'SenAI Studio Trợ Giảng',
    description: 'Tự động tạo câu hỏi trắc nghiệm theo ma trận đề, sinh đề tương đương trong 3 giây.',
    href: '/new-senai-studio',
    tone: 'from-[#3DA9FC] via-[#00C2A8] to-[#5EEAD4]',
    badge: 'AI 2.0',
    icon: Brain,
    category: 'senai',
  },
  {
    key: 'tc-library',
    title: 'Thư Viện Tài Liệu Chuyên Môn',
    description: 'Chia sẻ giáo trình, tài liệu chuyên sâu theo từng chương trình thi Bộ GD&ĐT.',
    href: '/new-library',
    tone: 'from-[#95D5B2] via-[#52B788] to-[#2D6A4F]',
    icon: BookOpen,
    category: 'study',
  },
  {
    key: 'tc-labs',
    title: 'Phòng Thí Nghiệm Ảo Thực Hành',
    description: 'Hỗ trợ giảng dạy trực quan các thí nghiệm Vật Lý, Hóa Học, Sinh Học không gian.',
    href: '/new-labs',
    tone: 'from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED]',
    icon: FlaskConical,
    category: 'math_exam',
  },
  {
    key: 'tc-sengraph',
    title: 'SenGraph Toán Học',
    description: 'Vẽ đồ thị giải tích và hình học không gian 3D minh họa bài giảng trên lớp.',
    href: 'https://sengraph.senexam.me',
    tone: 'from-[#06B6D4] via-[#0284C7] to-[#4F46E5]',
    badge: '2D & 3D',
    icon: Box,
    category: 'math_exam',
  },
]

export default function NewAdminDashboardPage() {
  const router = useRouter()
  const { themeColor } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Google link state
  const [linkedGoogle, setLinkedGoogle] = useState(false)
  const [googleLinkingLoading, setGoogleLinkingLoading] = useState(false)
  const [showGoogleGuide, setShowGoogleGuide] = useState(false)

  // Sen 2FA state
  const [hasMfaEnrolled, setHasMfaEnrolled] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [showMfaGuide, setShowMfaGuide] = useState(false)

  // Góc nhìn hiển thị (Perspective Switcher: Admin | Sinh viên | Giảng viên)
  const [perspective, setPerspective] = useState<Perspective>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sen_admin_perspective') as Perspective) || 'admin'
    }
    return 'admin'
  })

  // Tab đang chọn ở Bàn Làm Việc Phía Dưới (Admin Workbench)
  const [workbenchTab, setWorkbenchTab] = useState<AdminWorkbenchTab>('sessions')

  // Thống kê tổng hợp (KPI Metrics)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalSubmissions: 0,
    totalSenCash: 0,
    totalSessions: 1,
  })

  // 1. Quản lý Phiên (Sessions)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionSearch, setSessionSearch] = useState('')

  // 2. Danh sách Đề thi
  const [exams, setExams] = useState<any[]>([])
  const [examsLoading, setExamsLoading] = useState(false)
  const [examSearch, setExamSearch] = useState('')

  // 3. Danh sách Người dùng
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserForGrant, setSelectedUserForGrant] = useState<any>(null)
  const [grantVipTier, setGrantVipTier] = useState('premium')
  const [grantVipDays, setGrantVipDays] = useState('30')
  const [grantSenCashAmount, setGrantSenCashAmount] = useState('50')
  const [grantActionLoading, setGrantActionLoading] = useState(false)

  // 4. Giftcodes
  const [giftcodes, setGiftcodes] = useState<any[]>([])
  const [newCodeType, setNewCodeType] = useState<'sencash' | 'vip_days'>('vip_days')
  const [newCodeAmount, setNewCodeAmount] = useState('30')
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('10')
  const [newCodeNote, setNewCodeNote] = useState('Quà tặng học sinh')
  const [codeActionLoading, setCodeActionLoading] = useState(false)

  // 5. Cấp tài khoản đơn lẻ (Single Provisioning)
  const [singleEmail, setSingleEmail] = useState('')
  const [singlePassword, setSinglePassword] = useState('')
  const [singleFullName, setSingleFullName] = useState('')
  const [singleRole, setSingleRole] = useState<'student' | 'teacher' | 'collab' | 'admin'>('student')
  const [singlePhone, setSinglePhone] = useState('')
  const [singleClass, setSingleClass] = useState('')
  const [singleSchool, setSingleSchool] = useState('')
  const [singleProvince, setSingleProvince] = useState('')
  const [singlePlanTier, setSinglePlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one'>('free')
  const [singleVipDays, setSingleVipDays] = useState('30')
  const [singleSenCash, setSingleSenCash] = useState('0')
  const [singleLoading, setSingleLoading] = useState(false)

  // 6. Cấp tài khoản hàng loạt (Batch Provisioning 0001 - 9999 @ domain)
  const [batchPrefix, setBatchPrefix] = useState('student')
  const [batchStartNum, setBatchStartNum] = useState('1')
  const [batchEndNum, setBatchEndNum] = useState('20')
  const [batchPadLength, setBatchPadLength] = useState('4') // 0001
  const [batchDomain, setBatchDomain] = useState('@senexam.edu.vn')
  const [batchPasswordMode, setBatchPasswordMode] = useState<'common' | 'pattern' | 'random'>('common')
  const [batchCommonPassword, setBatchCommonPassword] = useState('SenExam@2025')
  const [batchNamePattern, setBatchNamePattern] = useState('Học sinh [num]')
  const [batchRole, setBatchRole] = useState<'student' | 'teacher' | 'collab' | 'admin'>('student')
  const [batchClass, setBatchClass] = useState('')
  const [batchSchool, setBatchSchool] = useState('')
  const [batchProvince, setBatchProvince] = useState('')
  const [batchPlanTier, setBatchPlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one'>('free')
  const [batchVipDays, setBatchVipDays] = useState('30')
  const [batchSenCash, setBatchSenCash] = useState('0')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [copiedBatchList, setCopiedBatchList] = useState(false)

  // Sen 2FA Setup Modal
  const [showMfaEnrollModal, setShowMfaEnrollModal] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaSetupCode, setMfaSetupCode] = useState('')
  const [copiedMfaSecret, setCopiedMfaSecret] = useState(false)

  // Đổi mật khẩu bảo mật (Xác thực email)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordText, setShowPasswordText] = useState(false)
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordVerificationSent, setPasswordVerificationSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Phiên bản Web (2.0 vs 2.0.2194023.4923.01)
  const [showFullVersion, setShowFullVersion] = useState(false)

  // Tiêu chí bảo mật mật khẩu
  const hasMinLength = newPassword.length >= 8
  const hasUpperCase = /[A-Z]/.test(newPassword)
  const hasLowerCase = /[a-z]/.test(newPassword)
  const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)
  const isPasswordMatched = Boolean(confirmPassword && newPassword === confirmPassword)
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumberOrSpecial && isPasswordMatched

  // Đếm lùi thời gian gửi lại email
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Thông báo phản hồi banner
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Tự động kiểm tra session và đồng bộ quyền
  useEffect(() => {
    let isMounted = true

    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    if (isMounted) setIsDark(Boolean(dark))

    // Safety timeout: không bao giờ để loading bị đơ quá 1.2 giây
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 1200)

    const initAdmin = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user

        if (!user) {
          router.replace('/new-idp?next=/new-admin-dashboard')
          return
        }

        if (isMounted) {
          setCurrentUser(user)
          const isGoogle =
            user.app_metadata?.provider === 'google' ||
            user.identities?.some((id) => id.provider === 'google')
          setLinkedGoogle(!!isGoogle)
        }

        await ensureStudentProfile(user.id)

        // Kiểm tra vai trò admin trong bảng profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        const isSuperAdmin =
          profile?.role === 'admin' ||
          profile?.role === 'collab' ||
          user.email?.toLowerCase() === 'admin@senexam.me' ||
          user.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com'

        if (!isSuperAdmin) {
          alert('Truy cập bị từ chối: Khu vực này chỉ dành cho Quản trị viên hệ thống.')
          router.replace('/new-dashboard')
          return
        }

        if (isMounted) {
          setUserProfile(profile)
          localStorage.setItem('sen_cached_role', profile?.role || 'admin')
          // Render giao diện ngay tức thì khi đã xác minh quyền admin
          setLoading(false)
        }

        // Tải Sen 2FA status
        try {
          const { data: factorsData } = await supabase.auth.mfa.listFactors()
          const verifiedFactor = factorsData?.totp?.find((f: any) => f.status === 'verified')
          if (isMounted && verifiedFactor) {
            setHasMfaEnrolled(true)
            setMfaFactorId(verifiedFactor.id)
          }
        } catch (mfaErr) {
          console.warn('Lỗi kiểm tra Sen 2FA:', mfaErr)
        }

        // Tải số liệu thống kê KPI ban đầu song song ngầm
        Promise.allSettled([fetchOverviewStats(), fetchSessions()])
      } catch (err) {
        console.error('Lỗi khởi tạo Admin Dashboard:', err)
      } finally {
        if (isMounted) setLoading(false)
        clearTimeout(safetyTimer)
      }
    }

    initAdmin()

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [router])

  // Lời chào theo thời gian
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Chào buổi sáng'
    if (hour < 18) return 'Chào buổi chiều'
    return 'Chào buổi tối'
  }, [])

  // Tải thống kê KPI
  const fetchOverviewStats = async () => {
    try {
      const [usersRes, examsRes, subsRes] = await Promise.all([
        supabase.from('profiles').select('sencash_balance', { count: 'exact' }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
      ])

      const totalSc = (usersRes.data || []).reduce(
        (acc: number, curr: any) => acc + (Number(curr.sencash_balance) || 0),
        0
      )

      setStats((prev) => ({
        ...prev,
        totalUsers: usersRes.count || 0,
        totalExams: examsRes.count || 0,
        totalSubmissions: subsRes.count || 0,
        totalSenCash: totalSc,
      }))
    } catch (e) {
      console.warn('Lỗi lấy thống kê KPI:', e)
    }
  }

  // Tải danh sách phiên đăng nhập
  const fetchSessions = async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/admin/sessions')
      const data = await res.json()
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions)
        setStats((prev) => ({ ...prev, totalSessions: data.totalActive || data.sessions.length }))
      }
    } catch (e) {
      console.warn('Lỗi tải sessions:', e)
    } finally {
      setSessionsLoading(false)
    }
  }

  // Tải danh sách đề thi
  const fetchExams = async () => {
    setExamsLoading(true)
    try {
      const { data } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setExams(data)
    } catch (e) {
      console.warn('Lỗi tải exams:', e)
    } finally {
      setExamsLoading(false)
    }
  }

  // Tải danh sách người dùng
  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150)
      if (data) setUsers(data)
    } catch (e) {
      console.warn('Lỗi tải users:', e)
    } finally {
      setUsersLoading(false)
    }
  }

  // Tải giftcodes khi chuyển tab
  useEffect(() => {
    if (workbenchTab === 'sessions') fetchSessions()
    if (workbenchTab === 'exams') fetchExams()
    if (workbenchTab === 'users') fetchUsers()
  }, [workbenchTab])

  // Chuyển đổi góc nhìn
  const handleSwitchPerspective = (newPerspective: Perspective) => {
    setPerspective(newPerspective)
    try {
      localStorage.setItem('sen_admin_perspective', newPerspective)
    } catch {}
    setBannerMsg({
      type: 'success',
      text:
        newPerspective === 'admin'
          ? 'Đã chuyển về Góc nhìn Quản trị viên (Master Admin)'
          : newPerspective === 'student'
          ? 'Đang trải nghiệm Góc nhìn Sinh viên THẬT (Tất cả tính năng đều kết nối hoạt động thật)'
          : 'Đang trải nghiệm Góc nhìn Giảng viên THẬT (Tất cả tính năng khảo thí đều kết nối hoạt động thật)',
    })
    setTimeout(() => setBannerMsg(null), 3500)
  }

  // Chuyển đổi Dark/Light mode
  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      try {
        localStorage.setItem('theme', 'dark')
      } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      try {
        localStorage.setItem('theme', 'light')
      } catch {}
    }
  }

  // Cuộn mượt đến bàn làm việc chuyên sâu bên dưới
  const scrollToWorkbench = (targetTab?: AdminWorkbenchTab) => {
    if (targetTab) setWorkbenchTab(targetTab)
    const el = document.getElementById('admin-workbench')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      await linkWithGoogle('/new-admin-dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vui lòng cấu hình Google Provider trên Supabase.'
      alert(`Không thể liên kết Google: ${msg}`)
    } finally {
      setGoogleLinkingLoading(false)
    }
  }

  // Bật / tắt Sen 2FA
  const handleToggleMfa = async () => {
    if (hasMfaEnrolled) {
      const conf = window.confirm('Bạn có chắc chắn muốn tắt xác thực Sen 2FA cho tài khoản Root Admin này?')
      if (!conf) return
      setMfaLoading(true)
      try {
        if (mfaFactorId) {
          await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
        }
        setHasMfaEnrolled(false)
        setMfaFactorId('')
        setBannerMsg({ type: 'success', text: '✓ Đã tắt Sen 2FA thành công.' })
      } catch (err: any) {
        setBannerMsg({ type: 'error', text: `Không thể tắt Sen 2FA: ${err.message || 'Lỗi'}` })
      } finally {
        setMfaLoading(false)
        setTimeout(() => setBannerMsg(null), 3000)
      }
    } else {
      await handleStartMfaEnrollment()
    }
  }

  // Khởi tạo quy trình cài đặt Sen 2FA trong Admin Dashboard
  const handleStartMfaEnrollment = async () => {
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'SenExam',
      })
      if (error) throw error
      if (data) {
        setMfaFactorId(data.id)
        if (data.totp?.qr_code) setMfaQrCode(data.totp.qr_code)
        if (data.totp?.secret) setMfaSecret(data.totp.secret)
        setShowMfaEnrollModal(true)
      }
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: `Không thể khởi tạo Sen 2FA: ${err.message || 'Lỗi'}` })
    } finally {
      setMfaLoading(false)
    }
  }

  // Xác nhận kích hoạt Sen 2FA với mã 6 số
  const handleConfirmMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = mfaSetupCode.trim().replace(/[^0-9]/g, '')
    if (cleanCode.length !== 6) {
      alert('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.')
      return
    }
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: cleanCode,
      })
      if (error) throw error
      setHasMfaEnrolled(true)
      setShowMfaEnrollModal(false)
      setMfaQrCode('')
      setMfaSecret('')
      setMfaSetupCode('')
      setBannerMsg({ type: 'success', text: '🎉 Đã kích hoạt bảo mật Sen 2FA thành công cho Root Admin!' })
    } catch (err: any) {
      alert(`Mã xác thực không hợp lệ: ${err.message || 'Vui lòng kiểm tra lại mã.'}`)
    } finally {
      setMfaLoading(false)
      setTimeout(() => setBannerMsg(null), 3500)
    }
  }

  // Đăng xuất
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/new-idp')
  }

  // Thu hồi phiên đăng nhập từ xa
  const handleRevokeSession = async (sessionId: string, userId: string) => {
    const conf = window.confirm('Bạn có chắc chắn muốn buộc đăng xuất phiên làm việc này?')
    if (!conf) return
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', sessionId, userId }),
      })
      const data = await res.json()
      if (data.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId || s.device_id === sessionId ? { ...s, is_active: false } : s))
        )
        setBannerMsg({ type: 'success', text: 'Đã thu hồi phiên đăng nhập thành công.' })
      } else {
        throw new Error(data.error)
      }
    } catch (e: any) {
      setBannerMsg({ type: 'error', text: e.message || 'Lỗi khi hủy phiên.' })
    }
    setTimeout(() => setBannerMsg(null), 3000)
  }

  // Cấp 1 tài khoản đơn lẻ
  const handleSingleProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    setSingleLoading(true)
    setBannerMsg(null)
    try {
      if (!singleEmail.trim() || !singlePassword || !singleFullName.trim()) {
        throw new Error('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu khởi tạo.')
      }

      const res = await fetch('/api/admin/provision-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: singleEmail.trim(),
          password: singlePassword,
          fullName: singleFullName.trim(),
          role: singleRole,
          phone: singlePhone.trim() || undefined,
          className: singleClass.trim() || undefined,
          school: singleSchool.trim() || undefined,
          province: singleProvince.trim() || undefined,
          planTier: singlePlanTier,
          vipDays: singlePlanTier !== 'free' ? parseInt(singleVipDays || '30', 10) : undefined,
          sencashBalance: parseInt(singleSenCash || '0', 10),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cấp tài khoản thất bại.')
      }

      setBannerMsg({
        type: 'success',
        text: `✓ Cấp tài khoản thành công cho [${data.user?.email || singleEmail}]. Người dùng có thể đăng nhập ngay!`,
      })
      setSingleEmail('')
      setSinglePassword('')
      setSingleFullName('')
      setSinglePhone('')
      setSingleClass('')
      setSingleSchool('')
      setSingleProvince('')
      setSingleSenCash('0')
      fetchUsers()
      fetchOverviewStats()
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message || 'Lỗi cấp tài khoản.' })
    } finally {
      setSingleLoading(false)
    }
  }

  // Cấp hàng loạt
  const handleBatchProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    setBatchLoading(true)
    setBannerMsg(null)
    setBatchResults([])
    setBatchProgress(15)

    try {
      const start = parseInt(batchStartNum || '1', 10)
      const end = parseInt(batchEndNum || '1', 10)
      const pad = parseInt(batchPadLength || '4', 10)

      if (isNaN(start) || isNaN(end) || end < start) {
        throw new Error('Khoảng số bắt đầu và kết thúc không hợp lệ.')
      }

      const total = end - start + 1
      if (total > 150) {
        throw new Error('Mỗi lượt cấp tối đa 150 tài khoản để đảm bảo an toàn máy chủ.')
      }

      setBatchProgress(40)

      const res = await fetch('/api/admin/provision-users-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: batchPrefix.trim(),
          startNum: start,
          endNum: end,
          padLength: pad,
          domain: batchDomain.trim(),
          passwordMode: batchPasswordMode,
          commonPassword: batchCommonPassword,
          namePattern: batchNamePattern.trim() || 'Học sinh [num]',
          role: batchRole,
          className: batchClass.trim() || undefined,
          school: batchSchool.trim() || undefined,
          province: batchProvince.trim() || undefined,
          planTier: batchPlanTier,
          vipDays: batchPlanTier !== 'free' ? parseInt(batchVipDays || '30', 10) : undefined,
          senCash: parseInt(batchSenCash || '0', 10),
        }),
      })

      setBatchProgress(85)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cấp hàng loạt thất bại.')
      }

      setBatchProgress(100)
      setBatchResults(data.users || [])
      setBannerMsg({
        type: 'success',
        text: `✓ Cấp hàng loạt hoàn tất! Thành công: ${data.createdCount}/${data.totalRequested} tài khoản.`,
      })
      fetchUsers()
      fetchOverviewStats()
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message || 'Lỗi cấp tài khoản hàng loạt.' })
    } finally {
      setBatchLoading(false)
    }
  }

  // Sao chép danh sách cấp hàng loạt
  const handleCopyBatchResults = () => {
    if (!batchResults.length) return
    const text = batchResults
      .filter((u) => u.success)
      .map((u) => `${u.email}\t${u.password}\t${u.fullName}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopiedBatchList(true)
    setTimeout(() => setCopiedBatchList(false), 2000)
  }

  // Xuất file CSV
  const handleExportCsv = () => {
    if (!batchResults.length) return
    const header = 'Email,Mật khẩu,Họ và tên,Trạng thái\n'
    const rows = batchResults
      .map(
        (u) =>
          `"${u.email}","${u.password}","${u.fullName}","${
            u.success ? 'Thành công' : u.error || 'Lỗi'
          }"`
      )
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Danh_sach_tai_khoan_SenExam_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Xuất file TXT
  const handleExportTxt = () => {
    if (!batchResults.length) return
    const text = batchResults
      .map((u) => `Email: ${u.email} | MK: ${u.password} | Tên: ${u.fullName} | ${u.success ? 'OK' : 'LỖI'}`)
      .join('\r\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Danh_sach_tai_khoan_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Live preview cho batch provisioning
  const batchPreview = useMemo(() => {
    const start = parseInt(batchStartNum || '1', 10) || 1
    const end = parseInt(batchEndNum || '1', 10) || 1
    const pad = parseInt(batchPadLength || '4', 10) || 0
    let cleanDomain = (batchDomain || '').trim()
    if (cleanDomain && !cleanDomain.startsWith('@')) cleanDomain = '@' + cleanDomain
    if (!cleanDomain) cleanDomain = '@senexam.edu.vn'

    const formatNum = (num: number) => (pad > 0 ? String(num).padStart(pad, '0') : String(num))
    const firstNum = formatNum(start)
    const lastNum = formatNum(Math.max(start, end))
    const total = Math.max(0, end - start + 1)

    const firstEmail = `${batchPrefix.trim()}${firstNum}${cleanDomain}`.toLowerCase()
    const lastEmail = `${batchPrefix.trim()}${lastNum}${cleanDomain}`.toLowerCase()

    let samplePwd = ''
    if (batchPasswordMode === 'pattern') {
      samplePwd = `Sen@${firstNum}${new Date().getFullYear()}`
    } else if (batchPasswordMode === 'random') {
      samplePwd = `Sen#ab12${firstNum}`
    } else {
      samplePwd = batchCommonPassword.trim() || `SenExam@${firstNum}`
    }

    return { firstEmail, lastEmail, samplePwd, total }
  }, [
    batchPrefix,
    batchStartNum,
    batchEndNum,
    batchPadLength,
    batchDomain,
    batchPasswordMode,
    batchCommonPassword,
  ])

  // Cấp VIP trực tiếp cho người dùng đã chọn
  const handleGrantVip = async () => {
    if (!selectedUserForGrant) return
    setGrantActionLoading(true)
    try {
      const res = await fetch('/api/admin/grant-vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForGrant.id,
          days: parseInt(grantVipDays, 10),
          planTier: grantVipTier,
          note: 'Cấp qua Master Admin Dashboard',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Cấp VIP thất bại')
      setBannerMsg({ type: 'success', text: `✓ Cấp ${grantVipDays} ngày VIP thành công cho ${selectedUserForGrant.email}` })
      setSelectedUserForGrant(null)
      fetchUsers()
    } catch (e: any) {
      setBannerMsg({ type: 'error', text: e.message || 'Lỗi cấp VIP.' })
    } finally {
      setGrantActionLoading(false)
      setTimeout(() => setBannerMsg(null), 3000)
    }
  }

  // Tặng SenCash trực tiếp cho người dùng
  const handleGiftSenCash = async () => {
    if (!selectedUserForGrant) return
    setGrantActionLoading(true)
    try {
      const res = await fetch('/api/admin/gift-sencash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForGrant.id,
          amount: parseInt(grantSenCashAmount, 10),
          note: 'Tặng qua Master Admin Dashboard',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Tặng SenCash thất bại')
      setBannerMsg({ type: 'success', text: `✓ Đã tặng ${grantSenCashAmount} SC cho ${selectedUserForGrant.email}` })
      setSelectedUserForGrant(null)
      fetchUsers()
    } catch (e: any) {
      setBannerMsg({ type: 'error', text: e.message || 'Lỗi tặng SenCash.' })
    } finally {
      setGrantActionLoading(false)
      setTimeout(() => setBannerMsg(null), 3000)
    }
  }

  // Tạo Giftcode
  const handleCreateGiftcode = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeActionLoading(true)
    try {
      const payload: any = {
        rewardType: newCodeType,
        count: 1,
        note: newCodeNote,
        maxUses: parseInt(newCodeMaxUses, 10) || 1,
      }
      if (newCodeType === 'vip_days') {
        payload.vipDays = parseInt(newCodeAmount, 10)
      } else {
        payload.sencashAmount = parseInt(newCodeAmount, 10)
      }

      const res = await fetch('/api/admin/gift-codes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Tạo mã thất bại')
      setBannerMsg({ type: 'success', text: `✓ Đã tạo mã quà tặng: ${data.code || 'Thành công'}` })
      setGiftcodes((prev) => [data, ...prev])
    } catch (e: any) {
      setBannerMsg({ type: 'error', text: e.message || 'Lỗi tạo mã quà tặng.' })
    } finally {
      setCodeActionLoading(false)
      setTimeout(() => setBannerMsg(null), 3500)
    }
  }

  // Đổi mật khẩu Admin bảo mật cao (Xác thực Email 2 bước)
  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid) {
      setBannerMsg({ type: 'error', text: 'Vui lòng đáp ứng đầy đủ tất cả các yêu cầu bảo mật mật khẩu bên dưới.' })
      return
    }
    const adminEmail = currentUser?.email || 'admin@senexam.me'

    setSavingPassword(true)
    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/new-reset-password` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
        redirectTo: redirectUrl,
      })
      if (error) throw error

      setPasswordVerificationSent(true)
      setBannerMsg({
        type: 'success',
        text: `✓ Đã gửi email xác thực an toàn tới ${adminEmail}! Vui lòng kiểm tra hòm thư để hoàn tất đổi mật khẩu.`,
      })
      setResendCooldown(60)
    } catch (err: any) {
      setBannerMsg({ type: 'error', text: err.message || 'Gửi yêu cầu đổi mật khẩu thất bại.' })
    } finally {
      setSavingPassword(false)
    }
  }

  // Chọn danh mục và danh sách tính năng theo góc nhìn THẬT
  const activeCategories =
    perspective === 'student'
      ? STUDENT_ACTION_CATEGORIES
      : perspective === 'teacher'
      ? TEACHER_ACTION_CATEGORIES
      : ADMIN_ACTION_CATEGORIES

  const currentActionList =
    perspective === 'student'
      ? STUDENT_ACTIONS
      : perspective === 'teacher'
      ? TEACHER_ACTIONS
      : ADMIN_ACTIONS

  const filteredActionList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return currentActionList
    return currentActionList.filter(
      (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [currentActionList, searchQuery])

  // Lọc Sessions
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions
    const q = sessionSearch.toLowerCase()
    return sessions.filter(
      (s) =>
        s.user_email?.toLowerCase().includes(q) ||
        s.device_name?.toLowerCase().includes(q) ||
        s.ip_address?.includes(q)
    )
  }, [sessions, sessionSearch])

  // Lọc Exams
  const filteredExams = useMemo(() => {
    if (!examSearch.trim()) return exams
    const q = examSearch.toLowerCase()
    return exams.filter(
      (e) => e.title?.toLowerCase().includes(q) || e.exam_type?.toLowerCase().includes(q)
    )
  }, [exams, examSearch])

  // Lọc Users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(
      (u) => u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  // ANIMATION LOADING HIỆN ĐẠI, MƯỢT MÀ VÀ TỐI ƯU TỐC ĐỘ (KHÔNG BAO GIỜ BỊ ĐƠ)
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#0B1120] text-[#2B2B2B] dark:text-slate-100 transition-colors">
        <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-2xl max-w-sm w-full mx-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 sen-loading-glow opacity-80 blur-xs" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-2xl shadow-md">
              S
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/40 sen-loading-spinner pointer-events-none" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-black text-base text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
              SenExam IDP Master 2.0
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Đang tối ưu bảo mật & kiểm tra phiên quản trị...
            </p>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden relative">
            <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 rounded-full sen-loading-shimmer" />
          </div>
        </div>
      </div>
    )
  }

  const themeVars = getModernThemeVars(themeColor || 'indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 12% 8%, rgba(56, 189, 248, 0.15), transparent 35%), radial-gradient(circle at 88% 12%, rgba(168, 85, 247, 0.15), transparent 28%), radial-gradient(circle at 80% 75%, rgba(99, 102, 241, 0.18), transparent 32%), var(--bg)'
          : 'radial-gradient(circle at 12% 8%, rgba(255, 187, 120, 0.45), transparent 35%), radial-gradient(circle at 88% 12%, rgba(94, 234, 212, 0.34), transparent 28%), radial-gradient(circle at 80% 75%, rgba(129, 140, 248, 0.32), transparent 32%), var(--bg)',
      }}
    >
      {/* ======================================================== */}
      {/* BANNER THÔNG BÁO GÓC NHÌN XEM THỬ (KHI KHÔNG PHẢI ADMIN) */}
      {/* ======================================================== */}
      {perspective !== 'admin' && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white px-4 py-2.5 shadow-lg backdrop-blur-md flex items-center justify-between text-xs font-bold animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 animate-pulse" />
            <span>
              Đang trải nghiệm góc nhìn THẬT:{' '}
              <strong className="uppercase underline">
                {perspective === 'student' ? 'Góc nhìn Sinh viên / Học sinh' : 'Góc nhìn Giảng viên / Giáo viên'}
              </strong>{' '}
              (Mọi tính năng hoạt động thực tế 100%)
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSwitchPerspective('admin')}
            className="px-3 py-1 rounded-xl bg-white text-slate-900 font-black text-[11px] shadow-sm hover:bg-slate-100 transition cursor-pointer"
          >
            ← Quay lại Góc nhìn Master Admin
          </button>
        </div>
      )}

      {/* BANNER PHẢN HỒI THAO TÁC */}
      {bannerMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom-3 ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-500/90 text-white border-emerald-400'
              : 'bg-rose-500/90 text-white border-rose-400'
          }`}
        >
          {bannerMsg.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{bannerMsg.text}</span>
        </div>
      )}

      <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-4 sm:pt-6 sm:px-6 lg:px-8">
        {/* ========================================================================= */}
        {/* GIAO DIỆN MOBILE TỐI ƯU CHO ĐIỆN THOẠI (block md:hidden)                 */}
        {/* ========================================================================= */}
        <div className="block md:hidden space-y-4 pb-6">
          {/* 1. Header Mobile */}
          <div className="flex items-center justify-between gap-2 pt-1 pb-1">
            <Link href="/new-profile" className="flex items-center gap-2.5 group min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white font-black text-sm shadow-md group-hover:scale-105 transition">
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span
                  className="text-sm font-black text-slate-900 dark:text-white block truncate max-w-[130px]"
                  style={{ fontFamily: 'var(--font-newdash-heading)' }}
                >
                  {userProfile?.full_name || 'Admin'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block truncate">
                  Master Administrator
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-600 dark:text-amber-400 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>ROOT ADMIN</span>
              </span>

              <button
                type="button"
                onClick={() => scrollToWorkbench('sessions')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 shadow-xs active:scale-95 transition"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{stats.totalSessions} Phiên</span>
              </button>
            </div>
          </div>

          {/* 2. Ô Chào Buổi & Thống Kê Mobile */}
          <div className="relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4.5 shadow-sm">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full pointer-events-none opacity-30 bg-[radial-gradient(circle,rgba(244,63,94,0.3)_0%,transparent_70%)]" />
            <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full pointer-events-none opacity-30 bg-[radial-gradient(circle,rgba(20,184,166,0.25)_0%,transparent_70%)]" />

            <div className="relative">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>IDP 2.0 ROOT</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  • Góc nhìn: {perspective.toUpperCase()}
                </span>
              </div>

              <h2
                className="mt-2 text-xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-newdash-heading)' }}
              >
                {greeting}, {userProfile?.full_name || 'Admin'}! 👋
              </h2>

              <p className="mt-1 text-xs text-[#4B5563] dark:text-slate-300 font-medium leading-relaxed">
                Hệ thống đang bảo vệ an toàn cho {stats.totalUsers} thành viên và {stats.totalExams} bộ đề thi.
              </p>

              {/* 3 Thẻ Metric Mobile */}
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => scrollToWorkbench('users')}
                  className="rounded-2xl border border-black/5 dark:border-white/5 bg-amber-500/10 dark:bg-amber-500/15 p-2.5 text-center active:scale-95 transition"
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    <Users className="h-3 w-3 text-amber-500" /> Thành viên
                  </div>
                  <p
                    className="mt-1 text-base font-black text-amber-900 dark:text-amber-200"
                    style={{ fontFamily: 'var(--font-newdash-heading)' }}
                  >
                    {stats.totalUsers}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => scrollToWorkbench('exams')}
                  className="rounded-2xl border border-black/5 dark:border-white/5 bg-teal-500/10 dark:bg-teal-500/15 p-2.5 text-center active:scale-95 transition"
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                    <FileText className="h-3 w-3 text-teal-500" /> Đề thi
                  </div>
                  <p
                    className="mt-1 text-base font-black text-teal-900 dark:text-teal-200"
                    style={{ fontFamily: 'var(--font-newdash-heading)' }}
                  >
                    {stats.totalExams}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => scrollToWorkbench('sessions')}
                  className="rounded-2xl border border-black/5 dark:border-white/5 bg-indigo-500/10 dark:bg-indigo-500/15 p-2.5 text-center active:scale-95 transition"
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    <Smartphone className="h-3 w-3 text-indigo-500" /> Phiên
                  </div>
                  <p
                    className="mt-1 text-base font-black text-indigo-900 dark:text-indigo-200"
                    style={{ fontFamily: 'var(--font-newdash-heading)' }}
                  >
                    {stats.totalSessions}
                  </p>
                </button>
              </div>

              {/* Thanh Progress An Ninh */}
              <div className="mt-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-600 dark:text-slate-400">Chỉ số an toàn bảo mật IDP</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">100% An toàn</span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10 p-0.5">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 shadow-[0_0_12px_rgba(16,185,129,0.5)] w-full" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Phím Tắt Nhanh Đến Bàn Làm Việc Quản Trị Dưới Web */}
          <button
            type="button"
            onClick={() => scrollToWorkbench('sessions')}
            className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-gradient-to-r from-indigo-500/15 via-rose-500/15 to-amber-500/15 border border-indigo-500/20 text-slate-900 dark:text-white shadow-xs active:scale-[0.99] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-rose-600 text-white shadow-sm shrink-0">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                  Bàn Làm Việc Quản Trị Chuyên Sâu
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Cấp tài khoản 0001-9999, quản lý phiên, duyệt đề thi và phân quyền
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />
          </button>

          {/* 4. Bộ Chuyển Đổi Góc Nhìn Trên Mobile */}
          <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4 shadow-sm space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
              <Eye className="h-4 w-4 text-indigo-500" />
              <span>Góc nhìn Trải nghiệm</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
              <button
                type="button"
                onClick={() => handleSwitchPerspective('admin')}
                className={`py-2 text-[11px] font-black rounded-xl transition cursor-pointer ${
                  perspective === 'admin'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPerspective('student')}
                className={`py-2 text-[11px] font-black rounded-xl transition cursor-pointer ${
                  perspective === 'student'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                🎓 Sinh viên
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPerspective('teacher')}
                className={`py-2 text-[11px] font-black rounded-xl transition cursor-pointer ${
                  perspective === 'teacher'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                💼 Giảng viên
              </button>
            </div>
          </div>

          {/* 5. Thẻ Liên Kết Google Mobile */}
          <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <h3 className="font-black text-xs text-slate-900 dark:text-white">Tài khoản Google</h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${linkedGoogle ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                {linkedGoogle ? '✓ Đã liên kết' : 'Chưa liên kết'}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
              {linkedGoogle
                ? 'Đã kết nối tài khoản Google. Bạn có thể đăng nhập 1-chạm an toàn mọi lúc mọi nơi.'
                : 'Liên kết Google để đăng nhập tức thì chỉ 1 click, không lo quên mật khẩu.'}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLinkGoogle}
                disabled={googleLinkingLoading || linkedGoogle}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-2 text-xs font-black shadow-xs transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {googleLinkingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : linkedGoogle ? 'Đã liên kết Google' : 'Liên kết tài khoản Google'}
              </button>
            </div>
          </div>

          {/* 6. Thẻ Sen 2FA Mobile NẰM DƯỚI LIÊN KẾT GOOGLE */}
          <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h3 className="font-black text-xs text-slate-900 dark:text-white">Bảo mật Sen 2FA</h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${hasMfaEnrolled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                {hasMfaEnrolled ? '✓ Đã kích hoạt' : 'Chưa kích hoạt'}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
              {hasMfaEnrolled
                ? 'Tài khoản được bảo vệ vững chắc bởi mã 6 số TOTP qua Google Authenticator hoặc Apple Passwords.'
                : 'Bảo vệ tài khoản và bài thi chống xâm nhập trái phép bằng mã xác thực 2 bước Sen 2FA.'}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMfa}
                disabled={mfaLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-2 text-xs font-black shadow-xs transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {mfaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasMfaEnrolled ? 'Quản lý / Tắt Sen 2FA' : 'Kích hoạt Sen 2FA ngay'}
              </button>
            </div>
          </div>

          {/* Thẻ Đổi Mật Khẩu Riêng Biệt Trên Mobile NẰM DƯỚI SEN 2FA */}
          <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-xs">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white">
                    Đổi Mật Khẩu Bảo Mật
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Xác thực email 2 bước • Chuẩn an toàn 2026
                  </p>
                </div>
              </div>
            </div>

            {passwordVerificationSent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-black">Chờ xác thực email để hoàn tất đổi mật khẩu!</p>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      Hệ thống đã gửi liên kết xác nhận bảo mật đến <strong>{currentUser?.email || 'admin@senexam.me'}</strong>. Vui lòng mở email và nhấn vào liên kết xác nhận để hoàn toàn đổi mật khẩu sang. Mật khẩu cũ của bạn vẫn được bảo vệ cho đến khi bạn xác nhận qua email.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleRequestPasswordChange}
                    disabled={resendCooldown > 0 || savingPassword}
                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại email xác thực'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordVerificationSent(false)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Nhập lại mật khẩu
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestPasswordChange} className="space-y-2.5">
                {/* Mật khẩu mới */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới..."
                      className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2 pl-3 pr-8 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPasswordText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPasswordText ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới..."
                      className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2 pl-3 pr-8 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPasswordText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Tiêu chí bảo mật mật khẩu (Security Checklist) */}
                <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-2.5 space-y-1">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Yêu cầu bảo mật tài khoản:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                      {hasMinLength ? <Check className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                      Tối thiểu 8 ký tự
                    </div>
                    <div className={`flex items-center gap-1 ${hasUpperCase && hasLowerCase ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                      {hasUpperCase && hasLowerCase ? <Check className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                      Chữ hoa & thường
                    </div>
                    <div className={`flex items-center gap-1 ${hasNumberOrSpecial ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                      {hasNumberOrSpecial ? <Check className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                      Có số / ký tự đặc biệt
                    </div>
                    <div className={`flex items-center gap-1 ${isPasswordMatched ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                      {isPasswordMatched ? <Check className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                      Khớp mật khẩu
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword || !isPasswordValid}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-xs py-2.5 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang gửi xác thực...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Xác Nhận & Gửi Email Đổi Mật Khẩu</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* 7. Cài Đặt Web Mobile */}
          <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4.5 shadow-sm space-y-3.5">
            <h3 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-amber-500" /> Cài đặt & Tiện ích Quản trị
            </h3>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Giao diện:</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Chế độ sáng hoặc tối</p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-bold transition"
              >
                {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                <span>{isDark ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>
              </button>
            </div>

            {/* Phiên bản hệ thống web */}
            <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Phiên bản Web:</p>
                  <span className="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 text-[9px] font-black uppercase">
                    Build
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Nhấn vào số phiên bản để xem chi tiết build
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullVersion(!showFullVersion)}
                title="Bấm để chuyển đổi mã build phiên bản"
                className="font-mono text-xs font-black px-2.5 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95 select-all"
              >
                {showFullVersion ? '2.0.2194023.4923.01' : '2.0'}
              </button>
            </div>

            <div className="pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 py-2 text-xs font-bold transition border border-rose-500/20 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" /> Đăng xuất khỏi hệ thống
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* GIAO DIỆN DESKTOP TOÀN DIỆN (hidden md:block)                             */}
        {/* ========================================================================= */}
        <div className="hidden md:block">
          {/* BRANDING NHẬN DIỆN THƯƠNG HIỆU & HẠNG ĐẶT NGOÀI KHUNG THẺ */}
          <div className="mb-3.5 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 dark:bg-rose-500/20 border border-rose-500/30 text-rose-900 dark:text-rose-300 backdrop-blur-md shadow-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="tracking-widest">MASTER ADMIN • ROOT PRIVILEGES</span>
              </span>

              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-400/25 via-pink-400/25 to-indigo-500/25 dark:from-amber-500/20 dark:via-pink-500/20 dark:to-indigo-500/20 border border-amber-500/40 text-amber-950 dark:text-amber-200">
                <span className="bg-gradient-to-r from-amber-700 via-rose-600 to-indigo-600 dark:from-amber-300 dark:via-rose-300 dark:to-indigo-300 bg-clip-text text-transparent font-black tracking-widest">
                  SEN ONE
                </span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> IDP 2.0 Security
              </span>
            </div>

            {/* Perspective Quick Pill */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Góc nhìn:</span>
              <div className="inline-flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective('admin')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                    perspective === 'admin'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective('student')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                    perspective === 'student'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  🎓 Sinh viên (Thật)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective('teacher')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                    perspective === 'teacher'
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  💼 Giảng viên (Thật)
                </button>
              </div>
            </div>
          </div>

          {/* Banner Chào Mừng & Thống Kê Tổng Quan */}
          <div className="relative overflow-hidden rounded-[30px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 shadow-sm sm:p-8">
            <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full pointer-events-none opacity-30 bg-[radial-gradient(circle,rgba(244,63,94,0.3)_0%,transparent_70%)]" />
            <div className="absolute -left-12 bottom-0 h-40 w-40 rounded-full pointer-events-none opacity-30 bg-[radial-gradient(circle,rgba(20,184,166,0.25)_0%,transparent_70%)]" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1
                  className="text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl"
                  style={{ fontFamily: 'var(--font-newdash-heading)' }}
                >
                  {greeting}, {userProfile?.full_name || 'Master Admin'}! 👋
                </h1>
                <p
                  className="mt-2 text-sm text-[#4B5563] dark:text-slate-300 sm:text-base max-w-2xl"
                  style={{ fontFamily: 'var(--font-newdash-body)' }}
                >
                  {perspective === 'student'
                    ? 'Đang mô phỏng môi trường học tập THẬT của thí sinh. Tất cả kho đề, tính điểm, phòng đọc và SenAI đều hoạt động thực tế.'
                    : perspective === 'teacher'
                    ? 'Đang mô phỏng môi trường giảng dạy THẬT của giáo viên. Các công cụ soạn đề, tạo phòng SEB và quản lý lớp đều liên kết trực tiếp.'
                    : 'Trung tâm điều hành IDP, phân quyền người dùng và giám sát toàn diện hệ thống SenExam. Đồng bộ phiên và cấp phát tài khoản tự động.'}
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
                <button
                  type="button"
                  onClick={() => scrollToWorkbench('sessions')}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-3.5 shadow-sm text-left hover:scale-[1.03] active:scale-95 transition cursor-pointer group"
                  title="Nhấn để xem danh sách phiên đang hoạt động"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-emerald-500" /> Phiên Đang Mở
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 underline group-hover:scale-105 transition">
                      Quản lý →
                    </span>
                  </div>
                  <p
                    className="mt-1 text-2xl font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-newdash-heading)' }}
                  >
                    {stats.totalSessions} Phiên
                  </p>
                </button>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    <ShieldCheck className="h-4 w-4" /> Trạng Thái
                  </div>
                  <p className="mt-1 text-lg font-black truncate" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                    Root Admin
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    Master Privileges
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Metric Cards */}
            <div className="relative mt-6 grid gap-3.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => scrollToWorkbench('users')}
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-amber-500/10 dark:bg-amber-500/15 p-4 transition hover:scale-[1.02] cursor-pointer group text-left"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Tổng Thành Viên IDP
                  </p>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
                    Xem danh sách →
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                    {stats.totalUsers.toLocaleString()}
                  </strong>
                  <Users className="h-7 w-7 text-amber-600 dark:text-amber-400 opacity-80" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => scrollToWorkbench('exams')}
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-teal-500/10 dark:bg-teal-500/15 p-4 transition hover:scale-[1.02] cursor-pointer group text-left"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    Ngân Hàng Kho Đề Thi
                  </p>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 group-hover:underline">
                    Quản lý kho đề →
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                    {stats.totalExams.toLocaleString()}
                  </strong>
                  <FileText className="h-7 w-7 text-teal-600 dark:text-teal-400 opacity-80" />
                </div>
              </button>

              <Link
                href="/new-history-submissions"
                className="rounded-2xl border border-black/10 dark:border-white/10 bg-indigo-500/10 dark:bg-indigo-500/15 p-4 transition hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                    Lượt Thi Toàn Hệ Thống
                  </p>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    Xem bài nộp →
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-3xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                    {stats.totalSubmissions.toLocaleString()}
                  </strong>
                  <TrendingUp className="h-7 w-7 text-indigo-600 dark:text-indigo-400 opacity-80" />
                </div>
              </Link>
            </div>
          </div>

          {/* 2-Column Main Layout */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
            {/* CỘT TRÁI: Playground Điều Hướng Tính Năng Đồng Nhất New-Dashboard */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                    {perspective === 'student'
                      ? 'Không gian học tập & Tính năng THẬT'
                      : perspective === 'teacher'
                      ? 'Không gian Giảng viên & Khảo thí THẬT'
                      : 'Không gian Quản trị & Điều phối Hệ thống'}
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-slate-300" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                    {perspective === 'admin'
                      ? 'Khám phá các phân hệ bảo mật, quản lý tài khoản, khảo thí và tiện ích toàn hệ thống.'
                      : 'Toàn bộ tính năng đều là ứng dụng THẬT từ SenExam Dashboard, liên kết đầy đủ dữ liệu.'}
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Compass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280] dark:text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh tính năng, đề thi, AI..."
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-9 pr-3 text-sm outline-none transition focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>
              </div>

              {/* CÁC PHẦN CHIA NGANG (VẼ ĐƯỜNG CHIA NGHỆ THUẬT) */}
              <div className="mt-4 space-y-6">
                {activeCategories.map((cat) => {
                  const groupItems = filteredActionList.filter((a) => a.category === cat.key)
                  if (groupItems.length === 0) return null

                  const catTheme =
                    cat.key === 'admin_core'
                      ? {
                          line: 'from-rose-500/50 via-rose-500/20 to-transparent',
                          badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                        }
                      : cat.key === 'study'
                      ? {
                          line: 'from-emerald-500/50 via-emerald-500/20 to-transparent',
                          badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                        }
                      : cat.key === 'math_exam'
                      ? {
                          line: 'from-sky-500/50 via-sky-500/20 to-transparent',
                          badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
                        }
                      : cat.key === 'senai'
                      ? {
                          line: 'from-purple-500/50 via-purple-500/20 to-transparent',
                          badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
                        }
                      : {
                          line: 'from-pink-500/50 via-pink-500/20 to-transparent',
                          badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20',
                        }

                  return (
                    <div key={cat.key} className="space-y-3">
                      {/* VẼ ĐƯỜNG CHIA PHÂN HỆ NGHỆ THUẬT */}
                      <div className="relative flex items-center gap-3 pt-3 pb-1">
                        <div className="flex items-center gap-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 px-3.5 py-1.5 shadow-xs">
                          <span className="text-lg">{cat.icon}</span>
                          <h3
                            className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider"
                            style={{ fontFamily: 'var(--font-newdash-heading)' }}
                          >
                            {cat.label}
                          </h3>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${catTheme.badge}`}>
                            {groupItems.length}
                          </span>
                        </div>
                        <div className={`flex-1 h-0.5 rounded-full bg-gradient-to-r ${catTheme.line}`} />
                      </div>

                      {/* CÁC THẺ TÍNH NĂNG GIỮ NGUYÊN FORM DÁNG NEW-DASHBOARD */}
                      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                        {groupItems.map((item) => {
                          const Icon = item.icon
                          const isAnchorOrScroll = Boolean(item.actionTab)
                          const isExternal = Boolean(item.href?.startsWith('http'))

                          const handleClick = (e: React.MouseEvent) => {
                            if (isAnchorOrScroll) {
                              e.preventDefault()
                              scrollToWorkbench(item.actionTab)
                            }
                          }

                          const Wrapper = isAnchorOrScroll ? 'div' : isExternal ? 'a' : Link
                          const extraProps = isAnchorOrScroll
                            ? { onClick: handleClick }
                            : isExternal
                            ? { href: item.href!, target: '_blank', rel: 'noopener noreferrer' }
                            : { href: item.href || '#' }

                          return (
                            <Wrapper
                              key={item.key}
                              {...(extraProps as any)}
                              className="newdash-card group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 p-4 cursor-pointer block"
                            >
                              {/* Dải gradient nhận diện trên đỉnh thẻ */}
                              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />

                              <div className="flex items-start justify-between gap-3">
                                <span className="rounded-xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-700/80 p-2.5 shadow-sm group-hover:scale-105 transition-transform">
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

                              <h3
                                className="mt-3 text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white"
                                style={{ fontFamily: 'var(--font-newdash-heading)' }}
                              >
                                {item.title}
                              </h3>
                              <p
                                className="mt-1 text-xs leading-relaxed text-[#4B5563] dark:text-slate-300 font-medium"
                                style={{ fontFamily: 'var(--font-newdash-body)' }}
                              >
                                {item.description}
                              </p>
                            </Wrapper>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {filteredActionList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-800/50 p-6 text-center text-sm text-[#4B5563] dark:text-slate-400 font-bold">
                    Không tìm thấy tính năng nào khớp với từ khoá &quot;{searchQuery}&quot;. Vui lòng thử từ khoá khác!
                  </div>
                )}
              </div>
            </div>

            {/* CỘT PHẢI: Hồ Sơ Admin, Bộ Chuyển Góc Nhìn, Giám Sát An Ninh, Google, Sen 2FA & Cài Đặt */}
            <aside className="space-y-5">
              {/* Card 1: Hồ sơ & Trạng Thái Theo Góc Nhìn */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md">
                      {perspective === 'student' ? (
                        <GraduationCap className="h-6 w-6" />
                      ) : perspective === 'teacher' ? (
                        <Briefcase className="h-6 w-6" />
                      ) : (
                        <Crown className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h3
                        className="font-black text-lg leading-tight"
                        style={{ fontFamily: 'var(--font-newdash-heading)' }}
                      >
                        {userProfile?.full_name || 'Master Admin'}
                      </h3>
                      <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate max-w-[170px]">
                        {currentUser?.email || 'admin@senexam.me'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black border ${
                      perspective === 'student'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        : perspective === 'teacher'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {perspective === 'student' ? 'Học sinh' : perspective === 'teacher' ? 'Giáo viên' : 'Toàn Quyền'}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs text-[#4B5563] dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>
                      Vai trò thực:{' '}
                      <strong>
                        {perspective === 'student'
                          ? 'Mô phỏng Thí sinh (Student View)'
                          : perspective === 'teacher'
                          ? 'Mô phỏng Giảng viên (Teacher View)'
                          : 'Quản trị viên Cấp cao (Root)'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span>Máy chủ IDP: <strong>Cloud Supabase (AP-East)</strong></span>
                  </div>
                </div>

                {/* 3 Nút Hành Động Nhanh */}
                <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-black/10 dark:border-white/10">
                  <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-2.5">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Tổng SC</span>
                    </div>
                    <div className="mt-2">
                      <strong
                        className="text-sm font-black text-amber-900 dark:text-amber-200 block truncate"
                        style={{ fontFamily: 'var(--font-newdash-heading)' }}
                      >
                        {stats.totalSenCash.toLocaleString()} SC
                      </strong>
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Lưu hành</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/15 p-2.5">
                    <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                      <Crown className="h-4 w-4 text-rose-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Trạng thái</span>
                    </div>
                    <div className="mt-2">
                      <strong
                        className="text-sm font-black text-rose-900 dark:text-rose-200 block truncate"
                        style={{ fontFamily: 'var(--font-newdash-heading)' }}
                      >
                        {perspective.toUpperCase()}
                      </strong>
                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">Đang bật</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToWorkbench('sessions')}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/15 p-2.5 transition hover:scale-[1.02] text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                      <Smartphone className="h-4 w-4 text-emerald-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Phiên Mở</span>
                    </div>
                    <div className="mt-2">
                      <strong
                        className="text-sm font-black text-emerald-900 dark:text-emerald-200 block truncate"
                        style={{ fontFamily: 'var(--font-newdash-heading)' }}
                      >
                        {stats.totalSessions} Phiên
                      </strong>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 underline">
                        Chi tiết →
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Card 2: Góc Nhìn Trải Nghiệm (Perspective Switcher) */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Eye className="h-4 w-4 text-indigo-500" /> Góc Nhìn Trải Nghiệm THẬT
                  </h3>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Thời gian thực</span>
                </div>
                <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
                  Chuyển đổi góc nhìn để trực tiếp trải nghiệm và kiểm tra mọi tính năng như học sinh và giáo viên.
                </p>

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchPerspective('admin')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      perspective === 'admin'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span>Góc nhìn Quản trị viên (Master Admin)</span>
                    </span>
                    {perspective === 'admin' && <Check className="h-4 w-4 text-amber-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchPerspective('student')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      perspective === 'student'
                        ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-indigo-500" />
                      <span>Góc nhìn Sinh viên (Chạy tính năng thật)</span>
                    </span>
                    {perspective === 'student' && <Check className="h-4 w-4 text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchPerspective('teacher')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      perspective === 'teacher'
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 shadow-xs'
                        : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-500" />
                      <span>Góc nhìn Giảng viên (Khảo thí & SEB thật)</span>
                    </span>
                    {perspective === 'teacher' && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                </div>
              </div>

              {/* Card 3: Giám Sát An Ninh & Hệ Thống (System Health) */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Activity className="h-4 w-4 text-emerald-500" /> Giám Sát Hệ Thống
                  </h3>
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>100% Operational</span>
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                    <span className="text-slate-600 dark:text-slate-400">Supabase Cloud Database</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Hoạt động (99.9%)</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                    <span className="text-slate-600 dark:text-slate-400">Row-Level Security (RLS)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Kích hoạt chặt chẽ</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                    <span className="text-slate-600 dark:text-slate-400">Trí tuệ nhân tạo SenAI</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Gemini 3.5 & 3.8</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                    <span className="text-slate-600 dark:text-slate-400">Safe Exam Browser Gateway</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">SEB Proctor Ready</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Liên Kết Tài Khoản Google */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm">
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
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-black/15 dark:border-white/15 px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white shadow-sm transition hover:bg-black/5 disabled:opacity-50 cursor-pointer"
                  >
                    {googleLinkingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : linkedGoogle ? 'Đã liên kết thành công' : 'Liên kết tài khoản Google'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                    aria-label="Xem lợi ích bảo mật"
                    className="rounded-xl border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-2 text-xs font-bold transition hover:bg-black/10 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>

                {showGoogleGuide && (
                  <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-[#4B5563] dark:text-slate-300 space-y-2 animate-in fade-in zoom-in-95">
                    <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500" /> Lợi ích khi liên kết Google:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                      <li>Đăng nhập tức thì 1-chạm không cần nhập mật khẩu.</li>
                      <li>Bảo mật tài khoản 2 lớp chuẩn Google Security.</li>
                      <li>Tự động đồng bộ quyền Master Admin trên mọi thiết bị.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 5: Cài Đặt Sen 2FA NẰM DƯỚI LIÊN KẾT GOOGLE */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-bold text-sm">Bảo mật Sen 2FA (Authenticator)</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${hasMfaEnrolled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                    {hasMfaEnrolled ? '✓ Đã kích hoạt' : 'Chưa kích hoạt'}
                  </span>
                </div>

                <p className="mt-2 text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  {hasMfaEnrolled
                    ? 'Tài khoản Root Admin đã được bảo vệ tối cao bằng mã xác thực 2 bước TOTP. Ngăn chặn 100% rủi ro chiếm đoạt tài khoản.'
                    : 'Kích hoạt Sen 2FA với Google Authenticator hoặc Microsoft Authenticator để bảo vệ quyền quản trị.'}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMfa}
                    disabled={mfaLoading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-black/15 dark:border-white/15 px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white shadow-sm transition hover:bg-black/5 disabled:opacity-50 cursor-pointer"
                  >
                    {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasMfaEnrolled ? 'Quản lý / Tắt Sen 2FA' : 'Kích hoạt Sen 2FA ngay'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMfaGuide(!showMfaGuide)}
                    aria-label="Xem lợi ích bảo mật Sen 2FA"
                    className="rounded-xl border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-2 text-xs font-bold transition hover:bg-black/10 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>

                {showMfaGuide && (
                  <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-[#4B5563] dark:text-slate-300 space-y-2 animate-in fade-in zoom-in-95">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" /> Chuẩn bảo mật Sen 2FA:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                      <li>Mã xác thực 6 số đổi liên tục mỗi 30 giây theo tiêu chuẩn RFC 6238 TOTP.</li>
                      <li>Hoạt động an toàn ngoại tuyến ngay cả khi mất sóng Internet.</li>
                      <li>Khuyến nghị bắt buộc cho các tài khoản Quản trị viên cấp cao.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 5.5: Thẻ Đổi Mật Khẩu Riêng Biệt (Dưới 2FA, Bảo Mật Cao Cấp) */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-xs">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Đổi Mật Khẩu Bảo Mật
                      </h3>
                      <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                        Xác thực email 2 bước • Chuẩn an toàn 2026
                      </p>
                    </div>
                  </div>
                </div>

                {passwordVerificationSent ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2.5 animate-in fade-in">
                    <div className="flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
                      <div className="space-y-1">
                        <p className="text-xs font-black">Chờ xác thực email để hoàn tất đổi mật khẩu!</p>
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          Hệ thống đã gửi liên kết xác nhận bảo mật đến <strong>{currentUser?.email || 'admin@senexam.me'}</strong>. Vui lòng mở email và bấm vào liên kết xác nhận để hoàn toàn đổi sang mật khẩu mới. Mật khẩu cũ của bạn vẫn có hiệu lực cho đến khi bạn xác nhận qua email.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleRequestPasswordChange}
                        disabled={resendCooldown > 0 || savingPassword}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại email xác thực'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordVerificationSent(false)
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Nhập lại mật khẩu
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequestPasswordChange} className="space-y-3">
                    {/* Mật khẩu mới */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswordText ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Nhập mật khẩu mới..."
                          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2 pl-3 pr-8 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPasswordText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Xác nhận mật khẩu mới */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPasswordText ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới..."
                          className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] py-2 pl-3 pr-8 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showConfirmPasswordText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Tiêu chí bảo mật mật khẩu (Security Checklist) */}
                    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Yêu cầu an toàn tài khoản:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                          Tối thiểu 8 ký tự
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasUpperCase && hasLowerCase ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {hasUpperCase && hasLowerCase ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                          Chữ hoa & thường
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumberOrSpecial ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {hasNumberOrSpecial ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                          Có số / ký tự đặc biệt
                        </div>
                        <div className={`flex items-center gap-1.5 ${isPasswordMatched ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {isPasswordMatched ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                          Khớp mật khẩu
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPassword || !isPasswordValid}
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-xs py-2.5 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang gửi email xác nhận...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4" />
                          <span>Xác Nhận & Gửi Email Đổi Mật Khẩu</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Card 6: Cài Đặt Web & Hệ Thống (Settings) */}
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-5 shadow-sm space-y-3.5">
                <h3 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Settings className="h-3.5 w-3.5 text-amber-500" /> Cài Đặt Web & Hệ Thống
                </h3>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Giao diện Sáng / Tối:</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tùy chỉnh chế độ nền hiển thị
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-bold transition hover:bg-black/10 cursor-pointer"
                  >
                    {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                    <span>{isDark ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>
                  </button>
                </div>

                {/* Phiên bản hệ thống web (thế chỗ cho đổi mật khẩu cũ) */}
                <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Phiên bản Web:</p>
                      <span className="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 text-[9px] font-black uppercase">
                        Build
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Nhấn vào số phiên bản để xem chi tiết build
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFullVersion(!showFullVersion)}
                    title="Bấm để chuyển đổi mã build phiên bản"
                    className="font-mono text-xs font-black px-2.5 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95 select-all"
                  >
                    {showFullVersion ? '2.0.2194023.4923.01' : '2.0'}
                  </button>
                </div>

                <div className="pt-2 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 py-2 text-xs font-bold transition border border-rose-500/20 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Đăng xuất khỏi tài khoản
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PHẦN ĐIỀU PHỐI CHUYÊN SÂU DÀNH CHO ADMIN ("ĐỂ XUỐNG WEB - CĂN RA GIỮA")    */}
        {/* Canh giữa (mx-auto max-w-5xl) theo đúng yêu cầu người dùng                */}
        {/* ========================================================================= */}
        <div id="admin-workbench" className="mt-12 mx-auto w-full max-w-5xl space-y-6">
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 sm:p-8 shadow-sm">
            {/* Header Căn Giữa */}
            <div className="text-center max-w-2xl mx-auto space-y-2 border-b border-black/10 dark:border-white/10 pb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-black uppercase tracking-wider">
                <Sliders className="h-4 w-4" />
                <span>Trung Tâm Quản Trị Chuyên Sâu</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-newdash-heading)' }}
              >
                Bàn Làm Việc Điều Hành Hệ Thống
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                Khu vực giám sát phiên làm việc thực tế, cấp tài khoản hàng loạt & đơn lẻ, duyệt kho đề thi, phân
                quyền thành viên và phát hành mã quà tặng.
              </p>
            </div>

            {/* TAB SELECTOR CĂN RA GIỮA */}
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap pb-2">
              {[
                { id: 'sessions', label: 'Quản Lý Phiên', count: stats.totalSessions, icon: Smartphone },
                { id: 'batch_provision', label: 'Cấp Hàng Loạt 0001-9999', icon: Users },
                { id: 'single_provision', label: 'Cấp 1 Tài Khoản', icon: UserPlus },
                { id: 'exams', label: 'Quản Trị Kho Đề', count: stats.totalExams, icon: FileText },
                { id: 'users', label: 'Phân Quyền Người Dùng', count: stats.totalUsers, icon: ShieldCheck },
                { id: 'giftcodes', label: 'Mã Quà Tặng Giftcode', icon: Gift },
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = workbenchTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkbenchTab(tab.id as AdminWorkbenchTab)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-[1.02]'
                        : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white dark:bg-black/10 dark:text-slate-900'
                            : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* NỘI DUNG TỪNG TAB TRONG BÀN LÀM VIỆC CĂN GIỮA */}
            <div className="mt-6 max-w-4xl mx-auto">
              {/* TAB 1: QUẢN LÝ PHIÊN (SESSIONS) */}
              {workbenchTab === 'sessions' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm theo email người dùng, tên thiết bị, hoặc địa chỉ IP..."
                        value={sessionSearch}
                        onChange={(e) => setSessionSearch(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-2.5 pl-10 pr-4 text-xs font-semibold outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={fetchSessions}
                      disabled={sessionsLoading}
                      className="px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                      <span>Làm mới danh sách</span>
                    </button>
                  </div>

                  {sessionsLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải danh sách phiên...
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Chưa ghi nhận phiên làm việc nào hoặc không tìm thấy kết quả phù hợp.
                    </div>
                  ) : (
                    <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                      {filteredSessions.map((s) => (
                        <div
                          key={s.id || s.device_id}
                          className="p-4 flex items-center justify-between flex-wrap gap-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              {s.device_type === 'mobile' ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{s.device_name}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    s.is_active
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-slate-500/10 text-slate-500'
                                  }`}
                                >
                                  {s.is_active ? '● Đang hoạt động' : 'Đã thu hồi'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Tài khoản: <strong>{s.user_email}</strong> ({s.user_full_name || 'Học sinh'}) • IP:{' '}
                                <code>{s.ip_address}</code> • HĐH: {s.os} • Trình duyệt: {s.browser}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Hoạt động gần nhất: {s.last_active_at ? new Date(s.last_active_at).toLocaleString('vi-VN') : 'Vừa xong'}
                              </p>
                            </div>
                          </div>

                          {s.is_active && (
                            <button
                              type="button"
                              onClick={() => handleRevokeSession(s.id, s.user_id)}
                              className="px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              Buộc Đăng Xuất (Hủy Phiên)
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CẤP HÀNG LOẠT 0001 - 9999 @ DOMAIN */}
              {workbenchTab === 'batch_provision' && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-600" /> Cấp hàng loạt tài khoản học sinh / thí sinh:
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      Hệ thống tự động kích hoạt tài khoản và gán phân quyền ngay tức thì. Tài khoản sẵn sàng đăng nhập
                      tại trang IDP hoặc làm bài thi SEB mà không cần xác thực email.
                    </p>
                  </div>

                  <form onSubmit={handleBatchProvision} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Tiền tố tên đăng nhập (Prefix):
                        </label>
                        <input
                          type="text"
                          value={batchPrefix}
                          onChange={(e) => setBatchPrefix(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="student"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Từ số:</label>
                        <input
                          type="number"
                          value={batchStartNum}
                          onChange={(e) => setBatchStartNum(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Đến số:</label>
                        <input
                          type="number"
                          value={batchEndNum}
                          onChange={(e) => setBatchEndNum(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Định dạng số:</label>
                        <select
                          value={batchPadLength}
                          onChange={(e) => setBatchPadLength(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        >
                          <option value="4">4 chữ số (0001, 0002... 9999)</option>
                          <option value="3">3 chữ số (001, 002... 999)</option>
                          <option value="2">2 chữ số (01, 02... 99)</option>
                          <option value="0">Không thêm số 0 (1, 2, 3...)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Đuôi email (@domain):
                        </label>
                        <input
                          type="text"
                          value={batchDomain}
                          onChange={(e) => setBatchDomain(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="@senexam.edu.vn"
                          required
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Quy tắc đặt mật khẩu:
                        </label>
                        <select
                          value={batchPasswordMode}
                          onChange={(e) => setBatchPasswordMode(e.target.value as any)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        >
                          <option value="common">Chung một mật khẩu duy nhất</option>
                          <option value="pattern">Tự sinh theo quy tắc: Sen@[num]2025</option>
                          <option value="random">Ngẫu nhiên bảo mật cao từng người</option>
                        </select>
                      </div>

                      {batchPasswordMode === 'common' && (
                        <div>
                          <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Mật khẩu chung:</label>
                          <input
                            type="text"
                            value={batchCommonPassword}
                            onChange={(e) => setBatchCommonPassword(e.target.value)}
                            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                            required
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Mẫu họ tên:</label>
                        <input
                          type="text"
                          value={batchNamePattern}
                          onChange={(e) => setBatchNamePattern(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="Học sinh [num]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Lớp học:</label>
                        <input
                          type="text"
                          value={batchClass}
                          onChange={(e) => setBatchClass(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="12A1"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Trường học:</label>
                        <input
                          type="text"
                          value={batchSchool}
                          onChange={(e) => setBatchSchool(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="THPT Chuyên"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tỉnh / Thành:</label>
                        <input
                          type="text"
                          value={batchProvince}
                          onChange={(e) => setBatchProvince(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="Hà Nội"
                        />
                      </div>
                    </div>

                    {/* LIVE PREVIEW BOX */}
                    <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 font-mono text-[11px] space-y-1">
                      <p className="text-slate-500 font-sans font-bold flex items-center justify-between">
                        <span>🔍 Xem trước thông số cấp:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                          Tổng cộng: {batchPreview.total} tài khoản
                        </span>
                      </p>
                      <p className="text-slate-800 dark:text-slate-200">
                        • Tài khoản đầu: <strong>{batchPreview.firstEmail}</strong> (MK mẫu: {batchPreview.samplePwd})
                      </p>
                      <p className="text-slate-800 dark:text-slate-200">
                        • Tài khoản cuối: <strong>{batchPreview.lastEmail}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={batchLoading}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-105 transition disabled:opacity-50 cursor-pointer"
                      >
                        {batchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        ) : (
                          <Zap className="h-4 w-4 inline mr-2" />
                        )}
                        Bắt Đầu Cấp {batchPreview.total} Tài Khoản
                      </button>

                      {batchLoading && (
                        <div className="flex-1 max-w-xs">
                          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-rose-500 transition-all duration-300"
                              style={{ width: `${batchProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Đang xử lý trên Supabase... {batchProgress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </form>

                  {/* KẾT QUẢ CẤP HÀNG LOẠT */}
                  {batchResults.length > 0 && (
                    <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          ✓ Đã khởi tạo thành công: {batchResults.filter((u) => u.success).length} /{' '}
                          {batchResults.length} tài khoản
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyBatchResults}
                            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold hover:bg-black/10 transition cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>{copiedBatchList ? '✓ Đã chép' : 'Sao chép tất cả'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportCsv}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Xuất CSV (Excel)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportTxt}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Tải File .TXT</span>
                          </button>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5 font-mono text-[11px]">
                        {batchResults.map((u, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{u.email}</span>
                            <span className="text-slate-500">MK: {u.password}</span>
                            <span className={u.success ? 'text-emerald-500 font-bold' : 'text-rose-500'}>
                              {u.success ? '✓ OK' : u.error || 'Lỗi'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CẤP 1 TÀI KHOẢN TRỰC TIẾP */}
              {workbenchTab === 'single_provision' && (
                <form onSubmit={handleSingleProvision} className="space-y-4 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Họ và tên *:</label>
                      <input
                        type="text"
                        value={singleFullName}
                        onChange={(e) => setSingleFullName(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        placeholder="Nguyễn Văn A"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Email người nhận *:</label>
                      <input
                        type="email"
                        value={singleEmail}
                        onChange={(e) => setSingleEmail(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        placeholder="nguyenvana@gmail.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Mật khẩu khởi tạo *:</label>
                      <input
                        type="text"
                        value={singlePassword}
                        onChange={(e) => setSinglePassword(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        placeholder="SenExam@2025"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Vai trò phân quyền:</label>
                      <select
                        value={singleRole}
                        onChange={(e) => setSingleRole(e.target.value as any)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                      >
                        <option value="student">🎓 Học sinh (Student)</option>
                        <option value="teacher">👨‍🏫 Giáo viên (Teacher)</option>
                        <option value="collab">🤝 Cộng tác viên (Collab)</option>
                        <option value="admin">👑 Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Gói tài khoản:</label>
                      <select
                        value={singlePlanTier}
                        onChange={(e) => setSinglePlanTier(e.target.value as any)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                      >
                        <option value="free">Cơ bản (Free)</option>
                        <option value="premium">Sen VIP (Premium)</option>
                        <option value="premium_plus">Premium+ (Vip Đặc Quyền)</option>
                        <option value="sen_one">Gói Sen One (Flagship)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tặng SenCash ban đầu:</label>
                      <input
                        type="number"
                        value={singleSenCash}
                        onChange={(e) => setSingleSenCash(e.target.value)}
                        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={singleLoading}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {singleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 inline mr-2" />
                    )}
                    Kích Hoạt Tài Khoản Trực Tiếp
                  </button>
                </form>
              )}

              {/* TAB 4: QUẢN TRỊ KHO ĐỀ */}
              {workbenchTab === 'exams' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm đề thi theo tên hoặc loại đề..."
                        value={examSearch}
                        onChange={(e) => setExamSearch(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-2.5 pl-10 pr-4 text-xs font-semibold outline-none"
                      />
                    </div>

                    <Link
                      href="/new-setup-courses"
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition flex items-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Soạn & Tạo Đề Mới</span>
                    </Link>
                  </div>

                  {examsLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải danh sách đề thi...
                    </div>
                  ) : filteredExams.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Chưa có đề thi nào trong kho hoặc không tìm thấy kết quả.
                    </div>
                  ) : (
                    <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                      {filteredExams.map((ex) => {
                        const isPdf = Boolean(ex.pdf_url || ex.drive_file_id || ex.format === 'pdf')
                        return (
                          <div
                            key={ex.id}
                            className="p-4 flex items-center justify-between flex-wrap gap-2 hover:bg-black/[0.01]"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 dark:text-white text-sm">{ex.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    isPdf ? 'bg-sky-500/10 text-sky-600' : 'bg-teal-500/10 text-teal-600'
                                  }`}
                                >
                                  {isPdf ? '📄 Đề PDF Truyền Thống' : '✨ KaTeX Sắc Nét'}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[11px]">
                                Môn/Loại: {ex.exam_type || 'Tổng hợp'} • Thời gian: {ex.duration || 50} phút • Mã:{' '}
                                <code>{ex.exam_code || 'Không có'}</code>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <Link
                                href={`/new-exams/${ex.id}`}
                                target="_blank"
                                className="px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5 transition flex items-center gap-1"
                              >
                                <span>Xem Đề</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PHÂN QUYỀN & CẤP VIP NGƯỜI DÙNG */}
              {workbenchTab === 'users' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm người dùng theo email, họ tên..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-2.5 pl-10 pr-4 text-xs font-semibold outline-none"
                      />
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải danh sách người dùng...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Không tìm thấy người dùng nào phù hợp với từ khóa.
                    </div>
                  ) : (
                    <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          className="p-3.5 flex items-center justify-between flex-wrap gap-2 hover:bg-black/[0.01]"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{u.email}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-500/10 text-slate-600 dark:text-slate-300">
                                {u.role === 'admin' ? '👑 Admin' : u.role === 'teacher' ? '👨‍🏫 Giáo viên' : '🎓 Học sinh'}
                              </span>
                              {u.plan_tier && u.plan_tier !== 'free' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600">
                                  VIP: {u.plan_tier}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {u.full_name || 'Chưa cập nhật tên'} • SenCash: {u.sencash_balance || 0} SC
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUserForGrant(u)}
                              className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs hover:bg-amber-500/20 transition cursor-pointer"
                            >
                              Nâng VIP / Tặng SC
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MODAL CẤP VIP & TẶNG SC */}
                  {selectedUserForGrant && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="w-full max-w-md rounded-[28px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                          <h4 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                            <Crown className="h-5 w-5 text-amber-500" />
                            <span>Cấp Đặc Quyền Cho Thành Viên</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setSelectedUserForGrant(null)}
                            className="text-slate-400 hover:text-black dark:hover:text-white text-sm font-bold"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          Tài khoản: <strong>{selectedUserForGrant.email}</strong> ({selectedUserForGrant.full_name})
                        </div>

                        {/* Phần Cấp VIP */}
                        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                          <span className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Crown className="h-4 w-4 text-amber-500" /> Nâng Hạng Sen VIP:
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <select
                              value={grantVipTier}
                              onChange={(e) => setGrantVipTier(e.target.value)}
                              className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-2 font-bold outline-none"
                            >
                              <option value="premium">Sen VIP (Premium)</option>
                              <option value="premium_plus">Premium+</option>
                              <option value="sen_one">Sen One</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Số ngày (30)"
                              value={grantVipDays}
                              onChange={(e) => setGrantVipDays(e.target.value)}
                              className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-2 font-bold outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleGrantVip}
                            disabled={grantActionLoading}
                            className="w-full py-2 rounded-xl bg-amber-500 text-black font-black text-xs hover:bg-amber-600 transition disabled:opacity-50 cursor-pointer"
                          >
                            {grantActionLoading ? 'Đang thực hiện...' : 'Kích Hoạt Gói VIP'}
                          </button>
                        </div>

                        {/* Phần Tặng SenCash */}
                        <div className="p-3.5 rounded-2xl bg-pink-500/5 border border-pink-500/20 space-y-2.5">
                          <span className="font-bold text-xs text-pink-800 dark:text-pink-300 flex items-center gap-1.5">
                            <Coins className="h-4 w-4 text-pink-500" /> Tặng Thưởng SenCash:
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              type="number"
                              placeholder="Số SC tặng (50)"
                              value={grantSenCashAmount}
                              onChange={(e) => setGrantSenCashAmount(e.target.value)}
                              className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 p-2 font-bold outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleGiftSenCash}
                              disabled={grantActionLoading}
                              className="px-4 py-2 rounded-xl bg-pink-500 text-white font-black text-xs hover:bg-pink-600 transition disabled:opacity-50 cursor-pointer"
                            >
                              Cộng SC
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: GIFTCODES */}
              {workbenchTab === 'giftcodes' && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-800 dark:text-pink-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Gift className="h-4 w-4 text-pink-600" /> Tạo mã quà tặng Giftcode sự kiện:
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      Mã quà tặng cho phép học sinh tự kích hoạt VIP hoặc nhận SenCash vào ví SenExam.
                    </p>
                  </div>

                  <form onSubmit={handleCreateGiftcode} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Loại phần thưởng:</label>
                        <select
                          value={newCodeType}
                          onChange={(e) => setNewCodeType(e.target.value as any)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        >
                          <option value="vip_days">Kích hoạt ngày VIP</option>
                          <option value="sencash">Cộng SenCash vào ví</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          {newCodeType === 'vip_days' ? 'Số ngày VIP:' : 'Số SenCash (SC):'}
                        </label>
                        <input
                          type="number"
                          value={newCodeAmount}
                          onChange={(e) => setNewCodeAmount(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Số lượt dùng tối đa:</label>
                        <input
                          type="number"
                          value={newCodeMaxUses}
                          onChange={(e) => setNewCodeMaxUses(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Ghi chú sự kiện:</label>
                        <input
                          type="text"
                          value={newCodeNote}
                          onChange={(e) => setNewCodeNote(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={codeActionLoading}
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-105 transition disabled:opacity-50 cursor-pointer"
                    >
                      {codeActionLoading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Plus className="h-4 w-4 inline mr-2" />}
                      Khởi Tạo Mã Giftcode Ngay
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modal Kích Hoạt Sen 2FA (Authenticator TOTP) Trực Tiếp Trong Admin Dashboard */}
      {showMfaEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">
                    Kích Hoạt Sen 2FA (Authenticator)
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Bảo mật 2 bước TOTP • Ngăn ngừa 100% rủi ro chiếm quyền Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMfaEnrollModal(false)
                  setMfaQrCode('')
                  setMfaSecret('')
                  setMfaSetupCode('')
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmMfaEnrollment} className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  1. Mở Google Authenticator trên điện thoại và quét mã QR:
                </p>
                <div className="p-3 bg-white rounded-2xl inline-block shadow-md border border-slate-200">
                  {mfaQrCode.startsWith('data:') ? (
                    <img src={mfaQrCode} alt="MFA QR Code" className="w-44 h-44 mx-auto" />
                  ) : (
                    <div
                      className="w-44 h-44 mx-auto [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: mfaQrCode }}
                    />
                  )}
                </div>

                {mfaSecret && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] text-slate-500">Hoặc nhập mã khóa bí mật thủ công:</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold">
                      <span>{mfaSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(mfaSecret)
                          setCopiedMfaSecret(true)
                          setTimeout(() => setCopiedMfaSecret(false), 2000)
                        }}
                        className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition cursor-pointer"
                        title="Sao chép"
                      >
                        {copiedMfaSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block text-center">
                  2. Nhập mã xác thực 6 chữ số từ ứng dụng:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••••"
                  value={mfaSetupCode}
                  onChange={(e) => setMfaSetupCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono text-xl font-black py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMfaEnrollModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/15 text-xs font-bold hover:bg-black/5 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={mfaLoading || mfaSetupCode.trim().length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>Xác Nhận & Bật</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
