'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  globalBackButtonDispatcher,
  setupVirtualKeyboardHelper,
  isExamPath,
} from '@/lib/capacitorBridge'

export default function CapacitorManager() {
  const pathname = usePathname()
  const router = useRouter()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showExamExitModal, setShowExamExitModal] = useState(false)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 1. Kích hoạt tự cuộn viewport khi bàn phím ảo bật lên
    const cleanupKeyboard = setupVirtualKeyboardHelper()

    // 2. Lắng nghe nút Back phần cứng của Capacitor Android qua bridge runtime
    let cleanupAppListener: (() => void) | null = null

    const handleBackTrigger = () => {
      // 0. Ưu tiên xử lý từ custom handler được đăng ký từ màn hình hiện thời (nếu có)
      const isCustomHandled = (globalBackButtonDispatcher as any).triggerCustomHandler?.()
      if (isCustomHandled) return

      const hasChatOpen = Boolean(
        typeof window !== 'undefined' && (window as any)?.__senChatHasOpenConversation
      )
      const hasChatModal = Boolean(
        typeof window !== 'undefined' && (window as any)?.__senChatHasOpenModal
      )

      const result = globalBackButtonDispatcher.handleBackPress({
        currentPath: pathname || '',
        hasOpenChatConversation: hasChatOpen,
        hasOpenModal: hasChatModal,
      } as any)

      if (result.action === 'close_chat_conversation') {
        // Gửi sự kiện cho màn hình chat mobile để thoát hội thoại / đóng modal về danh sách
        window.dispatchEvent(new CustomEvent('senchat:back-pressed'))
      } else if (result.action === 'confirm_exam_exit') {
        setShowExamExitModal(true)
      } else if (result.action === 'prompt_exit_toast') {
        setToastMessage(result.message)
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000)
      } else if (result.action === 'exit_app') {
        const appPlugin = (window as any)?.Capacitor?.Plugins?.App
        if (appPlugin?.exitApp) {
          appPlugin.exitApp()
        }
      } else if (result.action === 'navigate_back') {
        router.back()
      }
    }

    try {
      const cap = (window as any)?.Capacitor
      const appPlugin = cap?.Plugins?.App
      if (appPlugin && typeof appPlugin.addListener === 'function') {
        const listenerPromise = appPlugin.addListener('backButton', handleBackTrigger)
        cleanupAppListener = () => {
          if (listenerPromise?.then) {
            listenerPromise.then((handle: any) => handle?.remove?.())
          }
        }
      }
    } catch {
      // Môi trường không có Capacitor native bridge
    }

    return () => {
      cleanupKeyboard()
      if (cleanupAppListener) cleanupAppListener()
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [pathname, router])

  return (
    <>
      {/* Toast thông báo bấm 2 lần để thoát */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/90 text-white text-xs font-bold rounded-full shadow-lg border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 text-center pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Hộp thoại xác nhận thoát khi đang trong phòng thi */}
      {showExamExitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xl">
              ⚠️
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Bạn có chắc muốn thoát?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bài thi sẽ được hệ thống nộp tự động với các câu bạn đã hoàn thành.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExamExitModal(false)}
                className="py-2.5 px-3 rounded-xl border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition"
              >
                Ở lại tiếp tục
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExamExitModal(false)
                  // Gửi sự kiện cho trang thi kích hoạt nộp bài tự động
                  window.dispatchEvent(new CustomEvent('senexam:auto-submit-and-exit'))
                  router.push('/m/sen-ground?tab=history')
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md active:scale-95 transition"
              >
                Nộp & Thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
