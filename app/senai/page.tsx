'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, Bot, Send, Sparkles, X, Sun, Moon, 
  Paperclip, Image as ImageIcon, Trash2, Menu, Plus, 
  MessageSquare, Loader2, FileText
} from 'lucide-react'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================
type ChatImage = {
  url: string
  base64: string
  mimeType: string
}

type ChatMessage = {
  role: 'user' | 'model'
  text: string
  images?: ChatImage[]
}

type ChatSession = {
  id: string
  title: string
  date: string
}

const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border border-slate-200 dark:border-white/5 shadow-sm"

export default function SenAIFullScreenPage() {
  const router = useRouter()
  
  // -- States UI --
  const [isDark, setIsDark] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [userName, setUserName] = useState('')
  
  // -- States Chat --
  const [input, setInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<ChatImage[]>([])
  
  // Lịch sử hiện tại
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'model', 
      text: 'Chào bạn! 🌸 Mình là **SenAI Mở Rộng**. Không gian này được thiết kế để chúng ta có thể thảo luận sâu hơn. Bạn có thể gửi ảnh bài tập, tài liệu hoặc hỏi mình bất cứ điều gì nhé!' 
    }
  ])

  // Lịch sử các phiên chat (Mock data - Sếp có thể lưu vào Supabase sau)
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([
    { id: '1', title: 'Giải phương trình Logarit', date: 'Hôm nay' },
    { id: '2', title: 'Phân tích nhân vật Tràng', date: 'Hôm qua' },
    { id: '3', title: 'Công thức Vật lí 12', date: 'Tuần trước' },
  ])

  const chatScrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ============================================================================
  // INITIALIZATION & EFFECTS
  // ============================================================================
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profile?.full_name) setUserName(profile.full_name)
    }
    fetchUser()

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true); document.documentElement.classList.add('dark')
    }

    // Auto đóng sidebar trên mobile
    if (window.innerWidth < 1024) setIsSidebarOpen(false)
  }, [router])

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isChatLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert('SenAI hiện tại chỉ hỗ trợ định dạng ảnh (JPG, PNG, WEBP).')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64String = event.target?.result as string
        const base64Data = base64String.split(',')[1] // Cắt bỏ phần tiền tố data:image/png;base64,
        
        setSelectedImages(prev => [...prev, {
          url: URL.createObjectURL(file),
          base64: base64Data,
          mimeType: file.type
        }])
      }
      reader.readAsDataURL(file)
    })
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!input.trim() && selectedImages.length === 0) || isChatLoading) return

    const userText = input.trim()
    const userImages = [...selectedImages]
    
    setInput('')
    setSelectedImages([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: userText, images: userImages }]
    setMessages(nextHistory)
    setIsChatLoading(true)

    try {
      // 🌟 NGỮ CẢNH HỆ THỐNG
      const systemContext = `THÔNG TIN CỐT LÕI VỀ HỆ THỐNG:
      - Tên hệ thống: SenExam V2.0 - Trợ lý AI Mở rộng.
      - Tác giả & Nhà phát triển (Boss): Hoàng Bình Minh (25/08/2000, sinh viên UET). Đam mê AI, Web, Embedded Systems, thích F1, Matcha Latte.
      - Tên người dùng đang trò chuyện: ${userName || 'Học sinh'}.
      - Ký hiệu: Sử dụng dấu chấm "." cho phép nhân, dấu phẩy "," cho số thập phân.
      - NẾU CÓ ẢNH KÈM THEO: Hãy phân tích kỹ nội dung trong ảnh (đề bài, công thức) để giải đáp chi tiết nhất.`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: messages,
          images: userImages.map(img => ({ mimeType: img.mimeType, base64: img.base64 })), // Gửi ảnh lên API
          context: systemContext
        }),
      })

      const data = await response.json().catch(() => null)

      if (response.ok && data.text) {
        setMessages([...nextHistory, { role: 'model', text: data.text }])
      } else {
        throw new Error(data?.error || 'Lỗi xử lý từ hệ thống AI')
      }
    } catch (error) {
      setMessages([...nextHistory, { role: 'model', text: '⚠️ Xin lỗi bạn, SenAI đang gặp sự cố kết nối hoặc máy chủ đang quá tải. Bạn hãy thử lại sau ít phút nhé!' }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Format phím Enter để gửi, Shift+Enter để xuống dòng
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Format Markdown Text
  const formatMessageText = (text: string) => {
    const parts = text.split('**')
    return parts.map((part, index) => {
      if (index % 2 === 1) return <strong key={index} className="font-extrabold text-indigo-600 dark:text-indigo-400">{part}</strong>
      
      // Highlight link
      return part.split(/(\s+)/).map((word, wIndex) => {
        if (/^https?:\/\/[^\s]+/.test(word)) {
          return <a key={wIndex} href={word} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 font-bold text-indigo-500 hover:text-indigo-700">{word}</a>
        }
        return <span key={wIndex}>{word}</span>
      })
    })
  }

  // ============================================================================
  // RENDER UI
  // ============================================================================
  return (
    <div className="h-screen w-full flex bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative transition-colors duration-500">
      
      {/* Nền Ambient */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/5 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 🌟 SIDEBAR (LỊCH SỬ TRÒ CHUYỆN) */}
      <div className={`h-full shrink-0 flex flex-col bg-white/60 dark:bg-[#121212]/60 backdrop-blur-2xl border-r border-slate-200 dark:border-white/5 transition-all duration-300 z-30 ${isSidebarOpen ? 'w-[280px] lg:w-[320px] translate-x-0' : 'w-0 -translate-x-full border-none opacity-0'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight">SenAI Workspace</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trợ lý toàn năng</p>
          </div>
        </div>

        <div className="p-4">
          <button 
            onClick={() => setMessages([{ role: 'model', text: 'Chào bạn! Mình đã sẵn sàng cho một cuộc trò chuyện mới. 🚀' }])}
            className="w-full flex items-center gap-2 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 py-3 rounded-2xl font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5"/> Đoạn chat mới
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Lịch sử trò chuyện</p>
          {chatHistory.map(chat => (
            <div key={chat.id} className="flex flex-col gap-1 p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-[#2A2A2A] cursor-pointer transition-colors border border-transparent hover:border-slate-300 dark:hover:border-white/10 group">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                <MessageSquare className="w-4 h-4 shrink-0"/>
                <span className="truncate">{chat.title}</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400 ml-6">{chat.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 🌟 MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full relative z-20 overflow-hidden min-w-0">
        
        {/* Header Chat */}
        <header className="h-[76px] px-4 lg:px-8 flex items-center justify-between bg-white/70 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors text-slate-600 dark:text-slate-300 hidden lg:block">
              <Menu className="w-5 h-5"/>
            </button>
            <button onClick={() => router.push('/dashboard')} className="p-2.5 rounded-full bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5">
              <ArrowLeft className="w-5 h-5"/>
            </button>
            <h1 className="font-extrabold text-slate-800 dark:text-white ml-2 hidden sm:block">Phiên tư vấn cùng SenAI</h1>
          </div>
          
          <button onClick={toggleTheme} className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 bg-slate-100 dark:bg-[#202020]">
            {isDark ? <Sun className="w-5 h-5 text-amber-400"/> : <Moon className="w-5 h-5"/>}
          </button>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-6 custom-scrollbar" ref={chatScrollRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {msg.role === 'model' && (
                  <div className="w-10 h-10 rounded-[12px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-4 shadow-sm border border-indigo-100 dark:border-indigo-500/20 mt-1">
                    <Bot className="w-5 h-5"/>
                  </div>
                )}

                <div className={`max-w-[85%] lg:max-w-[75%] flex flex-col gap-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  
                  {/* Hiển thị ảnh nếu User có đính kèm */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mb-1">
                      {msg.images.map((img, i) => (
                        <div key={i} className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-500/50 shadow-md">
                          <img src={img.url} alt="Uploaded" className="w-full h-full object-cover"/>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.text && (
                    <div className={`px-6 py-4 rounded-[1.5rem] text-[15px] font-medium leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.text.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-2" : ""}>{formatMessageText(line)}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start items-end">
                <div className="w-10 h-10 rounded-[12px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mr-4 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
                  <Sparkles className="w-5 h-5 animate-pulse text-yellow-500"/>
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-white/5 px-6 py-4 rounded-[1.5rem] rounded-bl-sm shadow-sm flex items-center gap-3">
                  <span className="flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                  </span>
                  <span className="text-sm text-slate-500 font-bold italic">SenAI đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A] shrink-0">
          <div className="max-w-4xl mx-auto">
            
            {/* Image Preview Dock */}
            {selectedImages.length > 0 && (
              <div className="flex items-center gap-3 mb-4 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-white/5 w-fit shadow-sm overflow-x-auto max-w-full">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 group">
                    <img src={img.url} alt="Preview" className="w-full h-full object-cover"/>
                    <button 
                      onClick={() => removeImage(index)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5 text-white"/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form 
              onSubmit={handleSendMessage} 
              className="relative flex items-end gap-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-[2rem] p-2 shadow-lg focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:ring-4 ring-indigo-500/10 transition-all"
            >
              {/* File Input */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*" 
                multiple 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 transition-colors shrink-0 m-1"
                title="Đính kèm ảnh bài tập"
              >
                <ImageIcon className="w-6 h-6"/>
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi SenAI (Nhấn Shift + Enter để xuống dòng)..."
                className="flex-1 bg-transparent border-none outline-none resize-none py-4 px-2 max-h-[150px] custom-scrollbar text-sm md:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                rows={1}
              />

              <button
                type="submit"
                disabled={(!input.trim() && selectedImages.length === 0) || isChatLoading}
                className="p-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-[#252525] disabled:text-slate-400 text-white rounded-full transition-transform active:scale-95 shadow-md shrink-0 m-1"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </form>
            <p className="text-center text-[11px] font-bold text-slate-400 mt-4">
              SenAI có thể mắc lỗi. Vui lòng kiểm tra lại các thông tin quan trọng.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}