'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  QrCode,
  Vote as VoteIcon,
  UserCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  Share2,
  Copy,
  ExternalLink,
  Maximize2,
  AlertTriangle,
} from 'lucide-react'

export default function BauCuHomePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  const fetchElectionData = async () => {
    try {
      const res = await fetch('/api/baucu')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu bầu cử:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchElectionData()
    if (typeof window !== 'undefined') {
      setCurrentUrl(`${window.location.origin}/baucu/bophieu`)
    }
  }, [])

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=15&data=${encodeURIComponent(
    currentUrl || 'https://www.senexam.me/baucu/bophieu'
  )}`

  const handleCopyLink = () => {
    if (!currentUrl) return
    navigator.clipboard.writeText(currentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 pb-16">
      {/* ================= HERO BANNER (Đúng cấu trúc ảnh K71-P-ME2) ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f0f5ff] via-white to-slate-50 border-b border-slate-200 py-10 sm:py-16 text-center">
        {/* Logo mờ watermark giữa background giống ảnh */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <img src="/fepn-logo.png" alt="Watermark" className="w-[500px] h-[500px] object-contain" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 rounded-full shadow-xs text-xs font-bold text-[#002b66]">
            <img src="/fepn-logo.png" alt="FEPN Logo" className="w-4 h-4 object-contain" />
            <span>KHOA VẬT LÝ KỸ THUẬT & CÔNG NGHỆ NANO (FEPN - VNU-UET)</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#002b66] tracking-tight uppercase leading-tight font-serif">
            BẦU CỬ BAN CHẤP HÀNH LÂM THỜI <br className="hidden sm:inline" />& BAN CÁN SỰ LỚP
          </h1>

          <div className="inline-block px-4 py-1.5 bg-[#002b66] text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-md shadow-xs">
            ĐƠN VỊ: K71-P-ME2 • NĂM HỌC 2026-2027
          </div>

          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed pt-2">
            Hệ thống bỏ phiếu trực tuyến minh bạch, dân chủ và chuẩn mực, áp dụng công nghệ số xác minh mã sinh viên (MSSV) dành cho toàn thể thành viên lớp K71-P-ME2.
          </p>

          {/* 3 Nút hành động chính */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              href="/baucu/bophieu"
              className="px-6 py-3 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-sm rounded-xl shadow-md transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <VoteIcon className="w-4 h-4" />
              <span>VÀO BỎ PHIẾU NGAY</span>
              <ChevronRight className="w-4 h-4" />
            </Link>

            <Link
              href="/baucu/tranhcu"
              className="px-5 py-3 bg-white hover:bg-slate-50 text-[#002b66] border border-blue-300 font-bold text-sm rounded-xl shadow-xs transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Ghi danh ứng cử</span>
            </Link>

            <Link
              href="/baucu/tongket"
              className="px-5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-sm rounded-xl shadow-xs transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Kết quả tổng kết</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= KHỐI QR CODE & CƠ CẤU BẦU CỬ ================= */}
      <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Cột trái: CƠ CẤU BẦU CỬ THEO ĐÚNG ẢNH ĐÍNH KÈM */}
          <div className="md:col-span-7 space-y-6">
            <div className="bg-white border-2 border-[#002b66]/20 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />

              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-5">
                <ShieldCheck className="w-6 h-6 text-[#002b66]" />
                <h2 className="text-lg sm:text-xl font-black text-[#002b66] uppercase tracking-wide">
                  CƠ CẤU BAN CÁN SỰ & BAN CHẤP HÀNH
                </h2>
              </div>

              {/* 3 Nhóm chức vụ */}
              <div className="space-y-4">
                {/* 1. Ban Cán sự lớp */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-xs font-black uppercase text-[#002b66] tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>I. Ban Cán Sự Lớp (03 thành viên)</span>
                  </div>
                  <ul className="text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
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

                {/* 2. Ban Chấp hành Chi Đoàn lâm thời (Theo đúng ảnh) */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-xs font-black uppercase text-red-700 tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>II. Ban Chấp Hành Chi Đoàn Lâm Thời (03 thành viên)</span>
                  </div>
                  <ul className="text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 Bí Thư</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 Phó Bí Thư</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-600 font-bold">•</span>
                      <span>01 UV BCH Chi Đoàn</span>
                    </li>
                  </ul>
                </div>

                {/* 3. Ban Chấp hành Chi Hội Sinh Viên lâm thời (Theo đúng ảnh) */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="text-xs font-black uppercase text-emerald-700 tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>III. Ban Chấp Hành Chi Hội Sinh Viên Lâm Thời (03 thành viên)</span>
                  </div>
                  <ul className="text-sm text-slate-800 space-y-1.5 pl-4 font-semibold">
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

              {/* Tình trạng ứng viên hiện tại */}
              <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Đã ghi danh: <strong>{data?.candidates?.length || 0} ứng viên</strong></span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <VoteIcon className="w-4 h-4 text-emerald-600" />
                  <span>Đã bỏ phiếu: <strong>{data?.totalVotes || 0} cử tri</strong></span>
                </span>
              </div>
            </div>
          </div>

          {/* Cột phải: KHUNG SINH MÃ QR CODE DÀNH CHO LỚP QUÉT TRỰC TIẾP */}
          <div className="md:col-span-5">
            <div className="bg-white border-2 border-blue-600/30 rounded-2xl p-6 text-center shadow-lg sticky top-20">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-[#002b66] text-xs font-bold rounded-full mb-3">
                <QrCode className="w-4 h-4" />
                <span>QUÉT MÃ QR BỎ PHIẾU BẰNG ĐIỆN THOẠI</span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Chiếu mã này lên máy chiếu lớp
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Sinh viên mở camera điện thoại quét mã để truy cập hòm phiếu K71-P-ME2
              </p>

              {/* Khung ảnh QR Code */}
              <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 p-3 bg-white border-2 border-slate-300 rounded-2xl shadow-inner flex items-center justify-center group">
                <img
                  src={qrImageUrl}
                  alt="QR Code Bỏ Phiếu K71P-ME2"
                  className="w-full h-full object-contain rounded-lg"
                />

                {/* Logo nhỏ ở giữa mã QR */}
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
                  <span>{copied ? 'Đã sao chép link!' : 'Sao chép link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3.5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Phóng to toàn màn hình</span>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Đường dẫn trực tiếp: <span className="font-mono text-blue-700 font-semibold break-all">{currentUrl || '/baucu/bophieu'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= THỂ LỆ BẦU CỬ (ĐÚNG NGUYÊN VĂN 5 ĐIỀU) ================= */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white border border-slate-300 rounded-2xl p-6 sm:p-10 shadow-sm">
          <div className="text-center max-w-2xl mx-auto pb-6 border-b border-slate-200 mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              QUY CHẾ BIỂU QUYẾT DÂN CHỦ
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#002b66] mt-2 font-serif uppercase">
              THỂ LỆ BẦU BAN CÁN SỰ & BAN CHẤP HÀNH LỚP
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Áp dụng cho kỳ bầu cử Lớp K71-P-ME2 • Khóa QH-2026-I/CQ
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

          {/* Nút hành động chân trang */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Trạng thái hệ thống: <strong className="text-emerald-700">● Sẵn sàng kết nối trực tuyến</strong>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/baucu/tranhcu"
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Đăng ký ứng cử
              </Link>
              <Link
                href="/baucu/bophieu"
                className="px-5 py-2 bg-[#002b66] hover:bg-[#001f4d] text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                Tiến hành bỏ phiếu
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODAL PHÓNG TO MÃ QR TOÀN MÀN HÌNH ================= */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2">
              <img src="/fepn-logo.png" alt="FEPN" className="w-8 h-8 object-contain" />
              <h3 className="text-lg font-black text-[#002b66] uppercase">
                BẦU CỬ LỚP K71-P-ME2
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Mời toàn thể sinh viên quét mã QR bằng điện thoại để bỏ phiếu
            </p>

            <div className="p-4 bg-white border-4 border-[#002b66] rounded-2xl inline-block shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=15&data=${encodeURIComponent(
                  currentUrl || 'https://www.senexam.me/baucu/bophieu'
                )}`}
                alt="QR Code Toàn màn hình"
                className="w-72 h-72 sm:w-80 sm:h-80 object-contain mx-auto"
              />
            </div>

            <div className="font-mono text-xs text-blue-700 font-bold break-all bg-blue-50 p-2 rounded-lg">
              {currentUrl || 'https://www.senexam.me/baucu/bophieu'}
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
