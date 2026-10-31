'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock, ShieldCheck, Settings } from 'lucide-react'

export default function BauCuHeader() {
  const searchParams = useSearchParams()
  const classParam = searchParams.get('class') || searchParams.get('lop') || ''
  const lockParam = searchParams.get('lock') === '1' || searchParams.get('lock') === 'true'

  const [currentClass, setCurrentClass] = useState<string>('K70P-ME2')
  const [isLocked, setIsLocked] = useState<boolean>(false)

  useEffect(() => {
    // Kiểm tra query params hoặc localStorage
    const storedLock = typeof window !== 'undefined' ? localStorage.getItem('fepn_locked_class') : null

    if (lockParam && classParam) {
      setIsLocked(true)
      setCurrentClass(classParam.toUpperCase())
      if (typeof window !== 'undefined') {
        localStorage.setItem('fepn_locked_class', classParam)
      }
    } else if (storedLock) {
      setIsLocked(true)
      setCurrentClass(storedLock.toUpperCase())
    } else if (classParam) {
      setCurrentClass(classParam.toUpperCase())
    }
  }, [classParam, lockParam])

  const classQuery = classParam ? `?class=${encodeURIComponent(classParam)}${isLocked ? '&lock=1' : ''}` : ''

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Logo & Brand */}
        {isLocked ? (
          // Chế độ Cử tri đã khóa lớp (Quét từ QR): Không có link thoát ra trang chọn lớp khác
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/fepn-logo.png"
                alt="Logo Khoa FEPN"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-blue-100 text-[#002b66] rounded-md border border-blue-200 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-blue-700" />
                  <span>{currentClass}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Cử tri chính thức</span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#002b66] leading-tight tracking-tight">
                HÒM PHIẾU BẦU CỬ FEPN
              </h1>
            </div>
          </div>
        ) : (
          // Chế độ bình thường: Có thể quay về trang chủ chọn lớp
          <Link href="/baucu" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition shrink-0">
              <img
                src="/fepn-logo.png"
                alt="Logo Khoa FEPN"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-sm">
                  {currentClass}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">NH 2026-2027</span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#002b66] leading-tight tracking-tight">
                BẦU CỬ FEPN
              </h1>
            </div>
          </Link>
        )}

        {/* 3 Nút chuyển giữa các trang (giữ nguyên ngữ cảnh lớp) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href={`/baucu/tranhcu${classQuery}`}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
          >
            <span>1. Tranh cử</span>
          </Link>
          <Link
            href={`/baucu/bophieu${classQuery}`}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-[#002b66] text-white hover:bg-[#001f4d] rounded-lg shadow-xs transition flex items-center gap-1"
          >
            <span>2. Bỏ phiếu</span>
          </Link>
          <Link
            href={`/baucu/tongket${classQuery}`}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1"
          >
            <span>3. Tổng kết</span>
          </Link>

          {/* Nút Admin chỉ hiển thị khi không ở chế độ cử tri khóa lớp */}
          {!isLocked && (
            <Link
              href="/baucu/admin"
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
              title="Quản trị bầu cử các lớp"
            >
              <Settings className="w-4 h-4" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
