'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, BookOpen, PenTool, AlertCircle } from 'lucide-react'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

export default function StudentReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [submission, setSubmission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.location.search.includes('from=seb')) {
      router.push('/seb-profile')
    } else {
      router.push('/dashboard')
    }
  }

  useEffect(() => {
    const fetchSubmissionData = async () => {
      const isFromSeb = typeof window !== 'undefined' && window.location.search.includes('from=seb')
      const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const querySubId = searchParams.get('submissionId')

      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user

      let subData: any = null

      // 1. Thử tìm theo submissionId trong query string nếu có
      if (querySubId) {
        const { data } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_structure, drive_file_id, pdf_url, allow_review)')
          .eq('id', querySubId)
          .maybeSingle()
        subData = data
      }

      // 2. Thử tìm theo params.id như là submission ID
      if (!subData && params.id) {
        const { data } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_structure, drive_file_id, pdf_url, allow_review)')
          .eq('id', params.id as string)
          .maybeSingle()
        subData = data
      }

      // 3. Nếu không tìm thấy, thử tìm bài làm gần nhất của thí sinh cho đề thi này (khi params.id là exam_id)
      if (!subData && user && params.id) {
        const { data } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_structure, drive_file_id, pdf_url, allow_review)')
          .eq('exam_id', params.id as string)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        subData = data
      }

      if (!subData) {
        alert('Không tìm thấy dữ liệu bài làm!')
        router.push(isFromSeb ? '/seb-profile' : '/dashboard')
        return
      }

      const email = user?.email?.toLowerCase() || ''
      const { data: profile } = user ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle() : { data: null }
      const isAdminUser = profile?.role === 'admin' || profile?.role === 'collab' || email === 'hoangbinhminh2508@gmail.com'

      if (subData.exams?.allow_review === false && !isAdminUser) {
        alert('Hội đồng thi đã khóa quyền xem lại cấu phần câu hỏi này!')
        router.push(isFromSeb ? '/seb-profile' : '/dashboard')
        return
      }

      setSubmission(subData)
      setLoading(false)
    }
    fetchSubmissionData()

    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    setIsDark(dark)
  }, [params.id, router])

  const renderOptionValue = (val: any) => {
    if (!val) return 'Trống'
    if (Array.isArray(val)) return val.join(', ')
    return String(val)
  }

  if (loading) {
    if (newUiEnabled) return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang kết xuất bài làm..." />
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold">Đang kết xuất bài làm...</div>
  }

  const pdfUrl = submission?.exams?.drive_file_id
    ? `https://drive.google.com/file/d/${submission.exams?.drive_file_id}/preview`
    : (submission?.exams?.pdf_url || '')

  if (newUiEnabled) {
    return (
      <div
        className="h-screen w-full flex flex-col overflow-hidden font-sans"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={handleGoBack} className="p-2 rounded-full" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}><ArrowLeft className="w-4 h-4" /></button>
            <div className="min-w-0">
              <h1 className="font-semibold text-xs md:text-sm truncate">Báo cáo kết quả: {submission.exams?.title}</h1>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tổng điểm ghi nhận: <span className="font-bold" style={{ color: 'var(--accent)' }}>{submission.score} điểm</span></p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
          <div className="flex-1 h-[40vh] md:h-full relative" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs font-medium">
                Tài liệu PDF không khả dụng hoặc chưa được tải lên.
              </div>
            )}
          </div>

          <div className="w-full md:w-[480px] lg:w-[580px] h-[55vh] md:h-full overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar shrink-0" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold flex items-center gap-2 pb-3" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>
              <BookOpen className="w-4 h-4" /> Đánh giá chi tiết từng câu
            </div>

            {submission.feedback && (
              <div className="p-4 rounded-xl" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--accent)' }}><PenTool className="w-3.5 h-3.5" /> Lời khuyên từ giáo viên:</p>
                <p className="text-sm font-medium mt-1 leading-relaxed">{submission.feedback}</p>
              </div>
            )}

            <div className="space-y-5">
              {submission.exams?.exam_structure?.map((section: any) => (
                <div key={section.id} className="p-4 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold text-xs mb-3 pb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>● {section.name}</h3>
                  <div className="space-y-3">
                    {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                      const key = `${section.id}-${qIdx}`
                      const studentAns = submission.answers?.[key]
                      const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                      const questionScore = submission.detailed_scores?.[key] ?? 0

                      const isRight = section.type !== 'essay' && (
                        Array.isArray(studentAns) && Array.isArray(correctAns)
                          ? studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))
                          : studentAns !== undefined && String(studentAns).trim() === String(correctAns).trim()
                      )

                      return (
                        <div key={qIdx} className="p-3 rounded-lg flex items-start justify-between gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div className="space-y-1">
                            <p className="font-semibold text-xs" style={{ color: 'var(--text-muted)' }}>Câu hỏi {qIdx + 1}:</p>
                            <p className="text-xs font-medium">
                              <span style={{ color: 'var(--text-muted)' }}>Bạn đã chọn: </span>
                              <span className="font-semibold" style={{ color: isRight ? '#059669' : '#DC2626' }}>{renderOptionValue(studentAns)}</span>
                            </p>
                            {section.type !== 'essay' && (
                              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Đáp án chuẩn: <span className="font-semibold" style={{ color: '#059669' }}>{renderOptionValue(correctAns)}</span></p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)' }}>{questionScore} điểm</span>
                            {section.type !== 'essay' ? (
                              isRight ? <CheckCircle2 className="w-4 h-4" style={{ color: '#059669' }} /> : <XCircle className="w-4 h-4" style={{ color: '#DC2626' }} />
                            ) : <HelpCircle className="w-4 h-4" style={{ color: '#D97706' }} />}
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

  return (
    <div className="app-shell h-screen w-full flex flex-col bg-transparent text-slate-900 dark:text-slate-100 overflow-hidden">
      <header className="h-16 liquid-panel-strong flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="font-extrabold text-sm md:text-base">Báo cáo kết quả: {submission.exams?.title}</h1>
            <p className="text-xs text-slate-400 font-medium">Tổng điểm ghi nhận: <span className="font-black text-blue-600">{submission.score} điểm</span></p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden">
        <div className="flex-1 h-[45vh] md:h-full border-b md:border-b-0 md:border-r border-white/10 bg-slate-200/60 dark:bg-slate-900/30 relative">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="absolute inset-0 w-full h-full border-none" allow="autoplay"></iframe>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-slate-400 text-xs font-medium">
              Tài liệu PDF không khả dụng hoặc chưa được tải lên.
            </div>
          )}
        </div>

        <div className="w-full md:w-[480px] lg:w-[580px] h-[55vh] md:h-full liquid-panel-strong overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar shrink-0">
          <div className="text-base font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 border-b pb-3"><BookOpen className="w-5 h-5"/> Đánh giá chi tiết từng câu</div>
          
          {submission.feedback && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1"><PenTool className="w-4 h-4"/> Lời khuyên từ giáo viên:</p>
              <p className="text-sm font-medium mt-1 leading-relaxed">{submission.feedback}</p>
            </div>
          )}

          <div className="space-y-6">
            {submission.exams?.exam_structure?.map((section: any) => (
              <div key={section.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-700">
                <h3 className="font-extrabold text-xs text-slate-400 mb-4 border-b pb-2 uppercase tracking-wide">● {section.name}</h3>
                <div className="space-y-4">
                  {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                    const key = `${section.id}-${qIdx}`
                    const studentAns = submission.answers?.[key]
                    const correctAns = section.correctAnswers?.[qIdx] || section.correctAnswers?.[String(qIdx)]
                    const questionScore = submission.detailed_scores?.[key] ?? 0

                    const isRight = section.type !== 'essay' && (
                      Array.isArray(studentAns) && Array.isArray(correctAns)
                        ? studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))
                        : studentAns !== undefined && String(studentAns).trim() === String(correctAns).trim()
                    )

                    return (
                      <div key={qIdx} className="p-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-xs text-slate-500">Câu hỏi {qIdx + 1}:</p>
                          <p className="text-xs font-medium"><span className="text-slate-400">Bạn đã chọn:</span> <span className={isRight ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{renderOptionValue(studentAns)}</span></p>
                          {section.type !== 'essay' && (
                            <p className="text-xs text-slate-400 font-medium">Đáp án chuẩn: <span className="text-emerald-600 font-bold">{renderOptionValue(correctAns)}</span></p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-blue-600">{questionScore} điểm</span>
                          {section.type !== 'essay' ? (
                            isRight ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />
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