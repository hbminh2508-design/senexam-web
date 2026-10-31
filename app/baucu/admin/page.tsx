'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ShieldCheck,
  Lock,
  Unlock,
  Users,
  Vote as VoteIcon,
  Trash2,
  PlusCircle,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  ChevronRight,
  UserCheck,
  Settings,
  ArrowLeft,
  GraduationCap,
  Plus,
  QrCode,
  Copy,
  ExternalLink,
  Maximize2,
} from 'lucide-react'

function BauCuAdminContent() {
  const searchParams = useSearchParams()
  const initialClass = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // Danh sách lớp và lớp được chọn
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClass)

  // Modal tạo lớp mới
  const [showCreateClassModal, setShowCreateClassModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassAcademicYear, setNewClassAcademicYear] = useState('2026-2027')
  const [creatingClass, setCreatingClass] = useState(false)

  // Dữ liệu lớp hiện tại
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchVoter, setSearchVoter] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'votes' | 'settings'>('overview')

  // QR Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  // Form thêm ứng viên thủ công
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false)
  const [newCandidate, setNewCandidate] = useState({
    name: '',
    studentId: '',
    phone: '',
    email: '',
    positionIds: [] as string[],
    slogan: '',
    bio: '',
  })

  // Kiểm tra phiên đăng nhập đã lưu trong sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      const savedAuth = sessionStorage.getItem('fepn_admin_auth')
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
      }
    }
  }, [])

  // Tải danh sách lớp
  const fetchClassesList = async () => {
    try {
      const res = await fetch(`/api/baucu?action=classes&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setClasses(json.data)
        const exists = json.data.some((c: any) => c.id === selectedClassId)
        if (!exists && json.data.length > 0) {
          setSelectedClassId(json.data[0].id)
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải danh sách lớp:', e)
    }
  }

  // Tải dữ liệu của lớp đang chọn
  const fetchAdminData = async (classId: string, showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`/api/baucu?class=${encodeURIComponent(classId)}&admin=true&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu admin:', e)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchClassesList()
      const listInterval = setInterval(() => {
        fetchClassesList()
      }, 5000)
      return () => clearInterval(listInterval)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && selectedClassId) {
      fetchAdminData(selectedClassId, true)
      const dataInterval = setInterval(() => {
        fetchAdminData(selectedClassId, false)
      }, 3500)
      return () => clearInterval(dataInterval)
    }
  }, [isAuthenticated, selectedClassId])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'k70pme2' || password === 'k71pme2' || password === 'fepn2026' || password === 'admin') {
      setIsAuthenticated(true)
      sessionStorage.setItem('fepn_admin_auth', 'true')
      setAuthError(null)
    } else {
      setAuthError('Mật khẩu quản trị chưa chính xác. Vui lòng kiểm tra lại.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('fepn_admin_auth')
  }

  // Tạo lớp bầu cử mới
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newClassName.trim().toUpperCase()
    if (!cleanName) {
      alert('Vui lòng nhập tên lớp cần tạo.')
      return
    }

    setCreatingClass(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_class',
          unit: cleanName,
          academicYear: newClassAcademicYear.trim() || '2026-2027',
        }),
      })

      const json = await res.json()
      if (json.success) {
        alert(json.message)
        setShowCreateClassModal(false)
        setNewClassName('')
        await fetchClassesList()
        if (json.data?.id) {
          setSelectedClassId(json.data.id)
        }
      } else {
        alert(json.message || 'Không thể tạo lớp mới')
      }
    } catch (e) {
      alert('Lỗi mạng khi tạo lớp')
    } finally {
      setCreatingClass(false)
    }
  }

  // Toggle Mở/Khóa Đăng ký
  const handleToggleRegistration = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_registration', classId: selectedClassId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData(selectedClassId)
      await fetchClassesList()
    } catch (e) {
      alert('Lỗi thao tác')
    } finally {
      setActionLoading(false)
    }
  }

  // Toggle Mở/Khóa Bỏ phiếu
  const handleToggleVoting = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_voting', classId: selectedClassId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData(selectedClassId)
      await fetchClassesList()
    } catch (e) {
      alert('Lỗi thao tác')
    } finally {
      setActionLoading(false)
    }
  }

  // Thêm ứng viên thủ công
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCandidate.name || !newCandidate.studentId || newCandidate.positionIds.length === 0) {
      alert('Vui lòng nhập đầy đủ Tên, MSSV và chọn ít nhất 1 chức vụ!')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_candidate',
          classId: selectedClassId,
          ...newCandidate,
        }),
      })
      const json = await res.json()
      alert(json.message)
      setShowAddCandidateModal(false)
      setNewCandidate({
        name: '',
        studentId: '',
        phone: '',
        email: '',
        positionIds: [],
        slogan: '',
        bio: '',
      })
      await fetchAdminData(selectedClassId)
    } catch (e) {
      alert('Lỗi khi thêm ứng viên')
    } finally {
      setActionLoading(false)
    }
  }

  // Xóa ứng viên
  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA ứng cử viên "${candidateName}" khỏi danh sách?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_candidate', classId: selectedClassId, candidateId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData(selectedClassId)
    } catch (e) {
      alert('Lỗi khi xóa ứng viên')
    } finally {
      setActionLoading(false)
    }
  }

  // Xóa phiếu bầu gian lận theo Điều 5 Thể Lệ
  const handleDeleteVote = async (voteId: string, voterName: string, mssv: string) => {
    if (
      !confirm(
        `XÁC NHẬN HỦY PHIẾU BẦU GIAN LẬN:\nBạn có chắc muốn hủy phiếu của cử tri: ${voterName} (MSSV: ${mssv})?\nSau khi hủy, cử tri này có thể bỏ phiếu lại hợp lệ.`
      )
    )
      return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_vote', classId: selectedClassId, voteId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData(selectedClassId)
    } catch (e) {
      alert('Lỗi khi xóa phiếu bầu')
    } finally {
      setActionLoading(false)
    }
  }

  // Reset phiếu để bầu vòng 2 hoặc làm lại từ đầu
  const handleResetVotes = async (keepCandidates: boolean) => {
    const confirmMsg = keepCandidates
      ? `BẦU VÒNG 2 CHO LỚP ${currentUnit}:\nBạn có chắc muốn LÀM MỚI HÒM PHIẾU để chuẩn bị biểu quyết Vòng 2?\n(Toàn bộ ứng viên vẫn được giữ nguyên, chỉ xóa các phiếu bầu đã gửi).`
      : `CẢNH BÁO NGUY HIỂM:\nBạn có chắc muốn XÓA TOÀN BỘ PHIẾU VÀ TẤT CẢ ỨNG VIÊN của lớp ${currentUnit} để làm lại từ đầu?`

    if (!confirm(confirmMsg)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_votes', classId: selectedClassId, keepCandidates }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData(selectedClassId)
      await fetchClassesList()
    } catch (e) {
      alert('Lỗi khi thiết lập lại')
    } finally {
      setActionLoading(false)
    }
  }

  // Xóa lớp bầu cử
  const handleDeleteClass = async () => {
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA TOÀN BỘ phiên bầu cử của lớp ${currentUnit}?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_class', classId: selectedClassId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchClassesList()
      setSelectedClassId('k70p_me2')
    } catch (e) {
      alert('Lỗi khi xóa lớp')
    } finally {
      setActionLoading(false)
    }
  }

  const currentUnit = data?.unit || selectedClassId.toUpperCase()
  const lockedVotingUrl = origin
    ? `${origin}/baucu/bophieu?class=${encodeURIComponent(selectedClassId)}&lock=1`
    : `/baucu/bophieu?class=${encodeURIComponent(selectedClassId)}&lock=1`

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=15&data=${encodeURIComponent(
    lockedVotingUrl
  )}`

  const handleCopyLink = () => {
    if (!lockedVotingUrl) return
    navigator.clipboard.writeText(lockedVotingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ================= MÀN HÌNH ĐĂNG NHẬP ADMIN =================
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-16">
        <div className="max-w-md w-full bg-white border border-slate-300 rounded-3xl p-6 sm:p-8 shadow-md space-y-5">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-blue-100 text-[#002b66] rounded-full flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-[#002b66] uppercase">
              QUẢN TRỊ BẦU CỬ FEPN
            </h2>
            <p className="text-xs text-slate-500">
              Khu vực dành cho Ban tổ chức và Cố vấn học tập điều hành biểu quyết
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mật khẩu quản trị viên
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đăng nhập trang quản trị</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <Link href="/baucu" className="text-xs text-slate-500 hover:text-slate-800 underline">
              Quay về trang chủ bầu cử
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ================= MÀN HÌNH QUẢN TRỊ ĐÃ XÁC THỰC =================
  const candidates = data?.candidates || []
  const votes = data?.votes || []
  const summary = data?.summary
  const results = summary?.results || []

  const filteredVotes = votes.filter((v: any) => {
    if (!searchVoter.trim()) return true
    const q = searchVoter.trim().toLowerCase()
    return (
      (v.voterName || '').toLowerCase().includes(q) ||
      (v.voterStudentId || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* HEADER TRANG QUẢN TRỊ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-100 text-[#002b66] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>TRANG ĐIỀU HÀNH & TẠO BẦU CỬ CÁC LỚP</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase">
            QUẢN TRỊ BẦU CỬ: {currentUnit}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateClassModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo bầu cử lớp mới</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* THANH CHUYỂN ĐỔI GIỮA CÁC LỚP */}
      <div className="bg-white border-2 border-blue-100 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#002b66]" />
          <span className="text-xs font-bold text-slate-700">Lớp đang điều hành:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-black text-[#002b66] bg-slate-50 outline-hidden cursor-pointer"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Lớp {c.unit} ({c.academicYear}) - {c.totalVotes || 0} phiếu
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="px-3 py-1.5 bg-[#002b66] text-white hover:bg-[#001f4d] font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Xem mã QR lớp {currentUnit}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Đã chép link!' : 'Chép link'}</span>
          </button>

          <Link
            href={`/baucu/bophieu?class=${encodeURIComponent(selectedClassId)}&lock=1`}
            target="_blank"
            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
            title="Mở thử hòm phiếu lớp này"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 4 NÚT ĐIỀU HÀNH NHANH (MỞ/KHÓA BỎ PHIẾU, TIẾP NHẬN ỨNG CỬ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toggle Bỏ phiếu */}
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Hòm phiếu bầu cử:</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                data?.isVotingOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {data?.isVotingOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
            </span>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleToggleVoting}
            className={`w-full py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              data?.isVotingOpen
                ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {data?.isVotingOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{data?.isVotingOpen ? 'Đóng hòm phiếu' : 'Mở hòm phiếu'}</span>
          </button>
        </div>

        {/* Toggle Đăng ký */}
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Cổng tiếp nhận ứng cử:</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                data?.isRegistrationOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {data?.isRegistrationOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
            </span>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleToggleRegistration}
            className={`w-full py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              data?.isRegistrationOpen
                ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {data?.isRegistrationOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{data?.isRegistrationOpen ? 'Đóng cổng ứng cử' : 'Mở cổng ứng cử'}</span>
          </button>
        </div>

        {/* Bầu vòng 2 */}
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Vòng biểu quyết:</span>
            <span className="text-xs font-black text-[#002b66]">Vòng {data?.round || 1}</span>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleResetVotes(true)}
            className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span>Làm mới hòm phiếu (Bầu vòng 2)</span>
          </button>
        </div>

        {/* Thêm ứng viên thủ công */}
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Tổng ứng viên:</span>
            <span className="text-xs font-black text-blue-700">{candidates.length} người</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCandidateModal(true)}
            className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#002b66] border border-blue-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Thêm ứng viên trực tiếp</span>
          </button>
        </div>
      </div>

      {/* TABS CHUYỂN GIAO DIỆN QUẢN TRỊ */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-[#002b66] text-[#002b66]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <VoteIcon className="w-4 h-4" />
          <span>Tổng quan kết quả ({data?.totalVotes || 0} phiếu)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'candidates'
              ? 'border-[#002b66] text-[#002b66]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Danh sách ứng viên ({candidates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('votes')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'votes'
              ? 'border-[#002b66] text-[#002b66]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Nhật ký phiếu cử tri ({votes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-[#002b66] text-[#002b66]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt lớp {currentUnit}</span>
        </button>
      </div>

      {/* NỘI DUNG TAB 1: TỔNG QUAN KẾT QUẢ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((posRes: any) => (
              <div key={posRes.position.id} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#002b66] uppercase">{posRes.position.title}</h3>
                    <span className="text-[11px] text-slate-500">
                      Chỉ tiêu: {posRes.position.quota} • Tổng phiếu: {posRes.totalVotesCastForPosition}
                    </span>
                  </div>
                  {posRes.hasTie && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                      Hòa phiếu!
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {posRes.candidates.map((candRes: any) => (
                    <div
                      key={candRes.candidate.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        candRes.isElected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : candRes.isTied
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {candRes.isElected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        <span>{candRes.candidate.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">({candRes.candidate.studentId})</span>
                      </div>
                      <div className="font-mono font-bold">
                        {candRes.voteCount} phiếu ({candRes.percentage}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 2: DANH SÁCH ỨNG VIÊN */}
      {activeTab === 'candidates' && (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase">
              Danh sách ứng cử viên lớp {currentUnit}
            </h2>
            <button
              type="button"
              onClick={() => setShowAddCandidateModal(true)}
              className="px-3 py-1.5 bg-[#002b66] text-white rounded-lg text-xs font-bold hover:bg-[#001f4d] transition"
            >
              + Thêm ứng viên
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">MSSV</th>
                  <th className="p-3">Chức vụ ứng cử</th>
                  <th className="p-3">Slogan / Lời hứa</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3 font-mono text-blue-900 font-bold">{c.studentId}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {c.positionIds.map((pId: string) => {
                          const posObj = data?.positions?.find((p: any) => p.id === pId)
                          return (
                            <span key={pId} className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded-sm text-[10px]">
                              {posObj?.title || pId}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="p-3 italic text-slate-500 max-w-xs truncate">{c.slogan || '—'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(c.id, c.name)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Xóa ứng viên"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 3: NHẬT KÝ PHIẾU CỬ TRI */}
      {activeTab === 'votes' && (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase">
                Nhật ký phiếu cử tri lớp {currentUnit}
              </h2>
              <p className="text-xs text-slate-500">
                Kiểm soát danh sách cử tri đã bỏ phiếu, hủy phiếu gian lận theo Điều 5 Thể lệ
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchVoter}
                onChange={(e) => setSearchVoter(e.target.value)}
                placeholder="Tìm MSSV hoặc tên cử tri..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-slate-50 outline-hidden w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">STT</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">MSSV</th>
                  <th className="p-3">Thời gian bỏ phiếu</th>
                  <th className="p-3 text-right">Xử lý (Điều 5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVotes.map((v: any, idx: number) => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{v.voterName}</td>
                    <td className="p-3 font-mono text-blue-900 font-bold">{v.voterStudentId}</td>
                    <td className="p-3 text-slate-500">
                      {new Date(v.votedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteVote(v.id, v.voterName, v.voterStudentId)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition"
                        title="Hủy phiếu gian lận để cử tri bầu lại"
                      >
                        Hủy phiếu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 4: CÀI ĐẶT LỚP */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-xs space-y-6 max-w-2xl">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase">
              Cài đặt phiên bầu cử lớp {currentUnit}
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tên lớp biểu quyết</label>
              <input
                type="text"
                disabled
                value={currentUnit}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Năm học</label>
              <input
                type="text"
                disabled
                value={data?.academicYear || '2026-2027'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tiêu đề phiên bầu cử</label>
              <input
                type="text"
                disabled
                value={data?.title || ''}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="font-bold text-xs text-rose-700 uppercase">Khu vực nguy hiểm</h3>
            <p className="text-[11px] text-slate-500">
              Xóa phiên bầu cử này sẽ xóa toàn bộ danh sách ứng viên, phiếu bầu và cấu hình của lớp {currentUnit}.
            </p>
            <button
              type="button"
              onClick={handleDeleteClass}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Xóa hoàn toàn phiên bầu cử lớp {currentUnit}
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL TẠO LỚP BẦU CỬ MỚI ================= */}
      {showCreateClassModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreateClassModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                TẠO PHIÊN BẦU CỬ CHO LỚP MỚI
              </h3>
              <p className="text-xs text-slate-500">
                Hệ thống sẽ tự động khởi tạo cơ cấu 8 chức vụ chuẩn và mã QR riêng biệt cho lớp
              </p>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên lớp biểu quyết <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: K70P-ME2, K70-CLC, K71-ME1..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold uppercase bg-slate-50 outline-hidden focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Năm học</label>
                <input
                  type="text"
                  value={newClassAcademicYear}
                  onChange={(e) => setNewClassAcademicYear(e.target.value)}
                  placeholder="Ví dụ: 2026-2027"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 outline-hidden"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
                <p className="font-bold">• Sau khi tạo:</p>
                <p>- Lớp mới sẽ có mã QR riêng biệt và hòm phiếu bảo mật chống phiếu ma.</p>
                <p>- Cơ cấu 8 chức vụ chuẩn mực của Khoa FEPN sẽ được thiết lập tự động.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateClassModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingClass}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  {creatingClass ? 'Đang khởi tạo...' : 'Khởi tạo bầu cử ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PHÓNG TO QR MÁY CHIẾU ================= */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-10 max-w-lg w-full text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2">
              <img src="/fepn-logo.png" alt="FEPN" className="w-8 h-8 object-contain" />
              <h3 className="text-lg sm:text-xl font-black text-[#002b66] uppercase">
                BẦU CỬ LỚP {currentUnit}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Chiếu mã QR này lên máy chiếu để sinh viên lớp <strong>{currentUnit}</strong> quét mã bỏ phiếu
            </p>

            <div className="p-4 bg-white border-4 border-[#002b66] rounded-2xl inline-block shadow-md">
              <img
                src={qrImageUrl}
                alt={`QR Code Lớp ${currentUnit}`}
                className="w-72 h-72 sm:w-80 sm:h-80 object-contain mx-auto"
              />
            </div>

            <div className="font-mono text-xs text-blue-700 font-bold break-all bg-blue-50 p-2.5 rounded-lg border border-blue-200">
              {lockedVotingUrl}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                {copied ? 'Đã sao chép link!' : 'Sao chép link'}
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL THÊM ỨNG VIÊN THỦ CÔNG ================= */}
      {showAddCandidateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddCandidateModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Thêm ứng cử viên cho lớp {currentUnit}
              </h3>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  placeholder="Ví dụ: Trần Văn Nam"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCandidate.studentId}
                  onChange={(e) =>
                    setNewCandidate({ ...newCandidate, studentId: e.target.value.toUpperCase() })
                  }
                  placeholder="Ví dụ: 26020456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase bg-slate-50 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Các chức vụ ứng cử <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 border border-slate-200 p-3 rounded-xl bg-slate-50 max-h-48 overflow-y-auto">
                  {(data?.positions || []).map((p: any) => {
                    const isChecked = newCandidate.positionIds.includes(p.id)
                    return (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewCandidate({
                                ...newCandidate,
                                positionIds: [...newCandidate.positionIds, p.id],
                              })
                            } else {
                              setNewCandidate({
                                ...newCandidate,
                                positionIds: newCandidate.positionIds.filter((id) => id !== p.id),
                              })
                            }
                          }}
                        />
                        <span className="text-[11px] font-semibold">{p.title}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Slogan / Chương trình hành động</label>
                <input
                  type="text"
                  value={newCandidate.slogan}
                  onChange={(e) => setNewCandidate({ ...newCandidate, slogan: e.target.value })}
                  placeholder="Ví dụ: Tận tâm, đoàn kết, vì sự phát triển của lớp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu ứng viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BauCuAdminPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Đang tải trang quản trị...</div>}>
      <BauCuAdminContent />
    </Suspense>
  )
}
