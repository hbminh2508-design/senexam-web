'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock, PlusCircle, Sparkles, Trash2, Brain } from 'lucide-react'

type QuizQuestion = {
  id: string
  prompt: string
  answer: string
}

type QuizRecord = {
  id: string
  title: string
  subject: string
  description: string
  questions: QuizQuestion[]
  createdAt: string
}

type DailyQuota = {
  date: string
  count: number
}

const DAILY_LIMIT = 10
const QUIZ_STORAGE_KEY = 'sen_quizzle_quizzes_v1'
const QUIZ_QUOTA_KEY = 'sen_quizzle_daily_quota_v1'

const todayKey = () => new Date().toISOString().slice(0, 10)

const readStoredQuizzes = () => {
  if (typeof window === 'undefined') return [] as QuizRecord[]
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QuizRecord[]) : []
  } catch {
    return [] as QuizRecord[]
  }
}

const readQuota = () => {
  if (typeof window === 'undefined') return { date: todayKey(), count: 0 } as DailyQuota
  try {
    const raw = localStorage.getItem(QUIZ_QUOTA_KEY)
    if (!raw) return { date: todayKey(), count: 0 }
    const parsed = JSON.parse(raw) as DailyQuota
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 }
    return parsed
  } catch {
    return { date: todayKey(), count: 0 }
  }
}

const createQuestion = (): QuizQuestion => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  prompt: '',
  answer: ''
})

export default function QuizzlePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([createQuestion()])
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [quota, setQuota] = useState<DailyQuota>({ date: todayKey(), count: 0 })

  useEffect(() => {
    setQuizzes(readStoredQuizzes())
    setQuota(readQuota())
  }, [])

  const remaining = Math.max(DAILY_LIMIT - quota.count, 0)
  const hasValidQuestion = questions.some((question) => question.prompt.trim() && question.answer.trim())
  const canSave = title.trim().length > 0 && hasValidQuestion && remaining > 0

  const updateQuestion = (id: string, field: keyof QuizQuestion, value: string) => {
    setQuestions((current) => current.map((question) => (question.id === id ? { ...question, [field]: value } : question)))
  }

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()])
  }

  const removeQuestion = (id: string) => {
    setQuestions((current) => (current.length <= 1 ? current : current.filter((question) => question.id !== id)))
  }

  const persistQuota = (next: DailyQuota) => {
    setQuota(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUIZ_QUOTA_KEY, JSON.stringify(next))
    }
  }

  const handleSaveQuiz = () => {
    if (quota.count >= DAILY_LIMIT) {
      alert('Hôm nay bạn đã đạt giới hạn 10 quiz. Vui lòng quay lại vào ngày mai.')
      return
    }

    const filteredQuestions = questions.filter((question) => question.prompt.trim() && question.answer.trim())
    if (!title.trim()) {
      alert('Vui lòng nhập tên quiz.')
      return
    }
    if (filteredQuestions.length === 0) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi hợp lệ.')
      return
    }

    const nextQuiz: QuizRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim(),
      questions: filteredQuestions,
      createdAt: new Date().toISOString()
    }

    const nextQuizzes = [nextQuiz, ...quizzes]
    const nextQuota = quota.date === todayKey()
      ? { ...quota, count: quota.count + 1 }
      : { date: todayKey(), count: 1 }

    setQuizzes(nextQuizzes)
    persistQuota(nextQuota)
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(nextQuizzes))
    }

    setTitle('')
    setSubject('')
    setDescription('')
    setQuestions([createQuestion()])
    alert('Quiz đã được lưu thành công.')
  }

  const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="app-shell min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto relative">
        <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Về trang chủ
        </button>
        <div className="absolute -top-20 left-0 w-72 h-72 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-24 right-0 w-80 h-80 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="liquid-panel rounded-[2rem] p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/45 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Quizzle
              </div>
              <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                Tạo quiz riêng cho bạn, gọn như một bảng ôn tập cá nhân.
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Mỗi ngày bạn có thể tạo tối đa 10 quiz. Toàn bộ dữ liệu được lưu trong trình duyệt để học nhanh và quay lại đúng lúc.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Hôm nay</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{quota.count}/10</p>
              </div>
              <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Còn lại</p>
                <p className="text-3xl font-black text-sky-600 dark:text-sky-300">{remaining}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 liquid-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-emerald-500" /> Bộ tạo quiz
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thêm câu hỏi, lưu quiz và theo dõi giới hạn theo ngày.</p>
              </div>
              <button
                onClick={handleSaveQuiz}
                disabled={!canSave}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed shadow-md transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" /> Lưu quiz
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Tên quiz</label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="VD: Sinh học tế bào" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Môn học / chủ đề</label>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="VD: Sinh học 12" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">Mô tả ngắn</label>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Ghi chú mục tiêu ôn tập của bộ quiz này" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Danh sách câu hỏi</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Quiz có thể dùng như flashcard cá nhân.</p>
                </div>
                <button onClick={addQuestion} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold border border-white/60 dark:border-white/10 bg-white/45 dark:bg-slate-900/45 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all">
                  <PlusCircle className="w-4 h-4" /> Thêm câu hỏi
                </button>
              </div>

              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/45 dark:bg-slate-900/35 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="inline-flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-emerald-500" /> Câu {index + 1}
                      </div>
                      <button onClick={() => removeQuestion(question.id)} className="inline-flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-600 disabled:opacity-40" disabled={questions.length <= 1}>
                        <Trash2 className="w-4 h-4" /> Xóa
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Câu hỏi</label>
                        <textarea value={question.prompt} onChange={(event) => updateQuestion(question.id, 'prompt', event.target.value)} rows={4} placeholder="Nhập nội dung câu hỏi..." className="w-full rounded-xl bg-white/60 dark:bg-slate-950/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Đáp án</label>
                        <textarea value={question.answer} onChange={(event) => updateQuestion(question.id, 'answer', event.target.value)} rows={4} placeholder="Ghi đáp án đúng hoặc gợi ý trả lời..." className="w-full rounded-xl bg-white/60 dark:bg-slate-950/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="liquid-panel rounded-[2rem] p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <BookOpen className="w-5 h-5 text-cyan-500" /> Quiz đã lưu
            </div>
            {quizzes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/60 dark:border-slate-700/60 bg-white/35 dark:bg-slate-900/30 p-5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Chưa có quiz nào. Hãy tạo quiz đầu tiên để lưu nhịp ôn tập của bạn.
              </div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1 custom-scrollbar">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="rounded-2xl bg-white/50 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-black text-base text-slate-900 dark:text-white truncate">{quiz.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{quiz.subject || 'Chưa có môn học'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> {quiz.questions.length}
                      </div>
                    </div>
                    {quiz.description && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{quiz.description}</p>}
                    <p className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400">Tạo lúc {formatDate(quiz.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-emerald-200/40 dark:border-emerald-400/20 p-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <ChevronRight className="w-4 h-4 text-emerald-500" /> Mẹo dùng nhanh
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Chia quiz theo từng chương hoặc từng kỹ năng nhỏ để dễ ôn và không vượt quá hạn mức mỗi ngày.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
