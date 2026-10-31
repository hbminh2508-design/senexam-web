'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  UserCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  Vote as VoteIcon,
  Sparkles,
  ArrowRight,
  Phone,
  Mail,
  FileText,
  BadgeCheck,
} from 'lucide-react'

export default function TranhCuPage() {
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
      const res = await fetch('/api/baucu')
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
  }, [])

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

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* Banner tiêu đề */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#002b66] text-xs font-bold uppercase tracking-wider">
          <UserCheck className="w-4 h-4" />
          <span>BƯỚC 1: TIẾP NHẬN HỒ SƠ TRANH CỬ</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#002b66] uppercase font-serif">
          GHI DANH ỨNG CỬ BAN CÁN SỰ & BAN CHẤP HÀNH
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
          Các bạn sinh viên có nguyện vọng cống hiến cho tập thể lớp <strong>K71-P-ME2</strong> vui lòng điền thông tin bên dưới để hệ thống ghi nhận vào hòm phiếu biểu quyết.
        </p>
      </div>

      {/* Thông báo nếu đã đóng đăng ký */}
      {electionData && !electionData.isRegistrationOpen && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Thông báo:</strong> Người điều hành hiện đã đóng tiếp nhận hồ sơ tranh cử để tiến hành bỏ phiếu. Nếu bạn cần bổ sung danh sách, vui lòng liên hệ người điều hành tại lớp.
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
              Phiếu Đăng Ký Ứng Cử
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
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                MSSV dùng để định danh duy nhất trong hệ thống.
              </span>
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
                <label className="block font-bold text-slate-700 mb-1">Email VNU/Cá nhân</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="an@vnu.edu.vn"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
                />
              </div>
            </div>

            {/* Danh sách chức vụ muốn ứng cử */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Chức vụ ứng cử <span className="text-red-500">*</span> (Có thể chọn nhiều chức vụ)
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                {positions.map((pos: any) => {
                  const isChecked = selectedPositions.includes(pos.id)
                  return (
                    <label
                      key={pos.id}
                      className={`flex items-start gap-2 p-2 rounded-lg border transition cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePosition(pos.id)}
                        className="mt-0.5 w-4 h-4 accent-[#002b66] cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold leading-tight">{pos.title}</div>
                        <div className="text-[10px] text-slate-500">{pos.categoryName}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Chương trình hành động / Lời hứa */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lời hứa tranh cử / Chương trình hành động ngắn
              </label>
              <textarea
                rows={2}
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ví dụ: Quyết tâm xây dựng tập thể K71-P-ME2 đoàn kết, học tốt, phong trào hàng đầu Khoa FEPN..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
              />
            </div>

            {/* Giới thiệu bản thân */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Giới thiệu bản thân (Kinh nghiệm cán sự, sở trường)
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Ví dụ: Từng là lớp trưởng cấp 3, năng nổ trong các hoạt động Đoàn Hội, hòa đồng..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-hidden bg-slate-50/50"
              />
            </div>

            {/* Nút gửi */}
            <button
              type="submit"
              disabled={submitting || (electionData && !electionData.isRegistrationOpen)}
              className="w-full py-2.5 bg-[#002b66] hover:bg-[#001f4d] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              {submitting ? 'Đang gửi hồ sơ...' : 'Xác nhận nộp hồ sơ ứng cử'}
            </button>
          </form>
        </div>

        {/* ================= DANH SÁCH ỨNG VIÊN ĐÃ GHI DANH (7 Cột) ================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase">
                Danh Sách Ứng Viên Đã Ghi Danh ({candidates.length})
              </h2>
              <p className="text-xs text-slate-500">
                Các ứng viên sẽ tự động xuất hiện trên lá phiếu biểu quyết
              </p>
            </div>

            <Link
              href="/baucu/bophieu"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <VoteIcon className="w-4 h-4" />
              <span>Tới hòm phiếu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {candidates.length === 0 ? (
            <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-500">
                Chưa có sinh viên nào ghi danh ứng cử. Hãy là người đầu tiên nộp hồ sơ bằng biểu mẫu bên cạnh!
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Nhóm hiển thị theo từng chức vụ */}
              {positions.map((pos: any) => {
                const candidatesForPos = candidates.filter((c: any) => c.positionIds?.includes(pos.id))
                return (
                  <div key={pos.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <h3 className="text-sm font-bold text-[#002b66] uppercase">
                          {pos.title}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-normal">
                          (Cơ cấu: 0{pos.quota} người)
                        </span>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {candidatesForPos.length} ứng viên
                      </span>
                    </div>

                    {candidatesForPos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 pl-4">
                        Chưa có ứng viên nào ứng cử vị trí này.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {candidatesForPos.map((cand: any) => (
                          <div
                            key={cand.id}
                            className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white hover:border-blue-300 transition space-y-1.5"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-xs font-bold text-slate-900">{cand.name}</div>
                                <div className="text-[11px] font-mono text-blue-700 font-semibold">
                                  MSSV: {cand.studentId}
                                </div>
                              </div>
                              <span className="w-6 h-6 rounded-full bg-blue-100 text-[#002b66] font-bold text-[10px] flex items-center justify-center">
                                {cand.name.charAt(0)}
                              </span>
                            </div>

                            {cand.slogan && (
                              <p className="text-[11px] text-slate-700 italic border-l-2 border-l-blue-400 pl-2 py-0.5">
                                "{cand.slogan}"
                              </p>
                            )}

                            {cand.bio && (
                              <p className="text-[10px] text-slate-500 line-clamp-2">
                                {cand.bio}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
