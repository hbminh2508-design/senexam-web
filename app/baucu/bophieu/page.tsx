'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'

export default function BoPhieuPage() {
  const [electionData, setElectionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  const loadData = async () => {
    try {
      const res = await fetch('/api/baucu')
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
  }, [])

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
          studentId: cleanMssv,
        }),
      })
      const json = await res.json()

      if (json.hasVoted) {
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
          // Nếu chỉ cho phép chọn 1 thì tự động đổi sang ứng viên mới (Radio behaviour)
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

    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          voterName: voterName.trim(),
          voterStudentId: voterStudentId.trim().toUpperCase(),
          selections,
        }),
      })

      const json = await res.json()
      if (json.success) {
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

  // MÀN HÌNH BỎ PHIẾU THÀNH CÔNG
  if (submitSuccess) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full bg-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 text-center shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase">
            BỎ PHIẾU THÀNH CÔNG!
          </h2>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 text-left space-y-1">
            <p>Cử tri: <strong>{voterName}</strong></p>
            <p>MSSV: <strong className="font-mono">{voterStudentId.toUpperCase()}</strong></p>
            <p>Đơn vị: <strong>K71-P-ME2 • NH 2026-2027</strong></p>
            <p className="text-[11px] text-slate-500 pt-1">
              Hệ thống đã ghi nhận lá phiếu của bạn vào hòm phiếu an toàn. Mỗi MSSV chỉ được gửi biểu quyết 1 lần duy nhất.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Cảm ơn bạn đã thực hiện quyền biểu quyết dân chủ cho tập thể lớp K71-P-ME2!
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/baucu/tongket"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 uppercase"
            >
              <Award className="w-4 h-4" />
              <span>Xem Bảng Tổng Kết Kết Quả</span>
            </Link>

            <Link
              href="/baucu"
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Về trang chủ Bầu cử FEPN
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // MÀN HÌNH NẾU ĐÃ BỎ PHIẾU TRƯỚC ĐÓ (Điều 2 Khoản 1)
  if (hasVotedBefore) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="max-w-md w-full bg-white border-2 border-amber-500 rounded-3xl p-6 sm:p-8 text-center shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-slate-900 uppercase">
            BẠN ĐÃ BỎ PHIẾU RỒI!
          </h2>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-left space-y-1">
            <p>Họ tên: <strong>{voterName}</strong></p>
            <p>MSSV: <strong className="font-mono">{voterStudentId.toUpperCase()}</strong></p>
            <p className="text-[11px] text-amber-800 pt-1 leading-relaxed">
              Theo <strong>Điều 2 Khoản 1 Thể lệ bầu cử</strong>: Mỗi thành viên trong lớp chỉ được gửi phiếu bầu <strong>1 lần duy nhất</strong>. Hệ thống đã khóa hòm phiếu đối với MSSV này để chống bỏ phiếu trùng lặp.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/baucu/tongket"
              className="w-full py-3 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 uppercase"
            >
              <Award className="w-4 h-4" />
              <span>Xem Kết quả Bầu cử Tổng kết</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setHasVotedBefore(false)
                setIsVerified(false)
                setVoterStudentId('')
              }}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Đổi sang MSSV khác
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ================= MÀN HÌNH CHÍNH =================
  return (
    <div className="flex-1 max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-8">
      {/* Tiêu đề */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#002b66] text-xs font-bold uppercase tracking-wider">
          <VoteIcon className="w-4 h-4" />
          <span>BƯỚC 2: PHIẾU BỎ BIỂU QUYẾT TRỰC TUYẾN</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase font-serif">
          HÒM PHIẾU BẦU CỬ K71-P-ME2
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Vui lòng kiểm tra kỹ số lượng ứng viên được phép chọn tại mỗi chức vụ theo quy định Điều 2 Thể lệ.
        </p>
      </div>

      {/* Kiểm tra nếu hòm phiếu đang đóng */}
      {electionData && !electionData.isVotingOpen && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-2xl text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <strong>Hòm phiếu hiện đang đóng!</strong> Người điều hành lớp chưa mở thời gian biểu quyết hoặc đã hết thời gian bỏ phiếu. Vui lòng theo dõi thông báo trực tiếp tại lớp.
          </div>
        </div>
      )}

      {/* BƯỚC 1: XÁC MINH CỬ TRI (HỌ TÊN + MSSV) */}
      {!isVerified ? (
        <div className="bg-white border-2 border-[#002b66]/30 rounded-2xl p-6 sm:p-8 shadow-sm max-w-xl mx-auto space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <UserCheck className="w-6 h-6 text-[#002b66]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Xác thực Danh tính Cử tri
              </h2>
              <p className="text-[11px] text-slate-500">
                Nhập thông tin sinh viên để mở hòm phiếu điện tử
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleVerifyVoter} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Họ và tên của bạn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                placeholder="Ví dụ: Trần Văn Bình"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
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
                placeholder="Ví dụ: 26020456"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                * Mỗi MSSV chỉ được gửi biểu quyết 1 lần duy nhất theo Điều 2 Thể lệ.
              </span>
            </div>

            <button
              type="submit"
              disabled={checkingVoter || (electionData && !electionData.isVotingOpen)}
              className="w-full py-3 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              {checkingVoter ? 'Đang kiểm tra...' : 'Xác thực & Mở phiếu bầu'}
            </button>
          </form>
        </div>
      ) : (
        /* BƯỚC 2: PHIẾU BẦU CHO TỪNG CHỨC VỤ */
        <div className="space-y-6">
          {/* Thanh thông tin cử tri đã xác thực */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[#002b66] text-white flex items-center justify-center font-bold">
                {voterName.charAt(0)}
              </span>
              <div>
                <div className="font-bold text-slate-900">{voterName}</div>
                <div className="font-mono text-blue-700 font-bold">MSSV: {voterStudentId}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xác thực cử tri
              </span>
              <button
                type="button"
                onClick={() => setIsVerified(false)}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline"
              >
                Đổi thông tin
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DANH SÁCH CÁC CHỨC VỤ BỎ PHIẾU */}
          <div className="space-y-6">
            {positions.map((pos: any, idx: number) => {
              const candidatesForPos = candidates.filter((c: any) => c.positionIds?.includes(pos.id))
              const selectedList = selections[pos.id] || []

              // ÁP DỤNG CHÍNH XÁC ĐIỀU 2 THỂ LỆ:
              // - Có từ 5 người ứng cử trở lên -> chọn tối đa 3 ứng viên
              // - Có dưới 5 người ứng cử -> chọn tối đa 1 ứng viên (trừ Lớp phó quota=2 thì tối đa 2)
              let maxAllowed = 1
              if (candidatesForPos.length >= 5) {
                maxAllowed = 3
              } else if (pos.quota > 1) {
                maxAllowed = pos.quota
              }

              const isReachedLimit = selectedList.length >= maxAllowed

              return (
                <div
                  key={pos.id}
                  className="bg-white border-2 border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                >
                  {/* Header chức vụ + Quy định giới hạn */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#002b66] text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h2 className="text-base font-extrabold text-[#002b66] uppercase">
                          {pos.title}
                        </h2>
                        <span className="text-xs text-slate-500">
                          (Cơ cấu: 0{pos.quota} người)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 pl-8">
                        {pos.description}
                      </p>
                    </div>

                    {/* Huy hiệu hướng dẫn số lựa chọn theo Điều 2 */}
                    <div className="sm:text-right shrink-0">
                      <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                        {candidatesForPos.length >= 5 ? (
                          <span className="text-blue-800 font-bold">
                            Chức vụ ≥ 5 ứng viên: Chọn tối đa 3 người
                          </span>
                        ) : (
                          <span className="text-slate-800 font-bold">
                            Chức vụ &lt; 5 ứng viên: Chọn tối đa {maxAllowed} người
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Đã chọn: <strong className={isReachedLimit ? 'text-blue-700' : 'text-slate-700'}>{selectedList.length}/{maxAllowed}</strong> ứng viên
                      </div>
                    </div>
                  </div>

                  {/* Danh sách ứng viên của chức vụ này */}
                  {candidatesForPos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                      Hiện chưa có ứng viên nào ứng cử chức vụ này. Bạn có thể bỏ qua hoặc bầu bổ sung sau.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {candidatesForPos.map((cand: any) => {
                        const isChosen = selectedList.includes(cand.id)

                        return (
                          <div
                            key={cand.id}
                            onClick={() => handleToggleCandidate(pos.id, cand.id, maxAllowed)}
                            className={`p-3.5 border-2 rounded-xl transition cursor-pointer flex items-start gap-3 select-none ${
                              isChosen
                                ? 'bg-blue-50/80 border-[#002b66] shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {/* Checkbox / Radio vuông tròn to dễ bấm trên Mobile */}
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                  isChosen
                                    ? 'bg-[#002b66] border-[#002b66] text-white'
                                    : 'border-slate-400 bg-white'
                                }`}
                              >
                                {isChosen && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>

                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs sm:text-sm font-bold text-slate-900">
                                  {cand.name}
                                </span>
                                <span className="text-[10px] font-mono text-blue-700 font-semibold bg-blue-100/60 px-1.5 py-0.2 rounded">
                                  {cand.studentId}
                                </span>
                              </div>

                              {cand.slogan && (
                                <p className="text-[11px] text-slate-600 italic">
                                  "{cand.slogan}"
                                </p>
                              )}

                              {cand.bio && (
                                <p className="text-[10px] text-slate-400 line-clamp-1">
                                  {cand.bio}
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

          {/* Nút gửi phiếu to nổi bật ở chân trang */}
          <div className="p-6 bg-white border border-slate-300 rounded-2xl text-center space-y-3 shadow-xs">
            <p className="text-xs text-slate-600">
              Kiểm tra lại toàn bộ lựa chọn trước khi nhấn nút nộp. Sau khi gửi, phiếu bầu của bạn sẽ được niêm phong vào hệ thống.
            </p>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={electionData && !electionData.isVotingOpen}
              className="w-full sm:w-auto px-10 py-3.5 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 mx-auto"
            >
              <VoteIcon className="w-4 h-4" />
              <span>GỬI PHIẾU BẦU CỬ CHÍNH THỨC</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL XÁC NHẬN NỘP PHIẾU ================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-[#002b66] flex items-center justify-center shrink-0">
                <VoteIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận gửi phiếu bầu?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cử tri: <strong>{voterName}</strong> (MSSV: {voterStudentId})
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-56 overflow-y-auto text-xs space-y-2">
              <div className="font-bold text-slate-700">Tóm tắt các ứng viên bạn đã chọn:</div>
              {positions.map((pos: any) => {
                const selectedList = selections[pos.id] || []
                const names = candidates
                  .filter((c: any) => selectedList.includes(c.id))
                  .map((c: any) => c.name)

                return (
                  <div key={pos.id} className="border-b border-slate-200 pb-1.5 last:border-0">
                    <span className="font-semibold text-[#002b66]">{pos.title}:</span>{' '}
                    {names.length > 0 ? (
                      <span className="text-slate-800 font-medium">{names.join(', ')}</span>
                    ) : (
                      <span className="text-slate-400 italic">(Để trống)</span>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * Theo thể lệ, bạn không thể sửa đổi sau khi đã gửi phiếu.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Xem lại
              </button>
              <button
                type="button"
                onClick={handleSubmitFinalVote}
                disabled={submitting}
                className="px-5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-lg shadow-xs transition"
              >
                {submitting ? 'Đang gửi phiếu...' : 'Đồng ý nộp phiếu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
