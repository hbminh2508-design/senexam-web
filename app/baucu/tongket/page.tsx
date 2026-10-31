'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  Printer,
  ChevronRight,
  Radio,
  GraduationCap,
} from 'lucide-react'

function TongKetContent() {
  const searchParams = useSearchParams()
  const classIdParam = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'

  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(classIdParam)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [lastLivePing, setLastLivePing] = useState<string>('')

  // 1. Tải danh sách các lớp để có thể chuyển đổi xem kết quả
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/baucu?action=classes')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setClasses(json.data)
      }
    } catch (e) {
      console.error('Lỗi khi tải danh sách lớp:', e)
    }
  }

  // 2. Tải kết quả của lớp đang chọn
  const fetchResults = async (classId: string, showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsRefreshing(true)
    try {
      const res = await fetch(`/api/baucu?class=${encodeURIComponent(classId)}`)
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

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    if (classIdParam && classIdParam !== selectedClassId) {
      setSelectedClassId(classIdParam)
    }
  }, [classIdParam])

  // Supabase Realtime Listener + Polling dự phòng
  useEffect(() => {
    fetchResults(selectedClassId)

    // Đăng ký nhận thông báo Realtime từ Supabase cho lớp này
    let channel: any = null
    try {
      channel = supabase
        .channel(`fepn_live_${selectedClassId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fepn_election_votes',
            filter: `election_id=eq.${selectedClassId}`,
          },
          (payload) => {
            console.log('[Realtime] Có phiếu bầu mới cho lớp:', payload)
            fetchResults(selectedClassId, false)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fepn_election_candidates',
            filter: `election_id=eq.${selectedClassId}`,
          },
          (payload) => {
            fetchResults(selectedClassId, false)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fepn_election_settings',
            filter: `id=eq.${selectedClassId}`,
          },
          (payload) => {
            fetchResults(selectedClassId, false)
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

    // Polling dự phòng mỗi 3.5 giây
    const interval = setInterval(() => {
      fetchResults(selectedClassId, false)
    }, 3500)

    return () => {
      clearInterval(interval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedClassId])

  const summary = data?.summary
  const results = summary?.results || []
  const totalVoters = summary?.totalVoters || 0
  const currentUnit = data?.unit || selectedClassId.toUpperCase()

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
    <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Header kết quả */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>BƯỚC 3: CÔNG BỐ KẾT QUẢ BIỂU QUYẾT TỔNG HỢP • LỚP {currentUnit}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase">
          KẾT QUẢ BẦU CỬ BAN CÁN SỰ & BAN CHẤP HÀNH
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
          Dữ liệu kết quả bầu cử chính thức của lớp <strong>{currentUnit}</strong> • Khóa QH-2026-I/CQ • Khoa Vật lý Kỹ thuật & Công nghệ Nano (FEPN - VNU-UET).
        </p>
      </div>

      {/* THANH CHUYỂN ĐỔI XEM KẾT QUẢ GIỮA CÁC LỚP */}
      {classes.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#002b66]" />
            <span className="text-xs font-bold text-slate-600">Xem kết quả của lớp:</span>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const isSelected = c.id === selectedClassId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-[#002b66] text-white border-[#002b66]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Lớp {c.unit}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Online</span>
            </span>
            <span>• Cập nhật: {lastLivePing || 'Vừa xong'}</span>
          </div>
        </div>
      )}

      {/* THANH THỐNG KÊ NHANH CỬ TRI ĐÃ BỎ PHIẾU */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#002b66] flex items-center justify-center shrink-0">
            <VoteIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Tổng cử tri đã bỏ phiếu</div>
            <div className="text-2xl font-black text-[#002b66] font-mono">{totalVoters} cử tri</div>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Ứng viên đã trúng cử</div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {electedList.length} nhân sự
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Trạng thái hòm phiếu</div>
            <div className="text-xs font-bold text-slate-900 mt-1">
              {data?.isVotingOpen ? (
                <span className="text-emerald-700">● Đang mở nhận phiếu</span>
              ) : (
                <span className="text-slate-600">■ Đã đóng hòm phiếu</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CẢNH BÁO NẾU CÓ CHỨC VỤ BỊ HÒA PHIẾU CẦN BẦU VÒNG 2 */}
      {tiedPositions.length > 0 && (
        <div className="p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-black text-sm uppercase text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>KẾT QUẢ HÒA PHIẾU CẦN BẦU LẠI THEO ĐIỀU 3 KHOẢN 2 THỂ LỆ</span>
          </div>
          <p>
            Hiện tại ở lớp <strong>{currentUnit}</strong> có các chức vụ có từ 2 ứng viên trở lên đạt số phiếu cao nhất bằng nhau:
          </p>
          <ul className="list-disc pl-5 font-semibold space-y-1">
            {tiedPositions.map((r: any) => (
              <li key={r.position.id}>
                <strong>{r.position.title}:</strong> Hòa phiếu giữa các ứng viên:{' '}
                {r.tiedCandidates.map((c: any) => `${c.name} (${c.studentId})`).join(', ')}.
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-800 pt-1">
            Người điều hành có thể sử dụng chức năng &ldquo;Làm mới hòm phiếu (Bầu vòng 2)&rdquo; trong trang Quản trị để tiến hành biểu quyết phân định.
          </p>
        </div>
      )}

      {/* DANH SÁCH BAN CÁN SỰ & BAN CHẤP HÀNH ĐẮC CỬ CHÍNH THỨC */}
      {electedList.length > 0 && (
        <div className="bg-white border-2 border-emerald-500 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Crown className="w-6 h-6 text-amber-500" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
              DANH SÁCH NHÂN SỰ ĐẮC CỬ CHÍNH THỨC • LỚP {currentUnit}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {electedList.map((e, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-800">
                    {e.positionTitle}
                  </div>
                  <div className="font-extrabold text-sm text-slate-900">{e.candidateName}</div>
                  <div className="font-mono text-[10px] text-slate-500">MSSV: {e.studentId}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {e.votes} phiếu
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BẢNG KẾT QUẢ CHI TIẾT TỪNG CHỨC VỤ */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-[#002b66] uppercase">
            BẢNG TỔNG HỢP PHIẾU BẦU CHI TIẾT
          </h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In biên bản</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((posRes: any) => {
            return (
              <div
                key={posRes.position.id}
                className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs space-y-4"
              >
                <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-700">
                      {posRes.position.categoryName}
                    </span>
                    <h3 className="text-base font-black text-[#002b66] uppercase">
                      {posRes.position.title}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Chỉ tiêu: {posRes.position.quota} người • Tổng phiếu chức vụ:{' '}
                      {posRes.totalVotesCastForPosition}
                    </span>
                  </div>

                  {posRes.hasTie && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                      Hòa phiếu
                    </span>
                  )}
                </div>

                {posRes.candidates.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    Không có ứng viên tham gia chức vụ này.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posRes.candidates.map((candRes: any) => {
                      return (
                        <div key={candRes.candidate.id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5">
                              {candRes.isElected && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              <span
                                className={`font-bold ${
                                  candRes.isElected
                                    ? 'text-emerald-900 font-extrabold'
                                    : 'text-slate-800'
                                }`}
                              >
                                {candRes.candidate.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                ({candRes.candidate.studentId})
                              </span>
                            </div>

                            <div className="font-mono text-xs font-bold text-slate-700">
                              {candRes.voteCount} phiếu{' '}
                              <span className="text-slate-400 font-normal">({candRes.percentage}%)</span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                candRes.isElected ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(candRes.percentage, 100)}%` }}
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
      </div>
    </div>
  )
}

export default function TongKetPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Đang tải kết quả tổng kết...</div>}>
      <TongKetContent />
    </Suspense>
  )
}
