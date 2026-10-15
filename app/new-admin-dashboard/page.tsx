'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars, getAccentHex } from '@/app/components/modernTheme'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
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
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-admdash-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-admdash-body' })

type Perspective = 'admin' | 'student' | 'teacher'
type AdminSection = 'overview' | 'sessions' | 'provisioning' | 'exams' | 'users' | 'giftcodes' | 'announcements' | 'settings'

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

export default function NewAdminDashboardPage() {
  const router = useRouter()
  const { themeColor } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)

  // Góc nhìn hiển thị (Perspective Switcher: Admin | Sinh viên | Giảng viên)
  const [perspective, setPerspective] = useState<Perspective>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sen_admin_perspective') as Perspective) || 'admin'
    }
    return 'admin'
  })

  // Phân hệ đang chọn trong Admin Mode
  const [activeSection, setActiveSection] = useState<AdminSection>('overview')

  // Thống kê tổng hợp (KPI Metrics)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalSubmissions: 0,
    totalSenCash: 0,
    totalSessions: 0,
  })

  // ==========================================
  // DỮ LIỆU CÁC PHÂN HỆ
  // ==========================================
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
  const [newCodeType, setNewCodeType] = useState<'sencash' | 'vip'>('vip')
  const [newCodeAmount, setNewCodeAmount] = useState('30')
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('10')
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
  const [singlePlanTier, setSinglePlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'>('free')
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
  const [batchPlanTier, setBatchPlanTier] = useState<'free' | 'premium' | 'premium_plus' | 'sen_one' | 'sen_one_lite'>('free')
  const [batchVipDays, setBatchVipDays] = useState('30')
  const [batchSenCash, setBatchSenCash] = useState('0')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [copiedBatchList, setCopiedBatchList] = useState(false)

  // Thông báo phản hồi
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Khởi tạo và kiểm tra quyền Admin
  useEffect(() => {
    let isMounted = true

    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    if (isMounted) setIsDark(Boolean(dark))

    const initAdmin = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user

        if (!user) {
          router.replace('/new-idp?next=/new-admin-dashboard')
          return
        }

        if (isMounted) setCurrentUser(user)
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
        }

        // Tải số liệu thống kê KPI
        fetchOverviewStats()
      } catch (err) {
        console.error('Lỗi khởi tạo Admin Dashboard:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAdmin()

    return () => {
      isMounted = false
    }
  }, [router])

  // Tải thống kê KPI
  const fetchOverviewStats = async () => {
    try {
      const [usersRes, examsRes, subsRes] = await Promise.all([
        supabase.from('profiles').select('id, sencash_balance', { count: 'exact' }),
        supabase.from('exams').select('id', { count: 'exact' }),
        supabase.from('submissions').select('id', { count: 'exact' }),
      ])

      const totalSc = (usersRes.data || []).reduce((acc: number, curr: any) => acc + (Number(curr.sencash_balance) || 0), 0)

      setStats({
        totalUsers: usersRes.count || 0,
        totalExams: examsRes.count || 0,
        totalSubmissions: subsRes.count || 0,
        totalSenCash: totalSc,
        totalSessions: 1,
      })
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

  // Đổi phân hệ tab
  useEffect(() => {
    if (activeSection === 'sessions') fetchSessions()
    if (activeSection === 'exams') fetchExams()
    if (activeSection === 'users') fetchUsers()
  }, [activeSection])

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
          ? 'Đã chuyển sang Góc nhìn Sinh viên / Thí sinh (Mô phỏng trải nghiệm học sinh)'
          : 'Đã chuyển sang Góc nhìn Giảng viên / Giáo viên (Mô phỏng trải nghiệm thầy cô)',
    })
    setTimeout(() => setBannerMsg(null), 4000)
  }

  // Chuyển đổi Dark/Light mode
  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      try { localStorage.setItem('theme', 'dark') } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }

  // Đăng xuất
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/new-idp')
  }

  // Thu hồi phiên đăng nhập
  const handleRevokeSession = async (sessionId: string, userId: string) => {
    const conf = window.confirm('Bạn có chắc chắn muốn hủy phiên đăng nhập này của người dùng?')
    if (!conf) return
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', sessionId, userId }),
      })
      const data = await res.json()
      if (data.success) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId || s.device_id === sessionId ? { ...s, is_active: false } : s)))
        setBannerMsg({ type: 'success', text: 'Đã hủy phiên làm việc thành công.' })
      } else {
        throw new Error(data.error)
      }
    } catch (e: any) {
      setBannerMsg({ type: 'error', text: e.message || 'Lỗi khi hủy phiên.' })
    }
    setTimeout(() => setBannerMsg(null), 3000)
  }

  // Cấp 1 tài khoản
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
        throw new Error('Mỗi lượt cấp tối đa 150 tài khoản để đảm bảo an toàn.')
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
      .map((u) => `"${u.email}","${u.password}","${u.fullName}","${u.success ? 'Thành công' : u.error || 'Lỗi'}"`)
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Danh_sach_tai_khoan_SenExam_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Xem trước live preview cho batch
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
  }, [batchPrefix, batchStartNum, batchEndNum, batchPadLength, batchDomain, batchPasswordMode, batchCommonPassword])

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
    return exams.filter((e) => e.title?.toLowerCase().includes(q) || e.exam_type?.toLowerCase().includes(q))
  }, [exams, examSearch])

  // Lọc Users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter((u) => u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q))
  }, [users, userSearch])

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải Trung Tâm Quản Trị SenExam IDP...</span>
        </div>
      </div>
    )
  }

  const themeVars = getModernThemeVars(themeColor, isDark)
  const accent = getAccentHex(themeColor, isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(244, 63, 94, 0.08), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(254, 215, 170, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(199, 210, 254, 0.35), transparent 30%), #F4F7FB',
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
              Đang mô phỏng giao diện:{' '}
              <strong className="uppercase underline">
                {perspective === 'student' ? 'Góc nhìn Sinh viên / Thí sinh' : 'Góc nhìn Giảng viên / Giáo viên'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSwitchPerspective('admin')}
            className="px-3 py-1 rounded-xl bg-white text-slate-900 font-black text-[11px] shadow-sm hover:bg-slate-100 transition cursor-pointer"
          >
            ← Quay lại Góc nhìn Admin
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

      {/* ======================================================== */}
      {/* HEADER MASTER ADMIN DASHBOARD */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-8 py-3.5 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/new-dashboard" className="flex items-center gap-2 group">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md group-hover:scale-105 transition">
                S
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base sm:text-lg tracking-tight" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    SenExam
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Master Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  Trung Tâm Điều Hành & An Ninh IDP 2.0
                </p>
              </div>
            </Link>
          </div>

          {/* BỘ CHUYỂN GÓC NHÌN TRÊN HEADER (PERSPECTIVE SWITCHER) */}
          <div className="hidden md:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => handleSwitchPerspective('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                perspective === 'admin'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span>Góc nhìn Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPerspective('student')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                perspective === 'student'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
              <span>Góc nhìn Sinh viên</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPerspective('teacher')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                perspective === 'teacher'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
              <span>Góc nhìn Giảng viên</span>
            </button>
          </div>

          {/* QUICK CONTROLS: THEME & LOGOUT */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="h-9 w-9 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 flex items-center justify-center hover:scale-105 transition cursor-pointer"
              title="Đổi giao diện Sáng/Tối"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* NỘI DUNG CHÍNH THEO GÓC NHÌN ĐÃ CHỌN */}
      {/* ======================================================== */}
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* ==================================================== */}
        {/* A. GIAO DIỆN MÔ PHỎNG: GÓC NHÌN SINH VIÊN (STUDENT) */}
        {/* ==================================================== */}
        {perspective === 'student' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-sm backdrop-blur-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    🎓 Học sinh tiêu chuẩn
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    Chào bạn, chuẩn bị cho kỳ thi hôm nay nhé!
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chuỗi ngày ôn luyện: <strong>12 ngày liên tục 🔥</strong> • Gói tài khoản: <strong>Sen VIP</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/new-exams"
                    className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition"
                  >
                    Vào Kho Đề Thi KaTeX & PDF →
                  </Link>
                </div>
              </div>

              {/* Student Quick Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
                  <BookOpen className="h-6 w-6 text-indigo-500 mb-2" />
                  <p className="font-bold text-sm">Kho Đề Đã Làm</p>
                  <p className="text-xs text-slate-500 mt-1">18 đề đã hoàn thành với điểm trung bình 8.4</p>
                </div>
                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                  <Flame className="h-6 w-6 text-amber-500 mb-2" />
                  <p className="font-bold text-sm">Chuỗi Luyện Đề (Streak)</p>
                  <p className="text-xs text-slate-500 mt-1">Bạn đã học liên tục 12 ngày không gián đoạn!</p>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                  <Sparkles className="h-6 w-6 text-emerald-500 mb-2" />
                  <p className="font-bold text-sm">Trợ Lý Giải Đề SenAI</p>
                  <p className="text-xs text-slate-500 mt-1">Sẵn sàng phân tích câu hỏi khó và hướng dẫn KaTeX chi tiết.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* B. GIAO DIỆN MÔ PHỎNG: GÓC NHÌN GIẢNG VIÊN (TEACHER) */}
        {/* ==================================================== */}
        {perspective === 'teacher' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-sm backdrop-blur-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    👨‍🏫 Bàn Giảng Viên
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    Khu Vực Quản Lý Giảng Dạy & Khảo Thí
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Quản lý phòng thi, giám sát Safe Exam Browser trực tiếp và theo dõi phổ điểm của học sinh.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/sentaobai"
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition"
                  >
                    + Tạo Đề Thi Mới
                  </Link>
                </div>
              </div>

              {/* Teacher Quick Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                  <FileText className="h-6 w-6 text-emerald-500 mb-2" />
                  <p className="font-bold text-sm">Đề Thi Của Tôi</p>
                  <p className="text-xs text-slate-500 mt-1">6 đề thi đang mở cho học sinh làm bài.</p>
                </div>
                <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5">
                  <ShieldCheck className="h-6 w-6 text-sky-500 mb-2" />
                  <p className="font-bold text-sm">Giám Thị Trực Tiếp SEB</p>
                  <p className="text-xs text-slate-500 mt-1">Giám sát màn hình và chống gian lận trong thời gian thực.</p>
                </div>
                <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5">
                  <TrendingUp className="h-6 w-6 text-purple-500 mb-2" />
                  <p className="font-bold text-sm">Thống Kê Phổ Điểm</p>
                  <p className="text-xs text-slate-500 mt-1">Phân tích ma trận độ khó câu hỏi và xếp loại tự động.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* C. GIAO DIỆN CHÍNH: GÓC NHÌN QUẢN TRỊ VIÊN (ADMIN) */}
        {/* ==================================================== */}
        {perspective === 'admin' && (
          <div className="space-y-6">
            {/* 1. THANH ĐIỀU HƯỚNG CÁC PHÂN HỆ QUẢN TRỊ (TỐI ƯU HÓA) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {[
                { id: 'overview', label: 'Tổng quan & KPI', icon: LayoutDashboard },
                { id: 'sessions', label: 'Quản lý Phiên', icon: Smartphone },
                { id: 'provisioning', label: 'Cấp Tài Khoản', icon: UserPlus },
                { id: 'exams', label: 'Kho Đề Thi', icon: FileText },
                { id: 'users', label: 'Người Dùng', icon: Users },
                { id: 'giftcodes', label: 'Giftcodes', icon: Gift },
                { id: 'announcements', label: 'Thông Báo', icon: Megaphone },
                { id: 'settings', label: 'Cài Đặt Web', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeSection === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id as AdminSection)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-[1.02]'
                        : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* ========================================== */}
            {/* TAB 1: TỔNG QUAN & THỐNG KÊ KPI */}
            {/* ========================================== */}
            {activeSection === 'overview' && (
              <div className="space-y-6 animate-in fade-in">
                {/* 4 THẺ KPI ĐỈNH CAO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng Thành Viên</span>
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      {stats.totalUsers.toLocaleString()}
                    </p>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3.5 w-3.5" /> +100% tài khoản đã kích hoạt
                    </span>
                  </div>

                  <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đề Thi Hệ Thống</span>
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      {stats.totalExams.toLocaleString()}
                    </p>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
                      <Sparkles className="h-3.5 w-3.5" /> KaTeX Sắc Nét & PDF Split View
                    </span>
                  </div>

                  <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Lượt Thi Nộp Bài</span>
                      <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Award className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      {stats.totalSubmissions.toLocaleString()}
                    </p>
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1">
                      <Activity className="h-3.5 w-3.5" /> Tự động chấm & xếp hạng
                    </span>
                  </div>

                  <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng SenCash Lưu Hành</span>
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Coins className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      {stats.totalSenCash.toLocaleString()} SC
                    </p>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                      <Zap className="h-3.5 w-3.5" /> Kinh tế học tập tuần hoàn
                    </span>
                  </div>
                </div>

                {/* TRẠNG THÁI HỆ THỐNG CLOUD */}
                <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-indigo-500" />
                      <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                        Trạng Thái Cụm Máy Chủ & Dịch Vụ SenExam
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> All Systems Operational
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-slate-500">Supabase Auth & Database</span>
                      <p className="font-black text-slate-800 dark:text-slate-200">Hoạt động 100% (RLS Active)</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-slate-500">Bảo Mật 2 Lớp (TOTP)</span>
                      <p className="font-black text-slate-800 dark:text-slate-200">FEPN-Grade MFA Ready</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-slate-500">Trí Tuệ Nhân Tạo (SenAI)</span>
                      <p className="font-black text-slate-800 dark:text-slate-200">Gemini 3.5 & 3.8 Flash Online</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-slate-500">Safe Exam Browser Proctor</span>
                      <p className="font-black text-slate-800 dark:text-slate-200">SEB Anti-Cheat v3.8 Active</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* TAB 2: QUẢN LÝ PHIÊN (SESSIONS & AN NINH) */}
            {/* ========================================== */}
            {activeSection === 'sessions' && (
              <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      Quản Lý Phiên Thiết Bị Đang Hoạt Động (Session Control)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Giám sát các thiết bị đăng nhập trong toàn hệ thống và ngắt kết nối từ xa khi phát hiện bất thường.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchSessions}
                      disabled={sessionsLoading}
                      className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                      <span>Làm mới</span>
                    </button>
                  </div>
                </div>

                {/* Tìm kiếm phiên */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo email người dùng, tên thiết bị, hoặc địa chỉ IP..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-semibold outline-none"
                  />
                </div>

                {/* Danh sách Sessions */}
                {sessionsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải dữ liệu phiên...
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Chưa có phiên làm việc nào được ghi nhận hoặc không tìm thấy kết quả.
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                    {filteredSessions.map((s) => (
                      <div key={s.id || s.device_id} className="p-4 flex items-center justify-between flex-wrap gap-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
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
                              Tài khoản: <strong>{s.user_email}</strong> ({s.user_full_name}) • IP: <code>{s.ip_address}</code> • HĐH: {s.os}
                            </p>
                          </div>
                        </div>

                        {s.is_active && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id, s.user_id)}
                            className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer"
                          >
                            Buộc Đăng Xuất
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: TRUNG TÂM CẤP TÀI KHOẢN (CHUYỂN TOÀN BỘ TỪ NEW-IDP VÀO ĐÂY) */}
            {/* ========================================================================= */}
            {activeSection === 'provisioning' && (
              <div className="space-y-6 animate-in fade-in">
                {/* 3.1 CẤP HÀNG LOẠT (0001 - 9999 @ domain) */}
                <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-4">
                  <div className="flex items-center gap-2 font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    <Users className="h-5 w-5 text-rose-500" />
                    <span>Cấp Hàng Loạt Tài Khoản Tuần Tự (0001 - 9999 @ domain)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Phục vụ cấp phát cho cả lớp học, khối thi hoặc trường học với tài khoản kích hoạt sẵn, không cần xác nhận email.
                  </p>

                  <form onSubmit={handleBatchProvision} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tiền tố (Prefix):</label>
                        <input
                          type="text"
                          value={batchPrefix}
                          onChange={(e) => setBatchPrefix(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          placeholder="student"
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
                          <option value="4">4 số (0001)</option>
                          <option value="3">3 số (001)</option>
                          <option value="2">2 số (01)</option>
                          <option value="0">Không thêm 0 (1)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Đuôi email (@domain):</label>
                        <input
                          type="text"
                          value={batchDomain}
                          onChange={(e) => setBatchDomain(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Kiểu mật khẩu:</label>
                        <select
                          value={batchPasswordMode}
                          onChange={(e) => setBatchPasswordMode(e.target.value as any)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
                        >
                          <option value="common">Chung một mật khẩu</option>
                          <option value="pattern">Tự sinh: Sen@[num]2025</option>
                          <option value="random">Ngẫu nhiên từng người</option>
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

                    {/* Live Preview */}
                    <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 font-mono text-[11px] space-y-1">
                      <p className="text-slate-500 font-sans font-bold">Xem trước: Tổng {batchPreview.total} tài khoản</p>
                      <p className="text-slate-800 dark:text-slate-200">
                        • Đầu: <strong>{batchPreview.firstEmail}</strong> (MK: {batchPreview.samplePwd})
                      </p>
                      <p className="text-slate-800 dark:text-slate-200">• Cuối: <strong>{batchPreview.lastEmail}</strong></p>
                    </div>

                    <button
                      type="submit"
                      disabled={batchLoading}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-105 transition disabled:opacity-50 cursor-pointer"
                    >
                      {batchLoading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Zap className="h-4 w-4 inline mr-2" />}
                      Bắt Đầu Cấp {batchPreview.total} Tài Khoản
                    </button>
                  </form>

                  {/* KẾT QUẢ CẤP HÀNG LOẠT */}
                  {batchResults.length > 0 && (
                    <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">
                          Kết quả: {batchResults.filter((u) => u.success).length} thành công
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyBatchResults}
                            className="px-3 py-1 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold hover:bg-black/10 transition cursor-pointer"
                          >
                            {copiedBatchList ? '✓ Đã chép' : 'Sao chép tất cả'}
                          </button>
                          <button
                            type="button"
                            onClick={handleExportCsv}
                            className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Xuất File CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3.2 CẤP 1 TÀI KHOẢN ĐƠN LẺ */}
                <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-4">
                  <div className="flex items-center gap-2 font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    <UserPlus className="h-5 w-5 text-indigo-500" />
                    <span>Cấp 1 Tài Khoản Trực Tiếp</span>
                  </div>

                  <form onSubmit={handleSingleProvision} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Họ và tên *:</label>
                        <input
                          type="text"
                          value={singleFullName}
                          onChange={(e) => setSingleFullName(e.target.value)}
                          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-2.5 font-bold outline-none"
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
                      {singleLoading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <UserPlus className="h-4 w-4 inline mr-2" />}
                      Kích Hoạt Tài Khoản Trực Tiếp
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* TAB 4: KHO ĐỀ THI & QUẢN TRỊ ĐỀ */}
            {/* ========================================== */}
            {activeSection === 'exams' && (
              <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      Quản Trị Kho Đề Thi ({filteredExams.length} đề)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Hỗ trợ đề KaTeX trực tiếp và đề PDF truyền thống 2 cột.</p>
                  </div>
                  <Link
                    href="/sentaobai"
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition"
                  >
                    + Tạo Đề Mới
                  </Link>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm đề thi theo tên hoặc loại đề..."
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-semibold outline-none"
                  />
                </div>

                {examsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải đề thi...
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                    {filteredExams.map((ex) => {
                      const isPdf = Boolean(ex.pdf_url || ex.drive_file_id || ex.format === 'pdf')
                      return (
                        <div key={ex.id} className="p-4 flex items-center justify-between flex-wrap gap-2 hover:bg-black/[0.01]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 dark:text-white text-sm">{ex.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isPdf ? 'bg-sky-500/10 text-sky-600' : 'bg-teal-500/10 text-teal-600'
                              }`}>
                                {isPdf ? '📄 Đề PDF' : '✨ KaTeX'}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              {ex.exam_type} • Thời gian: {ex.duration} phút • Mã: <code>{ex.exam_code || 'Không có'}</code>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/new-exams/${ex.id}`}
                              target="_blank"
                              className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                            >
                              Xem Đề ↗
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================== */}
            {/* TAB 5: DANH SÁCH NGƯỜI DÙNG */}
            {/* ========================================== */}
            {activeSection === 'users' && (
              <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                      Danh Sách Thành Viên ({filteredUsers.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Quản lý phân quyền và gói VIP cho người dùng.</p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo email, tên người dùng..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 py-3 pl-11 pr-4 text-xs font-semibold outline-none"
                  />
                </div>

                {usersLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Đang tải danh sách...
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden text-xs">
                    {filteredUsers.map((u) => (
                      <div key={u.id} className="p-3.5 flex items-center justify-between flex-wrap gap-2 hover:bg-black/[0.01]">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.email}</p>
                          <p className="text-[11px] text-slate-500">
                            {u.full_name || 'Chưa cập nhật tên'} • Vai trò: <strong>{u.role}</strong> • Gói: <strong>{u.plan_tier || 'free'}</strong> • SenCash: {u.sencash_balance || 0} SC
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================== */}
            {/* TAB 8: CÀI ĐẶT WEB & GÓC NHÌN */}
            {/* ========================================== */}
            {activeSection === 'settings' && (
              <div className="rounded-[30px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-2xl space-y-6 animate-in fade-in">
                <div>
                  <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-admdash-heading)' }}>
                    Cài Đặt Web & Tùy Chọn Góc Nhìn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lựa chọn góc nhìn trải nghiệm người dùng và cấu hình hiển thị bảng điều khiển.
                  </p>
                </div>

                {/* Chọn góc nhìn */}
                <div className="space-y-3">
                  <label className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                    Góc nhìn hiển thị hiện tại:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSwitchPerspective('admin')}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        perspective === 'admin'
                          ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                          : 'border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50'
                      }`}
                    >
                      <Crown className="h-6 w-6 text-amber-500 mb-2" />
                      <p className="font-black text-sm">Góc nhìn Quản trị viên</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Toàn quyền xem KPI, cấp tài khoản, xem các phiên hoạt động và cấu hình hệ thống.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchPerspective('student')}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        perspective === 'student'
                          ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30'
                          : 'border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50'
                      }`}
                    >
                      <GraduationCap className="h-6 w-6 text-indigo-500 mb-2" />
                      <p className="font-black text-sm">Góc nhìn Sinh viên / Thí sinh</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Mô phỏng chính xác giao diện của học sinh khi làm bài, xem điểm và sử dụng SenAI.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchPerspective('teacher')}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        perspective === 'teacher'
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50'
                      }`}
                    >
                      <Briefcase className="h-6 w-6 text-emerald-500 mb-2" />
                      <p className="font-black text-sm">Góc nhìn Giảng viên / Thầy cô</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Mô phỏng giao diện của thầy cô quản lý đề thi, lớp học và giám thị phòng thi.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
