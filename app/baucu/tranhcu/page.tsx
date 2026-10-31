'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  UserCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  Vote as VoteIcon,
  Phone,
  Mail,
  FileText,
  BadgeCheck,
  GraduationCap,
} from 'lucide-react'

function TranhCuContent() {
  const searchParams = useSearchParams()
  const classIdParam = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'

  const [electionData, setElectionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [slogan, setSlogan] = useState('')
  const [bio, setBio] = useState('')

  const loadData = async () => {
    try {
      const res = await fetch(`/api/baucu?class=${encodeURIComponent(classIdParam)}`)
      const json = await res.json()
      if (json.success) {
        setElectionData(json.data)
      }
    } catch (e) {
      console.error('Lỗi khi tải ứng viên:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [classIdParam])

  const handleTogglePosition = (posId: string) => {
    setSelectedPositions((prev) =>
      prev.includes(posId) ? prev.filter((id) => id !== posId) : [...prev, posId]
    )
  }

  const handleSubmitCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!name.trim() || !studentId.trim()) {
      setMsg({ text: 'Vui lòng nhập đầy đủ Họ và tên cùng Mã số sinh viên (MSSV).', type: 'error' })
      return
    }

    if (selectedPositions.length === 0) {
      setMsg({ text: 'Vui lòng chọn ít nhất 1 chức vụ bạn mong muốn ứng cử.', type: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/baucu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_candidate',
          classId: classIdParam,
          name: name.trim(),
          studentId: studentId.trim(),
          phone: phone.trim(),
          email: email.trim(),
          positionIds: selectedPositions,
          slogan: slogan.trim(),
          bio: bio.trim(),
        }),
      })

      const json = await res.json()
      if (json.success) {
        setMsg({ text: json.message || 'Ghi danh ứng cử thành công!', type: 'success' })
        // Reset form cơ bản
        setName('')
        setStudentId('')
        setPhone('')
        setEmail('')
        setSelectedPositions([])
        setSlogan('')
        setBio('')
        await loadData()
      } else {
        setMsg({ text: json.message || 'Có lỗi xảy ra khi nộp hồ sơ.', type: 'error' })
      }
    } catch (err: any) {
      setMsg({ text: 'Lỗi mạng hoặc server không phản hồi. Vui lòng thử lại!', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const positions = electionData?.positions || []
  const candidates = electionData?.candidates || []
  const currentUnit = electionData?.unit || 'K70P-ME2'

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* Banner tiêu đề */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#002b66] text-xs font-bold uppercase tracking-wider">
          <UserCheck className="w-4 h-4" />
          <span>BƯỚC 1: TIẾP NHẬN HỒ SƠ TRANH CỬ • LỚP {currentUnit}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase">
          GHI DANH ỨNG CỬ BAN CÁN SỰ & BAN CHẤP HÀNH
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
          Các bạn sinh viên có nguyện vọng cống hiến cho tập thể lớp <strong>{currentUnit}</strong> vui lòng điền thông tin bên dưới để hệ thống ghi nhận vào hòm phiếu biểu quyết.
        </p>
      </div>

      {/* Thông báo nếu đã đóng đăng ký */}
      {electionData && !electionData.isRegistrationOpen && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Thông báo:</strong> Người điều hành lớp {currentUnit} hiện đã đóng tiếp nhận hồ sơ tranh cử để tiến hành bỏ phiếu. Nếu bạn cần bổ sung danh sách, vui lòng liên hệ ban tổ chức tại lớp.
          </div>
        </div>
      )}

      {/* Grid: Form đăng ký (Trái) & Danh sách ứng viên đã ghi danh (Phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================= FORM ĐĂNG KÝ (5 Cột) ================= */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-4">
            <BadgeCheck className="w-5 h-5 text-[#002b66]" />
            <h2 className="text-base font-bold text-slate-900 uppercase">
              Phiếu Đăng Ký Ứng Cử (Lớp {currentUnit})
            </h2>
          </div>

          {msg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold mb-4 flex items-start gap-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmitCandidate} className="space-y-4 text-xs">
            {/* Họ và tên */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Họ và tên sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn An"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
            </div>

            {/* MSSV */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                placeholder="Ví dụ: 26020123"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-hidden bg-slate-50/50"
              />
            </div>

            {/* Số điện thoại & Email */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sv@vnu.edu.vn"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
                />
              </div>
            </div>

            {/* Chọn các chức vụ ứng cử */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Chức vụ mong muốn ứng cử <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/60">
                {positions.map((pos: any) => {
                  const isChecked = selectedPositions.includes(pos.id)
                  return (
                    <label
                      key={pos.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition select-none ${
                        isChecked ? 'bg-blue-100/70 border border-blue-300' : 'hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePosition(pos.id)}
                        className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-xs">{pos.title}</div>
                        <div className="text-[10px] text-slate-500">{pos.categoryName}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Slogan tranh cử */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lời hứa tranh cử / Chương trình hành động ngắn
              </label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ví dụ: Tận tụy vì tập thể, hỗ trợ tài liệu học tập tối đa cho cả lớp!"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
              />
            </div>

            {/* Giới thiệu bản thân */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Giới thiệu ngắn bản thân (kinh nghiệm, sở trường)
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Kinh nghiệm làm cán sự cấp 3, sở trường tin học văn phòng..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || (electionData && !electionData.isRegistrationOpen)}
              className="w-full py-2.5 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase"
            >
              {submitting ? (
                <span>Đang gửi hồ sơ...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>XÁC NHẬN GHI DANH ỨNG CỬ</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ================= DANH SÁCH ỨNG VIÊN ĐÃ GHI DANH (7 Cột) ================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900 uppercase">
                  Danh Sách Ứng Viên Lớp {currentUnit} ({candidates.length})
                </h2>
              </div>

              <Link
                href={`/baucu/bophieu?class=${encodeURIComponent(classIdParam)}&lock=1`}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <span>Hòm phiếu</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải danh sách ứng viên...
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  Chưa có ứng viên nào ghi danh cho lớp {currentUnit}. Hãy là người đầu tiên!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {candidates.map((cand: any) => (
                  <div
                    key={cand.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#002b66]">{cand.name}</h3>
                        <span className="font-mono text-[11px] text-slate-500 block">
                          MSSV: {cand.studentId}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                        {cand.name.charAt(0)}
                      </div>
                    </div>

                    {/* Danh sách chức vụ ứng cử */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cand.positionIds.map((pId: string) => {
                        const posObj = positions.find((p: any) => p.id === pId)
                        return (
                          <span
                            key={pId}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200"
                          >
                            {posObj?.title || pId}
                          </span>
                        )
                      })}
                    </div>

                    {/* Slogan */}
                    {cand.slogan && (
                      <p className="text-xs text-slate-600 italic line-clamp-2 pt-1">
                        &ldquo;{cand.slogan}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TranhCuPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Đang tải trang ứng cử...</div>}>
      <TranhCuContent />
    </Suspense>
  )
}
