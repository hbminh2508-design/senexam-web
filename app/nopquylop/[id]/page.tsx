'use client'

import { useState, useEffect, useMemo, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  Users,
  Clock,
  Sparkles,
  QrCode,
  Share2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  Copy,
  Check,
  Building,
  Calendar,
  Flame,
  ShieldCheck,
  CreditCard,
  Loader2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { isValidAdminDailyPassword } from '@/lib/nopQuyLopAuth'

interface Student {
  id: string
  name: string
  mssv?: string
  paid: boolean
  paidAt?: string
  paymentCode?: string
  note?: string
}

interface FundDetail {
  id: string
  title: string
  className: string
  amountPerPerson: number
  dueDate: string
  bankName: string
  bankAccount: string
  accountName: string
  description?: string
  adminPasscode?: string
  students: Student[]
  createdAt: string
  updatedAt: string
}

export default function FundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const fundId = resolvedParams.id

  const [fund, setFund] = useState<FundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all')

  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false)
  const [payInput, setPayInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [payError, setPayError] = useState('')
  const [paymentData, setPaymentData] = useState<{
    student: Student
    paymentCode: string
    qrUrl: string
    amount: number
    bankName: string
    bankAccount: string
    accountName: string
    transferNote: string
    alreadyPaid?: boolean
    message?: string
  } | null>(null)
  const [autoPaidSuccess, setAutoPaidSuccess] = useState(false)

  // Admin Mode (Thủ quỹ duyệt trực tiếp)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [showAdminPassModal, setShowAdminPassModal] = useState(false)
  const [adminPassInput, setAdminPassInput] = useState('')
  const [adminPassError, setAdminPassError] = useState('')
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null)

  const router = useRouter()

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedNote, setCopiedNote] = useState(false)
  const [copiedAccount, setCopiedAccount] = useState(false)

  // Xóa Quỹ (Admin xác thực)
  const [showDeleteAdminModal, setShowDeleteAdminModal] = useState(false)
  const [deleteAdminUsername, setDeleteAdminUsername] = useState('')
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingFund, setIsDeletingFund] = useState(false)

  const handleDeleteThisFund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deleteAdminUsername.trim() !== 'admin' || !isValidAdminDailyPassword(deleteAdminPassword)) {
      setDeleteError('Tài khoản hoặc mật khẩu quản trị không chính xác!')
      return
    }

    setIsDeletingFund(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/nopquylop/funds/${fundId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: deleteAdminUsername.trim(),
          adminPassword: deleteAdminPassword.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json.error || 'Lỗi khi xóa đợt thu quỹ')
        return
      }

      setShowDeleteAdminModal(false)
      router.push('/nopquylop')
    } catch (err: any) {
      setDeleteError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setIsDeletingFund(false)
    }
  }

  // Xóa 1 sinh viên / người nộp quỹ (Yêu cầu xác minh Admin)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false)
  const [deleteStudentAdminUsername, setDeleteStudentAdminUsername] = useState('')
  const [deleteStudentAdminPassword, setDeleteStudentAdminPassword] = useState('')
  const [deleteStudentError, setDeleteStudentError] = useState('')
  const [isDeletingStudent, setIsDeletingStudent] = useState(false)

  const handleOpenDeleteStudentModal = (student: Student) => {
    setStudentToDelete(student)
    setDeleteStudentAdminUsername('')
    setDeleteStudentAdminPassword('')
    setDeleteStudentError('')
    setShowDeleteStudentModal(true)
  }

  const handleDeleteStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentToDelete) return

    if (deleteStudentAdminUsername.trim() !== 'admin' || !isValidAdminDailyPassword(deleteStudentAdminPassword)) {
      setDeleteStudentError('Tài khoản hoặc mật khẩu quản trị không chính xác!')
      return
    }

    setIsDeletingStudent(true)
    setDeleteStudentError('')
    try {
      const res = await fetch(`/api/nopquylop/funds/${fundId}/students/${studentToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: deleteStudentAdminUsername.trim(),
          adminPassword: deleteStudentAdminPassword.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setDeleteStudentError(json.error || 'Lỗi khi xóa người nộp quỹ')
        return
      }

      setShowDeleteStudentModal(false)
      setStudentToDelete(null)
      fetchFund()
    } catch (err: any) {
      setDeleteStudentError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setIsDeletingStudent(false)
    }
  }

  const fetchFund = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/nopquylop/funds/${fundId}`)
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không thể tải thông tin quỹ lớp')
        return
      }
      setFund(json.fund)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFund()
  }, [fundId])

  // Tự động đối soát giao dịch VietQR qua SePay theo thời gian thực (chống gian lận)
  useEffect(() => {
    if (!showPayModal || !paymentData || paymentData.alreadyPaid || autoPaidSuccess) return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/nopquylop/funds/${fundId}/pay-status?code=${paymentData.paymentCode}&studentId=${paymentData.student.id}`
        )
        const json = await res.json()
        if (json.paid) {
          setAutoPaidSuccess(true)
          fetchFund()
        }
      } catch (err) {
        console.warn('Lỗi polling đối soát SePay:', err)
      }
    }, 2500)

    return () => clearInterval(timer)
  }, [showPayModal, paymentData, autoPaidSuccess, fundId])

  // Tính toán thời gian quá hạn 1 tuần
  const isFundOverdueOneWeek = useMemo(() => {
    if (!fund?.dueDate) return false
    const now = Date.now()
    const due = new Date(fund.dueDate).getTime()
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
    return now - due > ONE_WEEK_MS
  }, [fund?.dueDate])

  // Thống kê
  const stats = useMemo(() => {
    if (!fund) return { total: 0, paid: 0, unpaid: 0, overdue: 0, collected: 0, target: 0, percent: 0 }
    const total = fund.students.length
    const paid = fund.students.filter((s) => s.paid).length
    const unpaid = total - paid
    const overdue = fund.students.filter((s) => !s.paid && isFundOverdueOneWeek).length
    const collected = paid * fund.amountPerPerson
    const target = total * fund.amountPerPerson
    const percent = target > 0 ? Math.round((collected / target) * 100) : 0
    return { total, paid, unpaid, overdue, collected, target, percent }
  }, [fund, isFundOverdueOneWeek])

  // SẮP XẾP DANH SÁCH:
  // QUY TẮC BẮT BUỘC: "chậm nộp quá 1 tuần tên sẽ bị bôi đỏ và đưa lên đầu danh sách"
  const sortedAndFilteredStudents = useMemo(() => {
    if (!fund) return []

    let list = [...fund.students]

    // 1. Lọc theo ô tìm kiếm (Họ tên hoặc MSSV)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.mssv && s.mssv.toLowerCase().includes(q))
      )
    }

    // 2. Lọc theo Tab
    if (activeTab === 'paid') {
      list = list.filter((s) => s.paid)
    } else if (activeTab === 'unpaid') {
      list = list.filter((s) => !s.paid)
    } else if (activeTab === 'overdue') {
      list = list.filter((s) => !s.paid && isFundOverdueOneWeek)
    }

    // 3. SẮP XẾP ƯU TIÊN:
    // Sinh viên trễ hạn > 7 ngày được đưa LÊN ĐẦU DANH SÁCH
    list.sort((a, b) => {
      const aOverdue = !a.paid && isFundOverdueOneWeek
      const bOverdue = !b.paid && isFundOverdueOneWeek

      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      if (!a.paid && b.paid) return -1
      if (a.paid && !b.paid) return 1
      return 0
    })

    return list
  }, [fund, searchTerm, activeTab, isFundOverdueOneWeek])

  // Xử lý nộp tiền (sinh mã QR)
  const handleVerifyStudentPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payInput.trim()) {
      setPayError('Vui lòng nhập Họ và Tên hoặc MSSV của bạn')
      return
    }

    setIsVerifying(true)
    setPayError('')
    setPaymentData(null)

    try {
      const res = await fetch(`/api/nopquylop/funds/${fundId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: payInput.trim() }),
      })
      const json = await res.json()

      if (!res.ok) {
        // Cảnh báo nếu không khớp cả 2
        setPayError(
          json.error ||
            'Không tìm thấy thông tin của bạn trong danh sách lớp ME2. Vui lòng kiểm tra lại chính xác Họ & Tên hoặc MSSV!'
        )
        return
      }

      setPaymentData(json)
    } catch (err: any) {
      setPayError(err.message || 'Lỗi xử lý xác nhận')
    } finally {
      setIsVerifying(false)
    }
  }

  // Thủ quỹ đổi trạng thái nộp tiền của sinh viên
  const handleToggleStudentPaid = async (student: Student) => {
    if (!isAdminMode) {
      setShowAdminPassModal(true)
      return
    }

    setUpdatingStudentId(student.id)
    try {
      const res = await fetch(`/api/nopquylop/funds/${fundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          paid: !student.paid,
          adminPasscode: adminPassInput,
        }),
      })

      if (res.ok) {
        await fetchFund()
      } else {
        const json = await res.json()
        alert(json.error || 'Lỗi cập nhật trạng thái nộp tiền')
      }
    } catch (err) {
      alert('Lỗi cập nhật')
    } finally {
      setUpdatingStudentId(null)
    }
  }

  // Xác nhận passcode thủ quỹ
  const handleUnlockAdminMode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fund?.adminPasscode || adminPassInput === fund.adminPasscode) {
      setIsAdminMode(true)
      setShowAdminPassModal(false)
      setAdminPassError('')
    } else {
      setAdminPassError('Mã bảo mật thủ quỹ không chính xác!')
    }
  }

  // Copy helpers
  const handleCopy = (text: string, type: 'link' | 'account' | 'note') => {
    navigator.clipboard.writeText(text)
    if (type === 'link') {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } else if (type === 'account') {
      setCopiedAccount(true)
      setTimeout(() => setCopiedAccount(false), 2000)
    } else if (type === 'note') {
      setCopiedNote(true)
      setTimeout(() => setCopiedNote(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500">Đang tải thông tin quỹ lớp ME2...</p>
        </div>
      </div>
    )
  }

  if (errorMsg || !fund) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full p-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Không tìm thấy quỹ</h2>
          <p className="text-xs text-slate-500">{errorMsg || 'Đợt thu quỹ này không tồn tại hoặc đã bị xóa.'}</p>
          <Link
            href="/nopquylop"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại trang chủ quỹ ME2
          </Link>
        </div>
      </div>
    )
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://nopquylop.senexam.me/nopquylop/${fund.id}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/nopquylop"
            className="inline-flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Trang Chủ Quỹ Lớp ME2</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isAdminMode) {
                  setIsAdminMode(false)
                } else {
                  setShowAdminPassModal(true)
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isAdminMode
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5'
              }`}
            >
              {isAdminMode ? <Unlock className="h-3.5 w-3.5 text-amber-500" /> : <Lock className="h-3.5 w-3.5" />}
              <span>{isAdminMode ? 'Thủ Quỹ (Bật)' : 'Chế Độ Thủ Quỹ'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Chia Sẻ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteAdminUsername('')
                setDeleteAdminPassword('')
                setDeleteError('')
                setShowDeleteAdminModal(true)
              }}
              title="Xóa đợt thu quỹ (Chỉ dành cho Admin)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs font-bold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Xóa Quỹ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner Quỹ & Thông Tin Nhận Tiền */}
        <section className="relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase border border-indigo-200 dark:border-indigo-800">
                  {fund.className}
                </span>

                {isFundOverdueOneWeek ? (
                  <span className="px-3 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-black text-xs uppercase border border-rose-200 dark:border-rose-900 flex items-center gap-1 animate-pulse">
                    <Flame className="h-3.5 w-3.5" /> Quá hạn nộp &gt; 1 tuần
                  </span>
                ) : (
                  <span className="px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase border border-emerald-200 dark:border-emerald-900">
                    Đang thu quỹ công khai
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                {fund.title}
              </h1>

              {fund.description && (
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                  {fund.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Hạn nộp: <strong className="text-slate-800 dark:text-slate-200">{fund.dueDate ? new Date(fund.dueDate).toLocaleDateString('vi-VN') : 'Không có'}</strong>
                </span>

                <span className="flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-slate-400" />
                  Ngân hàng: <strong className="text-slate-800 dark:text-slate-200">{fund.bankName} - {fund.bankAccount} ({fund.accountName})</strong>
                </span>
              </div>
            </div>

            {/* Nút bấm Nộp Tiền Quỹ */}
            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPayModal(true)
                  setPayError('')
                  setPaymentData(null)
                }}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="h-5 w-5" />
                <span>Nộp Tiền Quỹ (Lấy Mã QR)</span>
              </button>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-black/5 dark:border-white/5 text-center text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Mức nộp cố định</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {fund.amountPerPerson.toLocaleString('vi-VN')} đ <span className="text-xs text-slate-400 font-medium">/ bạn</span>
                </span>
              </div>
            </div>
          </div>

          {/* Metrics & Progress Bar */}
          <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-black/5 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sĩ số lớp</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{stats.total} sinh viên</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">Đã nộp ({stats.percent}%)</span>
                <span className="text-lg font-black">{stats.paid} sinh viên</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 text-amber-800 dark:text-amber-300">
                <span className="text-[10px] uppercase font-bold text-amber-600 block mb-0.5">Chưa nộp</span>
                <span className="text-lg font-black">{stats.unpaid} sinh viên</span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${
                stats.overdue > 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-black/5 dark:border-white/5 text-slate-400'
              }`}>
                <span className="text-[10px] uppercase font-bold block mb-0.5 flex items-center gap-1">
                  <Flame className="h-3 w-3 text-rose-500" /> Trễ Hạn &gt; 1 Tuần
                </span>
                <span className="text-lg font-black">
                  {stats.overdue} bạn
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">
                  Tổng thu được: <strong className="text-emerald-600 font-black">{stats.collected.toLocaleString('vi-VN')} đ</strong> / {stats.target.toLocaleString('vi-VN')} đ
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{stats.percent}% Hoàn Thành</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Search & Tabs Filter */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất Cả ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unpaid')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'unpaid'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Chưa Nộp ({stats.unpaid})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'overdue'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚠️ Trễ Hạn &gt; 7 Ngày ({stats.overdue})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paid')}
              className={`px-3 py-1.5 rounded-xl transition ${
                activeTab === 'paid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đã Nộp ({stats.paid})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc MSSV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500"
            />
          </div>
        </section>

        {/* THÔNG BÁO QUY TẮC BÔI ĐỎ */}
        {isFundOverdueOneWeek && stats.overdue > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 animate-bounce" />
              <div>
                <strong className="font-black block uppercase tracking-wider text-[11px]">
                  Cảnh Báo Quá Hạn Nộp &gt; 7 Ngày
                </strong>
                <span className="font-medium">
                  Các sinh viên chưa hoàn thành nộp quỹ đã được bôi đỏ và tự động đưa lên đầu danh sách lớp để nhắc nhở công khai.
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs shrink-0">
              {stats.overdue} Bạn
            </span>
          </div>
        )}

        {/* DANH SÁCH SINH VIÊN CÔNG KHAI */}
        <section className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="p-4 sm:p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <span>Danh Sách Sinh Viên Lớp ME2</span>
            </h3>
            <span className="text-xs text-slate-400 font-bold">
              Hiển thị {sortedAndFilteredStudents.length} / {fund.students.length} bạn
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5 bg-slate-50/60 dark:bg-slate-800/40 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-14">STT</th>
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">MSSV</th>
                  <th className="py-3 px-4">Số Tiền</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
                {sortedAndFilteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      Không tìm thấy sinh viên nào theo điều kiện lọc này.
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredStudents.map((student, idx) => {
                    const isOverdueStudent = !student.paid && isFundOverdueOneWeek

                    return (
                      <tr
                        key={student.id}
                        className={`transition-colors ${
                          isOverdueStudent
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 text-rose-900 dark:text-rose-200'
                            : student.paid
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            : 'hover:bg-amber-50/30'
                        }`}
                      >
                        {/* STT */}
                        <td className="py-3.5 px-4 font-mono">
                          {isOverdueStudent ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-600 text-white font-black text-[10px]">
                              !
                            </span>
                          ) : (
                            <span className="text-slate-400">{idx + 1}</span>
                          )}
                        </td>

                        {/* Họ và Tên */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-black text-sm ${
                                isOverdueStudent
                                  ? 'text-rose-700 dark:text-rose-400 font-black underline decoration-rose-400 decoration-2'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {student.name}
                            </span>
                          </div>
                        </td>

                        {/* MSSV */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                          {student.mssv || '—'}
                        </td>

                        {/* Số tiền */}
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                          {fund.amountPerPerson.toLocaleString('vi-VN')} đ
                        </td>

                        {/* Trạng thái nộp */}
                        <td className="py-3.5 px-4">
                          {student.paid ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Đã Nộp
                              </span>
                              {student.paymentCode && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  {student.paymentCode}
                                </span>
                              )}
                            </div>
                          ) : isOverdueStudent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shadow-xs uppercase tracking-wider animate-pulse">
                              <Flame className="h-3.5 w-3.5" /> Trễ Hạn &gt; 7 Ngày
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                              <Clock className="h-3.5 w-3.5" /> Chưa Nộp
                            </span>
                          )}
                        </td>

                        {/* Thao tác (Duyệt nếu đang mở chế độ Admin, và nút Xóa yêu cầu Admin) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdminMode && (
                              <button
                                type="button"
                                onClick={() => handleToggleStudentPaid(student)}
                                disabled={updatingStudentId === student.id}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                                  student.paid
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                } disabled:opacity-40`}
                              >
                                {updatingStudentId === student.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : student.paid ? (
                                  'Đánh Dấu Chưa Nộp'
                                ) : (
                                  'Duyệt Đã Nộp ✓'
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteStudentModal(student)}
                              title="Xóa sinh viên này khỏi quỹ"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL NỘP TIỀN QUỸ (YÊU CẦU TÊN HOẶC MSSV VÀ SINH MÃ VIETQR) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Nộp Quỹ Lớp ME2
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Nhập Họ và Tên hoặc MSSV để hệ thống tự động nhận diện sinh viên
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPayModal(false)
                  setPayError('')
                  setPaymentData(null)
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-2"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Form Tra Cứu Sinh Viên */}
            {!paymentData && (
              <form onSubmit={handleVerifyStudentPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold">
                    Họ và Tên HOẶC Mã Số Sinh Viên (MSSV):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn An hoặc 20221001"
                    value={payInput}
                    onChange={(e) => {
                      setPayInput(e.target.value)
                      if (payError) setPayError('')
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 text-sm shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    Hệ thống sẽ đối chiếu với danh sách lớp ME2. Chỉ cần đúng 1 trong 2 thông tin.
                  </p>
                </div>

                {payError && (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-start gap-3 animate-in shake">
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-black text-rose-800 dark:text-rose-300">
                        XÁC THỰC THẤT BẠI
                      </p>
                      <p className="leading-relaxed">{payError}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying || !payInput.trim()}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang đối chiếu danh sách lớp ME2...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Xác Nhận & Sinh Mã VietQR Nộp Tiền</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* KẾT QUẢ XÁC NHẬN & MÃ VIETQR CHUYỂN KHOẢN */}
            {paymentData && (
              <div className="space-y-4">
                {autoPaidSuccess ? (
                  <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-center space-y-3 animate-in zoom-in-95">
                    <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto animate-bounce" />
                    <h4 className="font-black text-emerald-900 dark:text-emerald-200 text-lg">
                      ĐÃ NHẬN TIỀN THÀNH CÔNG!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      Hệ thống VietQR & SePay đã tự động xác thực khoản nộp{' '}
                      <strong>{paymentData.amount.toLocaleString('vi-VN')} đ</strong> của sinh viên{' '}
                      <strong>&quot;{paymentData.student.name}&quot;</strong> ({paymentData.student.mssv || 'ME2'}).
                    </p>
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                      Mã giao dịch: {paymentData.paymentCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPayModal(false)
                        setAutoPaidSuccess(false)
                        setPaymentData(null)
                        fetchFund()
                      }}
                      className="mt-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition"
                    >
                      Hoàn Tất & Đóng Cửa Sổ
                    </button>
                  </div>
                ) : paymentData.alreadyPaid ? (
                  <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                    <h4 className="font-black text-emerald-900 dark:text-emerald-200 text-base">
                      Bạn Đã Hoàn Thành Nộp Quỹ!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      {paymentData.message}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Sinh viên nộp tiền:</span>
                        <strong className="text-sm font-black text-slate-900 dark:text-white">
                          {paymentData.student.name}
                        </strong>
                        {paymentData.student.mssv && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono ml-2">
                            (MSSV: {paymentData.student.mssv})
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 font-black text-xs">
                        Đã Khớp Danh Sách
                      </span>
                    </div>

                    {/* Chỉ báo trạng thái chờ chuyển khoản thời gian thực */}
                    <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/50 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      <span>Đang tự động đối soát giao dịch ngân hàng theo thời gian thực (SePay)...</span>
                    </div>

                    {/* Mã QR VietQR */}
                    <div className="p-3 bg-white rounded-3xl border border-black/10 text-center shadow-xs">
                      <img
                        src={paymentData.qrUrl}
                        alt="Mã VietQR nộp tiền quỹ"
                        className="w-56 h-56 mx-auto object-contain"
                      />
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        Quét mã trên app ngân hàng bất kỳ để tự động điền số tiền & nội dung
                      </p>
                    </div>

                    {/* Thông tin chuyển khoản chi tiết */}
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Ngân hàng:</span>
                        <strong className="font-black text-slate-800 dark:text-white">{paymentData.bankName}</strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Chủ tài khoản:</span>
                        <strong className="font-black text-slate-800 dark:text-white">{paymentData.accountName}</strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Số tài khoản:</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentData.bankAccount, 'account')}
                          className="font-mono font-black text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 hover:underline"
                        >
                          {paymentData.bankAccount}
                          {copiedAccount ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Số tiền nộp:</span>
                        <strong className="font-black text-emerald-600 text-sm">
                          {paymentData.amount.toLocaleString('vi-VN')} đ
                        </strong>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-black/5 dark:border-white/5">
                        <span className="text-slate-400 font-medium">Nội dung chuyển khoản (bắt buộc):</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentData.transferNote, 'note')}
                          className="font-mono font-black text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 hover:underline"
                        >
                          {paymentData.transferNote}
                          {copiedNote ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentData(null)
                          setPayInput('')
                        }}
                        className="flex-1 py-3 px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Nộp Cho Bạn Khác
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowPayModal(false)
                          fetchFund()
                        }}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition"
                      >
                        Tôi Đã Chuyển Khoản Xong ✓
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MẬT KHẨU THỦ QUÝ */}
      {showAdminPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <h3 className="text-base font-black flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-500" /> Chế Độ Thủ Quỹ
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAdminPassModal(false)
                  setAdminPassError('')
                }}
                className="text-xs font-bold text-slate-400"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Nhập mã bảo mật của thủ quỹ lớp ME2 để mở khóa quyền đánh dấu đã nộp / chưa nộp tiền.
            </p>

            <form onSubmit={handleUnlockAdminMode} className="space-y-3">
              <input
                type="password"
                placeholder="Nhập mã bảo mật thủ quỹ..."
                value={adminPassInput}
                onChange={(e) => {
                  setAdminPassInput(e.target.value)
                  if (adminPassError) setAdminPassError('')
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-indigo-500"
              />

              {adminPassError && (
                <p className="text-xs text-rose-500 font-bold">{adminPassError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition"
              >
                Xác Nhận Mở Quyền
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHIA SẺ LINK & QR QUỸ LỚP */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 text-center text-slate-900 dark:text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <h3 className="text-base font-black">Mã QR Quỹ Lớp ME2</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-xs font-bold text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white rounded-3xl border border-black/10 inline-block shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`}
                alt="QR Quỹ Lớp"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black">{fund.title}</h4>
              <p className="text-xs text-slate-500">
                Gửi mã QR hoặc link này vào nhóm lớp để mọi người vào xem & nộp tiền.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(shareUrl, 'link')}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition flex items-center justify-center gap-2"
            >
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedLink ? 'Đã Sao Chép Link!' : 'Sao Chép Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL XÁC THỰC ADMIN XÓA QUỸ (Yêu cầu tài khoản & mật khẩu như lúc tạo) */}
      {showDeleteAdminModal && (
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
                    Xóa vĩnh viễn đợt thu quỹ này
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteAdminModal(false)}
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

            <form onSubmit={handleDeleteThisFund} className="space-y-4 text-xs font-bold">
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
                  onClick={() => setShowDeleteAdminModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isDeletingFund}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingFund ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{isDeletingFund ? 'Đang Xóa...' : 'Xác Nhận Xóa Vĩnh Viễn'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC THỰC ADMIN ĐỂ XÓA 1 SINH VIÊN */}
      {showDeleteStudentModal && studentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-600 dark:text-rose-400">
                    Xác Thực Admin Xóa Sinh Viên
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Xóa sinh viên khỏi danh sách nộp quỹ này
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteStudentModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="font-bold text-slate-500 mb-1">Sinh viên sẽ bị xóa:</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-center justify-between">
                <span>{studentToDelete.name}</span>
                <span className="font-mono text-xs text-slate-500">{studentToDelete.mssv || 'Không có MSSV'}</span>
              </div>
            </div>

            {deleteStudentError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteStudentError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteStudent} className="space-y-4 text-xs font-bold">
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Tài khoản:
                </label>
                <input
                  type="text"
                  required
                  value={deleteStudentAdminUsername}
                  onChange={(e) => setDeleteStudentAdminUsername(e.target.value)}
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
                  value={deleteStudentAdminPassword}
                  onChange={(e) => {
                    setDeleteStudentAdminPassword(e.target.value)
                    if (deleteStudentError) setDeleteStudentError('')
                  }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isDeletingStudent}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{isDeletingStudent ? 'Đang Xóa...' : 'Xác Nhận Xóa Sinh Viên'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
