'use client'

import { useDeferredValue, useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { 
  BookOpen, Clock, Trophy, Target, LogOut, User, 
  ChevronRight, MessageSquare, Zap, ShieldCheck, AlertCircle, Search,
  Settings, X, Sun, Moon, MapPin, GraduationCap, Loader2, Eye, KeyRound, 
  FolderOpen, Sparkles, Lock, Music2, ArrowRight, Calculator, Hash, 
  CheckCircle2, Info, BarChart3, FileText, Bot, FlaskConical, PlaySquare,
  RefreshCw, History, Check, Flame, Star, Compass, DownloadCloud, BarChart
} from 'lucide-react'

import { glassSearchInputClass, glassSearchPanelClass, highlightSearchText } from '@/app/components/searchUtils'
import ChatOffline from '@/app/components/ChatOffline'

// ============================================================================
// 1. CẤU HÌNH HẰNG SỐ & STYLE VINTAGE MƯỚT MẮT (EASE-IN-OUT TRANSITIONS)
// ============================================================================

const PROVINCES = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Điện Biên', 'Đắk Lắk', 
  'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Tĩnh', 'Hưng Yên', 'Khánh Hòa', 
  'Lai Châu', 'Lạng Sơn', 'Lào Cai', 'Lâm Đồng', 'Nghệ An', 'Ninh Bình', 
  'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh', 
  'Thái Nguyên', 'Thanh Hóa', 'Thành phố Cần Thơ', 'Thành phố Đà Nẵng', 
  'Thành phố Hà Nội', 'Thành phố Hải Phòng', 'Thành phố Hồ Chí Minh', 
  'Thành phố Huế', 'Tuyên Quang', 'Vĩnh Long'
]

const EXAMS = ['THPTQG', 'HSA', 'TSA', 'SPT']
const THPTQG_SUBJECTS = ['Toán', 'Ngữ Văn', 'Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí', 'Tiếng Anh', 'GDKT&PL', 'Tin Học', 'Công Nghệ']

// Vintage Sketch Style Constants (Hiệu ứng đổ bóng mượt nghệ thuật)
const vintageCard = "bg-[#FCF9F2] dark:bg-slate-900 border-2 border-[#4A3E3D] rounded-2xl shadow-[4px_4px_0px_0px_#4A3E3D] hover:shadow-[8px_8px_0px_0px_#4A3E3D] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const vintageInput = "w-full bg-[#FAF6EE] dark:bg-slate-800 border-2 border-[#4A3E3D] focus:bg-white rounded-xl px-4 py-3 outline-none font-medium text-slate-800 dark:text-white transition-all duration-300"
const vintageBtnFilled = "bg-[#D96B43] hover:bg-[#C85A32] border-2 border-[#4A3E3D] text-white rounded-xl px-6 py-3 font-bold transition-all duration-300 shadow-[3px_3px_0px_0px_#4A3E3D] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2"

// ============================================================================
// 2. CÁC COMPONENT TIỆN ÍCH
// ============================================================================

export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { 
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer) 
  }, [])
  
  const target = new Date(targetDate).getTime()
  if (isNaN(target)) return <span className="text-red-600 font-medium">[Ngày không hợp lệ]</span>
  const diff = target - now
  
  if (diff <= 0) return <span className="text-slate-400 text-sm">⏳ Sự kiện đã diễn ra</span>
  
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  
  return (
    <span className="inline-flex items-center bg-[#EAD5C3] border border-[#4A3E3D] text-[#4A3E3D] px-3 py-1 rounded-md text-xs font-semibold animate-pulse">
      ⏳ Còn {d} ngày {h} giờ {m} phút
    </span>
  )
}

export const AnnouncementRenderer = ({ text }: { text: string }) => {
  return (
    <div className="w-full text-sm text-[#4A3E3D] dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
      {text}
    </div>
  )
}

// ============================================================================
// 3. COMPONENT CHÍNH DASHBOARD
// ============================================================================

export default function DashboardPage() {
  const router = useRouter()
  
  // -- States --
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isDataLoading, setIsDataLoading] = useState(true) 
  const [showOnboarding, setShowOnboarding] = useState(false) 
  const [showProfile, setShowProfile] = useState(false)
  const [isDark, setIsDark] = useState(false)
  
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null)
  const [studentHistoryList, setStudentHistoryList] = useState<any[]>([])
  const [currentVersion, setCurrentVersion] = useState<string>('2.0.72')
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const versionHistory = ['2.0.70', '2.0.65']

  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '', dob: '', cccd: '', province: '', school: '', aspiration: '',
    targetExams: [] as string[], targetSubjects: [] as string[],
    hsaOption: '' as 'Tiếng Anh' | 'Khoa học' | '', hsaScienceSubjects: [] as string[]
  })

  const [isAiEnabled, setIsAiEnabled] = useState(true)
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalDocsResults, setGlobalDocsResults] = useState<any[] | null>(null)
  const [globalExamsResults, setGlobalExamsResults] = useState<any[] | null>(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  
  const deferredGlobalQuery = useDeferredValue(globalQuery)
  const globalSearchDebounce = useRef<number | null>(null)
  const globalSearchRequestRef = useRef(0)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? null)

      await ensureStudentProfile(user.id)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      if (profile) {
        setFormData({
          fullName: profile.full_name || '', dob: profile.dob || '', cccd: profile.cccd || '',
          province: profile.province || '', school: profile.school || '', aspiration: profile.aspiration || '',
          targetExams: profile.target_exams || [], targetSubjects: profile.target_subjects || [],
          hsaOption: profile.hsa_option || '', hsaScienceSubjects: profile.hsa_science_subjects || []
        })

        if (!profile.full_name || !profile.target_exams || profile.target_exams.length === 0) { 
          setShowOnboarding(true) 
        }

        const { data: subHistory } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_type, allow_review)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        setStudentHistoryList(subHistory || [])
      } else { 
        setShowOnboarding(true) 
      }

      const nowISO = new Date().toISOString()
      const { data: notifData } = await supabase
        .from('announcements')
        .select('content')
        .eq('is_active', true)
        .or(`start_time.is.null,start_time.lte.${nowISO}`)
        .or(`end_time.is.null,end_time.gte.${nowISO}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (notifData) setActiveAnnouncement(notifData.content)
      
      // Tạo độ trễ mượt để tận hưởng hoạt cảnh loading bức tranh vintage
      setTimeout(() => setIsDataLoading(false), 2200)
    }
    
    fetchUserData()

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true); document.documentElement.classList.add('dark')
    }
    setIsAiEnabled(localStorage.getItem('senai_enabled') !== '0')
  }, [router])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  const handleSystemUpdate = () => {
    setIsUpdating(true)
    setTimeout(() => {
      setCurrentVersion('Build.2026.Latest')
      setIsUpdating(false)
      alert('Đã đồng bộ thành công hệ thống phiên bản mới nhất từ SenExam!')
    }, 1500)
  }

  const toggleExam = (exam: string) => { setFormData(prev => ({ ...prev, targetExams: prev.targetExams.includes(exam) ? prev.targetExams.filter(e => e !== exam) : [...prev.targetExams, exam] })) }
  const toggleSubject = (subject: string) => { setFormData(prev => ({ ...prev, targetSubjects: prev.targetSubjects.includes(subject) ? prev.targetSubjects.filter(s => s !== subject) : [...prev.targetSubjects, subject] })) }

  const handleSaveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ full_name: formData.fullName, province: formData.province, school: formData.school, target_exams: formData.targetExams, target_subjects: formData.targetSubjects }).eq('id', user.id)
    if (error) alert("Có lỗi xảy ra: " + error.message); else { setShowOnboarding(false); setShowProfile(false); }
  }

  const handleJoinHiddenExam = async () => {
    if (!examCode.trim()) return
    setCodeLoading(true)
    const { data, error } = await supabase.from('exams').select('id, title').eq('access_code', examCode.trim().toUpperCase()).single()
    if (error || !data) { alert('Mã đề thi không hợp lệ!'); setCodeLoading(false); } else { router.push(`/exams/${data.id}`) }
  }

  // Global Search Logic
  const handleGlobalSearch = async (q?: string) => {
    const qtrim = (q ?? globalQuery).trim()
    if (!qtrim) { setShowGlobalResults(false); return; }
    const requestId = ++globalSearchRequestRef.current
    setGlobalSearchLoading(true); setShowGlobalResults(true)
    
    try {
      const [docsRes, examsRes] = await Promise.all([
        supabase.from('library_documents').select('id, title').limit(10),
        supabase.from('exams').select('id, title').limit(10)
      ])
      if (requestId !== globalSearchRequestRef.current) return
      setGlobalDocsResults((docsRes.data || []).filter((d: any) => d.title.toLowerCase().includes(qtrim.toLowerCase())))
      setGlobalExamsResults((examsRes.data || []).filter((e: any) => e.title.toLowerCase().includes(qtrim.toLowerCase())))
    } catch (e) { console.warn(e) }
    if (requestId === globalSearchRequestRef.current) setGlobalSearchLoading(false)
  }

  useEffect(() => {
    if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current)
    if (!globalQuery || globalQuery.trim().length < 2) { setShowGlobalResults(false); return; }
    // @ts-ignore
    globalSearchDebounce.current = window.setTimeout(() => handleGlobalSearch(globalQuery), 400)
    return () => { if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current) }
  }, [globalQuery])

  const BENTO_TOOLS = [
    { path: '/focus', title: 'Phòng Tập Trung', desc: 'Đồng hồ Pomodoro & Không gian yên tĩnh học tập.', bg: 'bg-[#EDE7F6] dark:bg-slate-800', icon: <Music2 className="w-5 h-5 text-purple-700"/> },
    { path: '/library', title: 'Thư Viện Số', desc: 'Chuyên đề kiến thức tinh lọc cốt lõi.', bg: 'bg-[#E0F7FA] dark:bg-slate-800', icon: <FolderOpen className="w-5 h-5 text-cyan-700"/> },
    { path: '/senvideo', title: 'SenVideo', desc: 'Chuỗi bài giảng trực quan phân tích chuyên sâu.', bg: 'bg-[#E8EAF6] dark:bg-slate-800', icon: <PlaySquare className="w-5 h-5 text-indigo-700"/> },
    { path: '/phongthinghiem', title: 'Phòng Thí Nghiệm', desc: 'Mô phỏng hiện tượng khoa học tương tác trực quan.', bg: 'bg-[#E8F5E9] dark:bg-slate-800', icon: <FlaskConical className="w-5 h-5 text-emerald-700"/> },
    { path: '/forum', title: 'Cộng Đồng', desc: 'Giao lưu học tập, trao đổi giải đáp câu hỏi khó.', bg: 'bg-[#FFF3E0] dark:bg-slate-800', icon: <MessageSquare className="w-5 h-5 text-amber-700"/> },
    { path: '/tinhdiem', title: 'Tính Điểm ĐH', desc: 'Công cụ quy chuẩn điểm xét tuyển tự động chuẩn xác.', bg: 'bg-[#FFEBEE] dark:bg-slate-800', icon: <Calculator className="w-5 h-5 text-rose-700"/> }
  ]

  // ============================================================================
  // 🌟 MÀN HÌNH LOADING VINTAGE: TRƯỜNG HỌC BỨC TRANH CÓ HỌC SINH ĐANG CHẠY MƯỢT MÀ
  // ============================================================================
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-[#F4EAD4] flex flex-col items-center justify-center p-6 transition-all duration-1000 ease-in-out">
        <div className="w-full max-w-lg border-2 border-dashed border-[#614E43] rounded-3xl p-10 bg-[#FAF4E8] shadow-inner text-center space-y-8 relative overflow-hidden">
          
          {/* Hình vẽ Trường học kiểu Tranh phác thảo nghệ thuật cổ điển */}
          <div className="relative flex flex-col items-center justify-center">
            <span className="text-8xl select-none filter sepia drop-shadow-md animate-pulse">🏫</span>
            <div className="absolute -bottom-1 w-32 h-1 bg-[#614E43]/30 rounded-full"></div>
          </div>

          <div className="space-y-2">
            <h2 className="font-serif text-2xl font-bold text-[#4A3E3D] tracking-wide">Trường Học SenExam</h2>
            <p className="text-xs italic text-[#7C6A5E]">Nơi ghi dấu hành trình chinh phục tri thức...</p>
          </div>

          {/* Đường chạy phác thảo hoài niệm với học sinh đang chạy mướt mắt */}
          <div className="w-full h-8 border-b-2 border-dotted border-[#614E43] relative mt-6">
            <span className="absolute bottom-1 text-4xl animate-inline-running select-none">🏃‍♂️</span>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#614E43] pt-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D96B43]" />
            <span>Đang chuẩn bị bảng phấn và tài liệu làm bài...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF6EE] dark:bg-[#121620] text-slate-800 dark:text-slate-100 font-sans relative overflow-x-hidden pb-12 transition-colors duration-500 ease-out animate-fade-in">
      
      {/* ========================================================= */}
      {/* 🌟 APP BAR (HEADER) - VINTAGE MINIMALIST */}
      {/* ========================================================= */}
      <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between bg-[#FCF9F2] dark:bg-slate-900 border-b-2 border-[#4A3E3D] sticky top-0 z-40 shadow-sm transition-all duration-300">
        
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => router.push('/dashboard')}>
          <div className="w-11 h-11 rounded-xl bg-[#EAD5C3] border-2 border-[#4A3E3D] flex items-center justify-center p-1 group-hover:rotate-6 transition-transform duration-500 ease-out">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain filter sepia" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-black tracking-wide text-[#4A3E3D] dark:text-white">SenExam</h1>
            <span className="text-[10px] font-medium text-[#7C6A5E] dark:text-slate-400 block tracking-tight">Hệ thống khảo thí số độc quyền</span>
          </div>
        </div>

        {/* Tìm kiếm tinh gọn */}
        <div className="flex-1 max-w-md mx-6 relative z-50 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C6A5E]" />
            <input 
              value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} 
              placeholder="Tìm kiếm tài liệu, đề khảo thí..." className={vintageInput + " pl-10 pr-8 py-2 text-xs"}
            />
          </div>

          {showGlobalResults && (
            <div className="absolute top-[calc(100%+8px)] w-full bg-white dark:bg-slate-950 border-2 border-[#4A3E3D] rounded-xl shadow-lg overflow-hidden max-h-[60vh]">
              <div className="p-2 overflow-y-auto text-xs">
                {globalSearchLoading ? <div className="p-3 text-center text-slate-400">Đang tra cứu mục lục...</div> : (
                  <>
                    {globalExamsResults?.map(e => <div key={e.id} onClick={() => router.push(`/exams/${e.id}`)} className="p-2 hover:bg-[#FAF6EE] rounded cursor-pointer font-medium">{e.title}</div>)}
                    {globalDocsResults?.map(d => <div key={d.id} onClick={() => router.push(`/library?preview=${d.id}`)} className="p-2 hover:bg-[#FAF6EE] rounded cursor-pointer font-medium">{d.title}</div>)}
                    {!globalExamsResults?.length && !globalDocsResults?.length && <div className="p-3 text-center text-slate-400">Không tìm thấy kết quả hợp lệ.</div>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cửa sổ điều khiển hành vi */}
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2 border-2 border-[#4A3E3D] bg-[#FAF6EE] rounded-xl text-[#4A3E3D] hover:bg-[#EAD5C3] transition-all duration-300">
            {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <div onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full bg-[#D96B43] border-2 border-[#4A3E3D] text-white flex items-center justify-center font-bold text-sm cursor-pointer hover:scale-105 transition-all duration-300">
            {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
          </div>
        </div>
      </header>

      {/* ============================================================================ */}
      {/* 🌟 MAIN WORKSPACE - TRANH VINTAGE SẮC MÀU HÀI HÒA MƯỚT MẮT */}
      {/* ============================================================================ */}
      <main className={`max-w-7xl mx-auto p-4 sm:p-8 space-y-8 relative z-10 transition-all duration-700 ease-out ${ (showOnboarding || showProfile || showCodeModal) ? 'opacity-10 blur-sm scale-[0.98]' : '' }`}>
        
        {/* Banner Thông báo hoài cổ */}
        {activeAnnouncement && (
          <div className="bg-[#EAD5C3]/40 border-2 border-[#4A3E3D] rounded-2xl p-4 flex items-start gap-3 transition-transform duration-500">
            <AlertCircle className="w-5 h-5 text-[#D96B43] shrink-0 mt-0.5"/>
            <div className="flex-1 font-medium"><AnnouncementRenderer text={activeAnnouncement} /></div>
          </div>
        )}

        {/* KHU VỰC HERO ĐÓN TIẾP KHẢO THÍ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-8 bg-[#E6F0FA] dark:bg-slate-800 border-2 border-[#4A3E3D] rounded-2xl p-6 sm:p-8 text-[#4A3E3D] dark:text-slate-100 relative overflow-hidden shadow-[4px_4px_0px_0px_#4A3E3D]">
            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-1 bg-[#D96B43] text-white px-3 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Hành Trình Tri Thức</span>
              <h2 className="text-2xl sm:text-4xl font-serif font-black leading-tight">Bảng vàng cá nhân mục tiêu <br/><span className="text-[#D96B43] dark:text-orange-400">{formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'KỲ THI QUỐC GIA'}</span></h2>
              <p className="text-xs font-medium text-[#614E43] dark:text-slate-300 max-w-md leading-relaxed">Không gian tối giản hỗ trợ rà soát lỗ hổng, lưu trữ lịch sử chấm điểm tự động và đo lường năng lực chuẩn xác.</p>
              
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => router.push('/exams')} className={vintageBtnFilled}>Bắt đầu làm bài</button>
                <button onClick={() => setShowCodeModal(true)} className="px-5 py-2.5 bg-[#FAF6EE] hover:bg-[#EAD5C3] border-2 border-[#4A3E3D] text-[#4A3E3D] font-bold rounded-xl text-xs transition-all duration-300 shadow-[2px_2px_0px_0px_#4A3E3D]">Vào phòng ẩn</button>
              </div>
            </div>
          </div>

          {/* 🌟 CỘT ĐIỂM SỐ & THANH NGANG THỨ 3: CHECK PHỔ ĐIỂM 2026 */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className={vintageCard + " p-4 flex items-center gap-4 bg-[#EAF2E8]"}>
              <div className="w-11 h-11 bg-white border-2 border-[#4A3E3D] rounded-xl flex items-center justify-center text-[#4CAF50]"><Trophy className="w-5 h-5 fill-current"/></div>
              <div><p className="text-[10px] font-bold text-[#614E43] uppercase tracking-wider">Kỷ lục điểm số</p><p className="text-xl font-serif font-black text-slate-900 leading-none mt-1">{studentHistoryList.length > 0 ? Math.max(...studentHistoryList.map(s => s.score || 0)) : '--'}</p></div>
            </div>
            
            <div className={vintageCard + " p-4 flex items-center gap-4 bg-[#EBF3F5]"}>
              <div className="w-11 h-11 bg-white border-2 border-[#4A3E3D] rounded-xl flex items-center justify-center text-[#2196F3]"><FileText className="w-5 h-5"/></div>
              <div><p className="text-[10px] font-bold text-[#614E43] uppercase tracking-wider">Số đề đã hoàn thành</p><p className="text-xl font-serif font-black text-slate-900 leading-none mt-1">{studentHistoryList.length} bộ đề</p></div>
            </div>

            {/* 🌟 THANH NGANG THỨ 3: CHECK PHỔ ĐIỂM 2026 MỚI NHẤT */}
            <div onClick={() => router.push('/phodiem2026')} className={vintageCard + " p-4 flex items-center justify-between bg-[#FDF2E9] cursor-pointer group hover:bg-[#FBEBE1]"}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-white border-2 border-[#4A3E3D] rounded-xl flex items-center justify-center text-[#D96B43] group-hover:rotate-6 transition-transform duration-300"><BarChart className="w-5 h-5"/></div>
                <div>
                  <p className="text-[10px] font-bold text-[#614E43] uppercase tracking-wider">Công cụ đo lường</p>
                  <p className="text-sm font-bold text-[#4A3E3D] leading-none mt-1">Check phổ điểm thi 2026</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#4A3E3D] transform group-hover:translate-x-1 transition-transform duration-300"/>
            </div>
          </div>
        </div>

        {/* LƯỚI BENTO CÔNG CỤ VINTAGE MƯỚT MẮT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {BENTO_TOOLS.map((box, i) => (
            <div key={i} onClick={() => router.push(box.path)} className={vintageCard + ` p-4 flex flex-col items-start cursor-pointer group ${box.bg}`}>
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#4A3E3D] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-500 ease-out shadow-sm">{box.icon}</div>
              <h3 className="text-sm font-bold text-[#4A3E3D]">{box.title}</h3>
              <p className="text-[11px] font-medium text-[#7C6A5E] dark:text-slate-300 mt-1 leading-snug">{box.desc}</p>
            </div>
          ))}
        </div>

        {/* WORKSPACE TRỢ LÝ ĐỘC QUYỀN */}
        <div onClick={() => router.push('/senai')} className="bg-[#FAF0E6] border-2 border-[#4A3E3D] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer shadow-[3px_3px_0px_0px_#4A3E3D] hover:shadow-[5px_5px_0px_0px_#4A3E3D] transition-all duration-500 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white border-2 border-[#4A3E3D] flex items-center justify-center text-slate-700 font-bold text-xl group-hover:rotate-3 transition-transform">🤖</div>
            <div>
              <h3 className="text-base font-bold text-[#4A3E3D]">Không gian Trợ lý Phân tích Học thuật</h3>
              <p className="text-xs font-medium text-[#7C6A5E] mt-0.5">Tự động phát hiện lỗ hổng sơ đồ tư duy giải quyết câu hỏi khó qua ảnh chụp.</p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 bg-[#4A3E3D] text-white font-medium px-4 py-2 rounded-lg text-xs flex items-center gap-1">Khám phá <ArrowRight className="w-3.5 h-3.5"/></div>
        </div>

        {/* LỊCH SỬ KHẢO THÍ VỪA QUA */}
        <div className={vintageCard + " p-6 bg-[#FCF9F2]"}>
          <h3 className="text-base font-bold text-[#4A3E3D] flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-[#D96B43]"/> Nhật ký chấm điểm khảo thí gần đây</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-medium text-xs">Chưa ghi nhận dữ liệu làm đề thi nào.</div>
            ) : (
              studentHistoryList.map(sub => (
                <div key={sub.id} className="p-3 bg-white dark:bg-slate-800 border border-[#4A3E3D]/30 rounded-xl flex items-center justify-between hover:bg-[#FAF6EE] transition-colors duration-300">
                  <div className="min-w-0 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#D96B43] shrink-0"/>
                    <div className="truncate"><h4 className="font-bold text-xs text-[#4A3E3D] dark:text-white truncate">{sub.exams?.title}</h4><p className="text-[10px] uppercase text-[#7C6A5E] tracking-wider mt-0.5">{sub.exams?.exam_type}</p></div>
                  </div>
                  <div className="bg-[#EAD5C3] text-[#4A3E3D] border border-[#4A3E3D] px-2.5 py-0.5 rounded-md text-xs font-bold shrink-0">{sub.is_graded ? `${String(sub.score).replace('.', ',')}đ` : 'Chờ bộ lọc'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* 🌟 OVERLAYS: PANEL CẤU HÌNH & KIỂM TRA PHIÊN BẢN TRONG SETTING */}
      {/* ========================================================= */}

      {showProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-all duration-500">
          <div className="w-full max-w-sm h-full bg-[#FCF9F2] border-l-2 border-[#4A3E3D] p-6 flex flex-col space-y-6 overflow-y-auto animate-slide-left">
            <div className="flex justify-between items-center border-b border-[#4A3E3D]/20 pb-3">
              <h2 className="text-base font-serif font-black text-[#4A3E3D] flex items-center gap-1.5"><Settings className="w-4 h-4"/> Cài đặt SenExam</h2>
              <button onClick={() => setShowProfile(false)} className="p-1 border border-[#4A3E3D] rounded-md hover:bg-red-50"><X className="w-3.5 h-3.5"/></button>
            </div>

            {/* Thông tin học viên */}
            <div className="bg-[#FAF4E8] border border-[#4A3E3D] rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#D96B43] rounded-full text-white font-bold flex items-center justify-center text-sm">{formData.fullName ? formData.fullName.charAt(0).toUpperCase() : 'U'}</div>
              <div className="min-w-0 flex-1"><h3 className="font-bold text-xs text-[#4A3E3D] truncate">{formData.fullName || 'Học viên ẩn danh'}</h3><p className="text-[11px] text-[#7C6A5E] truncate">{userEmail}</p></div>
            </div>

            {/* 🌟 NÚT CẬP NHẬT PHIÊN BẢN MỚI TRONG SETTING */}
            <div className="bg-[#E6F0FA] border border-[#4A3E3D] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-[#4A3E3D] uppercase tracking-wider flex items-center gap-1"><DownloadCloud className="w-3.5 h-3.5"/> Kiểm tra cập nhật cấu trúc</h4>
              <div className="bg-white p-2.5 rounded-lg border border-[#4A3E3D]/30 flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">Phiên bản hiện tại</p>
                  <p className="font-bold text-[#D96B43] mt-0.5">{currentVersion}</p>
                </div>
                <button 
                  onClick={handleSystemUpdate} disabled={isUpdating}
                  className="px-3 py-1.5 bg-[#4A3E3D] hover:bg-slate-700 text-white font-semibold rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Check Update
                </button>
              </div>
            </div>

            {/* Cài đặt cấu hình nhanh */}
            <div className="border border-[#4A3E3D] rounded-xl bg-white text-xs divide-y divide-[#4A3E3D]/10">
              <div className="flex items-center justify-between p-3">
                <span className="font-medium text-[#4A3E3D]">Hỗ trợ giải toán nâng cao bằng AI</span>
                <input type="checkbox" checked={isAiEnabled} onChange={() => {const n=!isAiEnabled; setIsAiEnabled(n); localStorage.setItem('senai_enabled', n?'1':'0')}} className="accent-[#D96B43] cursor-pointer"/>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <button onClick={() => { setShowOnboarding(true); setShowProfile(false); }} className="w-full py-2.5 bg-[#4A3E3D] text-white font-bold rounded-lg text-xs tracking-wider">Cập nhật hồ sơ mục tiêu</button>
              <button onClick={handleLogout} className="w-full py-2 border border-red-600 text-red-600 font-bold rounded-lg text-xs">Đăng xuất khỏi SenExam</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PHÒNG THI ẨN */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-[#4A3E3D] rounded-2xl w-full max-w-xs p-5 shadow-lg relative">
            <button onClick={() => setShowCodeModal(false)} className="absolute top-3 right-3 p-1 rounded-full bg-slate-100 border border-[#4A3E3D]"><X className="w-3 h-3"/></button>
            <h3 className="text-base font-bold mb-1 text-[#4A3E3D]">Giải mã phòng thi khóa</h3>
            <p className="text-[11px] text-slate-400 mb-3">Nhập mật mã do hội đồng khảo thí cung cấp để mở đề.</p>
            <input type="text" value={examCode} onChange={e=>setExamCode(e.target.value.toUpperCase())} placeholder="MÃ CODE" className={vintageInput + " text-center tracking-widest py-2 mb-3 text-sm"} />
            <button onClick={handleJoinHiddenExam} disabled={codeLoading || !examCode} className="w-full py-2 bg-[#D96B43] hover:bg-[#C85A32] text-white font-bold rounded-lg text-xs transition-colors">Xác minh dữ liệu</button>
          </div>
        </div>
      )}

      {/* FULLSCREEN ONBOARDING WIZARD */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border-2 border-[#4A3E3D] rounded-2xl w-full max-w-2xl my-auto p-6 space-y-4">
            <div className="flex justify-between items-start border-b pb-2">
              <div><h2 className="text-xl font-serif font-black text-[#4A3E3D]">Hồ sơ năng lực khởi tạo</h2><p className="text-[11px] text-slate-400">Cấu hình định hướng học tập để hệ thống tối ưu danh mục bộ đề.</p></div>
              {formData.fullName && <button onClick={() => setShowOnboarding(false)} className="p-1.5 border border-[#4A3E3D] rounded-md bg-slate-100"><X className="w-4 h-4"/></button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <p className="font-bold text-[#D96B43] border-b pb-1">Thông tin cá nhân</p>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Họ và Tên học sinh (*)</label>
                  <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={vintageInput + " py-1.5 text-xs"} placeholder="Nhập tên..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Tỉnh / Thành phố</label>
                  <select value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} className="w-full bg-[#FAF6EE] border-2 border-[#4A3E3D] px-2 py-2 rounded-xl text-xs outline-none">
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-[#D96B43] border-b pb-1">Mục tiêu kì thi</p>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Chọn mục tiêu bứt phá (*)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMS.map(exam => (
                      <button key={exam} type="button" onClick={() => toggleExam(exam)} className={`px-3 py-1 rounded-md font-bold border ${formData.targetExams.includes(exam) ? 'bg-[#D96B43] text-white border-[#4A3E3D]' : 'bg-white text-slate-700'}`}>{exam}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button onClick={handleSaveProfile} disabled={!formData.fullName || !formData.targetExams.length} className="px-5 py-2 bg-[#4A3E3D] text-white font-bold rounded-lg text-xs tracking-wider transition-opacity disabled:opacity-50">Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT HOẠT ĐỘNG NGOẠI TUYẾN */}
      <ChatOffline userName={formData.fullName ? formData.fullName.split(' ').pop() || '' : ''} avoid={showProfile || showOnboarding || showCodeModal} hidden={!isAiEnabled} />

    </div>
  )
}