'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  Award,
  Vote as VoteIcon,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Crown,
  FileCheck,
  RefreshCw,
  Lock,
  Unlock,
  Settings,
  Printer,
  ChevronRight,
  Sparkles,
  Radio,
} from 'lucide-react'

export default function TongKetPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [lastLivePing, setLastLivePing] = useState<string>('')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPass, setAdminPass] = useState('')
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)

  const fetchResults = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsRefreshing(true)
    try {
      const res = await fetch('/api/baucu')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setLastLivePing(new Date().toLocaleTimeString('vi-VN'))
      }
    } catch (err) {
      console.error('Lỗi khi tải kết quả tổng kết:', err)
    } finally {
      setLoading(false)
      if (showLoadingIndicator) setIsRefreshing(false)
    }
  }

  // Supabase Realtime Listener + Polling dự phòng
  useEffect(() => {
    fetchResults()

    // Đăng ký nhận thông báo Realtime từ Supabase
    let channel: any = null
    try {
      channel = supabase
        .channel('fepn_election_live_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fepn_election_votes' },
          (payload) => {
            console.log('[Realtime] Có phiếu bầu mới hoặc thay đổi phiếu:', payload)
            fetchResults(false)
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fepn_election_candidates' },
          (payload) => {
            console.log('[Realtime] Danh sách ứng viên cập nhật:', payload)
            fetchResults(false)
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fepn_election_settings' },
          (payload) => {
            console.log('[Realtime] Trạng thái phiên bầu cử cập nhật:', payload)
            fetchResults(false)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true)
          }
        })
    } catch (e) {
      console.warn('Realtime Supabase subscription error, using polling fallback', e)
    }

    // Polling dự phòng mỗi 3.5 giây đảm bảo dữ liệu luôn tươi mới
    const interval = setInterval(() => {
      fetchResults(false)
    }, 3500)

    return () => {
      clearInterval(interval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Mật khẩu điều hành đơn giản cho ban cán sự / người điều hành
    if (adminPass === 'k71pme2' || adminPass === 'fepn2026' || adminPass === 'admin') {
      setIsAdminUnlocked(true)
      setAdminMsg(null)
    } else {
      setAdminMsg('Mật khẩu quản trị chưa chính xác. (Mặc định: k71pme2 hoặc fepn2026)')
    }
  }

  const handleToggleRegistration = async () => {
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_registration' }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchResults(true)
    } catch (e) {
      alert('Lỗi thao tác')
    }
  }

  const handleToggleVoting = async () => {
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_voting' }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchResults(true)
    } catch (e) {
      alert('Lỗi thao tác')
    }
  }

  const handleResetVotesForRound2 = async (keepCandidates: boolean) => {
    const confirmText = keepCandidates
      ? 'Bạn có chắc chắn muốn LÀM MỚI HÒM PHIẾU để BẦU VÒNG 2? (Danh sách ứng viên vẫn được giữ nguyên)'
      : 'CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ PHIẾU VÀ ỨNG VIÊN để làm lại từ đầu?'

    if (!confirm(confirmText)) return

    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_votes', keepCandidates }),
      })
      const json = await res.json()
      alert(json.message)
      await fetchResults(true)
    } catch (e) {
      alert('Lỗi khi reset hòm phiếu')
    }
  }

  const summary = data?.summary
  const results = summary?.results || []
  const totalVoters = summary?.totalVoters || 0

  // Danh sách các ứng viên trúng cử chính thức
  const electedList: { positionTitle: string; candidateName: string; studentId: string; votes: number }[] = []
  results.forEach((posRes: any) => {
    posRes.candidates?.forEach((c: any) => {
      if (c.isElected) {
        electedList.push({
          positionTitle: posRes.position.title,
          candidateName: c.candidate.name,
          studentId: c.candidate.studentId,
          votes: c.voteCount,
        })
      }
    })
  })

  // Kiểm tra xem có chức vụ nào bị hòa phiếu cần bầu lại không
  const tiedPositions = results.filter((r: any) => r.hasTie)

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* Header kết quả */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>BƯỚC 3: CÔNG BỐ KẾT QUẢ BIỂU QUYẾT TỔNG HỢP</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-[#002b66] uppercase font-serif">
          KẾT QUẢ BẦU CỬ BAN CÁN SỰ & BAN CHẤP HÀNH
        </h1>
        <div className="inline-block px-3 py-1 bg-[#002b66] text-white text-xs font-bold uppercase tracking-wider rounded-md">
          ĐƠN VỊ: K71-P-ME2 • NĂM HỌC 2026-2027
        </div>
      </div>

      {/* Thẻ thống kê tổng quan cử tri */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
          <span className="text-xs text-slate-500 block">Số phiếu đã thu về</span>
          <strong className="text-2xl sm:text-3xl font-black text-[#002b66]">{totalVoters}</strong>
          <span className="text-[11px] text-slate-400 block mt-0.5">cử tri đã biểu quyết</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
          <span className="text-xs text-slate-500 block">Trạng thái hòm phiếu</span>
          <div className="mt-1">
            {data?.isVotingOpen ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                ● Đang mở hòm phiếu
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">
                🔒 Đã đóng hòm phiếu
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Cập nhật mỗi 3s</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
          <span className="text-xs text-slate-500 block">Số vị trí trúng cử</span>
          <strong className="text-2xl sm:text-3xl font-black text-emerald-600">{electedList.length}</strong>
          <span className="text-[11px] text-slate-400 block mt-0.5">nhân sự đã xác định</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
          <span className="text-xs text-slate-500 block">Vòng bầu hiện tại</span>
          <strong className="text-2xl sm:text-3xl font-black text-amber-600">Vòng {data?.round || 1}</strong>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {tiedPositions.length > 0 ? 'Có vị trí hòa phiếu' : 'Tiến trình bình thường'}
          </span>
        </div>
      </div>

      {/* Thanh trạng thái Live Realtime và Công cụ điều hành */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-900 to-[#002b66] text-white p-3.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <span>Supabase Realtime Live</span>
            <span className="text-blue-200 text-xs hidden sm:inline">• Nhảy số tức thì khi có cử tri nộp phiếu</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastLivePing && (
            <span className="text-[11px] text-blue-200 hidden md:inline">
              Cập nhật: {lastLivePing}
            </span>
          )}
          <button
            onClick={() => fetchResults(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
          <Link
            href="/baucu/admin"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold transition shadow-xs"
          >
            <Settings className="w-3.5 h-3.5 text-slate-900" />
            <span>Trang Admin Điều Hành</span>
          </Link>
        </div>
      </div>
      {tiedPositions.length > 0 && (
        <div className="p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm sm:text-base">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <span>THÔNG BÁO HÒA PHIẾU - CẦN BIỂU QUYẾT BẦU LẠI THEO ĐIỀU 3</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
            Hệ thống phát hiện có <strong>{tiedPositions.length} chức vụ</strong> có từ 2 ứng viên trở lên bằng phiếu ở vị trí dẫn đầu / tranh chấp chỉ tiêu:
          </p>
          <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1 font-semibold">
            {tiedPositions.map((p: any) => (
              <li key={p.position.id}>
                <strong>{p.position.title}:</strong> Bằng phiếu giữa các ứng viên{' '}
                {p.tiedCandidates.map((c: any) => `${c.name} (${c.studentId})`).join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 italic">
            * Theo Điều 3 Khoản 2: "Nếu có từ 2 ứng viên trở lên bằng phiếu ở vị trí cao nhất, lớp sẽ bầu lại giữa các ứng viên này bằng một phiên mới, mỗi thành viên chỉ được chọn 1 ứng viên."
          </p>
        </div>
      )}

      {/* ================= BẢNG DANH SÁCH BAN CÁN SỰ & BAN CHẤP HÀNH TRÚNG CỬ ================= */}
      {electedList.length > 0 && (
        <div className="bg-gradient-to-br from-[#002b66] to-[#00193d] text-white rounded-3xl p-6 sm:p-10 shadow-xl space-y-6">
          <div className="text-center space-y-2 border-b border-white/20 pb-5">
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h2 className="text-xl sm:text-3xl font-black font-serif uppercase tracking-tight">
                DANH SÁCH NHÂN SỰ TRÚNG CỬ CHÍNH THỨC
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-blue-200">
              Ban Cán Sự & Ban Chấp Hành Lâm Thời Lớp K71-P-ME2 (Năm học 2026-2027)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {electedList.map((item, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-3.5 hover:bg-white/15 transition"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider block truncate">
                    {item.positionTitle}
                  </span>
                  <strong className="text-sm sm:text-base font-extrabold text-white block truncate">
                    {item.candidateName}
                  </strong>
                  <div className="text-[11px] text-blue-200 font-mono">
                    MSSV: {item.studentId} • <span className="font-bold text-white">{item.votes} phiếu</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-blue-200 italic pt-2">
            * Căn cứ Điều 3 Khoản 3: Nếu một ứng viên trúng cử nhiều chức vụ cùng lúc, ứng viên được chọn 1 chức vụ, các vị trí còn lại sẽ tiến hành bầu bổ sung.
          </p>
        </div>
      )}

      {/* ================= BIỂU ĐỒ & BẢNG KẾT QUẢ CHI TIẾT TỪNG CHỨC VỤ ================= */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#002b66] uppercase">
              Bảng Tổng Hợp Phiếu Bầu Chi Tiết Từng Vị Trí
            </h2>
            <p className="text-xs text-slate-500">
              Số liệu cập nhật tự động trực tiếp từ hòm phiếu biểu quyết
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchResults(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In kết quả</span>
            </button>
          </div>
        </div>

        {results.map((posRes: any) => {
          const pos = posRes.position
          const candidateList = posRes.candidates || []

          return (
            <div
              key={pos.id}
              className="bg-white border-2 border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
            >
              {/* Header vị trí */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <h3 className="text-base font-bold text-[#002b66] uppercase">
                    {pos.title}
                  </h3>
                  <span className="text-xs text-slate-500">
                    (Cơ cấu: 0{pos.quota} người • Tổng ứng viên: {posRes.candidatesCount})
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  Tổng lượt chọn: <strong>{posRes.totalVotesCastForPosition}</strong> lượt
                </div>
              </div>

              {/* Danh sách ứng viên và thanh tỷ lệ % phiếu */}
              {candidateList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Chưa có ứng viên nào cho vị trí này.
                </p>
              ) : (
                <div className="space-y-3">
                  {candidateList.map((candRes: any, rankIdx: number) => {
                    const c = candRes.candidate
                    const isWinner = candRes.isElected
                    const isTied = candRes.isTied

                    return (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-xl border transition ${
                          isWinner
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-xs'
                            : isTied
                            ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                            : 'bg-slate-50/40 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                isWinner
                                  ? 'bg-emerald-600 text-white'
                                  : isTied
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {rankIdx + 1}
                            </span>
                            <div>
                              <span className="text-xs sm:text-sm font-bold text-slate-900">
                                {c.name}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 ml-2">
                                ({c.studentId})
                              </span>
                            </div>
                          </div>

                          {/* Huy hiệu trúng cử / hòa phiếu */}
                          <div className="flex items-center gap-2">
                            {isWinner && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-full uppercase shadow-xs">
                                <Trophy className="w-3 h-3 text-yellow-300" />
                                <span>Trúng cử (Top 0{rankIdx + 1})</span>
                              </span>
                            )}
                            {isTied && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-600 text-white text-[11px] font-bold rounded-full uppercase shadow-xs">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Hòa phiếu (Bầu lại)</span>
                              </span>
                            )}

                            <div className="text-right">
                              <span className="text-sm font-black text-[#002b66]">
                                {candRes.voteCount} phiếu
                              </span>
                              <span className="text-xs text-slate-500 ml-1">
                                ({candRes.percentage}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Thanh progress bar tỷ lệ phần trăm */}
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isWinner
                                ? 'bg-emerald-500'
                                : isTied
                                ? 'bg-amber-500'
                                : 'bg-[#002b66]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(candRes.percentage, 3))}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ================= KHU VỰC QUẢN TRỊ DÀNH CHO NGƯỜI ĐIỀU HÀNH ================= */}
      <div className="border border-slate-300 rounded-2xl p-5 bg-slate-50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase">
              Bảng Điều Khiển Của Người Điều Hành (Admin)
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            {showAdminPanel ? 'Ẩn bảng điều khiển' : 'Mở bảng điều khiển'}
          </button>
        </div>

        {showAdminPanel && (
          <div className="pt-3 border-t border-slate-200 space-y-4">
            {!isAdminUnlocked ? (
              <form onSubmit={handleAdminLogin} className="flex items-center gap-2 max-w-md">
                <input
                  type="password"
                  placeholder="Nhập mật khẩu điều hành..."
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white flex-1 outline-hidden"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#002b66] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Mở khóa
                </button>
                {adminMsg && <span className="text-[11px] text-red-600 block mt-1">{adminMsg}</span>}
              </form>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Đã mở khóa quyền điều hành phiên bầu cử
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleToggleRegistration}
                    className="px-4 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-lg transition"
                  >
                    {data?.isRegistrationOpen ? '🔒 Đóng nộp hồ sơ ứng cử' : '🔓 Mở nộp hồ sơ ứng cử'}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleVoting}
                    className="px-4 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white text-xs font-bold rounded-lg transition"
                  >
                    {data?.isVotingOpen ? '🔒 Khóa hòm phiếu biểu quyết' : '🔓 Mở hòm phiếu biểu quyết'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResetVotesForRound2(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    🔄 Làm mới hòm phiếu (Bầu vòng 2)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResetVotesForRound2(false)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    ⚠️ Xóa toàn bộ làm lại
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Điều hướng nhanh */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
        <Link href="/baucu" className="text-blue-700 hover:underline font-bold">
          ← Về trang chủ Thể lệ
        </Link>
        <Link href="/baucu/bophieu" className="text-emerald-700 hover:underline font-bold">
          Tới hòm phiếu biểu quyết →
        </Link>
      </div>
    </div>
  )
}
