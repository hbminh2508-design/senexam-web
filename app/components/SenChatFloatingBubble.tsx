'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { X, Sparkles, Loader2 } from 'lucide-react'
import type { ChatMessage } from './SenChatFloatingModal'

const SenChatFloatingModal = dynamic(
  () => import('./SenChatFloatingModal'),
  {
    loading: () => (
      <div className="fixed bottom-16 md:bottom-20 right-3 md:right-6 z-50 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl border border-black/10 dark:border-white/10 text-xs flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-pink-500" /> Đang tải Sen Chat...
      </div>
    ),
    ssr: false,
  }
)

export default function SenChatFloatingBubble() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Chào bạn! Mình là **Sen Chat** 🌸. Bạn cần mình giải đáp câu hỏi nào hay hỗ trợ kiến thức ôn thi hôm nay? Dữ liệu trò chuyện sẽ tự động được lưu vào **SenAI Studio** nhé!',
      timestamp: new Date(),
    },
  ])
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Không hiển thị bong bóng chat Sen AI ở các nơi quan trọng:
  // 1. Tất cả các phòng thi & làm bài thi (chống gian lận, bảo mật thi cử và tránh che khuất đề thi):
  //    - /new-exams/[id] (phòng thi mới)
  //    - /legacy-exams/[id] (phòng thi cũ)
  //    - /seb-exam (phòng thi bảo mật Safe Exam Browser)
  // 2. Chế độ học tập trung (Pomodoro / Focus mode - chống xao nhãng):
  //    - /new-focus, /legacy-focus
  // 3. Phòng thí nghiệm ảo (Virtual Labs - toàn màn hình mô phỏng):
  //    - /new-labs, /legacy-phongthinghiem
  // 4. Các trang xác thực & đăng nhập:
  //    - /new-sign, /login, /seb-login, /fepn-login, /new-reset-password, /fepn-reset-password
  // 5. Chính trang SenAI Studio (đã có khung chat toàn màn hình):
  //    - /new-senai-studio, /legacy-senai-studio, /senai-studio
  // 6. Cổng thiết lập khóa học & soạn đề KaTeX (tránh che bàn phím ảo toán học):
  //    - /new-setup-course
  // 7. Ứng dụng riêng BREATHE U (cả pathname lẫn subdomain):
  //    - /breathe-u, breathu.senexam.me, breatheu.senexam.me
  const isBreatheHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('breathu') || window.location.hostname.includes('breatheu'))

  // 8. Hệ thống FEPN độc lập (loại bỏ hoàn toàn các yếu tố SenExam như bong bóng chat):
  const isFepn = Boolean(
    pathname?.startsWith('/fepn-') ||
    pathname?.startsWith('/tsv-fepn') ||
    (typeof window !== 'undefined' &&
      (window.location.hostname.includes('fepn.') || window.location.hostname.includes('tsv.fepn.')))
  )

  const isExamRoom = Boolean(
    (pathname?.startsWith('/new-exams/') && pathname !== '/new-exams') ||
    (pathname?.startsWith('/legacy-exams/') && pathname !== '/legacy-exams') ||
    pathname?.startsWith('/seb-exam')
  )

  const isExcluded = Boolean(
    isFepn ||
    isBreatheHost ||
    isExamRoom ||
    pathname?.startsWith('/new-focus') ||
    pathname?.startsWith('/legacy-focus') ||
    pathname?.startsWith('/new-labs') ||
    pathname?.startsWith('/legacy-phongthinghiem') ||
    pathname?.startsWith('/new-senai-studio') ||
    pathname?.startsWith('/legacy-senai-studio') ||
    pathname?.startsWith('/senai-studio') ||
    pathname?.startsWith('/new-setup-course') ||
    pathname?.startsWith('/new-setup-courses') ||
    pathname?.startsWith('/new-idp') ||
    pathname?.startsWith('/idp') ||
    pathname?.startsWith('/new-sign') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/seb-login') ||
    pathname?.startsWith('/new-reset-password') ||
    pathname?.startsWith('/breathe-u')
  )

  const [disabledBySetting, setDisabledBySetting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const checkSetting = () => {
      setDisabledBySetting(localStorage.getItem('sen_chat_bubble_disabled') === '1')
    }
    checkSetting()

    const handleSettingChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ enabled?: boolean }>
      if (typeof customEvt.detail?.enabled === 'boolean') {
        setDisabledBySetting(!customEvt.detail.enabled)
      } else {
        checkSetting()
      }
    }

    window.addEventListener('sen-chat-bubble-setting-changed', handleSettingChange)
    return () => {
      window.removeEventListener('sen-chat-bubble-setting-changed', handleSettingChange)
    }
  }, [])

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    const handleToggle = () => setIsOpen((prev) => !prev)
    window.addEventListener('open-sen-chat', handleOpen)
    window.addEventListener('toggle-sen-chat', handleToggle)
    return () => {
      window.removeEventListener('open-sen-chat', handleOpen)
      window.removeEventListener('toggle-sen-chat', handleToggle)
    }
  }, [])

  if (isExcluded || disabledBySetting) return null

  return (
    <>
      {/* CỬA SỔ CHAT MINI (KHI MỞ) - Dynamic lazy-loaded */}
      {isOpen && (
        <SenChatFloatingModal
          messages={messages}
          setMessages={setMessages}
          sessionId={sessionId}
          setSessionId={setSessionId}
          onClose={() => setIsOpen(false)}
        />
      )}

      {/* NÚT SENAI TRÊN DESKTOP: Dạng Capsule Pill chữ "SenAI", thích ứng để tránh che các nút */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Mở SenAI Chat"
          className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-[0_8px_25px_rgba(236,72,153,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20 select-none"
        >
          {isOpen ? (
            <>
              <X className="h-4 w-4 transition group-hover:rotate-90 duration-200" />
              <span className="text-xs font-black uppercase tracking-wider font-sans">Đóng</span>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider font-sans">SenAI</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}
