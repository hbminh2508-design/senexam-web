'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Clock, ArrowLeft, Send, FileQuestion, LayoutList, 
  UploadCloud, Bookmark, AlertTriangle, ShieldAlert, PlayCircle, Maximize2, Loader2, Award
} from 'lucide-react'

// IMPORT LINH KIỆN GIÁM THỊ AI
import ProctorCamera from '@/app/components/ProctorCamera'

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

  // CHỐNG RE-RENDER TRÊN IPHONE: Lưu trữ URL PDF tránh reload liên tục
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string>('')

  // KIỂM SOÁT LƯỢT THI CHÍNH XÁC
  const [attemptCount, setAttemptCount] = useState(0)
  const [isAttemptExceeded, setIsAttemptExceeded] = useState(false)

  // STATE THỜI GIAN ÂN HẠN
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null)
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // STATE CHỜ CẤP QUYỀN CAMERA
  const [isRequestingCam, setIsRequestingCam] = useState(false)

  // HỆ THỐNG POPUP ẢO (IN-DOM MODAL)
  const [violationAlert, setViolationAlert] = useState<{title: string, desc: string, isFatal: boolean} | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  useEffect(() => {
    const fetchExamAndAttempts = async () => {
      const examId = params.id as string
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Lấy thông tin đề thi
      const { data: examData, error } = await supabase.from('exams').select('*').eq('id', examId).single()
      if (error || !examData) { alert('Đề thi không tồn tại!'); router.push('/exams'); return }
      
      // Tối ưu hóa bộ nhớ đệm cho iPhone: Chỉ gán URL PDF một lần duy nhất
      setCachedPdfUrl(`https://drive.google.com/file/d/${examData.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`)

      // 2. 🌟 FIX LỖI GIAN LẬN LƯỢT THI: Đếm chính xác số bài đã nộp của học sinh đối với đề này
      const { count, error: countError } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('exam_id', examId)
        .eq('user_id', user.id)

      if (!countError && count !== null) {
        setAttemptCount(count)
        if (examData.max_attempts > 0 && count >= examData.max_attempts) {
          setIsAttemptExceeded(true)
        }
      }

      setExam(examData)
      setTimeLeft((examData.duration || 50) * 60)
      setLoading(false)
    }
    fetchExamAndAttempts()
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
        -webkit-overflow-scrolling: touch; /* Tối ưu hóa cuộn mượt trên iPhone */
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
        setViolationAlert({
          title: '⛔ BẠN ĐÃ BỊ ĐÌNH CHỈ THI!',
          desc: 'Bạn đã vi phạm quy chế (Thoát màn hình) quá 3 lần. Hệ thống đang tự động thu bài.',
          isFatal: true
        })
        setTimeout(() => handleForceSubmit(), 2500)
      } else {
        setViolationAlert({
          title: `⚠️ CẢNH BÁO VI PHẠM LẦN ${violationsRef.current}/3`,
          desc: 'Tuyệt đối không được phép rời màn hình hoặc thực hiện cử chỉ vuốt thoát ứng dụng!',
          isFatal: false
        })
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) triggerViolation()
    }

    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(isFull)
      
      if (!isFull) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') {
          return; 
        }

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
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.head.removeChild(style)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
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
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
      setIsFullscreen(true)
      if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current)
        graceTimerRef.current = null
      }
      setGraceCountdown(null)
    } catch (e) {
      console.error("Không thể ép chế độ Fullscreen", e)
    }
  }

  const handleStartExam = async () => {
    if (isAttemptExceeded) return; // Khóa tuyệt đối nếu vượt lượt thi

    if (exam?.require_proctoring) {
      setIsRequestingCam(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        alert('❌ BẠN BẮT BUỘC PHẢI CẤP QUYỀN CAMERA ĐỂ THI!\nVui lòng cấp quyền camera cho trình duyệt để vào thi.');
        setIsRequestingCam(false);
        return; 
      }
      setIsRequestingCam(false);
    }
    await requestFullscreenMode()
    setHasStarted(true)
  }

  const handleForceSubmit = async () => { await processSubmit(true) }
  const handleManualSubmit = () => { setShowSubmitConfirm(true); }

  const handleProctorViolation = (message: string) => {
    if (violationsRef.current >= 3) return;
    
    violationsRef.current += 1;
    setViolations(violationsRef.current);

    if (violationsRef.current >= 3) {
      setIsKicked(true);
      setViolationAlert({
        title: '⛔ BẠN ĐÃ BỊ ĐÌNH CHỈ THI!',
        desc: `${message}\n\nBạn đã vi phạm quy chế quá 3 lần. Hệ thống tự động thu bài.`,
        isFatal: true
      })
      setTimeout(() => handleForceSubmit(), 2500);
    } else {
      setViolationAlert({
        title: `⚠️ CẢNH BÁO VI PHẠM LẦN ${violationsRef.current}/3`,
        desc: message,
        isFatal: false
      })
    }
  }

  const processSubmit = async (isForced: boolean) => {
    setSubmitting(true)
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) { 
        if (doc.exitFullscreen) doc.exitFullscreen().catch(()=>{});
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(()=>{});
      }

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

      if (!isForced) alert(`Nộp bài thành công! Bạn đạt được: ${finalScore} điểm.`)
      router.push('/dashboard')
    } catch (err: any) { alert('Lỗi: ' + err.message) } 
    finally { setSubmitting(false) }
  }

  // Khấu trừ index nhảy câu hỏi được ghi nhớ bằng useMemo tăng tốc độ cho iPhone
  const computedOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    if (!exam || !exam.exam_structure) return offsets
    let currentOffset = 0
    exam.exam_structure.forEach((section: any) => {
      offsets[section.id] = currentOffset
      currentOffset += section.questionCount || 0
    })
    return offsets
  }, [exam])

  if (loading) return <div className="min-h-screen flex bg-slate-950 text-white items-center justify-center font-bold">Đang cấu trúc phòng thi ảo...</div>

  // SCREEN 1: PHÒNG CHỜ THI (ĐÃ ĐƯỢC TỐI ƯU UI SANG TRỌNG)
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full filter blur-[120px]"></div>

        <div className="bg-slate-900/60 backdrop-blur-xl p-6 md:p-10 rounded-[2.5rem] max-w-2xl border border-white/10 shadow-2xl relative z-10 w-full animate-in fade-in zoom-in-95 duration-300">
          <ShieldAlert className="w-14 h-14 text-blue-500 mx-auto mb-4 drop-shadow-[0_4px_12px_rgba(59,130,246,0.4)]" />
          <h1 className="text-2xl md:text-3xl font-black text-white text-center tracking-tight mb-2">{exam?.title}</h1>
          <p className="text-slate-400 text-center mb-6 font-bold text-xs uppercase tracking-widest">Thời gian: {exam?.duration} phút • Hệ: {exam?.exam_type}</p>
          
          <div className="bg-slate-950/80 p-5 rounded-2xl text-left border border-white/5 shadow-inner mb-6 space-y-4">
            <h3 className="text-red-400 font-extrabold text-sm flex items-center gap-2 border-b border-white/5 pb-2"><AlertTriangle className="w-4 h-4"/> QUY CHẾ BẢO MẬT PHÒNG THI:</h3>
            <ul className="text-slate-300 text-xs space-y-3 font-medium list-none pl-1">
              <li className="flex items-start gap-2"><span>-</span> <span>Hệ thống ép chế độ <b className="text-white">Toàn màn hình</b>. Mọi hành vi vuốt mép điều hướng trên điện thoại sẽ bị ngăn chặn.</span></li>
              <li className="flex items-start gap-2"><span>-</span> <span>Nghiêm cấm thoát màn hình, chuyển Tab. Vi phạm quá <b>3 lần</b> hệ thống tự động thu bài.</span></li>
              <li className="flex items-start gap-2"><span>-</span> <span>Được cấp <b className="text-emerald-400">3 giây ân hạn</b> nếu lỡ tay thoát khỏi Fullscreen để nhấn khôi phục.</span></li>
              {exam?.require_proctoring && (
                <li className="flex items-start gap-2 text-purple-300 bg-purple-950/30 p-2 rounded-lg border border-purple-800/30">
                  <span>-</span> <span><b>Giám thị AI (Camera) đang bật:</b> Chặn đứng hành vi lôi điện thoại lên để chụp ảnh đề gửi AI giải hộ. (Hệ thống không phạt khi cúi đầu làm nháp).</span>
                </li>
              )}
            </ul>
          </div>

          {/* 🌟 THÔNG BÁO CHẶN CHÍNH XÁC NẾU HẾT LƯỢT LÀM BÀI */}
          {isAttemptExceeded ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-red-400 text-sm font-bold flex flex-col gap-2">
              <p>⛔ Bạn đã đạt giới hạn làm bài cho phép ({attemptCount}/{exam?.max_attempts} lượt).</p>
              <p className="text-xs text-slate-500 font-medium">Vui lòng liên hệ giáo viên phụ trách để được cấp thêm lượt thi.</p>
            </div>
          ) : (
            <button onClick={handleStartExam} disabled={isRequestingCam} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-lg shadow-blue-600/20">
              {isRequestingCam ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} 
              {isRequestingCam ? 'Đang kích hoạt hệ thống kiểm duyệt...' : 'Xác nhận vào phòng thi'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // SCREEN 2: SÂN THI CHÍNH THỨC
  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none" style={{ overscrollBehaviorY: 'contain' }}>
      
      {/* OVERLAY XÁC NHẬN NỘP BÀI (MODAL ẢO CHỐNG VĂNG FULLSCREEN) */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <Send className="w-10 h-10 text-blue-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Nộp bài thi?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-6">Bạn có chắc chắn muốn kết thúc bài thi? Sau khi nộp kết quả sẽ được ghi nhận ngay.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSubmitConfirm(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-bold text-xs">Quay lại</button>
              <button onClick={() => { setShowSubmitConfirm(false); processSubmit(false); }} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md">Xác nhận nộp</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY CẢNH BÁO VI PHẠM (MODAL ẢO CHỐNG KHÓA CAM IPAD) */}
      {violationAlert && (
        <div className="fixed inset-0 z-[9999] bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-red-500/30 max-w-md w-full shadow-2xl space-y-4">
            <ShieldAlert className="w-14 h-14 text-red-500 mx-auto animate-bounce" />
            <h2 className="text-xl font-black text-white">{violationAlert.title}</h2>
            <p className="text-xs font-bold text-slate-300 leading-relaxed whitespace-pre-wrap">{violationAlert.desc}</p>
            
            {!violationAlert.isFatal ? (
              <button onClick={() => setViolationAlert(null)} className="w-full bg-red-600 text-white font-black py-3 rounded-xl shadow-md text-xs">Tôi đã hiểu & Tiếp tục làm bài</button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-red-500 font-bold bg-red-500/10 py-3 rounded-xl text-xs"><Loader2 className="w-4 h-4 generals-spin" /> Hệ thống đang khóa hòm bài nộp...</div>
            )}
          </div>
        </div>
      )}

      {/* POPUP THỜI GIAN ÂN HẠN KHÔI PHỤC FULLSCREEN */}
      {graceCountdown !== null && !violationAlert && (
        <div className="fixed inset-0 z-[999] bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/40 max-w-sm shadow-2xl space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
            <h2 className="text-lg font-black text-white">MẤT KẾT NỐI AN TOÀN!</h2>
            <p className="text-xs font-medium text-slate-300">Hệ thống phát hiện cử chỉ thoát màn hình bảo mật. Vui lòng bấm khôi phục ngay lập tức.</p>
            <div className="text-3xl font-black text-red-500 animate-pulse">Còn lại: {graceCountdown} giây</div>
            <button onClick={requestFullscreenMode} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-3 rounded-xl text-xs">Khôi phục Toàn màn hình</button>
          </div>
        </div>
      )}

      {/* GIÁM THỊ AI LINH HOẠT CHẠY ẨN ĐÈ TRÊN GIAO DIỆN */}
      {hasStarted && exam?.require_proctoring && (
        <div className="fixed bottom-4 left-4 z-[100] shadow-2xl border border-white/10 rounded-2xl overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
          <ProctorCamera onViolation={handleProctorViolation} />
        </div>
      )}

      <header className="h-16 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => { if(confirm("Rời phòng thi lúc này bài thi sẽ bị hủy và không lưu kết quả?")) { const doc = document as any; if(doc.fullscreenElement || doc.webkitFullscreenElement) { if(doc.exitFullscreen) doc.exitFullscreen().catch(()=>{}); else if(doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(()=>{}); } router.push('/exams') } }} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 border rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0"><img src="/logo.png" alt="Logo" className="w-full h-full object-contain" /></div>
            <div>
              <h1 className="font-extrabold text-xs md:text-sm max-w-[180px] md:max-w-xs truncate">{exam?.title}</h1>
              <div className="flex gap-2 mt-0.5 text-[9px] md:text-[10px] font-bold">
                <span className={`px-1.5 py-0.5 rounded ${violations > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40'}`}>Vi phạm: {violations}/3</span>
                {!isFullscreen && <button onClick={requestFullscreenMode} className="text-blue-600 dark:text-blue-400 underline">Bật Fullscreen</button>}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-sm md:text-lg border-2 ${timeLeft < 300 ? 'text-red-600 border-red-200 bg-red-50 animate-pulse' : 'text-blue-600 border-blue-100 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-900/40'}`}><Clock className="w-4 h-4 md:w-5 md:h-5"/>{formatTime(timeLeft)}</div>
          <button onClick={handleManualSubmit} disabled={submitting} className="flex gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-600/10"><Send className="w-3.5 h-3.5"/>Nộp bài</button>
        </div>
      </header>

      {/* KHÔNG GIAN LÀM BÀI SÂN THI */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        
        {/* KHUNG TRÁI: KHUNG ĐỀ GỐC CỐ ĐỊNH URL CHO IPHONE MƯỢT MÀ */}
        <div className="flex-1 h-[40vh] md:h-full relative bg-slate-900/5">
          <iframe src={cachedPdfUrl} className="absolute inset-0 w-full h-full border-none bg-transparent"></iframe>
        </div>
        
        {/* KHUNG PHẢI: PHIẾU ĐÁP ÁN (TỐI ƯU GIAO DIỆN) */}
        <div className="w-full md:w-[420px] lg:w-[460px] h-[60vh] md:h-full bg-white dark:bg-slate-900 flex flex-col border-l dark:border-slate-800 overflow-hidden shrink-0">
          
          {/* Bảng điều hướng nhanh */}
          <div className="shrink-0 bg-slate-50/50 dark:bg-slate-900/60 border-b p-4 max-h-[35vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              <LayoutList className="w-3.5 h-3.5 text-blue-500" /> Bản đồ câu hỏi
            </div>
            <div className="space-y-3">
              {exam?.exam_structure?.map((section: any) => (
                <div key={section.id} className="bg-white dark:bg-slate-950/40 p-2.5 rounded-xl border dark:border-slate-800">
                  <p className="text-[10px] font-extrabold text-slate-400 truncate mb-2 uppercase">▪ {section.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`; 
                      const isAnswered = answers[key] !== undefined && (typeof answers[key] === 'object' ? Object.keys(answers[key]).length > 0 : String(answers[key]).trim() !== '')
                      const globalNum = qIdx + (computedOffsets[section.id] || 0) + 1;
                      
                      return (
                        <button 
                          key={qIdx} 
                          onClick={() => {
                            const targetEl = document.getElementById(`q-${key}`);
                            if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }} 
                          className={`w-8 h-8 text-[11px] font-black rounded-lg border transition-all flex items-center justify-center shrink-0 ${
                            savedQuestions[key] ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 
                            isAnswered ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 
                            'bg-slate-100/80 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {globalNum}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phiếu tô chi tiết */}
          <div className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900/20">
            {exam?.exam_structure?.map((section: any) => (
              <div key={section.id} className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border dark:border-slate-800">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-4 border-b dark:border-slate-800 pb-2">
                  <FileQuestion className="w-4 h-4 text-blue-500"/> {section.name}
                </h3>
                <div className="space-y-4">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`; 
                    const currentAns = answers[key];
                    const globalQNumber = qIdx + (computedOffsets[section.id] || 0) + 1;
                    
                    let currentType = section.type;
                    let currentOptionsCount = section.optionsCount || 4;
                    
                    if (section.type === 'mixed' && section.mixedRanges) {
                      const range = section.mixedRanges.find((r: any) => (qIdx + 1) >= r.start && (qIdx + 1) <= r.end);
                      if (range) {
                        currentType = range.type;
                        currentOptionsCount = range.optionsCount || 4;
                      } else {
                        currentType = 'short_answer'; 
                      }
                    }

                    return (
                      <div key={qIdx} id={`q-${key}`} className={`p-3.5 bg-white dark:bg-slate-950 border dark:border-slate-800/80 rounded-xl shadow-sm space-y-3 transition-all ${savedQuestions[key] ? 'border-amber-400 dark:border-amber-500 bg-amber-500/5' : ''}`}>
                        <div className="flex justify-between items-center border-b dark:border-slate-900 pb-1.5">
                          <span className="font-extrabold text-xs text-slate-500">Câu hỏi {globalQNumber}:</span>
                          <button onClick={() => toggleSaveQuestion(section.id, qIdx)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${savedQuestions[key] ? 'bg-amber-500 text-white border-amber-500' : 'text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                            <Bookmark className="w-3 h-3"/> {savedQuestions[key] ? 'Đã lưu' : 'Ghim câu'}
                          </button>
                        </div>
                        <div className="pt-1">
                          
                          {currentType === 'single_choice' && <div className="flex gap-2.5 flex-wrap">{Array.from({ length: currentOptionsCount }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, l)} className={`w-9 h-9 rounded-full border text-xs font-black transition-all ${currentAns === l ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>{l}</button> })}</div>}
                          {currentType === 'multiple_choice' && <div className="flex gap-2.5 flex-wrap">{Array.from({ length: currentOptionsCount }).map((_, oIdx) => { const l = String.fromCharCode(65 + oIdx); const ansArr = currentAns || []; const isSel = ansArr.includes(l); return <button key={l} onClick={() => handleAnswerSelect(section.id, qIdx, isSel ? ansArr.filter((a:any) => a !== l) : [...ansArr, l])} className={`w-9 h-9 rounded-lg border text-xs font-black transition-all ${isSel ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 border-slate-200 dark:border-slate-700'}`}>{l}</button> })}</div>}
                          
                          {currentType === 'true_false' && (
                            <div className="space-y-2 text-xs font-bold">
                              {['a','b','c','d'].map(subLabel => {
                                const subVal = currentAns?.[subLabel]
                                return (
                                  <div key={subLabel} className="flex items-center gap-3">
                                    <span className="text-slate-400 w-5 font-black">Ý {subLabel}:</span>
                                    <button onClick={() => handleAnswerSelectTF(section.id, qIdx, subLabel, 'Đ')} className={`px-4 py-1.5 rounded-lg border text-[10px] font-black transition-all ${subVal === 'Đ' ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 border-slate-200 dark:border-slate-700'}`}>Đúng</button>
                                    <button onClick={() => handleAnswerSelectTF(section.id, qIdx, subLabel, 'S')} className={`px-4 py-1.5 rounded-lg border text-[10px] font-black transition-all ${subVal === 'S' ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 border-slate-200 dark:border-slate-700'}`}>Sai</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {currentType === 'short_answer' && <input type="text" value={currentAns || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, e.target.value)} placeholder="Nhập câu trả lời ngắn..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 shadow-inner" />}
                          {currentType === 'essay' && <div className="space-y-2"><textarea value={currentAns?.text || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, text: e.target.value })} placeholder="Gõ lời giải tự luận..." className="w-full min-h-[100px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-medium outline-none focus:border-blue-500" /><div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-inner"><UploadCloud className="text-blue-500 w-4 h-4 shrink-0"/><input type="file" onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, file: e.target.files?.[0] })} className="text-[10px] text-slate-500 w-full"/></div></div>}
                        
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