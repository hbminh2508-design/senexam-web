'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import SebLogo from '@/components/SebLogo'
import {
  Clock,
  ArrowLeft,
  Send,
  FileQuestion,
  Bookmark,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Award,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  Download,
  AlertCircle,
  Lock,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-sebexam-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-sebexam-body' })

/**
 * Chuẩn hóa thể loại câu hỏi với cơ chế Fallback an toàn
 * Đảm bảo các tùy chọn đáp án không bao giờ bị biến mất
 */
function normalizeQuestionType(
  rawType: any,
  section?: any,
  qIdx?: number
): 'single_choice' | 'true_false' | 'short_answer' | 'essay' {
  let type = (rawType || '').toString().toLowerCase().trim()

  // Hỗ trợ dạng đề hỗn hợp (mixed) có mixedRanges
  if ((type === 'mixed' || !type) && section?.mixedRanges && Array.isArray(section.mixedRanges) && qIdx !== undefined) {
    const range = section.mixedRanges.find(
      (r: any) => qIdx + 1 >= (r.start || 1) && qIdx + 1 <= (r.end || 999)
    )
    if (range?.type) {
      type = range.type.toString().toLowerCase().trim()
    }
  }

  if (
    type.includes('true') ||
    type.includes('tf') ||
    type.includes('dung_sai') ||
    type.includes('đúng') ||
    type.includes('sai')
  ) {
    return 'true_false'
  }

  if (
    type.includes('short') ||
    type.includes('ngắn') ||
    type.includes('điền') ||
    type.includes('fill') ||
    type.includes('dien_so') ||
    type === 'sa'
  ) {
    return 'short_answer'
  }

  if (
    type.includes('essay') ||
    type.includes('luận') ||
    type.includes('tu_luan')
  ) {
    return 'essay'
  }

  // Fallback mặc định an toàn tuyệt đối: single_choice (A, B, C, D)
  return 'single_choice'
}

export default function SebExamRoomPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminBypassSeb, setAdminBypassSeb] = useState(false)

  // Trạng thái Phòng thi
  const [hasStarted, setHasStarted] = useState(false)
  const [honorAgreed, setHonorAgreed] = useState(false)
  const [isInsideSeb, setIsInsideSeb] = useState(false)
  const [currentBrowserName, setCurrentBrowserName] = useState('Trình duyệt web')
  const [submitting, setSubmitting] = useState(false)
  const [submittedResult, setSubmittedResult] = useState<{ submissionId: string; score: number } | null>(null)

  // Chống gian lận: ghi nhận ngầm số lần mất tiêu điểm để lưu CSDL mà không gây xao nhãng bài thi
  const [tabSwitches, setTabSwitches] = useState(0)

  // Tiến trình làm bài
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)
  const [cachedPdfUrl, setCachedPdfUrl] = useState('')

  // 1. Khởi tạo & Kiểm tra môi trường Safe Exam Browser
  useEffect(() => {
    document.documentElement.classList.remove('dark')

    // Phát hiện xem có đang mở trong Safe Exam Browser không
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent
      const isSeb = ua.includes('SEB') || ua.includes('SafeExamBrowser')
      setIsInsideSeb(isSeb)

      let bName = 'Trình duyệt web'
      if (ua.includes('Firefox/')) bName = 'Mozilla Firefox'
      else if (ua.includes('Edg/')) bName = 'Microsoft Edge'
      else if (ua.includes('Chrome/')) bName = 'Google Chrome'
      else if (ua.includes('Safari/') && !ua.includes('Chrome')) bName = 'Apple Safari'
      else if (ua.includes('OPR/') || ua.includes('Opera/')) bName = 'Opera'
      setCurrentBrowserName(bName)
    }

    const fetchExam = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) {
          router.replace('/seb-login')
          return
        }
        setCurrentUser(user)
        await ensureStudentProfile(user.id)

        const email = user.email?.toLowerCase() || ''
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (profile?.role === 'admin' || profile?.role === 'collab' || email === 'hoangbinhminh2508@gmail.com') {
          setIsAdmin(true)
        }

        const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single()
        if (error || !data) {
          alert('Không tìm thấy đề thi hoặc đề thi đã bị gỡ!')
          router.replace('/seb-dashboard')
          return
        }

        setExam(data)
        setTimeLeft((data.duration || 50) * 60)

        if (data.drive_file_id) {
          setCachedPdfUrl(`https://drive.google.com/file/d/${data.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`)
        } else if (data.pdf_url) {
          setCachedPdfUrl(data.pdf_url)
        }

        // Khôi phục bài nháp nếu có
        const draftKey = `seb_draft_${examId}_${user.id}`
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft)
            if (parsed.answers) setAnswers(parsed.answers)
            if (parsed.bookmarked) setBookmarked(parsed.bookmarked)
          } catch (e) {}
        }
      } catch (err) {
        console.error('Lỗi tải đề thi SEB:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchExam()
  }, [examId, router])

  // 2. Chống Gian Lận: Ghi nhận ngầm chuyển tab / mất tiêu điểm (Không rung lắc, không cản trở thí sinh)
  useEffect(() => {
    if (!hasStarted || submittedResult || submitting) return

    const handleBlur = () => {
      setTabSwitches((prev) => prev + 1)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1)
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [hasStarted, submittedResult, submitting])

  // 3. Bộ đếm ngược thời gian
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

  // 4. Tự động lưu bài làm vào LocalStorage
  useEffect(() => {
    if (!hasStarted || !examId || !currentUser) return
    const timer = setTimeout(() => {
      const draftKey = `seb_draft_${examId}_${currentUser.id}`
      localStorage.setItem(draftKey, JSON.stringify({ answers, bookmarked, updatedAt: Date.now() }))
    }, 800)
    return () => clearTimeout(timer)
  }, [answers, bookmarked, examId, hasStarted, currentUser])

  // Format thời gian đếm ngược mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Danh sách các phần thi
  const activeSections: any[] = useMemo(() => {
    if (!exam?.exam_structure || !Array.isArray(exam.exam_structure)) return []
    return exam.exam_structure
  }, [exam])

  // Tính toán số lượng câu hỏi và vị trí bắt đầu của mỗi phần
  const { questionMeta, computedOffsets } = useMemo(() => {
    let count = 0
    const offsets: Record<string, number> = {}
    const flat: any[] = []

    activeSections.forEach((section: any) => {
      offsets[section.id] = count
      const qCount = parseInt(section.questionCount) || 0
      for (let i = 0; i < qCount; i++) {
        const rawType =
          section.questionTypeMode === 'custom' && section.questionTypes?.[i]
            ? section.questionTypes[i]
            : section.type
        const qType = normalizeQuestionType(rawType, section, i)

        flat.push({
          sectionId: section.id,
          qIdx: i,
          globalNum: count + i + 1,
          key: `${section.id}-${i}`,
          type: qType,
        })
      }
      count += qCount
    })

    return {
      questionMeta: { totalCount: count, flatList: flat },
      computedOffsets: offsets,
    }
  }, [activeSections])

  // Số lượng câu đã trả lời
  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((k) => {
      const v = answers[k]
      if (v === undefined || v === null || v === '') return false
      if (typeof v === 'object') {
        return Object.values(v).some((subVal) => subVal !== undefined && subVal !== '')
      }
      return true
    }).length
  }, [answers])

  // Đánh dấu câu hỏi xem lại
  const toggleBookmark = (key: string) => {
    setBookmarked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Cập nhật câu trả lời trắc nghiệm đơn / ngắn / tự luận
  const handleAnswer = (key: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [key]: val }))
  }

  // Cập nhật câu trả lời Đúng/Sai 4 ý
  const handleAnswerTF = (key: string, subLabel: string, val: string) => {
    setAnswers((prev) => {
      const current = prev[key] || {}
      return {
        ...prev,
        [key]: {
          ...current,
          [subLabel]: val,
        },
      }
    })
  }

  // Chấm điểm bài thi theo đúng cấu trúc từng phần thi và chế độ điểm
  const calculateScore = () => {
    let totalScore = 0

    activeSections.forEach((section: any) => {
      const qCount = parseInt(section.questionCount) || 0
      const correctMap = section.correctAnswers || {}
      const isAutoDivide = section.scoringMode !== 'custom_points'
      const defaultPointsPerQ = qCount > 0 ? (Number(section.totalPoints) || 0) / qCount : 0

      for (let i = 0; i < qCount; i++) {
        const key = `${section.id}-${i}`
        const rawType =
          section.questionTypeMode === 'custom' && section.questionTypes?.[i]
            ? section.questionTypes[i]
            : section.type
        const qType = normalizeQuestionType(rawType, section, i)

        const qPoint = isAutoDivide
          ? defaultPointsPerQ
          : Number(section.pointsPerQuestion?.[i]) ?? defaultPointsPerQ

        if (qType === 'single_choice') {
          const userVal = String(answers[key] || '').trim().toUpperCase()
          const corrVal = String(correctMap[i] || '').trim().toUpperCase()
          if (userVal && corrVal && userVal === corrVal) {
            totalScore += qPoint
          }
        } else if (qType === 'true_false') {
          const userObj = answers[key] || {}
          const correctObj = correctMap[i] || {}

          let matchedSubCount = 0
          ;['a', 'b', 'c', 'd'].forEach((sub) => {
            const uVal = String(userObj[sub] || '').toUpperCase()
            const cVal = String(correctObj[sub] || '').toUpperCase()
            const isUserTrue = uVal === 'Đ' || uVal === 'T' || uVal === 'TRUE' || uVal === '1'
            const isUserFalse = uVal === 'S' || uVal === 'F' || uVal === 'FALSE' || uVal === '0'
            const isCorrTrue = cVal === 'Đ' || cVal === 'T' || cVal === 'TRUE' || cVal === '1'
            const isCorrFalse = cVal === 'S' || cVal === 'F' || cVal === 'FALSE' || cVal === '0'

            if ((isUserTrue && isCorrTrue) || (isUserFalse && isCorrFalse)) {
              matchedSubCount++
            }
          })

          // Tỷ lệ chuẩn Bộ GD&ĐT: 1 ý: 10%, 2 ý: 25%, 3 ý: 50%, 4 ý: 100%
          if (matchedSubCount === 4) totalScore += qPoint * 1.0
          else if (matchedSubCount === 3) totalScore += qPoint * 0.5
          else if (matchedSubCount === 2) totalScore += qPoint * 0.25
          else if (matchedSubCount === 1) totalScore += qPoint * 0.1
        } else if (qType === 'short_answer') {
          const userAns = (answers[key] || '').toString().trim().toLowerCase()
          const correctAns = (correctMap[i] || '').toString().trim().toLowerCase()
          if (userAns && userAns === correctAns) {
            totalScore += qPoint
          }
        } else if (qType === 'essay') {
          const userAns = (answers[key] || '').toString().trim().toLowerCase()
          const correctAns = (correctMap[i] || '').toString().trim().toLowerCase()
          if (correctAns && userAns === correctAns) {
            totalScore += qPoint
          }
        }
      }
    })

    return Math.round(totalScore * 100) / 100
  }

  // Nộp bài thi
  const handleSubmitExam = async () => {
    if (submitting || submittedResult) return
    setSubmitting(true)

    try {
      const calculatedScore = calculateScore()

      // 1. Dữ liệu chuẩn tương thích hoàn toàn với bảng submissions của SenExam
      const coreSubmission = {
        user_id: currentUser.id,
        exam_id: examId,
        score: calculatedScore,
        answers: answers,
        is_graded: true,
      }

      // 2. Thử ghi kèm telemetry mở rộng (nếu CSDL đã có cột)
      let subData: any = null
      const enhancedSubmission = {
        ...coreSubmission,
        total_questions: questionMeta.totalCount,
        tab_switches: tabSwitches,
        blur_count: tabSwitches,
        submitted_at: new Date().toISOString(),
      }

      const { data: firstTryData, error: firstTryErr } = await supabase
        .from('submissions')
        .insert(enhancedSubmission)
        .select('*')
        .maybeSingle()

      if (firstTryErr) {
        console.warn('Lỗi ghi telemetry mở rộng, tự động fallback sang schema chuẩn SenExam:', firstTryErr.message)
        // Fallback an toàn tuyệt đối: chỉ gửi các cột chắc chắn có trong bảng submissions
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('submissions')
          .insert(coreSubmission)
          .select('*')
          .single()

        if (fallbackErr) throw fallbackErr
        subData = fallbackData
      } else {
        subData = firstTryData
      }

      // Xóa bản nháp
      const draftKey = `seb_draft_${examId}_${currentUser.id}`
      localStorage.removeItem(draftKey)

      setSubmittedResult({
        submissionId: subData?.id || 'done',
        score: calculatedScore,
      })
      setShowSubmitModal(false)
    } catch (err: any) {
      alert('Lỗi nộp bài thi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Tự động nộp khi hết giờ
  const handleAutoSubmit = () => {
    alert('Hết giờ làm bài! Hệ thống tự động thu bài và chấm điểm.')
    handleSubmitExam()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
          <span className="text-xs font-bold text-slate-500">Đang chuẩn bị phòng thi bảo mật...</span>
        </div>
      </div>
    )
  }

  // ========================================================
  // MÀN HÌNH 1: KHÓA CỔNG SEB BẮT BUỘC 100% HOẶC PHÒNG CHỜ XÁC THỰC
  // ========================================================
  if (!hasStarted && !submittedResult) {
    const isEnforced = !isInsideSeb && !adminBypassSeb
    const host = typeof window !== 'undefined' ? window.location.host : ''
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
    const sebProtocolUrl = protocol === 'https:' ? `sebs://${host}/seb-exam/${examId}` : `seb://${host}/seb-exam/${examId}`
    const downloadConfigUrl = `/api/seb/config?examId=${examId}&download=1`

    // MÀN HÌNH KHÓA CỔNG (KHI CHƯA MỞ TRONG SAFE EXAM BROWSER)
    if (isEnforced) {
      return (
        <div
          className={`min-h-screen w-full bg-slate-50 flex flex-col justify-between text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
          style={{ fontFamily: 'var(--font-seb-body)' }}
        >
          <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <Link
                href="/seb-dashboard"
                className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                title="Quay lại Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <SebLogo size={34} showText={true} />
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Chưa phát hiện Safe Exam Browser</span>
              </span>
            </div>
          </header>

          <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 my-auto">
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-rose-100 shadow-xl space-y-6">
              {/* Header Cảnh Báo Khóa Cổng */}
              <div className="text-center space-y-3 border-b border-slate-100 pb-5">
                <div className="h-16 w-16 rounded-3xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-100 shadow-sm">
                  <Lock className="h-8 w-8" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    BẢO MẬT TUYỆT ĐỐI • YÊU CẦU SEB
                  </span>
                  <h1
                    className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-2"
                    style={{ fontFamily: 'var(--font-seb-heading)' }}
                  >
                    Yêu Cầu Sử Dụng Safe Exam Browser
                  </h1>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Bạn đang truy cập bằng <strong>{currentBrowserName}</strong>. Đề thi <span className="font-bold text-slate-800">{exam?.title}</span> yêu cầu môi trường Safe Exam Browser (SEB) để chống gian lận 100%.
                  </p>
                </div>
              </div>

              {/* Hướng dẫn 2 bước */}
              <div className="space-y-4">
                {/* Bước 1: Cài đặt SEB */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded-full bg-sky-600 text-white text-[11px] flex items-center justify-center">1</span>
                    Tải và Cài Đặt Safe Exam Browser (nếu máy chưa có)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold">
                    <a
                      href="https://safeexambrowser.org/download_en.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:text-sky-700 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>🪟 Cho Windows</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                    <a
                      href="https://safeexambrowser.org/download_en.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:text-sky-700 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>🍏 Cho macOS</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                    <a
                      href="https://apps.apple.com/app/safe-exam-browser/id1138834550"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:text-sky-700 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>📱 Cho iOS / iPad</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                  </div>
                </div>

                {/* Bước 2: Khởi chạy SEB */}
                <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded-full bg-sky-600 text-white text-[11px] flex items-center justify-center">2</span>
                    Khởi Chạy Phòng Thi Trong Safe Exam Browser
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <a
                      href={sebProtocolUrl}
                      className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shadow-sky-500/20"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Mở Bằng Safe Exam Browser</span>
                    </a>

                    <a
                      href={downloadConfigUrl}
                      className="w-full sm:w-auto py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2"
                      title="Tải file .seb về máy rồi click đúp để mở"
                    >
                      <Download className="h-4 w-4 text-sky-600" />
                      <span>Tải Cấu Hình (.seb)</span>
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500 italic text-center">
                    💡 Khi bấm mở, trình duyệt sẽ hỏi xác nhận khởi chạy ứng dụng Safe Exam Browser. Hãy chọn "Mở" hoặc "Open Safe Exam Browser".
                  </p>
                </div>
              </div>

              {/* Nút Kiểm Tra Lại & Quyền Admin */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Tôi Đã Mở SEB (Kiểm tra lại)</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAdminBypassSeb(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Xem Trước Với Tư Cách Quản Trị Viên</span>
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      )
    }

    // MÀN HÌNH CHỜ KHI ĐÃ ĐƯỢC XÁC THỰC TRONG SEB HOẶC ADMIN BYPASS
    const instructionsConfig = exam?.part_instructions || { part1: true, part2: true, part3: true }

    return (
      <div
        className={`min-h-screen w-full bg-slate-50 flex flex-col justify-between text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
        style={{ fontFamily: 'var(--font-seb-body)' }}
      >
        <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/seb-dashboard"
              className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <SebLogo size={34} showText={true} />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                isInsideSeb
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isInsideSeb ? 'Safe Exam Browser Đã Xác Thực An Toàn' : 'Quản Trị Viên Xem Trước'}</span>
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 my-auto">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-sky-100 shadow-xl space-y-6">
            {/* Header Đề thi */}
            <div className="text-center space-y-2 border-b border-slate-100 pb-5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                {exam?.exam_type || 'ĐỀ THI SEB'}
              </span>
              <h1
                className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight"
                style={{ fontFamily: 'var(--font-seb-heading)' }}
              >
                {exam?.title}
              </h1>
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-sky-600" />
                  Thời gian: {exam?.duration || 50} phút
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-sky-600" />
                  {questionMeta.totalCount} câu hỏi
                </span>
              </div>
            </div>

            {/* Hướng Dẫn Chi Tiết Các Phần Thi Do Admin Cấu Hình */}
            <div className="space-y-3">
              <h3
                className="text-sm font-black text-slate-900 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-seb-heading)' }}
              >
                Hướng Dẫn Làm Bài Theo Từng Phần:
              </h3>

              <div className="space-y-3 text-xs">
                {activeSections.length > 0 ? (
                  activeSections.map((sec: any, sIdx: number) => (
                    <div
                      key={sec.id || sIdx}
                      className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sky-950 text-xs">
                          📌 {sec.name || `Phần ${sIdx + 1}`}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-sky-700">
                          <span>{sec.questionCount} câu</span>
                          <span>•</span>
                          <span>{sec.totalPoints || 0} điểm</span>
                        </div>
                      </div>

                      {sec.instructions ? (
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {sec.instructions}
                        </p>
                      ) : (
                        <p className="text-slate-500 italic">
                          Thí sinh đọc kỹ đề bài và hoàn thành các câu hỏi của phần này.
                        </p>
                      )}

                      {/* Hình ảnh hướng dẫn do Admin đính kèm */}
                      {sec.instructionImage && (
                        <div className="mt-2 pt-2 border-t border-sky-200/50">
                          <span className="text-[10px] font-bold text-sky-800 uppercase block mb-1.5">
                            Hình ảnh hướng dẫn:
                          </span>
                          <div className="rounded-xl overflow-hidden border border-sky-200 bg-white max-h-60 flex items-center justify-center p-1">
                            <img
                              src={sec.instructionImage}
                              alt={`Hướng dẫn ${sec.name}`}
                              className="max-h-60 w-auto object-contain rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-100 text-slate-600">
                    Thí sinh làm bài theo đúng thời gian quy định và nộp bài trước khi đồng hồ đếm ngược kết thúc.
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox Cam Kết Thí Sinh */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={honorAgreed}
                  onChange={(e) => setHonorAgreed(e.target.checked)}
                  className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4 mt-0.5"
                />
                <span className="text-xs text-slate-700 font-bold leading-relaxed">
                  Tôi cam kết làm bài tự giác, trung thực, không nhờ người thi hộ và tuân thủ tuyệt đối quy chế thi của hệ thống Safe Exam Browser.
                </span>
              </label>
            </div>

            {/* Nút Bắt Đầu Làm Bài */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                disabled={!honorAgreed}
                onClick={() => setHasStarted(true)}
                className={`flex-1 w-full py-3 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md ${
                  honorAgreed
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Bắt Đầu Làm Bài Thi</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ========================================================
  // MÀN HÌNH 2: KẾT QUẢ SAU KHI NỘP BÀI
  // ========================================================
  if (submittedResult) {
    const isGood = submittedResult.score >= 8

    return (
      <div
        className={`min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
        style={{ fontFamily: 'var(--font-seb-body)' }}
      >
        <div className="max-w-md w-full bg-white rounded-3xl border border-sky-100 shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="h-16 w-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Nộp Bài Thành Công
            </span>
            <h2
              className="text-2xl font-black text-slate-900 mt-1"
              style={{ fontFamily: 'var(--font-seb-heading)' }}
            >
              {exam?.title}
            </h2>
          </div>

          {/* Hộp Điểm Số */}
          <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-100">
            <span className="text-xs font-bold text-slate-500 uppercase block">Điểm Của Bạn</span>
            <span className={`text-4xl font-black ${isGood ? 'text-emerald-600' : 'text-sky-600'}`}>
              {submittedResult.score.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-bold block mt-1">Thang điểm: 10.0</span>
          </div>

          {tabSwitches > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200/80">
              ⚠️ Số lần phát hiện chuyển tab trong giờ thi: <strong>{tabSwitches} lần</strong>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/seb-dashboard"
              className="flex-1 py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-md shadow-sky-500/20"
            >
              Về Trang Chủ Khảo Thí
            </Link>
            <Link
              href="/seb-profile"
              className="py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
            >
              Xem Bảng Điểm
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================
  // MÀN HÌNH 3: PHÒNG THI AN TOÀN TRỰC TIẾP (LIVE EXAM ROOM)
  // ========================================================
  return (
    <div
      className={`min-h-screen w-full bg-slate-100 flex flex-col text-slate-800 select-none antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-seb-body)' }}
    >
      {/* Top Exam Header */}
      <header className="h-14 w-full border-b border-sky-100 bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <SebLogo size={32} showText={false} />
          <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-xs sm:max-w-md">
            {exam?.title}
          </h1>
        </div>

        {/* Timer & Nút Nộp Bài */}
        <div className="flex items-center gap-3">
          {tabSwitches > 0 && (
            <span className="hidden sm:inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Mất tiêu điểm: {tabSwitches} lần
            </span>
          )}

          {/* Timer đếm ngược */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-black text-xs ${
              timeLeft < 300
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                : 'bg-sky-50 text-sky-800 border-sky-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Nộp Bài</span>
          </button>
        </div>
      </header>

      {/* Main Split: Left PDF (nhúng an toàn) / Right Answer Sheet (Phiếu làm bài) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        {/* CỘT TRÁI: ĐỀ THI PDF */}
        <div className={`flex-1 h-[calc(100vh-3.5rem)] bg-slate-200 relative flex flex-col ${pdfFullscreen ? 'fixed inset-0 z-50' : ''}`}>
          {cachedPdfUrl ? (
            <div className="flex-1 w-full h-full flex flex-col">
              <div className="h-9 bg-slate-100 border-b border-slate-200 text-slate-700 px-4 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">Tài liệu đề thi</span>
                <button
                  type="button"
                  onClick={() => setPdfFullscreen(!pdfFullscreen)}
                  className="text-slate-600 hover:text-sky-600 flex items-center gap-1 transition"
                >
                  {pdfFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span>{pdfFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
                </button>
              </div>
              <iframe
                src={cachedPdfUrl}
                className="flex-1 w-full h-full border-none"
                title="Đề thi PDF"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-xs font-bold text-center">
              Đề thi hiển thị trực tiếp trên phiếu làm bài bên phải
            </div>
          )}
        </div>

        {/* CỘT PHẢI: PHIẾU LÀM BÀI & CÂU HỎI */}
        <div
          className={`w-full md:w-[480px] lg:w-[540px] xl:w-[600px] h-[calc(100vh-3.5rem)] bg-white border-l border-slate-200 flex flex-col ${
            pdfFullscreen ? 'hidden' : 'flex'
          }`}
        >
          {/* Palette Bảng Điều Hướng Câu Hỏi */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                Bảng Câu Hỏi ({answeredCount}/{questionMeta.totalCount})
              </span>
              <div className="flex items-center gap-2.5 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Đã làm
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Xem lại
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Chưa làm
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {questionMeta.flatList.map((item) => {
                const ans = answers[item.key]
                const isAnswered =
                  ans !== undefined &&
                  ans !== null &&
                  ans !== '' &&
                  (typeof ans !== 'object' || Object.keys(ans).length > 0)
                const isMarked = bookmarked[item.key]

                return (
                  <a
                    key={item.key}
                    href={`#q-${item.key}`}
                    className={`h-7 w-8 rounded-lg text-xs font-black flex items-center justify-center transition ${
                      isMarked
                        ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                        : isAnswered
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.globalNum}
                  </a>
                )
              })}
            </div>
          </div>

          {/* Danh Sách Câu Hỏi Các Phần Thi */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
            {activeSections.map((section: any, sIdx: number) => {
              const offset = computedOffsets[section.id] || 0

              return (
                <div key={section.id || sIdx} className="space-y-3">
                  {/* Section Title */}
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-sky-900 font-bold text-xs flex items-center justify-between">
                    <span>{section.name || `Phần ${sIdx + 1}`}</span>
                    <span className="text-[10px] font-mono font-normal">
                      {section.questionCount} câu
                    </span>
                  </div>

                  {/* Questions */}
                  <div className="space-y-3">
                    {Array.from({ length: section.questionCount || 0 }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const globalNum = offset + qIdx + 1
                      const isMarked = bookmarked[key]
                      const currentAns = answers[key]
                      const rawType =
                        section.questionTypeMode === 'custom' && section.questionTypes?.[qIdx]
                          ? section.questionTypes[qIdx]
                          : section.type
                      const currentType = normalizeQuestionType(rawType, section, qIdx)

                      const qPoint =
                        section.scoringMode === 'custom_points'
                          ? section.pointsPerQuestion?.[qIdx]
                          : section.totalPoints && section.questionCount
                          ? section.totalPoints / section.questionCount
                          : null

                      return (
                        <div
                          key={key}
                          id={`q-${key}`}
                          className={`p-4 rounded-2xl border transition-all ${
                            isMarked
                              ? 'border-amber-400 bg-amber-50/30'
                              : 'border-slate-200 bg-white shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center justify-center">
                                {globalNum}
                              </span>
                              <span className="text-xs font-bold text-slate-700">
                                Câu hỏi {globalNum}
                                {qPoint !== null && qPoint !== undefined && (
                                  <span className="ml-1.5 text-[10px] text-sky-600 font-mono font-semibold">
                                    ({Number(qPoint).toFixed(2)}đ)
                                  </span>
                                )}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleBookmark(key)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-1 ${
                                isMarked
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-slate-600 bg-slate-100'
                              }`}
                            >
                              <Bookmark className="h-3 w-3" />
                              <span>{isMarked ? 'Đã xem lại' : 'Xem lại'}</span>
                            </button>
                          </div>

                          {/* 1. Trắc nghiệm lựa chọn A, B, C, D (hoặc nhiều hơn) */}
                          {currentType === 'single_choice' && (
                            <div className="flex gap-2 flex-wrap">
                              {(() => {
                                const optCount = Math.max(2, Math.min(10, parseInt(section.optionsCount) || 4))
                                const opts = Array.from({ length: optCount }).map((_, oIdx) => String.fromCharCode(65 + oIdx))
                                return opts.map((opt) => {
                                  const isSelected = String(currentAns || '').trim().toUpperCase() === opt
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleAnswer(key, opt)}
                                      className={`flex-1 min-w-[50px] py-2.5 rounded-xl text-xs font-black transition ${
                                        isSelected
                                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  )
                                })
                              })()}
                            </div>
                          )}

                          {/* 2. Trắc nghiệm Đúng / Sai 4 ý */}
                          {currentType === 'true_false' && (
                            <div className="space-y-1.5 text-xs">
                              {['a', 'b', 'c', 'd'].map((sub) => {
                                const subVal = currentAns?.[sub]
                                return (
                                  <div
                                    key={sub}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                                  >
                                    <span className="font-bold text-slate-600 uppercase">Ý {sub}:</span>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAnswerTF(key, sub, 'Đ')}
                                        className={`px-3 py-1 rounded-lg font-bold transition ${
                                          subVal === 'Đ'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-white text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        Đúng
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAnswerTF(key, sub, 'S')}
                                        className={`px-3 py-1 rounded-lg font-bold transition ${
                                          subVal === 'S'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'bg-white text-slate-600 border border-slate-200'
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

                          {/* 3. Trắc nghiệm điền số / trả lời ngắn */}
                          {currentType === 'short_answer' && (
                            <div>
                              <input
                                type="text"
                                value={currentAns || ''}
                                onChange={(e) => handleAnswer(key, e.target.value)}
                                placeholder="Nhập số hoặc đáp án của bạn..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                              />
                            </div>
                          )}

                          {/* 4. Tự luận */}
                          {currentType === 'essay' && (
                            <div>
                              <textarea
                                value={currentAns || ''}
                                onChange={(e) => handleAnswer(key, e.target.value)}
                                placeholder="Nhập câu trả lời tự luận của bạn..."
                                rows={4}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed"
                              />
                            </div>
                          )}
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

      {/* Modal Xác Nhận Nộp Bài */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-sky-100 shadow-2xl space-y-4">
            <h3
              className="text-lg font-black text-slate-900"
              style={{ fontFamily: 'var(--font-sebexam-heading)' }}
            >
              Xác Nhận Nộp Bài Thi
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn đã trả lời{' '}
              <strong className="text-sky-600">
                {answeredCount}/{questionMeta.totalCount}
              </strong>{' '}
              câu hỏi. Thời gian làm bài còn lại là{' '}
              <strong className="text-sky-600">{formatTimer(timeLeft)}</strong>. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tiếp Tục Làm
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitExam}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Nộp Bài Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
