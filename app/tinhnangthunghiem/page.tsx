'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  ArrowLeft, UploadCloud, FileText, X, Loader2, Sparkles, Wand2,
  ListChecks, Trash2, PlayCircle, CheckCircle2, XCircle, RotateCcw,
  Award
} from 'lucide-react'

// ============================================================================
// STYLE
// ============================================================================
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-300"
const mdButtonFilled = "bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-3.5 font-black transition-all duration-300 shadow-md hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
const mdButtonTonal = "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-full px-6 py-3 font-extrabold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"

type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'

type AnswerValue = string | string[] | Record<string, string> | null

type ExamSection = {
  id: string
  type: QuestionType
  name: string
  questionCount: number
  questionEntries: Record<string, { text: string; options?: string[] }>
  correctAnswers: Record<string, AnswerValue>
  scoringMode: 'auto_divide'
  sectionTotalPoints: number
}

type TrialExam = {
  id: string
  title: string
  source_file_names: string[]
  exam_structure: ExamSection[]
  created_at: string
}

type UploadedFile = { base64: string; mimeType: string; name: string }

const fileToBase64 = (file: File): Promise<UploadedFile> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1]
    resolve({ base64, mimeType: file.type || 'application/pdf', name: file.name })
  }
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const isQuestionCorrect = (studentAns: AnswerValue, correctAns: AnswerValue, type: QuestionType) => {
  if (correctAns === null || correctAns === undefined) return false
  if (type === 'multiple_choice') {
    return Array.isArray(studentAns) && Array.isArray(correctAns) &&
      studentAns.length === correctAns.length && studentAns.every(v => correctAns.includes(v))
  }
  if (type === 'true_false') {
    return typeof studentAns === 'object' && studentAns !== null && !Array.isArray(studentAns) &&
      typeof correctAns === 'object' && !Array.isArray(correctAns) &&
      ['a', 'b', 'c', 'd'].every(sub => studentAns[sub] === correctAns[sub])
  }
  return String(studentAns ?? '').trim().toLowerCase() === String(correctAns).trim().toLowerCase()
}

export default function TrialFeaturePage() {
  const router = useRouter()

  const [mode, setMode] = useState<'create' | 'list' | 'take' | 'result'>('create')
  const [loadingUser, setLoadingUser] = useState(true)

  // -- Tạo đề --
  const [questionFile, setQuestionFile] = useState<File | null>(null)
  const [answerFile, setAnswerFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // -- Danh sách đề đã tạo --
  const [exams, setExams] = useState<TrialExam[]>([])
  const [loadingExams, setLoadingExams] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -- Làm bài --
  const [activeExam, setActiveExam] = useState<TrialExam | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const fetchExams = async () => {
    setLoadingExams(true)
    const { data } = await supabase
      .from('ai_trial_exams')
      .select('*')
      .order('created_at', { ascending: false })
    setExams(data || [])
    setLoadingExams(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setLoadingUser(false)
      await fetchExams()
    }
    init()
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    if (!questionFile) { setGenerateError('Bạn cần tải lên ít nhất tệp đề bài (PDF).'); return }
    setGenerating(true)
    setGenerateError('')

    try {
      const files = await Promise.all([questionFile, answerFile].filter(Boolean).map(f => fileToBase64(f as File)))

      const res = await fetch('/api/generate-interactive-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI không thể xử lý tệp đã tải lên.')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const sourceNames = files.map(f => f.name)
      const { error: insertError } = await supabase.from('ai_trial_exams').insert({
        user_id: user.id,
        title: data.title,
        source_file_names: sourceNames,
        exam_structure: data.examStructure,
      })
      if (insertError) throw insertError

      setQuestionFile(null)
      setAnswerFile(null)
      await fetchExams()
      setMode('list')
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá đề thi thử nghiệm này? Hành động không thể hoàn tác.')) return
    setDeletingId(id)
    await supabase.from('ai_trial_exams').delete().eq('id', id)
    setExams(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  const startExam = (exam: TrialExam) => {
    setActiveExam(exam)
    setAnswers({})
    setMode('take')
  }

  const handleAnswer = (sectionId: string, qIdx: number, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [`${sectionId}-${qIdx}`]: value }))
  }

  const handleAnswerTF = (sectionId: string, qIdx: number, sub: string, value: string) => {
    const key = `${sectionId}-${qIdx}`
    const current = answers[key]
    const currentObj = (current && typeof current === 'object' && !Array.isArray(current)) ? current : {}
    setAnswers(prev => ({ ...prev, [key]: { ...currentObj, [sub]: value } }))
  }

  type ResultDetail = { section: ExamSection; qIdx: number; key: string; correct: boolean; studentAns: AnswerValue; correctAns: AnswerValue }

  const computeResult = () => {
    if (!activeExam) return { score: 0, total: 0, details: [] as ResultDetail[] }
    let score = 0
    let total = 0
    const details: ResultDetail[] = []
    activeExam.exam_structure.forEach(section => {
      const perQuestion = section.sectionTotalPoints / (section.questionCount || 1)
      total += section.sectionTotalPoints
      for (let qIdx = 0; qIdx < section.questionCount; qIdx++) {
        const key = `${section.id}-${qIdx}`
        const correctAns = section.correctAnswers?.[qIdx] ?? section.correctAnswers?.[String(qIdx)]
        const studentAns = answers[key]
        const correct = isQuestionCorrect(studentAns, correctAns, section.type)
        if (correct) score += perQuestion
        details.push({ section, qIdx, key, correct, studentAns, correctAns })
      }
    })
    return { score: Math.round(score * 100) / 100, total, details }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400 mb-6" />
        <p className="font-extrabold text-slate-500 tracking-widest uppercase text-sm animate-pulse">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 pb-16">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-400/20 to-purple-400/10 dark:from-indigo-800/20 dark:to-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="h-[80px] px-4 sm:px-6 lg:px-10 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] rounded-full transition-transform active:scale-95 shadow-inner border border-slate-200/50 dark:border-white/5">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300"/>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-500"/> Tính năng thử nghiệm
            </h1>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">AI tạo đề tương tác từ PDF</p>
          </div>
        </div>

        {(mode === 'create' || mode === 'list') && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1A1A1A] p-1.5 rounded-full border border-slate-200 dark:border-white/5">
            <button onClick={() => setMode('create')} className={`px-5 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 ${mode === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Sparkles className="w-3.5 h-3.5"/> Tạo đề mới
            </button>
            <button onClick={() => setMode('list')} className={`px-5 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 ${mode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <ListChecks className="w-3.5 h-3.5"/> Đề đã tạo ({exams.length})
            </button>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-6 relative z-10">

        {/* ============ TẠO ĐỀ MỚI ============ */}
        {mode === 'create' && (
          <div className={`${mdCard} p-8 space-y-6`}>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500"/> Tải lên tệp đề thi
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5">
                Tải tối đa 2 tệp PDF: đề bài (bắt buộc) và bảng đáp án riêng (nếu có). AI sẽ tự đọc, phân loại dạng câu hỏi (trắc nghiệm, đúng/sai, trả lời ngắn...) và tạo thành đề tương tác.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Đề bài (bắt buộc)', file: questionFile, setFile: setQuestionFile, id: 'question-file' },
                { label: 'Đáp án (không bắt buộc)', file: answerFile, setFile: setAnswerFile, id: 'answer-file' },
              ].map(slot => (
                <label
                  key={slot.id}
                  htmlFor={slot.id}
                  className="cursor-pointer border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-colors bg-slate-50/50 dark:bg-[#161616] min-h-[160px]"
                >
                  <input id={slot.id} type="file" accept="application/pdf" className="hidden" onChange={(e) => slot.setFile(e.target.files?.[0] || null)} />
                  {slot.file ? (
                    <>
                      <FileText className="w-8 h-8 text-indigo-500"/>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">{slot.file.name}</p>
                      <button type="button" onClick={(e) => { e.preventDefault(); slot.setFile(null) }} className="text-[11px] font-black text-rose-500 hover:text-rose-600 flex items-center gap-1 mt-1">
                        <X className="w-3 h-3"/> Gỡ tệp
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-slate-300 dark:text-slate-600"/>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{slot.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Nhấn để chọn tệp PDF</p>
                    </>
                  )}
                </label>
              ))}
            </div>

            {generateError && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-sm font-bold px-4 py-3 rounded-xl">
                {generateError}
              </div>
            )}

            <button onClick={handleGenerate} disabled={generating || !questionFile} className={`${mdButtonFilled} w-full`}>
              {generating ? <><Loader2 className="w-5 h-5 animate-spin"/> AI đang đọc và phân loại câu hỏi...</> : <><Sparkles className="w-5 h-5"/> Tạo đề bằng AI</>}
            </button>
          </div>
        )}

        {/* ============ DANH SÁCH ĐỀ ĐÃ TẠO ============ */}
        {mode === 'list' && (
          <div className="space-y-4">
            {loadingExams ? (
              <div className="flex items-center justify-center gap-2 text-slate-500 font-bold text-sm py-16">
                <Loader2 className="w-5 h-5 animate-spin"/> Đang tải danh sách đề...
              </div>
            ) : exams.length === 0 ? (
              <div className={`${mdCard} p-12 flex flex-col items-center text-center gap-3`}>
                <ListChecks className="w-12 h-12 text-slate-300 dark:text-slate-700"/>
                <p className="font-bold text-slate-600 dark:text-slate-400">Bạn chưa tạo đề thử nghiệm nào.</p>
                <button onClick={() => setMode('create')} className={mdButtonTonal}>
                  <Sparkles className="w-4 h-4"/> Tạo đề đầu tiên
                </button>
              </div>
            ) : (
              exams.map(exam => {
                const questionTotal = exam.exam_structure.reduce((sum, s) => sum + (s.questionCount || 0), 0)
                return (
                  <div key={exam.id} className={`${mdCard} p-6 flex items-center gap-5`}>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-inner border border-indigo-100 dark:border-indigo-500/20">
                      <FileText className="w-6 h-6"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 dark:text-white truncate">{exam.title}</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        {questionTotal} câu hỏi • {exam.exam_structure.length} phần • {new Date(exam.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <button onClick={() => startExam(exam)} className="p-3 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-colors active:scale-95" title="Làm bài">
                      <PlayCircle className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDelete(exam.id)} disabled={deletingId === exam.id} className="p-3 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors active:scale-95 disabled:opacity-50" title="Xoá đề">
                      {deletingId === exam.id ? <Loader2 className="w-5 h-5 animate-spin"/> : <Trash2 className="w-5 h-5"/>}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ============ LÀM BÀI ============ */}
        {mode === 'take' && activeExam && (
          <div className="space-y-6">
            <div className={`${mdCard} p-6 flex items-center justify-between`}>
              <h2 className="font-black text-lg text-slate-900 dark:text-white">{activeExam.title}</h2>
              <button onClick={() => setMode('result')} className={mdButtonFilled}>
                <CheckCircle2 className="w-4 h-4"/> Nộp bài
              </button>
            </div>

            {activeExam.exam_structure.map(section => (
              <div key={section.id} className={`${mdCard} p-6 space-y-5`}>
                <h3 className="font-black text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-white/10 pb-3">
                  {section.name}
                </h3>
                {Array.from({ length: section.questionCount }).map((_, qIdx) => {
                  const entry = section.questionEntries?.[qIdx] ?? section.questionEntries?.[String(qIdx)]
                  const key = `${section.id}-${qIdx}`
                  const currentAns = answers[key]
                  return (
                    <div key={qIdx} className="p-4 bg-slate-50 dark:bg-[#161616] rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        Câu {qIdx + 1}{entry?.text ? `: ${entry.text}` : ''}
                      </p>

                      {section.type === 'single_choice' && (
                        entry?.options?.length ? (
                          <div className="space-y-2">
                            {entry.options.map((opt, oIdx) => {
                              const label = String.fromCharCode(65 + oIdx)
                              return (
                                <button key={label} onClick={() => handleAnswer(section.id, qIdx, label)} className={`w-full text-left p-3 rounded-xl border text-xs font-bold flex items-center gap-3 transition-all ${currentAns === label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#252525]'}`}>
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black shrink-0 ${currentAns === label ? 'bg-white text-indigo-600' : 'bg-slate-100 dark:bg-[#2A2A2A] text-slate-500'}`}>{label}</span>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {['A', 'B', 'C', 'D'].map(label => (
                              <button key={label} onClick={() => handleAnswer(section.id, qIdx, label)} className={`w-10 h-10 rounded-full border text-xs font-black ${currentAns === label ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-white/10'}`}>{label}</button>
                            ))}
                          </div>
                        )
                      )}

                      {section.type === 'multiple_choice' && (
                        <div className="flex gap-2 flex-wrap">
                          {(entry?.options?.length ? entry.options.map((_, i) => String.fromCharCode(65 + i)) : ['A', 'B', 'C', 'D']).map(label => {
                            const arr = Array.isArray(currentAns) ? currentAns : []
                            const selected = arr.includes(label)
                            return (
                              <button key={label} onClick={() => handleAnswer(section.id, qIdx, selected ? arr.filter((a: string) => a !== label) : [...arr, label])} className={`w-10 h-10 rounded-lg border text-xs font-black ${selected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-white/10'}`}>{label}</button>
                            )
                          })}
                        </div>
                      )}

                      {section.type === 'true_false' && (
                        <div className="space-y-2">
                          {['a', 'b', 'c', 'd'].map(sub => {
                            const val = (currentAns && typeof currentAns === 'object' && !Array.isArray(currentAns)) ? currentAns[sub] : undefined
                            return (
                              <div key={sub} className="flex items-center gap-3 text-xs font-bold">
                                <span className="text-slate-400 w-5">Ý {sub}:</span>
                                <button onClick={() => handleAnswerTF(section.id, qIdx, sub, 'Đ')} className={`px-4 py-1.5 rounded-lg border ${val === 'Đ' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-white/10'}`}>Đúng</button>
                                <button onClick={() => handleAnswerTF(section.id, qIdx, sub, 'S')} className={`px-4 py-1.5 rounded-lg border ${val === 'S' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white dark:bg-[#202020] border-slate-200 dark:border-white/10'}`}>Sai</button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {section.type === 'short_answer' && (
                        <input type="text" value={typeof currentAns === 'string' ? currentAns : ''} onChange={(e) => handleAnswer(section.id, qIdx, e.target.value)} placeholder="Nhập đáp án..." className="w-full bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"/>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ============ KẾT QUẢ ============ */}
        {mode === 'result' && activeExam && (() => {
          const { score, total, details } = computeResult()
          return (
            <div className="space-y-6">
              <div className={`${mdCard} p-8 flex flex-col items-center text-center gap-3`}>
                <Award className="w-12 h-12 text-indigo-500"/>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Điểm của bạn</p>
                <p className="text-5xl font-black text-slate-900 dark:text-white">{score}<span className="text-xl text-slate-400">/{total}</span></p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setAnswers({}); setMode('take') }} className={mdButtonTonal}>
                    <RotateCcw className="w-4 h-4"/> Làm lại
                  </button>
                  <button onClick={() => { setActiveExam(null); setMode('list') }} className={mdButtonFilled}>
                    <ListChecks className="w-4 h-4"/> Quay lại danh sách
                  </button>
                </div>
              </div>

              <div className={`${mdCard} p-6 space-y-4`}>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-500">Chi tiết bài làm</h3>
                {details.map(d => (
                  <div key={d.key} className={`p-4 rounded-2xl border flex items-start gap-3 ${d.correct ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50/60 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'}`}>
                    {d.correct ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"/> : <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"/>}
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      <p>Câu {d.qIdx + 1} ({d.section.name})</p>
                      {!d.correct && (
                        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Đáp án đúng: {typeof d.correctAns === 'object' ? JSON.stringify(d.correctAns) : String(d.correctAns ?? '—')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}
