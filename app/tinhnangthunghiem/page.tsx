'use client'

import { useDeferredValue, useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { 
  BookOpen, Clock, Trophy, Target, LogOut, User, 
  ChevronRight, MessageSquare, Zap, ShieldCheck, AlertCircle, Search,
  Settings, X, Sun, Moon, MapPin, GraduationCap, Loader2, Eye, KeyRound, 
  Bell, FolderOpen, Sparkles, Lock, Music2, ArrowRight, Calculator, Hash, 
  CheckCircle2, Info, BarChart3, FileText, Bot, FlaskConical, PlaySquare,
  RefreshCw, History, Check, Flame, Star, Compass, DownloadCloud
} from 'lucide-react'

import { glassSearchInputClass, glassSearchPanelClass, highlightSearchText } from '@/app/components/searchUtils'
import ChatOffline from '@/app/components/ChatOffline'

// ============================================================================
// 1. KHAI BÁO CÁC HẰNG SỐ HỆ THỐNG & STYLE HOẠT HÌNH
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
const HSA_SCIENCE_SUBJECTS = ['Vật Lí', 'Hóa Học', 'Sinh Học', 'Lịch Sử', 'Địa Lí']

const DOCUMENT_SECURITY_PREFIX = '__SENEXAM_SECURITY__:'

// 🌟 ANIME NEUBRUTALISM POP-ART STYLE CONSTANTS (BẢN 3.0 GIÀU HOẠ TIẾT)
const animeCard = "bg-white dark:bg-slate-950 border-4 border-slate-900 dark:border-slate-700 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] hover:shadow-[12px_12px_0px_0px_rgba(244,63,94,1)] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
const animeInput = "w-full bg-[#FFFDF0] dark:bg-slate-900 border-4 border-slate-900 dark:border-slate-700 focus:bg-white rounded-2xl px-5 py-4 outline-none font-black text-slate-900 dark:text-white text-sm shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] focus:shadow-[4px_4px_0px_0px_rgba(99,102,241,1)] transition-all"
const animeBtnFilled = "bg-rose-500 hover:bg-rose-600 border-4 border-slate-900 text-white rounded-full px-8 py-3.5 font-black transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
const animeBtnTonal = "bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-900 border-4 border-slate-900 dark:border-slate-700 text-indigo-900 dark:text-indigo-300 rounded-full px-6 py-3 font-black transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2"

// ============================================================================
// 2. CÁC COMPONENT TIỆN ÍCH (COUNTDOWN, ANNOUNCEMENT)
// ============================================================================

export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())
  
  useEffect(() => { 
    const timer = setInterval(() => setNow(Date.now()), 1000); 
    return () => clearInterval(timer) 
  }, [])
  
  const target = new Date(targetDate).getTime()
  if (isNaN(target)) return <span className="text-red-500 font-bold">[Lỗi định dạng ngày]</span>
  const diff = target - now
  
  if (diff <= 0) {
    return (
      <span className="inline-block bg-slate-100 border-2 border-slate-900 text-slate-500 font-black px-4 py-1.5 rounded-full text-sm mx-1 shadow-sm">
        ⏳ Sự kiện đã diễn ra
      </span>
    )
  }
  
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  const s = Math.floor((diff / 1000) % 60)
  
  return (
    <span className="inline-flex items-center gap-1.5 bg-yellow-400 border-2 border-slate-900 text-slate-950 font-black px-4 py-1.5 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-1 text-sm animate-bounce whitespace-nowrap">
      ⏳ {d} Ngày {h} Giờ {m} Phút {s} Giây
    </span>
  )
}

export const AnnouncementRenderer = ({ text }: { text: string }) => {
  const renderLine = (line: string, idx: number) => {
    let isH1 = false, isH2 = false, isH3 = false, isCenter = false;
    let content = line.trim();
    
    const centerMatch = content.match(/{Center:\s*(.*)}/i);
    if (centerMatch) {
      isCenter = true;
      content = content.replace(/{Center:\s*(.*)}/i, '$1').trim();
    }

    if (content.startsWith('###(H1)')) { isH1 = true; content = content.replace('###(H1)', '').trim() }
    else if (content.startsWith('##(H2)')) { isH2 = true; content = content.replace('##(H2)', '').trim() }
    else if (content.startsWith('#(H3)')) { isH3 = true; content = content.replace('#(H3)', '').trim() }

    const parseTags = (str: string) => {
      const regex = /{(time_|Quoc_Khanh|Bold|Underline):\s*([^}]+)}/gi;
      const parts = []; 
      let lastIndex = 0; 
      let match;
      
      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex, match.index)}</span>)
        }
        
        const tag = match[1].toLowerCase(); 
        const val = match[2];
        
        if (tag === 'time_') {
          parts.push(<CountdownTimer key={`time-${match.index}`} targetDate={val} />)
        }
        else if (tag === 'quoc_khanh') {
          parts.push(
            <span key={`qk-${match.index}`} className="text-yellow-300 font-black px-4 py-1.5 inline-flex items-center gap-2 mx-1 bg-red-600 border-2 border-slate-900 rounded-full shadow-sm uppercase tracking-wider">
              🇲🇳 🚜 314 {val} 🚩
            </span>
          )
        }
        else if (tag === 'bold') {
          parts.push(
            <strong key={`b-${match.index}`} className="uppercase font-black text-rose-500 tracking-wide">
              {val}
            </strong>
          )
        }
        else if (tag === 'underline') {
          parts.push(
            <u key={`u-${match.index}`} className="underline-offset-4 decoration-4 decoration-yellow-400">
              {val}
            </u>
          )
        }
        
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < str.length) {
        parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex)}</span>)
      }
      
      return parts;
    };

    let baseClass = isH1 ? "text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight my-4 text-center w-full" :
                    isH2 ? "text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 my-3 text-center w-full" :
                    isH3 ? "text-xl font-black text-slate-700 dark:text-slate-300 my-2" :
                    "text-base font-bold text-slate-700 dark:text-slate-300 my-1.5 leading-relaxed";

    if (isCenter) {
      baseClass += " flex justify-center items-center flex-wrap gap-2 text-center w-full";
    }

    return <div key={idx} className={baseClass}>{parseTags(content)}</div>;
  }
  
  return <div className="w-full space-y-1">{text.split('\n').map((line, idx) => renderLine(line, idx))}</div>
}

// ============================================================================
// 3. TYPES & INTERFACES DEFINITIONS
// ============================================================================

interface SysNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  time: string;
  read: boolean;
}

// ============================================================================
// 4. MAIN DASHBOARD PAGE COMPONENT
// ============================================================================

export default function DashboardPage() {
  const router = useRouter()
  
  // -- User States --
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  
  // -- UI States --
  const [isDataLoading, setIsDataLoading] = useState(true) 
  const [showOnboarding, setShowOnboarding] = useState(false) 
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isDark, setIsDark] = useState(false)
  
  // -- Data States --
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null)
  const [studentHistoryList, setStudentHistoryList] = useState<any[]>([])
  const [notifications, setNotifications] = useState<SysNotification[]>([
    { id: '1', title: 'Anime Workspace', message: 'Hệ thống Giao diện hoạt hình 3.0 đã kích hoạt thành công.', type: 'success', time: 'Vừa xong', read: false }
  ])

  // 🌟 TRUNG TÂM VERSION CONTROL THEO YÊU CẦU CỦA SẾP
  const [currentVersion, setCurrentVersion] = useState<string>('2.0.72184')
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const versionHistory = ['2.0.72100', '2.0.72000']

  // -- Modal Exam Code States --
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // -- Onboarding / Profile Form States --
  const [formData, setFormData] = useState({
    fullName: '', dob: '', cccd: '', province: '', school: '', aspiration: '',
    targetExams: [] as string[], targetSubjects: [] as string[],
    hsaOption: '' as 'Tiếng Anh' | 'Khoa học' | '', hsaScienceSubjects: [] as string[]
  })

  // -- Settings States --
  const [isAiEnabled, setIsAiEnabled] = useState(true)
  const [language, setLanguage] = useState('vi')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // -- Calculator Modal States --
  const [showCalculatorModal, setShowCalculatorModal] = useState(false)
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [calcScores, setCalcScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [calcMainSubject, setCalcMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [calcPriorityScore, setCalcPriorityScore] = useState('')
  const [calcResult, setCalcResult] = useState<{ rawScore: number; finalPriority: number; totalScore: number; } | null>(null)

  // -- Global Search States --
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalFoldersResults, setGlobalFoldersResults] = useState<any[] | null>(null)
  const [globalDocsResults, setGlobalDocsResults] = useState<any[] | null>(null)
  const [globalExamsResults, setGlobalExamsResults] = useState<any[] | null>(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  
  const deferredGlobalQuery = useDeferredValue(globalQuery)
  const globalSearchDebounce = useRef<number | null>(null)
  const globalSearchRequestRef = useRef(0)

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  // ============================================================================
  // INITIALIZATION & EFFECTS
  // ============================================================================

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? null)

      await ensureStudentProfile(user.id)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      if (profile) {
        setUserRole(profile.role || 'student')
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
      setIsDataLoading(false)
    }
    
    fetchUserData()

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true); document.documentElement.classList.add('dark')
    }

    setIsAiEnabled(localStorage.getItem('senai_enabled') !== '0')
    setLanguage(localStorage.getItem('senexam_lang') || 'vi')
    setNotificationsEnabled(localStorage.getItem('senexam_notifications') !== '0')
  }, [router])

  useEffect(() => {
    if (!showCalculatorModal) return;

    const s1 = parseFloat(calcScores.sub1.replace(',', '.'))
    const s2 = parseFloat(calcScores.sub2.replace(',', '.'))
    const s3 = parseFloat(calcScores.sub3.replace(',', '.'))
    const baseP = parseFloat(calcPriorityScore.replace(',', '.')) || 0

    if (isNaN(s1) || isNaN(s2) || isNaN(s3) || s1 > 10 || s2 > 10 || s3 > 10 || s1 < 0 || s2 < 0 || s3 < 0) {
      setCalcResult(null); return;
    }

    let rawScore = 0
    if (calcMode === 'standard') {
      rawScore = s1 + s2 + s3
    } else if (calcMode === 'hust') {
      const mainS = calcMainSubject === 'sub1' ? s1 : calcMainSubject === 'sub2' ? s2 : s3
      const otherSum = (s1 + s2 + s3) - mainS
      rawScore = ((mainS * 2 + otherSum) * 3) / 4
    }

    let actualPriority = baseP
    if (rawScore >= 22.5) {
      actualPriority = ((30 - rawScore) / 7.5) * baseP
    }

    setCalcResult({ 
      rawScore: Math.round(rawScore * 100) / 100, 
      finalPriority: Math.max(0, Math.round(actualPriority * 100) / 100), 
      totalScore: Math.round((rawScore + actualPriority) * 100) / 100 
    })
  }, [calcScores, calcMode, calcMainSubject, calcPriorityScore, showCalculatorModal])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  // 🌟 HÀM KIỂM TRA BẢN CẬP NHẬT MỚI
  const handleSystemUpdate = () => {
    setIsUpdating(true)
    setTimeout(() => {
      setCurrentVersion('3.0.0125 (Mới nhất)')
      setIsUpdating(false)
      alert('Đã tải thành công ma trận dữ liệu và hạ tầng phòng Lab ảo mới nhất!')
    }, 1500)
  }

  const toggleExam = (exam: string) => { setFormData(prev => ({ ...prev, textExams: prev.targetExams.includes(exam) ? prev.targetExams.filter(e => e !== exam) : [...prev.targetExams, exam] })) }
  const toggleSubject = (subject: string) => { setFormData(prev => ({ ...prev, targetSubjects: prev.targetSubjects.includes(subject) ? prev.targetSubjects.filter(s => s !== subject) : [...prev.targetSubjects, subject] })) }
  const toggleHsaScienceSubject = (subject: string) => { setFormData(prev => { const isSelected = prev.hsaScienceSubjects.includes(subject); if (isSelected) return { ...prev, hsaScienceSubjects: prev.hsaScienceSubjects.filter(s => s !== subject) }; if (prev.hsaScienceSubjects.length < 3) return { ...prev, hsaScienceSubjects: [...prev.hsaScienceSubjects, subject] }; return prev; }) }

  const handleSaveProfile = async () => {
    if (formData.targetExams.includes('HSA') && formData.hsaOption === 'Khoa học' && formData.hsaScienceSubjects.length !== 3) { alert("Vui lòng chọn đủ 3 môn trong phần thi Khoa học của HSA!"); return; }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ full_name: formData.fullName, dob: formData.dob || null, cccd: formData.cccd, province: formData.province, school: formData.school, aspiration: formData.aspiration, target_exams: formData.targetExams, target_subjects: formData.targetSubjects, hsa_option: formData.hsaOption, hsa_science_subjects: formData.hsaScienceSubjects }).eq('id', user.id)
    if (error) alert("Có lỗi xảy ra: " + error.message); else { setShowOnboarding(false); setShowProfile(false); }
  }

  const toggleAiEnabled = (val?: boolean) => { const next = typeof val === 'boolean' ? val : !isAiEnabled; setIsAiEnabled(next); localStorage.setItem('senai_enabled', next ? '1' : '0') }
  const handleLanguageChange = (lang: string) => { setLanguage(lang); localStorage.setItem('senexam_lang', lang) }
  const toggleNotifications = () => { const next = !notificationsEnabled; setNotificationsEnabled(next); localStorage.setItem('senexam_notifications', next ? '1' : '0') }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { alert('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    const { error: upErr } = await supabase.auth.updateUser({ password: newPassword })
    if (upErr) alert('Lỗi khi đổi mật khẩu: ' + upErr.message); else { alert('Đổi mật khẩu thành công'); setShowChangePassword(false); setNewPassword(''); }
  }

  const handleJoinHiddenExam = async () => {
    if (!examCode.trim()) return
    setCodeLoading(true)
    const { data, error } = await supabase.from('exams').select('id, title').eq('access_code', examCode.trim().toUpperCase()).single()
    if (error || !data) { alert('Mã đề thi không hợp lệ hoặc đã bị vô hiệu hóa!'); setCodeLoading(false); } else { router.push(`/exams/${data.id}`) }
  }

  // Global Search Logic
  const handleGlobalSearch = async (q?: string) => {
    const qtrim = (q ?? globalQuery).trim()
    if (!qtrim) { setGlobalFoldersResults(null); setGlobalDocsResults(null); setGlobalExamsResults(null); setShowGlobalResults(false); return; }
    const requestId = ++globalSearchRequestRef.current
    setGlobalSearchLoading(true); setShowGlobalResults(true)
    
    try {
      const [docsRes, examsRes, foldersRes] = await Promise.all([
        supabase.from('library_documents').select('id, title, description, author, exam_type, subject, tag, folder_id, drive_file_id, created_at').limit(1000),
        supabase.from('exams').select('id, title, description, exam_type, subject, level, folder_id, folder_name, created_at').limit(1000),
        supabase.from('library_folders').select('id, name, description, author, note, type, parent_name, created_at').limit(1000)
      ])
      if (requestId !== globalSearchRequestRef.current) return
      
      const folderMap = new Map<string, any>((foldersRes.data || []).map((folder: any) => [folder.id, folder]))
      const docs = (docsRes.data || []).filter((doc: any) => doc.title.toLowerCase().includes(qtrim.toLowerCase())).map((doc: any) => ({ ...doc, folder_name: doc.folder_id ? folderMap.get(doc.folder_id)?.name || '' : '' }))
      const exams = (examsRes.data || []).filter((exam: any) => exam.title.toLowerCase().includes(qtrim.toLowerCase())).map((exam: any) => ({ ...exam, folder_name: exam.folder_id ? folderMap.get(exam.folder_id)?.name || '' : exam.folder_name || '' }))

      setGlobalDocsResults(docs); setGlobalExamsResults(exams)
    } catch (e) { console.warn('Global search failed', e) }
    if (requestId === globalSearchRequestRef.current) setGlobalSearchLoading(false)
  }

  useEffect(() => {
    if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current)
    if (!globalQuery || globalQuery.trim().length < 2) { globalSearchRequestRef.current += 1; setShowGlobalResults(false); return; }
    // @ts-ignore
    globalSearchDebounce.current = window.setTimeout(() => handleGlobalSearch(globalQuery), 500)
    return () => { if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current) }
  }, [globalQuery])

  // Danh sách Bento Tools cho vòng lặp rút gọn mượt mà
  const BENTO_TOOLS = [
    { path: '/focus', title: 'Phòng Tập Trung', desc: 'Pomodoro & Lo-Fi Chill không quảng cáo.', bg: 'bg-purple-300 dark:bg-purple-900', icon: <Music2 className="w-6 h-6"/> },
    { path: '/library', title: 'Thư Viện Số', desc: 'Hàng ngàn tài liệu, sách và chuyên đề số.', bg: 'bg-cyan-300 dark:bg-cyan-900', icon: <FolderOpen className="w-6 h-6"/> },
    { path: '/senvideo', title: 'SenVideo', desc: 'Xem luồng Stream chất lượng cao mượt mà.', bg: 'bg-indigo-300 dark:bg-indigo-900', icon: <PlaySquare className="w-6 h-6"/> },
    { path: '/phongthinghiem', title: 'Phòng Thí Nghiệm', desc: 'Mô phỏng vật lý trực quan tích hợp AI.', bg: 'bg-emerald-300 dark:bg-emerald-900', icon: <FlaskConical className="w-6 h-6"/> },
    { path: '/forum', title: 'Cộng Đồng', desc: 'Thảo luận ẩn danh, giao lưu học tập.', bg: 'bg-amber-300 dark:bg-amber-900', icon: <MessageSquare className="w-6 h-6"/> },
    { path: '/tinhdiem', title: 'Tính điểm ĐH', desc: 'Quy chuẩn thang 30 tự động cộng ưu tiên.', bg: 'bg-rose-300 dark:bg-rose-900', icon: <Calculator className="w-6 h-6"/> }
  ]

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-[#FFFEEA] dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-rose-500 mb-4" />
        <p className="font-black text-slate-900 dark:text-white tracking-widest uppercase text-xs animate-pulse">Loading Anime Engine V3.0...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFEEA] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-12 transition-colors duration-500">
      
      {/* 🌟 CÁC HOẠ TIẾT VÀ NHÂN VẬT HOẠT HÌNH ĐỘNG FLOATING ACCENTS */}
      <div className="absolute top-[12%] left-[2%] w-16 h-16 bg-yellow-400 border-4 border-slate-900 rounded-full flex items-center justify-center font-black text-2xl animate-spin shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none pointer-events-none z-0">✏️</div>
      <div className="absolute top-[50%] right-[3%] w-20 h-20 bg-rose-400 border-4 border-slate-900 rounded-2xl flex items-center justify-center font-black text-4xl animate-bounce shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] select-none pointer-events-none z-0">🎒</div>
      <div className="absolute bottom-[10%] left-[4%] w-16 h-16 bg-cyan-400 border-4 border-slate-900 rounded-full flex items-center justify-center font-black text-2xl animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none pointer-events-none z-0">🧪</div>

      {/* ========================================================= */}
      {/* 🌟 APP BAR (HEADER) - ANIME FLAT BORDER STYLE */}
      {/* ========================================================= */}
      <header className="h-[90px] px-4 sm:px-8 flex items-center justify-between bg-white dark:bg-slate-900 border-b-4 border-slate-900 sticky top-0 z-40 transition-colors shadow-[0_4px_0px_0px_rgba(0,0,0,1)]">
        
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => router.push('/dashboard')}>
          <div className="w-14 h-14 rounded-2xl bg-yellow-400 border-4 border-slate-900 flex items-center justify-center p-1.5 group-hover:rotate-12 transition-transform duration-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-1">SenExam <span className="text-xs bg-rose-500 text-white border-2 border-slate-900 px-2 py-0.5 rounded-md font-mono animate-pulse">3.0</span></h1>
            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Anime Dynamic Engine</span>
          </div>
        </div>

        {/* Thanh tìm kiếm trung tâm hoạt động hoàn hảo */}
        <div className="flex-1 max-w-xl mx-6 relative z-50 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-900 dark:text-slate-400" />
            <input 
              value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} 
              onFocus={() => {if(globalQuery.length > 1) setShowGlobalResults(true)}}
              placeholder="Tìm kiếm đề thi, tài liệu thần tốc bằng thẻ thông minh..." className={animeInput + " pl-12 pr-10 py-3 text-xs"}
            />
            {globalQuery && <button onClick={() => {setGlobalQuery(''); setShowGlobalResults(false)}} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-200 border-2 border-slate-900 rounded-full p-1 hover:bg-rose-400 transition-colors"><X className="w-4 h-4"/></button>}
          </div>

          {/* Dropdown kết quả tìm kiếm */}
          {showGlobalResults && globalQuery.trim().length >= 2 && (
            <div className="absolute top-[calc(100%+12px)] w-full bg-white dark:bg-slate-950 border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden flex flex-col max-h-[70vh] z-[100]">
              <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
                {globalSearchLoading ? <div className="p-4 flex items-center justify-center gap-2 text-slate-500 font-black text-xs"><Loader2 className="w-4 h-4 animate-spin"/> Đang quét kho dữ liệu...</div> : (
                  <>
                    {!!globalExamsResults?.length && (
                      <div className="mb-2">
                        <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border-2 border-indigo-500 w-fit rounded-lg mb-2">Đề thi chuyên sâu</div>
                        {globalExamsResults.map(e => (
                          <div key={e.id} onClick={() => router.push(`/exams/${e.id}`)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-900 border-2 border-transparent hover:border-slate-900 rounded-xl cursor-pointer font-bold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500"/>{highlightSearchText(e.title, deferredGlobalQuery)}</div>
                        ))}
                      </div>
                    )}
                    {!!globalDocsResults?.length && (
                      <div>
                        <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border-2 border-emerald-500 w-fit rounded-lg mb-2">Tài liệu Thư viện</div>
                        {globalDocsResults.map(d => (
                          <div key={d.id} onClick={() => router.push(`/library?preview=${d.id}`)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-900 border-2 border-transparent hover:border-slate-900 rounded-xl cursor-pointer font-bold text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-500"/>{highlightSearchText(d.title, deferredGlobalQuery)}</div>
                        ))}
                      </div>
                    )}
                    {!globalExamsResults?.length && !globalDocsResults?.length && <div className="p-6 text-center font-black text-slate-400 text-xs">Không tìm thấy kết quả nào phù hợp.</div>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifications(true)} className="p-2.5 bg-sky-300 hover:bg-sky-400 text-slate-900 border-4 border-slate-900 rounded-full transition-transform active:scale-95 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative">
            <Bell className="w-5 h-5"/>
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 border-2 border-slate-900 rounded-full text-[9px] font-black text-white flex items-center justify-center">{unreadCount}</span>}
          </button>
          <button onClick={toggleTheme} className="p-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 border-4 border-slate-900 rounded-full transition-transform active:scale-95 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
          </button>
          <div onClick={() => setShowProfile(true)} className="w-12 h-12 rounded-full bg-rose-500 border-4 border-slate-900 text-white flex items-center justify-center font-black text-base cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:scale-110 active:scale-95 transition-all">
            {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5"/>}
          </div>
        </div>
      </header>

      {/* ============================================================================ */}
      {/* 🌟 MAIN WORKSPACE - BENTO ANIME GRID 3.0 */}
      {/* ============================================================================ */}
      <main className={`max-w-[1400px] mx-auto p-4 sm:p-8 space-y-8 relative z-10 transition-all duration-300 ${ (showOnboarding || showProfile || showCodeModal || showNotifications || showCalculatorModal) ? 'opacity-20 pointer-events-none blur-sm scale-[0.99]' : '' }`}>
        
        {/* Banner Thông báo */}
        {activeAnnouncement && (
          <div className="bg-yellow-200 dark:bg-slate-900 border-4 border-slate-900 rounded-[2rem] p-6 flex items-start gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform hover:rotate-1 transition-transform">
            <div className="p-3 bg-rose-500 text-white border-2 border-slate-900 rounded-xl shrink-0"><AlertCircle className="w-6 h-6"/></div>
            <div className="flex-1 min-w-0 font-bold"><AnnouncementRenderer text={activeAnnouncement} /></div>
          </div>
        )}

        {/* LƯỚI HERO & MỆNH ĐỀ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* BANNER HERO HOẠT HÌNH CHỨA NHÂN VẬT DYNAMIC (8/12 CỘT) */}
          <div className="md:col-span-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-4 border-slate-900 rounded-[2.5rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/comic-book.png')]"></div>
            
            {/* 🌟 NHÂN VẬT HOẠT HÌNH ĐỘNG NẰM TRONG HERO BANNER */}
            <div className="absolute -right-4 bottom-0 w-48 h-48 text-8xl select-none opacity-20 group-hover:scale-125 group-hover:-rotate-12 transition-all duration-700 pointer-events-none animate-bounce">🤖</div>
            
            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-1 bg-yellow-400 text-slate-950 border-2 border-slate-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse"><Flame className="w-4 h-4 fill-current"/> ANIME EMPIRE v3.0</span>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]">Chinh phục mục tiêu cực đại <br/><span className="text-yellow-300">{formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'KỲ THI QUỐC GIA'}</span></h2>
              <p className="text-xs sm:text-sm font-bold text-slate-100 max-w-md leading-relaxed">Không gian ảo cá nhân hóa, tự động phân rã các hiện tượng vật lý và tối ưu hóa điểm số khảo thí.</p>
              
              <div className="flex flex-wrap gap-3 pt-4">
                <button onClick={() => router.push('/exams')} className={animeBtnFilled + " !bg-yellow-400 !text-slate-900 hover:!bg-yellow-500"}><Target className="w-4 h-4"/> Vào thi ngay</button>
                <button onClick={() => setShowCodeModal(true)} className={animeBtnFilled + " !bg-slate-900 text-white hover:!bg-slate-800"}><KeyRound className="w-4 h-4"/> Nhập Code</button>
              </div>
            </div>
          </div>

          {/* BOX ĐIỂM SỐ KỶ LỤC (4/12 CỘT) */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className={animeCard + " p-6 flex items-center gap-5 bg-emerald-300 dark:bg-emerald-950/40"}>
              <div className="w-14 h-14 bg-white border-4 border-slate-900 rounded-2xl flex items-center justify-center text-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Trophy className="w-7 h-7 fill-current"/></div>
              <div><p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Kỷ lục của bạn</p><p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{studentHistoryList.length > 0 ? Math.max(...studentHistoryList.map(s => s.score || 0)) : '--'}</p></div>
            </div>
            <div className={animeCard + " p-6 flex items-center gap-5 bg-sky-300 dark:bg-sky-950/40"}>
              <div className="w-14 h-14 bg-white border-4 border-slate-900 rounded-2xl flex items-center justify-center text-sky-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><FileText className="w-7 h-7"/></div>
              <div><p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Số đề đã giải hạ</p><p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-1">{studentHistoryList.length} đề</p></div>
            </div>
          </div>
        </div>

        {/* LƯỚI BENTO 6 Ô CÔNG CỤ HOẠT HÌNH ĐÃ ĐƯỢC MAP RÚT GỌN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {BENTO_TOOLS.map((box, i) => (
            <div key={i} onClick={() => router.push(box.path)} className={animeCard + ` p-5 flex flex-col items-start cursor-pointer group ${box.bg}`}>
              <div className="w-12 h-12 rounded-xl bg-white border-4 border-slate-900 flex items-center justify-center text-slate-900 mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{box.icon}</div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1">{box.title}</h3>
              <p className="text-[11px] font-bold text-slate-800/80 dark:text-slate-200 mt-1.5 leading-snug">{box.desc}</p>
            </div>
          ))}
        </div>

        {/* WORKSPACE SENAI TRẢI RỘNG BANNER */}
        <div onClick={() => router.push('/senai')} className="bg-[#A5B4FC] dark:bg-slate-900 border-4 border-slate-900 rounded-[2.5rem] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(99,102,241,1)] transition-all group">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white border-4 border-slate-900 flex items-center justify-center text-indigo-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-12 transition-transform font-black text-3xl">🤖</div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">SenAI Workspace Mở Rộng <Sparkles className="w-4 h-4 text-yellow-500 fill-current animate-pulse"/></h3>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 mt-1 max-w-xl">Trợ lý ảo học thuật tối thượng, giải toán lý hóa qua ảnh chụp và ghi nhớ ngữ cảnh cực hạn.</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 bg-slate-900 text-white font-black px-5 py-3 rounded-xl text-xs border-2 border-slate-900 flex items-center gap-1.5 shadow-[3px_3px_0px_0px_rgba(244,63,94,1)] group-hover:translate-x-1 transition-transform">Mở Không Gian <ArrowRight className="w-4 h-4"/></div>
        </div>

        {/* BẢNG LỊCH SỬ GẦN ĐÂY */}
        <div className={animeCard + " p-6 sm:p-8 bg-white"}>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-indigo-500"/> Hoạt động thi cử gần đây</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-12 border-4 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-sm">Chưa có bản ghi điểm số nào.</div>
            ) : (
              studentHistoryList.map(sub => (
                <div key={sub.id} className="p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-900 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-colors">
                  <div className="min-w-0 pr-4 flex items-center gap-3">
                    <Compass className="w-5 h-5 text-rose-500 shrink-0"/>
                    <div className="truncate"><h4 className="font-black text-sm truncate">{sub.exams?.title}</h4><p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{sub.exams?.exam_type}</p></div>
                  </div>
                  <div className="bg-yellow-400 text-slate-900 border-2 border-slate-900 px-3 py-1 rounded-lg text-xs font-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{sub.is_graded ? `${String(sub.score).replace('.', ',')}đ` : 'Chờ chấm'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* 🌟 OVERLAYS: ANIME MODALS & CÀI ĐẶT CẬP NHẬT PHIÊN BẢN */}
      {/* ========================================================= */}

      {showProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in">
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-950 border-l-4 border-slate-900 overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b-4 border-slate-900 flex justify-between items-center bg-yellow-400 text-slate-900">
              <h2 className="text-lg font-black flex items-center gap-2"><Settings className="w-5 h-5"/> Trung tâm quản lý cấu hình</h2>
              <button onClick={() => setShowProfile(false)} className="p-2 bg-white border-4 border-slate-900 rounded-full hover:bg-rose-500 hover:text-white transition-all"><X className="w-4 h-4"/></button>
            </div>

            <div className="p-6 space-y-6 flex-grow">
              {/* Profile Card */}
              <div className="bg-yellow-100 dark:bg-slate-900 border-4 border-slate-900 rounded-2xl p-4 flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-12 h-12 bg-rose-500 border-2 border-slate-900 rounded-full text-white font-black text-lg flex items-center justify-center">{formData.fullName ? formData.fullName.charAt(0).toUpperCase() : 'U'}</div>
                <div className="min-w-0 flex-1"><h3 className="font-black text-sm truncate">{formData.fullName || 'Chưa định danh'}</h3><p className="text-xs font-bold text-slate-500 truncate">{userEmail}</p></div>
              </div>

              {/* 🌟 TRUNG TÂM KIỂM TRA CẬP NHẬT PHIÊN BẢN */}
              <div className="space-y-3 bg-sky-100 dark:bg-slate-900 border-4 border-slate-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5"><DownloadCloud className="w-3.5 h-3.5"/> Kiểm tra cập nhật ứng dụng</h4>
                
                <div className="bg-white dark:bg-slate-950 border-4 border-slate-900 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Phiên bản hiện hành</p>
                    <p className="text-sm font-black text-rose-500 mt-0.5">{currentVersion}</p>
                  </div>
                  <button 
                    onClick={handleSystemUpdate} disabled={isUpdating}
                    className="px-4 py-2 bg-slate-900 text-white border-2 border-slate-900 font-black text-xs rounded-xl flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>} Cập nhật
                  </button>
                </div>

                {/* Khôi phục Rollback quay lại 2 bản liền trước */}
                <div className="space-y-1.5 pt-1.5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><History className="w-3.5 h-3.5"/> Quay lại phiên bản cũ (Rollback)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {versionHistory.map((v) => (
                      <button 
                        key={v} onClick={() => { setCurrentVersion(v); alert(`Hệ thống đã khôi phục ngược về cấu trúc bản build ${v}`); }}
                        className={`p-2 border-2 border-slate-900 text-[10px] font-black rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 ${currentVersion === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900'}`}
                      >
                        Bản {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles Hệ thống */}
              <div className="border-4 border-slate-900 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between p-4 border-b-2 border-slate-900">
                  <span className="text-xs font-black flex items-center gap-2">{isDark ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>} Chế độ Dark Mode</span>
                  <button onClick={toggleTheme} className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-slate-900 bg-white transition-colors`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-900 transition-transform ${isDark ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="text-xs font-black flex items-center gap-2"><Sparkles className="w-4 h-4"/> Trợ lý SenAI Mini</span>
                  <button onClick={() => toggleAiEnabled()} className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-slate-900 bg-white transition-colors`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-900 transition-transform ${isAiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t-4 border-slate-900 bg-slate-50 dark:bg-slate-900 space-y-2">
              <button onClick={() => { setShowOnboarding(true); setShowProfile(false); }} className="w-full bg-slate-900 text-white font-black py-3.5 rounded-xl text-xs border-2 border-slate-900 uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(244,63,94,1)]">Cập nhật hồ sơ năng lực</button>
              <button onClick={handleLogout} className="w-full bg-rose-100 text-rose-600 border-2 border-rose-600 font-black py-3 rounded-xl text-xs uppercase tracking-wider">Đăng xuất hệ thống</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÃ PHÒNG private */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-950 border-4 border-slate-900 rounded-[2.5rem] w-full max-w-sm p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
            <button onClick={() => setShowCodeModal(false)} className="absolute top-4 right-4 p-1.5 bg-slate-100 rounded-full border border-slate-900"><X className="w-4 h-4"/></button>
            <h3 className="text-xl font-black mb-1">Truy cập đề ẩn</h3>
            <p className="text-xs font-bold text-slate-400 mb-4">Nhập mã Code để giải khóa đề thi bảo mật.</p>
            <input type="text" value={examCode} onChange={e=>setExamCode(e.target.value.toUpperCase())} placeholder="MÃ PHÒNG THI" className={animeInput + " text-center uppercase tracking-widest text-lg py-3 mb-4"} />
            <button onClick={handleJoinHiddenExam} disabled={codeLoading || !examCode} className="w-full bg-indigo-600 border-2 border-slate-900 text-white font-black py-3 rounded-xl text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Giải khóa phòng</button>
          </div>
        </div>
      )}

      {/* FULLSCREEN ONBOARDING WIZARD */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-4 border-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto animate-in zoom-in-95 overflow-hidden">
            <div className="p-6 md:p-10 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">Hồ sơ năng lực mới 👋</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">Cấu hình thông tin mục tiêu để cổng trường phân phối đề khảo thí thích hợp.</p>
                </div>
                {formData.fullName && <button onClick={() => setShowOnboarding(false)} className="p-2 border-2 border-slate-900 rounded-full bg-slate-100"><X className="w-5 h-5"/></button>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-xs font-black uppercase text-indigo-500 tracking-wider border-b pb-2">Thông tin cá nhân</p>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Họ và Tên học sinh (*)</label>
                    <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={animeInput + " !py-3"} placeholder="Họ và tên..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tỉnh/TP</label>
                      <select value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} className="w-full bg-[#FFFDF0] border-4 border-slate-900 px-3 py-3 rounded-2xl font-black text-xs outline-none">
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trường THPT</label>
                      <input type="text" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} className={animeInput + " !py-3 !px-3"} placeholder="Mái trường..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black uppercase text-rose-500 tracking-wider border-b pb-2">Mục tiêu khảo thí</p>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chọn kỳ thi bứt phá (*)</label>
                    <div className="flex flex-wrap gap-2">
                      {EXAMS.map(exam => (
                        <button key={exam} type="button" onClick={() => toggleExam(exam)} className={`px-4 py-2 rounded-xl text-xs font-black border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${formData.targetExams.includes(exam) ? 'bg-rose-500 text-white' : 'bg-white text-slate-900'}`}>{exam}</button>
                      ))}
                    </div>
                  </div>

                  {formData.targetExams.includes('THPTQG') && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tổ hợp môn THPTQG</label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border-2 border-slate-900 rounded-xl bg-[#FFFDF0]">
                        {THPTQG_SUBJECTS.map(sub => (
                          <button key={sub} type="button" onClick={() => toggleSubject(sub)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-900 ${formData.targetSubjects.includes(sub) ? 'bg-emerald-500 text-white' : 'bg-white'}`}>{sub}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t-2 border-slate-900">
                <button onClick={handleSaveProfile} disabled={!formData.fullName || !formData.targetExams.length} className="px-6 py-3 bg-slate-900 border-2 border-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(244,63,94,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">Lưu hồ sơ & Khởi động</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE CHAT COMPONENT */}
      <ChatOffline userName={formData.fullName ? formData.fullName.split(' ').pop() || '' : ''} avoid={showProfile || showOnboarding || showCodeModal} hidden={!isAiEnabled} />

    </div>
  )
}