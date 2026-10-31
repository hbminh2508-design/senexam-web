'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
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
  FileSpreadsheet,
  AlertOctagon,
} from 'lucide-react'

export default function BauCuAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchVoter, setSearchVoter] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'votes' | 'settings'>('overview')

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
      const savedAuth = sessionStorage.getItem('fepn_admin_auth')
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
      }
    }
  }, [])

  // Tải dữ liệu bầu cử chi tiết (bao gồm cả danh sách phiếu bầu cho admin)
  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/baucu?admin=true')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (e) {
      console.error('Lỗi khi tải dữ liệu admin:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData()
    }
  }, [isAuthenticated])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'k71pme2' || password === 'fepn2026' || password === 'admin') {
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

  // Toggle Mở/Khóa Đăng ký
  const handleToggleRegistration = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_registration' }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData()
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
        body: JSON.stringify({ action: 'toggle_voting' }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData()
    } catch (e) {
      alert('Lỗi thao tác')
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
        body: JSON.stringify({ action: 'delete_candidate', candidateId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData()
    } catch (e) {
      alert('Lỗi khi xóa ứng viên')
    } finally {
      setActionLoading(false)
    }
  }

  // Xóa phiếu bầu gian lận theo Điều 5 Thể Lệ
  const handleDeleteVote = async (voteId: string, voterName: string, mssv: string) => {
    if (!confirm(`XÁC NHẬN HỦY PHIẾU BẦU GIAN LẬN:\nBạn có chắc muốn hủy phiếu của cử tri: ${voterName} (MSSV: ${mssv})?\nSau khi hủy, cử tri này có thể bỏ phiếu lại hợp lệ.`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_vote', voteId }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData()
    } catch (e) {
      alert('Lỗi khi xóa phiếu bầu')
    } finally {
      setActionLoading(false)
    }
  }

  // Reset phiếu để bầu vòng 2 hoặc làm lại từ đầu
  const handleResetVotes = async (keepCandidates: boolean) => {
    const confirmMsg = keepCandidates
      ? 'BẦU VÒNG 2:\nBạn có chắc muốn LÀM MỚI HÒM PHIẾU để chuẩn bị biểu quyết Vòng 2?\n(Toàn bộ ứng viên vẫn được giữ nguyên, chỉ xóa các phiếu bầu đã gửi).'
      : 'CẢNH BÁO NGUY HIỂM:\nBạn có chắc muốn XÓA TOÀN BỘ PHIẾU VÀ TẤT CẢ ỨNG VIÊN để làm lại từ đầu?'

    if (!confirm(confirmMsg)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_votes', keepCandidates }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchAdminData()
    } catch (e) {
      alert('Lỗi khi thiết lập lại')
    } finally {
      setActionLoading(false)
    }
  }

  // Thêm nhanh ứng viên thủ công
  const handleAddCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCandidate.name.trim() || !newCandidate.studentId.trim()) {
      alert('Vui lòng nhập Họ tên và MSSV của ứng viên')
      return
    }
    if (newCandidate.positionIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 chức vụ ứng cử')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_candidate',
          ...newCandidate,
        }),
      })
      const json = await res.json()
      alert(json.message)
      if (json.success) {
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
        await fetchAdminData()
      }
    } catch (e) {
      alert('Lỗi khi thêm ứng viên')
    } finally {
      setActionLoading(false)
    }
  }

  // Xuất file CSV danh sách cử tri đã bỏ phiếu
  const exportVotesToCSV = () => {
    if (!data?.votes || data.votes.length === 0) {
      alert('Chưa có phiếu bầu nào để xuất!')
      return
    }

    const headers = ['STT', 'Họ và tên cử tri', 'MSSV', 'Thời gian bỏ phiếu', 'Chi tiết lựa chọn']
    const rows = data.votes.map((v: any, index: number) => {
      const selectionsText = Object.entries(v.selections || {})
        .map(([posId, candIds]: [string, any]) => {
          const pos = data.positions.find((p: any) => p.id === posId)?.title || posId
          const candNames = candIds
            .map((cid: string) => data.candidates.find((c: any) => c.id === cid)?.name || cid)
            .join('; ')
          return `[${pos}: ${candNames}]`
        })
        .join(' | ')

      return [
        index + 1,
        `"${v.voterName.replace(/"/g, '""')}"`,
        `"${v.voterStudentId}"`,
        `"${new Date(v.votedAt).toLocaleString('vi-VN')}"`,
        `"${selectionsText.replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bien_ban_bo_phieu_${data.unit || 'K71P_ME2'}_vong_${data.round || 1}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ==========================================
  // GIAO DIỆN ĐĂNG NHẬP MẬT KHẨU QUẢN TRỊ
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
              KHOA FEPN • K71-P-ME2
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#002b66] mt-2">
              QUẢN TRỊ BẦU CỬ
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Dành riêng cho Ban Cán sự & Người điều hành phiên biểu quyết
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu Ban điều hành
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002b66] text-sm"
              />
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Đăng Nhập Điều Hành</span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link href="/baucu" className="hover:text-blue-600 transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Trang Chủ</span>
            </Link>
            <Link href="/baucu/tongket" className="hover:text-emerald-600 transition">
              Xem Kết Quả Tổng Kết →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // GIAO DIỆN BẢNG ĐIỀU KHIỂN CHÍNH (ADMIN PANEL)
  // ==========================================
  const summary = data?.summary
  const results = summary?.results || []
  const totalVotes = data?.totalVotes || 0
  const candidates = data?.candidates || []
  const votes = data?.votes || []

  // Lọc cử tri theo tìm kiếm
  const filteredVotes = votes.filter((v: any) => {
    const q = searchVoter.toLowerCase().trim()
    if (!q) return true
    return (
      v.voterName?.toLowerCase().includes(q) ||
      v.voterStudentId?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-8">
      {/* Header Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-900 text-xs font-black uppercase tracking-wider">
              ADMIN CONTROL
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Phiên bầu cử: {data?.unit || 'K71-P-ME2'} • Vòng {data?.round || 1}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] mt-1">
            BẢNG ĐIỀU HÀNH BẦU CỬ FEPN
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <Link
            href="/baucu/tongket"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
          >
            <span>Màn Hình Máy Chiếu (Trang 3)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 text-xs font-bold transition"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Thanh công cụ điều khiển nhanh (Quick Actions) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Nút 1: Mở/Đóng Đăng ký */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Hồ sơ ứng cử (Trang 1)</span>
            <strong className={`text-base font-bold ${data?.isRegistrationOpen ? 'text-emerald-600' : 'text-slate-500'}`}>
              {data?.isRegistrationOpen ? 'Đang MỞ nhận hồ sơ' : 'Đã ĐÓNG đăng ký'}
            </strong>
          </div>
          <button
            onClick={handleToggleRegistration}
            disabled={actionLoading}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              data?.isRegistrationOpen
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            {data?.isRegistrationOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{data?.isRegistrationOpen ? 'Khóa Đăng Ký' : 'Mở Đăng Ký'}</span>
          </button>
        </div>

        {/* Nút 2: Mở/Đóng Hòm phiếu */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Hòm phiếu bầu (Trang 2)</span>
            <strong className={`text-base font-bold ${data?.isVotingOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
              {data?.isVotingOpen ? 'Đang MỞ bỏ phiếu' : 'Đã ĐÓNG hòm phiếu'}
            </strong>
          </div>
          <button
            onClick={handleToggleVoting}
            disabled={actionLoading}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              data?.isVotingOpen
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            {data?.isVotingOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{data?.isVotingOpen ? 'Đóng Hòm Phiếu' : 'Mở Hòm Phiếu'}</span>
          </button>
        </div>

        {/* Nút 3: Reset phiếu bầu vòng 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Điều 3 Khoản 2 (Hòa phiếu)</span>
            <strong className="text-base font-bold text-amber-600">
              Vòng bầu {data?.round || 1}
            </strong>
          </div>
          <button
            onClick={() => handleResetVotes(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5"
            title="Xóa phiếu đã bầu, giữ lại ứng viên để bầu vòng 2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Làm Mới Bầu Vòng 2</span>
          </button>
        </div>
      </div>

      {/* Tabs chuyển đổi chức năng */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-[#002b66] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Tổng Quan & Kết Quả ({totalVotes} phiếu)</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'candidates'
              ? 'bg-[#002b66] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Quản Lý Ứng Viên ({candidates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('votes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'votes'
              ? 'bg-[#002b66] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <VoteIcon className="w-3.5 h-3.5" />
          <span>Danh Sách Cử Tri & Hủy Phiếu ({votes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-[#002b66] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Khởi Tạo / Reset Toàn Bộ</span>
        </button>
      </div>

      {/* NỘI DUNG TAB 1: TỔNG QUAN & KẾT QUẢ HIỆN TẠI */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-blue-900">
              <strong className="block text-sm font-bold text-[#002b66]">
                Tiến độ thu phiếu: {totalVotes} cử tri đã gửi biểu quyết
              </strong>
              <span>
                Trang kết quả tổng kết (Trang 3) đang được đồng bộ Realtime tự động lên máy chiếu lớp.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportVotesToCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất Biên Bản CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Biên Bản</span>
              </button>
            </div>
          </div>

          {/* Bảng kết quả nhanh từng chức vụ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((r: any) => (
              <div key={r.position.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#002b66]">{r.position.title}</h3>
                    <span className="text-[11px] text-slate-500">Chỉ tiêu: {r.position.quota} người</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
                    {r.totalVotesCastForPosition} lượt chọn
                  </span>
                </div>

                <div className="space-y-1.5">
                  {r.candidates.map((c: any) => (
                    <div
                      key={c.candidate.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                        c.isElected
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {c.isElected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        <span>{c.candidate.name} ({c.candidate.studentId})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{c.percentage}%</span>
                        <span className="font-extrabold text-sm">{c.voteCount} phiếu</span>
                      </div>
                    </div>
                  ))}
                  {r.candidates.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">Chưa có ứng viên nào</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 2: QUẢN LÝ ỨNG VIÊN */}
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#002b66]">Danh sách ứng viên đăng ký</h2>
              <p className="text-xs text-slate-500">Tổng cộng {candidates.length} bạn sinh viên đã đăng ký tranh cử</p>
            </div>
            <button
              onClick={() => setShowAddCandidateModal(true)}
              className="px-3.5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm Ứng Viên Thủ Công</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">MSSV</th>
                    <th className="p-3">Các chức vụ ứng cử</th>
                    <th className="p-3">Lời hứa / Hành động</th>
                    <th className="p-3">Thời gian nộp</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c: any) => {
                    const posTitles = (c.positionIds || [])
                      .map((pid: string) => data?.positions?.find((p: any) => p.id === pid)?.title || pid)
                      .join(', ')

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-bold text-slate-800">{c.name}</td>
                        <td className="p-3 font-mono text-blue-700 font-bold">{c.studentId}</td>
                        <td className="p-3 text-slate-700">{posTitles || 'Chưa chọn'}</td>
                        <td className="p-3 text-slate-500 italic max-w-xs truncate">{c.slogan || 'Không có'}</td>
                        <td className="p-3 text-slate-400">
                          {c.registeredAt ? new Date(c.registeredAt).toLocaleTimeString('vi-VN') : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteCandidate(c.id, c.name)}
                            disabled={actionLoading}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa ứng viên"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        Chưa có bạn sinh viên nào đăng ký tranh cử.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 3: DANH SÁCH CỬ TRI & CHỐNG GIAN LẬN */}
      {activeTab === 'votes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#002b66]">
                Kiểm toán phiếu bầu & Chống gian lận (Điều 5)
              </h2>
              <p className="text-xs text-slate-500">
                Mỗi cử tri chỉ được bỏ phiếu 1 lần. Nếu phát hiện gửi hộ hoặc giả mạo MSSV, người điều hành có quyền hủy phiếu.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchVoter}
                  onChange={(e) => setSearchVoter(e.target.value)}
                  placeholder="Tìm cử tri theo Tên hoặc MSSV..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs w-64 focus:outline-hidden focus:ring-2 focus:ring-[#002b66]"
                />
              </div>
              <button
                onClick={exportVotesToCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Họ và tên cử tri</th>
                    <th className="p-3">MSSV</th>
                    <th className="p-3">Thời gian bỏ phiếu</th>
                    <th className="p-3">Lựa chọn chi tiết</th>
                    <th className="p-3 text-right">Xử lý gian lận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVotes.map((v: any, index: number) => {
                    const selections = Object.entries(v.selections || {}).map(([posId, candIds]: [string, any]) => {
                      const posName = data?.positions?.find((p: any) => p.id === posId)?.title || posId
                      const candNames = candIds
                        .map((cid: string) => data?.candidates?.find((c: any) => c.id === cid)?.name || cid)
                        .join(', ')
                      return `${posName}: ${candNames}`
                    })

                    return (
                      <tr key={v.id || index} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{v.voterName}</td>
                        <td className="p-3 font-mono text-blue-700 font-bold">{v.voterStudentId}</td>
                        <td className="p-3 text-slate-500">
                          {new Date(v.votedAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-slate-600 max-w-md">
                          <div className="flex flex-wrap gap-1">
                            {selections.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteVote(v.id, v.voterName, v.voterStudentId)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition"
                            title="Xóa phiếu nếu phát hiện gian lận theo Điều 5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hủy Phiếu</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredVotes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        {searchVoter ? 'Không tìm thấy cử tri phù hợp' : 'Chưa có cử tri nào bỏ phiếu.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 4: RESET TOÀN BỘ */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white border border-rose-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertOctagon className="w-7 h-7 shrink-0" />
            <div>
              <h3 className="text-base font-bold">Khu Vực Nguy Hiểm (Danger Zone)</h3>
              <p className="text-xs text-slate-500">
                Chỉ thực hiện khi lớp trưởng hoặc ban điều hành muốn hủy phiên bầu cử hiện tại để tổ chức lại.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <strong className="text-xs font-bold text-slate-800 block">Làm mới hòm phiếu (Bầu Vòng 2)</strong>
                <span className="text-[11px] text-slate-500">
                  Xóa toàn bộ các phiếu đã nộp, giữ nguyên danh sách ứng viên tranh cử.
                </span>
              </div>
              <button
                onClick={() => handleResetVotes(true)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-bold transition"
              >
                Reset Phiếu
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
              <div>
                <strong className="text-xs font-bold text-rose-800 block">Xóa sạch toàn bộ (Reset All)</strong>
                <span className="text-[11px] text-rose-600">
                  Xóa toàn bộ phiếu bầu và toàn bộ ứng viên về trạng thái ban đầu.
                </span>
              </div>
              <button
                onClick={() => handleResetVotes(false)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Xóa Toàn Bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM ỨNG VIÊN THỦ CÔNG */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#002b66]">Thêm Ứng Viên Mới (Thủ Công)</h3>
              <button
                onClick={() => setShowAddCandidateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCandidateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ và tên ứng viên *</label>
                <input
                  type="text"
                  required
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002b66]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã số sinh viên (MSSV) *</label>
                  <input
                    type="text"
                    required
                    value={newCandidate.studentId}
                    onChange={(e) => setNewCandidate({ ...newCandidate, studentId: e.target.value })}
                    placeholder="Ví dụ: 26021234"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002b66]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={newCandidate.phone}
                    onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                    placeholder="0987654321"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002b66]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Các chức vụ ứng cử * (Chọn một hoặc nhiều)</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl">
                  {data?.positions?.map((pos: any) => {
                    const isChecked = newCandidate.positionIds.includes(pos.id)
                    return (
                      <label
                        key={pos.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition text-[11px] ${
                          isChecked ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold' : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewCandidate({
                                ...newCandidate,
                                positionIds: [...newCandidate.positionIds, pos.id],
                              })
                            } else {
                              setNewCandidate({
                                ...newCandidate,
                                positionIds: newCandidate.positionIds.filter((id) => id !== pos.id),
                              })
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>{pos.title}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lời hứa tranh cử / Chương trình hành động</label>
                <textarea
                  rows={2}
                  value={newCandidate.slogan}
                  onChange={(e) => setNewCandidate({ ...newCandidate, slogan: e.target.value })}
                  placeholder="Gắn kết lớp K71-P-ME2 nhiệt huyết, năng động..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002b66]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#002b66] hover:bg-[#001f4d] text-white font-bold transition shadow-xs"
                >
                  Thêm Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
