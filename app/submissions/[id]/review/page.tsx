'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, BookOpen, PenTool, 
  Sparkles, Send, Bot, Loader2, Award, ChevronRight, AlertCircle, 
  FileText, Layers, User // 🌟 Đã fix bổ sung import User
} from 'lucide-react'

// ============================================================================
// MATERIAL DESIGN 3 + LIQUID GLASS CONSTANTS
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-[#2A2A2A] rounded-2xl px-5 py-4 outline-none transition-all font-medium text-slate-900 dark:text-white text-sm shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500"

// ============================================================================
// INTERFACES & TYPES (Định nghĩa chặt chẽ để chống lỗi TypeScript)
// ============================================================================
interface AIQuestionState {
  isOpen: boolean;
  questionText: string;
  response: string;
  isLoading: boolean;
}

export default function StudentReviewPage() {
  const params = useParams()
  const router = useRouter()
  
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // State quản lý việc mở SenAI cho từng câu hỏi riêng biệt (Lưu theo ID câu hỏi)
  const [aiStates, setAiStates] = useState<Record<string, AIQuestionState>>({})

  // ============================================================================
  // KHỞI TẠO VÀ NẠP DỮ LIỆU TỪ SUPABASE
  // ============================================================================
  useEffect(() => {
    const fetchSubmissionData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) { 
        router.push('/login'); 
        return; 
      }

      // Nạp dữ liệu báo cáo điểm kèm cấu trúc đề từ cơ sở dữ liệu
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
        .eq('user_id', user.id) // Bảo mật: Chỉ người làm bài mới được xem
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

    // Khởi tạo Theme theo cài đặt của trình duyệt hoặc LocalStorage
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [params.id, router])

  // ============================================================================
  // CÁC HÀM XỬ LÝ DỮ LIỆU ĐÁP ÁN (PARSERS)
  // ============================================================================
  
  const parseStudentAnswer = (ans: any, type?: string) => {
    // 1. Xử lý trường hợp học sinh bỏ trống
    if (ans === undefined || ans === null || ans === '') {
      return <span className="text-slate-400 dark:text-slate-500 italic font-medium">Bỏ trống</span>
    }
    
    // 2. Xử lý định dạng True/False liên hoàn của Bộ GD&ĐT (a: Đ, b: S, c: Đ, d: S)
    if (type === 'true_false' && typeof ans === 'object' && !Array.isArray(ans)) {
      return ['a', 'b', 'c', 'd'].map(k => `${k.toUpperCase()}: ${ans[k] || '-'}`).join(' | ')
    }

    // 3. Xử lý các Object phức tạp (Nhiều lựa chọn, Tự luận có file đính kèm...)
    if (typeof ans === 'object') {
      if (Array.isArray(ans)) return ans.join(', ') // Multiple choices (e.g. [A, C])
      if (ans.text) return ans.text // Essay text
      if (ans.file_url) return 'Có tệp đính kèm' // Essay file
      return JSON.stringify(ans) // Fallback
    }

    // 4. Mặc định là chuỗi String (Trắc nghiệm đơn, Điền số)
    return String(ans)
  }

  // Khớp điểm gốc để xác định câu làm đúng hay sai
  const isQuestionFullyCorrect = (studentAns: any, correctAns: any, type: string, score: number) => {
    // Tự luận: Cứ có điểm lớn hơn 0 là tính đúng (xanh)
    if (type === 'essay') return score > 0;
    
    // Trắc nghiệm nhiều lựa chọn
    if (type === 'multiple_choice') {
      return Array.isArray(studentAns) && Array.isArray(correctAns) && 
             studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v));
    }
    
    // Đúng/Sai liên hoàn: Phải đúng cả 4 ý mới tính là correct 100% để tắt nút AI
    if (type === 'true_false') {
      return typeof studentAns === 'object' && typeof correctAns === 'object' && 
             ['a','b','c','d'].every(sub => studentAns[sub] === correctAns[sub]);
    }

    // Trắc nghiệm đơn và Điền khuyết: Khớp chuỗi tuyệt đối (không phân biệt hoa/thường)
    return String(studentAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase();
  }

  // ============================================================================
  // HÀM GỌI API GEMINI - TÍCH HỢP SEN AI GIA SƯ 1:1
  // ============================================================================
  const handleAskSenAI = async (questionKey: string, studentAns: any, correctAns: any, type: string) => {
    const currentState = aiStates[questionKey]
    
    // Validate trước khi gửi API
    if (!currentState?.questionText.trim() || currentState.isLoading) return

    // Bật trạng thái Loading UI
    setAiStates(prev => ({ 
      ...prev, 
      [questionKey]: { ...currentState, isLoading: true, response: '' } 
    }))

    // Chuẩn hóa dữ liệu đẩy lên AI để tránh lỗi parse Object
    const parsedStudent = typeof studentAns === 'object' ? JSON.stringify(studentAns) : String(studentAns || 'Bỏ trống')
    const parsedCorrect = typeof correctAns === 'object' ? JSON.stringify(correctAns) : String(correctAns)
    
    // Hệ thống Prompt thiết kế theo chuẩn Zero-Shot Prompting
    const prompt = `Học sinh đang xem lại bài kiểm tra và làm sai (hoặc chưa hiểu) một câu hỏi.
Dưới đây là thông tin câu hỏi:
- Nội dung câu hỏi: "${currentState.questionText}"
- Đáp án học sinh đã chọn: ${parsedStudent}
- Đáp án đúng của hệ thống: ${parsedCorrect}
- Dạng câu hỏi: ${type}

Nhiệm vụ của bạn (SenAI - Gia sư AI chuyên nghiệp):
1. Giải thích cặn kẽ, từng bước một tại sao đáp án hệ thống lại là đáp án đúng.
2. Phân tích lỗi sai trong tư duy hoặc lỗi tính toán khiến học sinh chọn đáp án sai kia.
3. Rút ra bài học, cung cấp công thức, định lý hoặc mẹo ghi nhớ để học sinh khắc phục và áp dụng cho các bài tương tự.

Yêu cầu định dạng:
- Trình bày cực kỳ thân thiện, xưng "Mình" gọi "Bạn".
- Phân đoạn rõ ràng, mạch lạc, không dùng Markdown in đậm quá nhiều để tránh rối mắt.
- Tập trung vào trọng tâm kiến thức.`

    try {
      // GỌI VÀO API ROUTE (/api/chat) ĐÃ ĐƯỢC TỐI ƯU TRÊN HỆ THỐNG
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      })

      const data = await response.json()

      if (response.ok && data.text) {
        // Cập nhật câu trả lời từ Gemini
        setAiStates(prev => ({ 
          ...prev, 
          [questionKey]: { ...currentState, isLoading: false, response: data.text } 
        }))
      } else {
        throw new Error(data.error || 'Lỗi xử lý từ hệ thống AI của Google')
      }
    } catch (error) {
      // Bắt lỗi Network hoặc Quá tải API
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

  // Định dạng Text trả về từ AI (Parse Markdown Basic)
  const formatAIResponse = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-2"></div> // Spacer cho dòng trống
      
      const parts = line.split('**')
      return (
        <p key={i} className="mb-2.5 text-[14px]">
          {parts.map((part, j) => 
            j % 2 === 1 
            ? <strong key={j} className="text-indigo-600 dark:text-indigo-400 font-black tracking-wide">{part}</strong> 
            : part
          )}
        </p>
      )
    })
  }

  // ============================================================================
  // RENDER UI CHÍNH - MATERIAL DESIGN 3 + LIQUID GLASS
  // ============================================================================

  // 1. Trạng thái Loading ban đầu
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]">
      <Loader2 className="w-14 h-14 animate-spin text-indigo-600 dark:text-indigo-400 mb-6 drop-shadow-lg" />
      <p className="font-black text-slate-500 uppercase tracking-widest text-sm animate-pulse">Đang kết xuất báo cáo điểm số...</p>
      <p className="text-xs text-slate-400 mt-2 font-medium">Việc này có thể mất vài giây để đồng bộ toàn bộ ma trận đề.</p>
    </div>
  )

  // Link Preview PDF từ Google Drive
  const pdfUrl = `https://drive.google.com/file/d/${submission.exams?.drive_file_id}/preview`

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative transition-colors duration-500">
      
      {/* 🌟 NỀN AMBIENT TRANG TRÍ V2.0 (LÀM NỔI BẬT HIỆU ỨNG KÍNH MỜ) */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/5 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 🌟 HEADER APP BAR: BÁO CÁO KẾT QUẢ */}
      <header className="h-[80px] md:h-[88px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-20 shadow-sm transition-all duration-300">
        
        <div className="flex items-center gap-3 sm:gap-5">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-3.5 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-transform active:scale-95 rounded-full shadow-inner group border border-slate-200/50 dark:border-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform"/>
          </button>
          
          <div className="hidden sm:flex flex-col justify-center">
            <h1 className="font-black text-lg md:text-xl flex items-center gap-2.5 tracking-tight text-slate-900 dark:text-white">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Báo cáo Kết quả: <span className="text-indigo-600 dark:text-indigo-400">{submission.exams?.title}</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <User className="w-3.5 h-3.5"/> Thí sinh: {submission.profiles?.full_name} 
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span> 
              Nộp bài: {new Date(submission.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
        
        {/* Khối Điểm Tổng Kết */}
        <div className="flex items-center gap-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 px-6 py-3 rounded-full border border-indigo-100 dark:border-indigo-500/20 shadow-sm hover:shadow-md transition-shadow">
          <Award className="w-7 h-7 text-indigo-600 dark:text-indigo-400 drop-shadow-sm"/>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1">Tổng điểm đạt được</p>
            <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none tracking-tighter">
              {submission.is_graded ? String(submission.score).replace('.', ',') : 'Đang chờ chấm'}
            </p>
          </div>
        </div>
      </header>

      {/* 🌟 WORKSPACE CHÍNH: CHIA 2 CỘT (PDF TRÁI & REVIEW PHẢI) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden z-10 bg-transparent">
        
        {/* ============================================================== */}
        {/* CỘT TRÁI: HIỂN THỊ ĐỀ THI BẢN GỐC (PDF VIEWER) */}
        {/* ============================================================== */}
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

        {/* ============================================================== */}
        {/* CỘT PHẢI: BẢNG PHÂN TÍCH ĐÁP ÁN TỪNG CÂU & GIA SƯ AI */}
        {/* ============================================================== */}
        <div className="w-full md:w-[480px] lg:w-[580px] xl:w-[650px] h-[60vh] md:h-full bg-slate-50 dark:bg-[#0A0A0A] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar shrink-0">
          
          <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 border-b border-slate-200 dark:border-white/10 pb-5">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/> Phân tích đánh giá chi tiết
          </div>
          
          {/* Lời phê chung từ Giáo viên / Hệ thống */}
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

          {/* Duyệt qua từng cấu trúc Phần thi (Sections Matrix) */}
          <div className="space-y-8 md:space-y-10">
            {submission.exams?.exam_structure?.map((section: any) => (
              <div key={section.id} className="space-y-5">
                
                {/* Section Header */}
                <div className="flex items-center gap-3 py-3 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-slate-50/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md z-10">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#202020] flex items-center justify-center text-slate-600 dark:text-slate-400 font-black shadow-inner">
                    <Layers className="w-4 h-4"/>
                  </div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight drop-shadow-sm">
                    {section.name}
                  </h2>
                </div>

                {/* Danh sách Câu hỏi (Questions Mapping) */}
                <div className="space-y-5">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`
                    const studentAns = submission.answers?.[key]
                    const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                    const questionScore = submission.detailed_scores?.[key] ?? 0
                    
                    // Logic nội suy nhận diện Dạng Bài
                    let currentType = section.type
                    if (section.type === 'mixed' && section.mixedRanges) {
                      const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
                      currentType = range ? range.type : 'short_answer'
                    }

                    // Đánh giá Trạng thái câu (Đúng / Sai)
                    const isRight = isQuestionFullyCorrect(studentAns, correctAns, currentType, questionScore)
                    
                    // State Quản lý Trợ lý AI
                    const aiState = aiStates[key] || { isOpen: false, questionText: '', response: '', isLoading: false }

                    return (
                      <div key={qIdx} className={`${mdCard} p-5 sm:p-6 ${isRight ? 'border-emerald-200/60 dark:border-emerald-900/40 bg-white/90 dark:bg-[#1A1A1A]/90' : 'border-rose-200/60 dark:border-rose-900/40 bg-white/90 dark:bg-[#1A1A1A]/90'}`}>
                        
                        {/* Hàng 1: Header Câu Hỏi & Báo Điểm */}
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

                        {/* Hàng 2: Khung Hiển thị Đáp án */}
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

                        {/* 🌟 HÀNG 3: WIDGET SEN AI GIA SƯ (TÍCH HỢP GEMINI API) */}
                        {/* Điều kiện bật: Câu làm sai (isRight == false) VÀ không phải câu Tự luận */}
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
                                {/* Viền màu trang trí đỉnh */}
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
                                          Vì mình không thể tự "nhìn" thấy chữ trong file PDF, bạn hãy giúp mình <strong className="text-indigo-600 dark:text-indigo-400 font-bold">chép lại nội dung câu hỏi</strong> từ đề bài bên trái và dán vào ô bên dưới nhé. Mình sẽ phân tích ngay!
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <textarea 
                                      value={aiState.questionText}
                                      onChange={(e) => setAiStates(prev => ({ ...prev, [key]: { ...aiState, questionText: e.target.value } }))}
                                      placeholder="✏️ Dán nội dung câu hỏi bị sai vào đây..."
                                      className="w-full bg-slate-50 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl p-4 text-sm font-medium outline-none transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[100px] mb-4 text-slate-900 dark:text-white"
                                    />
                                    
                                    <div className="flex justify-end gap-3">
                                      <button 
                                        onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, isOpen: false } }))}
                                        className="px-5 py-2.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm"
                                      >
                                        Đóng lại
                                      </button>
                                      <button 
                                        onClick={() => handleAskSenAI(key, studentAns, correctAns, currentType)}
                                        disabled={!aiState.questionText.trim()}
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
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#1A1A1A] p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-inner selection:bg-indigo-200 dark:selection:bg-indigo-900">
                                          
                                          {/* Render kết quả Markdown Basic */}
                                          {formatAIResponse(aiState.response)}
                                          
                                          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-end">
                                            <button 
                                              onClick={() => setAiStates(prev => ({ ...prev, [key]: { ...aiState, response: '', questionText: '' } }))}
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
          
          {/* Pad bottom for smooth scrolling */}
          <div className="h-16"></div>
        </div>
      </div>
    </div>
  )
}