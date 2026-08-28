'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  Clock,
  ArrowLeft,
  Send,
  FileQuestion,
  LayoutList,
  Bookmark,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Eye,
  Award,
  ChevronRight,
  Sun,
  Moon,
  Move,
  UploadCloud,
  FileText,
  Sparkles,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newroom-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newroom-body' })

export default function NewExamRoomPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Test state
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submittedResult, setSubmittedResult] = useState<{ submissionId: string; score: number } | null>(null)

  // Layout view mode
  const [pdfFullscreen, setPdfFullscreen] = useState(false)
  const [cachedPdfUrl, setCachedPdfUrl] = useState('')

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchExam = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)

      const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single()
      if (error || !data) {
        alert('Không tìm thấy đề thi hoặc đề thi đã bị xóa!')
        router.replace('/new-exams')
        return
      }

      if (data.drive_file_id) {
        setCachedPdfUrl(`https://drive.google.com/file/d/${data.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`)
      } else if (data.pdf_url) {
        setCachedPdfUrl(data.pdf_url)
      }

      // Khôi phục nháp bài làm từ LocalStorage nếu có
      const draftKey = `senexam_draft_${examId}_${user.id}`
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft)
          if (parsed.answers) setAnswers(parsed.answers)
          if (parsed.bookmarked) setBookmarked(parsed.bookmarked)
        } catch (e) {
          console.error('Error loading draft answers:', e)
        }
      }

      setExam(data)
      setTimeLeft((data.duration || 50) * 60)
      setLoading(false)
    }

    fetchExam()
  }, [examId, router])

  // Timer đếm ngược
  useEffect(() => {
    if (!hasStarted || loading || timeLeft <= 0 || submittedResult || submitting) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, loading, timeLeft, submittedResult, submitting])

  // Tự động lưu tiến độ vào LocalStorage
  useEffect(() => {
    if (!hasStarted || !examId) return
    const timer = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const draftKey = `senexam_draft_${examId}_${auth.user.id}`
        localStorage.setItem(draftKey, JSON.stringify({ answers, bookmarked, updatedAt: Date.now() }))
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [answers, bookmarked, examId, hasStarted])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Cập nhật câu trả lời
  const handleAnswer = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  // Đánh dấu xem lại
  const toggleBookmark = (key: string) => {
    setBookmarked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Chỉ lấy các phần có số lượng câu hỏi > 0
  const activeSections = useMemo(() => {
    if (!exam?.exam_structure || !Array.isArray(exam.exam_structure)) return []
    return exam.exam_structure.filter((s: any) => s && (s.questionCount || 0) > 0)
  }, [exam])

  // Offset câu hỏi toàn cục theo từng phần
  const computedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let running = 0
    activeSections.forEach((section: any) => {
      offsets[section.id] = running
      running += section.questionCount || 0
    })
    return offsets
  }, [activeSections])

  // Tính toán danh sách phẳng các câu hỏi để hiển thị Question Map Palette
  const questionMeta = useMemo(() => {
    const flatList: { key: string; sectionId: string; qIdx: number; label: string; globalNum: number }[] = []
    let totalCount = 0

    activeSections.forEach((section: any) => {
      const count = section.questionCount || 0
      const offset = computedOffsets[section.id] || 0
      for (let i = 0; i < count; i++) {
        totalCount += 1
        const key = `${section.id}-${i}`
        flatList.push({
          key,
          sectionId: section.id,
          qIdx: i,
          globalNum: offset + i + 1,
          label: `Câu ${offset + i + 1}`,
        })
      }
    })

    return { totalCount, flatList }
  }, [activeSections, computedOffsets])

  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((k) => {
      const val = answers[k]
      if (val === undefined || val === null || val === '') return false
      if (typeof val === 'object' && Object.keys(val).length === 0) return false
      return true
    }).length
  }, [answers])

  // Xử lý nộp bài & chấm điểm
  const handleSubmitExam = async () => {
    setShowSubmitModal(false)
    setSubmitting(true)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Phiên đăng nhập đã hết hạn')

      let totalPoints = 0
      let hasEssay = false
      const detailedScores: Record<string, number> = {}

      activeSections.forEach((section: any) => {
        const perQuestionPoints = section.scoringMode === 'auto_divide'
          ? ((section.sectionTotalPoints || 0) / (section.questionCount || 1))
          : 0

        Array.from({ length: section.questionCount || 0 }).forEach((_, qIdx) => {
          const key = `${section.id}-${qIdx}`
          const qPoint = section.scoringMode === 'custom' ? (section.customPoints?.[qIdx] || 0) : perQuestionPoints
          let earned = 0

          let currentType = section.type || 'single_choice'
          if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
            const range = section.mixedRanges.find((r: any) => qIdx + 1 >= r.start && qIdx + 1 <= r.end)
            if (range) currentType = range.type || 'single_choice'
            else currentType = 'single_choice'
          }

          if (currentType === 'essay') {
            hasEssay = true
          } else {
            const studentAns = answers[key]
            const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]

            if (currentType === 'true_false') {
              let correctSubCount = 0
              if (studentAns && typeof studentAns === 'object' && correctAns && typeof correctAns === 'object') {
                ;['a', 'b', 'c', 'd'].forEach((sub) => {
                  const sVal = studentAns[sub] === 'Đ' || studentAns[sub] === 'T' ? 'T' : studentAns[sub] === 'S' || studentAns[sub] === 'F' ? 'F' : studentAns[sub]
                  const cVal = correctAns[sub] === 'Đ' || correctAns[sub] === 'T' ? 'T' : correctAns[sub] === 'S' || correctAns[sub] === 'F' ? 'F' : correctAns[sub]
                  if (sVal && cVal && sVal === cVal) correctSubCount++
                })
              }
              if (correctSubCount === 1) earned = qPoint * 0.1
              else if (correctSubCount === 2) earned = qPoint * 0.25
              else if (correctSubCount === 3) earned = qPoint * 0.5
              else if (correctSubCount === 4) earned = qPoint * 1.0
            } else if (currentType === 'multiple_choice') {
              if (Array.isArray(studentAns) && Array.isArray(correctAns) && studentAns.length === correctAns.length && studentAns.every((v) => correctAns.includes(v))) {
                earned = qPoint
              }
            } else {
              if (studentAns !== undefined && studentAns !== null && String(studentAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase()) {
                earned = qPoint
              }
            }
          }

          detailedScores[key] = parseFloat(earned.toFixed(2))
          totalPoints += detailedScores[key]
        })
      })

      const finalScore = parseFloat(totalPoints.toFixed(2))
      const timeSpentSeconds = (exam.duration || 50) * 60 - Math.max(0, timeLeft)

      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .insert({
          exam_id: exam.id,
          user_id: user.id,
          answers: answers,
          score: finalScore,
          detailed_scores: detailedScores,
          time_spent: timeSpentSeconds,
          is_graded: !hasEssay,
        })
        .select('id')
        .single()

      if (subError) throw subError

      // Xóa bản nháp lưu tạm
      localStorage.removeItem(`senexam_draft_${exam.id}_${user.id}`)

      setSubmittedResult({
        submissionId: subData?.id || '',
        score: finalScore,
      })
    } catch (err: any) {
      alert(`Lỗi nộp bài: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmit = () => {
    handleSubmitExam()
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải đề thi và chuẩn bị phòng thi ảo...</span>
        </div>
      </div>
    )
  }

  // PHÒNG CHỜ BẮT ĐẦU THI
  if (!hasStarted) {
    return (
      <main
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 p-4 font-sans`}
        style={{
          ...themeVars,
          background: isDark
            ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
            : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
        }}
      >
        <div className="w-full max-w-2xl rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl">
          
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-5">
            <Link
              href="/new-exams"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Thoát ra kho đề
            </Link>
            <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 text-xs font-bold border border-indigo-500/20">
              {exam.exam_type}
            </span>
          </div>

          <div className="mt-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md mb-4">
              <FileQuestion className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              {exam.title}
            </h1>
            <p className="mt-2 text-xs text-[#6B7280] dark:text-slate-400 font-semibold">
              Thời gian: <strong>{exam.duration || 50} phút</strong> • Tổng số câu: <strong>{questionMeta.totalCount} câu</strong>
            </p>
          </div>

          {/* Quy chế phòng thi */}
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-[#4B5563] dark:text-slate-300 space-y-2">
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> Lưu ý khi làm bài:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>Hệ thống tự động lưu tiến độ sau mỗi câu trả lời.</li>
              <li>Bộ đếm thời gian sẽ tự động nộp bài khi hết giờ.</li>
              <li>Bạn có thể phóng to đề thi PDF hoặc xem song song phiếu trả lời.</li>
            </ul>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setHasStarted(true)
                try {
                  const docEl = document.documentElement as any
                  if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {})
                  else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {})
                } catch (e) {}
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            >
              Bắt đầu tính giờ làm bài (Toàn màn hình) <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    )
  }

  // PHÒNG THI CHÍNH
  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} h-screen flex flex-col bg-[#FDF6EC] dark:bg-[#080C14] text-[#1A1A1A] dark:text-slate-100 font-sans overflow-hidden select-none`}
      style={themeVars}
    >
      {/* FLOATING HEADER */}
      <header className="h-16 shrink-0 border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 px-4 sm:px-6 flex items-center justify-between backdrop-blur-xl z-20">
        
        {/* Left: Exam title */}
        <div className="flex items-center gap-3 max-w-sm sm:max-w-md">
          <Link
            href="/new-exams"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Thoát phòng thi"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="truncate">
            <h2 className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              {exam.title}
            </h2>
            <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-bold uppercase tracking-wider">
              Đã làm {answeredCount}/{questionMeta.totalCount} câu ({Math.round((answeredCount / (questionMeta.totalCount || 1)) * 100)}%)
            </span>
          </div>
        </div>

        {/* Center: Timer Countdown */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-1.5 border font-mono font-black text-sm sm:text-base shadow-inner ${
            timeLeft < 300
              ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}>
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const doc = document as any
              if (doc.fullscreenElement || doc.webkitFullscreenElement) {
                if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {})
                else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(() => {})
              } else {
                const docEl = document.documentElement as any
                if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {})
                else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen().catch(() => {})
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Bật/Tắt Toàn màn hình"
          >
            <Maximize2 className="h-4 w-4 text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Nộp bài
          </button>
        </div>
      </header>

      {/* BODY: SPLIT VIEW (PDF / DE THI TRÁI - PHIẾU TRẢ LỜI PHẢI) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CỘT TRÁI: ĐỀ THI PDF / NỘI DUNG ĐỀ */}
        <div className={`flex-1 flex flex-col bg-slate-900 border-r border-black/10 dark:border-white/10 transition-all ${pdfFullscreen ? 'w-full' : 'hidden md:flex'}`}>
          {cachedPdfUrl ? (
            <div className="relative w-full h-full flex flex-col">
              <div className="h-9 bg-slate-950 px-4 flex items-center justify-between text-xs text-slate-400 border-b border-white/10">
                <span className="font-bold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-400" /> Đề thi đính kèm (PDF)
                </span>
                <button
                  type="button"
                  onClick={() => setPdfFullscreen(!pdfFullscreen)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {pdfFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {pdfFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                </button>
              </div>
              <iframe src={cachedPdfUrl} className="flex-1 w-full h-full border-none" title="Exam PDF" />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400">
              <div>
                <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-bold text-sm">Đề thi hiển thị trực tiếp trên phiếu làm bài bên phải</p>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: PHIẾU LÀM BÀI & BẢNG CÂU HỎI */}
        <div className={`w-full md:w-[480px] lg:w-[540px] xl:w-[600px] flex flex-col bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl ${pdfFullscreen ? 'hidden' : 'flex'}`}>
          
          {/* Question Grid Navigation Palette */}
          <div className="p-4 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                Bảng câu hỏi ({answeredCount}/{questionMeta.totalCount})
              </span>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Đã làm</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Xem lại</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Chưa làm</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {questionMeta.flatList.map((item) => {
                const ans = answers[item.key]
                const isAnswered = ans !== undefined && ans !== null && ans !== '' && (typeof ans !== 'object' || Object.keys(ans).length > 0)
                const isMarked = bookmarked[item.key]

                return (
                  <a
                    key={item.key}
                    href={`#q-${item.key}`}
                    className={`h-7 w-8 rounded-lg text-xs font-black flex items-center justify-center transition ${
                      isMarked
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                        : isAnswered
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/10 text-[#4B5563] dark:text-slate-300 hover:bg-black/10'
                    }`}
                  >
                    {item.globalNum}
                  </a>
                )
              })}
            </div>
          </div>

          {/* Question List Section */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {activeSections.map((section: any, sIdx: number) => {
              const offset = computedOffsets[section.id] || 0

              return (
                <div key={section.id || sIdx} className="space-y-4">
                  
                  {/* Section Header */}
                  <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-indigo-900 dark:text-indigo-200">
                    <h3 className="font-black text-sm" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                      {section.name || section.title || `Phần ${sIdx + 1}`}
                    </h3>
                    {section.description && (
                      <p className="text-xs mt-0.5 opacity-80">{section.description}</p>
                    )}
                  </div>

                  {/* Section Questions */}
                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount || 0 }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const globalNum = offset + qIdx + 1
                      const isMarked = bookmarked[key]
                      const currentAns = answers[key]

                      let currentType = section.type || 'single_choice'
                      let currentOptionsCount = section.optionsCount || 4

                      if (section.type === 'mixed' && section.mixedRanges && Array.isArray(section.mixedRanges)) {
                        const range = section.mixedRanges.find((r: any) => qIdx + 1 >= r.start && qIdx + 1 <= r.end)
                        if (range) {
                          currentType = range.type || 'single_choice'
                          currentOptionsCount = range.optionsCount || 4
                        } else {
                          currentType = 'single_choice'
                        }
                      }

                      const options = Array.from({ length: currentOptionsCount }, (_, oIdx) => String.fromCharCode(65 + oIdx))

                      return (
                        <div
                          key={key}
                          id={`q-${key}`}
                          className={`rounded-2xl border p-4 transition-all duration-200 ${
                            isMarked
                              ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
                              : 'border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-sm'
                          }`}
                        >
                          {/* Question Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#111827] dark:bg-white text-white dark:text-slate-900 text-xs font-black">
                                {globalNum}
                              </span>
                              <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400">
                                Câu hỏi {globalNum}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleBookmark(key)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                                isMarked
                                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                                  : 'bg-black/5 dark:bg-white/10 text-[#6B7280] dark:text-slate-400 hover:text-black dark:hover:text-white'
                              }`}
                            >
                              <Bookmark className="h-3 w-3" />
                              {isMarked ? 'Đã đánh dấu' : 'Đánh dấu'}
                            </button>
                          </div>

                          {/* Question Answer Inputs by Type */}
                          <div className="mt-3.5">
                            
                            {/* 1. Trắc nghiệm đơn hoặc nhiều lựa chọn */}
                            {(currentType === 'single_choice' || currentType === 'multiple_choice' || !currentType) && (
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt) => {
                                  const isSelected = currentType === 'multiple_choice'
                                    ? Array.isArray(currentAns) && currentAns.includes(opt)
                                    : currentAns === opt

                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        if (currentType === 'multiple_choice') {
                                          const prevArr = Array.isArray(currentAns) ? currentAns : []
                                          const nextArr = prevArr.includes(opt) ? prevArr.filter((x: string) => x !== opt) : [...prevArr, opt].sort()
                                          handleAnswer(key, nextArr)
                                        } else {
                                          handleAnswer(key, opt)
                                        }
                                      }}
                                      className={`h-10 min-w-10 px-4 rounded-xl text-xs font-black transition-all ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white shadow-md scale-105'
                                          : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700/60 hover:bg-black/5 dark:hover:bg-white/5'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  )
                                })}
                              </div>
                            )}

                            {/* 2. Trắc nghiệm Đúng / Sai 4 ý */}
                            {currentType === 'true_false' && (
                              <div className="space-y-2">
                                {['a', 'b', 'c', 'd'].map((sub) => {
                                  const val = currentAns?.[sub]
                                  return (
                                    <div
                                      key={sub}
                                      className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-2.5"
                                    >
                                      <span className="text-xs font-bold uppercase tracking-wider">
                                        Ý {sub})
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleAnswer(key, { ...currentAns, [sub]: 'Đ' })}
                                          className={`rounded-lg px-3 py-1 text-xs font-black transition ${
                                            val === 'Đ' || val === 'T'
                                              ? 'bg-emerald-600 text-white shadow-sm'
                                              : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700'
                                          }`}
                                        >
                                          Đúng
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAnswer(key, { ...currentAns, [sub]: 'S' })}
                                          className={`rounded-lg px-3 py-1 text-xs font-black transition ${
                                            val === 'S' || val === 'F'
                                              ? 'bg-rose-600 text-white shadow-sm'
                                              : 'border border-black/10 dark:border-white/10 bg-white dark:bg-slate-700'
                                          }`}
                                        >
                                          Sai
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* 3. Điền số / Trả lời ngắn */}
                            {currentType === 'short_answer' && (
                              <input
                                type="text"
                                placeholder="Nhập kết quả điền số hoặc biểu thức..."
                                value={currentAns || ''}
                                onChange={(e) => handleAnswer(key, e.target.value)}
                                className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 text-xs font-black outline-none focus:border-indigo-500"
                              />
                            )}

                            {/* 4. Tự luận */}
                            {currentType === 'essay' && (
                              <textarea
                                rows={3}
                                placeholder="Gõ lời giải tóm tắt..."
                                value={currentAns?.text || currentAns || ''}
                                onChange={(e) => handleAnswer(key, e.target.value)}
                                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 text-xs font-medium outline-none focus:border-indigo-500"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* CONFIRM SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Send className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
              Xác nhận nộp bài thi?
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Bạn đã trả lời <strong>{answeredCount}/{questionMeta.totalCount}</strong> câu hỏi. Hệ thống sẽ chấm điểm ngay lập tức.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2.5 text-xs font-bold"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2.5 text-xs font-black shadow"
              >
                Nộp ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMISSION RESULT MODAL */}
      {submittedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-8 shadow-2xl text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-emerald-500/20">
                Hoàn thành bài thi
              </span>
              <h2 className="text-2xl font-black mt-3" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                Chúc mừng bạn đã nộp bài!
              </h2>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Điểm số đạt được:</span>
              <p className="text-4xl font-black text-amber-600 dark:text-amber-400 mt-1" style={{ fontFamily: 'var(--font-newroom-heading)' }}>
                {submittedResult.score} <span className="text-lg font-bold text-[#6B7280]">/ 10</span>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {exam?.allow_review !== false ? (
                <Link
                  href={`/new-submissions/${submittedResult.submissionId}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  <Eye className="h-4 w-4" /> Xem Lời Giải & Chi Tiết
                </Link>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                  🔒 Giáo viên / Quản trị viên đã khóa xem lại đáp án cho đề thi này.
                </div>
              )}
              <Link
                href="/new-history"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 py-2.5 text-xs font-bold transition hover:bg-black/10"
              >
                Về Lịch Sử Bài Thi
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
