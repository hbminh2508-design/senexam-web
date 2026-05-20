'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, BookOpen, PenTool } from 'lucide-react'

// Apple Liquid Glass CSS Constants
const glassCardStyles = "liquid-panel"

export default function StudentReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSubmissionData = async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, exams(title, exam_structure, drive_file_id, allow_review)')
        .eq('id', params.id as string)
        .single()

      if (error || !data) {
        alert('Không tìm thấy dữ liệu bài làm!')
        router.push('/dashboard')
        return
      }

      if (!data.exams?.allow_review) {
        alert('Người ra đề đã khóa quyền xem lại cấu phần câu hỏi này!')
        router.push('/dashboard')
        return
      }

      setSubmission(data)
      setLoading(false)
    }
    fetchSubmissionData()
  }, [params.id, router])

  // 🌟 NÂNG CẤP BỘ LỌC HIỂN THỊ ĐÁP ÁN: Khắc phục triệt để lỗi [object Object]
  const renderOptionValue = (val: any, type?: string) => {
    if (!val) return 'Trống'
    
    // Nếu là câu Đúng/Sai, in ra định dạng a: Đ | b: S...
    if (type === 'true_false' && typeof val === 'object' && !Array.isArray(val)) {
      return ['a', 'b', 'c', 'd'].map(k => `${k}: ${val[k] || '-'}`).join(' | ')
    }

    if (typeof val === 'object') {
      if (Array.isArray(val)) return val.join(', ')
      if (val.text) return val.text
      if (val.file_url) return 'Có tệp đính kèm bài làm'
      return JSON.stringify(val)
    }
    return String(val)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold">
      Đang kết xuất báo cáo điểm số...
    </div>
  )

  const pdfUrl = `https://drive.google.com/file/d/${submission.exams?.drive_file_id}/preview`

  return (
    <div className="app-shell h-screen w-full flex flex-col bg-transparent text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      <header className="h-16 liquid-panel-strong flex items-center px-4 sm:px-6 shrink-0 z-10 shadow-sm gap-4">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors rounded-full">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white">Báo cáo kết quả: {submission.exams?.title}</h1>
          <p className="text-xs font-medium text-slate-500">Tổng điểm ghi nhận: <span className="font-black text-blue-600 dark:text-blue-400">{submission.score} điểm</span></p>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        <div className="flex-1 h-[45vh] md:h-full relative bg-slate-200/60 dark:bg-slate-800/30">
          <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none"></iframe>
        </div>
        
        <div className="w-full md:w-[480px] lg:w-[580px] h-[55vh] md:h-full liquid-panel-strong overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar shrink-0">
          <div className="text-base font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b dark:border-slate-800 pb-3">
            <BookOpen className="w-5 h-5"/> Đánh giá chi tiết từng câu
          </div>
          
          {submission.feedback && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-xl">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                <PenTool className="w-4 h-4"/> Lời phê từ giáo viên:
              </p>
              <p className="text-sm font-medium mt-1 text-blue-900 dark:text-blue-200 leading-relaxed">{submission.feedback}</p>
            </div>
          )}

          <div className="space-y-6">
            {submission.exams?.exam_structure?.map((section: any) => (
              <div key={section.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-700">
                <h3 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 mb-4 border-b dark:border-slate-800 pb-2 uppercase tracking-wide">
                  ● {section.name}
                </h3>
                
                <div className="space-y-4">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`
                    const studentAns = submission.answers?.[key]
                    const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                    const questionScore = submission.detailed_scores?.[key] ?? 0
                    
                    // Logic nhận diện Đúng/Sai siêu việt để đổi màu
                    let isRight = false
                    if (section.type === 'multiple_choice') {
                      if (Array.isArray(studentAns) && Array.isArray(correctAns)) isRight = studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))
                    } else if (section.type !== 'essay' && section.type !== 'true_false') {
                      isRight = studentAns !== undefined && studentAns !== null && String(studentAns).trim() === String(correctAns).trim()
                    }

                    return (
                      <div key={qIdx} className="p-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-sm flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <p className="font-bold text-xs text-slate-600 dark:text-slate-300 mb-2">Câu hỏi {qIdx + 1}:</p>
                          
                          {/* 🌟 HỌC SINH XEM LẠI 4 Ý NHỎ CỦA CÂU ĐÚNG SAI */}
                          {section.type === 'true_false' ? (
                            <div className="flex flex-col gap-1.5 mt-2">
                              {['a','b','c','d'].map(subLabel => {
                                const sA = studentAns?.[subLabel]
                                const cA = correctAns?.[subLabel]
                                const isSubRight = sA && cA && String(sA) === String(cA)
                                return (
                                  <div key={subLabel} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">Ý {subLabel}: <span className={isSubRight ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-bold'}>{sA || 'Trống'}</span></span>
                                    <span className="text-slate-400 dark:text-slate-500 font-medium">Gốc: <span className="text-emerald-600 dark:text-emerald-500 font-bold">{cA || '-'}</span></span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700 space-y-1">
                              <p className="text-xs font-medium"><span className="text-slate-500 dark:text-slate-400">Bạn đã chọn:</span> <span className={isRight ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-red-500 font-bold"}>{renderOptionValue(studentAns, section.type)}</span></p>
                              {section.type !== 'essay' && (
                                <p className="text-xs font-medium"><span className="text-slate-500 dark:text-slate-400">Đáp án chuẩn:</span> <span className="text-emerald-600 dark:text-emerald-500 font-bold">{renderOptionValue(correctAns, section.type)}</span></p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1">
                          <span className="text-[10px] font-black px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50 shadow-sm">
                            {questionScore} điểm
                          </span>
                          {section.type !== 'essay' ? (
                            questionScore > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                          ) : <HelpCircle className="w-4 h-4 text-orange-400" />}
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