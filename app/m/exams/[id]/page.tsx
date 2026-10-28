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
import ModernLoading from '@/app/components/ModernLoading'
import { normalizeLatexQuestion, parseLatexExamCode, preprocessLatexContent } from '@/lib/latexExamParser'
import HsaExamRoom from '@/app/components/HsaExamRoom'
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
  FileText,
  ExternalLink,
  Zap,
  Shuffle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

interface QuestionItem {
  id: string
  number: number
  question: string
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  options: string[]
  subQuestions?: { id: string; label: string; text: string; correct_answer?: boolean }[]
  correct_answer?: any
  explanation?: string
}

function SafeMathRenderer({ content, className }: { content: string; className?: string }) {
  const rawStr = typeof content === 'string' ? content : String(content ?? '')
  const safeContent = preprocessLatexContent(rawStr)

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#ef4444', strict: false }]]}
        components={{
          img: ({ node, ...props }) => (
            <span className="block my-2 text-center">
              <img
                {...props}
                alt={props.alt || 'Hình minh họa câu hỏi'}
                className="max-h-[300px] max-w-full rounded-xl border border-slate-200 dark:border-white/10 shadow-sm mx-auto object-contain cursor-zoom-in hover:shadow-md transition bg-white"
                onClick={() => {
                  if (props.src) window.open(props.src, '_blank')
                }}
              />
              {props.alt && props.alt !== 'Hình minh họa câu hỏi' && (
                <span className="block text-[10px] text-slate-400 italic mt-0.5 font-sans">
                  {props.alt}
                </span>
              )}
            </span>
          ),
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
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

  // Chế độ Luyện tập vs Khảo thí & Đảo đề
  const [isStudyMode, setIsStudyMode] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
  const [shuffleQuestionsEnabled, setShuffleQuestionsEnabled] = useState(false)
  const [shuffleOptionsEnabled, setShuffleOptionsEnabled] = useState(false)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [studentUser, setStudentUser] = useState<any>(null)

  // Tải đề thi từ Supabase
  useEffect(() => {
    async function fetchExam() {
      if (!examId) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace(`/m/login?returnUrl=/m/exams/${examId}`)
          return
        }
        setStudentUser(user)

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

        // Phân tích cấu trúc câu hỏi
        let struct = data.exam_structure
        if (typeof struct === 'string') {
          try {
            struct = JSON.parse(struct)
          } catch {
            struct = []
          }
        }
        if (!Array.isArray(struct) && struct && typeof struct === 'object' && Array.isArray(struct.sections)) {
          struct = struct.sections
        }

        let flat: QuestionItem[] = []
        let qNum = 1

        if (Array.isArray(struct) && struct.length > 0) {
          struct.forEach((sec: any) => {
            if (sec && Array.isArray(sec.questions) && sec.questions.length > 0) {
              sec.questions.forEach((rawQ: any) => {
                const q = normalizeLatexQuestion(rawQ)
                const qText = q?.text || q?.question || q?.content || q?.prompt || `Câu hỏi số ${qNum}`
                const qType = q?.type || sec.type || 'single_choice'
                const opts = Array.isArray(q?.options) && q.options.length > 0 ? q.options : ['A', 'B', 'C', 'D']

                flat.push({
                  id: q?.id || `q_${qNum}`,
                  number: qNum++,
                  question: qText,
                  type: qType,
                  options: opts,
                  subQuestions: q?.subQuestions || q?.sub_questions || [],
                  correct_answer: q?.correctAnswer || q?.correct_answer || q?.answer || 'A',
                  explanation: q?.explanation || q?.solution || '',
                })
              })
            } else if (sec && parseInt(sec.questionCount) > 0) {
              const count = parseInt(sec.questionCount)
              for (let i = 0; i < count; i++) {
                flat.push({
                  id: `q_${qNum}`,
                  number: qNum++,
                  question: `Câu hỏi số ${qNum - 1}`,
                  type: sec.type || 'single_choice',
                  options: ['A', 'B', 'C', 'D'],
                  correct_answer: sec.correctAnswers?.[i] || 'A',
                })
              }
            }
          })
        }

        if (flat.length === 0 && data.content && typeof data.content === 'string') {
          try {
            const parsed = parseLatexExamCode(data.content)
            if (parsed.questions && parsed.questions.length > 0) {
              parsed.questions.forEach((pq) => {
                flat.push({
                  id: pq.id || `q_${qNum}`,
                  number: qNum++,
                  question: pq.text,
                  type: pq.type,
                  options: pq.options,
                  correct_answer: pq.correctAnswer || 'A',
                  explanation: pq.solution || '',
                })
              })
            }
          } catch (e) {
            console.warn('Lỗi parse raw LaTeX content:', e)
          }
        }

        if (flat.length === 0) {
          const totalQ = data.total_questions || 40
          for (let i = 1; i <= totalQ; i++) {
            flat.push({
              id: `q_${i}`,
              number: i,
              question: `Câu hỏi số ${i}`,
              type: 'single_choice',
              options: ['A', 'B', 'C', 'D'],
              correct_answer: 'A',
            })
          }
        }

        setQuestions(flat)

        // Khôi phục bài làm từ localStorage
        const savedAns = localStorage.getItem(`m_exam_ans_${examId}`)
        if (savedAns) {
          try {
            setAnswers(JSON.parse(savedAns))
          } catch {}
        }
      } catch (err) {
        console.error('Lỗi nạp đề thi:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchExam()
  }, [examId, router])

  // Timer đếm ngược
  useEffect(() => {
    if (!hasStarted || result || isReviewMode) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, result, isReviewMode])

  // Lưu tiến độ làm bài
  const handleSelectOption = (qKey: string, val: any) => {
    if (isReviewMode) return
    setAnswers((prev) => {
      const next = { ...prev, [qKey]: val }
      localStorage.setItem(`m_exam_ans_${examId}`, JSON.stringify(next))
      return next
    })
  }

  // Nộp bài thi
  const handleSubmitExam = async () => {
    setShowSubmitConfirm(false)
    setIsSubmitting(true)

    let correctCount = 0
    questions.forEach((q) => {
      const studentAns = answers[`q_${q.number}`]
      const actualCorrect = String(q.correct_answer || 'A').trim().toUpperCase()
      if (studentAns && String(studentAns).trim().toUpperCase() === actualCorrect) {
        correctCount++
      }
    })

    const total = questions.length || 1
    const rawScore = (correctCount / total) * 10
    const finalScore = parseFloat(rawScore.toFixed(2))

    setResult({ score: finalScore, correct: correctCount, total })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('submissions').insert([
          {
            exam_id: examId,
            user_id: user.id,
            score: finalScore,
            correct_count: correctCount,
            total_questions: total,
            answers: answers,
            created_at: new Date().toISOString(),
          },
        ])
      }
    } catch (e) {
      console.error('Lỗi lưu submission:', e)
    } finally {
      setIsSubmitting(false)
      localStorage.removeItem(`m_exam_ans_${examId}`)
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const currentQ = questions[currentIndex]
  const isPdfExam = Boolean(exam?.pdf_url || exam?.drive_file_id)
  const answeredCount = Object.keys(answers).length

  if (loading) {
    return (
      <ModernLoading
        title="Phòng Khảo Thí Trực Tuyến Mobile"
        subtitle={`Đang tải cấu trúc đề thi, công thức KaTeX & tài liệu câu hỏi (v${MOBILE_VERSION})...`}
      />
    )
  }

  // PHÒNG THI ĐÁNH GIÁ NĂNG LỰC HSA (ĐHQGHN)
  if (exam?.exam_type === 'HSA') {
    return (
      <HsaExamRoom
        exam={exam}
        studentInfo={{
          name: studentUser?.user_metadata?.full_name || studentUser?.email?.split('@')[0] || 'Thí sinh Mobile',
          email: studentUser?.email || '',
        }}
        isMobileView={true}
        onExit={() => router.push('/m/sen-ground')}
      />
    )
  }

  // ==========================================
  // MÀN HÌNH CHỜ TRƯỚC KHI BẮT ĐẦU
  // ==========================================
  if (!hasStarted && !result && !isReviewMode) {
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
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400">
                {exam?.exam_type || 'Đề Khảo Thí'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/5 dark:bg-white/10 text-slate-500">
                {isPdfExam ? '📄 Đề PDF' : '✨ Đề KaTeX'}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {exam?.title}
            </h1>
            <p className="text-xs text-slate-500">
              Môn: <span className="font-bold text-slate-700 dark:text-slate-300">{exam?.subject || 'Tổng hợp'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian</span>
              <p className="text-lg font-black text-sky-600 dark:text-sky-400">{exam?.duration || 50} phút</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Số câu hỏi</span>
              <p className="text-lg font-black text-sky-600 dark:text-sky-400">{questions.length} câu</p>
            </div>
          </div>

          {/* Tùy chọn Chế độ luyện tập & Đảo đề */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-2.5 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block">Tùy Chọn Phòng Thi</span>
            <label className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Chế độ Luyện tập (Xem giải thích ngay)</span>
              <input
                type="checkbox"
                checked={isStudyMode}
                onChange={(e) => setIsStudyMode(e.target.checked)}
                className="rounded text-sky-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Đảo thứ tự câu hỏi</span>
              <input
                type="checkbox"
                checked={shuffleQuestionsEnabled}
                onChange={(e) => setShuffleQuestionsEnabled(e.target.checked)}
                className="rounded text-sky-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>Đảo thứ tự đáp án (A, B, C, D)</span>
              <input
                type="checkbox"
                checked={shuffleOptionsEnabled}
                onChange={(e) => setShuffleOptionsEnabled(e.target.checked)}
                className="rounded text-sky-600"
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHasStarted(true)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-sm shadow-lg active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>BẮT ĐẦU LÀM BÀI THI</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // ==========================================
  // MÀN HÌNH KẾT QUẢ SAU KHI NỘP BÀI
  // ==========================================
  if (result && !isReviewMode) {
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
              <p className="text-base font-black text-sky-600 dark:text-sky-400">
                {Math.round((result.correct / result.total) * 100)}%
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            type="button"
            onClick={() => {
              setIsReviewMode(true)
              setCurrentIndex(0)
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 active:scale-98 transition cursor-pointer"
          >
            <Eye className="h-4 w-4" /> Xem lại chi tiết bài làm (Review)
          </button>
          <Link
            href="/m/sen-ground?tab=history"
            className="w-full py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition"
          >
            <ListOrdered className="h-4 w-4" /> Lịch sử bài nộp
          </Link>
          <Link
            href="/m"
            className="w-full py-2.5 text-slate-400 font-bold text-xs block text-center"
          >
            Về trang chủ mobile
          </Link>
        </div>
      </div>
    )
  }

  // ==========================================
  // GIAO DIỆN LÀM BÀI HOẶC XEM LẠI CHI TIẾT
  // ==========================================
  const currentKey = `q_${currentQ?.number || currentIndex + 1}`
  const selectedAns = answers[currentKey]
  const isAnswerRevealed = revealedAnswers[currentKey] || isReviewMode
  const correctAns = currentQ?.correct_answer || 'A'

  return (
    <div className="flex-1 w-full flex flex-col justify-between bg-slate-50 dark:bg-slate-900 select-none pb-12">
      {/* 1. STICKY TOPBAR PHÒNG THI */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-black/10 dark:border-white/10 px-3.5 py-2 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={() => {
            if (isReviewMode) {
              setIsReviewMode(false)
            } else {
              setShowExitConfirm(true)
            }
          }}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          title="Thoát phòng thi"
        >
          {isReviewMode ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>

        {/* ĐỒNG HỒ ĐẾM NGƯỢC HOẶC HUY HIỆU REVIEW */}
        {isReviewMode ? (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
            Đang Xem Lại Bài
          </span>
        ) : (
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-black ${
              timeLeft <= 180
                ? 'bg-rose-500 text-white animate-pulse'
                : timeLeft <= 600
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}

        {/* NÚT NỘP BÀI HOẶC THOÁT REVIEW */}
        {isReviewMode ? (
          <button
            type="button"
            onClick={() => router.push('/m/sen-ground?tab=history')}
            className="px-3 py-1.5 rounded-xl bg-sky-600 text-white font-black text-xs shadow-xs active:scale-95 transition"
          >
            Đóng
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSubmitConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs shadow-xs active:scale-95 transition"
          >
            Nộp bài
          </button>
        )}
      </header>

      {/* 2. PROGRESS BAR TIẾN ĐỘ */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1">
        <div
          className="bg-sky-600 h-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      {/* ======================================================== */}
      {/* TRƯỜNG HỢP A: ĐỀ PDF (PDF Ở TRÊN, CHỌN ĐÁP ÁN TINH GỌN Ở DƯỚI) */}
      {/* ======================================================== */}
      {isPdfExam ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* KHUNG XEM ĐỀ PDF Ở TRÊN */}
          <div className="flex-1 w-full bg-slate-950 relative border-b border-black/10 dark:border-white/10 min-h-[52vh]">
            <iframe
              src={exam.pdf_url || `https://drive.google.com/file/d/${exam.drive_file_id}/preview#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              allow="autoplay"
              title="Đề thi PDF"
            />
          </div>

          {/* BẢNG CHỌN ĐÁP ÁN TINH GỌN Ở DƯỚI */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-black/10 dark:border-white/10 space-y-2 shadow-lg shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                  className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-600 disabled:opacity-30 active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-black text-sky-600 dark:text-sky-400 font-mono">
                  Câu {currentIndex + 1}
                </span>
                <span className="text-[10px] text-slate-400">/{questions.length}</span>
                <button
                  type="button"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
                  className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-600 disabled:opacity-30 active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPalette(true)}
                className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[11px] flex items-center gap-1"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>{answeredCount}/{questions.length}</span>
              </button>
            </div>

            {/* HÀNG 4 NÚT ĐÁP ÁN TINH GỌN (A, B, C, D) */}
            <div className="grid grid-cols-4 gap-2">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const isSelected = selectedAns === letter
                const isCorrect = isAnswerRevealed && letter === correctAns
                const isWrong = isAnswerRevealed && isSelected && letter !== correctAns

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={isReviewMode}
                    onClick={() => {
                      handleSelectOption(currentKey, letter)
                      if (!isReviewMode && currentIndex < questions.length - 1) {
                        setTimeout(() => setCurrentIndex((idx) => idx + 1), 160)
                      }
                    }}
                    className={`h-11 rounded-xl font-black text-sm transition-all duration-150 flex items-center justify-center active:scale-95 cursor-pointer ${
                      isCorrect
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isWrong
                        ? 'bg-rose-500 text-white shadow-md'
                        : isSelected
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* TRƯỜNG HỢP B: ĐỀ KATEX (HIỂN THỊ CÂU HỎI & CÔNG THỨC)    */
        /* ======================================================== */
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {currentQ && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs">
                  Câu {currentIndex + 1} / {questions.length}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Nút Kiểm tra đáp án (Nếu bật Chế độ Luyện tập) */}
                  {isStudyMode && !isReviewMode && (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedAnswers((prev) => ({ ...prev, [currentKey]: !prev[currentKey] }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 font-bold text-[11px] flex items-center gap-1 active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{isAnswerRevealed ? 'Ẩn đáp án' : 'Xem đáp án'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPalette(true)}
                    className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-500"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* NỘI DUNG CÂU HỎI KATEX */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                <SafeMathRenderer content={currentQ.question} />
              </div>

              {/* CÁC PHƯƠNG ÁN LỰA CHỌN */}
              <div className="space-y-2">
                {currentQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx)
                  const isSelected = selectedAns === letter
                  const isCorrect = isAnswerRevealed && letter === correctAns
                  const isWrong = isAnswerRevealed && isSelected && letter !== correctAns

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={isReviewMode}
                      onClick={() => handleSelectOption(currentKey, letter)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all duration-150 flex items-start gap-3 cursor-pointer ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold'
                          : isWrong
                          ? 'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold'
                          : isSelected
                          ? 'border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold'
                          : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center font-black text-xs shrink-0">
                        {letter}
                      </span>
                      <div className="text-xs leading-relaxed pt-0.5 flex-1">
                        <SafeMathRenderer content={opt} />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* LỜI GIẢI THÍCH CHI TIẾT KATEX (KHI REVEALED HOẶC REVIEW) */}
              {isAnswerRevealed && currentQ.explanation && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 animate-in fade-in">
                  <span className="font-black uppercase text-amber-600 dark:text-amber-400 block">
                    💡 Hướng Dẫn Giải Chi Tiết
                  </span>
                  <SafeMathRenderer content={currentQ.explanation} />
                </div>
              )}
            </div>
          )}

          {/* THANH ĐIỀU HƯỚNG CÂU TRƯỚC / SAU */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs disabled:opacity-30 active:scale-95 flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Câu trước
            </button>
            <button
              type="button"
              disabled={currentIndex === questions.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs disabled:opacity-30 active:scale-95 flex items-center gap-1"
            >
              Câu tiếp <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL PALETTE DANH SÁCH TẤT CẢ CÂU HỎI */}
      {showPalette && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in">
          <div className="w-full max-h-[75vh] rounded-t-3xl bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500">Danh Sách Câu Hỏi ({questions.length})</span>
              <button
                type="button"
                onClick={() => setShowPalette(false)}
                className="p-1 rounded text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const key = `q_${q.number}`
                const isAnswered = Boolean(answers[key])
                const isCurrent = idx === currentIndex

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx)
                      setShowPalette(false)
                    }}
                    className={`h-11 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition active:scale-95 ${
                      isCurrent
                        ? 'ring-2 ring-sky-500 bg-sky-600 text-white shadow-xs'
                        : isAnswered
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                        : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && <span className="text-[9px] font-black">{answers[key]}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN NỘP BÀI */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl text-center">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Xác Nhận Nộp Bài Thi</h3>
            <p className="text-xs text-slate-500">
              Bạn đã hoàn thành <strong>{answeredCount}/{questions.length}</strong> câu hỏi. Bạn có chắc chắn muốn nộp bài ngay?
            </p>
            <div className="flex items-center gap-2 pt-2">
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
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs shadow-md"
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN THOÁT PHÒNG THI */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl text-center">
            <h3 className="text-sm font-black text-rose-500">Thoát Khỏi Phòng Thi?</h3>
            <p className="text-xs text-slate-500">
              Bài thi đang diễn ra. Nếu rời khỏi đây, tiến độ của bạn có thể không được tính điểm.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Ở lại thi
              </button>
              <button
                type="button"
                onClick={() => router.replace('/m/sen-ground?tab=exams')}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md"
              >
                Thoát ra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
