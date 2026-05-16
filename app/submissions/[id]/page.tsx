'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Clock, ArrowLeft, Send, AlertCircle, FileQuestion, LayoutList, UploadCloud, BookMarked, Bookmark } from 'lucide-react'

export default function ExamRoomPage() {
  const params = useParams()
  const router = useRouter()
  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Lưu đáp án thí sinh
  const [answers, setAnswers] = useState<Record<string, any>>({})
  // Lưu trạng thái các câu đánh dấu "Lưu câu / Làm lại sau"
  const [savedQuestions, setSavedQuestions] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const fetchExam = async () => {
      const examId = params.id as string
      const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single()
      
      if (error || !data) {
        alert('Không tìm thấy đề thi phù hợp!')
        router.push('/exams')
        return
      }
      setExam(data)
      setTimeLeft((data.duration || 50) * 60)
      setLoading(false)
    }
    fetchExam()
  }, [params.id, router])

  useEffect(() => {
    if (loading || timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [loading, timeLeft])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAnswerSelect = (sectionId: string, qIndex: number, value: any) => {
    const key = `${sectionId}-${qIndex}`
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  // Chuyển đổi trạng thái Lưu câu (Review sau)
  const toggleSaveQuestion = (sectionId: string, qIndex: number) => {
    const key = `${sectionId}-${qIndex}`
    setSavedQuestions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // --- HÀM XỬ LÝ CHẤM ĐIỂM TỰ ĐỘNG & NỘP BÀI CHUẨN ---
  const handleSubmit = async () => {
    if (!confirm('Xác nhận nộp bài thi? Hệ thống sẽ tự động khóa phiếu trả lời và tính điểm.')) return
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!')

      let totalQuestions = 0
      let correctCount = 0
      let hasEssay = false
      let fileUrl = ''
      let targetEssayFile: File | null = null

      // Duyệt tìm tệp tự luận scan đính kèm trong cấu trúc answers
      exam.exam_structure.forEach((section: any) => {
        if (section.type === 'essay') {
          hasEssay = true
          Array.from({ length: section.questionCount }).map((_, qIdx) => {
            const key = `${section.id}-${qIdx}`
            if (answers[key]?.file) {
              targetEssayFile = answers[key].file
            }
          })
          return
        }
        totalQuestions += section.questionCount

        Array.from({ length: section.questionCount }).forEach((_, qIdx) => {
          const key = `${section.id}-${qIdx}`
          const studentAns = answers[key]
          // Xử lý đọc key linh hoạt từ chuỗi hoặc số phòng lỗi định dạng JSON
          const correctAns = section.correctAnswers?.[qIdx] ?? section.correctAnswers?.[String(qIdx)]

          if (section.type === 'multiple_choice') {
            if (Array.isArray(studentAns) && Array.isArray(correctAns)) {
              if (studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))) {
                correctCount += 1
              }
            }
          } else {
            if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(correctAns).trim()) {
              correctCount += 1
            }
          }
        })
      })

      // Logic quy đổi điểm theo từng hệ thống kỳ thi
      let finalScore = 0
      if (exam.exam_type === 'THPTQG' || exam.exam_type === 'SPT') {
        finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 10).toFixed(2)) : 0
      } else if (exam.exam_type === 'HSA') {
        finalScore = correctCount
      } else if (exam.exam_type === 'TSA') {
        finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 100).toFixed(2)) : 0
      }

      // Xử lý tải tệp scan bài lên Supabase Storage nếu tồn tại
      if (targetEssayFile) {
        const file: File = targetEssayFile
        const fileExt = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${fileExt}`
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('essays')
          .upload(path, file)
          
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('essays').getPublicUrl(path)
          fileUrl = urlData.publicUrl
        }
      }

      // Thực hiện gửi dữ liệu lên Database
      const { error: insertError } = await supabase
        .from('submissions')
        .insert({
          exam_id: exam.id,
          user_id: user.id,
          answers: answers,
          score: finalScore,
          is_graded: !hasEssay,
          file_url: fileUrl
        })

      if (insertError) throw insertError

      alert(`Nộp bài thành công! Điểm ghi nhận trên hệ thống: ${finalScore}`)
      router.push('/dashboard')

    } catch (err: any) {
      alert('Lỗi nộp bài: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold text-xl">Đang tải phòng thi ảo...</div>

  const pdfUrl = `https://drive.google.com/file/d/${exam?.drive_file_id}/preview`

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
      
      {/* HEADER PHÒNG THI */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/exams')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-sm md:text-base line-clamp-1">{exam?.title}</h1>
            <div className="flex gap-2 mt-0.5">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold uppercase">{exam?.exam_type}</span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold">Thời gian: {exam?.duration} phút</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-lg md:text-xl border-2 transition-colors ${timeLeft < 300 ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 animate-pulse' : 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all disabled:bg-slate-400">
            <Send className="w-4 h-4" /> <span className="hidden md:inline">{submitting ? 'Đang nộp bài...' : 'Nộp bài'}</span>
          </button>
        </div>
      </header>

      {/* CHIA ĐÔI MÀN HÌNH */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        
        {/* BÊN TRÁI: ĐỀ PDF */}
        <div className="flex-1 h-[35vh] md:h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800/50 relative">
          <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
        </div>

        {/* BÊN PHẢI: PHIẾU TÔ + STICKY BOARD TRẠNG THÁI CÂU HỎI */}
        <div className="w-full md:w-[450px] lg:w-[500px] xl:w-[580px] h-[65vh] md:h-full bg-white dark:bg-slate-900 overflow-y-auto shrink-0 flex flex-col">
          
          {/* 🌟 BẢNG THEO DÕI TRẠNG THÁI CÂU HỎI - ĐÍNH TRÊN CAO MỌI LÚC (STICKY TOP BOARD) */}
          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 border-b border-slate-200 dark:border-slate-800 z-20 shadow-sm shrink-0 max-h-[220px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
              <LayoutList className="w-4 h-4 text-blue-500" /> Bản đồ tiến độ câu hỏi (Click để di chuyển nhanh)
            </div>
            <div className="space-y-3">
              {exam?.exam_structure?.map((section: any) => (
                <div key={section.id} className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 truncate">● {section.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const isAnswered = answers[key] !== undefined && answers[key] !== '' && (typeof answers[key] === 'object' ? answers[key]?.text || answers[key]?.file : true)
                      const isSaved = savedQuestions[key]

                      return (
                        <button
                          key={qIdx}
                          type="button"
                          onClick={() => {
                            const element = document.getElementById(`question-row-${key}`)
                            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                          className={`w-7 h-7 text-xs font-black rounded-lg border flex items-center justify-center transition-all ${
                            isSaved 
                              ? 'bg-amber-500 border-amber-500 text-white shadow-sm ring-2 ring-amber-300 dark:ring-amber-800' 
                              : isAnswered 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {qIdx + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CHI TIẾT DANH SÁCH CÂU HỎI ĐỂ TÔ ĐÁP ÁN */}
          <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            {exam?.exam_structure?.map((section: any) => (
              <div key={section.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                
                <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-2 text-base">
                    <FileQuestion className="w-5 h-5" /> {section.name}
                  </h3>
                  {section.subject && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold">
                      Môn: {section.subject}
                    </span>
                  )}
                </div>
                
                <div className="space-y-6">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const questionNum = qIdx + 1
                    const answerKey = `${section.id}-${qIdx}`
                    const currentAns = answers[answerKey]
                    const isSaved = savedQuestions[answerKey]

                    return (
                      <div 
                        key={qIdx} 
                        id={`question-row-${answerKey}`} 
                        className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${isSaved ? 'bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sm text-slate-600 dark:text-slate-400">Câu số {questionNum}:</span>
                          
                          {/* 🌟 NÚT LƯU CÂU / LÀM LẠI SAU ĐỘNG */}
                          <button
                            type="button"
                            onClick={() => toggleSaveQuestion(section.id, qIdx)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                              isSaved 
                                ? 'bg-amber-500 border-amber-500 text-white shadow-sm' 
                                : 'bg-white hover:bg-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400'
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
                            {isSaved ? 'Đã lưu câu' : 'Lưu câu'}
                          </button>
                        </div>
                        
                        {/* INPUT RENDER THEO DẠNG CÂU HỎI */}
                        <div className="mt-1">
                          {section.type === 'single_choice' && (
                            <div className="flex gap-2 flex-wrap">
                              {Array.from({ length: section.optionsCount || 4 }).map((_, oIdx) => {
                                const label = String.fromCharCode(65 + oIdx)
                                const isSelected = currentAns === label
                                return (
                                  <button key={label} type="button" onClick={() => handleAnswerSelect(section.id, qIdx, label)} className={`w-9 h-9 rounded-full text-sm font-bold border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}>{label}</button>
                                )
                              })}
                            </div>
                          )}

                          {section.type === 'multiple_choice' && (
                            <div className="flex gap-2 flex-wrap">
                              {Array.from({ length: section.optionsCount || 4 }).map((_, oIdx) => {
                                const label = String.fromCharCode(65 + oIdx)
                                const ansArray = currentAns || []
                                const isSelected = ansArray.includes(label)
                                return (
                                  <button key={label} type="button" onClick={() => {
                                    const newArray = isSelected ? ansArray.filter((a: string) => a !== label) : [...ansArray, label]
                                    handleAnswerSelect(section.id, qIdx, newArray)
                                  }} className={`w-9 h-9 rounded-md text-sm font-bold border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-purple-400 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}>{label}</button>
                                )
                              })}
                            </div>
                          )}

                          {section.type === 'true_false' && (
                            <div className="flex gap-3">
                              <button type="button" onClick={() => handleAnswerSelect(section.id, qIdx, 'Đ')} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${currentAns === 'Đ' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-600'}`}>Đúng</button>
                              <button type="button" onClick={() => handleAnswerSelect(section.id, qIdx, 'S')} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${currentAns === 'S' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-600'}`}>Sai</button>
                            </div>
                          )}

                          {section.type === 'short_answer' && (
                            <input type="text" placeholder="Nhập chuỗi ký tự / số đáp án đúng..." value={currentAns || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
                          )}

                          {section.type === 'essay' && (
                            <div className="w-full space-y-3">
                              <textarea placeholder="Nhập nội dung lập luận tự luận..." value={currentAns?.text || ''} onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, text: e.target.value })} className="w-full min-h-[140px] resize-y bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                <UploadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1.5 uppercase tracking-wider">Đính kèm ảnh chụp/file scan bài làm tự luận</p>
                                  <input type="file" accept=".pdf, image/*" onChange={(e) => handleAnswerSelect(section.id, qIdx, { ...currentAns, file: e.target.files?.[0] })} className="text-xs w-full text-slate-600 dark:text-slate-400" />
                                </div>
                              </div>
                            </div>
                          )}
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