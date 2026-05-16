'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Clock, ArrowLeft, Send, FileQuestion, LayoutList, 
  UploadCloud, Bookmark, AlertTriangle, ShieldAlert, PlayCircle, Maximize2 
} from 'lucide-react'

export default function ExamRoomPage() {
  const params = useParams()
  const router = useRouter()
  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [savedQuestions, setSavedQuestions] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(0)

  // 🌟 ANTI-CHEAT & DEVICE COMPATIBILITY STATES
  const [hasStarted, setHasStarted] = useState(false)
  const [violations, setViolations] = useState(0)
  const [isKicked, setIsKicked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false) // State theo dõi toàn màn hình thực tế
  const violationsRef = useRef(0)

  useEffect(() => {
    const fetchExam = async () => {
      const examId = params.id as string
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single()
      if (error || !data) { alert('Đề thi không tồn tại!'); router.push('/exams'); return }
      setExam(data); setTimeLeft((data.duration || 50) * 60); setLoading(false)
    }
    fetchExam()
  }, [params.id, router])

  // Hòm đếm thời gian ngược (Timer)
  useEffect(() => {
    if (!hasStarted || loading || timeLeft <= 0 || isKicked || submitting) return
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    if (timeLeft === 1) handleForceSubmit() 
    return () => clearInterval(timer)
  }, [hasStarted, loading, timeLeft, isKicked, submitting])

  // 🌟 HỆ THỐNG GIÁM SÁT ANTI-CHEAT & ĐIỀU PHỐI ĐẶC THÙ CHO IPAD
  useEffect(() => {
    if (!hasStarted || isKicked || submitting) return;

    // Chặn triệt để hành vi kéo vuốt mép trên để tải lại trang (Pull-to-refresh) của iPad
    const preventRefresh = (e: TouchEvent) => {
      if (window.scrollY === 0 && e.touches[0].clientY > 0) {
        if (e.cancelable) e.preventDefault()
      }
    }
    document.body.addEventListener('touchmove', preventRefresh, { passive: false })

    // Chặn F12 và các tổ hợp phím mở Developer Tools
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault()
      }
    }

    // Chặn chuột phải
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault() }

    // Xử lý ghi nhận lỗi vi phạm
    const triggerViolation = () => {
      if (violationsRef.current >= 3) return 
      
      violationsRef.current += 1
      setViolations(violationsRef.current)

      if (violationsRef.current >= 3) {
        setIsKicked(true)
        alert('⛔ BẠN ĐÃ BỊ ĐÌNH CHỈ THI! \nBạn đã vi phạm quy chế (Rời khỏi màn hình) quá 3 lần. Hệ thống tiến hành thu bài tự động.')
        handleForceSubmit()
      } else {
        alert(`⚠️ CẢNH BÁO VI PHẠM LẦN ${violationsRef.current}/3 ⚠️\nBạn không được phép chuyển Tab, thoát ứng dụng hoặc rời chế độ Toàn màn hình!`)
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) triggerViolation()
    }

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement
      setIsFullscreen(isFull)
      if (!isFull) triggerViolation()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.body.removeEventListener('touchmove', preventRefresh)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [hasStarted, isKicked, submitting])

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAnswerSelect = (sectionId: string, qIndex: number, value: any) => { setAnswers(prev => ({ ...prev, [`${sectionId}-${qIndex}`]: value })) }
  const toggleSaveQuestion = (sectionId: string, qIndex: number) => { setSavedQuestions(prev => ({ ...prev, [`${sectionId}-${qIndex}`]: !prev[`${sectionId}-${qIndex}`] })) }

  const handleAnswerSelectTF = (sectionId: string, qIndex: number, subLabel: string, value: string) => {
    setAnswers(prev => {
      const key = `${sectionId}-${qIndex}`
      const currentObj = prev[key] || {}
      return { ...prev, [key]: { ...currentObj, [subLabel]: value } }
    })
  }

  // Hàm kích hoạt Toàn màn hình thủ công / Khôi phục khi bị văng trên iPad
  const requestFullscreenMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch (e) {
      console.error("Thiết bị hoặc trình duyệt không hỗ trợ Fullscreen API")
    }
  }

  // Kích hoạt phòng thi
  const handleStartExam = async () => {
    await requestFullscreenMode()
    setHasStarted(true)
  }

  const handleForceSubmit = async () => {
    await processSubmit(true)
  }

  const handleManualSubmit = async () => {
    if (!confirm('Xác nhận nộp bài thi? Hệ thống sẽ đóng giao diện làm bài.')) return
    await processSubmit(false)
  }

  // Xử lý logic tính điểm và gửi dữ liệu lên Database
  const processSubmit = async (isForced: boolean) => {
    setSubmitting(true)
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err))
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Phiên đăng nhập đã hết hạn!')

      let totalPoints = 0
      let hasEssay = false
      const detailedScores: Record<string, number> = {}

      exam.exam_structure.forEach((section: any) => {
        if (section.type === 'essay') hasEssay = true

        let perQuestionPoints = 0
        if (section.scoringMode === 'auto_divide') {
          perQuestionPoints = (section.sectionTotalPoints || 0) / (section.questionCount || 1)
        }

        Array.from({ length: section.questionCount }).forEach((_, qIdx) => {
          const key = `${section.id}-${qIdx}`
          let qPoint = section.scoringMode === 'custom' ? (section.customPoints?.[qIdx] || 0) : perQuestionPoints
          let earned = 0

          if (section.type !== 'essay') {
            const studentAns = answers[key]
            const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]

            if (section.type === 'true_false') {
              let correctSubCount = 0
              if (studentAns && typeof studentAns === 'object' && correctAns && typeof correctAns === 'object') {
                ['a','b','c','d'].forEach(sub => { if (studentAns[sub] === correctAns[sub]) correctSubCount++ })
              }
              // Chuẩn thang điểm Đúng/Sai THPTQG 2025
              if (correctSubCount === 1) earned = qPoint * 0.1
              else if (correctSubCount === 2) earned = qPoint * 0.25
              else if (correctSubCount === 3) earned = qPoint * 0.5
              else if (correctSubCount === 4) earned = qPoint * 1.0
            } 
            else if (section.type === 'multiple_choice') {
              if (Array.isArray(studentAns) && Array.isArray(correctAns) && studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))) earned = qPoint
            } 
            else {
              if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(correctAns).trim()) earned = qPoint
            }
          }
          detailedScores[key] = parseFloat(earned.toFixed(2))
          totalPoints += detailedScores[key]
        })
      })

      const finalScore = parseFloat(totalPoints.toFixed(2))

      const { error: insertError } = await supabase.from('submissions').insert({
        exam_id: exam.id,
        user_id: user.id,
        answers: answers,
        score: finalScore,
        detailed_scores: detailedScores, 
        is_graded: !hasEssay
      })

      if (insertError) throw insertError
      
      if (!isForced) {
        alert(`Nộp bài thành công! Hệ thống đánh giá sơ bộ: ${finalScore} điểm.`)
      }
      router.push('/dashboard')

    } catch (err: any) { 
      alert('Lỗi: ' + err.message) 
    } finally { 
      setSubmitting(false) 
    }
  }

  if (loading) return <div className="min-h-screen flex bg-slate-900 text-white items-center justify-center font-bold">Đang tải phòng thi ảo...</div>

  const pdfUrl = `https://drive.google.com/file/d/${exam?.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`

  // MÀN HÌNH PHÒNG CHỜ THI
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-slate-800 p-8 md:p-12 rounded-[2rem] max-w-2xl border border-slate-700 shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-3xl font-extrabold text-white mb-2">{exam?.title}</h1>
          <p className="text-slate-400 mb-8 font-medium">Thời gian: {exam?.duration} phút • Cấu trúc: {exam?.exam_type}</p>
          
          <div className="bg-slate-900 p-6 rounded-2xl text-left border border-slate-700 mb-8">
            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Nội quy phòng thi (Bảo mật tối đa):</h3>
            <ul className="text-slate-300 text-sm space-y-2 font-medium list-disc pl-5">
              <li>Hệ thống sẽ ép chế độ <b className="text-white">Toàn màn hình</b> ngay khi bắt đầu.</li>
              <li>Đã cấu hình chặn hành vi kéo vuốt mép màn hình gây reload bài trên thiết bị iPad.</li>
              <li>Nghiêm cấm thoát chế độ toàn màn hình, chuyển Tab hoặc thu nhỏ trình duyệt.</li>
              <li>Bạn có tối đa <b>2 lần cảnh báo</b>. Lần thứ 3 bài thi sẽ tự động thu và tính kết thúc lượt thi.</li>
            </ul>
          </div>

          <button onClick={handleStartExam} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all">
            <PlayCircle className="w-6 h-6" /> Tôi đã hiểu, Bắt đầu thi
          </button>
        </div>
      </div>
    )
  }

  // MÀN HÌNH LÀM BÀI CHÍNH
  return (
    <div 
      className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none"
      style={{ overscrollBehaviorY: 'contain' }} // Triệt tiêu pull-to-refresh ở tầng CSS giao diện
    >
      <header className="h-16 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => {
            if(confirm("Bạn có chắc muốn thoát? Bài làm hiện tại sẽ KHÔNG được lưu lại.")) {
              if (document.fullscreenElement) document.exitFullscreen().catch(()=>{})
              router.push('/exams')
            }
          }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-sm line-clamp-1">{exam?.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${violations > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                Vi phạm: {violations}/3
              </span>
              {/* 🌟 NÚT KHÔI PHỤC TOÀN MÀN HÌNH CHO IPAD KHI BỊ VĂNG */}
              {!isFullscreen && (
                <button 
                  onClick={requestFullscreenMode} 
                  className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded flex items-center gap-1 animate-bounce border border-blue-300"
                  title="Nhấn vào đây để đưa trình duyệt về lại chế độ toàn màn hình khóa bảo mật"
                >
                  <Maximize2 className="w-2.5 h-2.5"/> Bật lại Fullscreen
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-black text-xl border-2 ${timeLeft < 300 ? 'text-red-600 border-red-200 bg-red-50 animate-pulse' : 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/30'}`}>
            <Clock className="w-5 h-5"/>{formatTime(timeLeft)}
          </div>
          <button onClick={handleManualSubmit} disabled={submitting} className="flex gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">
            <Send className="w-4 h-4"/>Nộp bài
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        <div className="flex-1 h-[35vh] md:h-full relative pointer-events-auto">
          <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none pointer-events-auto"></iframe>
        </div>
        
        <div className="w-full md:w-[450px] lg:w-[500px] h-[65vh] md:h-full bg-white dark:bg-slate-900 overflow-y-auto p-0 flex flex-col pointer-events-auto border-l dark:border-slate-800">
          
          {/* 🌟 CẬP NHẬT: GIAO DIỆN BẢNG ĐIỀU HƯỚNG NHANH TO HƠN, RỘNG RÃI TRÊN IPAD */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-md p-5 border-b z-20 shadow-sm max-h-[250px] overflow-y-auto custom-scrollbar dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 mb-3"><LayoutList className="w-4 h-4 text-blue-500" /> Bảng điều hướng nhanh (Chạm câu)</div>
            <div className="space-y-4">
              {exam?.exam_structure?.map((section: any) => (
                <div key={section.id} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border dark:border-slate-700">
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 truncate mb-2 uppercase tracking-wider">● {section.name}</p>
                  
                  {/* Tăng kích thước nút từ w-7 h-7 lên w-10 h-10 để ngón tay chạm chuẩn 100% */}
                  <div className="flex flex-wrap gap-2.5">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`; 
                      const isAnswered = answers[key] !== undefined && (typeof answers[key] === 'object' ? Object.keys(answers[key]).length > 0 : String(answers[key]).trim() !== '')
                      // Số câu hỏi hiển thị lũy tiến (Ví dụ phần 2 nối tiếp từ câu 13)
                      const cumulativeNumber = qIdx + mainIndexOffset(exam, section.id) + 1;
                      
                      return (
                        <button 
                          key={qIdx} 
                          onClick={() => document.getElementById(`q-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
                          className={`w-10 h-10 text-xs font-black rounded-xl border-2 transition-all transform active:scale-95 flex items-center justify-center shrink-0 ${
                            savedQuestions[key] ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 
                            isAnswered ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 
                            'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {cumulativeNumber}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 space-y-8">
            {exam?.exam_structure?.map((section: any) => (
              <div key={section.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border dark:border-slate-700">
                <h3 className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-5 pb-3 border-b dark:border-slate-700"><FileQuestion className="w-5 h-5"/> {section.name}</h3>
                <div className="space-y-6">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`; const currentAns = answers[key]
                    // Đồng bộ hiển thị số câu lũy tiến ở vùng làm bài
                    const globalQNumber = qIdx + mainIndexOffset(exam, section.id) + 1;
                    
                    return (
                      <div key={qIdx} id={`q-${key}`} className={`flex flex-col gap-2 p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-sm transition-all ${savedQuestions[key] ? 'ring-2 ring-amber-400' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-sm text-slate-600 dark:text-slate-400">Câu hỏi {globalQNumber}:</span>
                          <button onClick={() => toggleSaveQuestion(section.id, qIdx)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${savedQuestions[key] ? 'bg-amber-500 text-white border-amber-500' : 'text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
                            <Bookmark className="w-3.5 h-3.5"/> Lưu
                          </button>
                        </div>
                        <div className="mt-2">
                          {/* Nới rộng kích thước nút khoanh trắc nghiệm trên iPad để tăng diện tích chạm */}
                          {section.type === 'single_choice' && <div className="flex gap-3 flex-wrap">{Array.from({ length: section.optionsCount || 4 }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, l)} className={`w-11 h-11 rounded-full border-2 text-sm font-bold transition-all ${currentAns === l ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>{l}</button> })}</div>}
                          {section.type === 'multiple_choice' && <div className="flex gap-3 flex-wrap">{Array.from({ length: section.optionsCount || 4 }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); const ansArr = currentAns || []; const isSel = ansArr.includes(l); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, isSel ? ansArr.filter((a:any) => a !== l) : [...ansArr, l])} className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all ${isSel ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-200 dark:border-slate-700 hover:border-purple-400'}`}>{l}</button> })}</div>}
                          
                          {section.type === 'true_false' && (
                            <div className="flex flex-col gap-3">
                              {['a','b','c','d'].map(subLabel => {
                                const subVal = currentAns?.[subLabel]
                                return (
                                  <div key={subLabel} className="flex items-center gap-4">
                                    <span className="font-bold text-sm text-slate-500 dark:text-slate-400 w-6">Ý {subLabel}:</span>
                                    <button onClick={() => handleAnswerSelectTF(section.id, qIdx, subLabel, 'Đ')} className={`px-5 py-2 rounded-xl border-2 text-xs font-black transition-all ${subVal === 'Đ' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>Đúng</button>
                                    <button onClick={() => handleAnswerSelectTF(section.id, qIdx, subLabel, 'S')} className={`px-5 py-2 rounded-xl border-2 text-xs font-black transition-all ${subVal === 'S' ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>Sai</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {section.type === 'short_answer' && <input type="text" value={currentAns || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, e.target.value)} placeholder="Nhập đáp án ngắn tại đây..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" />}
                          {section.type === 'essay' && <div className="space-y-3"><textarea value={currentAns?.text || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, text: e.target.value })} placeholder="Nhập nội dung tự luận bài làm..." className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-y" /><div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800"><UploadCloud className="text-blue-500 shrink-0"/><input type="file" onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, file: e.target.files?.[0] })} className="text-xs font-medium w-full text-slate-600 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"/></div></div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 🌟 HÀM BỔ TRỢ: Tính toán số câu lũy tiến chính xác theo cấu trúc cây thư mục đề
function mainIndexOffset(exam: any, currentSectionId: string): number {
  let offset = 0
  if (!exam || !exam.exam_structure) return 0
  for (let i = 0; i < exam.exam_structure.length; i++) {
    if (exam.exam_structure[i].id === currentSectionId) break
    offset += exam.exam_structure[i].questionCount || 0
  }
  return offset
}