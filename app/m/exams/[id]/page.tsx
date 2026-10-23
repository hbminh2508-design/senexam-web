'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import {
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  X,
  ListOrdered,
  Send,
  Trophy,
  RotateCcw,
  Home,
  Check,
  HelpCircle,
} from 'lucide-react'

interface QuestionItem {
  id: string
  number: number
  question: string
  type?: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  options?: string[]
  subQuestions?: { id: string; label: string; text: string; correct_answer?: boolean }[]
  correct_answer?: any
  explanation?: string
}

export default function MobileExamPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(50 * 60)
  const [hasStarted, setHasStarted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null)

  // 1. Tải đề thi từ Supabase
  useEffect(() => {
    async function fetchExam() {
      if (!examId) return
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle()

        if (error || !data) {
          alert('Không tìm thấy đề thi hoặc đề thi đã bị xóa!')
          router.replace('/m/sen-ground?tab=exams')
          return
        }

        setExam(data)
        setTimeLeft((data.duration || 50) * 60)

        // Phân giải danh sách câu hỏi từ exam_structure hoặc content
        let flat: QuestionItem[] = []
        if (data.exam_structure && Array.isArray(data.exam_structure)) {
          let qNum = 1
          data.exam_structure.forEach((sec: any) => {
            if (sec.questions && Array.isArray(sec.questions)) {
              sec.questions.forEach((q: any) => {
                flat.push({
                  id: q.id || `q_${qNum}`,
                  number: qNum++,
                  question: q.question || q.content || 'Câu hỏi',
                  type: q.type || sec.type || 'single_choice',
                  options: q.options || ['A', 'B', 'C', 'D'],
                  subQuestions: q.subQuestions || q.sub_questions || [],
                  correct_answer: q.correct_answer || q.answer,
                  explanation: q.explanation,
                })
              })
            }
          })
        }

        // Dự phòng nếu không có cấu trúc câu hỏi
        if (flat.length === 0) {
          const total = data.total_questions || 40
          for (let i = 1; i <= total; i++) {
            flat.push({
              id: `q_${i}`,
              number: i,
              question: `Câu hỏi số ${i}: Chọn đáp án chính xác nhất trong các phương án sau:`,
              type: 'single_choice',
              options: [
                'Phương án A: Giá trị thỏa mãn điều kiện bài toán',
                'Phương án B: Nghiệm của phương trình sai khác một hằng số',
                'Phương án C: Tương quan nghịch biến trên tập xác định',
                'Phương án D: Kết quả không tồn tại trong miền xác định',
              ],
              correct_answer: 'A',
            })
          }
        }

        setQuestions(flat)

        // Khôi phục nháp nếu có trong LocalStorage
        const draft = localStorage.getItem(`m_senexam_draft_${examId}`)
        if (draft) {
          try {
            const parsed = JSON.parse(draft)
            if (parsed.answers) setAnswers(parsed.answers)
            if (parsed.bookmarked) setBookmarked(parsed.bookmarked)
          } catch (e) {
            console.error(e)
          }
        }
      } catch (err) {
        console.error('Error fetching exam:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchExam()
  }, [examId, router])

  // 2. Timer đếm ngược
  useEffect(() => {
    if (!hasStarted || loading || timeLeft <= 0 || result || isSubmitting) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, loading, timeLeft, result, isSubmitting])

  // 3. Tự động lưu tiến độ vào LocalStorage
  useEffect(() => {
    if (!hasStarted || !examId) return
    localStorage.setItem(
      `m_senexam_draft_${examId}`,
      JSON.stringify({ answers, bookmarked, updatedAt: Date.now() })
    )
  }, [answers, bookmarked, hasStarted, examId])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length
  const currentQ = questions[currentIndex]

  // Chọn đáp án trắc nghiệm
  const handleSelectOption = (optIndex: number) => {
    if (!currentQ) return
    const key = `q_${currentQ.number}`
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']
    const choice = letters[optIndex] || String(optIndex)
    setAnswers((prev) => ({ ...prev, [key]: choice }))
  }

  // Chọn đáp án Đúng/Sai
  const handleToggleTrueFalse = (subIndex: number, val: boolean) => {
    if (!currentQ) return
    const key = `q_${currentQ.number}_sub_${subIndex}`
    setAnswers((prev) => ({ ...prev, [key]: val }))
  }

  // Điền đáp án ngắn
  const handleShortAnswerChange = (val: string) => {
    if (!currentQ) return
    const key = `q_${currentQ.number}`
    setAnswers((prev) => ({ ...prev, [key]: val }))
  }

  // Toggle Bookmark
  const toggleBookmark = (qNum: number) => {
    setBookmarked((prev) => ({ ...prev, [qNum]: !prev[qNum] }))
  }

  // Nộp bài và chấm điểm
  const handleSubmitExam = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setShowSubmitConfirm(false)

    try {
      let correct = 0
      questions.forEach((q) => {
        const key = `q_${q.number}`
        const ans = answers[key]
        if (ans && q.correct_answer && String(ans).trim().toUpperCase() === String(q.correct_answer).trim().toUpperCase()) {
          correct++
        }
      })

      const score = questions.length > 0 ? parseFloat(((correct / questions.length) * 10).toFixed(2)) : 0
      setResult({ score, correct, total: questions.length })

      // Lưu vào Supabase submissions
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('submissions').insert({
          exam_id: examId,
          user_id: user.id,
          user_email: user.email,
          answers,
          score,
          correct_count: correct,
          total_questions: questions.length,
          duration_seconds: (exam?.duration || 50) * 60 - timeLeft,
          created_at: new Date().toISOString(),
        })
      }

      // Xóa draft
      localStorage.removeItem(`m_senexam_draft_${examId}`)
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Đang chuẩn bị đề thi cho điện thoại...</p>
      </div>
    )
  }

  // ==========================================
  // MÀN HÌNH CHƯA BẮT ĐẦU (SẴN SÀNG THI)
  // ==========================================
  if (!hasStarted && !result) {
    return (
      <div className="flex-1 flex flex-col justify-between p-5 space-y-6 animate-in fade-in">
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại
          </button>

          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-500/10 text-violet-600 dark:text-violet-400">
              {exam?.exam_type || 'Đề Khảo Thí'}
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {exam?.title}
            </h1>
            <p className="text-xs text-slate-500">
              Môn: <span className="font-bold text-slate-700 dark:text-slate-300">{exam?.subject || 'Tổng hợp'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian làm bài</span>
              <p className="text-lg font-black text-violet-600 dark:text-violet-400">{exam?.duration || 50} phút</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng số câu hỏi</span>
              <p className="text-lg font-black text-sky-600 dark:text-sky-400">{questions.length} câu</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-800 dark:text-violet-300 space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-violet-600" /> Tối ưu trải nghiệm mobile:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90">
              <li>Vuốt hoặc bấm nút để chuyển câu linh hoạt.</li>
              <li>Bảng câu hỏi dạng bottom sheet giúp nhảy câu nhanh.</li>
              <li>Tự động lưu tiến độ làm bài chống mất dữ liệu khi mất mạng.</li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHasStarted(true)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-sm shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
        >
          <span>BẮT ĐẦU LÀM BÀI THI</span>
          <ArrowLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>
    )
  }

  // ==========================================
  // MÀN HÌNH KẾT QUẢ SAU KHI NỘP BÀI
  // ==========================================
  if (result) {
    const isGood = result.score >= 8.0
    const isPass = result.score >= 5.0

    return (
      <div className="flex-1 flex flex-col justify-between p-5 space-y-6 animate-in fade-in text-center">
        <div className="space-y-4 pt-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-xl">
            <Trophy className="h-10 w-10" />
          </div>

          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kết Quả Bài Thi</span>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mt-1">
              {result.score} <span className="text-lg font-bold text-slate-400">/ 10</span>
            </h2>
            <p className={`text-xs font-black uppercase mt-1 ${isGood ? 'text-emerald-500' : isPass ? 'text-amber-500' : 'text-rose-500'}`}>
              {isGood ? '🎉 Xuất Sắc!' : isPass ? '👏 Đạt Yêu Cầu!' : '💪 Cần Cố Gắng Hơn!'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block">Số câu đúng</span>
              <p className="text-base font-black text-emerald-600">{result.correct} / {result.total}</p>
            </div>
            <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
              <span className="text-[10px] text-slate-400 font-bold block">Tỉ lệ chính xác</span>
              <p className="text-base font-black text-violet-600">
                {Math.round((result.correct / result.total) * 100)}%
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <Link
            href="/m/sen-ground?tab=history"
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 active:scale-98 transition"
          >
            <ListOrdered className="h-4 w-4" /> Xem lại lịch sử bài nộp
          </Link>
          <Link
            href="/m"
            className="w-full py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition"
          >
            <Home className="h-4 w-4" /> Về trang chủ mobile
          </Link>
        </div>
      </div>
    )
  }

  // ==========================================
  // GIAO DIỆN LÀM BÀI CHÍNH (THUẦN MOBILE 100%)
  // ==========================================
  return (
    <div className="flex-1 w-full flex flex-col justify-between bg-slate-50 dark:bg-slate-900 select-none pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      {/* 1. STICKY TOPBAR PHÒNG THI */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-black/10 dark:border-white/10 px-3.5 py-2.5 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={() => setShowExitConfirm(true)}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          title="Thoát phòng thi"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ĐỒNG HỒ ĐẾM NGƯỢC */}
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-black ${
          timeLeft <= 180
            ? 'bg-rose-500 text-white animate-pulse'
            : timeLeft <= 600
            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
            : 'bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200'
        }`}>
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        {/* NÚT NỘP BÀI */}
        <button
          type="button"
          onClick={() => setShowSubmitConfirm(true)}
          className="px-3 py-1.5 rounded-xl bg-violet-600 text-white font-black text-xs shadow-xs active:scale-95 transition"
        >
          Nộp bài
        </button>
      </header>

      {/* 2. PROGRESS BAR TIẾN ĐỘ LÀM BÀI */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1">
        <div
          className="bg-violet-600 h-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      {/* 3. KHÔNG GIAN CÂU HỎI HIỆN TẠI */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {currentQ && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header Câu Hỏi */}
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-violet-600 dark:text-violet-400">
                  Câu {currentQ.number}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  / {questions.length} câu
                </span>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-black/5 dark:bg-white/5 text-slate-500">
                  {currentQ.type === 'true_false'
                    ? 'Đúng/Sai'
                    : currentQ.type === 'short_answer'
                    ? 'Điền số'
                    : 'Trắc nghiệm'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleBookmark(currentQ.number)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  bookmarked[currentQ.number]
                    ? 'text-amber-500 bg-amber-500/15'
                    : 'text-slate-300 hover:text-slate-500'
                }`}
                title="Đánh dấu câu hỏi"
              >
                <Bookmark className="h-4 w-4" fill={bookmarked[currentQ.number] ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Nội Dung Câu Hỏi (KaTeX & Markdown Tự Động Co Giãn Mượt Mà) */}
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed overflow-x-auto pb-1">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {currentQ.question}
              </ReactMarkdown>
            </div>

            {/* DANH SÁCH ĐÁP ÁN THEO TỪNG LOẠI CÂU HỎI */}
            {/* LOẠI 1: TRẮC NGHIỆM ĐƠN (SINGLE CHOICE) */}
            {(!currentQ.type || currentQ.type === 'single_choice') && (
              <div className="space-y-2.5 pt-1">
                {(currentQ.options || ['A', 'B', 'C', 'D']).map((optText, oIdx) => {
                  const letters = ['A', 'B', 'C', 'D', 'E', 'F']
                  const letter = letters[oIdx] || String(oIdx + 1)
                  const key = `q_${currentQ.number}`
                  const isSelected = answers[key] === letter

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(oIdx)}
                      className={`w-full min-h-[52px] p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all duration-150 active:scale-98 cursor-pointer ${
                        isSelected
                          ? 'border-violet-600 bg-violet-600/15 dark:bg-violet-600/25 ring-2 ring-violet-600/50 text-slate-900 dark:text-white shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-black/20'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition ${
                          isSelected
                            ? 'bg-violet-600 text-white'
                            : 'bg-black/5 dark:bg-white/5 text-slate-500'
                        }`}
                      >
                        {letter}
                      </span>
                      <div className="flex-1 text-xs font-semibold pt-1 overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {optText}
                        </ReactMarkdown>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* LOẠI 2: ĐÚNG / SAI (TRUE / FALSE) */}
            {currentQ.type === 'true_false' && (
              <div className="space-y-2.5 pt-1">
                {(currentQ.subQuestions?.length
                  ? currentQ.subQuestions
                  : [
                      { id: '1', label: 'a)', text: 'Mệnh đề ý a của bài toán' },
                      { id: '2', label: 'b)', text: 'Mệnh đề ý b của bài toán' },
                      { id: '3', label: 'c)', text: 'Mệnh đề ý c của bài toán' },
                      { id: '4', label: 'd)', text: 'Mệnh đề ý d của bài toán' },
                    ]
                ).map((sub, sIdx) => {
                  const key = `q_${currentQ.number}_sub_${sIdx}`
                  const userVal = answers[key]

                  return (
                    <div
                      key={sub.id || sIdx}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 space-y-2"
                    >
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span className="font-black text-violet-600 mr-1.5">{sub.label}</span>
                        {sub.text}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleTrueFalse(sIdx, true)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                            userVal === true
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          ĐÚNG
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTrueFalse(sIdx, false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                            userVal === false
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          SAI
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* LOẠI 3: ĐIỀN ĐÁP ÁN NGẮN (SHORT ANSWER) */}
            {currentQ.type === 'short_answer' && (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-500 block">
                  Nhập kết quả số hoặc phân số của bạn:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: -2.5 hoặc 3/4..."
                  value={answers[`q_${currentQ.number}`] || ''}
                  onChange={(e) => handleShortAnswerChange(e.target.value)}
                  className="w-full h-12 rounded-2xl border-2 border-violet-500/30 focus:border-violet-600 bg-white dark:bg-slate-800 px-4 text-base font-bold text-slate-900 dark:text-white outline-none shadow-xs"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. FIXED BOTTOM BAR ĐIỀU HƯỚNG CÂU HỎI */}
      <footer className="fixed bottom-0 inset-x-0 z-30 max-w-[480px] mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-black/10 dark:border-white/10 px-3 py-2 flex items-center justify-between gap-2 shadow-lg" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}>
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
          className="flex-1 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-30 active:scale-95 transition cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" /> Câu trước
        </button>

        {/* NÚT MỞ BẢNG CÂU HỎI BOTTOM SHEET */}
        <button
          type="button"
          onClick={() => setShowPalette(true)}
          className="px-3.5 py-2 rounded-xl bg-violet-600/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
        >
          <ListOrdered className="h-4 w-4" />
          <span>{answeredCount}/{questions.length}</span>
        </button>

        <button
          type="button"
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
          className="flex-1 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-30 active:scale-95 transition cursor-pointer"
        >
          Câu sau <ChevronRight className="h-4 w-4" />
        </button>
      </footer>

      {/* 5. BOTTOM SHEET BẢNG CÂU HỎI (QUESTION PALETTE) */}
      {showPalette && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-t-3xl p-5 space-y-4 max-h-[75vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Danh Sách Câu Hỏi ({questions.length})
                </h3>
                <span className="text-[10px] text-slate-400">
                  Đã làm: {answeredCount} • Còn lại: {questions.length - answeredCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPalette(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* LƯỚI MA TRẬN CÂU HỎI */}
            <div className="grid grid-cols-5 gap-2 overflow-y-auto p-1 flex-1">
              {questions.map((q, idx) => {
                const key = `q_${q.number}`
                const isAnswered = Boolean(answers[key] !== undefined || answers[`${key}_sub_0`] !== undefined)
                const isBookmarked = bookmarked[q.number]
                const isCurrent = currentIndex === idx

                return (
                  <button
                    key={q.number}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx)
                      setShowPalette(false)
                    }}
                    className={`h-11 rounded-xl font-mono text-xs font-black relative flex items-center justify-center transition active:scale-95 cursor-pointer ${
                      isCurrent
                        ? 'ring-2 ring-violet-500 scale-105 z-10'
                        : ''
                    } ${
                      isAnswered
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {q.number}
                    {isBookmarked && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowPalette(false)} />
        </div>
      )}

      {/* 6. MODAL XÁC NHẬN THOÁT PHÒNG THI */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 shadow-2xl text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
            <div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Rời khỏi phòng thi?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Tiến độ của bạn sẽ được lưu nháp trên thiết bị này.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Tiếp tục thi
              </button>
              <button
                type="button"
                onClick={() => router.replace('/m/sen-ground?tab=exams')}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-xs"
              >
                Rời khỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL XÁC NHẬN NỘP BÀI */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 shadow-2xl text-center">
            <CheckCircle2 className="h-10 w-10 text-violet-600 mx-auto" />
            <div>
              <h4 className="font-black text-base text-slate-900 dark:text-white">Xác nhận nộp bài?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Bạn đã trả lời <span className="font-bold text-violet-600">{answeredCount}/{questions.length}</span> câu hỏi.
                {questions.length - answeredCount > 0 && (
                  <span className="text-rose-500 block font-bold mt-0.5">
                    Còn {questions.length - answeredCount} câu chưa trả lời!
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-xs"
              >
                Nộp ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
