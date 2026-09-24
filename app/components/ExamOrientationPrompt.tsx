'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { RotateCw, Smartphone, Monitor, X, ChevronDown, CheckCircle2, Sparkles } from 'lucide-react'

export default function ExamOrientationPrompt() {
  const pathname = usePathname()
  const [isPortrait, setIsPortrait] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Kiểm tra xem trang hiện tại có phải trang thi thử / kho đề cần xoay ngang không
  const isExamRelated =
    pathname?.startsWith('/new-exams') ||
    pathname?.startsWith('/seb-exam') ||
    pathname?.startsWith('/legacy-exams') ||
    pathname?.startsWith('/new-history')

  useEffect(() => {
    if (!isExamRelated) return

    const checkOrientation = () => {
      const mobile = window.innerWidth <= 768
      const portrait = window.innerHeight > window.innerWidth
      setIsMobile(mobile)
      setIsPortrait(portrait)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [isExamRelated])

  // Không hiển thị nếu không phải trang thi cử, không phải mobile, không ở chế độ dọc hoặc user đã đóng
  if (!isExamRelated || !isMobile || !isPortrait || dismissed) {
    return null
  }

  return (
    <div className="fixed top-3 inset-x-3 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-[24px] border border-amber-500/30 bg-white/95 dark:bg-slate-900/95 p-4 shadow-[0_12px_40px_rgba(245,158,11,0.25)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          {/* Animated Rotating Phone Icon */}
          <div className="flex h-11 w-11 shrink-0 aspect-square items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <RotateCw className="h-6 w-6 animate-spin-slow shrink-0 aspect-square" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" /> Trải nghiệm tốt nhất
              </span>
            </div>

            <h4 className="mt-1 text-xs font-black text-slate-900 dark:text-white leading-tight">
              Khuyên dùng màn hình ngang & giao diện Desktop
            </h4>
            <p className="mt-0.5 text-[11px] text-[#4B5563] dark:text-slate-300 font-medium leading-relaxed">
              Để đọc rõ đồ thị, công thức Toán và ma trận đáp án, vui lòng:
            </p>

            {/* 2 Bước Hướng Dẫn */}
            <div className="mt-2 space-y-1.5 text-[11px] font-bold">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-black">1</span>
                <span>Xoay ngang màn hình điện thoại 🔄</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white text-[9px] font-black">2</span>
                <span>Bật <strong>"Yêu cầu trang web cho máy tính"</strong> 💻</span>
              </div>
            </div>

            {/* Hướng dẫn chi tiết toggle */}
            {showGuide && (
              <div className="mt-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-2.5 text-[10px] text-slate-600 dark:text-slate-300 space-y-1 animate-in fade-in">
                <p>• <strong>Chrome / Cốc Cốc:</strong> Nhấn nút 3 chấm góc trên bên phải → Tích chọn <em>"Trang web cho máy tính"</em>.</p>
                <p>• <strong>Safari (iPhone):</strong> Nhấn biểu tượng <em>aA</em> góc thanh địa chỉ → Chọn <em>"Yêu cầu trang web cho máy tính"</em>.</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                {showGuide ? 'Ẩn hướng dẫn' : 'Cách bật Desktop Site?'}
                <ChevronDown className={`h-3 w-3 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="ml-auto rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 text-[10px] font-black shadow-xs active:scale-95 transition"
              >
                Tiếp tục xem dọc
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
