'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, X, Maximize2, Minimize2, Zap, Settings2 } from 'lucide-react'

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

// ============================================================================
// LÕI XỬ LÝ OFFLINE (CƠ BẢN) - KHÔNG CẦN INTERNET
// ============================================================================
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
  
  if (/\b(tinh diem|diem thi|xet tuyen|dai hoc|diem uu tien)\b/.test(normalizedInput)) {
    return `Bạn có thể quy đổi và xem tính điểm xét tuyển Đại Học/Bách Khoa tại /tinhdiem nhé! 🎓`
  }

  if (/\b(chao|hello|hi|alo|hey)\b/.test(normalizedInput)) {
    return `Chào ${userName || 'bạn'}! 🌸 Mình là SenAI (Chế độ Cơ bản). Mình được thiết kế để điều hướng nhanh các link trên hệ thống. Nếu muốn giải bài tập, bạn hãy chuyển sang chế độ Nâng cao nhé!`
  }

  return 'Ở chế độ Cơ bản, mình chỉ được trang bị kiến thức điều hướng web. Bạn có thể hỏi về tài liệu, đề thi, /library, /exams hoặc /forum. Bật chế độ Nâng cao (Gemini) để hỏi bài tập nhé!'
}

// ============================================================================
// RENDERER MARKDOWN & ROUTE LINK
// ============================================================================
const formatMessage = (text: string, role: 'user' | 'model') => {
  // Tách text theo markdown in đậm (**)
  const parts = text.split('**')

  return parts.map((part, partIndex) => {
    if (partIndex % 2 === 1) {
      return <strong key={`strong-${partIndex}`} className="font-extrabold">{part}</strong>
    }

    // Tách theo khoảng trắng để tìm route hoặc URL
    return part.split(/(\s+)/).map((word, wordIndex) => {
      const routeMatch = word.match(/^((?:\/dashboard|\/library|\/exams|\/forum|\/focus|\/admin|\/tinhdiem))(.*)$/)
      
      if (routeMatch) {
        return (
          <a
            key={`route-${partIndex}-${wordIndex}`}
            href={routeMatch[1]}
            className={`font-black underline decoration-2 underline-offset-4 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200 decoration-white/50' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 decoration-indigo-300 dark:decoration-indigo-600/50'}`}
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
            className={`font-bold underline underline-offset-4 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300'}`}
          >
            {word}
          </a>
        )
      }

      return <span key={`text-${partIndex}-${wordIndex}`}>{word}</span>
    })
  })
}

// ============================================================================
// MAIN COMPONENT CHAT OFFLINE + ONLINE (GEMINI)
// ============================================================================

export default function ChatOffline({ userName, avoid, hidden }: { userName: string, avoid?: boolean, hidden?: boolean }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOnlineMode, setIsOnlineMode] = useState(true) // True = Gemini, False = Offline Logic
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: `Chào ${userName || 'bạn'}! 🌸 Mình là SenAI. Mình có thể giải toán, phân tích lý hóa hoặc tìm đường dẫn web cho bạn. Bạn cần hỗ trợ gì nào?` }
  ])
  
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Cuộn tự động khi có tin nhắn mới
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isChatLoading, isChatOpen, isFullscreen])

  // Xử lý gửi tin nhắn
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    const nextHistory: ChatMessage[] = [...chatMessages, { role: 'user', text: userMessage }]
    setChatMessages(nextHistory)
    setIsChatLoading(true)

    // 1. Nếu đang bật chế độ Cơ bản (Offline)
    if (!isOnlineMode) {
      setTimeout(() => {
        const fallbackResponse = generateOfflineAIResponse(userMessage, userName)
        setChatMessages([...nextHistory, { role: 'model', text: fallbackResponse }])
        setIsChatLoading(false)
      }, 600) // Tạo độ trễ giả lập AI đang gõ
      return
    }

    // 2. Nếu đang bật chế độ Nâng cao (Gemini API)
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

      // Thành công
      if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
        setChatMessages([...nextHistory, { role: 'model', text: data.text }])
        return
      }

      // Xử lý lỗi API (Quá tải, hết tiền, lỗi server) => Tự động Fallback sang Offline
      const errorText = typeof data?.error === 'string' ? data.error : ''
      const shouldUseOfflineFallback =
        response.status === 429 || response.status === 403 || response.status === 401 || response.status === 500 ||
        /permission denied|access denied|resource exhausted|too many requests/i.test(errorText)

      if (shouldUseOfflineFallback) {
        const fallback = generateOfflineAIResponse(userMessage, userName)
        setChatMessages([...nextHistory, { 
          role: 'model', 
          text: `⚠️ Mình đang mất kết nối tới máy chủ tư duy (Quá tải). Đây là câu trả lời từ hệ thống dự phòng: \n\n${fallback}` 
        }])
        return
      }

      setChatMessages([...nextHistory, { role: 'model', text: `Mình chưa lấy được phản hồi: ${errorText || 'Lỗi không xác định.'}` }])
    
    } catch {
      setChatMessages([...nextHistory, { role: 'model', text: 'Mạng có vẻ yếu hoặc bị đứt kết nối. Bạn hãy thử chuyển sang chế độ "Cơ bản" trên góc phải xem sao nhé!' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Chuyển đổi trạng thái đóng/mở chat
  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen)
    if (isFullscreen) setIsFullscreen(false) // Đóng chat thì reset luôn fullscreen
  }

  if (hidden) return null

  // Render Classes
  const chatContainerBase = "bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-slate-200/60 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300"
  
  // Kích thước linh hoạt theo chế độ Fullscreen
  const chatSizeClasses = isFullscreen 
    ? "fixed inset-4 sm:inset-6 md:inset-10 lg:inset-x-32 lg:inset-y-12 z-[150] rounded-[2rem]" 
    : `mb-4 w-[360px] sm:w-[420px] h-[600px] max-h-[80vh] rounded-3xl z-[100] ${avoid ? 'lg:mr-[28rem]' : ''}`

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex flex-col items-end ${isFullscreen ? 'w-full h-full pointer-events-none' : ''}`}>
      
      {isChatOpen && (
        <div className={`${chatContainerBase} ${chatSizeClasses} pointer-events-auto`}>
          
          {/* HEADER CHAT BOT */}
          <div className={`px-5 py-4 flex items-center justify-between shadow-sm z-10 transition-colors duration-500 ${isOnlineMode ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-gradient-to-r from-slate-700 to-slate-600 dark:from-slate-800 dark:to-slate-900'}`}>
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner">
                {isOnlineMode ? <Sparkles className="w-5 h-5 text-yellow-300" /> : <Bot className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-black text-[15px] leading-tight flex items-center gap-1.5">
                  SenAI {isOnlineMode ? 'Nâng cao' : 'Cơ bản'} 
                  {isOnlineMode && <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300"/>}
                </h3>
                <p className="text-[11px] text-white/80 font-medium truncate max-w-[160px] sm:max-w-[200px]">
                  {isOnlineMode ? 'Hỗ trợ giải toán, hỏi đáp AI' : 'Điều hướng & tra cứu cục bộ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Nút Toggle Switch Đổi Chế Độ AI / Offline */}
              <div 
                className="hidden sm:flex items-center gap-1.5 bg-white/10 border border-white/20 p-1 rounded-full mr-2 cursor-pointer"
                onClick={() => setIsOnlineMode(!isOnlineMode)}
                title={isOnlineMode ? "Chuyển sang chế độ Offline" : "Kích hoạt Gemini AI"}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${!isOnlineMode ? 'bg-white text-slate-800 shadow-sm' : 'text-white/70'}`}><Bot className="w-3.5 h-3.5"/></div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isOnlineMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/70'}`}><Sparkles className="w-3.5 h-3.5"/></div>
              </div>

              {/* Nút Fullscreen */}
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              {/* Nút Đóng */}
              <button onClick={handleToggleChat} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* VÙNG HIỂN THỊ TIN NHẮN */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/50 dark:bg-transparent" ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm ${isOnlineMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {isOnlineMode ? <Sparkles className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                
                <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[14.5px] font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-[#1E1E1E] border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                  {formatMessage(msg.text, msg.role)}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start items-end">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 shadow-sm ${isOnlineMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'}`}>
                  {isOnlineMode ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200/60 dark:border-white/5 px-5 py-3.5 rounded-[1.5rem] rounded-bl-sm shadow-sm flex items-center gap-2.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                  </span>
                  <span className="text-[13px] text-slate-500 font-bold italic block ml-1">Sen đang gõ...</span>
                </div>
              </div>
            )}
          </div>

          {/* THANH CÔNG CỤ NHẬP LIỆU */}
          <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-slate-100 dark:border-white/5">
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-3 relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isOnlineMode ? "Hỏi bài toán, giải thích kiến thức..." : "Tìm đề thi, tài liệu..."}
                className="flex-1 bg-slate-100 dark:bg-[#252525] border border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 rounded-full pl-5 pr-14 py-3.5 text-sm font-semibold outline-none transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className={`absolute right-2 p-2.5 rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50 disabled:shadow-none ${isOnlineMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-700 hover:bg-slate-800 text-white'}`}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            
            {/* Thông báo chế độ Mobile */}
            <div className="sm:hidden mt-3 flex justify-between items-center px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Settings2 className="w-3 h-3"/> Đổi Engine
              </span>
              <div 
                className="flex items-center gap-1 bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-white/5 p-0.5 rounded-full cursor-pointer"
                onClick={() => setIsOnlineMode(!isOnlineMode)}
              >
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${!isOnlineMode ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400'}`}>Cơ Bản</div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${isOnlineMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>Nâng Cao</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON (FAB) KÍCH HOẠT CHAT */}
      <button
        onClick={handleToggleChat}
        className={`pointer-events-auto flex items-center justify-center gap-2.5 px-6 py-4 rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] text-white font-black transition-all duration-300 hover:scale-105 active:scale-95 z-[100] border border-white/20
          ${isChatOpen 
            ? 'bg-slate-800 hover:bg-slate-700 shadow-none' 
            : isOnlineMode 
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500' 
              : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
          }`}
      >
        {isChatOpen ? <X className="w-6 h-6" /> : (
          <>
            {isOnlineMode ? <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" /> : <Bot className="w-5 h-5"/>}
            SenAI
          </>
        )}
      </button>

    </div>
  )
}