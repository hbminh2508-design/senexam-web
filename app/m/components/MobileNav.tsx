'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import {
  Home,
  Zap,
  BookOpen,
  History,
  Crown,
  Wallet,
  Sparkles,
  Gift,
  User,
  X,
  Send,
  Loader2,
  Bot,
  HelpCircle,
} from 'lucide-react'

// LOGO BIỂU TƯỢNG: NGÔI SAO 4 CẠNH CỦA GEMINI VỚI CHỮ "AI" ĐƯỢC ĐÓNG BÊN TRONG
function StarAiIcon({ className = 'w-5 h-5', active = false }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemini4PointNavGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="45%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      {/* Ngôi sao 4 cánh uốn cong hình tia sáng chuẩn Google Gemini */}
      <path
        d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z"
        fill="url(#gemini4PointNavGradient)"
        filter={active ? 'drop-shadow(0 0 6px rgba(155, 114, 203, 0.6))' : undefined}
      />
      {/* Chữ AI in đậm sắc nét đặt chính giữa ngôi sao */}
      <text
        x="12"
        y="14.4"
        textAnchor="middle"
        fontSize="6.8"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fill="#FFFFFF"
        letterSpacing="-0.3"
      >
        AI
      </text>
    </svg>
  )
}

export default function MobileNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentTab = searchParams?.get('tab')

  // State mở popup SenAI Chat Assistant
  const [showSenAiModal, setShowSenAiModal] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Xin chào! Mình là SenAI 2.0. Bạn cần giải bài toán KaTeX, phân tích đề thi hay giải đáp kiến thức nào hôm nay?',
    },
  ])

  // Không hiển thị thanh điều hướng đáy khi đang trong phòng thi
  const isInsideExam = Boolean(pathname?.includes('/m/exams/'))
  if (isInsideExam) return null

  const isHome = pathname === '/m' || pathname === '/m/'
  const isSenGround = pathname === '/m/sen-ground'
  const isPay = pathname === '/m/pay'
  const isProfile = pathname === '/m/profile'

  const isExams = isSenGround && (currentTab === 'exams' || (!currentTab && !searchParams?.has('library') && !searchParams?.has('history')))
  const isLibrary = isSenGround && (currentTab === 'library' || searchParams?.has('library'))
  const isHistory = isSenGround && (currentTab === 'history' || searchParams?.has('history'))

  const handleSendAi = async (textToSend?: string) => {
    const prompt = (textToSend || aiInput).trim()
    if (!prompt || aiLoading) return

    setAiMessages((prev) => [...prev, { role: 'user', text: prompt }])
    setAiInput('')
    setAiLoading(true)

    try {
      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      })

      const data = await res.json()
      if (data?.text || data?.reply || data?.message) {
        setAiMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.text || data.reply || data.message },
        ])
      } else if (data?.error) {
        setAiMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `⚠️ ${data.error}` },
        ])
      } else {
        setAiMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'SenAI đã nhận được câu hỏi và đang hoàn tất phân tích.' },
        ])
      }
    } catch {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Lỗi kết nối máy chủ SenAI, vui lòng thử lại sau.' },
      ])
    } finally {
      setAiLoading(false)
    }
  }

  // =========================================================================
  // THANH ĐIỀU HƯỚNG GÓC PHẢI CÓ NÚT SENAI HÌNH NGÔI SAO LOGO AI
  // =========================================================================
  const standardNavItems = [
    { label: 'Trang chủ', href: '/m', icon: Home, active: isHome },
    { label: 'Kho đề', href: '/m/sen-ground?tab=exams', icon: Zap, active: isExams },
    { label: 'Thư viện', href: '/m/sen-ground?tab=library', icon: BookOpen, active: isLibrary },
    { label: 'Lịch sử', href: '/m/sen-ground?tab=history', icon: History, active: isHistory },
    { label: 'Cá nhân', href: '/m/profile', icon: User, active: isProfile },
  ]

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-1 py-1 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.4)] select-none"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
      >
        <div className="max-w-md mx-auto flex items-center justify-around">
          {standardNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.active

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-violet-600 dark:text-violet-400 font-black'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-7 h-7 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-violet-600/15 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shadow-xs'
                      : ''
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {isActive && (
                    <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-violet-600 dark:bg-violet-400 animate-pulse" />
                  )}
                </div>
                <span className={`text-[9px] mt-0.5 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* NÚT SENAI Ở GÓC PHẢI NGOÀI CÙNG VỚI LOGO CHỮ AI ĐÓNG TRONG HÌNH SAO */}
          <button
            type="button"
            onClick={() => setShowSenAiModal(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-2xl transition-all duration-200 active:scale-95 text-pink-600 dark:text-pink-400 font-black cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-pink-500/15 to-purple-500/15 text-pink-600 dark:text-pink-400 shadow-xs">
              <StarAiIcon className="w-5 h-5" active={showSenAiModal} />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight font-black">SenAI</span>
          </button>
        </div>
      </nav>

      {/* POPUP TRỢ LÝ SENAI MOBILE (KHI BẤM NÚT SENAI) */}
      {showSenAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in">
          <div className="w-full max-h-[82vh] h-[82vh] rounded-t-3xl bg-white dark:bg-slate-900 border-t border-black/10 dark:border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Header popup SenAI */}
            <div className="p-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
                  <StarAiIcon className="w-5 h-5 text-white" active />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                    <span>SenAI 2.0 Trợ Lý</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white uppercase font-black">Gemini</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Giải toán KaTeX, phân tích đề & mẹo thi</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/m/pay?tab=quota"
                  onClick={() => setShowSenAiModal(false)}
                  className="px-2 py-1 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold text-[10px] hover:bg-pink-500/20 active:scale-95 transition"
                >
                  Nâng Quota
                </Link>
                <button
                  type="button"
                  onClick={() => setShowSenAiModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-black dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Khung tin nhắn */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white shadow-xs rounded-br-xs'
                        : 'bg-black/5 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-black/5 dark:border-white/10 rounded-bl-xs'
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#ef4444' }]]}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-500" />
                  <span>SenAI đang suy nghĩ và phân tích công thức...</span>
                </div>
              )}
            </div>

            {/* Gợi ý nhanh */}
            <div className="px-3 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 border-t border-black/5 dark:border-white/5">
              {[
                'Giải bài toán KaTeX này',
                'Tóm tắt lý thuyết trọng tâm',
                'Công thức tính nhanh ĐGNL',
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSendAi(s)}
                  className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] text-slate-600 dark:text-slate-300 whitespace-nowrap active:scale-95 font-medium"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Ô nhập tin nhắn */}
            <div className="p-3 border-t border-black/10 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-slate-900 shrink-0">
              <input
                type="text"
                placeholder="Hỏi SenAI bất kỳ câu hỏi hoặc công thức toán..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAi()}
                className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs outline-none focus:border-pink-500"
              />
              <button
                type="button"
                disabled={aiLoading || !aiInput.trim()}
                onClick={() => handleSendAi()}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
