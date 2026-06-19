'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Bot, Send, Sparkles, Sun, Moon, Database, 
  Code, Eye, Save, AlertCircle, Loader2, CheckCircle2, FileJson, Copy
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border border-slate-200 dark:border-white/5 shadow-sm"

type ChatMessage = {
  role: 'user' | 'model'
  text: string
  codeSnippet?: string 
}

export default function UpdateDataPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  
  const [aiChatInput, setAiChatInput] = useState('')
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([{ 
    role: 'model', 
    text: 'Chào Sếp! Để đảm bảo tính chính xác nhất, sếp hãy **Copy toàn bộ bảng điểm chuẩn** từ web (Tuyensinh247) và dán vào đây. Em sẽ tự động nội suy, nhận diện tên trường, khối thi và lọc thành cấu trúc JSON chuẩn mực nhé!' 
  }])
  const [isAiLoading, setIsAiLoading] = useState(false)
  
  const [currentGeneratedCode, setCurrentGeneratedCode] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setIsDark(theme === 'dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const nextTheme = !isDark ? 'dark' : 'light'
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    localStorage.setItem('theme', nextTheme)
  }

  // Tự động cuộn chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [aiMessages, isAiLoading])

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiChatInput.trim() || isAiLoading) return

    const userText = aiChatInput.trim()
    setAiChatInput('')
    
    const newHistory: ChatMessage[] = [...aiMessages, { role: 'user', text: userText }]
    setAiMessages(newHistory)
    setIsAiLoading(true)

    try {
      const systemContext = `Bạn là SenAI, hệ thống bóc tách dữ liệu điểm chuẩn đại học.
      Nhiệm vụ: Người dùng sẽ cung cấp một đoạn văn bản/bảng dữ liệu sao chép từ trang tuyển sinh. Bạn hãy phân tích và chuyển nó thành MẢNG JSON theo ĐÚNG cấu trúc sau (nằm trong block \`\`\`json \`\`\`):
      
      [
        {
          "group": "Tên Nhóm Ngành (Ví dụ: Công nghệ - Kỹ thuật, Kinh tế...)",
          "universities": [
            {
              "code": "Mã Trường (VD: BKA)",
              "name": "Tên Trường đầy đủ",
              "scale": 30,
              "majors": [
                {
                  "major_code": "Mã ngành (nếu có)",
                  "major_name": "Tên ngành học",
                  "blocks": ["A00", "A01", "D01"],
                  "score_2025": 28.5
                }
              ]
            }
          ]
        }
      ]
      
      Lưu ý: 
      - Chỉ in ra mảng JSON, phải đảm bảo JSON hợp lệ (không lỗi dấu phẩy cuối dòng).
      - Phần score_2025 phải là định dạng số thập phân (Ví dụ: 25.5 chứ không phải 25,5). Dùng dấu chấm "." cho thập phân ở JSON.`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: aiMessages, context: systemContext }),
      })

      const data = await response.json()
      if (response.ok && data.text) {
        const jsonMatch = data.text.match(/```json([\s\S]*?)```/)
        const codeSnippet = jsonMatch ? jsonMatch[1].trim() : null
        
        if (codeSnippet) {
          setCurrentGeneratedCode(codeSnippet)
        }

        setAiMessages([...newHistory, { role: 'model', text: data.text.replace(/```json[\s\S]*?```/, '[Đã xuất mã JSON Dữ liệu. Xem ở Panel bên phải]').trim(), codeSnippet }])
      } else { throw new Error('Lỗi AI') }
    } catch (error) {
      setAiMessages([...newHistory, { role: 'model', text: '⚠️ Mất kết nối tới SenAI Engine.' }])
    } finally {
      setIsAiLoading(false)
    }
  }

  // LƯU DỮ LIỆU VÀO FILE diemchuan.json
  const handleSaveToDatabase = async () => {
    if (!currentGeneratedCode) return
    setIsSaving(true)

    try {
      // Xác thực JSON trước khi gửi
      const parsedData = JSON.parse(currentGeneratedCode)

      const response = await fetch('/api/update-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newData: parsedData }),
      })

      const result = await response.json()
      if (response.ok) {
        alert("Thành công: " + result.message)
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      alert("Lỗi khi đồng bộ dữ liệu: " + (error.message || "Kiểm tra lại format JSON"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative overflow-hidden pb-10">
      
      {/* Ambient Nền */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-emerald-500/5 dark:from-indigo-900/20 dark:to-emerald-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <header className="h-[76px] px-6 lg:px-10 flex items-center justify-between bg-white/70 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="p-2.5 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] rounded-full transition-all group active:scale-95 shadow-inner">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform"/>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Database className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-slate-900 dark:text-white">Cập nhật Dữ Liệu Data</h1>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Merge tự động vào diemchuan.json</span>
            </div>
          </div>
        </div>

        <button onClick={toggleTheme} className="p-3 rounded-full bg-slate-100 dark:bg-[#202020] text-slate-700 dark:text-slate-300 hover:scale-105 transition-transform border border-slate-200/50 dark:border-white/5">
          {isDark ? <Sun className="w-4 h-4 text-amber-400"/> : <Moon className="w-4 h-4 text-indigo-600"/>}
        </button>
      </header>

      <main className="max-w-[1500px] mx-auto p-4 md:p-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
          
          {/* CỘT TRÁI: SENAI CHAT BÓC TÁCH */}
          <div className={`${mdCard} flex flex-col overflow-hidden`}>
            <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center gap-3 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="w-10 h-10 rounded-[12px] bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <Bot className="w-6 h-6 text-emerald-600 dark:text-emerald-400"/>
              </div>
              <div>
                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">Data Scraper AI <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500"/></h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tự động cấu trúc hóa dữ liệu</p>
              </div>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mr-3 mt-1 shadow-sm border border-emerald-400/20">
                      <Bot className="w-4 h-4"/>
                    </div>
                  )}
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.2rem] text-[14px] font-medium leading-relaxed shadow-sm overflow-x-auto ${msg.role === 'user' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-sm' : 'bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    
                    {msg.codeSnippet && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Format thành công</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start items-end">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 mr-3 shadow-sm border border-emerald-400/20"><Sparkles className="w-4 h-4 animate-pulse text-yellow-500"/></div>
                  <div className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-white/5 px-5 py-3.5 rounded-[1.2rem] rounded-bl-sm shadow-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-slate-500"/><span className="text-[12px] text-slate-500 font-bold">Đang lọc và chuẩn hóa dữ liệu...</span></div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#121212] border-t border-slate-200 dark:border-white/5 shrink-0">
              <form onSubmit={handleSendAiMessage} className="relative flex items-end gap-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-1.5 focus-within:border-emerald-400/50 shadow-sm transition-all">
                <textarea
                  value={aiChatInput} onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSendAiMessage(e as any) } }}
                  placeholder="Dán nội dung (hoặc bảng điểm) copy từ web vào đây (Shift + Enter để xuống dòng)..."
                  className="flex-1 bg-transparent border-none outline-none resize-none py-3 px-4 max-h-[200px] custom-scrollbar text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                  rows={2}
                />
                <button type="submit" disabled={!aiChatInput.trim() || isAiLoading} className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-[#252525] disabled:text-slate-400 text-white rounded-full transition-transform active:scale-95 shadow-md shrink-0 m-1">
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
              <p className="text-[10px] text-slate-400 text-center mt-3 italic font-bold">*Mẹo: Copy nguyên cả bảng chứa mã ngành, tên ngành, tổ hợp và điểm rồi dán thẳng vào.</p>
            </div>
          </div>

          {/* CỘT PHẢI: PREVIEW JSON & LƯU FILE */}
          <div className={`${mdCard} flex flex-col overflow-hidden`}>
            <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#121212] shrink-0">
              <div className="flex items-center gap-2 bg-white dark:bg-[#2A2A2A] px-4 py-2 rounded-lg text-xs font-black text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent">
                <Code className="w-4 h-4"/> Dữ liệu JSON Trích xuất
              </div>
              
              <button 
                onClick={handleSaveToDatabase}
                disabled={!currentGeneratedCode || isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-transform active:scale-95 flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4"/>} 
                Đồng bộ vào File Local
              </button>
            </div>

            <div className="flex-1 p-5 bg-slate-100/50 dark:bg-[#121212]/50 relative">
              <textarea 
                value={currentGeneratedCode || ''} 
                onChange={(e) => setCurrentGeneratedCode(e.target.value)}
                placeholder="Mã JSON sẽ hiển thị ở đây. Sếp có thể tự do chỉnh sửa trước khi lưu..."
                className="w-full h-full bg-slate-900 text-emerald-400 font-mono p-5 rounded-2xl outline-none text-[13px] focus:ring-2 focus:ring-emerald-500 shadow-inner leading-relaxed custom-scrollbar"
              />
              
              {/* Nút copy nhanh */}
              {currentGeneratedCode && (
                <button 
                  onClick={() => {navigator.clipboard.writeText(currentGeneratedCode); alert("Đã copy JSON!")}}
                  className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-md transition-colors" title="Copy mã JSON"
                >
                  <Copy className="w-4 h-4"/>
                </button>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}