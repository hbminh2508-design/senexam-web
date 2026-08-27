'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { generateGiftCode, normalizeGiftCode, describeGiftReward } from '@/lib/giftCodes'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Coins,
  Gift,
  FileText,
  AlertCircle,
  Bug,
  Sparkles,
  Server,
  Activity,
  Radio,
  Clock,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  UserCheck,
  Zap,
  TrendingUp,
  Award,
  Crown,
  Lock,
  Unlock,
  Sliders,
  Send,
  UploadCloud,
  FileCheck,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-body' })

type AdminTab = 'overview' | 'giveaway' | 'giftcodes' | 'exams' | 'users' | 'bugtracker'

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

export default function NewAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  // LIVE MONITOR & METRICS
  const [uptimeSeconds, setUptimeSeconds] = useState(148920) // Simulated uptime
  const [onlineCount, setOnlineCount] = useState(12)
  const [liveExaminees, setLiveExaminees] = useState<any[]>([
    { id: '1', name: 'Nguyễn Văn An', email: 'an.nguyen@gmail.com', examTitle: 'Đề Khảo Sát Toán THPT 2026', timeElapsed: '32:15', tabSwitches: 0, status: 'Làm bài' },
    { id: '2', name: 'Trần Thị Mai', email: 'mai.tran@gmail.com', examTitle: 'Đề Đánh Giá Tư Duy TSA 01', timeElapsed: '18:40', tabSwitches: 3, status: 'Cảnh báo thoát tab' },
    { id: '3', name: 'Lê Hoàng Minh', email: 'hoangminh@gmail.com', examTitle: 'Đề Đánh Giá Năng Lực HSA', timeElapsed: '45:10', tabSwitches: 1, status: 'Làm bài' },
  ])

  // OVERVIEW STATS
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSubmissions: 0,
    totalExams: 0,
    totalCodes: 0,
  })

  // GIVEAWAY SENCASH STATE
  const [giveawayTargetEmail, setGiveawayTargetEmail] = useState('')
  const [giveawayAmount, setGiveawayAmount] = useState('100')
  const [giveawayReason, setGiveawayReason] = useState('Quà tặng sự kiện SenExam 2026')
  const [giveawayLoading, setGiveawayLoading] = useState(false)
  const [giveawayMsg, setGiveawayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // GIFT CODES STATE
  const [giftCodes, setGiftCodes] = useState<any[]>([])
  const [codeType, setCodeType] = useState<'sencash' | 'vip_days' | 'senai_tier'>('sencash')
  const [codeAmount, setCodeAmount] = useState('100')
  const [codeVipDays, setCodeVipDays] = useState('30')
  const [codeMaxUses, setCodeMaxUses] = useState('1')
  const [codeExpiresDays, setCodeExpiresDays] = useState('30')
  const [codeCustomInput, setCodeCustomInput] = useState('')
  const [codeBatchCount, setCodeBatchCount] = useState('1')
  const [codeLoading, setCodeLoading] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // EXAMS MANAGER
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [showCreateExamModal, setShowCreateExamModal] = useState(false)
  const [newExamTitle, setNewExamTitle] = useState('')
  const [newExamType, setNewExamType] = useState('THPTQG')
  const [newExamDuration, setNewExamDuration] = useState('90')
  const [newExamPdfFile, setNewExamPdfFile] = useState<File | null>(null)
  const [newExamQCount, setNewExamQCount] = useState('50')
  const [creatingExam, setCreatingExam] = useState(false)

  // USERS & VIP
  const [usersList, setUsersList] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')

  // BUG TRACKER & CLIENT ERRORS
  const [bugReports, setBugReports] = useState<any[]>([
    { id: 'b1', user: 'hoangbinhminh2508@gmail.com', error: 'Unexpected token <, <!DOCTYPE in /api/senai-chat', time: '10 phút trước', status: 'Đã sửa' },
    { id: 'b2', user: 'student99@gmail.com', error: 'Không thể xem trước tệp docx trên mobile', time: '1 giờ trước', status: 'Đang theo dõi' },
  ])

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    // Uptime counter
    const uptimeTimer = setInterval(() => setUptimeSeconds((u) => u + 1), 1000)

    const initAdmin = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'student'
      setUserRole(role)

      if (role !== 'admin' && role !== 'collab') {
        alert('Bạn không có quyền truy cập vào cổng quản trị!')
        router.replace('/new-dashboard')
        return
      }

      setIsAdmin(true)

      // Fetch overview data
      const [usersCount, subsCount, examsCount, codesData, examsData, usersData] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('exams').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      ])

      setStats({
        totalUsers: usersCount.count || 0,
        totalSubmissions: subsCount.count || 0,
        totalExams: examsCount.count || 0,
        totalCodes: codesData.data?.length || 0,
      })

      setGiftCodes(codesData.data || [])
      setExamsList(examsData.data || [])
      setUsersList(usersData.data || [])
      setLoading(false)
    }

    initAdmin()

    return () => clearInterval(uptimeTimer)
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

  const formatUptime = (totalSecs: number) => {
    const days = Math.floor(totalSecs / 86400)
    const hours = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    return `${days}d ${hours}h ${mins}m ${secs}s`
  }

  // TẶNG SENCASH CHO NGƯỜI DÙNG (GIVEAWAY)
  const handleGiveawaySenCash = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = giveawayTargetEmail.trim()
    const amount = parseInt(giveawayAmount) || 0

    if (!email || amount <= 0) {
      setGiveawayMsg({ type: 'error', text: 'Vui lòng nhập đúng email và số SenCash hợp lệ (>0).' })
      return
    }

    setGiveawayLoading(true)
    setGiveawayMsg(null)

    try {
      const { data: targetProfile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, sencash_balance')
        .eq('email', email)
        .maybeSingle()

      if (pErr || !targetProfile) {
        throw new Error('Không tìm thấy tài khoản với email này.')
      }

      // Cộng số dư SenCash
      const newBal = (targetProfile.sencash_balance || 0) + amount
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ sencash_balance: newBal })
        .eq('id', targetProfile.id)

      if (updErr) throw updErr

      // Ghi log giao dịch
      await supabase.from('sencash_transactions').insert({
        user_id: targetProfile.id,
        amount: amount,
        transaction_type: 'gift',
        description: giveawayReason || 'Admin Giveaway Tặng SenCash',
      })

      setGiveawayMsg({
        type: 'success',
        text: `Đã tặng thành công +${amount} SenCash cho học sinh ${targetProfile.full_name || email}! (Số dư mới: ${newBal} SC)`,
      })
      setGiveawayTargetEmail('')
    } catch (err: any) {
      setGiveawayMsg({ type: 'error', text: err.message || 'Lỗi khi tặng SenCash.' })
    } finally {
      setGiveawayLoading(false)
    }
  }

  // TẠO MÃ QUÀ TẶNG 16 KÝ TỰ (GIFT CODE GENERATOR)
  const handleCreateGiftCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeLoading(true)

    try {
      const count = parseInt(codeBatchCount) || 1
      const maxUses = parseInt(codeMaxUses) || 1
      const expiresDays = parseInt(codeExpiresDays) || 30
      const expiresAt = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString()

      const newCodesToInsert = []

      for (let i = 0; i < count; i++) {
        const generated = count === 1 && codeCustomInput.trim() ? normalizeGiftCode(codeCustomInput) : generateGiftCode()

        newCodesToInsert.push({
          code: generated,
          reward_type: codeType,
          reward_sencash_amount: codeType === 'sencash' ? parseInt(codeAmount) || 100 : null,
          reward_vip_days: codeType === 'vip_days' ? parseInt(codeVipDays) || 30 : null,
          reward_senai_tier: codeType === 'senai_tier' ? 'ultra' : null,
          reward_senai_duration_days: codeType === 'senai_tier' ? 30 : null,
          max_uses: maxUses,
          used_count: 0,
          active: true,
          expires_at: expiresAt,
          note: `Admin Giveaway (Tạo lúc ${new Date().toLocaleDateString('vi-VN')})`,
        })
      }

      const { data, error } = await supabase.from('gift_codes').insert(newCodesToInsert).select('*')
      if (error) throw error

      setGiftCodes([...(data || []), ...giftCodes])
      setCodeCustomInput('')
      alert(`Đã tạo thành công ${newCodesToInsert.length} mã quà tặng 16 ký tự!`)
    } catch (err: any) {
      alert(`Lỗi tạo mã: ${err.message}`)
    } finally {
      setCodeLoading(false)
    }
  }

  const handleCopyCode = (id: string, codeStr: string) => {
    navigator.clipboard.writeText(codeStr)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // TẠO ĐỀ THI MỚI VÀ UPLOAD LÊN DRIVE
  const handleCreateNewExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExamTitle.trim() || !newExamPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload file PDF lên Google Drive
      const uploadUrl = await initGoogleDriveUpload(newExamPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, newExamPdfFile, newExamTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Tạo cấu trúc đề thi 50 câu mặc định
      const qCount = parseInt(newExamQCount) || 50
      const examStructure = [
        {
          id: 'sec_1',
          name: 'Phần thi Trắc nghiệm',
          type: 'single_choice',
          questionCount: qCount,
          optionsCount: 4,
          correctAnswers: Array.from({ length: qCount }, () => 'A'),
        },
      ]

      // 3. Insert vào bảng exams
      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          title: newExamTitle.trim(),
          exam_type: newExamType,
          duration: parseInt(newExamDuration) || 90,
          drive_file_id: driveFileId,
          exam_structure: examStructure,
          allow_review: true,
          created_by: currentUserId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      setExamsList([newExam, ...examsList])
      setShowCreateExamModal(false)
      setNewExamTitle('')
      setNewExamPdfFile(null)
      alert('Tạo đề thi mới thành công và đã xuất bản lên kho đề!')
    } catch (err: any) {
      alert(`Lỗi tạo đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang xác thực quyền Quản trị tối cao...</span>
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
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                  <ShieldCheck className="inline h-3.5 w-3.5 mr-1" /> Trung Tâm Quản Trị Tối Cao 2.0
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  {userRole.toUpperCase()}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Bảng Điều Khiển Hệ Thống & Giám Sát Real-time
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'overview'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Activity className="h-4 w-4" /> Giám Sát Trực Tiếp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giveaway')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giveaway'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Coins className="h-4 w-4 text-amber-500" /> Tặng SenCash
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giftcodes')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giftcodes'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Gift className="h-4 w-4 text-pink-500" /> Quản Lý Mã Quà Tặng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-500" /> Quản Lý Đề Thi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'users'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Users className="h-4 w-4 text-cyan-500" /> Thành Viên & VIP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bugtracker')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'bugtracker'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Bug className="h-4 w-4 text-rose-500" /> Theo Dõi Lỗi Hệ Thống
          </button>
        </div>

        {/* TAB 1: OVERVIEW & REAL-TIME PROCTORING */}
        {activeTab === 'overview' && (
          <div className="mt-6 space-y-6">
            {/* Top 4 Stat Widgets */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Server Uptime</span>
                  <Server className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black font-mono" style={{ fontFamily: 'monospace' }}>
                  {formatUptime(uptimeSeconds)}
                </p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
                  ● 99.98% Operational
                </span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Đang trực tuyến</span>
                  <Radio className="h-5 w-5 animate-pulse text-indigo-500" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {onlineCount} <span className="text-xs font-semibold text-[#6B7280]">thí sinh</span>
                </p>
                <span className="text-[10px] text-[#6B7280] dark:text-slate-400 mt-1 block">
                  Đang hoạt động trên web
                </span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng thành viên</span>
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalUsers} <span className="text-xs font-semibold text-[#6B7280]">tài khoản</span>
                </p>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng lượt nộp bài</span>
                  <FileCheck className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalSubmissions} <span className="text-xs font-semibold text-[#6B7280]">bài</span>
                </p>
              </div>
            </div>

            {/* LIVE EXAM ROOM PROCTORING TABLE */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                    Giám Sát Phòng Thi Trực Tiếp & Cảnh Báo Thoát Trang
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400">
                  Cập nhật liên tục 5s/lần
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Thí sinh</th>
                      <th className="pb-3 font-bold uppercase">Đề thi đang làm</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Số lần thoát tab</th>
                      <th className="pb-3 font-bold uppercase">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {liveExaminees.map((item) => (
                      <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <span className="text-[11px] text-[#6B7280]">{item.email}</span>
                        </td>
                        <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400">{item.examTitle}</td>
                        <td className="py-3 font-mono">{item.timeElapsed}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${
                            item.tabSwitches > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-black/5 dark:bg-white/5'
                          }`}>
                            {item.tabSwitches} lần
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                            item.tabSwitches > 2
                              ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GIVEAWAY SENCASH */}
        {activeTab === 'giveaway' && (
          <div className="mt-6 max-w-2xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  Giveaway Tặng SenCash
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Cộng trực tiếp SenCash vào ví học sinh theo địa chỉ Email đăng ký.
                </p>
              </div>
            </div>

            <form onSubmit={handleGiveawaySenCash} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Email học sinh nhận thưởng
                </label>
                <input
                  type="email"
                  placeholder="vidu: hocsinh@gmail.com"
                  value={giveawayTargetEmail}
                  onChange={(e) => setGiveawayTargetEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-xs sm:text-sm font-semibold outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Số lượng SenCash tặng
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['50', '100', '200', '500'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setGiveawayAmount(amt)}
                      className={`rounded-xl py-2 text-xs font-black border transition ${
                        giveawayAmount === amt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                      }`}
                    >
                      +{amt} SC
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={giveawayAmount}
                  onChange={(e) => setGiveawayAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Lời nhắn / Lý do tặng
                </label>
                <input
                  type="text"
                  placeholder="Quà tặng vinh danh sĩ tử đạt điểm cao..."
                  value={giveawayReason}
                  onChange={(e) => setGiveawayReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-semibold outline-none"
                />
              </div>

              {giveawayMsg && (
                <div className={`rounded-2xl border p-4 text-xs font-bold flex items-center gap-2 ${
                  giveawayMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                }`}>
                  {giveawayMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{giveawayMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={giveawayLoading || !giveawayTargetEmail.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {giveawayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Tặng SenCash Ngay
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: GIFT CODES MANAGEMENT */}
        {activeTab === 'giftcodes' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Code Form */}
            <div className="lg:col-span-1 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                <Gift className="h-5 w-5 text-pink-500" /> Tạo Mã Quà Tặng Mới
              </h3>

              <form onSubmit={handleCreateGiftCodes} className="space-y-3.5 text-xs font-bold">
                <div>
                  <span className="text-[#6B7280] block mb-1">Loại phần thưởng:</span>
                  <select
                    value={codeType}
                    onChange={(e) => setCodeType(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="sencash">Tặng SenCash</option>
                    <option value="vip_days">Tặng Ngày VIP</option>
                    <option value="senai_tier">Tặng Gói SenAI Ultra</option>
                  </select>
                </div>

                {codeType === 'sencash' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượng SenCash:</span>
                    <input
                      type="number"
                      value={codeAmount}
                      onChange={(e) => setCodeAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                {codeType === 'vip_days' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số ngày VIP:</span>
                    <input
                      type="number"
                      value={codeVipDays}
                      onChange={(e) => setCodeVipDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượt dùng:</span>
                    <input
                      type="number"
                      min="1"
                      value={codeMaxUses}
                      onChange={(e) => setCodeMaxUses(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-1">Hạn dùng (ngày):</span>
                    <input
                      type="number"
                      min="1"
                      value={codeExpiresDays}
                      onChange={(e) => setCodeExpiresDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7280] block mb-1">Số lượng mã muốn tạo:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={codeBatchCount}
                    onChange={(e) => setCodeBatchCount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={codeLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50 mt-2"
                >
                  {codeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Tạo Mã 16 Ký Tự
                </button>
              </form>
            </div>

            {/* Codes List Table */}
            <div className="lg:col-span-2 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Danh Sách Mã Quà Tặng Đã Tạo ({giftCodes.length})
              </h3>

              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Mã (16 ký tự)</th>
                      <th className="pb-3 font-bold uppercase">Phần thưởng</th>
                      <th className="pb-3 font-bold uppercase">Đã dùng</th>
                      <th className="pb-3 font-bold uppercase">Hạn dùng</th>
                      <th className="pb-3 font-bold uppercase text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {giftCodes.map((c) => (
                      <tr key={c.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3 font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {c.code}
                        </td>
                        <td className="py-3">{describeGiftReward(c)}</td>
                        <td className="py-3">
                          {c.used_count}/{c.max_uses}
                        </td>
                        <td className="py-3 text-[11px] text-[#6B7280]">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.id, c.code)}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 text-[11px] font-bold hover:bg-black/5"
                          >
                            {copiedCodeId === c.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedCodeId === c.id ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EXAMS MANAGER */}
        {activeTab === 'exams' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 pl-10 pr-3 text-xs font-semibold outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowCreateExamModal(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
              >
                <Plus className="h-4 w-4" /> Soạn Đề Thi Mới
              </button>
            </div>

            {/* Exams Table */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Tên đề thi</th>
                      <th className="pb-3 font-bold uppercase">Loại kỳ thi</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Xem lại đáp án</th>
                      <th className="pb-3 font-bold uppercase text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {examsList
                      .filter((e) => (e.title || '').toLowerCase().includes(examSearch.toLowerCase().trim()))
                      .map((exam) => (
                        <tr key={exam.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="py-3 font-bold max-w-xs truncate">{exam.title}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 font-bold text-[10px]">
                              {exam.exam_type}
                            </span>
                          </td>
                          <td className="py-3">{exam.duration} phút</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              exam.allow_review ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                            }`}>
                              {exam.allow_review ? 'Đang mở' : 'Đã khóa'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/new-exams/${exam.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold hover:bg-black/10"
                            >
                              <Eye className="h-3 w-3" /> Xem phòng thi
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: USERS & VIP */}
        {activeTab === 'users' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Quản Lý Học Sinh & Phân Quyền ({usersList.length})
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                    <th className="pb-3 font-bold uppercase">Họ tên & Email</th>
                    <th className="pb-3 font-bold uppercase">Vai trò</th>
                    <th className="pb-3 font-bold uppercase">Số dư SenCash</th>
                    <th className="pb-3 font-bold uppercase">Hạn VIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-3">
                        <p className="font-bold">{u.full_name || 'Học sinh'}</p>
                        <span className="text-[11px] text-[#6B7280]">{u.email || u.id}</span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 font-bold uppercase text-[10px]">
                          {u.role || 'student'}
                        </span>
                      </td>
                      <td className="py-3 font-black text-amber-600 dark:text-amber-400">
                        {(u.sencash_balance || 0).toLocaleString('vi-VN')} SC
                      </td>
                      <td className="py-3 text-[11px] text-[#6B7280]">
                        {u.vip_expires_at ? new Date(u.vip_expires_at).toLocaleDateString('vi-VN') : 'Miễn phí'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: BUG TRACKER */}
        {activeTab === 'bugtracker' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black flex items-center gap-2 text-rose-500" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              <Bug className="h-5 w-5" /> Nhật Ký Báo Lỗi Từ Người Dùng
            </h3>

            <div className="space-y-3">
              {bugReports.map((b) => (
                <div key={b.id} className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-xs font-semibold space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{b.user}</span>
                    <span className="text-[11px] text-[#6B7280]">{b.time}</span>
                  </div>
                  <p className="font-mono text-rose-600 dark:text-rose-400 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                    {b.error}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 font-black uppercase">Trạng thái: {b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE EXAM MODAL */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[30px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              Soạn Đề Thi Mới & Upload PDF
            </h3>

            <form onSubmit={handleCreateNewExam} className="space-y-3 text-xs font-bold">
              <div>
                <span className="text-[#6B7280] block mb-1">Tên đề thi:</span>
                <input
                  type="text"
                  placeholder="Đề thi thử THPT Quốc Gia môn Toán 2026..."
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#6B7280] block mb-1">Loại kỳ thi:</span>
                  <select
                    value={newExamType}
                    onChange={(e) => setNewExamType(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[#6B7280] block mb-1">Thời gian (phút):</span>
                  <input
                    type="number"
                    value={newExamDuration}
                    onChange={(e) => setNewExamDuration(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="text-[#6B7280] block mb-1">Số câu hỏi (mặc định trắc nghiệm 4 đáp án):</span>
                <input
                  type="number"
                  value={newExamQCount}
                  onChange={(e) => setNewExamQCount(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                />
              </div>

              <div>
                <span className="text-[#6B7280] block mb-1">Đính kèm tệp PDF đề thi:</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setNewExamPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingExam}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase shadow transition disabled:opacity-50"
                >
                  {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  Xuất Bản Đề Thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
