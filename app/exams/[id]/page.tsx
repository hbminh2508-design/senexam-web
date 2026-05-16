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

  // ANTI-CHEAT & DEVICE COMPATIBILITY STATES
  const [hasStarted, setHasStarted] = useState(false)
  const [violations, setViolations] = useState(0)
  const [isKicked, setIsKicked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false) 
  const violationsRef = useRef(0)

  // STATE THỜI GIAN ÂN HẠN CHỐNG BẮT NHẦM TRÊN THIẾT BỊ CẢM ỨNG
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null)
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // Timer đếm ngược giờ thi
  useEffect(() => {
    if (!hasStarted || loading || timeLeft <= 0 || isKicked || submitting) return
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    if (timeLeft === 1) handleForceSubmit() 
    return () => clearInterval(timer)
  }, [hasStarted, loading, timeLeft, isKicked, submitting])

  // HỆ THỐNG GIÁM SÁT ANTI-CHEAT
  useEffect(() => {
    if (!hasStarted || isKicked || submitting) return;

    const style = document.createElement('style')
    style.innerHTML = `
      html, body {
        overflow: hidden !important;
        overscroll-behavior: contain !important;
        position: fixed !important;
        width: 100% !important;
        height: 100% !important;
        inset: 0 !important;
      }
    `
    document.head.appendChild(style)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault()
      }
    }

    const handleContextMenu = (e: MouseEvent) => { e.preventDefault() }

    const triggerViolation = () => {
      if (violationsRef.current >= 3) return 
      
      violationsRef.current += 1
      setViolations(violationsRef.current)

      if (violationsRef.current >= 3) {
        setIsKicked(true)
        alert('⛔ BẠN ĐÃ BỊ ĐÌNH CHỈ THI! \nBạn đã vi phạm quy chế (Rời khỏi màn hình) quá 3 lần. Hệ thống tự động thu bài và đóng lượt thi.')
        handleForceSubmit()
      } else {
        alert(`⚠️ CẢNH BÁO VI PHẠM LẦN ${violationsRef.current}/3 ⚠️\nBạn không được phép rời màn hình thi!`)
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) triggerViolation()
    }

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement
      setIsFullscreen(isFull)
      
      if (!isFull) {
        setGraceCountdown(3)
        if (graceTimerRef.current) clearInterval(graceTimerRef.current)
        
        let counter = 3
        graceTimerRef.current = setInterval(() => {
          counter -= 1
          setGraceCountdown(counter)
          if (counter <= 0) {
            clearInterval(graceTimerRef.current!)
            graceTimerRef.current = null
            setGraceCountdown(null)
            triggerViolation() 
          }
        }, 1000)
      } else {
        if (graceTimerRef.current) {
          clearInterval(graceTimerRef.current)
          graceTimerRef.current = null
        }
        setGraceCountdown(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.head.removeChild(style)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (graceTimerRef.current) clearInterval(graceTimerRef.current)
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

  const requestFullscreenMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
        if (graceTimerRef.current) {
          clearInterval(graceTimerRef.current)
          graceTimerRef.current = null
        }
        setGraceCountdown(null)
      }
    } catch (e) {
      console.error("Không thể ép chế độ Fullscreen")
    }
  }

  const handleStartExam = async () => {
    await requestFullscreenMode()
    setHasStarted(true)
  }

  const handleForceSubmit = async () => { await processSubmit(true) }
  const handleManualSubmit = async () => {
    if (!confirm('Xác nhận nộp bài thi? Hệ thống sẽ đóng giao diện làm bài.')) return
    await processSubmit(false)
  }

  // 🌟 NÂNG CẤP HỆ THỐNG CHẤM ĐIỂM TỰ ĐỘNG ĐỂ NHẬN DIỆN CÂU HỖN HỢP (MIXED)
  const processSubmit = async (isForced: boolean) => {
    setSubmitting(true)
    try {
      if (document.fullscreenElement) { document.exitFullscreen().catch(()=>{}) }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Phiên đăng nhập đã hết hạn!')

      let totalPoints = 0
      let hasEssay = false
      const detailedScores: Record<string, number> = {}

      exam.exam_structure.forEach((section: any) => {
        let perQuestionPoints = section.scoringMode === 'auto_divide' ? ((section.sectionTotalPoints || 0) / (section.questionCount || 1)) : 0

        Array.from({ length: section.questionCount }).forEach((_, qIdx) => {
          const key = `${section.id}-${qIdx}`
          let qPoint = section.scoringMode === 'custom' ? (section.customPoints?.[qIdx] || 0) : perQuestionPoints
          let earned = 0

          // Phân tách Logic xem câu này thuộc dạng gì
          let currentType = section.type;
          if (section.type === 'mixed' && section.mixedRanges) {
            const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end)
            if (range) currentType = range.type
            else currentType = 'short_answer'
          }

          if (currentType === 'essay') hasEssay = true

          if (currentType !== 'essay') {
            const studentAns = answers[key]
            const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]

            if (currentType === 'true_false') {
              let correctSubCount = 0
              if (studentAns && typeof studentAns === 'object' && correctAns && typeof correctAns === 'object') {
                ['a','b','c','d'].forEach(sub => { if (studentAns[sub] === correctAns[sub]) correctSubCount++ })
              }
              if (correctSubCount === 1) earned = qPoint * 0.1
              else if (correctSubCount === 2) earned = qPoint * 0.25
              else if (correctSubCount === 3) earned = qPoint * 0.5
              else if (correctSubCount === 4) earned = qPoint * 1.0
            } else if (currentType === 'multiple_choice') {
              if (Array.isArray(studentAns) && Array.isArray(correctAns) && studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))) earned = qPoint
            } else {
              // So sánh text (In hoa 2 vế để chống sai lệch)
              if (studentAns !== undefined && studentAns !== null && String(studentAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase()) earned = qPoint
            }
          }
          detailedScores[key] = parseFloat(earned.toFixed(2))
          totalPoints += detailedScores[key]
        })
      })

      const finalScore = parseFloat(totalPoints.toFixed(2))
      await supabase.from('submissions').insert({
        exam_id: exam.id, user_id: user.id, answers: answers, score: finalScore, detailed_scores: detailedScores, is_graded: !hasEssay
      })

      if (!isForced) alert(`Nộp bài thành công! Hệ thống đánh giá: ${finalScore} điểm.`)
      router.push('/dashboard')
    } catch (err: any) { alert('Lỗi: ' + err.message) } 
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen flex bg-slate-900 text-white items-center justify-center font-bold">Đang tải phòng thi ảo...</div>

  const pdfUrl = `https://drive.google.com/file/d/${exam?.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`

  // PHÒNG CHỜ THI
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-slate-800 p-8 md:p-12 rounded-[2rem] max-w-2xl border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-350">
          <ShieldAlert className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-3xl font-extrabold text-white mb-2">{exam?.title}</h1>
          <p className="text-slate-400 mb-8 font-medium">Thời gian làm bài: {exam?.duration} phút • Cấu trúc đề: {exam?.exam_type}</p>
          
          <div className="bg-slate-900 p-6 rounded-2xl text-left border border-slate-700 mb-8">
            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Quy chế phòng thi nghiêm ngặt (Bảo mật hệ thống):</h3>
            <ul className="text-slate-300 text-sm space-y-3.5 font-medium list-disc pl-5 leading-relaxed">
              <li>Hệ thống sẽ tự động kích hoạt và ép chế độ <b className="text-white">Toàn màn hình (Full-screen)</b> ngay khi bắt đầu. Mọi hành vi kéo vuốt mép màn hình gây reload bài trên thiết bị di động đã bị phong tỏa.</li>
              <li>Nghiêm cấm tuyệt đối các hành vi rời khỏi màn hình, chuyển đổi Tab, mở ứng dụng khác hoặc thu nhỏ trình duyệt trong suốt thời gian làm bài.</li>
              <li>Trường hợp mất trạng thái Toàn màn hình do sự cố phần cứng, hệ thống cấp <b className="text-emerald-400">3 giây ân hạn</b> để thí sinh chủ động nhấn nút khôi phục bảo mật.</li>
              <li>Nếu quá thời gian ân hạn hoặc cố tình vi phạm, hệ thống sẽ ghi nhận 1 lần cảnh báo. Đủ <b>3 lần vi phạm</b>, bài thi sẽ lập tức bị khóa, tự động thu bài và hủy lượt thi.</li>
            </ul>
          </div>
          
          <button onClick={handleStartExam} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-transform transform active:scale-[0.99]">
            <PlayCircle className="w-6 h-6" /> Tôi đã đọc và cam kết tuân thủ quy chế
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none" style={{ overscrollBehaviorY: 'contain' }}>
      
      {/* POPUP THỜI GIAN ÂN HẠN KHI BỊ THOÁT FULLSCREEN */}
      {graceCountdown !== null && (
        <div className="fixed inset-0 z-[999] bg-red-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="bg-slate-900/80 p-8 rounded-[2rem] border border-red-500/40 max-w-md shadow-2xl space-y-6">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-bounce" />
            <h2 className="text-2xl font-black text-white">MẤT CHẾ ĐỘ TOÀN MÀN HÌNH!</h2>
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              Hệ thống phát hiện bạn vừa thoát chế độ bảo mật. Hãy nhấn nút dưới đây ngay lập tức để quay lại bài thi.
            </p>
            <div className="text-4xl font-black text-red-500 animate-pulse">
              Còn lại: {graceCountdown} giây
            </div>
            <button 
              onClick={requestFullscreenMode} 
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-base active:scale-95 transition-transform"
            >
              <Maximize2 className="w-5 h-5"/> Khôi phục Toàn màn hình
            </button>
          </div>
        </div>
      )}

      <header className="h-16 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => { if(confirm("Thoát phòng thi sẽ không lưu lại bài làm?")) { if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); router.push('/exams') } }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
          
          <div className="flex items-center gap-3 shrink-0">
            {/* THƯƠNG HIỆU LOGO Ở GÓC TRÁI PHÒNG THI */}
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0">
              <img src="/logo.png" alt="SenExam Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm line-clamp-1">{exam?.title}</h1>
              <div className="flex gap-2 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${violations > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>Vi phạm: {violations}/3</span>
                {!isFullscreen && (
                  <button onClick={requestFullscreenMode} className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded flex items-center gap-1 border border-blue-300">
                    <Maximize2 className="w-2.5 h-2.5"/> Bật lại Fullscreen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-black text-xl border-2 ${timeLeft < 300 ? 'text-red-600 border-red-200 bg-red-50 animate-pulse' : 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/30'}`}><Clock className="w-5 h-5"/>{formatTime(timeLeft)}</div>
          <button onClick={handleManualSubmit} disabled={submitting} className="flex gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50"><Send className="w-4 h-4"/>Nộp bài</button>
        </div>
      </header>

      {/* --- PHÂN CHIA KHÔNG GIAN SÂN THI --- */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        {/* Khung trái: Hiển thị PDF đề thi */}
        <div className="flex-1 h-[35vh] md:h-full relative">
          <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none"></iframe>
        </div>
        
        {/* Khung phải: Bảng đáp án */}
        <div className="w-full md:w-[450px] lg:w-[500px] h-[65vh] md:h-full bg-white dark:bg-slate-900 flex flex-col border-l dark:border-slate-800 overflow-hidden">
          
          <div className="shrink-0 bg-white/95 dark:bg-slate-900 border-b p-5 z-20 shadow-sm max-h-[40vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 mb-3">
              <LayoutList className="w-4 h-4 text-blue-500" /> Bảng điều hướng nhanh (Chạm câu để nhảy vị trí)
            </div>
            <div className="space-y-4">
              {exam?.exam_structure?.map((section: any) => (
                <div key={section.id} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border dark:border-slate-700">
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 truncate mb-2 uppercase tracking-wider">● {section.name}</p>
                  <div className="flex flex-wrap gap-2.5">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`; 
                      const isAnswered = answers[key] !== undefined && (typeof answers[key] === 'object' ? Object.keys(answers[key]).length > 0 : String(answers[key]).trim() !== '')
                      const cumulativeNumber = qIdx + mainIndexOffset(exam, section.id) + 1;
                      
                      return (
                        <button 
                          key={qIdx} 
                          onClick={() => {
                            const targetEl = document.getElementById(`q-${key}`);
                            if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }} 
                          className={`w-10 h-10 text-xs font-black rounded-xl border-2 transition-all transform active:scale-95 flex items-center justify-center shrink-0 ${
                            savedQuestions[key] ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 
                            isAnswered ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 
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

          <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
            {exam?.exam_structure?.map((section: any) => (
              <div key={section.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border dark:border-slate-700">
                <h3 className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-5 pb-3 border-b dark:border-slate-700">
                  <FileQuestion className="w-5 h-5"/> {section.name}
                </h3>
                <div className="space-y-6">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`; 
                    const currentAns = answers[key];
                    const globalQNumber = qIdx + mainIndexOffset(exam, section.id) + 1;
                    
                    // 🌟 VẼ GIAO DIỆN TÙY BIẾN THEO RANGE ĐÃ CẤU HÌNH Ở ADMIN
                    let currentType = section.type;
                    let currentOptionsCount = section.optionsCount || 4;
                    
                    if (section.type === 'mixed' && section.mixedRanges) {
                      const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end);
                      if (range) {
                        currentType = range.type;
                        currentOptionsCount = range.optionsCount || 4;
                      } else {
                        currentType = 'short_answer'; // Default nếu không rơi vào vùng nào
                      }
                    }

                    return (
                      <div key={qIdx} id={`q-${key}`} className={`flex flex-col gap-2 p-4 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-sm transition-all ${savedQuestions[key] ? 'ring-2 ring-amber-400' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-sm text-slate-600 dark:text-slate-400">Câu hỏi {globalQNumber}:</span>
                          <button onClick={() => toggleSaveQuestion(section.id, qIdx)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50">
                            <Bookmark className="w-3.5 h-3.5"/> Lưu
                          </button>
                        </div>
                        <div className="mt-2">
                          
                          {currentType === 'single_choice' && <div className="flex gap-3 flex-wrap">{Array.from({ length: currentOptionsCount }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, l)} className={`w-11 h-11 rounded-full border-2 text-sm font-bold transition-all ${currentAns === l ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{l}</button> })}</div>}
                          {currentType === 'multiple_choice' && <div className="flex gap-3 flex-wrap">{Array.from({ length: currentOptionsCount }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); const ansArr = currentAns || []; const isSel = ansArr.includes(l); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, isSel ? ansArr.filter((a:any) => a !== l) : [...ansArr, l])} className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all ${isSel ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-200 dark:border-slate-700'}`}>{l}</button> })}</div>}
                          
                          {currentType === 'true_false' && (
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

                          {currentType === 'short_answer' && <input type="text" value={currentAns || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, e.target.value)} placeholder="Nhập đáp án..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />}
                          {currentType === 'essay' && <div className="space-y-3"><textarea value={currentAns?.text || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, text: e.target.value })} placeholder="Nhập bài làm tự luận..." className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-medium outline-none" /><div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border"><UploadCloud className="text-blue-500 shrink-0"/><input type="file" onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, file: e.target.files?.[0] })} className="text-xs font-medium w-full text-slate-600"/></div></div>}
                        
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

function mainIndexOffset(exam: any, currentSectionId: string): number {
  let offset = 0
  if (!exam || !exam.exam_structure) return 0
  for (let i = 0; i < exam.exam_structure.length; i++) {
    if (exam.exam_structure[i].id === currentSectionId) break
    offset += exam.exam_structure[i].questionCount || 0
  }
  return offset
}