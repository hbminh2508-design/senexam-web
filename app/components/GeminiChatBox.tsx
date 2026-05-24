'use client'

import { useState } from 'react'
import { Bot, Loader2, Send, Sparkles } from 'lucide-react'

const QUICK_PROMPTS = [
  'Tóm tắt ngắn gọn nội dung học tập hôm nay cho tôi.',
  'Gợi ý cách ôn thi hiệu quả trong 30 phút.',
  'Giải thích một khái niệm khó theo kiểu dễ hiểu.',
]

export default function GeminiChatBox() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAskAI = async () => {
    if (!prompt.trim() || loading) return

    setLoading(true)
    setError('')
    setResponse('')

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Không thể gọi Gemini vào lúc này.')
      }

      setResponse(typeof data?.text === 'string' && data.text.trim() ? data.text : 'Gemini chưa trả về nội dung văn bản.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ API.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="lg:col-span-6 rounded-2xl border border-white/60 dark:border-slate-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.22)] overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_32%)] pointer-events-none" />
      <div className="relative z-10 p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-md">
              <Bot className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/80 font-black">Gemini Route Handler</p>
              <h3 className="text-xl md:text-2xl font-black text-white">Trợ lý AI trực tiếp trên dashboard</h3>
              <p className="text-sm text-slate-300 mt-1">Gọi qua /api/gemini để giữ API key ở server.</p>
            </div>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[11px] font-bold text-cyan-100">
            <Sparkles className="w-3.5 h-3.5" /> Free tier ready
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="px-3 py-2 rounded-full text-xs font-bold bg-white/8 hover:bg-white/14 border border-white/10 text-slate-100 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Nhập câu hỏi cho Gemini..."
            className="w-full rounded-2xl bg-white/95 text-slate-900 placeholder:text-slate-400 border border-white/30 outline-none px-4 py-3 shadow-inner focus:ring-2 focus:ring-cyan-400/50"
          />

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-xs text-slate-300">
              Nếu quá tải, API sẽ trả về 429 và hiển thị thông báo thân thiện.
            </p>
            <button
              type="button"
              onClick={handleAskAI}
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Gemini đang suy nghĩ...' : 'Gửi câu hỏi'}
            </button>
          </div>
        </div>

        {(error || response) && (
          <div className="rounded-2xl border border-white/10 bg-white/8 backdrop-blur-md p-4 text-sm leading-relaxed whitespace-pre-wrap">
            <div className="text-[11px] uppercase tracking-[0.24em] font-black text-cyan-200 mb-2">Kết quả</div>
            {error ? <p className="text-rose-200 font-medium">{error}</p> : <p className="text-slate-100">{response}</p>}
          </div>
        )}
      </div>
    </section>
  )
}