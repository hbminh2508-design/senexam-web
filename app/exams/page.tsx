'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Search, BookOpen, Clock, Target, ChevronLeft, 
  Filter, Lock, PlayCircle, Loader2, CheckCircle2
} from 'lucide-react'

// Apple Liquid Glass CSS Constants
const glassCardStyles = "bg-white/30 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]"
const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT']

export default function ExamsLibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<any[]>([])
  const [userSubmissions, setUserSubmissions] = useState<any[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('Tất cả')

  useEffect(() => {
    const fetchExamsAndHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

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
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [router])

  // Hàm đếm số lượt đã thi của một đề cụ thể
  const getAttemptsCount = (examId: string) => {
    return userSubmissions.filter(sub => sub.exam_id === examId).length
  }

  // Bộ lọc tìm kiếm và phân loại
  const filteredExams = exams.filter(exam => {
    const matchType = filterType === 'Tất cả' || exam.exam_type === filterType
    const matchSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchType && matchSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-500">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-bold">Đang tải kho tài liệu SenExam...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 relative font-sans overflow-x-hidden">
      
      {/* 🌟 LIQUID BACKGROUND ORBS 🌟 */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/40 to-indigo-400/30 dark:from-blue-800/40 dark:to-indigo-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-t from-emerald-300/30 to-teal-400/20 dark:from-emerald-900/30 dark:to-teal-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 animate-pulse pointer-events-none" style={{ animationDelay: '3s' }}></div>

      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* HEADER & THANH TÌM KIẾM */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3">
              <ChevronLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm flex items-center gap-3">
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
                className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-2xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all"
              />
            </div>

            <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/50 dark:border-white/10 p-1.5 rounded-2xl shadow-sm">
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
          <div className={`${glassCardStyles} rounded-[2rem] p-16 text-center flex flex-col items-center justify-center border-t-white/60 border-l-white/60`}>
            <BookOpen className="w-16 h-16 text-slate-400 mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Không tìm thấy đề thi phù hợp</h3>
            <p className="text-slate-500 mt-2 font-medium">Hãy thử thay đổi từ khóa hoặc bộ lọc kỳ thi.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredExams.map((exam) => {
              const attempts = getAttemptsCount(exam.id)
              // Logic khóa: Nếu max_attempts lớn hơn 0 VÀ số lần làm đã chạm ngưỡng
              const isLocked = exam.max_attempts > 0 && attempts >= exam.max_attempts

              return (
                <div key={exam.id} className={`${glassCardStyles} rounded-[2rem] p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 group`}>
                  
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-3 py-1.5 bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black uppercase tracking-wider backdrop-blur-sm border border-blue-200 dark:border-blue-800/50 shadow-sm">
                        {exam.exam_type}
                      </span>
                      {exam.max_attempts > 0 && (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border backdrop-blur-sm shadow-sm flex items-center gap-1 ${isLocked ? 'bg-red-100/80 text-red-600 border-red-200' : 'bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/50'}`}>
                          {isLocked ? <Lock className="w-3 h-3"/> : <CheckCircle2 className="w-3 h-3"/>}
                          Lượt làm: {attempts}/{exam.max_attempts}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-snug mb-3 drop-shadow-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {exam.title}
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
                          : 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white border-white/20 hover:scale-105 hover:shadow-[0_4px_15px_rgba(59,130,246,0.4)]'
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