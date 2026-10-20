'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Users,
  Clock,
  QrCode,
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Flame,
  Loader2,
  Copy,
  Check,
  Building,
  Calendar,
  Layers,
  HelpCircle,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
} from 'lucide-react'
import { isValidAdminDailyPassword, getExpectedAdminDailyPassword } from '@/lib/nopQuyLopAuth'
import {
  saveAdminSession,
  getAdminSession,
  clearAdminSession,
  isCurrentAdminSessionValid,
  formatAdminRemainingTime,
} from '@/lib/nopQuyLopAdminSession'
import { VIETNAM_BANKS } from '@/lib/vietQrHelper'

interface FundSummary {
  id: string
  title: string
  className: string
  amountPerPerson: number
  dueDate: string
  bankName: string
  bankAccount: string
  accountName: string
  description?: string
  totalStudents: number
  paidStudents: number
  unpaidStudents: number
  overdueOneWeekStudents: number
  totalCollected: number
  targetAmount: number
  initialBalance?: number
  totalExpenses?: number
  currentBalance?: number
  progressPercent: number
  isPastDueDate: boolean
  isOverdueOneWeek: boolean
  createdAt: string
}

export default function NopQuyLopHomePage() {
  const [funds, setFunds] = useState<FundSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form tạo quỹ mới
  const [createTitle, setCreateTitle] = useState('')
  const [createClassName, setCreateClassName] = useState('ME2')
  const [createAmount, setCreateAmount] = useState('100000')
  const [createInitialBalance, setCreateInitialBalance] = useState('0')
  const [createDueDate, setCreateDueDate] = useState('')
  const [createBankName, setCreateBankName] = useState('VietABank - PGD Tây Hồ')
  const [createBankAccount, setCreateBankAccount] = useState('00222085')
  const [createAccountName, setCreateAccountName] = useState('TRAN DUY KHUONG')
  const [createDescription, setCreateDescription] = useState('')
  const [createAdminPasscode, setCreateAdminPasscode] = useState('me2@2026')
  const [rawTextList, setRawTextList] = useState('')

  // Trích xuất AI
  const [isAiParsing, setIsAiParsing] = useState(false)
  const [aiParsedStudents, setAiParsedStudents] = useState<Array<{ id: string; name: string; mssv?: string }>>([])
  const [aiMessage, setAiMessage] = useState('')
  const [creatingFund, setCreatingFund] = useState(false)
  const [createError, setCreateError] = useState('')

  // Admin Authentication State
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminAuthError, setAdminAuthError] = useState('')
  const [isAdminVerified, setIsAdminVerified] = useState(false)
  const [adminRemainingTime, setAdminRemainingTime] = useState('')

  // Modal Share QR
  const [shareQrFund, setShareQrFund] = useState<FundSummary | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Xóa đợt thu quỹ (Yêu cầu xác thực Admin)
  const [fundToDelete, setFundToDelete] = useState<FundSummary | null>(null)
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false)
  const [deleteAdminUsername, setDeleteAdminUsername] = useState('')
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Lắng nghe và đồng bộ phiên Admin (30 phút)
  useEffect(() => {
    const updateAdminTimer = () => {
      const session = getAdminSession()
      if (session && session.expiresAt > Date.now()) {
        setIsAdminVerified(true)
        setAdminRemainingTime(formatAdminRemainingTime(session.expiresAt))
      } else {
        setIsAdminVerified(false)
        setAdminRemainingTime('')
      }
    }
    updateAdminTimer()
    const timer = setInterval(updateAdminTimer, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenDeleteModal = (fund: FundSummary) => {
    setFundToDelete(fund)
    const session = getAdminSession()
    if (session && session.expiresAt > Date.now()) {
      setDeleteAdminUsername('admin')
      setDeleteAdminPassword(session.adminPassword)
    } else {
      setDeleteAdminUsername('')
      setDeleteAdminPassword('')
    }
    setDeleteError('')
    setShowDeleteAuthModal(true)
  }

  const handleDeleteFund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundToDelete) return

    const session = getAdminSession()
    const pass = deleteAdminPassword.trim() || (session ? session.adminPassword : '')
    const user = deleteAdminUsername.trim() || (session ? session.adminUsername : 'admin')

    if (user !== 'admin' || !isValidAdminDailyPassword(pass)) {
      setDeleteError('Tài khoản hoặc mật khẩu quản trị không chính xác!')
      return
    }

    setIsDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/nopquylop/funds/${fundToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: user,
          adminPassword: pass,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json.error || 'Lỗi khi xóa đợt thu quỹ')
        return
      }

      // Duy trì phiên admin 30 phút
      saveAdminSession(pass)
      setIsAdminVerified(true)
      setShowDeleteAuthModal(false)
      setFundToDelete(null)
      fetchFunds()
    } catch (err: any) {
      setDeleteError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenCreateModal = () => {
    if (isCurrentAdminSessionValid()) {
      setShowCreateModal(true)
    } else {
      setShowAdminAuthModal(true)
      setAdminAuthError('')
    }
  }

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminUsername.trim() !== 'admin' || !isValidAdminDailyPassword(adminPassword)) {
      setAdminAuthError('Tài khoản hoặc mật khẩu quản trị không chính xác!')
      return
    }
    saveAdminSession(adminPassword.trim())
    setIsAdminVerified(true)
    setShowAdminAuthModal(false)
    setShowCreateModal(true)
    setAdminAuthError('')
  }

  const fetchFunds = async () => {
    try {
      const res = await fetch('/api/nopquylop/funds')
      const json = await res.json()
      if (res.ok && Array.isArray(json.funds)) {
        setFunds(json.funds)
      }
    } catch (err) {
      console.error('Fetch funds error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFunds()
    fetch('/api/nopquylop/bank-config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg) {
          if (cfg.bankName) setCreateBankName(cfg.bankName)
          if (cfg.accountNo) setCreateBankAccount(cfg.accountNo)
          if (cfg.accountName) setCreateAccountName(cfg.accountName)
        }
      })
      .catch(() => {})
  }, [])

  // Hàm trích xuất họ tên & MSSV cục bộ trên máy khách (chống lỗi mạng/Safari Load failed)
  const parseStudentListLocally = (rawText: string) => {
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    const students: Array<{ id: string; name: string; mssv?: string }> = []
    let count = 1

    for (const line of lines) {
      if (/^(stt|họ và tên|danh sách|mssv|lớp|quỹ|stt\t|tên|ngày sinh|ghi chú)/i.test(line)) continue
      const mssvMatch = line.match(/\b(\d{7,10})\b/)
      const mssv = mssvMatch ? mssvMatch[1] : ''
      let cleaned = line.replace(/^\d+[\.\/\-\)]\s*/, '')
      if (mssv) {
        cleaned = cleaned.replace(mssv, '').replace(/[,\t\-\|]/g, ' ')
      }
      cleaned = cleaned.replace(/[0-9\t\-\|\(\)]/g, ' ').replace(/\s+/g, ' ').trim()
      if (cleaned.length >= 2) {
        students.push({
          id: String(count++),
          name: cleaned,
          mssv: mssv || undefined,
        })
      }
    }
    return students
  }

  // Xử lý AI Gemini lọc danh sách với cơ chế đa tầng bảo vệ
  const handleAiParseList = async () => {
    if (!rawTextList.trim()) {
      setCreateError('Vui lòng dán văn bản danh sách lớp vào khung trước khi lọc')
      return
    }

    setIsAiParsing(true)
    setCreateError('')
    setAiMessage('')
    try {
      const res = await fetch('/api/nopquylop/ai-parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextList }),
      })
      const json = await res.json()

      if (res.ok && Array.isArray(json.students) && json.students.length > 0) {
        setAiParsedStudents(json.students)
        setAiMessage(
          `Trích xuất thành công ${json.students.length} sinh viên bằng AI (gemini-3.5-flash-lite)! Vui lòng kiểm tra lại bảng bên dưới.`
        )
        return
      }
    } catch (err: any) {
      console.warn('Lỗi gọi API AI từ trình duyệt, chuyển ngay sang bộ lọc thông minh cục bộ:', err)
    }

    // Dự phòng cục bộ (bảo đảm 100% không bao giờ bị dừng lại bởi lỗi Safari "Load failed")
    const localStudents = parseStudentListLocally(rawTextList)
    if (localStudents.length > 0) {
      setAiParsedStudents(localStudents)
      setAiMessage(
        `Đã trích xuất thành công ${localStudents.length} sinh viên từ danh sách lớp! Vui lòng kiểm tra lại bảng bên dưới.`
      )
    } else {
      setCreateError('Không tìm thấy họ tên sinh viên hợp lệ trong văn bản. Vui lòng kiểm tra lại định dạng danh sách.')
    }
    setIsAiParsing(false)
  }

  // Submit tạo quỹ
  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingFund(true)
    setCreateError('')

    try {
      if (!createTitle.trim()) {
        setCreateError('Vui lòng nhập tên đợt thu quỹ')
        setCreatingFund(false)
        return
      }

      const amount = Number(createAmount.replace(/[^0-9]/g, ''))
      if (!amount || amount <= 0) {
        setCreateError('Số tiền mỗi người phải lớn hơn 0')
        setCreatingFund(false)
        return
      }

      // Nếu chưa lọc AI mà đã dán text, tự động parse fallback hoặc bắt buộc parse
      let finalStudents = aiParsedStudents
      if (finalStudents.length === 0 && rawTextList.trim()) {
        const lines = rawTextList
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        finalStudents = lines.map((line, idx) => ({
          id: String(idx + 1),
          name: line.replace(/^\d+[\.\/\-\)]\s*/, '').trim(),
        }))
      }

      if (finalStudents.length === 0) {
        setCreateError('Danh sách sinh viên lớp không được để trống. Hãy dán danh sách và bấm "Lọc Bằng AI".')
        setCreatingFund(false)
        return
      }

      const session = getAdminSession()
      const pass = adminPassword.trim() || (session ? session.adminPassword : '')
      const user = adminUsername.trim() || (session ? session.adminUsername : 'admin')

      const payload = {
        title: createTitle,
        className: createClassName || 'ME2',
        amountPerPerson: amount,
        dueDate: createDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        bankName: 'VietABank - PGD Tây Hồ',
        bankAccount: '00222085',
        accountName: 'TRAN DUY KHUONG',
        description: createDescription,
        adminPasscode: createAdminPasscode,
        initialBalance: Number(createInitialBalance) || 0,
        adminUsername: user,
        adminPassword: pass,
        students: finalStudents,
      }

      const res = await fetch('/api/nopquylop/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Không thể tạo đợt thu quỹ')
        setCreatingFund(false)
        return
      }

      // Duy trì phiên admin 30 phút
      if (pass) saveAdminSession(pass)
      setIsAdminVerified(true)

      // Reset form
      setShowCreateModal(false)
      setCreateTitle('')
      setCreateInitialBalance('0')
      setRawTextList('')
      setAiParsedStudents([])
      await fetchFunds()
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi gửi yêu cầu tạo quỹ')
    } finally {
      setCreatingFund(false)
    }
  }

  // Copy link quỹ
  const handleCopyFundLink = (fundId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nopquylop.senexam.me'
    const shareUrl = `${origin}/nopquylop/${fundId}`
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // Thống kê tổng hợp (chỉ tính các quỹ công khai, không tính quỹ test)
  const publicFunds = funds.filter(
    (f) => !f.id.includes('test') && !(f as any).isTestFund
  )
  const totalFundsCount = publicFunds.length
  const totalAmountCollectedAll = publicFunds.reduce((acc, f) => acc + f.totalCollected, 0)
  const totalOverdueStudentsCount = publicFunds.reduce((acc, f) => acc + f.overdueOneWeekStudents, 0)

  // QUY TẮC BẮT BUỘC: "chỉ khi kích hoạt admin mới có thể thấy được Quỹ Test này"
  const filteredFunds = funds.filter((f) => {
    const isTest = f.id.includes('test') || (f as any).isTestFund || f.id === 'quy-test-hoang-binh-minh'
    if (isTest && !isAdminVerified) {
      return false
    }

    if (!searchQuery.trim()) return true
    return (
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.className.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Quỹ Lớp ME2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Hệ thống theo dõi & nộp quỹ lớp tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {adminRemainingTime ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shadow-xs">
                <Unlock className="h-3.5 w-3.5" />
                <span>Admin ({adminRemainingTime})</span>
                <button
                  type="button"
                  onClick={() => {
                    clearAdminSession()
                    setIsAdminVerified(false)
                    setAdminRemainingTime('')
                  }}
                  title="Thoát phiên Admin"
                  className="ml-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminAuthModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Chế Độ Thủ Quỹ</span>
              </button>
            )}

            {isAdminVerified && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo Đợt Thu Quỹ</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner & Stats */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-700/50 dark:border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-850/85 to-slate-900/90 backdrop-blur-xl p-6 sm:p-10 text-white shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Trang dành cho việc thu quỹ ME 2
            </h1>
          </div>

          {/* Quick Stats Grid */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/10 mt-6">
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Số Đợt Thu Quỹ
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">{totalFundsCount}</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Tổng Tiền Đã Thu
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {totalAmountCollectedAll.toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Cơ Chế Kiểm Tra
              </span>
              <span className="text-xl sm:text-2xl font-black text-sky-300">Họ Tên / MSSV</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
              <span className="text-[11px] text-rose-300 font-bold uppercase block mb-1 flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-rose-400" /> Trễ Hạn &gt; 1 Tuần
              </span>
              <span className="text-xl sm:text-2xl font-black text-rose-400">
                {totalOverdueStudentsCount} bạn
              </span>
            </div>
          </div>
        </section>

        {/* Search & Actions Header */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm đợt thu quỹ lớp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black border border-indigo-200 dark:border-indigo-900">
              Lớp ME2
            </span>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>+ Thêm Thu Quỹ</span>
            </button>
          </div>
        </section>

        {/* Danh Sách Các Đợt Thu Quỹ */}
        <section className="space-y-4">
          {loading ? (
            <div className="p-12 text-center rounded-[32px] border border-black/5 dark:border-white/5 bg-white dark:bg-slate-900 space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-bold text-slate-400">Đang tải danh sách các đợt thu quỹ lớp ME2...</p>
            </div>
          ) : filteredFunds.length === 0 ? (
            <div className="p-16 text-center rounded-[32px] border border-dashed border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 space-y-4">
              <div className="h-14 w-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mx-auto">
                <Wallet className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                  Chưa có đợt thu quỹ nào
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Hãy bấm vào nút "Tạo Đợt Thu Quỹ" bên trên để tạo danh sách thu quỹ lớp đầu tiên với AI.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md hover:bg-indigo-700 transition"
              >
                + Tạo Đợt Thu Quỹ Ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFunds.map((fund) => {
                return (
                  <div
                    key={fund.id}
                    className="group rounded-[28px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-5 hover:shadow-xl hover:border-indigo-500/40 transition-all duration-300"
                  >
                    <div className="space-y-3">
                      {/* Badge status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-900">
                            {fund.className}
                          </span>
                          {((fund as any).isTestFund || fund.id.includes('test')) && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase tracking-wider border border-purple-200 dark:border-purple-800">
                              🔒 Quỹ Test (Chỉ Admin)
                            </span>
                          )}
                        </div>

                        {fund.overdueOneWeekStudents > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                            <Flame className="h-3 w-3" /> {fund.overdueOneWeekStudents} Trễ &gt; 1 tuần
                          </span>
                        ) : fund.isPastDueDate ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            Đã qua hạn nộp
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 transition-colors">
                        {fund.title}
                      </h3>

                      {fund.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                          {fund.description}
                        </p>
                      )}

                      {/* Thông tin tiền & hạn */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mức nộp/người</span>
                          <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                            {fund.amountPerPerson.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạn nộp</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {fund.dueDate ? new Date(fund.dueDate).toLocaleDateString('vi-VN') : 'Không có'}
                          </span>
                        </div>
                      </div>

                      {/* Tiến độ thu */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-500">
                            Đã nộp: <strong>{fund.paidStudents}/{fund.totalStudents}</strong>
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-black">
                            {fund.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${fund.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Số Dư Quỹ Hiện Tại */}
                      {fund.currentBalance !== undefined && (
                        <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50">
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            Số Dư Quỹ Hiện Tại:
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            {fund.currentBalance.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-black/5 dark:border-white/5">
                      <Link
                        href={`/nopquylop/${fund.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition"
                      >
                        <span>Vào Xem & Nộp Quỹ</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => setShareQrFund(fund)}
                        title="Chia sẻ mã QR / Link quỹ"
                        className="p-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>

                      {isAdminVerified && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(fund)}
                          title="Xóa đợt thu quỹ (Chỉ dành cho Admin)"
                          className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL XÁC THỰC ADMIN TẠO QUỸ (admin / admin-DD/MM/YYYY) */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Xác Thực Admin Tạo Quỹ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Bảo mật khởi tạo đợt thu quỹ lớp ME2
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminAuthModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {adminAuthError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4 text-xs font-bold">
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Tài khoản:
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Nhập tài khoản quản trị..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value)
                    if (adminAuthError) setAdminAuthError('')
                  }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Xác Thực & Tạo Quỹ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC THỰC ADMIN XÓA QUỸ (Yêu cầu tài khoản & mật khẩu như lúc tạo) */}
      {showDeleteAuthModal && fundToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-600 dark:text-rose-400">
                    Xác Thực Admin Xóa Quỹ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Xóa vĩnh viễn: {fundToDelete.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteAuthModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteFund} className="space-y-4 text-xs font-bold">
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Tài khoản:
                </label>
                <input
                  type="text"
                  required
                  value={deleteAdminUsername}
                  onChange={(e) => setDeleteAdminUsername(e.target.value)}
                  placeholder="Nhập tài khoản quản trị..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  required
                  value={deleteAdminPassword}
                  onChange={(e) => {
                    setDeleteAdminPassword(e.target.value)
                    if (deleteError) setDeleteError('')
                  }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAuthModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{isDeleting ? 'Đang Xóa...' : 'Xác Nhận Xóa Vĩnh Viễn'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO QUỸ MỚI CÓ AI GEMINI 3.5 FLASH LITE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Tạo Đợt Thu Quỹ Lớp ME2
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Hỗ trợ trích xuất & lọc danh sách lớp tự động
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-2"
              >
                ✕ Đóng
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFund} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Tên đợt thu quỹ:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Quỹ Lớp Học Kỳ 2 (2025 - 2026)"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Số tiền mỗi người (VNĐ):
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 100000"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Ô nhập số dư hiện có ban đầu của lớp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Hạn chót nộp:
                  </label>
                  <input
                    type="date"
                    required
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-indigo-700 dark:text-indigo-300 mb-1.5 uppercase tracking-wider text-[11px] font-black">
                    Số tiền hiện có ban đầu của lớp (VNĐ):
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="VD: 2500000 (Để 0 nếu bắt đầu quỹ mới)"
                    value={createInitialBalance}
                    onChange={(e) => setCreateInitialBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-black outline-none focus:border-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    Số dư có sẵn trong quỹ lớp trước đợt thu này (dùng cộng dồn và trừ bill).
                  </span>
                </div>
              </div>

              {/* THÔNG TIN TÀI KHOẢN THỦ QUỸ KHƯƠNG - BỊ BÔI XÁM KHÓA CỐ ĐỊNH */}
              <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    Tài Khoản Thủ Quỹ Nhận Tiền (Cố Định - Không Thay Đổi)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                    Khóa Cố Định ME2
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Ngân hàng:
                    </label>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value="VietABank - PGD Tây Hồ"
                      className="w-full px-3 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-not-allowed border border-slate-300 dark:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Số tài khoản:
                    </label>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value="00222085"
                      className="w-full px-3 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs cursor-not-allowed border border-slate-300 dark:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Tên chủ tài khoản:
                    </label>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value="TRAN DUY KHUONG"
                      className="w-full px-3 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-not-allowed border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Mặc định thủ quỹ là bạn <strong>Trần Duy Khương</strong> nhận quỹ lớp ME2. Tài khoản này tách biệt với SenExam, sinh viên nộp tiền sẽ quét mã VietQR tự động chuyển vào tài khoản trên.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Mã bảo mật thủ quỹ (để duyệt nộp):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: me2@2026"
                    value={createAdminPasscode}
                    onChange={(e) => setCreateAdminPasscode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                  Mục đích thu quỹ:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú chi tiết mục đích sử dụng quỹ..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                />
              </div>

              {/* VÙNG NHẬP DANH SÁCH LỚP BẰNG AI */}
              <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-600" />
                    Dán Danh Sách Lớp Để Tự Động Phân Tách
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Hỗ trợ Excel, Zalo, Notepad
                  </span>
                </div>

                <textarea
                  rows={4}
                  placeholder="Dán danh sách lớp vào đây (Ví dụ:&#10;1. 20221001 Nguyễn Văn An&#10;2. 20221002 Trần Thị Bích...)"
                  value={rawTextList}
                  onChange={(e) => setRawTextList(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs font-mono outline-none focus:border-blue-600"
                />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAiParseList}
                    disabled={isAiParsing || !rawTextList.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition disabled:opacity-40"
                  >
                    {isAiParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang xử lý phân tách danh sách...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        <span>Tự Động Phân Tách Danh Sách</span>
                      </>
                    )}
                  </button>

                  {aiParsedStudents.length > 0 && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Đã trích xuất: {aiParsedStudents.length} sinh viên
                    </span>
                  )}
                </div>

                {aiMessage && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ✓ {aiMessage}
                  </p>
                )}

                {/* BẢNG PREVIEW KẾT QUẢ AI ĐÃ LỌC */}
                {aiParsedStudents.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-2">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-black/5 dark:border-white/5 text-slate-400">
                          <th className="p-1.5 w-12">STT</th>
                          <th className="p-1.5">Họ và Tên</th>
                          <th className="p-1.5">MSSV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {aiParsedStudents.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-1.5 text-slate-400">{idx + 1}</td>
                            <td className="p-1.5 font-bold text-slate-900 dark:text-white">{s.name}</td>
                            <td className="p-1.5 font-mono text-indigo-600 dark:text-indigo-400">
                              {s.mssv || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={creatingFund}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md transition disabled:opacity-40"
                >
                  {creatingFund ? 'Đang tạo quỹ...' : 'Tạo Đợt Thu Quỹ Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SHARE QR & LINK */}
      {shareQrFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 text-center text-slate-900 dark:text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <h3 className="text-base font-black">Chia Sẻ Quỹ Lớp ME2</h3>
              <button
                type="button"
                onClick={() => setShareQrFund(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-black/10 inline-block shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  `${typeof window !== 'undefined' ? window.location.origin : 'https://nopquylop.senexam.me'}/nopquylop/${shareQrFund.id}`
                )}`}
                alt="QR Link Quỹ Lớp"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black">{shareQrFund.title}</h4>
              <p className="text-xs text-slate-500 font-medium">
                Mức nộp: <strong className="text-indigo-600">{shareQrFund.amountPerPerson.toLocaleString('vi-VN')} đ</strong> / sinh viên
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopyFundLink(shareQrFund.id)}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition flex items-center justify-center gap-2"
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLink ? 'Đã Sao Chép Link!' : 'Sao Chép Link Quỹ'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
