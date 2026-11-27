'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { X, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getLocalConversations } from '@/lib/senChatStorage'
import { isAppLockConfigured } from '@/lib/senChatMobileSecurity'
import SenChatQuickMessages from './SenChatQuickMessages'
import type { ChatMessage } from './SenChatFloatingModal'

const SenChatFloatingModal = dynamic(
  () => import('./SenChatFloatingModal'),
  {
    loading: () => (
      <div className="p-4 text-sm flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-pink-500" /> Đang tải Sen Chat...
      </div>
    ),
    ssr: false,
  }
)

export default function SenChatFloatingBubble() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'messages' | 'ai'>('messages')
  const [userId, setUserId] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id || null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const refresh = () => setUnread(userId && !isAppLockConfigured() ? getLocalConversations().reduce((sum, item) => sum + item.unreadCount, 0) : 0)
    refresh()
    window.addEventListener('sen-chat-update', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('sen-chat-update', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [userId])
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

  // 8. Hệ thống FEPN & Bầu Cử độc lập (loại bỏ hoàn toàn các yếu tố SenExam như bong bóng chat SenAI):
  const isFepn = Boolean(
    pathname?.startsWith('/baucu') ||
    pathname?.startsWith('/fepn-') ||
    pathname?.startsWith('/tsv-fepn') ||
    (typeof window !== 'undefined' &&
      (window.location.hostname.includes('fepn.') || window.location.hostname.includes('tsv.fepn.')))
  )

  // 9. Trang Quỹ Lớp ME2 độc lập (loại bỏ hoàn toàn SenAI / Sen Chat):
  const isNopQuyLop = Boolean(
    pathname?.startsWith('/nopquylop') ||
    (typeof window !== 'undefined' && window.location.hostname.includes('nopquylop'))
  )

  const isExamRoom = Boolean(
    (pathname?.startsWith('/new-exams/') && pathname !== '/new-exams') ||
    (pathname?.startsWith('/legacy-exams/') && pathname !== '/legacy-exams') ||
    pathname?.startsWith('/m/exams/') ||
    pathname?.startsWith('/university-exams/') ||
    pathname?.startsWith('/exams/university-exams/') ||
    pathname?.startsWith('/seb-exam')
  )

  const isExcluded = Boolean(
    isFepn ||
    isNopQuyLop ||
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
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/new-sign') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/seb-login') ||
    pathname?.startsWith('/new-reset-password') ||
    pathname?.startsWith('/breathe-u') ||
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/m/chat')
  )

  const [disabledBySetting, setDisabledBySetting] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false)

  // Tu dong kiem tra va an SenAI khi bat ky trang nao dang loading
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkDomLoading = () => {
      const hasLoadingEl = Boolean(document.querySelector('[data-sen-loading="true"]'))
      setIsPageLoading(hasLoadingEl)
    }

    checkDomLoading()

    const handleLoadingEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ isLoading?: boolean }>
      if (typeof customEvt.detail?.isLoading === 'boolean') {
        setIsPageLoading(customEvt.detail.isLoading)
      } else {
        checkDomLoading()
      }
    }

    window.addEventListener('sen-loading-state', handleLoadingEvent)

    const observer = new MutationObserver(() => {
      checkDomLoading()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('sen-loading-state', handleLoadingEvent)
      observer.disconnect()
    }
  }, [pathname])

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
    const handleOpen = () => { setTab('ai'); setIsOpen(true) }
    const handleToggle = () => setIsOpen((prev) => !prev)
    window.addEventListener('open-sen-chat', handleOpen)
    window.addEventListener('toggle-sen-chat', handleToggle)
    return () => {
      window.removeEventListener('open-sen-chat', handleOpen)
      window.removeEventListener('toggle-sen-chat', handleToggle)
    }
  }, [])

  if (isExcluded || disabledBySetting || isPageLoading) return null

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 md:bottom-6 md:right-6">
      {isOpen && <section aria-label="Sen Chat" className="absolute bottom-14 right-0 flex h-[min(31rem,calc(100dvh-10rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <span className="mr-1 text-sm font-bold">Sen Chat</span>
          <button type="button" aria-pressed={tab === 'messages'} onClick={() => setTab('messages')} className="rounded-lg px-2 py-1.5 text-sm aria-pressed:bg-sky-100 aria-pressed:text-sky-800">Tin nhắn</button>
          <button type="button" aria-pressed={tab === 'ai'} onClick={() => setTab('ai')} className="rounded-lg px-2 py-1.5 text-sm aria-pressed:bg-sky-100 aria-pressed:text-sky-800">Sen AI</button>
          <button type="button" aria-label="Đóng Sen Chat" onClick={() => setIsOpen(false)} className="ml-auto rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        {tab === 'messages' ? <SenChatQuickMessages userId={userId} /> : <SenChatFloatingModal messages={messages} setMessages={setMessages}
          sessionId={sessionId} setSessionId={setSessionId} onClose={() => setIsOpen(false)} />}
      </section>}
      <button type="button" aria-label={isOpen ? 'Đóng Sen Chat' : 'Mở Sen Chat'} aria-expanded={isOpen}
        onClick={() => { setTab('messages'); setIsOpen(!isOpen) }}
        className="flex min-h-11 items-center gap-2 rounded-full bg-sky-700 px-4 text-sm font-bold text-white shadow-lg transition hover:bg-sky-800 active:scale-95">
        {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        Sen Chat
        {!isOpen && unread > 0 && <span aria-label={unread + ' tin chưa đọc'} className="rounded-full bg-white px-1.5 text-xs text-sky-800">{unread > 99 ? '99+' : unread}</span>}
      </button>
    </div>
  )
}
