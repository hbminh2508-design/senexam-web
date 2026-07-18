'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { 
  Search, BookOpen, Clock, Target, ChevronLeft, 
  Filter, Lock, PlayCircle, Loader2, CheckCircle2
} from 'lucide-react'

import { glassSearchInputClass, highlightSearchText } from '@/app/components/searchUtils'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'

// Apple Liquid Glass CSS Constants
const glassCardStyles = "liquid-panel relative"
const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT']

export default function ExamsLibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<any[]>([])
  const [userSubmissions, setUserSubmissions] = useState<any[]>([])
  const { newUiEnabled, themeColor } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [filterType, setFilterType] = useState('Tất cả')

  useEffect(() => {
    const fetchExamsAndHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      await ensureStudentProfile(user.id)

      // 1. Lấy toàn bộ danh sách đề thi (ĐÃ TÍCH HỢP BỘ LỌC ẨN ĐỀ PRIVATE)
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .or('is_hidden.eq.false,is_hidden.is.null') // 🔒 Khiên bảo mật: Chặn đề thi có mã truy cập
        .order('created_at', { ascending: false })

      // 2. Lấy lịch sử làm bài của CHÍNH HỌC SINH NÀY để đếm số lượt thi
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('exam_id')
        .eq('user_id', user.id)

      setExams(examsData || [])
      setUserSubmissions(submissionsData || [])
      setLoading(false)
    }

    fetchExamsAndHistory()

    // Giữ nguyên giao diện Dark Mode
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) {
      document.documentElement.classList.add('dark')
    }
    setIsDark(dark)
  }, [router])

  // Hàm đếm số lượt đã thi của một đề cụ thể
  const getAttemptsCount = (examId: string) => {
    return userSubmissions.filter(sub => sub.exam_id === examId).length
  }

  // Bộ lọc tìm kiếm và phân loại
  const filteredExams = exams.filter(exam => {
    const matchType = filterType === 'Tất cả' || exam.exam_type === filterType
    const matchSearch = exam.title.toLowerCase().includes(deferredSearchQuery.toLowerCase())
    return matchType && matchSearch
  })

  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-500">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-bold">Đang tải kho tài liệu SenExam...</p>
        </div>
      </div>
    )
  }

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans pb-16"
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-medium mb-4 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft className="w-4 h-4" /> Về trang chủ
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Kho đề thi</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tổng hợp {exams.length} đề thi bám sát cấu trúc mới nhất.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none bg-transparent"
                  style={{ border: '1px solid var(--border)' }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: '1px solid var(--border)' }}>
                <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm bg-transparent outline-none cursor-pointer"
                >
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {filteredExams.length === 0 ? (
            <div className="rounded-2xl p-16 text-center" style={{ border: '1px dashed var(--border)' }}>
              <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <h3 className="font-medium">Không tìm thấy đề thi phù hợp</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Hãy thử thay đổi từ khóa hoặc bộ lọc kỳ thi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredExams.map((exam) => {
                const attempts = getAttemptsCount(exam.id)
                const isLocked = exam.max_attempts > 0 && attempts >= exam.max_attempts
                return (
                  <div key={exam.id} className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                          {highlightSearchText(exam.exam_type, deferredSearchQuery)}
                        </span>
                        {exam.max_attempts > 0 && (
                          <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: isLocked ? '#DC2626' : 'var(--text-muted)' }}>
                            {isLocked ? <Lock className="w-3 h-3"/> : <CheckCircle2 className="w-3 h-3"/>}
                            {attempts}/{exam.max_attempts}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold leading-snug mb-2 line-clamp-2">
                        {highlightSearchText(exam.title, deferredSearchQuery)}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {exam.subjects?.map((sub: string) => (
                          <span key={sub} className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3.5 h-3.5" /> {exam.duration} phút
                      </div>
                      <button
                        onClick={() => !isLocked && router.push(`/exams/${exam.id}`)}
                        disabled={isLocked}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={isLocked ? { background: 'var(--border)', color: 'var(--text-muted)' } : { background: 'var(--accent)', color: '#fff' }}
                      >
                        {isLocked ? <>Đã hết lượt <Lock className="w-3.5 h-3.5"/></> : <>Vào thi <PlayCircle className="w-3.5 h-3.5"/></>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent text-slate-900 dark:text-slate-100 relative font-sans overflow-x-hidden">
      
      {/* 🌟 LIQUID BACKGROUND ORBS 🌟 */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-800/35 dark:to-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 bounce-float pointer-events-none"></div>
      <div className="fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-t from-emerald-300/20 to-teal-400/14 dark:from-emerald-900/25 dark:to-teal-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 bounce-float-delayed pointer-events-none"></div>

      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* HEADER & THANH TÌM KIẾM */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 mb-8">
          <div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3">
              <ChevronLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-sm flex items-center gap-3">
              Kho Đề Thi <span className="text-blue-600 dark:text-blue-400">SenExam</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 font-medium mt-2">Tổng hợp {exams.length} đề thi bám sát cấu trúc mới nhất.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group w-full md:w-72">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Tìm kiếm tên đề thi..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${glassSearchInputClass} pl-11 pr-4 py-3`}
              />
            </div>

            <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/60 dark:border-white/10 p-1.5 rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <Filter className="w-4 h-4 text-slate-500 ml-2 shrink-0" />
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)} 
                className="text-sm font-bold bg-transparent outline-none cursor-pointer pr-2 text-slate-700 dark:text-slate-300"
              >
                {EXAM_TYPES.map(t => <option key={t} value={t} className="dark:bg-slate-800">{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* LƯỚI DANH SÁCH ĐỀ THI */}
        {filteredExams.length === 0 ? (
          <div className={`${glassCardStyles} rounded-[2rem] p-16 text-center flex flex-col items-center justify-center border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
            <BookOpen className="w-16 h-16 text-slate-400 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Không tìm thấy đề thi phù hợp</h3>
            <p className="text-slate-500 mt-2 font-medium">Hãy thử thay đổi từ khóa hoặc bộ lọc kỳ thi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredExams.map((exam) => {
              const attempts = getAttemptsCount(exam.id)
              // Logic khóa: Nếu max_attempts lớn hơn 0 VÀ số lần làm đã chạm ngưỡng
              const isLocked = exam.max_attempts > 0 && attempts >= exam.max_attempts

              return (
                <div key={exam.id} className={`${glassCardStyles} rounded-[2rem] p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(37,99,235,0.15)] transition-all duration-300 border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 group`}>
                  
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-3 py-1.5 bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black uppercase tracking-wider backdrop-blur-sm border border-blue-200 dark:border-blue-800/50 shadow-sm">
                        {highlightSearchText(exam.exam_type, deferredSearchQuery)}
                      </span>
                      {exam.max_attempts > 0 && (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border backdrop-blur-sm shadow-sm flex items-center gap-1 ${isLocked ? 'bg-red-100/80 text-red-600 border-red-200' : 'bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/50'}`}>
                          {isLocked ? <Lock className="w-3 h-3"/> : <CheckCircle2 className="w-3 h-3"/>}
                          Lượt làm: {attempts}/{exam.max_attempts}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-snug mb-3 drop-shadow-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 tracking-tight">
                      {highlightSearchText(exam.title, deferredSearchQuery)}
                    </h3>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {exam.subjects?.map((sub: string) => (
                        <span key={sub} className="px-2 py-1 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-white/50 dark:border-slate-700 backdrop-blur-sm">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-sm">
                      <Clock className="w-4 h-4" /> {exam.duration} phút
                    </div>
                    
                    <button 
                      onClick={() => !isLocked && router.push(`/exams/${exam.id}`)}
                      disabled={isLocked}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm backdrop-blur-md border ${
                        isLocked 
                          ? 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400 border-slate-300/50 dark:border-slate-700/50 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-cyan-600/90 text-white border-white/20 hover:scale-105 hover:shadow-[0_6px_18px_rgba(59,130,246,0.38)]'
                      }`}
                    >
                      {isLocked ? (
                        <>Đã hết lượt <Lock className="w-4 h-4"/></>
                      ) : (
                        <>Vào thi <PlayCircle className="w-4 h-4"/></>
                      )}
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}