'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, BookOpen, PenTool, 
  Sparkles, Send, Bot, Loader2, Award, ChevronRight, AlertCircle, 
  FileText, Layers, User, ImageIcon, Paperclip, Trash2
} from 'lucide-react'

// ============================================================================
// THƯ VIỆN RENDER MARKDOWN & TOÁN HỌC (BẢNG, CÔNG THỨC)
// ============================================================================
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

// ============================================================================
// MATERIAL DESIGN 3 + LIQUID GLASS CONSTANTS
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-[#2A2A2A] rounded-2xl px-5 py-4 outline-none transition-all font-medium text-slate-900 dark:text-white text-sm shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500"

// ============================================================================
// INTERFACES & TYPES
// ============================================================================
type ChatFile = { url: string; base64: string; mimeType: string; isPdf: boolean; name: string }

interface AIQuestionState {
  isOpen: boolean;
  questionText: string;
  files: ChatFile[]; // 🌟 Thêm mảng chứa file đính kèm
  response: string;
  isLoading: boolean;
}

export default function StudentReviewPage() {
  const params = useParams()
  const router = useRouter()
  
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const [aiStates, setAiStates] = useState<Record<string, AIQuestionState>>({})

  // ============================================================================
  // KHỞI TẠO VÀ NẠP DỮ LIỆU
  // ============================================================================
  useEffect(() => {
    const fetchSubmissionData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) { 
        router.push('/login'); 
        return; 
      }

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *, 
          exams (
            title, exam_structure, drive_file_id, allow_review, exam_type
          ),
          profiles ( full_name )
        `)
        .eq('id', params.id as string)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        alert('Hệ thống không tìm thấy dữ liệu bài làm hoặc bạn không có quyền truy cập!')
        router.push('/dashboard')
        return
      }

      if (!data.exams?.allow_review) {
        alert('Hội đồng thi đã khóa quyền xem lại cấu phần câu hỏi này để bảo mật đề thi!')
        router.push('/dashboard')
        return
      }

      setSubmission(data)
      setLoading(false)
    }

    fetchSubmissionData()

    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) {
      document.documentElement.classList.add('dark')
    }
    setIsDark(dark)
  }, [params.id, router])

  // ============================================================================
  // CÁC HÀM XỬ LÝ FILE (UPLOAD & PASTE)
  // ============================================================================
  
  const handleFileUpload = (key: string, fileList: FileList | File[]) => {
    Array.from(fileList).forEach(file => {
      const isPdf = file.type === 'application/pdf'
      if (!isPdf && !file.type.startsWith('image/')) { 
        alert('Hệ thống chỉ hỗ trợ phân tích file PDF hoặc Hình ảnh.'); 
        return 
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1]
        const newFile = { url: URL.createObjectURL(file), base64: base64Data, mimeType: file.type, isPdf, name: file.name }
        
        setAiStates(prev => {
          const curr = prev[key] || { isOpen: true, questionText: '', files: [], response: '', isLoading: false }
          return { ...prev, [key]: { ...curr, files: [...curr.files, newFile] } }
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, key: string) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault(); // Chặn việc paste text rác nếu có chứa file
      handleFileUpload(key, e.clipboardData.files)
    }
  }

  const removeFile = (key: string, fileIndex: number) => {
    setAiStates(prev => {
      const curr = prev[key]
      if (!curr) return prev
      const newFiles = [...curr.files]
      newFiles.splice(fileIndex, 1)
      return { ...prev, [key]: { ...curr, files: newFiles } }
    })
  }

  // ============================================================================
  // CÁC HÀM XỬ LÝ DỮ LIỆU ĐÁP ÁN (PARSERS)
  // ============================================================================
  
  const parseStudentAnswer = (ans: any, type?: string) => {
    if (ans === undefined || ans === null || ans === '') return <span className="text-slate-400 dark:text-slate-500 italic font-medium">Bỏ trống</span>
    if (type === 'true_false' && typeof ans === 'object' && !Array.isArray(ans)) {
      return ['a', 'b', 'c', 'd'].map(k => `${k.toUpperCase()}: ${ans[k] || '-'}`).join(' | ')
    }
    if (typeof ans === 'object') {
      if (Array.isArray(ans)) return ans.join(', ') 
      if (ans.text) return ans.text 
      if (ans.file_url) return 'Có tệp đính kèm' 
      return JSON.stringify(ans)
    }
    return String(ans)
  }

  const isQuestionFullyCorrect = (studentAns: any, correctAns: any, type: string, score: number) => {
    if (type === 'essay') return score > 0;
    if (type === 'multiple_choice') {
      return Array.isArray(studentAns) && Array.isArray(correctAns) && 
             studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v));
    }
    if (type === 'true_false') {
      return typeof studentAns === 'object' && typeof correctAns === 'object' && 
             ['a','b','c','d'].every(sub => studentAns[sub] === correctAns[sub]);
    }
    return String(studentAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase();
  }

  // ============================================================================
  // HÀM GỌI API GEMINI - TÍCH HỢP SEN AI GIA SƯ 1:1
  // ============================================================================
  const handleAskSenAI = async (questionKey: string, studentAns: any, correctAns: any, type: string) => {
    const currentState = aiStates[questionKey]
    
    // Yêu cầu phải có Text hoặc File mới gọi AI
    if ((!currentState?.questionText.trim() && (!currentState?.files || currentState.files.length === 0)) || currentState?.isLoading) return

    setAiStates(prev => ({ 
      ...prev, 
      [questionKey]: { ...currentState, isLoading: true, response: '' } 
    }))

    const parsedStudent = typeof studentAns === 'object' ? JSON.stringify(studentAns) : String(studentAns || 'Bỏ trống')
    const parsedCorrect = typeof correctAns === 'object' ? JSON.stringify(correctAns) : String(correctAns)
    
    const prompt = `Học sinh đang xem lại bài kiểm tra và làm sai (hoặc chưa hiểu) một câu hỏi.
Dưới đây là thông tin câu hỏi:
- Nội dung câu hỏi/công thức: "${currentState.questionText || '[Học sinh đã đính kèm trong Hình ảnh/PDF]'}"
- Đáp án học sinh đã chọn: ${parsedStudent}
- Đáp án đúng của hệ thống: ${parsedCorrect}
- Dạng câu hỏi: ${type}

Nhiệm vụ của bạn (SenAI - Gia sư AI chuyên nghiệp):
1. Đọc hình ảnh/PDF đính kèm (nếu có) để nhận diện các công thức Toán, Vật Lí, Hóa Học phức tạp.
2. Giải thích cặn kẽ, từng bước một tại sao đáp án hệ thống lại là đáp án đúng. Trình bày các công thức Toán học bằng chuẩn LaTeX (dùng $ và $$).
3. Phân tích lỗi sai trong tư duy hoặc lỗi tính toán khiến học sinh chọn đáp án sai kia.
4. Rút ra bài học, cung cấp công thức, định lý hoặc mẹo ghi nhớ để học sinh khắc phục.

Yêu cầu định dạng:
- Trình bày cực kỳ thân thiện, xưng "Mình" gọi "Bạn".
- Dùng Markdown rõ ràng (Bullet points, Bảng, In đậm chữ quan trọng).`

    const payloadImages = (currentState.files || []).map(f => ({
      mimeType: f.mimeType,
      base64: f.base64
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [], images: payloadImages }),
      })

      const data = await response.json()

      if (response.ok && data.text) {
        setAiStates(prev => ({ 
          ...prev, 
          [questionKey]: { ...currentState, isLoading: false, response: data.text } 
        }))
      } else {
        throw new Error(data.error || 'Lỗi xử lý từ hệ thống AI của Google')
      }
    } catch (error) {
      setAiStates(prev => ({ 
        ...prev, 
        [questionKey]: { 
          ...currentState, 
          isLoading: false, 
          response: 'Xin lỗi bạn, SenAI đang gặp sự cố kết nối máy chủ. Bạn hãy kiểm tra lại mạng hoặc thử bấm hỏi lại sau ít phút nhé! 😥' 
        } 
      }))
    }
  }

  // ============================================================================
  // RENDER UI CHÍNH
  // ============================================================================

  if (loading) {
    if (newUiEnabled) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang kết xuất báo cáo điểm số..." />
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]">
        <Loader2 className="w-14 h-14 animate-spin text-indigo-600 dark:text-indigo-400 mb-6 drop-shadow-lg" />
        <p className="font-black text-slate-500 uppercase tracking-widest text-sm animate-pulse">Đang kết xuất báo cáo điểm số...</p>
        <p className="text-xs text-slate-400 mt-2 font-medium">Việc này có thể mất vài giây để đồng bộ toàn bộ ma trận đề.</p>
      </div>
    )
  }

  const pdfUrl = `https://drive.google.com/file/d/${submission.exams?.drive_file_id}/preview`

  if (newUiEnabled) {
    return (
      <div
        className="h-screen w-full flex flex-col overflow-hidden font-sans"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <header className="min-h-[72px] md:h-[88px] flex items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 py-3 shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button onClick={() => router.push('/dashboard')} className="p-2.5 sm:p-3 rounded-full shrink-0" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="font-semibold text-sm sm:text-base flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 hidden sm:block shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">
                  <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>Báo cáo Kết quả: </span>
                  <span style={{ color: 'var(--accent)' }}>{submission.exams?.title}</span>
                </span>
              </h1>
              <p className="hidden sm:flex text-[11px] font-medium mt-1 items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <User className="w-3.5 h-3.5" /> Thí sinh: {submission.profiles?.full_name}
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }}></span>
                Nộp bài: {new Date(submission.created_at).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full shrink-0" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
            <Award className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} />
            <div className="flex flex-col justify-center">
              <p className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest leading-none mb-1" style={{ color: 'var(--accent)' }}>Tổng điểm đạt được</p>
              <p className="text-base sm:text-xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
                {submission.is_graded ? String(submission.score).replace('.', ',') : 'Đang chờ chấm'}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[38vh] md:h-full relative" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            {submission.exams?.drive_file_id ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay" title="Tài liệu PDF Đề thi"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <FileText className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                </div>
                <h3 className="font-semibold text-base mb-1.5">Không tìm thấy tài liệu gốc</h3>
                <p className="font-medium text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>Người ra đề không đính kèm tệp PDF cho bài kiểm tra này, hoặc tệp đã bị xóa khỏi hệ thống máy chủ Drive.</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[62vh] md:h-full overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5 lg:space-y-6 custom-scrollbar shrink-0" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
            <div className="text-base font-semibold flex items-center gap-2 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <BookOpen className="w-5 h-5" style={{ color: 'var(--accent)' }} /> Phân tích đánh giá chi tiết
            </div>

            {submission.feedback && (
              <div className="p-5 rounded-2xl" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Nhận xét từ Hội đồng thi
                </h3>
                <p className="text-sm font-medium leading-relaxed italic">"{submission.feedback}"</p>
              </div>
            )}

            <div className="space-y-6 md:space-y-8">
              {submission.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center gap-2.5 py-2.5 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-sm font-semibold uppercase tracking-tight" style={{ color: 'var(--text-muted)' }}>{section.name}</h2>
                  </div>

                  <div className="space-y-4">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const studentAns = submission.answers?.[key]
                      const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                      const questionScore = submission.detailed_scores?.[key] ?? 0

                      let currentType = section.type
                      if (section.type === 'mixed' && section.mixedRanges) {
                        const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                        currentType = range ? range.type : 'short_answer'
                      }

                      const isRight = isQuestionFullyCorrect(studentAns, correctAns, currentType, questionScore)
                      const aiState = aiStates[key] || { isOpen: false, questionText: '', files: [], response: '', isLoading: false }
                      const stateColor = isRight ? '#059669' : '#DC2626'

                      return (
                        <div key={qIdx} className="p-4 sm:p-5 rounded-2xl" style={{ background: 'var(--bg)', border: `1px solid ${isRight ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-full flex items-center justify-center font-semibold" style={{ background: isRight ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)', color: stateColor }}>
                                {isRight ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              </span>
                              <span className="font-semibold text-sm">Câu {qIdx + 1}</span>
                              <span className="text-[9px] uppercase font-semibold tracking-widest px-2 py-1 rounded-md" style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                {currentType.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: isRight ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: stateColor }}>
                              +{String(questionScore).replace('.', ',')}
                            </span>
                          </div>

                          {currentType === 'true_false' ? (
                            <div className="flex flex-col gap-2">
                              {['a', 'b', 'c', 'd'].map(subLabel => {
                                const sA = studentAns?.[subLabel]
                                const cA = correctAns?.[subLabel]
                                const isSubRight = sA && cA && String(sA).trim().toLowerCase() === String(cA).trim().toLowerCase()
                                return (
                                  <div key={subLabel} className="flex justify-between items-center text-xs p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                    <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Ý {subLabel.toUpperCase()}: <span className="font-bold text-[13px]" style={{ color: isSubRight ? '#059669' : '#DC2626' }}>{sA || 'Trống'}</span></span>
                                    <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Đáp án đúng: <span className="font-bold text-[13px]" style={{ color: '#059669' }}>{cA || '-'}</span></span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                              <div className="pr-2" style={{ borderRight: '1px solid var(--border)' }}>
                                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Lựa chọn của bạn</p>
                                <p className="font-semibold text-[15px]" style={{ color: stateColor }}>{parseStudentAnswer(studentAns, currentType)}</p>
                              </div>
                              <div className="pl-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Đáp án hệ thống</p>
                                <p className="font-semibold text-[15px]" style={{ color: '#059669' }}>
                                  {currentType === 'essay' ? <span className="italic text-sm" style={{ color: '#D97706' }}>Giáo viên chấm thủ công</span> : parseStudentAnswer(correctAns, currentType)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* WIDGET SEN AI GIA SƯ ĐA PHƯƠNG THỨC — logic không đổi, chỉ đổi giao diện flat Modern */}
                          {!isRight && currentType !== 'essay' && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                              {!aiState.isOpen ? (
                                <button
                                  onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, isOpen: true } }))}
                                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
                                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                                >
                                  <Sparkles className="w-4 h-4" /> Phân tích lỗi sai cùng Gia sư SenAI
                                </button>
                              ) : (
                                <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                  <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'var(--accent)' }}></div>

                                  {!aiState.response && !aiState.isLoading ? (
                                    <>
                                      <div className="flex items-start gap-3 mb-4 mt-1">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                                          <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="pt-0.5">
                                          <h4 className="font-semibold text-sm mb-1">Chào bạn, mình là SenAI! 👋</h4>
                                          <p className="text-[13px] font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                            Nếu câu hỏi chứa <strong style={{ color: 'var(--accent)' }}>công thức phức tạp</strong>, bạn có thể <strong style={{ color: 'var(--accent)' }}>Copy và Dán ảnh (Ctrl+V)</strong> trực tiếp vào khung dưới, hoặc đính kèm file nhé!
                                          </p>
                                        </div>
                                      </div>

                                      <div className="relative rounded-xl mb-4 overflow-hidden p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                        {aiState.files && aiState.files.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mb-2 p-2">
                                            {aiState.files.map((f, i) => (
                                              <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden group shrink-0" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                                                {f.isPdf ? <div className="w-full h-full flex items-center justify-center"><FileText className="w-6 h-6" style={{ color: 'var(--text-muted)' }} /></div> : <img src={f.url} alt="Uploaded file" className="w-full h-full object-cover" />}
                                                <button onClick={() => removeFile(key, i)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4 text-rose-400" /></button>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        <textarea
                                          value={aiState.questionText}
                                          onChange={(e) => setAiStates(prev => ({ ...prev, [key]: { ...aiState, questionText: e.target.value } }))}
                                          onPaste={(e) => handlePaste(e, key)}
                                          placeholder="✏️ Dán nội dung câu hỏi hoặc dán Ảnh trực tiếp vào đây..."
                                          className="w-full bg-transparent p-2 text-sm font-medium outline-none min-h-[80px] resize-none custom-scrollbar"
                                          style={{ color: 'var(--text)' }}
                                        />

                                        <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                                          <div className="flex gap-2 pl-1">
                                            <input type="file" id={`file-upload-${key}`} multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(key, e.target.files || [])} />
                                            <label htmlFor={`file-upload-${key}`} className="p-1.5 rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }} title="Đính kèm Ảnh/PDF">
                                              <ImageIcon className="w-5 h-5" />
                                            </label>
                                          </div>
                                          <div className="text-[10px] font-medium hidden sm:block italic pr-2" style={{ color: 'var(--text-muted)' }}>Hỗ trợ Paste (Ctrl+V) ảnh trực tiếp</div>
                                        </div>
                                      </div>

                                      <div className="flex justify-end gap-3">
                                        <button
                                          onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, isOpen: false } }))}
                                          className="px-5 py-2.5 rounded-full text-xs font-semibold transition-colors"
                                          style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                        >
                                          Đóng lại
                                        </button>
                                        <button
                                          onClick={() => handleAskSenAI(key, studentAns, correctAns, currentType)}
                                          disabled={!aiState.questionText.trim() && (!aiState.files || aiState.files.length === 0)}
                                          className="px-6 py-2.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                                          style={{ background: 'var(--accent)', color: '#fff' }}
                                        >
                                          Gửi cho AI Phân tích <Send className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                                        {aiState.isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" style={{ color: '#D97706' }} />}
                                      </div>
                                      <div className="flex-1 min-w-0 pt-1">
                                        <h4 className="font-semibold text-sm mb-3 uppercase tracking-widest pb-2 inline-flex items-center gap-2" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>
                                          <Bot className="w-4 h-4" /> SenAI Phân Tích:
                                        </h4>

                                        {aiState.isLoading ? (
                                          <div className="space-y-2 mt-2">
                                            <p className="text-sm font-semibold animate-pulse" style={{ color: 'var(--text-muted)' }}>Mình đang đọc dữ liệu đề và mổ xẻ nguyên nhân sai của bạn...</p>
                                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                                              <div className="w-1/2 h-full rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDuration: '2s' }}></div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm font-medium leading-relaxed p-4 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                            <div className="markdown-content">
                                              <ReactMarkdown
                                                remarkPlugins={[remarkMath, remarkGfm]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                                  strong: ({node, ...props}) => <strong className="font-bold" style={{ color: 'var(--accent)' }} {...props} />,
                                                  ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                                  ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                                  li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                                  h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-3" {...props} />,
                                                  table: ({node, ...props}) => (
                                                    <div className="overflow-x-auto my-4 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                                                      <table className="w-full text-left border-collapse text-sm min-w-full" {...props} />
                                                    </div>
                                                  ),
                                                  thead: ({node, ...props}) => <thead style={{ background: 'var(--surface)', color: 'var(--text-muted)' }} {...props} />,
                                                  tbody: ({node, ...props}) => <tbody {...props} />,
                                                  tr: ({node, ...props}) => <tr {...props} />,
                                                  th: ({node, ...props}) => <th className="px-4 py-3 font-bold" style={{ borderRight: '1px solid var(--border)' }} {...props} />,
                                                  td: ({node, ...props}) => <td className="px-4 py-3 align-top" style={{ borderRight: '1px solid var(--border)' }} {...props} />,
                                                }}
                                              >
                                                {aiState.response}
                                              </ReactMarkdown>
                                            </div>

                                            <div className="mt-4 pt-3 flex justify-end" style={{ borderTop: '1px solid var(--border)' }}>
                                              <button
                                                onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, response: '', questionText: '', files: [] } }))}
                                                className="text-[11px] font-semibold transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full"
                                                style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
                                              >
                                                <ChevronRight className="w-4 h-4" /> Phân tích lại câu này
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-16"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative transition-colors duration-500">
      
      {/* 🌟 NỀN AMBIENT */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/5 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 🌟 HEADER APP BAR */}
      <header className="min-h-[72px] md:h-[88px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 py-3 shrink-0 z-20 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0 flex-1">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2.5 sm:p-3.5 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-transform active:scale-95 rounded-full shadow-inner group border border-slate-200/50 dark:border-white/5 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform"/>
          </button>

          <div className="flex flex-col justify-center min-w-0">
            <h1 className="font-black text-sm sm:text-lg md:text-xl flex items-center gap-2 sm:gap-2.5 tracking-tight text-slate-900 dark:text-white min-w-0">
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="truncate">
                <span className="hidden sm:inline">Báo cáo Kết quả: </span>
                <span className="text-indigo-600 dark:text-indigo-400">{submission.exams?.title}</span>
              </span>
            </h1>
            <p className="hidden sm:flex text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 items-center gap-2">
              <User className="w-3.5 h-3.5"/> Thí sinh: {submission.profiles?.full_name}
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              Nộp bài: {new Date(submission.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Khối Điểm Tổng Kết */}
        <div className="flex items-center gap-2 sm:gap-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 px-3 sm:px-6 py-2 sm:py-3 rounded-full border border-indigo-100 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-shadow shrink-0">
          <Award className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-600 dark:text-indigo-400 drop-shadow-sm"/>
          <div className="flex flex-col justify-center">
            <p className="hidden sm:block text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1">Tổng điểm đạt được</p>
            <p className="text-base sm:text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none tracking-tighter">
              {submission.is_graded ? String(submission.score).replace('.', ',') : 'Đang chờ chấm'}
            </p>
          </div>
        </div>
      </header>

      {/* 🌟 WORKSPACE CHÍNH */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden z-10 bg-transparent">
        
        {/* CỘT TRÁI: PDF VIEWER */}
        <div className="flex-1 h-[40vh] md:h-full relative bg-slate-200/50 dark:bg-[#0A0A0A] border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 shadow-inner">
          {submission.exams?.drive_file_id ? (
            <iframe 
              src={pdfUrl} 
              className="absolute inset-0 w-full h-full border-none bg-white dark:bg-[#121212]" 
              allow="autoplay"
              title="Tài liệu PDF Đề thi"
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-[#1E1E1E] rounded-3xl flex items-center justify-center mb-5 shadow-inner border border-slate-200 dark:border-white/5">
                <FileText className="w-10 h-10 text-slate-400 dark:text-slate-600"/>
              </div>
              <h3 className="font-black text-lg text-slate-700 dark:text-slate-300 mb-2">Không tìm thấy tài liệu gốc</h3>
              <p className="font-medium text-sm text-slate-500 max-w-sm leading-relaxed">Người ra đề không đính kèm tệp PDF cho bài kiểm tra này, hoặc tệp đã bị xóa khỏi hệ thống máy chủ Drive.</p>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: REVIEW & SENAI */}
        <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[60vh] md:h-full bg-slate-50 dark:bg-[#0A0A0A] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar shrink-0">
          
          <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 border-b border-slate-200 dark:border-white/10 pb-5">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/> Phân tích đánh giá chi tiết
          </div>
          
          {/* Lời phê chung */}
          {submission.feedback && (
            <div className={`${mdCard} p-6 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10`}>
              <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4"/> Nhận xét từ Hội đồng thi
              </h3>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 leading-relaxed italic">
                "{submission.feedback}"
              </p>
            </div>
          )}

          {/* Duyệt qua từng cấu trúc Phần thi */}
          <div className="space-y-8 md:space-y-10">
            {submission.exams?.exam_structure?.map((section: any) => (
              <div key={section.id} className="space-y-5">
                
                <div className="flex items-center gap-3 py-3 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-slate-50/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md z-10">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#202020] flex items-center justify-center text-slate-600 dark:text-slate-400 font-black shadow-inner">
                    <Layers className="w-4 h-4"/>
                  </div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight drop-shadow-sm">
                    {section.name}
                  </h2>
                </div>

                <div className="space-y-5">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`
                    const studentAns = submission.answers?.[key]
                    const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                    const questionScore = submission.detailed_scores?.[key] ?? 0
                    
                    let currentType = section.type
                    if (section.type === 'mixed' && section.mixedRanges) {
                      const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                      currentType = range ? range.type : 'short_answer'
                    }

                    const isRight = isQuestionFullyCorrect(studentAns, correctAns, currentType, questionScore)
                    const aiState = aiStates[key] || { isOpen: false, questionText: '', files: [], response: '', isLoading: false }

                    return (
                      <div key={qIdx} className={`${mdCard} p-5 sm:p-6 ${isRight ? 'border-emerald-200/60 dark:border-emerald-900/40 bg-white/90 dark:bg-[#1A1A1A]/90' : 'border-rose-200/60 dark:border-rose-900/40 bg-white/90 dark:bg-[#1A1A1A]/90'}`}>
                        
                        <div className="flex justify-between items-center mb-5">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${isRight ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                              {isRight ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                            </span>
                            <span className="font-black text-lg text-slate-900 dark:text-white">Câu {qIdx + 1}</span>
                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#252525] px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/5 shadow-inner">
                              {currentType.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Điểm đạt:</span>
                            <span className={`text-sm font-black px-3 py-1.5 rounded-lg shadow-sm border ${isRight ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'}`}>
                              +{String(questionScore).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        {currentType === 'true_false' ? (
                          <div className="flex flex-col gap-2 mt-2">
                            {['a','b','c','d'].map(subLabel => {
                              const sA = studentAns?.[subLabel]
                              const cA = correctAns?.[subLabel]
                              const isSubRight = sA && cA && String(sA).trim().toLowerCase() === String(cA).trim().toLowerCase()
                              return (
                                <div key={subLabel} className="flex justify-between items-center text-xs p-3 bg-slate-50 dark:bg-[#202020] rounded-xl border border-slate-100 dark:border-white/5 shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-[#252525]">
                                  <span className="text-slate-600 dark:text-slate-400 font-bold">Ý {subLabel.toUpperCase()}: <span className={isSubRight ? 'text-emerald-600 dark:text-emerald-400 ml-1.5 font-black text-[13px]' : 'text-rose-500 ml-1.5 font-black text-[13px]'}>{sA || 'Trống'}</span></span>
                                  <span className="text-slate-400 dark:text-slate-500 font-bold">Đáp án đúng: <span className="text-emerald-600 dark:text-emerald-500 ml-1.5 font-black text-[13px]">{cA || '-'}</span></span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-[#202020] p-4 sm:p-5 rounded-[1.2rem] border border-slate-100 dark:border-white/5 mt-2 shadow-sm">
                            <div className="border-r border-slate-200 dark:border-white/10 pr-2">
                              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1.5">Lựa chọn của bạn</p>
                              <p className={`font-black text-[15px] ${isRight ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {parseStudentAnswer(studentAns, currentType)}
                              </p>
                            </div>
                            <div className="pl-2">
                              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1.5">Đáp án hệ thống</p>
                              <p className="font-black text-[15px] text-emerald-600 dark:text-emerald-400">
                                {currentType === 'essay' ? <span className="text-amber-500 italic text-sm">Giáo viên chấm thủ công</span> : parseStudentAnswer(correctAns, currentType)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 🌟 HÀNG 3: WIDGET SEN AI GIA SƯ ĐA PHƯƠNG THỨC */}
                        {!isRight && currentType !== 'essay' && (
                          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5">
                            
                            {!aiState.isOpen ? (
                              <button 
                                onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, isOpen: true } }))}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-extrabold text-sm transition-all border border-indigo-100 dark:border-indigo-500/20 active:scale-[0.98] shadow-sm hover:shadow-md"
                              >
                                <Sparkles className="w-4 h-4 text-indigo-500"/> Phân tích lỗi sai cùng Gia sư SenAI
                              </button>
                            ) : (
                              <div className="bg-white dark:bg-[#161616] rounded-[1.5rem] border border-indigo-200 dark:border-indigo-500/30 p-5 shadow-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
                                
                                {!aiState.response && !aiState.isLoading ? (
                                  <>
                                    <div className="flex items-start gap-3.5 mb-5 mt-1">
                                      <div className="w-10 h-10 rounded-[12px] bg-indigo-50 dark:bg-[#202020] flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner border border-indigo-100 dark:border-white/5">
                                        <Bot className="w-5 h-5"/>
                                      </div>
                                      <div className="pt-0.5">
                                        <h4 className="font-black text-sm text-slate-900 dark:text-white mb-1">Chào bạn, mình là SenAI! 👋</h4>
                                        <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                          Nếu câu hỏi chứa <strong className="text-indigo-600 dark:text-indigo-400 font-bold">công thức phức tạp</strong>, bạn có thể <strong className="text-indigo-600 dark:text-indigo-400 font-bold">Copy và Dán ảnh (Ctrl+V)</strong> trực tiếp vào khung dưới, hoặc đính kèm file nhé!
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Khung nhập liệu Multimodal */}
                                    <div className="relative bg-slate-50 dark:bg-[#202020] border-2 border-transparent focus-within:border-indigo-500 rounded-xl transition-all shadow-inner mb-4 overflow-hidden p-2">
                                      
                                      {/* Hiển thị tệp đính kèm */}
                                      {aiState.files && aiState.files.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2 p-2">
                                          {aiState.files.map((f, i) => (
                                            <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-black group shrink-0">
                                              {f.isPdf ? <div className="w-full h-full flex items-center justify-center"><FileText className="w-6 h-6 text-slate-400"/></div> : <img src={f.url} alt="Uploaded file" className="w-full h-full object-cover"/>}
                                              <button onClick={() => removeFile(key, i)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4 text-rose-400"/></button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <textarea 
                                        value={aiState.questionText}
                                        onChange={(e) => setAiStates(prev => ({ ...prev, [key]: { ...aiState, questionText: e.target.value } }))}
                                        onPaste={(e) => handlePaste(e, key)}
                                        placeholder="✏️ Dán nội dung câu hỏi hoặc dán Ảnh trực tiếp vào đây..."
                                        className="w-full bg-transparent p-2 text-sm font-medium outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[80px] resize-none custom-scrollbar text-slate-900 dark:text-white"
                                      />
                                      
                                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                                        <div className="flex gap-2 pl-1">
                                          <input type="file" id={`file-upload-${key}`} multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(key, e.target.files || [])} />
                                          <label htmlFor={`file-upload-${key}`} className="p-1.5 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors" title="Đính kèm Ảnh/PDF">
                                            <ImageIcon className="w-5 h-5" />
                                          </label>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold hidden sm:block italic pr-2">Hỗ trợ Paste (Ctrl+V) ảnh trực tiếp</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-3">
                                      <button 
                                        onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, isOpen: false } }))}
                                        className="px-5 py-2.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm"
                                      >
                                        Đóng lại
                                      </button>
                                      <button 
                                        onClick={() => handleAskSenAI(key, studentAns, correctAns, currentType)}
                                        disabled={!aiState.questionText.trim() && (!aiState.files || aiState.files.length === 0)}
                                        className="px-6 py-2.5 rounded-full text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none shadow-md active:scale-95"
                                      >
                                        Gửi cho AI Phân tích <Send className="w-3.5 h-3.5"/>
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                                    <div className="w-12 h-12 rounded-[14px] bg-indigo-50 dark:bg-[#202020] flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner border border-indigo-100 dark:border-white/5">
                                      {aiState.isLoading ? <Loader2 className="w-6 h-6 animate-spin"/> : <Sparkles className="w-6 h-6 text-yellow-500 fill-yellow-500"/>}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                      <h4 className="font-black text-sm text-indigo-700 dark:text-indigo-400 mb-3 uppercase tracking-widest border-b border-indigo-100 dark:border-white/5 pb-2 inline-flex items-center gap-2">
                                        <Bot className="w-4 h-4"/> SenAI Phân Tích:
                                      </h4>
                                      
                                      {aiState.isLoading ? (
                                        <div className="space-y-2 mt-2">
                                          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 animate-pulse">Mình đang đọc dữ liệu đề và mổ xẻ nguyên nhân sai của bạn...</p>
                                          <div className="w-full h-2 bg-slate-100 dark:bg-[#252525] rounded-full overflow-hidden">
                                            <div className="w-1/2 h-full bg-indigo-500 rounded-full animate-bounce" style={{animationDuration: '2s'}}></div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-inner">
                                          
                                          {/* 🌟 RENDER MARKDOWN XỊN (HỖ TRỢ LATEX VÀ BẢNG) */}
                                          <div className="markdown-content">
                                            <ReactMarkdown
                                              remarkPlugins={[remarkMath, remarkGfm]}
                                              rehypePlugins={[rehypeKatex]}
                                              components={{
                                                p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                                strong: ({node, ...props}) => <strong className="font-black text-indigo-600 dark:text-indigo-400" {...props} />,
                                                ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                                ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                                h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-3" {...props} />,
                                                // Tùy chỉnh Table UI
                                                table: ({node, ...props}) => (
                                                  <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                                                    <table className="w-full text-left border-collapse text-sm min-w-full" {...props} />
                                                  </div>
                                                ),
                                                thead: ({node, ...props}) => <thead className="bg-slate-100 dark:bg-[#2A2A2A] text-slate-700 dark:text-slate-300" {...props} />,
                                                tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-200 dark:divide-white/10" {...props} />,
                                                tr: ({node, ...props}) => <tr className="hover:bg-slate-50 dark:hover:bg-[#252525] transition-colors" {...props} />,
                                                th: ({node, ...props}) => <th className="px-4 py-3 font-bold border-r last:border-r-0 border-slate-200 dark:border-white/10" {...props} />,
                                                td: ({node, ...props}) => <td className="px-4 py-3 align-top border-r last:border-r-0 border-slate-200 dark:border-white/10" {...props} />,
                                              }}
                                            >
                                              {aiState.response}
                                            </ReactMarkdown>
                                          </div>
                                          
                                          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-end">
                                            <button 
                                              onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, response: '', questionText: '', files: [] } }))}
                                              className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full"
                                            >
                                              <ChevronRight className="w-4 h-4"/> Phân tích lại câu này
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="h-16"></div>
        </div>
      </div>
    </div>
  )
}