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
  UploadCloud,
  Image as ImageIcon,
  Receipt,
  FileText,
  Plus,
  Maximize2,
  Eye,
  Edit3,
  TrendingDown,
  TrendingUp,
  Coins,
  ExternalLink,
} from 'lucide-react'
import { isValidAdminDailyPassword } from '@/lib/nopQuyLopAuth'
import {
  saveAdminSession,
  getAdminSession,
  clearAdminSession,
  isCurrentAdminSessionValid,
  formatAdminRemainingTime,
} from '@/lib/nopQuyLopAdminSession'

// Helper nén ảnh nhẹ nhàng trên trình duyệt (giảm 10MB xuống ~150KB) để tránh lỗi Payload Too Large trên Vercel/Safari
function compressImageFile(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Helper fetch an toàn không gây lỗi 'The string did not match the expected pattern' trên WebKit/Safari
async function safeFetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json: any = {}
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(text && text.length < 200 ? text : `Máy chủ trả về mã lỗi ${res.status}`)
  }
  if (!res.ok) {
    const errorMsg =
      (Array.isArray(json.reasons) && json.reasons.length > 0
        ? json.reasons.join('\n• ')
        : '') ||
      json.message ||
      json.error ||
      `Yêu cầu không thành công (${res.status})`
    throw new Error(errorMsg)
  }
  return json
}

interface Student {
  id: string
  name: string
  mssv?: string
  paid: boolean
  paidAt?: string
  paymentCode?: string
  proofImage?: string
  note?: string
}

interface FundExpense {
  id: string
  title: string
  amount: number
  spentAt: string
  spentBy?: string
  note?: string
  billImageUrl?: string
  receiptImage?: string
  createdAt: string
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
  initialBalance?: number
  expenses?: FundExpense[]
  students: Student[]
  createdAt: string
  updatedAt: string
}

interface ImageViewerData {
  url: string
  title: string
  subtitle?: string
  badge?: string
  date?: string
  code?: string
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

  // Phiên nộp tiền lưu trong 10 phút & Tải ảnh minh chứng
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const [timeLeftStr, setTimeLeftStr] = useState<string>('10:00')
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null)
  const [isVerifyingProof, setIsVerifyingProof] = useState(false)
  const [proofVerifyError, setProofVerifyError] = useState('')
  const [proofSuccessMessage, setProofSuccessMessage] = useState('')

  // Admin Mode & Session 30 phút
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [adminRemainingTime, setAdminRemainingTime] = useState('')
  const [showAdminPassModal, setShowAdminPassModal] = useState(false)
  const [adminModeUsername, setAdminModeUsername] = useState('thuquy')
  const [adminPassInput, setAdminPassInput] = useState('')
  const [adminPassError, setAdminPassError] = useState('')
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null)

  // Main Tabs: Sinh viên nộp quỹ vs Hóa đơn chi tiêu
  const [mainTab, setMainTab] = useState<'students' | 'expenses'>('students')

  // Quản lý Hóa đơn chi tiêu (Bill)
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseSpentAt, setExpenseSpentAt] = useState(new Date().toISOString().split('T')[0])
  const [expenseSpentBy, setExpenseSpentBy] = useState('Trần Duy Khương')
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseBillImage, setExpenseBillImage] = useState<string | null>(null)
  const [isOcrAnalyzing, setIsOcrAnalyzing] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('')
  const [expenseAdminUser, setExpenseAdminUser] = useState('')
  const [expenseAdminPass, setExpenseAdminPass] = useState('')
  const [expenseError, setExpenseError] = useState('')
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)

  // Xóa khoản chi
  const [expenseToDelete, setExpenseToDelete] = useState<FundExpense | null>(null)
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false)
  const [deleteExpenseUser, setDeleteExpenseUser] = useState('')
  const [deleteExpensePass, setDeleteExpensePass] = useState('')
  const [deleteExpenseError, setDeleteExpenseError] = useState('')
  const [isDeletingExpense, setIsDeletingExpense] = useState(false)

  // Cập nhật số tiền ban đầu của lớp
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [newInitialBalance, setNewInitialBalance] = useState('')
  const [balanceAdminUser, setBalanceAdminUser] = useState('')
  const [balanceAdminPass, setBalanceAdminPass] = useState('')
  const [balanceError, setBalanceError] = useState('')
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false)

  // Phóng to xem ảnh minh chứng & hóa đơn bill
  const [activeViewerImage, setActiveViewerImage] = useState<ImageViewerData | null>(null)
  const [pendingToggleStudent, setPendingToggleStudent] = useState<Student | null>(null)

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

  // Đồng bộ phiên Admin 30 phút trên toàn hệ thống
  useEffect(() => {
    const updateTimer = () => {
      const session = getAdminSession()
      if (session && session.expiresAt > Date.now()) {
        setIsAdminMode(true)
        setAdminRemainingTime(formatAdminRemainingTime(session.expiresAt))
      } else {
        setAdminRemainingTime('')
      }
    }
    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenDeleteFundModal = () => {
    const session = getAdminSession()
    if (session && session.expiresAt > Date.now()) {
      setDeleteAdminUsername('admin')
      setDeleteAdminPassword(session.adminPassword)
    } else {
      setDeleteAdminUsername('')
      setDeleteAdminPassword('')
    }
    setDeleteError('')
    setShowDeleteAdminModal(true)
  }

  const handleDeleteThisFund = async (e: React.FormEvent) => {
    e.preventDefault()
    const session = getAdminSession()
    const pass = deleteAdminPassword.trim() || (session ? session.adminPassword : '')
    const user = deleteAdminUsername.trim() || (session ? session.adminUsername : 'admin')

    if (user !== 'admin' || !isValidAdminDailyPassword(pass)) {
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
          adminUsername: user,
          adminPassword: pass,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json.error || 'Lỗi khi xóa đợt thu quỹ')
        return
      }

      saveAdminSession(pass)
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
    const session = getAdminSession()
    if (session && session.expiresAt > Date.now()) {
      setDeleteStudentAdminUsername('admin')
      setDeleteStudentAdminPassword(session.adminPassword)
    } else {
      setDeleteStudentAdminUsername('')
      setDeleteStudentAdminPassword('')
    }
    setDeleteStudentError('')
    setShowDeleteStudentModal(true)
  }

  const handleDeleteStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentToDelete) return

    const session = getAdminSession()
    const pass = deleteStudentAdminPassword.trim() || (session ? session.adminPassword : '') || adminPassInput.trim() || ''
    const user = deleteStudentAdminUsername.trim() || (session ? session.adminUsername : 'admin')

    const isValidAdmin = isValidAdminDailyPassword(pass)
    const isValidTreasurer = Boolean(fund?.adminPasscode && pass === fund.adminPasscode.trim())

    if (!isValidAdmin && !isValidTreasurer) {
      setDeleteStudentError('Tài khoản hoặc mã bảo mật không chính xác!')
      return
    }

    setIsDeletingStudent(true)
    setDeleteStudentError('')
    try {
      await safeFetchJson(`/api/nopquylop/funds/${fundId}/students/${studentToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: user,
          adminPassword: pass,
          adminPasscode: pass,
        }),
      })

      if (pass) saveAdminSession(pass)
      setShowDeleteStudentModal(false)
      setStudentToDelete(null)
      fetchFund()
    } catch (err: any) {
      setDeleteStudentError(err.message || 'Lỗi kết nối máy chủ')
    } finally {
      setIsDeletingStudent(false)
    }
  }

  // Xử lý thêm khoản chi / Bill
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const session = getAdminSession()
    const pass = expenseAdminPass.trim() || (session ? session.adminPassword : '') || adminPassInput.trim() || ''
    const user = expenseAdminUser.trim() || (session ? session.adminUsername : 'admin')
    const isAdmin = user === 'admin' && isValidAdminDailyPassword(pass)
    const isTreasurer = ['thuquy', 'thủ quỹ', 'treasurer'].includes(user.toLowerCase()) && pass === fund?.adminPasscode

    const amt = Number(expenseAmount.replace(/[^0-9]/g, ''))
    if (!amt || amt <= 0) {
      setExpenseError('Số tiền chi phải lớn hơn 0!')
      return
    }

    if (!expenseTitle.trim()) {
      setExpenseError('Vui lòng nhập tên khoản chi!')
      return
    }

    setIsSubmittingExpense(true)
    setExpenseError('')
    try {
      await safeFetchJson(`/api/nopquylop/funds/${fundId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle.trim(),
          amount: amt,
          spentAt: expenseSpentAt,
          spentBy: expenseSpentBy.trim() || undefined,
          note: expenseNote.trim() || undefined,
          billImageUrl: expenseBillImage || undefined,
          receiptImage: expenseBillImage || undefined,
          adminUsername: user,
          adminPassword: pass,
          adminPasscode: pass,
        }),
      })

      if (pass) {
        saveAdminSession(pass)
        setIsAdminMode(true)
      }
      setShowAddExpenseModal(false)
      setExpenseTitle('')
      setExpenseAmount('')
      setExpenseNote('')
      setExpenseBillImage(null)
      setOcrSuccessMsg('')
      await fetchFund()
    } catch (err: any) {
      setExpenseError(err.message || 'Lỗi thêm hóa đơn chi tiêu')
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  // Xử lý AI đọc hóa đơn chi tiêu (Tùy chọn)
  const handleOcrBill = async () => {
    if (!expenseBillImage) {
      setOcrError('Vui lòng chọn hoặc chụp ảnh hóa đơn trước!')
      return
    }

    setIsOcrAnalyzing(true)
    setOcrError('')
    setOcrSuccessMsg('')
    try {
      const json = await safeFetchJson('/api/nopquylop/ocr-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: expenseBillImage }),
      })

      const data = json.data || json
      if (data.amount) {
        setExpenseAmount(String(data.amount))
      }
      if (data.title) {
        setExpenseTitle(data.title)
      }
      if (data.spentAt) {
        setExpenseSpentAt(data.spentAt)
      }
      setOcrSuccessMsg(
        `AI đã nhận diện: "${data.title || 'Khoản chi'}" — ${(data.amount || 0).toLocaleString('vi-VN')} đ`
      )
    } catch (err: any) {
      setOcrError(err.message || 'Lỗi phân tích hóa đơn')
    } finally {
      setIsOcrAnalyzing(false)
    }
  }

  // Xóa khoản chi
  const handleDeleteExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseToDelete) return
    const session = getAdminSession()
    const pass = deleteExpensePass.trim() || (session ? session.adminPassword : '') || adminPassInput.trim() || ''
    const user = deleteExpenseUser.trim() || (session ? session.adminUsername : 'admin')
    const isAdmin = user === 'admin' && isValidAdminDailyPassword(pass)
    const isTreasurer = ['thuquy', 'thủ quỹ', 'treasurer'].includes(user.toLowerCase()) && pass === fund?.adminPasscode

    if (!isValidAdmin && !isValidTreasurer && !isAdmin && !isTreasurer) {
      setDeleteExpenseError("Chỉ Admin hoặc Thủ quỹ mới được xóa bill!");
      return
    }

    setIsDeletingExpense(true)
    setDeleteExpenseError('')
    try {
      await safeFetchJson(`/api/nopquylop/funds/${fundId}/expenses/${expenseToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: user,
          adminPassword: pass,
          adminPasscode: pass,
        }),
      })

      if (pass) saveAdminSession(pass);
      setShowDeleteExpenseModal(false)
      setExpenseToDelete(null)
      await fetchFund()
    } catch (err: any) {
      setDeleteExpenseError(err.message || 'Lỗi kết nối')
    } finally {
      setIsDeletingExpense(false)
    }
  }

  // Cập nhật số tiền ban đầu hiện có của lớp
  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    const session = getAdminSession()
    const pass = balanceAdminPass.trim() || (session ? session.adminPassword : '') || adminPassInput.trim() || ''
    const user = balanceAdminUser.trim() || (session ? session.adminUsername : 'admin')

    const isValidAdmin = isValidAdminDailyPassword(pass)
    const isValidTreasurer = Boolean(fund?.adminPasscode && pass === fund.adminPasscode.trim())

    if (!isValidAdmin && !isValidTreasurer) {
      setBalanceError('Tài khoản hoặc mã bảo mật không chính xác!')
      return
    }

    const amt = Number(newInitialBalance.replace(/[^0-9]/g, ''))
    if (isNaN(amt) || amt < 0) {
      setBalanceError('Số tiền không hợp lệ!')
      return
    }

    setIsUpdatingBalance(true)
    setBalanceError('')
    try {
      await safeFetchJson(`/api/nopquylop/funds/${fundId}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialBalance: amt,
          adminUsername: user,
          adminPassword: pass,
          adminPasscode: pass,
        }),
      })

      if (pass) saveAdminSession(pass)
      setShowBalanceModal(false)
      await fetchFund()
    } catch (err: any) {
      setBalanceError(err.message || 'Lỗi kết nối')
    } finally {
      setIsUpdatingBalance(false)
    }
  }

  const handleExpenseImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExpenseError("");
    setOcrError('')
    setOcrSuccessMsg('')
    try {
      const compressed = await compressImageFile(file, 1280, 1280, 0.75)
      setExpenseBillImage(compressed)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        setExpenseBillImage(reader.result as string)
      }
      reader.readAsDataURL(file)
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

  // Khôi phục phiên nộp tiền 10 phút từ localStorage (không sợ bị mất khi chuyển sang app ngân hàng)
  useEffect(() => {
    try {
      const sessionKey = `nopquylop_session_${fundId}`
      const saved = localStorage.getItem(sessionKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.expiresAt && parsed.expiresAt > Date.now() && parsed.paymentData) {
          setPaymentData(parsed.paymentData)
          setSessionExpiresAt(parsed.expiresAt)
          setShowPayModal(true)
        } else {
          localStorage.removeItem(sessionKey)
        }
      }
    } catch {}
  }, [fundId])

  // Đếm ngược thời gian phiên nộp tiền 10 phút
  useEffect(() => {
    if (!sessionExpiresAt || !showPayModal) return

    const tick = () => {
      const remainingMs = sessionExpiresAt - Date.now()
      if (remainingMs <= 0) {
        setTimeLeftStr('00:00')
        try {
          localStorage.removeItem(`nopquylop_session_${fundId}`)
        } catch {}
      } else {
        const totalSec = Math.floor(remainingMs / 1000)
        const mins = Math.floor(totalSec / 60)
        const secs = totalSec % 60
        setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [sessionExpiresAt, showPayModal, fundId])

  // Kiểm tra trạng thái nộp tiền (nếu thủ quỹ ở máy khác bấm duyệt)
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
          try {
            localStorage.removeItem(`nopquylop_session_${fundId}`)
          } catch {}
          fetchFund()
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra trạng thái:', err)
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [showPayModal, paymentData, autoPaidSuccess, fundId])

  // Quỹ Thử Nghiệm nội bộ của Hoàng Bình Minh
  const isTestFund = useMemo(() => {
    return Boolean(
      (fund as any)?.isTestFund ||
      fund?.id === 'quy-test-hoang-binh-minh' ||
      fund?.id?.includes('test')
    )
  }, [fund?.id, fund])

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
      const expires = Date.now() + 10 * 60 * 1000
      setSessionExpiresAt(expires)
      try {
        localStorage.setItem(
          `nopquylop_session_${fundId}`,
          JSON.stringify({ paymentData: json, expiresAt: expires })
        )
      } catch {}
    } catch (err: any) {
      setPayError(err.message || 'Lỗi xử lý xác nhận')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleProofImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProofVerifyError('')

    try {
      const compressed = await compressImageFile(file, 1280, 1280, 0.75)
      setProofImagePreview(compressed)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        setProofImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitProof = async () => {
    if (!paymentData || !proofImagePreview) {
      setProofVerifyError('Vui lòng chọn hoặc chụp ảnh biên lai chuyển khoản trước!')
      return
    }

    setIsVerifyingProof(true)
    setProofVerifyError('')
    try {
      const json = await safeFetchJson(`/api/nopquylop/funds/${fundId}/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: paymentData.student.id,
          paymentCode: paymentData.paymentCode,
          image: proofImagePreview,
        }),
      })

      // Xác minh thành công!
      setAutoPaidSuccess(true)
      setProofSuccessMessage(json.message || 'Xác minh thành công!')
      try {
        localStorage.removeItem(`nopquylop_session_${fundId}`)
      } catch {}
      await fetchFund()
    } catch (err: any) {
      setProofVerifyError(err.message || 'Lỗi kết nối kiểm tra minh chứng. Vui lòng thử lại!')
    } finally {
      setIsVerifyingProof(false)
    }
  }

  // Thực hiện đổi trạng thái nộp tiền của sinh viên
  const executeToggleStudentPaid = async (student: Student, passToUse?: string) => {
    const session = getAdminSession()
    const pass = passToUse || adminPassInput.trim() || (session ? session.adminPassword : '') || ''

    setUpdatingStudentId(student.id)
    try {
      await safeFetchJson(`/api/nopquylop/funds/${fundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          paid: !student.paid,
          adminPasscode: pass,
          adminPassword: pass,
          adminUsername: 'admin',
        }),
      })

      if (pass) {
        saveAdminSession(pass)
        setIsAdminMode(true)
      }
      await fetchFund()
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật trạng thái nộp tiền')
    } finally {
      setUpdatingStudentId(null)
    }
  }

  // Bấm nút Duyệt Đã Nộp / Đánh Dấu Chưa Nộp
  const handleToggleStudentPaid = async (student: Student) => {
    const session = getAdminSession()
    const isUnlocked =
      (session && session.expiresAt > Date.now()) ||
      (adminPassInput.trim() &&
        (!fund?.adminPasscode ||
          adminPassInput.trim() === fund.adminPasscode.trim() ||
          isValidAdminDailyPassword(adminPassInput.trim())))

    if (!isUnlocked && !isAdminMode) {
      setPendingToggleStudent(student)
      setShowAdminPassModal(true)
      return
    }

    await executeToggleStudentPaid(student)
  }

  // Xác nhận passcode thủ quỹ hoặc mật khẩu Admin
  const handleUnlockAdminMode = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPass = adminPassInput.trim();
    const username = (adminModeUsername || "").trim().toLowerCase();
    const isValidDaily = isValidAdminDailyPassword(cleanPass);
    const isFundPassMatch = Boolean(fund?.adminPasscode && cleanPass === fund.adminPasscode.trim());
    const isAdmin = (username === "admin" && isValidDaily) || isValidDaily;
    const isTreasurer = (["thuquy", "thủ quỹ", "treasurer"].includes(username) && isFundPassMatch) || isFundPassMatch || (!fund?.adminPasscode && cleanPass);

    if (isAdmin || isTreasurer) {
      saveAdminSession(cleanPass);
      setIsAdminMode(true)
      setExpenseAdminUser(isAdmin ? 'admin' : 'thuquy')
      setExpenseAdminPass(adminPassInput)
      setShowAdminPassModal(false)
      setAdminPassError('')

      if (pendingToggleStudent) {
        const target = pendingToggleStudent
        setPendingToggleStudent(null)
        executeToggleStudentPaid(target, cleanPass)
      }
    } else {
      setAdminPassError("Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại!");
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
            {adminRemainingTime ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shadow-xs">
                <Unlock className="h-3.5 w-3.5" />
                <span>Admin ({adminRemainingTime})</span>
                <button
                  type="button"
                  onClick={() => {
                    clearAdminSession()
                    setIsAdminMode(false)
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
            )}

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Chia Sẻ</span>
            </button>

            {isAdminMode && (
              <button
                type="button"
                onClick={handleOpenDeleteFundModal}
                title="Xóa đợt thu quỹ (Chỉ dành cho Admin)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs font-bold transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Xóa Quỹ</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {isTestFund && !isAdminMode ? (
          <section className="p-10 sm:p-14 rounded-[32px] border border-purple-200 dark:border-purple-900/40 bg-white dark:bg-slate-900 text-center space-y-4 shadow-sm max-w-lg mx-auto my-12">
            <div className="h-14 w-14 rounded-3xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <span className="px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[10px] uppercase border border-purple-500/30">
                🔒 Quỹ Test (Chỉ Admin Thấy)
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Quỹ Thử Nghiệm - Hoàng Bình Minh
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Đây là Quỹ Test nội bộ dành riêng cho Quản trị viên đối soát thanh toán VietQR (0336062007 MB Bank - 2.000 đ) và kiểm tra OCR. Vui lòng đăng nhập Chế Độ Thủ Quỹ / Admin để truy cập.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowAdminPassModal(true)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition inline-flex items-center justify-center gap-1.5"
              >
                <Lock className="h-4 w-4" /> Đăng Nhập Admin Để Xem
              </button>
              <Link
                href="/nopquylop"
                className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-center"
              >
                Về Trang Chủ
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Banner Quỹ & Thông Tin Nhận Tiền */}
            <section className="relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase border border-indigo-200 dark:border-indigo-800">
                      {fund.className}
                    </span>

                    {isTestFund ? (
                      <span className="px-3 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-black text-xs uppercase border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Quỹ Test (Chỉ Admin) • Nộp Vô Hạn Lần
                      </span>
                    ) : isFundOverdueOneWeek ? (
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
                      if (isTestFund && !payInput) {
                        setPayInput('Hoàng Bình Minh')
                      }
                    }}
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>{isTestFund ? 'Nộp Thử Nghiệm 2.000 đ' : 'Nộp Tiền Quỹ (Lấy Mã QR)'}</span>
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
            {/* THỐNG KÊ TÀI CHÍNH THỰC TẾ: BAN ĐẦU, THU, CHI, VÀ SỐ DƯ CÒN LẠI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Số Dư Quỹ Còn Lại (Nổi bật nhất) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-2 border-emerald-500/40 dark:border-emerald-500/50 relative overflow-hidden shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    Số Dư Quỹ Còn Lại
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase">
                    Thực Tế
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {((fund.initialBalance || 0) + stats.collected - ((fund.expenses || []).reduce((s, e) => s + (e.amount || 0), 0))).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                  = Ban đầu + Đã thu - Các bill chi tiêu
                </p>
              </div>

              {/* Card 2: Số Tiền Ban Đầu Của Lớp */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" />
                    Quỹ Ban Đầu
                  </span>
                  {isAdminMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewInitialBalance(String(fund.initialBalance || 0))
                        setBalanceError('')
                        const session = getAdminSession()
                        if (session && session.expiresAt > Date.now()) {
                          setBalanceAdminUser('admin')
                          setBalanceAdminPass(session.adminPassword)
                        }
                        setShowBalanceModal(true)
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      <Edit3 className="h-3 w-3" /> Sửa
                    </button>
                  )}
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {(fund.initialBalance || 0).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Số tiền lớp có trước đợt thu này</p>
              </div>

              {/* Card 3: Tổng Thu Từ Sinh Viên */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                    Tổng Thu Sinh Viên
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold">
                    {stats.paid}/{stats.total} bạn
                  </span>
                </div>
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                  +{stats.collected.toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Tiến độ thu: {stats.percent}% chỉ tiêu</p>
              </div>

              {/* Card 4: Tổng Chi Tiêu Theo Bill */}
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                    Tổng Đã Chi (Bills)
                  </span>
                  <span className="text-[10px] text-rose-600 font-bold">
                    {(fund.expenses || []).length} hóa đơn
                  </span>
                </div>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                  -{((fund.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)).toLocaleString('vi-VN')} đ
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Được trừ trực tiếp vào quỹ</p>
              </div>
            </div>

            {/* Sĩ số và Trạng thái */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-black/5 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sĩ số lớp</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{stats.total} sinh viên</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">Đã nộp ({stats.percent}%)</span>
                <span className="text-base font-black">{stats.paid} sinh viên</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 text-amber-800 dark:text-amber-300">
                <span className="text-[10px] uppercase font-bold text-amber-600 block mb-0.5">Chưa nộp</span>
                <span className="text-base font-black">{stats.unpaid} sinh viên</span>
              </div>

              <div className={`p-3 rounded-xl border ${
                stats.overdue > 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-black/5 dark:border-white/5 text-slate-400'
              }`}>
                <span className="text-[10px] uppercase font-bold block mb-0.5 flex items-center gap-1">
                  <Flame className="h-3 w-3 text-rose-500" /> Trễ Hạn &gt; 1 Tuần
                </span>
                <span className="text-base font-black">
                  {stats.overdue} bạn
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">
                  Thu đợt này: <strong className="text-emerald-600 font-black">{stats.collected.toLocaleString('vi-VN')} đ</strong> / {stats.target.toLocaleString('vi-VN')} đ
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{stats.percent}% Chỉ Tiêu</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* CHUYỂN TAB CHÍNH: DANH SÁCH SINH VIÊN vs HÓA ĐƠN CHI TIÊU */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setMainTab('students')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition ${
                mainTab === 'students'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Danh Sách Nộp Quỹ ({stats.total})</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('expenses')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition ${
                mainTab === 'expenses'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>Khoản Chi & Hóa Đơn ({(fund.expenses || []).length})</span>
            </button>
          </div>

          {isAdminMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const session = getAdminSession()
                  if (session && session.expiresAt > Date.now()) {
                    setExpenseAdminUser('admin')
                    setExpenseAdminPass(session.adminPassword)
                  }
                  setExpenseSpentAt(new Date().toISOString().split('T')[0])
                  setShowAddExpenseModal(true)
                  setExpenseError('')
                  setOcrError('')
                  setOcrSuccessMsg('')
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-black shadow-md shadow-rose-500/20 transition"
              >
                <Plus className="h-4 w-4" />
                <span>+ Đưa Bill Vào Trừ Quỹ</span>
              </button>
            </div>
          )}
        </section>

        {/* TAB 1: DANH SÁCH SINH VIÊN NỘP TIỀN */}
        {mainTab === 'students' && (
          <div className="space-y-6">
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
                  <th className="py-3 px-4 w-12">STT</th>
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">MSSV</th>
                  <th className="py-3 px-4">Số Tiền</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Minh Chứng Nộp</th>
                  {isAdminMode && <th className="py-3 px-4 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
                {sortedAndFilteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminMode ? 7 : 6} className="py-12 text-center text-slate-400 font-bold">
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

                        {/* Minh Chứng Nộp Tiền (Đường link / Nút bấm mở ảnh minh chứng) */}
                        <td className="py-3.5 px-4">
                          {student.proofImage ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveViewerImage({
                                  url: student.proofImage!,
                                  title: `Minh Chứng Nộp Tiền: ${student.name}`,
                                  subtitle: `MSSV: ${student.mssv || '—'}`,
                                  code: student.paymentCode,
                                  date: student.paidAt,
                                  badge: 'Đã tải minh chứng',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-black transition shadow-2xs group"
                            >
                              <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition" />
                              <span>Xem Minh Chứng</span>
                            </button>
                          ) : student.paid ? (
                            <span className="text-[11px] text-slate-400 font-medium italic">
                              Nộp trực tiếp / Thẻ
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Thao tác (Chỉ dành cho Admin & Thủ quỹ đã mở khóa) */}
                        {isAdminMode && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleStudentPaid(student)}
                                disabled={updatingStudentId === student.id}
                                title={student.paid ? 'Đánh dấu sinh viên này chưa nộp' : 'Duyệt hoàn thành nộp quỹ'}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                                  student.paid
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
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
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )}

    {/* TAB 2: QUẢN LÝ HÓA ĐƠN & KHOẢN CHI TIÊU (TRỪ DẦN QUỸ LỚP) */}
    {mainTab === 'expenses' && (
      <div className="space-y-6">
        <section className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="p-4 sm:p-6 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-rose-600" />
                <span>Danh Sách Hóa Đơn & Khoản Chi Trừ Quỹ</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Các hóa đơn mua sắm, chi tiêu thực tế của lớp ME2 được công khai minh bạch và trừ trực tiếp vào số dư quỹ
              </p>
            </div>

            {isAdminMode && (
              <button
                type="button"
                onClick={() => {
                  const session = getAdminSession()
                  if (session && session.expiresAt > Date.now()) {
                    setExpenseAdminUser('admin')
                    setExpenseAdminPass(session.adminPassword)
                  }
                  setExpenseSpentAt(new Date().toISOString().split('T')[0])
                  setShowAddExpenseModal(true)
                  setExpenseError('')
                  setOcrError('')
                  setOcrSuccessMsg('')
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-black shadow-md transition shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ Đưa Bill Mới Vào</span>
              </button>
            )}
          </div>

          {!(fund.expenses && fund.expenses.length > 0) ? (
            <div className="p-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
                <Receipt className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                  Chưa có hóa đơn chi tiêu nào
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Lớp chưa phát sinh khoản chi nào hoặc thủ quỹ chưa tải hóa đơn lên.
                </p>
              </div>
              {isAdminMode && (
                <button
                  type="button"
                  onClick={() => {
                    const session = getAdminSession()
                    if (session && session.expiresAt > Date.now()) {
                      setExpenseAdminUser('admin')
                      setExpenseAdminPass(session.adminPassword)
                    }
                    setShowAddExpenseModal(true)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition"
                >
                  + Đưa Bill Chi Tiêu Đầu Tiên
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/5 bg-slate-50/60 dark:bg-slate-800/40 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 w-14">STT</th>
                    <th className="py-3 px-4">Ngày Chi</th>
                    <th className="py-3 px-4">Tên Khoản Chi / Mục Đích</th>
                    <th className="py-3 px-4">Người Chi</th>
                    <th className="py-3 px-4">Số Tiền Trừ Quỹ</th>
                    <th className="py-3 px-4 text-center">Ảnh Hóa Đơn (Bill)</th>
                    {isAdminMode && <th className="py-3 px-4 text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {fund.expenses.map((exp, idx) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400">
                        {exp.spentAt ? new Date(exp.spentAt).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-black text-slate-900 dark:text-white text-sm block">
                            {exp.title}
                          </span>
                          {exp.note && (
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {exp.note}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {exp.spentBy || 'Thủ quỹ'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                          -{exp.amount.toLocaleString('vi-VN')} đ
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {(exp.billImageUrl || exp.receiptImage) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveViewerImage({
                                url: (exp.billImageUrl || exp.receiptImage)!,
                                title: `Hóa Đơn Chi Tiêu: ${exp.title}`,
                                subtitle: `Số tiền: ${(exp.amount || 0).toLocaleString('vi-VN')} đ • Người chi: ${exp.spentBy || 'Thủ quỹ'}`,
                                date: exp.spentAt,
                                badge: 'Hóa đơn trừ quỹ',
                              })
                            }
                            title="Bấm để xem ảnh hóa đơn rõ nét"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 text-[11px] font-black text-rose-700 dark:text-rose-300 transition shadow-2xs group"
                          >
                            <img
                              src={exp.billImageUrl || exp.receiptImage}
                              alt="Bill"
                              className="w-5 h-5 object-cover rounded-md"
                            />
                            <Eye className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition" />
                            <span>Xem Bill</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Không có ảnh</span>
                        )}
                      </td>
                      {isAdminMode && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setExpenseToDelete(exp)
                              const session = getAdminSession()
                              if (session && session.expiresAt > Date.now()) {
                                setDeleteExpenseUser('admin')
                                setDeleteExpensePass(session.adminPassword)
                              } else {
                                setDeleteExpenseUser('')
                                setDeleteExpensePass('')
                              }
                              setDeleteExpenseError('')
                              setShowDeleteExpenseModal(true)
                            }}
                            title="Xóa hóa đơn chi tiêu này"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )}
    </>
  )}
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
                    {isTestFund
                      ? 'Họ và Tên Tester (Quỹ Test Vô Hạn Lần):'
                      : 'Họ và Tên HOẶC Mã Số Sinh Viên (MSSV):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      isTestFund
                        ? 'VD: Hoàng Bình Minh hoặc tên bất kỳ'
                        : 'VD: Nguyễn Văn An hoặc 20221001'
                    }
                    value={payInput}
                    onChange={(e) => {
                      setPayInput(e.target.value)
                      if (payError) setPayError('')
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 text-sm shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    {isTestFund
                      ? 'Quỹ Test dành cho Hoàng Bình Minh: Mức nộp 2.000 đ vào STK 0336062007 MB Bank. Hỗ trợ nộp vô hạn lần.'
                      : 'Hệ thống sẽ đối chiếu với danh sách lớp ME2. Chỉ cần đúng 1 trong 2 thông tin.'}
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
                    <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
                    <h4 className="font-black text-emerald-900 dark:text-emerald-200 text-lg">
                      XÁC NHẬN NỘP TIỀN THÀNH CÔNG!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      {proofSuccessMessage || (
                        <>
                          Hệ thống đã nhận diện thành công biên lai chuyển khoản{' '}
                          <strong>{paymentData.amount.toLocaleString('vi-VN')} đ</strong> của sinh viên{' '}
                          <strong>&quot;{paymentData.student.name}&quot;</strong> ({paymentData.student.mssv || 'ME2'}).
                        </>
                      )}
                    </p>
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                      Mã nộp tiền: {paymentData.paymentCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPayModal(false)
                        setAutoPaidSuccess(false)
                        setPaymentData(null)
                        setProofImagePreview(null)
                        setProofVerifyError('')
                        fetchFund()
                      }}
                      className="mt-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition"
                    >
                      Hoàn Tất & Đóng Cửa Sổ
                    </button>

                    {isTestFund && (
                      <button
                        type="button"
                        onClick={() => {
                          setAutoPaidSuccess(false)
                          setPaymentData(null)
                          setProofImagePreview(null)
                          setProofVerifyError('')
                          setProofSuccessMessage('')
                          setPayInput('Hoàng Bình Minh')
                          fetchFund()
                        }}
                        className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition"
                      >
                        + Thử Nghiệm Nộp Tiếp Lần Nữa (Vô Hạn Lần)
                      </button>
                    )}
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

                    {/* Đếm ngược 10 phút lưu phiên */}
                    <div className="flex items-center justify-between py-2.5 px-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-xs font-bold text-amber-800 dark:text-amber-200">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600 animate-spin" />
                        <span>Phiên nộp tiền lưu trong 10 phút:</span>
                      </div>
                      <span className="font-mono text-sm px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black">
                        {timeLeftStr}
                      </span>
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

                    {/* KHU VỰC GỬI ẢNH MINH CHỨNG CHUYỂN TIỀN */}
                    <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/80 bg-indigo-50/40 dark:bg-indigo-950/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-sm">
                        <UploadCloud className="h-4 w-4 text-indigo-600" />
                        <span>Nộp ảnh minh chứng</span>
                      </div>

                      {proofImagePreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-black/10 bg-black flex items-center justify-center p-1">
                          <img
                            src={proofImagePreview}
                            alt="Biên lai chuyển khoản"
                            className="max-h-60 object-contain rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setProofImagePreview(null)
                              setProofVerifyError('')
                            }}
                            className="absolute top-2 right-2 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-[11px] font-bold transition shadow-md"
                          >
                            ✕ Đổi ảnh khác
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition">
                          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-bold text-indigo-600 hover:underline">
                              Bấm chọn ảnh biên lai chuyển tiền
                            </span>
                            <span className="text-xs text-slate-400 font-medium"> hoặc chụp màn hình</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ JPG, PNG, WebP (Ảnh màn hình ngân hàng rõ nét)</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleProofImageChange}
                          />
                        </label>
                      )}

                      {proofVerifyError && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-start gap-2 animate-in shake">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <div className="leading-relaxed whitespace-pre-line">{proofVerifyError}</div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleSubmitProof}
                        disabled={isVerifyingProof || !proofImagePreview}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isVerifyingProof ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Đang kiểm tra minh chứng...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Kiểm tra minh chứng</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentData(null)
                          setPayInput('')
                          setProofImagePreview(null)
                          setProofVerifyError('')
                          try {
                            localStorage.removeItem(`nopquylop_session_${fundId}`)
                          } catch {}
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Nộp Cho Bạn Khác / Hủy Phiên
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
              Chỉ Admin hoặc Thủ quỹ được mở khóa quyền duyệt nộp và quản lý quỹ.
            </p>

            <form onSubmit={handleUnlockAdminMode} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tài khoản:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tài khoản..."
                  value={adminModeUsername}
                  onChange={(e) => {
                    setAdminModeUsername(e.target.value)
                    if (adminPassError) setAdminPassError('')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Mật khẩu:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu..."
                  value={adminPassInput}
                  onChange={(e) => {
                    setAdminPassInput(e.target.value)
                    if (adminPassError) setAdminPassError('')
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              {adminPassError && (
                <p className="text-xs text-rose-500 font-bold">{adminPassError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition"
              >
                Xác Nhận Đăng Nhập
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

      {/* MODAL THÊM KHOẢN CHI / BILL VÀO TRỪ QUỸ (ĐIỀN BẰNG TAY HOẶC ĐÍNH KÈM ẢNH) */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Đưa Hóa Đơn / Bill Vào Trừ Quỹ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Nhập tay thông tin chi tiêu & đính kèm ảnh hóa đơn minh chứng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddExpenseModal(false)
                  setExpenseError('')
                  setOcrError('')
                  setOcrSuccessMsg('')
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-2"
              >
                ✕ Đóng
              </button>
            </div>

            {expenseError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{expenseError}</span>
              </div>
            )}

            {/* VÙNG TẢI ẢNH BILL (TỰ ĐỘNG NÉN NHẸ GỌN) */}
            <div className="p-4 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <UploadCloud className="h-4 w-4 text-rose-600" />
                  Ảnh Hóa Đơn / Bill Chi Tiêu (Tùy chọn)
                </span>
                <span className="text-[10px] text-slate-500">Tự động nén tối ưu</span>
              </div>

              {expenseBillImage ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border border-black/10 bg-black flex items-center justify-center p-1">
                    <img
                      src={expenseBillImage}
                      alt="Bill chi tiêu"
                      className="max-h-52 object-contain rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseBillImage(null)
                        setOcrError('')
                        setOcrSuccessMsg('')
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-xl bg-black/70 hover:bg-black text-white text-[10px] font-bold backdrop-blur-md"
                    >
                      ✕ Xóa ảnh
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-emerald-600 font-bold">
                      ✓ Đã đính kèm ảnh hóa đơn
                    </span>
                    <button
                      type="button"
                      onClick={handleOcrBill}
                      disabled={isOcrAnalyzing}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      {isOcrAnalyzing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>AI đang đọc...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>Điền nhanh bằng AI (Tùy chọn)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border border-rose-200 dark:border-rose-900 rounded-xl cursor-pointer bg-white/60 dark:bg-slate-800/60 hover:bg-white transition text-center space-y-2">
                  <ImageIcon className="h-8 w-8 text-rose-400" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bấm vào đây để chọn hoặc chụp ảnh hóa đơn
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Hỗ trợ PNG, JPG, JPEG (Hóa đơn siêu thị, quán nước, in ấn...)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleExpenseImageChange}
                    className="hidden"
                  />
                </label>
              )}

              {ocrSuccessMsg && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ {ocrSuccessMsg}
                </p>
              )}

              {ocrError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                  ⚠️ {ocrError}
                </p>
              )}
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Tên khoản chi / Mục đích:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Mua nước ngọt liên hoan, in đề..."
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Số tiền chi (VNĐ):
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="VD: 150000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-rose-600 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Ngày chi:
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseSpentAt}
                    onChange={(e) => setExpenseSpentAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Người chi tiền:
                  </label>
                  <input
                    type="text"
                    value={expenseSpentBy}
                    onChange={(e) => setExpenseSpentBy(e.target.value)}
                    placeholder="VD: Trần Duy Khương"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                  Ghi chú chi tiết:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về địa điểm mua, số lượng, v.v..."
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-rose-500"
                />
              </div>

              {/* Xác thực Thủ Quỹ / Admin (Nếu chưa mở phiên) */}
              {!isCurrentAdminSessionValid() && !adminPassInput && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-black/10 dark:border-white/10 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Mã bảo mật Thủ Quỹ hoặc Mật khẩu Admin:
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mã bảo mật thủ quỹ hoặc admin..."
                    value={expenseAdminPass}
                    onChange={(e) => setExpenseAdminPass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black shadow-md shadow-rose-500/20 transition flex items-center gap-2 disabled:opacity-40"
                >
                  {isSubmittingExpense ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang lưu bill...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4" />
                      <span>Xác Nhận Đưa Bill Vào Trừ Quỹ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT SỐ DƯ BAN ĐẦU CỦA LỚP */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Cập Nhật Quỹ Ban Đầu
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Số tiền hiện có của lớp ME2 trước đợt thu này
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBalanceModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {balanceError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{balanceError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateBalance} className="space-y-4 text-xs font-bold">
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Số tiền ban đầu của quỹ (VNĐ):
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newInitialBalance}
                  onChange={(e) => setNewInitialBalance(e.target.value)}
                  placeholder="VD: 2500000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-black outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Hệ thống sẽ tự động tính: Số dư còn lại = Quỹ ban đầu + Tổng đã thu - Tổng các bill chi tiêu.
                </p>
              </div>

              {!isCurrentAdminSessionValid() && (
                <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="space-y-1">
                    <label className="block text-slate-500 uppercase text-[10px]">Tài khoản admin:</label>
                    <input
                      type="text"
                      required
                      value={balanceAdminUser}
                      onChange={(e) => setBalanceAdminUser(e.target.value)}
                      placeholder="admin"
                      className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-500 uppercase text-[10px]">Mật khẩu admin:</label>
                    <input
                      type="password"
                      required
                      value={balanceAdminPass}
                      onChange={(e) => setBalanceAdminPass(e.target.value)}
                      placeholder="Mật khẩu..."
                      className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingBalance}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>{isUpdatingBalance ? 'Đang Lưu...' : 'Cập Nhật Số Dư'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC THỰC XÓA KHOẢN CHI / BILL */}
      {showDeleteExpenseModal && expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-600 dark:text-rose-400">
                    Xác Thực Admin Xóa Bill
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Khoản tiền sẽ được hoàn trả lại vào số dư quỹ
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteExpenseModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="font-bold text-slate-500 mb-1">Khoản chi sẽ bị xóa:</div>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-center justify-between">
                <span>{expenseToDelete.title}</span>
                <span className="font-mono text-xs text-rose-600 font-bold">-{expenseToDelete.amount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            {deleteExpenseError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteExpenseError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteExpense} className="space-y-4 text-xs font-bold">
              {!isCurrentAdminSessionValid() && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                      Tài khoản:
                    </label>
                    <input
                      type="text"
                      required
                      value={deleteExpenseUser}
                      onChange={(e) => setDeleteExpenseUser(e.target.value)}
                      placeholder="admin"
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
                      value={deleteExpensePass}
                      onChange={(e) => setDeleteExpensePass(e.target.value)}
                      placeholder="Mật khẩu..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500 font-sans"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteExpenseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  disabled={isDeletingExpense}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingExpense ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span>{isDeletingExpense ? 'Đang Xóa...' : 'Xác Nhận Xóa Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHÓNG TO XEM ẢNH MINH CHỨNG NỘP TIỀN HOẶC HÓA ĐƠN BILL RÕ NÉT */}
      {activeViewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setActiveViewerImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[92vh] overflow-hidden rounded-[32px] bg-slate-900 border border-white/20 p-4 shadow-2xl flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3 text-white">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    {activeViewerImage.title}
                  </h3>
                  {activeViewerImage.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                      {activeViewerImage.badge}
                    </span>
                  )}
                </div>
                {activeViewerImage.subtitle && (
                  <p className="text-xs text-slate-400 font-medium">{activeViewerImage.subtitle}</p>
                )}
                {activeViewerImage.code && (
                  <p className="text-[11px] font-mono text-indigo-300">
                    Mã nộp: <strong>{activeViewerImage.code}</strong>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeViewerImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Mở Tab Mới</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveViewerImage(null)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition"
                >
                  ✕ Đóng
                </button>
              </div>
            </div>
            <div className="p-1 overflow-auto max-h-[75vh] flex items-center justify-center bg-black/40 rounded-2xl">
              <img
                src={activeViewerImage.url}
                alt={activeViewerImage.title}
                className="max-h-[72vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
