'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, X, Maximize2, Minimize2, Zap, Settings2, MessageSquareHeart } from 'lucide-react'

// 🌟 THƯ VIỆN RENDER MARKDOWN & CÔNG THỨC TOÁN HỌC (LATEX)
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { supabase } from '@/lib/supabaseClient'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'

const FEEDBACK_PREFIX_RE = /^feedback\s*:\s*(.+)$/i

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

// Hàm chuẩn hóa tiếng Việt không dấu để AI Offline dễ bắt từ khóa
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
// LÕI XỬ LÝ OFFLINE TỐI ƯU HÓA (SMART FALLBACK ĐÃ CHUẨN HÓA MARKDOWN)
// ============================================================================
const generateOfflineAIResponse = (input: string, userName: string) => {
  const normalizedInput = normalizeText(input)
  const isBoss = userName && normalizeText(userName).includes('minh')

  // 1. Logic nhận diện tác giả & hệ thống
  if (/\b(tac gia|ai tao ra|nguoi tao|phat trien|dev|founder|cha de|hoang binh minh|boss)\b/.test(normalizedInput)) {
    if (isBoss) {
      return `Haha, sếp đang test em đấy à? 😆 Hệ thống SenExam V2.0 này do chính sếp (**Hoàng Bình Minh** - UET) tạo ra chứ ai vào đây nữa! Đam mê từ code web đến robot AuraServe, sếp đỉnh quá rồi. Cần em hỗ trợ điều hướng đi đâu không ạ? 🚀`
    }
    return `Nền tảng SenExam V2.0 này được thiết kế và phát triển độc lập bởi **Hoàng Bình Minh**. Anh ấy là một sinh viên tài năng xuất thân từ Đại học Công nghệ - ĐHQGHN (UET) với đam mê mãnh liệt về AI, Web và cả hệ thống nhúng (Embedded Systems). Minh tạo ra mình (SenAI) để giúp các bạn học tập tốt hơn đó! 🚀`
  }

  // 2. Logic Smart Search - Tự động tạo link tìm kiếm thư viện
  const searchMatch = normalizedInput.match(/tim (sach|tai lieu|de thi|chuyen de|bai tap) (.*)/)
  if (searchMatch && searchMatch[2]) {
    const query = encodeURIComponent(searchMatch[2].trim())
    return `Mình đã tìm thấy một số kết quả trong kho lưu trữ cho từ khóa "${searchMatch[2].trim()}". Bạn nhấn vào đây để mở Thư viện số nhé: **[Mở Thư Viện](/library?search=${query})** 📚`
  }

  // 3. Logic điều hướng chức năng cốt lõi (Sử dụng chuẩn Markdown Link)
  if (/\b(tai lieu|thu vien|pdf|chuyen de|on tap|sach|giao trinh)\b/.test(normalizedInput)) {
    return `Bạn có thể vào **[Thư viện số](/library)** để khám phá toàn bộ tài liệu nhé, hoặc gõ "tìm sách [tên sách]" để mình dẫn link trực tiếp cho. 📚`
  }

  if (/\b(de thi|thi thu|lam de|kiem tra|hsa|tsa|thptqg|vao thi)\b/.test(normalizedInput)) {
    return `Bạn hãy vào **[Kho đề thi](/exams)** để xem đề thi chuyên sâu và đánh giá năng lực bản thân nhé. ✨`
  }

  if (/\b(forum|cong dong|hoi bai|thao luan|giai dap)\b/.test(normalizedInput)) {
    return `Khu vực trao đổi học thuật nằm ở **[Cộng đồng](/forum)**. Bạn có thể đăng câu hỏi để mọi người cùng giải đáp nha. 🌸`
  }

  if (/\b(focus|tap trung|lofi|nhac|hoc tap|pomodoro)\b/.test(normalizedInput)) {
    return `Mở **[Phòng Tập Trung](/focus)** để vào không gian Pomodoro tĩnh tâm học tập cùng nhạc Lo-fi nhé. 🚀`
  }
  
  if (/\b(tinh diem|diem thi|xet tuyen|dai hoc|diem uu tien|bach khoa)\b/.test(normalizedInput)) {
    return `Bạn cần quy đổi điểm thi THPTQG hay Bách Khoa? Truy cập ngay công cụ **[Tính điểm Đại học](/tinhdiem)** để hệ thống tính toán chuẩn xác nhất! 🎓`
  }

  // 4. Lời chào cá nhân hóa
  if (/\b(chao|hello|hi|alo|hey)\b/.test(normalizedInput)) {
    if (isBoss) return `Dạ em chào sếp Minh! 👋 Hôm nay sếp muốn vừa uống Matcha Latte vừa nâng cấp tính năng gì cho hệ thống ạ?`
    return `Chào ${userName || 'bạn'}! 🌸 Mình là SenAI (Chế độ Cơ bản). Mình biết rất rõ về thư viện và hệ thống của SenExam do anh Hoàng Bình Minh phát triển. Gõ "tìm sách [tên sách]" để thử tính năng nhé!`
  }

  return 'Ở chế độ Cơ bản, mình được tối ưu để tra cứu hệ thống nội bộ. Bạn có thể gõ "tìm sách [tên]" hoặc bật **Chế độ Nâng cao (Gemini)** trên góc phải để nhờ mình giải bài tập phức tạp nhé!'
}

// ============================================================================
// MAIN COMPONENT CHAT OFFLINE + ONLINE (GEMINI)
// ============================================================================

export default function ChatOffline({ userName, avoid, hidden }: { userName: string, avoid?: boolean, hidden?: boolean }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOnlineMode, setIsOnlineMode] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  
  const isBoss = userName && normalizeText(userName).includes('minh')
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      role: 'model', 
      text: isBoss 
        ? `Chào Boss Hoàng Bình Minh! 🌸 Trợ lý SenAI đã sẵn sàng. Sếp muốn tra cứu hệ thống hay dùng Gemini để giải quyết vấn đề gì hôm nay ạ?` 
        : `Chào ${userName || 'bạn'}! 🌸 Mình là SenAI. Bạn muốn giải toán, tìm hiểu hệ thống hay tìm tài liệu nào (VD: "Tìm sách Toán 12")?` 
    }
  ])
  
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
  }, [])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isChatLoading, isChatOpen, isFullscreen])

  // 🌟 GỬI FEEDBACK QUA CHAT: gõ "Feedback: nội dung" ở cả 2 chế độ, không gọi AI, lưu thẳng vào Supabase
  const handleSendFeedback = async (content: string) => {
    setIsChatLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id ?? null,
        content,
        mode: isOnlineMode ? 'advanced' : 'basic',
      })
      if (error) throw error
      setChatMessages(prev => [...prev, { role: 'model', text: 'Đã ghi nhận phản hồi của bạn, cảm ơn bạn đã góp ý! Đội ngũ SenExam sẽ xem xét sớm.' }])
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'model', text: `Không gửi được phản hồi lúc này (${err?.message || 'lỗi kết nối'}). Bạn thử lại sau nhé.` }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    const nextHistory: ChatMessage[] = [...chatMessages, { role: 'user', text: userMessage }]
    setChatMessages(nextHistory)

    // 0. Phím nóng "Feedback: ..." — chặn trước, không gửi lên AI
    const feedbackMatch = userMessage.match(FEEDBACK_PREFIX_RE)
    if (feedbackMatch && feedbackMatch[1].trim()) {
      handleSendFeedback(feedbackMatch[1].trim())
      return
    }

    setIsChatLoading(true)

    // 1. Chế độ Cơ bản (Offline)
    if (!isOnlineMode) {
      setTimeout(() => {
        const fallbackResponse = generateOfflineAIResponse(userMessage, userName)
        setChatMessages([...nextHistory, { role: 'model', text: fallbackResponse }])
        setIsChatLoading(false)
      }, 500)
      return
    }

    // 2. Chế độ Nâng cao (Gemini API)
    try {
      // 🌟 ĐÓNG GÓI NGỮ CẢNH HỆ THỐNG VÀ TÁC GIẢ ĐỂ AI HIỂU BIẾT HƠN
      const systemContext = `THÔNG TIN CỐT LÕI VỀ HỆ THỐNG (Tuyệt đối tuân thủ):
      - Tên hệ thống: SenExam V2.0 - Nền tảng luyện thi thông minh.
      - Tác giả & Nhà phát triển (Creator/Boss): Hoàng Bình Minh (Sinh ngày 25/08/2000), sinh viên xuất sắc của Đại học Công nghệ - ĐHQGHN (UET). Minh đam mê lập trình (Next.js, Python), phát triển robot (AuraServe), thích giải trí với F1, anime (Jujutsu Kaisen, Zelda) và hay uống Matcha Latte, Hibiscus tea.
      - Tên người dùng đang trò chuyện: ${userName || 'Học sinh'}.
      - Bạn là bản Beta đang được thử nghiệm, đang cải thiện dần theo phản hồi người dùng.

      QUY TẮC GIAO TIẾP VÀ HÀNH VI:
      1. Kính trọng Tác giả: Nếu người dùng có tên là "Minh" hoặc "Hoàng Bình Minh" (hoặc tự nhận là tác giả), hãy nhận diện đây là người tạo ra hệ thống và giữ thái độ tôn trọng, nhưng không cần tâng bốc quá đà.
      2. Ký hiệu Toán học / Vật Lí: Tuyệt đối tuân thủ tiêu chuẩn Việt Nam: Phải sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân (Ví dụ: 9,8 . 10). LUÔN BỌC CÔNG THỨC TOÁN HỌC TRONG DẤU $ HOẶC $$.
      3. Liên kết Thư viện: Nếu người dùng nhờ tìm kiếm sách/đề thi, hãy trả lời bằng đường dẫn định dạng: /library?search=<từ_khóa> (Ví dụ: /library?search=toán+12).
      4. Điều hướng: Các module hiện có: Thi thử (/exams), Tính điểm Đại học (/tinhdiem), Phòng học tập trung (/focus), Diễn đàn (/forum).
      5. Phong cách trả lời: Ưu tiên chính xác và hữu ích hơn là làm hài lòng người hỏi. Đi thẳng vào trọng tâm, không dùng ngôn từ sến súa/sáo rỗng, không lạm dụng emoji hay câu cảm thán. Nếu không chắc chắn, nói rõ thay vì bịa. Chủ động gợi ý bước tiếp theo hữu ích khi phù hợp (ví dụ: link tài liệu liên quan, module nên dùng).`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: chatMessages,
          context: systemContext // Truyền Context lên API
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
        setChatMessages([...nextHistory, { role: 'model', text: data.text }])
        return
      }

      const errorText = typeof data?.error === 'string' ? data.error : ''
      const shouldUseOfflineFallback =
        response.status === 429 || response.status === 403 || response.status === 401 || response.status === 500 ||
        /permission denied|access denied|resource exhausted|too many requests|503/i.test(errorText)

      if (shouldUseOfflineFallback) {
        const fallback = generateOfflineAIResponse(userMessage, userName)
        setChatMessages([...nextHistory, { 
          role: 'model', 
          text: `⚠️ Mình đang mất kết nối tới Gemini API. Đây là câu trả lời từ hệ thống dự phòng: \n\n${fallback}` 
        }])
        return
      }

      setChatMessages([...nextHistory, { role: 'model', text: `Mình chưa lấy được phản hồi: ${errorText || 'Lỗi không xác định.'}` }])
    
    } catch {
      setChatMessages([...nextHistory, { role: 'model', text: 'Mạng bị đứt kết nối. Hãy thử chuyển sang chế độ "Cơ bản" để mình giúp tra cứu nhé!' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen)
    if (isFullscreen) setIsFullscreen(false)
  }

  if (hidden) return null

  const modernVars = getModernThemeVars(themeColor, isDark)

  const chatContainerBase = newUiEnabled
    ? "shadow-xl flex flex-col overflow-hidden animate-in fade-in duration-300"
    : "bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-slate-200/60 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-300"

  const chatSizeClasses = isFullscreen
    ? "fixed inset-4 sm:inset-6 md:inset-10 lg:inset-x-32 lg:inset-y-12 z-[150] rounded-[2rem]"
    : `mb-4 w-[360px] sm:w-[420px] h-[600px] max-h-[80vh] rounded-3xl z-[100] ${avoid ? 'lg:mr-[28rem]' : ''}`

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex flex-col items-end ${isFullscreen ? 'w-full h-full pointer-events-none' : ''}`}
      style={newUiEnabled ? (modernVars as React.CSSProperties) : undefined}
    >

      {isChatOpen && (
        <div className={`${chatContainerBase} ${chatSizeClasses} pointer-events-auto`} style={newUiEnabled ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined}>

          <div
            className={newUiEnabled ? "px-5 py-4 flex items-center justify-between z-10" : `px-5 py-4 flex items-center justify-between shadow-sm z-10 transition-colors duration-500 ${isOnlineMode ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-gradient-to-r from-slate-700 to-slate-600 dark:from-slate-800 dark:to-slate-900'}`}
            style={newUiEnabled ? { background: 'var(--surface)', borderBottom: '1px solid var(--border)' } : undefined}
          >
            <div className={`flex items-center gap-3 ${newUiEnabled ? '' : 'text-white'}`} style={newUiEnabled ? { color: 'var(--text)' } : undefined}>
              <div
                className={newUiEnabled ? "w-10 h-10 rounded-2xl flex items-center justify-center" : "w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner"}
                style={newUiEnabled ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
              >
                {isOnlineMode ? <Sparkles className="w-5 h-5" style={newUiEnabled ? undefined : { color: '#FDE047' }} /> : <Bot className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-black text-[15px] leading-tight flex items-center gap-1.5">
                  SenAI {isOnlineMode ? 'Nâng cao' : 'Cơ bản'}
                  {isOnlineMode && <Zap className="w-3.5 h-3.5" style={{ color: newUiEnabled ? 'var(--accent)' : '#FDE047' }} fill={newUiEnabled ? 'var(--accent)' : '#FDE047'}/>}
                  <span
                    className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest"
                    style={newUiEnabled ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'rgba(255,255,255,0.2)' }}
                  >Beta</span>
                </h3>
                <p className={`text-[11px] font-medium truncate max-w-[160px] sm:max-w-[200px] ${newUiEnabled ? '' : 'text-white/80'}`} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>
                  {isOnlineMode ? 'Hỏi đáp AI & Tìm thư viện' : 'Điều hướng & Giới thiệu Tác giả'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div
                className={newUiEnabled ? "hidden sm:flex items-center gap-1.5 p-1 rounded-full mr-2 cursor-pointer" : "hidden sm:flex items-center gap-1.5 bg-white/10 border border-white/20 p-1 rounded-full mr-2 cursor-pointer"}
                style={newUiEnabled ? { background: 'var(--accent-soft)' } : undefined}
                onClick={() => setIsOnlineMode(!isOnlineMode)}
                title={isOnlineMode ? "Chuyển sang chế độ Offline" : "Kích hoạt Gemini AI"}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${!isOnlineMode ? (newUiEnabled ? 'shadow-sm' : 'bg-white text-slate-800 shadow-sm') : (newUiEnabled ? '' : 'text-white/70')}`} style={newUiEnabled ? (!isOnlineMode ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }) : undefined}><Bot className="w-3.5 h-3.5"/></div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isOnlineMode ? (newUiEnabled ? 'shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (newUiEnabled ? '' : 'text-white/70')}`} style={newUiEnabled ? (isOnlineMode ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }) : undefined}><Sparkles className="w-3.5 h-3.5"/></div>
              </div>

              <button onClick={() => setIsFullscreen(!isFullscreen)} className={newUiEnabled ? "p-2 rounded-xl transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]" : "p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button onClick={handleToggleChat} className={newUiEnabled ? "p-2 rounded-xl transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]" : "p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className={newUiEnabled ? "flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar" : "flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/50 dark:bg-transparent"} style={newUiEnabled ? { background: 'var(--bg)' } : undefined} ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm ${newUiEnabled ? '' : (isOnlineMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}`}
                    style={newUiEnabled ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                  >
                    {isOnlineMode ? <Sparkles className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}

                <div
                  className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[14.5px] font-medium leading-relaxed shadow-sm overflow-x-auto ${newUiEnabled ? (msg.role === 'user' ? 'text-white rounded-br-sm' : 'rounded-bl-sm') : (msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-[#1E1E1E] border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm')}`}
                  style={newUiEnabled ? (msg.role === 'user' ? { background: 'var(--accent)' } : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }) : undefined}
                >
                  {/* 🌟 SỬ DỤNG BỘ RENDER MARKDOWN TẠI ĐÂY */}
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({node, ...props}) => <strong className={`font-extrabold ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...props} />,
                      a: ({node, ...props}) => (
                        <a 
                          className={`underline underline-offset-4 font-bold ${msg.role === 'user' ? 'text-white hover:text-blue-200' : 'text-indigo-500 hover:text-indigo-700'}`} 
                          target={props.href?.startsWith('http') ? '_blank' : '_self'} 
                          rel={props.href?.startsWith('http') ? 'noopener noreferrer' : ''} 
                          {...props} 
                        />
                      ),
                      ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-xl font-black mb-2 mt-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-black mb-2 mt-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-2" {...props} />,
                      code: ({node, inline, ...props}: any) => 
                        inline 
                          ? <code className={`px-1.5 py-0.5 rounded-md text-[13px] font-mono ${msg.role === 'user' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400'}`} {...props} />
                          : <div className="bg-slate-800 text-slate-100 p-3 rounded-xl my-2 overflow-x-auto"><code className="font-mono text-[13px]" {...props} /></div>
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start items-end">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 shadow-sm ${newUiEnabled ? '' : (isOnlineMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-600')}`}
                  style={newUiEnabled ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                >
                  {isOnlineMode ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={newUiEnabled ? "px-5 py-3.5 rounded-[1.5rem] rounded-bl-sm shadow-sm flex items-center gap-2.5" : "bg-white dark:bg-[#1E1E1E] border border-slate-200/60 dark:border-white/5 px-5 py-3.5 rounded-[1.5rem] rounded-bl-sm shadow-sm flex items-center gap-2.5"} style={newUiEnabled ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined}>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: newUiEnabled ? 'var(--accent)' : '#818cf8' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{animationDelay: '0.2s', background: newUiEnabled ? 'var(--accent)' : '#6366f1'}}></span>
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{animationDelay: '0.4s', background: newUiEnabled ? 'var(--accent)' : '#4f46e5'}}></span>
                  </span>
                  <span className={`text-[13px] font-bold italic block ml-1 ${newUiEnabled ? '' : 'text-slate-500'}`} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>Sen đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>

          <div className={newUiEnabled ? "p-4" : "p-4 bg-white dark:bg-[#1A1A1A] border-t border-slate-100 dark:border-white/5"} style={newUiEnabled ? { background: 'var(--surface)', borderTop: '1px solid var(--border)' } : undefined}>
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-3 relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isOnlineMode ? "Hỏi bài toán, tra tài liệu... (gõ Feedback: để góp ý)" : "Tìm đề thi, tài liệu, hỏi tác giả..."}
                className={newUiEnabled ? "flex-1 rounded-full pl-5 pr-14 py-3.5 text-sm font-semibold outline-none transition-all bg-transparent" : "flex-1 bg-slate-100 dark:bg-[#252525] border border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 rounded-full pl-5 pr-14 py-3.5 text-sm font-semibold outline-none transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"}
                style={newUiEnabled ? { border: '1px solid var(--border)', color: 'var(--text)' } : undefined}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className={`absolute right-2 p-2.5 rounded-full transition-transform active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50 disabled:shadow-none ${newUiEnabled ? 'text-white' : (isOnlineMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-700 hover:bg-slate-800 text-white')}`}
                style={newUiEnabled ? { background: 'var(--accent)' } : undefined}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>

            <div className="mt-2.5 flex items-center gap-1.5 px-1">
              <MessageSquareHeart className="w-3 h-3 shrink-0" style={{ color: newUiEnabled ? 'var(--text-muted)' : '#94a3b8' }} />
              <span className="text-[10px] font-medium" style={{ color: newUiEnabled ? 'var(--text-muted)' : '#94a3b8' }}>Gõ <strong>Feedback: nội dung</strong> để gửi góp ý trực tiếp cho đội ngũ SenExam</span>
            </div>

            <div className="sm:hidden mt-3 flex justify-between items-center px-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${newUiEnabled ? '' : 'text-slate-400'}`} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>
                <Settings2 className="w-3 h-3"/> Đổi Engine
              </span>
              <div
                className={newUiEnabled ? "flex items-center gap-1 p-0.5 rounded-full cursor-pointer" : "flex items-center gap-1 bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-white/5 p-0.5 rounded-full cursor-pointer"}
                style={newUiEnabled ? { border: '1px solid var(--border)' } : undefined}
                onClick={() => setIsOnlineMode(!isOnlineMode)}
              >
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${!isOnlineMode ? (newUiEnabled ? 'shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm') : (newUiEnabled ? '' : 'text-slate-400')}`} style={newUiEnabled ? (!isOnlineMode ? { background: 'var(--bg)', color: 'var(--text)' } : { color: 'var(--text-muted)' }) : undefined}>Cơ Bản</div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${isOnlineMode ? (newUiEnabled ? 'text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm') : (newUiEnabled ? '' : 'text-slate-400')}`} style={newUiEnabled ? (isOnlineMode ? { background: 'var(--accent)' } : { color: 'var(--text-muted)' }) : undefined}>Nâng Cao</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleToggleChat}
        className={`pointer-events-auto flex items-center justify-center gap-2.5 px-6 py-4 rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] text-white font-black transition-all duration-300 hover:scale-105 active:scale-95 z-[100] border border-white/20
          ${isChatOpen
            ? 'bg-slate-800 hover:bg-slate-700 shadow-none'
            : newUiEnabled
              ? ''
              : isOnlineMode
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500'
                : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
          }`}
        style={!isChatOpen && newUiEnabled ? { background: 'var(--accent)' } : undefined}
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