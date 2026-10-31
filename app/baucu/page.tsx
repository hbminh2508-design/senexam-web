'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  QrCode,
  Vote as VoteIcon,
  UserCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Copy,
  Maximize2,
  Layers,
  GraduationCap,
  Sparkles,
  Lock,
} from 'lucide-react'

function BauCuHomeContent() {
  const searchParams = useSearchParams()
  const initialClassParam = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'

  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassParam)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [currentOrigin, setCurrentOrigin] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  // 1. Tải danh sách tất cả các lớp
  const fetchClasses = async () => {
    try {
      const res = await fetch(`/api/baucu?action=classes&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setClasses(json.data)
        // Nếu lớp hiện tại không có trong danh sách thì chọn lớp đầu tiên
        const exists = json.data.some((c: any) => c.id === selectedClassId)
        if (!exists) {
          setSelectedClassId(json.data[0].id)
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách lớp:', err)
    }
  }

  // 2. Tải dữ liệu chi tiết của lớp đang chọn
  const fetchElectionData = async (classId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/baucu?class=${encodeURIComponent(classId)}&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu lớp:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin)
    }
    fetchClasses()
    const interval = setInterval(() => {
      fetchClasses()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedClassId) {
      fetchElectionData(selectedClassId)
    }
  }, [selectedClassId])

  const selectedClass = classes.find((c) => c.id === selectedClassId) || {
    id: selectedClassId,
    unit: data?.unit || 'K70P-ME2',
    academicYear: data?.academicYear || '2026-2027',
    title: data?.title || 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ',
  }

  // Đường dẫn hòm phiếu có gắn cờ lock=1 (người quét mã sẽ bị khóa vào lớp này, tránh phiếu ma)
  const lockedVotingUrl = currentOrigin
    ? `${currentOrigin}/baucu/bophieu?class=${encodeURIComponent(selectedClassId)}&lock=1`
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

  return (
    <div className="flex-1 pb-16">
      {/* ================= HERO BANNER (ĐÃ SỬA LỖI FONT HOÀN TOÀN) ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f2f6fc] via-white to-slate-50 border-b border-slate-200 py-10 sm:py-14 text-center">
        {/* Logo mờ watermark giữa background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
          <img src="/fepn-logo.png" alt="Watermark" className="w-[450px] h-[450px] object-contain" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 rounded-full shadow-xs text-xs font-bold text-[#002b66]">
            <img src="/fepn-logo.png" alt="FEPN Logo" className="w-4 h-4 object-contain" />
            <span>KHOA VẬT LÝ KỸ THUẬT & CÔNG NGHỆ NANO (FEPN - VNU-UET)</span>
          </div>

          {/* Tiêu đề chính trang trọng chuẩn mực, font sans sạch đẹp, không bị lỗi font */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#002b66] uppercase leading-tight tracking-normal">
            BẦU CỬ BAN CHẤP HÀNH LÂM THỜI <br className="hidden sm:inline" />& BAN CÁN SỰ LỚP
          </h1>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#002b66] text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-md shadow-xs">
            <GraduationCap className="w-4 h-4" />
            <span>
              ĐƠN VỊ: {data?.unit || selectedClass.unit} • NĂM HỌC {data?.academicYear || '2026-2027'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed pt-1">
            Hệ thống bỏ phiếu trực tuyến minh bạch, chuẩn mực và bảo mật của Khoa FEPN. Mỗi cử tri biểu quyết thông qua mã QR riêng biệt cho từng lớp, tự động khóa lớp để ngăn chặn hoàn toàn việc bỏ phiếu chéo hoặc phiếu ma.
          </p>

          {/* 3 Nút chuyển hướng nhanh theo lớp hiện tại */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href={`/baucu/bophieu?class=${encodeURIComponent(selectedClassId)}&lock=1`}
              className="px-6 py-2.5 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <VoteIcon className="w-4 h-4" />
              <span>VÀO BỎ PHIẾU ({data?.unit || selectedClass.unit})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>

            <Link
              href={`/baucu/tranhcu?class=${encodeURIComponent(selectedClassId)}`}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-[#002b66] border border-blue-300 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Ghi danh ứng cử</span>
            </Link>

            <Link
              href={`/baucu/tongket?class=${encodeURIComponent(selectedClassId)}`}
              className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Kết quả tổng kết</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= KHỐI TÙY CHỌN CÁC LỚP BẦU CỬ ================= */}
      <section className="max-w-6xl mx-auto px-4 pt-8">
        <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#002b66]" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#002b66] uppercase">
                  Tùy chọn danh sách các lớp bầu cử
                </h2>
                <p className="text-xs text-slate-500">
                  Chọn lớp để hiển thị mã QR riêng và hòm phiếu tương ứng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/baucu/admin"
                className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1"
              >
                <span>+ Quản trị & Tạo lớp mới</span>
              </Link>
            </div>
          </div>

          {/* Danh sách các tab lớp */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4">
            {classes.map((c) => {
              const isSelected = c.id === selectedClassId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#002b66] text-white border-[#002b66] shadow-md scale-102'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <GraduationCap className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span className="tracking-wide">LỚP {c.unit}</span>
                  {c.totalVotes !== undefined && c.totalVotes > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.totalVotes} phiếu
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================= KHỐI QR CODE RIÊNG BIỆT TỪNG LỚP & CƠ CẤU ================= */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Cột trái: CƠ CẤU BẦU CỬ CHUẨN CỦA LỚP */}
          <div className="md:col-span-7 space-y-6">
            <div className="bg-white border-2 border-[#002b66]/20 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-[#002b66]" />
                  <h2 className="text-base sm:text-lg font-black text-[#002b66] uppercase tracking-wide">
                    CƠ CẤU BẦU CỬ: LỚP {data?.unit || selectedClass.unit}
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  NH {data?.academicYear || '2026-2027'}
                </span>
              </div>

              {/* 3 Nhóm chức vụ */}
              <div className="space-y-4">
                {/* 1. Ban Cán sự lớp */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                  <div className="text-xs font-black uppercase text-[#002b66] tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>I. Ban Cán Sự Lớp (03 thành viên)</span>
                  </div>
                  <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>01 Lớp trưởng</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>02 Lớp phó (Học tập & Đời sống / Phong trào)</span>
                    </li>
                  </ul>
                </div>

                {/* 2. BCH Chi Đoàn lâm thời */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                  <div className="text-xs font-black uppercase text-red-700 tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>II. Ban Chấp Hành Chi Đoàn Lâm Thời (03 thành viên)</span>
                  </div>
                  <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 Bí Thư Chi đoàn</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 Phó Bí Thư Chi đoàn</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 UV BCH Chi Đoàn</span>
                    </li>
                  </ul>
                </div>

                {/* 3. BCH Chi Hội Sinh Viên lâm thời */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                  <div className="text-xs font-black uppercase text-emerald-700 tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>III. Ban Chấp Hành Chi Hội Sinh Viên Lâm Thời (03 thành viên)</span>
                  </div>
                  <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>01 Chi Hội Trưởng</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>01 Chi Hội Phó</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>01 UV BCH Chi Hội</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Thống kê ứng viên & cử tri của lớp đang chọn */}
              <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>
                    Đã ghi danh: <strong>{data?.candidates?.length || 0} ứng viên</strong>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <VoteIcon className="w-4 h-4 text-emerald-600" />
                  <span>
                    Đã bỏ phiếu: <strong>{data?.totalVotes || 0} cử tri</strong>
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Cột phải: KHUNG SINH MÃ QR CODE DÀNH RIÊNG CHO LỚP ĐƯỢC CHỌN */}
          <div className="md:col-span-5">
            <div className="bg-white border-2 border-blue-600/30 rounded-2xl p-6 text-center shadow-lg sticky top-20">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-[#002b66] text-xs font-bold rounded-full mb-3">
                <QrCode className="w-4 h-4" />
                <span>MÃ QR HÒM PHIẾU: LỚP {data?.unit || selectedClass.unit}</span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Chiếu mã này lên máy chiếu lớp {data?.unit || selectedClass.unit}
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Sinh viên quét mã này để vào thẳng hòm phiếu lớp <strong>{data?.unit || selectedClass.unit}</strong>. Hệ thống sẽ tự động khóa phòng bỏ phiếu để tránh cử tri bầu nhầm lớp hoặc phát sinh phiếu ma.
              </p>

              {/* Khung ảnh QR Code của lớp */}
              <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 p-3 bg-white border-2 border-slate-300 rounded-2xl shadow-inner flex items-center justify-center">
                <img
                  src={qrImageUrl}
                  alt={`QR Code Bỏ Phiếu ${data?.unit || selectedClass.unit}`}
                  className="w-full h-full object-contain rounded-lg"
                />

                {/* Logo nhỏ ở tâm mã QR */}
                <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white border border-slate-300 p-1 flex items-center justify-center shadow-md">
                  <img src="/fepn-logo.png" alt="FEPN" className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Nút sao chép link và phóng to */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Đã sao chép link!' : 'Sao chép link hòm phiếu'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3.5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Phóng to máy chiếu</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-left">
                <div className="flex items-center gap-1 text-[#002b66] font-bold mb-1">
                  <Lock className="w-3 h-3" />
                  <span>Cơ chế bảo mật chống phiếu ma:</span>
                </div>
                <div className="font-mono text-blue-700 font-semibold break-all bg-blue-50/70 p-2 rounded-lg">
                  {lockedVotingUrl}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= THỂ LỆ BẦU CỬ (ĐÚNG NGUYÊN VĂN 5 ĐIỀU) ================= */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white border border-slate-300 rounded-2xl p-6 sm:p-10 shadow-xs">
          <div className="text-center max-w-2xl mx-auto pb-6 border-b border-slate-200 mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              QUY CHẾ BIỂU QUYẾT DÂN CHỦ
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#002b66] mt-2 uppercase tracking-normal">
              THỂ LỆ BẦU BAN CÁN SỰ & BAN CHẤP HÀNH LỚP
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Áp dụng cho kỳ bầu cử Lớp {data?.unit || selectedClass.unit} • Khóa QH-2026-I/CQ
            </p>
          </div>

          <div className="space-y-6 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
            {/* Điều 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-l-[#002b66]">
              <h3 className="font-bold text-base text-[#002b66] mb-1">
                Điều 1. Hình thức bầu
              </h3>
              <p>
                Việc bầu ban cán sự lớp được tiến hành bằng hình thức <strong>bỏ phiếu trực tuyến</strong> qua hệ thống Bầu cử FEPN, thực hiện trực tiếp tại lớp bằng điện thoại thông qua mã QR do người điều hành cung cấp.
              </p>
            </div>

            {/* Điều 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-l-blue-600">
              <h3 className="font-bold text-base text-blue-900 mb-1">
                Điều 2. Quy định về số lần biểu quyết
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Mỗi thành viên trong lớp chỉ được gửi phiếu bầu <strong>1 lần duy nhất</strong> (được xác thực thông qua Họ tên và Mã số sinh viên - MSSV).</li>
                <li>Đối với chức vụ có từ <strong>5 người ứng cử trở lên</strong>, mỗi thành viên được chọn <strong>tối đa 3 ứng viên khác nhau</strong>.</li>
                <li>Đối với chức vụ có <strong>dưới 5 người ứng cử</strong>, mỗi thành viên chỉ được chọn <strong>1 ứng viên</strong> (đối với chức vụ Lớp phó cơ cấu 2 người, chọn tối đa 2 ứng viên).</li>
                <li>Hệ thống được cài đặt tự động giới hạn số lựa chọn và giới hạn 1 phản hồi cho mỗi MSSV. Phiếu vượt quá số lựa chọn quy định sẽ không được hệ thống ghi nhận.</li>
              </ol>
            </div>

            {/* Điều 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-l-amber-600">
              <h3 className="font-bold text-base text-amber-900 mb-1">
                Điều 3. Cách xác định kết quả
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Với mỗi chức vụ, ứng viên có <strong>số phiếu bầu cao nhất</strong> sẽ trúng cử chức vụ đó.</li>
                <li>Nếu có từ 2 ứng viên trở lên bằng phiếu ở vị trí cao nhất, lớp sẽ bầu lại giữa các ứng viên này bằng một phiên bầu mới, mỗi thành viên chỉ được chọn 1 ứng viên.</li>
                <li>Một ứng viên có thể ứng cử nhiều chức vụ. Nếu trúng cử nhiều chức vụ cùng lúc, ứng viên được chọn 1 chức vụ, các chức vụ còn lại sẽ bầu lại.</li>
              </ol>
            </div>

            {/* Điều 4 */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-l-emerald-600">
              <h3 className="font-bold text-base text-emerald-900 mb-1">
                Điều 4. Trình tự tiến hành
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li><strong>Bước 1:</strong> Người điều hành giới thiệu các ứng viên cho từng chức vụ.</li>
                <li><strong>Bước 2:</strong> Từng ứng viên trình bày ngắn gọn chương trình hành động (nếu có).</li>
                <li><strong>Bước 3:</strong> Người điều hành chia sẻ mã QR hoặc link biểu mẫu, các thành viên bỏ phiếu trong thời gian quy định (ví dụ 5 phút).</li>
                <li><strong>Bước 4:</strong> Hết thời gian, người điều hành đóng hòm phiếu và công khai bảng kết quả tổng hợp trước lớp.</li>
                <li><strong>Bước 5:</strong> Công bố danh sách ban cán sự và ban chấp hành trúng cử.</li>
              </ol>
            </div>

            {/* Điều 5 */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-l-purple-600">
              <h3 className="font-bold text-base text-purple-900 mb-1">
                Điều 5. Quy định chung
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Mỗi thành viên phải tự bỏ phiếu bằng thông tin MSSV của chính mình, <strong>không bỏ phiếu hộ</strong> hoặc dùng nhiều thông tin giả mạo.</li>
                <li>Việc bầu cử phải diễn ra công bằng, trung thực, đúng thể lệ. Phiếu có dấu hiệu gian lận sẽ bị loại khỏi hệ thống.</li>
                <li>Các thành viên giữ trật tự và tôn trọng ý kiến của nhau trong suốt quá trình bầu cử.</li>
                <li>Kết quả bầu cử có hiệu lực sau khi được công bố và biểu quyết thống nhất trước lớp.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODAL PHÓNG TO MÃ QR TOÀN MÀN HÌNH ================= */}
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
                BẦU CỬ LỚP {data?.unit || selectedClass.unit}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Mời toàn thể cử tri lớp <strong>{data?.unit || selectedClass.unit}</strong> quét mã QR bằng điện thoại để bỏ phiếu
            </p>

            <div className="p-4 bg-white border-4 border-[#002b66] rounded-2xl inline-block shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=15&data=${encodeURIComponent(
                  lockedVotingUrl
                )}`}
                alt="QR Code Toàn màn hình"
                className="w-72 h-72 sm:w-80 sm:h-80 object-contain mx-auto"
              />
            </div>

            <div className="font-mono text-xs text-blue-700 font-bold break-all bg-blue-50 p-2.5 rounded-lg border border-blue-200">
              {lockedVotingUrl}
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Lock className="w-3.5 h-3.5 text-blue-700" />
              <span>Chế độ khóa lớp: Cử tri quét mã sẽ bỏ phiếu đúng lớp, chống phiếu ma.</span>
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="px-6 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BauCuHomePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Đang tải hệ thống bầu cử...</div>}>
      <BauCuHomeContent />
    </Suspense>
  )
}
