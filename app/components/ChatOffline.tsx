'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

const normalizeText = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const generateOfflineAIResponse = (input: string, userName: string) => {
  const normalizedInput = normalizeText(input)

  if (/\b(tai lieu|thu vien|pdf|chuyen de|on tap|sach|giao trinh)\b/.test(normalizedInput)) {
    return `Bạn có thể vào /library để tìm tài liệu nhé, hoặc dùng ô tìm kiếm trên /dashboard nếu muốn tra nhanh theo tên. 📚`
  }

  if (/\b(de thi|thi thu|lam de|kiem tra|hsa|tsa|thptqg|vao thi)\b/.test(normalizedInput)) {
    return `Bạn hãy vào /exams để xem kho đề thi và chọn bài phù hợp. Nếu muốn hỏi thêm, /forum cũng rất hữu ích. ✨`
  }

  if (/\b(forum|cong dong|hoi bai|thao luan|giai dap)\b/.test(normalizedInput)) {
    return `Bạn có thể trao đổi tại /forum. Nếu cần tài liệu kèm theo, mình gợi ý thêm /library nhé. 🌸`
  }

  if (/\b(focus|tap trung|lofi|nhac|hoc tap)\b/.test(normalizedInput)) {
    return `Nếu muốn học tập trung hơn, bạn mở /focus để vào phòng tập trung nhé. 🚀`
  }

  if (/\b(chao|hello|hi|alo|hey)\b/.test(normalizedInput)) {
    return `Chào ${userName || 'bạn'}! 🌸 Mình là SenAI. Bạn muốn tìm tài liệu, đề thi hay đường dẫn tới tính năng nào của web?`
  }

  return 'Mình chưa hiểu rõ ý bạn lắm. Bạn có thể hỏi về tài liệu, đề thi, /library, /exams hoặc /forum để mình chỉ đúng đường dẫn nhé.'
}

const formatMessage = (text: string, role: 'user' | 'model') => {
  const parts = text.split('**')

  return parts.map((part, partIndex) => {
    if (partIndex % 2 === 1) {
      return <strong key={`strong-${partIndex}`}>{part}</strong>
    }

    return part.split(/(\s+)/).map((word, wordIndex) => {
      const routeMatch = word.match(/^((?:\/dashboard|\/library|\/exams|\/forum|\/focus|\/admin))(.*)$/)
      if (routeMatch) {
        return (
          <a
            key={`route-${partIndex}-${wordIndex}`}
            href={routeMatch[1]}
            className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}
          >
            {routeMatch[1]}
            {routeMatch[2]}
          </a>
        )
      }

      if (/^https?:\/\/[^\s]+/.test(word)) {
        return (
          <a
            key={`url-${partIndex}-${wordIndex}`}
            href={word}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}
          >
            {word}
          </a>
        )
      }

      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(word)) {
        return (
          <a
            key={`mail-${partIndex}-${wordIndex}`}
            href={`mailto:${word}`}
            className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'}`}
          >
            {word}
          </a>
        )
      }

      return <span key={`text-${partIndex}-${wordIndex}`}>{word}</span>
    })
  })
}

export default function ChatOffline({ userName, avoid, hidden }: { userName: string, avoid?: boolean, hidden?: boolean }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Chào bạn! 🌸 Mình là SenAI - trợ lý học tập của SenExam. Bạn muốn tìm tài liệu, đề thi hay đường dẫn tới tính năng nào của web?' }
  ])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isChatLoading])

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    const nextHistory: ChatMessage[] = [...chatMessages, { role: 'user', text: userMessage }]
    setChatMessages(nextHistory)
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: chatMessages,
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
        setChatMessages([...nextHistory, { role: 'model', text: data.text }])
        return
      }

      const errorText = typeof data?.error === 'string' ? data.error : ''
      const shouldUseOfflineFallback =
        response.status === 429 ||
        response.status === 403 ||
        response.status === 401 ||
        /permission denied|access denied|denied access|resource exhausted|too many requests/i.test(errorText)

      if (shouldUseOfflineFallback) {
        const fallback = generateOfflineAIResponse(userMessage, userName)
        setChatMessages([...nextHistory, { role: 'model', text: fallback }])
        return
      }

      const message = errorText || 'Không thể gọi Gemini ngay lúc này.'
      setChatMessages([...nextHistory, { role: 'model', text: `Mình chưa lấy được phản hồi từ Gemini: ${message}` }])
    } catch {
      setChatMessages([...nextHistory, { role: 'model', text: 'Mình chưa kết nối được tới Gemini lúc này. Bạn thử lại sau nhé.' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  if (hidden) return null

  return (
    <div className={`fixed bottom-6 z-[100] flex flex-col items-end ${avoid ? 'right-6 lg:right-[28rem]' : 'right-6'}`}>
      {isChatOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[550px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">SenAI ✨</h3>
                <p className="text-[11px] text-blue-100 font-medium">Gemini ưu tiên, offline dự phòng khi quá lượt</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-transparent" ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-[14px] font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none'}`}>
                  {formatMessage(msg.text, msg.role)}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">SenAI đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Hỏi SenAI (tài liệu, đề thi, đường dẫn web)..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-4 pr-12 py-3 text-[14px] font-medium outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full transition-transform active:scale-95 shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.4)] text-white font-black transition-all duration-300 hover:scale-105 active:scale-95 ${isChatOpen ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}
      >
        {isChatOpen ? <X className="w-6 h-6" /> : (
          <>
            <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
            SenAI
          </>
        )}
      </button>
    </div>
  )
}