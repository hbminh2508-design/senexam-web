'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Vote as VoteIcon,
  UserCheck,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Lock,
  RotateCcw,
  ShieldCheck,
  FileText,
} from 'lucide-react'

function BoPhieuContent() {
  const searchParams = useSearchParams()
  const classIdParam = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'
  const isLockParam = searchParams.get('lock') === '1' || searchParams.get('lock') === 'true'

  const [electionData, setElectionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Lưu trạng thái đã bỏ phiếu vào cache
  const [cachedVoteInfo, setCachedVoteInfo] = useState<{
    voterName: string
    voterStudentId: string
    votedAt: string
    receiptCode?: string
    unit?: string
  } | null>(null)

  // Thông tin cử tri
  const [voterName, setVoterName] = useState('')
  const [voterStudentId, setVoterStudentId] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [hasVotedBefore, setHasVotedBefore] = useState(false)
  const [checkingVoter, setCheckingVoter] = useState(false)

  // Danh sách lựa chọn: { [positionId]: [candidateId1, candidateId2] }
  const [selections, setSelections] = useState<Record<string, string[]>>({})

  // Modal xác nhận & thông báo
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Kiểm tra cache localStorage khi tải trang
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isLockParam) {
        localStorage.setItem('fepn_locked_class', classIdParam)
      }

      const cacheKey = `fepn_voted_${classIdParam}`
      const saved = localStorage.getItem(cacheKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setCachedVoteInfo(parsed)
          setVoterName(parsed.voterName || '')
          setVoterStudentId(parsed.voterStudentId || '')
        } catch {
          setCachedVoteInfo({
            voterName: 'Cử tri',
            voterStudentId: '',
            votedAt: new Date().toISOString(),
          })
        }
      }
    }
  }, [classIdParam, isLockParam])

  const loadData = async () => {
    try {
      const res = await fetch(`/api/baucu?class=${encodeURIComponent(classIdParam)}`)
      const json = await res.json()
      if (json.success) {
        setElectionData(json.data)
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu bầu cử:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [classIdParam])

  // Kiểm tra xem MSSV đã bỏ phiếu chưa
  const handleVerifyVoter = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanName = voterName.trim()
    const cleanMssv = voterStudentId.trim().toUpperCase()

    if (!cleanName || !cleanMssv) {
      setErrorMsg('Vui lòng nhập đầy đủ Họ và tên cùng Mã số sinh viên (MSSV).')
      return
    }

    setCheckingVoter(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_voter',
          classId: classIdParam,
          studentId: cleanMssv,
        }),
      })
      const json = await res.json()

      if (json.hasVoted) {
        // Lưu vào cache ngay để khóa màn hình
        const votedState = {
          voterName: cleanName,
          voterStudentId: cleanMssv,
          votedAt: new Date().toISOString(),
          unit: electionData?.unit || 'K70P-ME2',
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(`fepn_voted_${classIdParam}`, JSON.stringify(votedState))
        }
        setCachedVoteInfo(votedState)
        setHasVotedBefore(true)
        setIsVerified(false)
      } else {
        setHasVotedBefore(false)
        setIsVerified(true)
      }
    } catch (err) {
      setErrorMsg('Không thể kiểm tra trạng thái cử tri. Vui lòng thử lại!')
    } finally {
      setCheckingVoter(false)
    }
  }

  // Chọn / bỏ chọn ứng viên theo đúng giới hạn Điều 2
  const handleToggleCandidate = (posId: string, candId: string, maxAllowed: number) => {
    setSelections((prev) => {
      const currentList = prev[posId] || []
      const isSelected = currentList.includes(candId)

      if (isSelected) {
        return {
          ...prev,
          [posId]: currentList.filter((id) => id !== candId),
        }
      }

      // Nếu đang muốn chọn thêm nhưng đã đạt tối đa
      if (currentList.length >= maxAllowed) {
        if (maxAllowed === 1) {
          // Tự động đổi sang ứng viên mới (Radio behaviour)
          return {
            ...prev,
            [posId]: [candId],
          }
        }
        alert(`Theo Điều 2 Thể lệ, đối với chức vụ này bạn chỉ được chọn tối đa ${maxAllowed} ứng viên!`)
        return prev
      }

      return {
        ...prev,
        [posId]: [...currentList, candId],
      }
    })
  }

  // Xử lý nộp phiếu chính thức
  const handleSubmitFinalVote = async () => {
    setSubmitting(true)
    setErrorMsg(null)

    const cleanName = voterName.trim()
    const cleanMssv = voterStudentId.trim().toUpperCase()

    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          classId: classIdParam,
          voterName: cleanName,
          voterStudentId: cleanMssv,
          selections,
        }),
      })

      const json = await res.json()
      if (json.success) {
        const receiptCode = `FE-${(electionData?.unit || classIdParam).toUpperCase()}-${cleanMssv}-${Date.now()
          .toString(36)
          .toUpperCase()}`

        const voteRecord = {
          voterName: cleanName,
          voterStudentId: cleanMssv,
          votedAt: new Date().toISOString(),
          receiptCode,
          unit: electionData?.unit || 'K70P-ME2',
        }

        // Lưu vĩnh viễn vào cache localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(`fepn_voted_${classIdParam}`, JSON.stringify(voteRecord))
          document.cookie = `fepn_voted_${classIdParam}=1; path=/; max-age=2592000`
        }

        setCachedVoteInfo(voteRecord)
        setSubmitSuccess(true)
        setShowConfirmModal(false)
      } else {
        setErrorMsg(json.message || 'Lỗi khi gửi phiếu bầu.')
        setShowConfirmModal(false)
      }
    } catch (err: any) {
      setErrorMsg('Lỗi mạng hoặc máy chủ không phản hồi. Vui lòng thử lại!')
      setShowConfirmModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  const positions = electionData?.positions || []
  const candidates = electionData?.candidates || []
  const currentUnit = electionData?.unit || 'K70P-ME2'

  // ================= 1. TRƯỜNG HỢP ĐÃ BẦU RỒI ĐƯỢC LƯU TRONG CACHE =================
  // Dù có thoát, reset tab, tải lại trang hay khởi động lại máy, trạng thái này vẫn được giữ nguyên
  if (cachedVoteInfo) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full bg-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 text-center shadow-lg space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200">
            <ShieldCheck className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              TRẠNG THÁI: ĐÃ HOÀN TẤT BIỂU QUYẾT
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase pt-2">
              BẠN ĐÃ BỎ PHIẾU THÀNH CÔNG!
            </h2>
            <p className="text-xs text-slate-500">
              Lá phiếu của bạn đã được hệ thống ghi nhận vào hòm phiếu an toàn.
            </p>
          </div>

          {/* Chi tiết thông tin đã lưu trong cache */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 text-left space-y-2">
            <div className="flex justify-between pb-1.5 border-b border-slate-200">
              <span className="text-slate-500">Họ và tên cử tri:</span>
              <strong className="text-slate-900">{cachedVoteInfo.voterName}</strong>
            </div>

            {cachedVoteInfo.voterStudentId && (
              <div className="flex justify-between pb-1.5 border-b border-slate-200">
                <span className="text-slate-500">Mã sinh viên (MSSV):</span>
                <strong className="font-mono text-blue-900">{cachedVoteInfo.voterStudentId}</strong>
              </div>
            )}

            <div className="flex justify-between pb-1.5 border-b border-slate-200">
              <span className="text-slate-500">Đơn vị lớp:</span>
              <strong className="text-[#002b66]">{cachedVoteInfo.unit || currentUnit}</strong>
            </div>

            <div className="flex justify-between pb-1.5 border-b border-slate-200">
              <span className="text-slate-500">Thời gian ghi nhận:</span>
              <span className="font-mono text-slate-600">
                {new Date(cachedVoteInfo.votedAt).toLocaleString('vi-VN')}
              </span>
            </div>

            {cachedVoteInfo.receiptCode && (
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Mã biên nhận:</span>
                <span className="font-mono text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                  {cachedVoteInfo.receiptCode}
                </span>
              </div>
            )}

            <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>
                Theo Điều 2 Thể lệ, mỗi cử tri chỉ được bỏ phiếu 1 lần duy nhất để tránh phiếu ma.
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/baucu/tongket?class=${encodeURIComponent(classIdParam)}`}
              className="w-full py-3 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 uppercase"
            >
              <Award className="w-4 h-4" />
              <span>Xem Bảng Tổng Kết Kết Quả ({currentUnit})</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ================= 2. TRƯỜNG HỢP HÒM PHIẾU ĐANG KHÓA =================
  if (electionData && !electionData.isVotingOpen) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-16">
        <div className="max-w-md w-full bg-white border border-amber-300 rounded-3xl p-6 sm:p-8 text-center shadow-md space-y-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 uppercase">
            Hòm Phiếu Hiện Đang Đóng ({currentUnit})
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Người điều hành lớp <strong>{currentUnit}</strong> hiện chưa mở cổng tiếp nhận phiếu biểu quyết hoặc phiên bầu cử đã kết thúc. Vui lòng theo dõi hiệu lệnh của ban tổ chức tại lớp.
          </p>
          <div className="pt-2">
            <Link
              href={`/baucu/tongket?class=${encodeURIComponent(classIdParam)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              <Award className="w-4 h-4" />
              <span>Xem kết quả tổng kết lớp {currentUnit}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ================= 3. TRƯỜNG HỢP BỎ PHIẾU BÌNH THƯỜNG =================
  return (
    <div className="flex-1 max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Tiêu đề trang */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#002b66] text-xs font-bold uppercase tracking-wider">
          <VoteIcon className="w-4 h-4" />
          <span>BƯỚC 2: PHIẾU BIỂU QUYẾT ĐIỆN TỬ • LỚP {currentUnit}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase">
          BỎ PHIẾU BAN CÁN SỰ & BAN CHẤP HÀNH
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Hòm phiếu điện tử chính thức của lớp <strong>{currentUnit}</strong>. Thông tin xác thực qua MSSV. Mỗi sinh viên biểu quyết 1 lần duy nhất theo đúng Điều 2 Thể lệ.
        </p>
      </div>

      {/* BƯỚC 1: XÁC THỰC CỬ TRI (NHẬP HỌ TÊN VÀ MSSV) */}
      {!isVerified ? (
        <div className="max-w-md mx-auto bg-white border border-slate-300 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="text-center pb-2 border-b border-slate-100">
            <span className="text-xs font-black uppercase text-[#002b66]">
              Bước 1: Xác thực tư cách cử tri lớp {currentUnit}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleVerifyVoter} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Họ và tên sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn An"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={voterStudentId}
                onChange={(e) => setVoterStudentId(e.target.value.toUpperCase())}
                placeholder="Ví dụ: 26020123"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Hệ thống đối chiếu MSSV để ngăn chặn phiếu bầu trùng lặp hoặc phiếu ma.
              </span>
            </div>

            <button
              type="submit"
              disabled={checkingVoter}
              className="w-full py-3 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase"
            >
              {checkingVoter ? (
                <span>Đang kiểm tra dữ liệu cử tri...</span>
              ) : (
                <>
                  <span>Tiếp tục vào bỏ phiếu</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* BƯỚC 2: PHIẾU BẦU TRỰC TUYẾN CHÍNH THỨC */
        <div className="space-y-6">
          {/* Thanh thông tin cử tri đang thực hiện */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-700 shrink-0" />
              <div>
                <span className="text-slate-500">Cử tri đã xác thực: </span>
                <strong className="text-slate-900">{voterName}</strong> (MSSV:{' '}
                <strong className="font-mono text-blue-900">{voterStudentId}</strong>) • Lớp:{' '}
                <strong className="text-[#002b66]">{currentUnit}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsVerified(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Đổi thông tin
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Danh sách 8 chức vụ để tích chọn ứng viên */}
          <div className="space-y-6">
            {positions.map((pos: any, posIdx: number) => {
              const candForPos = candidates.filter((c: any) => c.positionIds.includes(pos.id))
              const selectedCandIds = selections[pos.id] || []

              // Tính số lượng tối đa theo Điều 2
              let maxAllowed = 1
              if (candForPos.length >= 5) {
                maxAllowed = 3
              } else if (pos.quota > 1) {
                maxAllowed = pos.quota
              }

              const isReachedMax = selectedCandIds.length >= maxAllowed

              return (
                <div
                  key={pos.id}
                  className="bg-white border border-slate-300 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                >
                  {/* Header chức vụ */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-[11px] font-black uppercase text-blue-700 tracking-wider">
                        {pos.categoryName} • Chỉ tiêu: {pos.quota} người
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-[#002b66] uppercase">
                        {posIdx + 1}. {pos.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{pos.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          selectedCandIds.length === 0
                            ? 'bg-slate-100 text-slate-600'
                            : selectedCandIds.length === maxAllowed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        Đã chọn: {selectedCandIds.length}/{maxAllowed}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {candForPos.length >= 5 ? '≥ 5 ứng viên (chọn tối đa 3)' : `Chọn tối đa ${maxAllowed}`}
                      </div>
                    </div>
                  </div>

                  {/* Danh sách ứng viên của chức vụ này */}
                  {candForPos.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                      Hiện chưa có ứng viên nào ghi danh chức vụ này. Bạn có thể bỏ qua hoặc bầu bổ sung sau.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {candForPos.map((c: any) => {
                        const isSelected = selectedCandIds.includes(c.id)
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleToggleCandidate(pos.id, c.id, maxAllowed)}
                            className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                              isSelected
                                ? 'bg-blue-50/70 border-[#002b66] shadow-xs'
                                : 'bg-slate-50/60 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                                isSelected
                                  ? 'bg-[#002b66] border-[#002b66] text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {c.name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  {c.studentId}
                                </span>
                              </div>
                              {c.slogan && (
                                <p className="text-[11px] text-slate-600 italic line-clamp-2 mt-1">
                                  &ldquo;{c.slogan}&rdquo;
                                </p>
                              )}
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

          {/* Nút gửi phiếu cuối cùng */}
          <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md border-2 border-[#002b66]/30 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Cử tri: <strong>{voterName}</strong> (MSSV: <strong className="font-mono">{voterStudentId}</strong>) • Lớp:{' '}
              <strong className="text-[#002b66]">{currentUnit}</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full sm:w-auto px-8 py-3 bg-[#002b66] hover:bg-[#001f4d] text-white font-extrabold text-xs rounded-xl shadow-md transition hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <VoteIcon className="w-4 h-4" />
              <span>GỬI PHIẾU BIỂU QUYẾT CHÍNH THỨC</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN NỘP PHIẾU */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-blue-100 text-[#002b66] rounded-full flex items-center justify-center mx-auto mb-2">
                <VoteIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                XÁC NHẬN GỬI PHIẾU BIỂU QUYẾT
              </h3>
              <p className="text-xs text-slate-500">
                Lớp {currentUnit} • Năm học {electionData?.academicYear || '2026-2027'}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>Lưu ý quan trọng theo Điều 2 Thể lệ:</span>
              </p>
              <p>
                Mỗi cử tri chỉ được gửi phiếu <strong>1 lần duy nhất</strong>. Sau khi nộp, hệ thống sẽ lưu vào cache và cơ sở dữ liệu để khóa vĩnh viễn, bạn không thể sửa đổi hoặc gửi thêm lần thứ hai!
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Kiểm tra lại phiếu
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitFinalVote}
                className="px-5 py-2.5 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? 'Đang gửi...' : 'Đồng ý nộp phiếu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BoPhieuPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Đang tải hòm phiếu...</div>}>
      <BoPhieuContent />
    </Suspense>
  )
}
