'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Sparkles,
  Send,
  Bot,
  Loader2,
  Award,
  FileText,
  Layers,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  HelpCircle,
} from 'lucide-react'

// Thư viện kết xuất Markdown & Công thức Toán học KaTeX
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-body' })

interface AIQuestionState {
  isOpen: boolean
  questionText: string
  response: string
  isLoading: boolean
}

/**
 * Chuẩn hóa kiểu câu hỏi với cơ chế Fallback an toàn
 */
function normalizeQuestionType(
  rawType: any,
  section?: any,
  qIdx?: number
): 'single_choice' | 'true_false' | 'short_answer' | 'essay' {
  let type = (rawType || '').toString().toLowerCase().trim()

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
    type.includes('false') ||
    type.includes('đúng') ||
    type.includes('dung') ||
    type.includes('tf')
  ) {
    return 'true_false'
  }
  if (
    type.includes('short') ||
    type.includes('ngắn') ||
    type.includes('ngan') ||
    type.includes('dien') ||
    type.includes('fill')
  ) {
    return 'short_answer'
  }
  if (
    type.includes('essay') ||
    type.includes('luận') ||
    type.includes('luan') ||
    type.includes('tu_luan')
  ) {
    return 'essay'
  }
  return 'single_choice'
}

export default function SebReviewPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Quản lý trạng thái AI phân tích theo từng câu
  const [aiStates, setAiStates] = useState<Record<string, AIQuestionState>>({})
  const [activeTab, setActiveTab] = useState<'all' | 'wrong' | 'correct'>('all')

  useEffect(() => {
    const loadSubmission = async () => {
      try {
        setLoading(true)
        setErrorMsg(null)

        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) {
          router.replace('/seb-login')
          return
        }
        setCurrentUser(user)

        const email = user.email?.toLowerCase() || ''
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle()

        const isUserAdmin =
          profile?.role === 'admin' ||
          profile?.role === 'collab' ||
          email === 'hoangbinhminh2508@gmail.com'
        setIsAdmin(isUserAdmin)

        // 1. Tìm submission theo ID chính xác
        let { data, error } = await supabase
          .from('submissions')
          .select('*, exams(*), profiles(full_name, email)')
          .eq('id', submissionId)
          .maybeSingle()

        // 2. Dự phòng: nếu params.id là exam_id, tải bài nộp mới nhất của user cho exam đó
        if (!data) {
          const { data: fallbackSub } = await supabase
            .from('submissions')
            .select('*, exams(*), profiles(full_name, email)')
            .eq('exam_id', submissionId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          data = fallbackSub
        }

        if (!data) {
          setErrorMsg('Không tìm thấy dữ liệu bài thi hoặc bài thi đã bị xóa.')
          return
        }

        // Kiểm tra quyền: chỉ chủ nhân bài thi hoặc Admin mới được xem
        if (data.user_id !== user.id && !isUserAdmin) {
          setErrorMsg('Bạn không có quyền xem lại kết quả bài thi của thí sinh khác.')
          return
        }

        // Kiểm tra cờ allow_review
        if (data.exams?.allow_review === false && !isUserAdmin) {
          setErrorMsg('Hội đồng khảo thí đã khóa quyền xem lại đáp án và lời giải chi tiết cho đề thi này.')
          return
        }

        setSubmission(data)
      } catch (err: any) {
        setErrorMsg(err.message || 'Lỗi khi tải kết quả bài thi.')
      } finally {
        setLoading(false)
      }
    }

    loadSubmission()
  }, [submissionId, router])

  // PDF URL
  const pdfUrl = useMemo(() => {
    if (!submission?.exams) return ''
    if (submission.exams.drive_file_id) {
      return `https://drive.google.com/file/d/${submission.exams.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`
    }
    return submission.exams.pdf_url || ''
  }, [submission])

  // Danh sách các phần thi
  const activeSections: any[] = useMemo(() => {
    if (!submission?.exams?.exam_structure || !Array.isArray(submission.exams.exam_structure)) return []
    return submission.exams.exam_structure
  }, [submission])

  // Tính toán toàn bộ câu hỏi flat
  const { allQuestions, totalCount } = useMemo(() => {
    const list: any[] = []
    let count = 0

    activeSections.forEach((sec: any) => {
      const qCount = parseInt(sec.questionCount) || 0
      for (let i = 0; i < qCount; i++) {
        const key = `${sec.id}-${i}`
        const rawType =
          sec.questionTypeMode === 'custom' && sec.questionTypes?.[i]
            ? sec.questionTypes[i]
            : sec.type
        const qType = normalizeQuestionType(rawType, sec, i)

        list.push({
          sectionId: sec.id,
          sectionName: sec.name,
          qIdx: i,
          globalNum: count + i + 1,
          key,
          type: qType,
          section: sec,
        })
      }
      count += qCount
    })

    return { allQuestions: list, totalCount: count }
  }, [activeSections])

  // Kiểm tra câu hỏi đúng / sai
  const checkQuestionStatus = (q: any) => {
    const { key, type, qIdx, section } = q
    const studentAns = submission?.answers?.[key]
    const correctMap = section?.correctAnswers || {}
    const correctAns = correctMap[qIdx] !== undefined ? correctMap[qIdx] : correctMap[String(qIdx)]
    const score = Number(submission?.detailed_scores?.[key]) || 0

    if (type === 'single_choice') {
      const sVal = String(studentAns || '').trim().toUpperCase()
      const cVal = String(correctAns || '').trim().toUpperCase()
      const isRight = sVal !== '' && cVal !== '' && sVal === cVal
      return { isRight, isPartial: false, studentAns: sVal || 'Chưa chọn', correctAns: cVal || '-' }
    }

    if (type === 'true_false') {
      const sObj = studentAns || {}
      const cObj = correctAns || {}
      let matchedCount = 0
      ;['a', 'b', 'c', 'd'].forEach((sub) => {
        const uVal = String(sObj[sub] || '').toUpperCase()
        const cVal = String(cObj[sub] || '').toUpperCase()
        const isUTrue = uVal === 'Đ' || uVal === 'T' || uVal === 'TRUE' || uVal === '1'
        const isUFalse = uVal === 'S' || uVal === 'F' || uVal === 'FALSE' || uVal === '0'
        const isCTrue = cVal === 'Đ' || cVal === 'T' || cVal === 'TRUE' || cVal === '1'
        const isCFalse = cVal === 'S' || cVal === 'F' || cVal === 'FALSE' || cVal === '0'
        if ((isUTrue && isCTrue) || (isUFalse && isCFalse)) {
          matchedCount++
        }
      })
      const isRight = matchedCount === 4
      const isPartial = matchedCount > 0 && matchedCount < 4
      return { isRight, isPartial, studentAns: sObj, correctAns: cObj, matchedCount }
    }

    if (type === 'short_answer') {
      const sVal = String(studentAns || '').trim().toLowerCase().replace(/\s+/g, '')
      const cVal = String(correctAns || '').trim().toLowerCase().replace(/\s+/g, '')
      const isRight = sVal !== '' && (sVal === cVal || sVal.replace(',', '.') === cVal.replace(',', '.'))
      return { isRight, isPartial: false, studentAns: studentAns || 'Chưa điền', correctAns: correctAns || '-' }
    }

    if (type === 'essay') {
      const isRight = score > 0
      return { isRight, isPartial: false, studentAns: studentAns || 'Chưa làm', correctAns: correctAns || 'Được chấm bởi ban giám khảo' }
    }

    return { isRight: false, isPartial: false, studentAns: studentAns || 'N/A', correctAns: correctAns || 'N/A' }
  }

  // Thống kê số câu đúng
  const stats = useMemo(() => {
    let rightCount = 0
    allQuestions.forEach((q) => {
      const { isRight } = checkQuestionStatus(q)
      if (isRight) rightCount++
    })
    return {
      rightCount,
      wrongCount: totalCount - rightCount,
      percent: totalCount > 0 ? Math.round((rightCount / totalCount) * 100) : 0,
    }
  }, [allQuestions, totalCount, submission])

  // Lọc câu hỏi theo Tab
  const filteredQuestions = useMemo(() => {
    if (activeTab === 'all') return allQuestions
    return allQuestions.filter((q) => {
      const { isRight } = checkQuestionStatus(q)
      return activeTab === 'correct' ? isRight : !isRight
    })
  }, [allQuestions, activeTab, submission])

  // Gọi SenAI giải thích câu hỏi
  const handleAskAI = async (q: any) => {
    const key = q.key
    const currentState = aiStates[key] || {
      isOpen: true,
      questionText: '',
      response: '',
      isLoading: false,
    }

    if (currentState.isLoading) return

    setAiStates((prev) => ({
      ...prev,
      [key]: { ...currentState, isOpen: true, isLoading: true, response: '' },
    }))

    const { studentAns, correctAns } = checkQuestionStatus(q)
    const formattedStudent = typeof studentAns === 'object' ? JSON.stringify(studentAns) : String(studentAns)
    const formattedCorrect = typeof correctAns === 'object' ? JSON.stringify(correctAns) : String(correctAns)

    const prompt = `Bạn là SenAI Gia Sư Khảo Thí Thông Minh trong hệ thống Safe Exam Browser (SEB).
Học sinh đang xem lại kết quả bài thi: "${submission?.exams?.title}".
Thông tin câu hỏi:
- Câu số: ${q.globalNum} (${q.sectionName})
- Dạng câu: ${q.type}
- Đáp án thí sinh đã chọn: ${formattedStudent}
- Đáp án chính xác của đề thi: ${formattedCorrect}
${currentState.questionText ? `- Câu hỏi thắc mắc thêm từ học sinh: "${currentState.questionText}"` : ''}

Nhiệm vụ của bạn:
1. Giải thích chi tiết, cặn kẽ từng bước tại sao đáp án hệ thống lại là đáp án đúng.
2. Trình bày công thức Toán học bằng chuẩn LaTeX (dùng $ cho inline math và $$ cho block math).
3. Chỉ ra nguyên nhân học sinh hay nhầm lẫn ở câu này.
4. Rút ra phương pháp giải nhanh và mẹo ghi nhớ.
5. Giọng văn khuyến khích, ân cần, xưng "Mình" gọi "Bạn".`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      })
      const data = await res.json()
      if (res.ok && data.text) {
        setAiStates((prev) => ({
          ...prev,
          [key]: { ...currentState, isOpen: true, isLoading: false, response: data.text },
        }))
      } else {
        throw new Error(data.error || 'Không thể kết nối đến máy chủ AI')
      }
    } catch (err: any) {
      setAiStates((prev) => ({
        ...prev,
        [key]: {
          ...currentState,
          isOpen: true,
          isLoading: false,
          response: 'SenAI tạm thời gặp gián đoạn kết nối. Bạn vui lòng bấm thử lại sau giây lát nhé! 😥',
        },
      }))
    }
  }

  // MÀN HÌNH LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
          <span className="text-xs font-bold text-slate-600">
            Đang tải dữ liệu bài làm & báo cáo khảo thí...
          </span>
        </div>
      </div>
    )
  }

  // MÀN HÌNH BÁO LỖI / KHÓA
  if (errorMsg || !submission) {
    return (
      <div
        className={`min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-800 ${headingFont.variable} ${bodyFont.variable}`}
        style={{ fontFamily: 'var(--font-seb-body)' }}
      >
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-xl p-6 sm:p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-3xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'var(--font-seb-heading)' }}>
            Thông Báo Khảo Thí
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">{errorMsg}</p>
          <div className="pt-2">
            <Link
              href="/seb-dashboard"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Về Trang Chủ Khảo Thí SEB</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const scoreNum = Number(submission.score) || 0
  const isGood = scoreNum >= 8
  const exam = submission.exams
  const submittedDate = (submission.submitted_at || submission.created_at)
    ? new Date(submission.submitted_at || submission.created_at).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A'

  return (
    <div
      className={`h-screen w-full flex flex-col bg-slate-50 text-slate-800 antialiased overflow-hidden ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-seb-body)' }}
    >
      {/* 🌟 TOPBAR NAVIGATION */}
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-sky-100 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/seb-profile"
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition shrink-0"
            title="Quay lại Hồ sơ Bảng điểm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="hidden sm:block shrink-0">
            <SebLogo size={30} showText={false} />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-100 text-sky-700">
                {exam?.exam_type || 'BÀI THI SEB'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold hidden md:inline">
                Khảo thí bảo mật cao
              </span>
            </div>
            <h1
              className="text-sm sm:text-base font-black text-slate-900 truncate"
              style={{ fontFamily: 'var(--font-seb-heading)' }}
            >
              {exam?.title}
            </h1>
          </div>
        </div>

        {/* BÊN PHẢI: THÔNG TIN THÍ SINH & ĐIỂM SỐ */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[11px] font-bold text-slate-700 flex items-center justify-end gap-1">
              <User className="h-3 w-3 text-sky-600" />
              {submission.profiles?.full_name || currentUser.email}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{submittedDate}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200/80 shadow-2xs">
            <Award className="h-4 w-4 text-sky-600" />
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-400 block leading-none">
                Điểm Số
              </span>
              <span className={`text-base font-black leading-none ${isGood ? 'text-emerald-600' : 'text-sky-600'}`}>
                {scoreNum.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 🌟 BODY 2 CỘT (SPLIT SCREEN) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* CỘT TRÁI: TÀI LIỆU PDF ĐỀ THI */}
        <div className="h-[40vh] lg:h-full lg:flex-1 bg-slate-100 border-b lg:border-b-0 lg:border-r border-sky-100 relative flex flex-col">
          <div className="h-10 px-4 bg-white border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-600 shrink-0">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-sky-600" />
              <span>Đề Thi Gốc (PDF)</span>
            </span>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1"
                title="Mở PDF toàn màn hình"
              >
                <span>Mở cửa sổ mới</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex-1 relative bg-slate-200/50">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="absolute inset-0 w-full h-full border-none"
                title="Tài liệu đề thi PDF"
                allow="autoplay"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <FileText className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-600">Không có tệp PDF đính kèm</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Đề thi này không cấu hình file đề PDF hoặc link xem trước đang được cập nhật.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BẢNG CHẤM ĐIỂM & ĐỐI CHIẾU LỜI GIẢI CHI TIẾT */}
        <div className="h-[60vh] lg:h-full w-full lg:w-[540px] xl:w-[620px] bg-white flex flex-col shrink-0">
          {/* Header Bảng Điều Khiển Lọc & Thống Kê Nhanh */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0 shadow-2xs">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Số Câu Đúng</span>
                <span className="text-base font-black text-emerald-600">
                  {stats.rightCount} / {totalCount}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Độ Chính Xác</span>
                <span className="text-base font-black text-sky-600">{stats.percent}%</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Chuyển Tab</span>
                <span className="text-base font-black text-amber-600">
                  {submission.tab_switches || 0} lần
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  activeTab === 'all'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất Cả ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('wrong')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  activeTab === 'wrong'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Câu Sai / Chưa Đạt ({stats.wrongCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('correct')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  activeTab === 'correct'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Câu Đúng ({stats.rightCount})
              </button>
            </div>
          </div>

          {/* Danh Sách Từng Câu Hỏi */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
            {filteredQuestions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium">
                Không có câu hỏi nào trong bộ lọc này.
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const { isRight, isPartial, studentAns, correctAns } = checkQuestionStatus(q)
                const qScore = Number(submission?.detailed_scores?.[q.key]) || 0
                const aiState = aiStates[q.key] || {
                  isOpen: false,
                  questionText: '',
                  response: '',
                  isLoading: false,
                }

                return (
                  <div
                    key={q.key}
                    className={`rounded-2xl border bg-white p-4 space-y-3 transition-all ${
                      isRight
                        ? 'border-emerald-200/80 shadow-2xs'
                        : isPartial
                        ? 'border-amber-200/80 shadow-2xs'
                        : 'border-rose-200/80 shadow-2xs'
                    }`}
                  >
                    {/* Header Câu Hỏi */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isRight
                              ? 'bg-emerald-100 text-emerald-700'
                              : isPartial
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isRight ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isPartial ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900">Câu {q.globalNum}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-bold uppercase">
                            {q.type === 'single_choice'
                              ? 'Trắc Nghiệm Đơn'
                              : q.type === 'true_false'
                              ? 'Đúng / Sai 4 Ý'
                              : q.type === 'short_answer'
                              ? 'Trả Lời Ngắn'
                              : 'Tự Luận'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                            qScore > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          +{qScore.toFixed(2)} đ
                        </span>
                      </div>
                    </div>

                    {/* VÙNG ĐỐI CHIẾU ĐÁP ÁN */}
                    {q.type === 'true_false' ? (
                      <div className="space-y-1.5 pt-1">
                        {['a', 'b', 'c', 'd'].map((sub) => {
                          const uVal = String(studentAns?.[sub] || '').toUpperCase()
                          const cVal = String(correctAns?.[sub] || '').toUpperCase()
                          const isSubRight =
                            (uVal === 'Đ' && cVal === 'Đ') || (uVal === 'S' && cVal === 'S')

                          return (
                            <div
                              key={sub}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs border ${
                                isSubRight
                                  ? 'bg-emerald-50/50 border-emerald-200/60'
                                  : 'bg-rose-50/50 border-rose-200/60'
                              }`}
                            >
                              <span className="font-bold text-slate-700 uppercase">Ý {sub})</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-500">
                                  Bạn chọn:{' '}
                                  <strong className={isSubRight ? 'text-emerald-700' : 'text-rose-700'}>
                                    {uVal || 'Bỏ trống'}
                                  </strong>
                                </span>
                                <span className="text-[11px] text-slate-700">
                                  Đáp án đúng: <strong className="text-emerald-700">{cVal || '-'}</strong>
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div
                          className={`p-2.5 rounded-xl border text-xs ${
                            isRight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                            Bạn đã chọn
                          </span>
                          <span
                            className={`font-black text-sm ${
                              isRight ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {String(studentAns)}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-0.5">
                            Đáp án chính xác
                          </span>
                          <span className="font-black text-sm text-emerald-700">
                            {String(correctAns)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* VÙNG SENAI GIA SƯ GIẢI THÍCH CHI TIẾT */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            if (!aiState.response && !aiState.isLoading) {
                              handleAskAI(q)
                            } else {
                              setAiStates((prev) => ({
                                ...prev,
                                [q.key]: { ...aiState, isOpen: !aiState.isOpen },
                              }))
                            }
                          }}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 transition"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>
                            {aiState.response
                              ? aiState.isOpen
                                ? 'Thu gọn phân tích SenAI'
                                : 'Mở rộng phân tích SenAI'
                              : 'Hỏi SenAI Gia Sư Lời Giải & Phân Tích Lỗi'}
                          </span>
                          {aiState.isOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {aiState.isOpen && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                          {aiState.isLoading ? (
                            <div className="flex items-center gap-2 py-4 text-xs font-bold text-sky-700 justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                              <span>SenAI đang đọc dữ liệu đề và phân tích chi tiết...</span>
                            </div>
                          ) : aiState.response ? (
                            <div className="text-xs text-slate-800 leading-relaxed space-y-2">
                              <div className="flex items-center gap-1.5 text-sky-700 font-bold border-b border-sky-100 pb-1.5">
                                <Bot className="h-4 w-4 text-sky-600" />
                                <span>Lời giải chi tiết từ SenAI:</span>
                              </div>
                              <div className="markdown-body text-xs">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{
                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-bold text-sky-900" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                    ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-xs font-black text-slate-900 mt-2 mb-1" {...props} />,
                                    table: ({ node, ...props }) => (
                                      <div className="overflow-x-auto my-2 rounded-xl border border-sky-200">
                                        <table className="w-full text-left border-collapse text-xs" {...props} />
                                      </div>
                                    ),
                                    th: ({ node, ...props }) => <th className="p-2 bg-sky-100/60 font-bold" {...props} />,
                                    td: ({ node, ...props }) => <td className="p-2 border-t border-sky-100" {...props} />,
                                  }}
                                >
                                  {aiState.response}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : null}

                          {/* Khung Hỏi Tiếp Trợ Lý AI */}
                          <div className="flex items-center gap-2 pt-1 border-t border-sky-100/80">
                            <input
                              type="text"
                              value={aiState.questionText || ''}
                              onChange={(e) =>
                                setAiStates((prev) => ({
                                  ...prev,
                                  [q.key]: { ...aiState, questionText: e.target.value },
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAskAI(q)
                              }}
                              placeholder="Hỏi thêm SenAI về câu này..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-sky-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-400/20"
                            />
                            <button
                              type="button"
                              disabled={aiState.isLoading}
                              onClick={() => handleAskAI(q)}
                              className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition disabled:opacity-50"
                              title="Gửi câu hỏi"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
