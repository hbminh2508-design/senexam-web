'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Users,
  Clock,
  Sparkles,
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
} from 'lucide-react'
import { isValidAdminDailyPassword, getExpectedAdminDailyPassword } from '@/lib/nopQuyLopAuth'

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
  const [createDueDate, setCreateDueDate] = useState('')
  const [createBankName, setCreateBankName] = useState('MBBANK')
  const [createBankAccount, setCreateBankAccount] = useState('')
  const [createAccountName, setCreateAccountName] = useState('')
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

  // Modal Share QR
  const [shareQrFund, setShareQrFund] = useState<FundSummary | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleOpenCreateModal = () => {
    if (isAdminVerified) {
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

      const payload = {
        title: createTitle,
        className: createClassName || 'ME2',
        amountPerPerson: amount,
        dueDate: createDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        bankName: createBankName,
        bankAccount: createBankAccount,
        accountName: createAccountName,
        description: createDescription,
        adminPasscode: createAdminPasscode,
        adminUsername: adminUsername.trim(),
        adminPassword: adminPassword.trim(),
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

      // Reset form
      setShowCreateModal(false)
      setCreateTitle('')
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

  // Thống kê tổng hợp
  const totalFundsCount = funds.length
  const totalAmountCollectedAll = funds.reduce((acc, f) => acc + f.totalCollected, 0)
  const totalOverdueStudentsCount = funds.reduce((acc, f) => acc + f.overdueOneWeekStudents, 0)

  const filteredFunds = funds.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.className.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Quỹ Lớp ME2
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase border border-indigo-200 dark:border-indigo-800">
                  Công Khai Minh Bạch
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Hệ thống theo dõi & nộp quỹ lớp tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Đợt Thu Quỹ (Admin)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner & Stats */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-6 sm:p-10 text-white shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold border border-white/15 text-indigo-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Trang Nộp Tiền Quỹ Lớp ME2 — Kèm AI Lọc Danh Sách Tự Động
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Theo Dõi Thu Chi & Nộp Quỹ Lớp Minh Bạch Thời Gian Thực
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-medium">
              Tất cả các khoản nộp đều được công khai minh bạch. Sinh viên dễ dàng quét mã VietQR tự động sinh nội dung chuyển khoản theo tên hoặc MSSV.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/10 mt-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Số Đợt Thu Quỹ
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">{totalFundsCount}</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Tổng Tiền Đã Thu
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {totalAmountCollectedAll.toLocaleString('vi-VN')} đ
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-[11px] text-slate-300 font-bold uppercase block mb-1">
                Cơ Chế Kiểm Tra
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-300">Họ Tên / MSSV</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">Lọc theo:</span>
            <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black border border-indigo-200 dark:border-indigo-900">
              Lớp ME2
            </span>
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
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-900">
                          {fund.className}
                        </span>

                        {fund.overdueOneWeekStudents > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                            <Flame className="h-3 w-3" /> {fund.overdueOneWeekStudents} Trễ &gt; 1 tuần
                          </span>
                        ) : fund.isPastDueDate ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-[10px] font-bold text-[10px]">
                            Đã qua hạn nộp
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold text-[10px]">
                            Đang thu quỹ
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 transition-colors">
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
                          <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
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
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${fund.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-black/5 dark:border-white/5">
                      <Link
                        href={`/nopquylop/${fund.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition"
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

      {/* MODAL TẠO QUỸ MỚI CÓ AI GEMINI 3.5 FLASH LITE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 p-6 sm:p-8 text-slate-900 dark:text-white shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Tạo Đợt Thu Quỹ Lớp ME2
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Hỗ trợ trích xuất & lọc họ tên danh sách lớp bằng AI (gemini-3.5-flash-lite)
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Ngân hàng nhận:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: MBBANK, VCB, TCB..."
                    value={createBankName}
                    onChange={(e) => setCreateBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Số tài khoản:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0988776655"
                    value={createBankAccount}
                    onChange={(e) => setCreateBankAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                    Tên chủ tài khoản:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: NGUYEN VAN A"
                    value={createAccountName}
                    onChange={(e) => setCreateAccountName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500"
                  />
                </div>

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
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Dán Danh Sách Lớp Thô Để AI Lọc
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
                  className="w-full p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800 text-xs font-mono outline-none focus:border-indigo-600"
                />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAiParseList}
                    disabled={isAiParsing || !rawTextList.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition disabled:opacity-40"
                  >
                    {isAiParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI (gemini-3.5-flash-lite) đang phân tích...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Lọc & Trích Xuất AI (gemini-3.5-flash-lite)</span>
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
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black shadow-md transition disabled:opacity-40"
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
