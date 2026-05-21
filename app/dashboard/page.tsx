'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  BookOpen, Clock, Trophy, Target, LogOut, User, 
  ChevronRight, MessageSquare, Zap, ShieldCheck, AlertCircle, Search,
  Settings, X, Sun, Moon, MapPin, GraduationCap, Loader2, Eye, KeyRound, Bell, FolderOpen, Sparkles, Lock
} from 'lucide-react'

// 🌟 GỌI BỘ NÃO AI OFFLINE VÀO TRANG MỘT CÁCH GỌN GÀNG
import ChatOffline from '@/app/components/ChatOffline'

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

const glassCardStyles = "liquid-panel relative"
const glassButtonStyles = "liquid-button liquid-badge transition-all duration-300 hover:scale-[1.02] hover:bg-white/80 dark:hover:bg-slate-700/70 active:scale-95"

export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())
  
  useEffect(() => { 
    const timer = setInterval(() => setNow(Date.now()), 1000); 
    return () => clearInterval(timer) 
  }, [])
  
  const target = new Date(targetDate).getTime()
  if (isNaN(target)) return <span className="text-red-500 font-bold">[Lỗi định dạng ngày]</span>
  
  const diff = target - now
  if (diff <= 0) return <span className="inline-block bg-slate-200 dark:bg-slate-800 text-slate-500 font-black px-3 py-1 rounded-xl shadow-inner mx-1 text-sm">⏳ Sự kiện đã diễn ra</span>
  
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  const s = Math.floor((diff / 1000) % 60)
  
  return (
    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black px-3.5 py-1.5 rounded-xl shadow-[0_4px_15px_rgba(239,68,68,0.4)] mx-1 text-sm animate-pulse whitespace-nowrap">
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
      const parts = []; let lastIndex = 0; let match;
      
      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex, match.index)}</span>)
        
        const tag = match[1].toLowerCase(); 
        const val = match[2];
        
        if (tag === 'time_') {
          parts.push(<CountdownTimer key={`time-${match.index}`} targetDate={val} />)
        }
        else if (tag === 'quoc_khanh') {
          parts.push(<span key={`qk-${match.index}`} className="text-yellow-300 font-black px-3 py-1 inline-flex items-center gap-2 mx-1 bg-red-600 rounded-lg shadow-md uppercase tracking-wider">🇻🇳 🚜 314 {val} 🚩 🇻🇳</span>)
        }
        else if (tag === 'bold') {
          parts.push(<strong key={`b-${match.index}`} className="uppercase font-black text-blue-600 dark:text-blue-400 tracking-wide">{val}</strong>)
        }
        else if (tag === 'underline') {
          parts.push(<u key={`u-${match.index}`} className="underline-offset-4 decoration-2 decoration-blue-500">{val}</u>)
        }
        
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < str.length) parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex)}</span>)
      return parts;
    };

    let baseClass = isH1 ? "text-3xl md:text-4xl font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight my-4 drop-shadow-md text-center w-full" :
                      isH2 ? "text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 my-3 text-center w-full" :
                      isH3 ? "text-xl font-bold text-slate-700 dark:text-slate-300 my-2" :
                      "text-base font-medium text-slate-700 dark:text-slate-300 my-1 leading-relaxed";

    if (isCenter) {
      baseClass += " flex justify-center items-center flex-wrap gap-2 text-center w-full";
    }

    return <div key={idx} className={baseClass}>{parseTags(content)}</div>;
  }
  
  return <div className="w-full space-y-1">{text.split('\n').map((line, idx) => renderLine(line, idx))}</div>
}

export default function DashboardPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  
  const [isDataLoading, setIsDataLoading] = useState(true) 
  const [showOnboarding, setShowOnboarding] = useState(false) 
  const [showProfile, setShowProfile] = useState(false)
  
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null)
  
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [studentHistoryList, setStudentHistoryList] = useState<any[]>([])

  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '', dob: '', cccd: '', province: '', school: '', aspiration: '',
    targetExams: [] as string[], targetSubjects: [] as string[],
    hsaOption: '' as 'Tiếng Anh' | 'Khoa học' | '', hsaScienceSubjects: [] as string[]
  })

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? null)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      if (profile) {
        setUserRole(profile.role || 'student')
        setFormData({
          fullName: profile.full_name || '', dob: profile.dob || '', cccd: profile.cccd || '',
          province: profile.province || '', school: profile.school || '', aspiration: profile.aspiration || '',
          targetExams: profile.target_exams || [], targetSubjects: profile.target_subjects || [],
          hsaOption: profile.hsa_option || '', hsaScienceSubjects: profile.hsa_science_subjects || []
        })

        if (!profile.full_name || !profile.target_exams || profile.target_exams.length === 0) { setShowOnboarding(true) }

        const { data: subHistory } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_type, allow_review)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        setStudentHistoryList(subHistory || [])
      } else { setShowOnboarding(true) }

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

      if (notifData) {
        setActiveAnnouncement(notifData.content)
      }

      setIsDataLoading(false)
    }
    
    fetchUserData()

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDarkMode(true); document.documentElement.classList.add('dark')
    }
  }, [router])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const toggleDarkMode = () => {
    if (isDarkMode) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDarkMode(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDarkMode(true) }
  }

  const toggleExam = (exam: string) => { setFormData(prev => ({ ...prev, targetExams: prev.targetExams.includes(exam) ? prev.targetExams.filter(e => e !== exam) : [...prev.targetExams, exam] })) }
  const toggleSubject = (subject: string) => { setFormData(prev => ({ ...prev, targetSubjects: prev.targetSubjects.includes(subject) ? prev.targetSubjects.filter(s => s !== subject) : [...prev.targetSubjects, subject] })) }
  const toggleHsaScienceSubject = (subject: string) => {
    setFormData(prev => {
      const isSelected = prev.hsaScienceSubjects.includes(subject)
      if (isSelected) return { ...prev, hsaScienceSubjects: prev.hsaScienceSubjects.filter(s => s !== subject) }
      if (prev.hsaScienceSubjects.length < 3) return { ...prev, hsaScienceSubjects: [...prev.hsaScienceSubjects, subject] }
      return prev
    })
  }

  const [isAiEnabled, setIsAiEnabled] = useState(true)
  const [language, setLanguage] = useState('vi')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    const ai = localStorage.getItem('senai_enabled')
    setIsAiEnabled(ai === null ? true : ai === '1')
    const lang = localStorage.getItem('senexam_lang') || 'vi'
    setLanguage(lang)
    const notif = localStorage.getItem('senexam_notifications')
    setNotificationsEnabled(notif === null ? true : notif === '1')
  }, [])

  const toggleAiEnabled = (val?: boolean) => {
    const next = typeof val === 'boolean' ? val : !isAiEnabled
    setIsAiEnabled(next)
    localStorage.setItem('senai_enabled', next ? '1' : '0')
  }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    localStorage.setItem('senexam_lang', lang)
  }

  const toggleNotifications = () => {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    localStorage.setItem('senexam_notifications', next ? '1' : '0')
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { alert('Mật khẩu phải có ít nhất 6 ký tự'); return }
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!user) { alert('Bạn cần đăng nhập lại để đổi mật khẩu'); return }
    const { error: upErr } = await supabase.auth.updateUser({ password: newPassword })
    if (upErr) alert('Lỗi khi đổi mật khẩu: ' + upErr.message)
    else { alert('Đổi mật khẩu thành công'); setShowChangePassword(false); setNewPassword('') }
  }

  // Global search on dashboard
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalFoldersResults, setGlobalFoldersResults] = useState<any[] | null>(null)
  const [globalDocsResults, setGlobalDocsResults] = useState<any[] | null>(null)
  const [globalExamsResults, setGlobalExamsResults] = useState<any[] | null>(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  const [hoverPreviewDoc, setHoverPreviewDoc] = useState<any | null>(null)
  const globalSearchDebounce = useRef<number | null>(null)
  const globalSearchRequestRef = useRef(0)
  const hoverPreviewDebounce = useRef<number | null>(null)

  const scoreSearchText = (value: string, query: string) => {
    const source = value.toLowerCase()
    const needle = query.toLowerCase().trim()
    if (!needle) return 0
    if (source === needle) return 100
    if (source.startsWith(needle)) return 85
    if (source.includes(needle)) return 60
    return needle.split(/\s+/).filter(Boolean).reduce((score, word) => score + (source.includes(word) ? 10 : 0), 0)
  }

  const rankResults = <T extends Record<string, any>>(items: T[], query: string, textSelector: (item: T) => string) => {
    return [...items].sort((left, right) => scoreSearchText(textSelector(right), query) - scoreSearchText(textSelector(left), query))
  }

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const highlightText = (text: string, query: string) => {
    const needle = query.trim()
    if (!needle) return text
    const regex = new RegExp(`(${escapeRegex(needle)})`, 'ig')
    return text.split(regex).map((part, index) => (
      index % 2 === 1
        ? <mark key={index} className="rounded bg-yellow-200/80 dark:bg-yellow-400/30 px-0.5 text-inherit">{part}</mark>
        : <span key={index}>{part}</span>
    ))
  }

  const getDocSearchText = (doc: any, folderName?: string) => [
    doc.title,
    doc.description,
    doc.author,
    doc.exam_type,
    doc.subject,
    doc.tag,
    folderName,
    doc.drive_file_id
  ].filter(Boolean).join(' ')

  const getExamSearchText = (exam: any, folderName?: string) => [
    exam.title,
    exam.description,
    exam.exam_type,
    exam.subject,
    exam.level,
    exam.folder_name,
    folderName
  ].filter(Boolean).join(' ')

  const getFolderSearchText = (folder: any) => [
    folder.name,
    folder.description,
    folder.author,
    folder.note,
    folder.type,
    folder.parent_name
  ].filter(Boolean).join(' ')

  const handleGlobalSearch = async (q?: string) => {
    const qtrim = (q ?? globalQuery).trim()
    if (!qtrim) { setGlobalFoldersResults(null); setGlobalDocsResults(null); setGlobalExamsResults(null); setShowGlobalResults(false); return }
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
      const folderMatches = (foldersRes.data || []).filter((folder: any) => getFolderSearchText(folder).toLowerCase().includes(qtrim.toLowerCase()))
      const folderMatchIds = new Set(folderMatches.map((folder: any) => folder.id))

      const docs = (docsRes.data || [])
        .filter((doc: any) => {
          const folderName = doc.folder_id ? folderMap.get(doc.folder_id)?.name || '' : ''
          return getDocSearchText(doc, folderName).toLowerCase().includes(qtrim.toLowerCase()) || (doc.folder_id && folderMatchIds.has(doc.folder_id))
        })
        .map((doc: any) => ({ ...doc, folder_name: doc.folder_id ? folderMap.get(doc.folder_id)?.name || '' : '' }))

      const exams = (examsRes.data || [])
        .filter((exam: any) => {
          const folderName = exam.folder_id ? folderMap.get(exam.folder_id)?.name || exam.folder_name || '' : exam.folder_name || ''
          return getExamSearchText(exam, folderName).toLowerCase().includes(qtrim.toLowerCase()) || (exam.folder_id && folderMatchIds.has(exam.folder_id))
        })
        .map((exam: any) => ({ ...exam, folder_name: exam.folder_id ? folderMap.get(exam.folder_id)?.name || '' : exam.folder_name || '' }))

      setGlobalFoldersResults(rankResults(folderMatches, qtrim, item => getFolderSearchText(item)))
      setGlobalDocsResults(rankResults(docs, qtrim, item => getDocSearchText(item, item.folder_name || '')))
      setGlobalExamsResults(rankResults(exams, qtrim, item => getExamSearchText(item, item.folder_name || '')))
    } catch (e) { console.warn('Global search failed', e) }
    if (requestId === globalSearchRequestRef.current) setGlobalSearchLoading(false)
  }

  // Debounce auto-search when typing
  useEffect(() => {
    if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current)
    if (hoverPreviewDebounce.current) window.clearTimeout(hoverPreviewDebounce.current)
    if (!globalQuery || globalQuery.trim().length < 2) {
      globalSearchRequestRef.current += 1
      setShowGlobalResults(false)
      setGlobalFoldersResults(null)
      setGlobalDocsResults(null)
      setGlobalExamsResults(null)
      setHoverPreviewDoc(null)
      return
    }
    // @ts-ignore
    globalSearchDebounce.current = window.setTimeout(() => handleGlobalSearch(globalQuery), 500)
    return () => { if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current) }
  }, [globalQuery])

  useEffect(() => {
    return () => {
      if (globalSearchDebounce.current) window.clearTimeout(globalSearchDebounce.current)
      if (hoverPreviewDebounce.current) window.clearTimeout(hoverPreviewDebounce.current)
    }
  }, [])

  const scheduleHoverPreview = (doc: any) => {
    if (hoverPreviewDebounce.current) window.clearTimeout(hoverPreviewDebounce.current)
    hoverPreviewDebounce.current = window.setTimeout(() => setHoverPreviewDoc(doc), 120)
  }

  const clearHoverPreview = () => {
    if (hoverPreviewDebounce.current) window.clearTimeout(hoverPreviewDebounce.current)
    hoverPreviewDebounce.current = null
    setHoverPreviewDoc(null)
  }

  const handleSaveProfile = async () => {
    if (formData.targetExams.includes('HSA') && formData.hsaOption === 'Khoa học' && formData.hsaScienceSubjects.length !== 3) { alert("Vui lòng chọn đủ 3 môn trong phần thi Khoa học của HSA!"); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({
        full_name: formData.fullName, dob: formData.dob || null, cccd: formData.cccd, province: formData.province, school: formData.school, aspiration: formData.aspiration, target_exams: formData.targetExams, target_subjects: formData.targetSubjects, hsa_option: formData.hsaOption, hsa_science_subjects: formData.hsaScienceSubjects
      }).eq('id', user.id)

    if (error) alert("Có lỗi xảy ra: " + error.message)
    else { setShowOnboarding(false); setShowProfile(false) }
  }

  const handleJoinHiddenExam = async () => {
    if (!examCode.trim()) return
    setCodeLoading(true)
    const { data, error } = await supabase.from('exams').select('id, title').eq('access_code', examCode.trim().toUpperCase()).single()
    if (error || !data) { alert('Mã đề thi không hợp lệ hoặc đã bị vô hiệu hóa!'); setCodeLoading(false) } 
    else { router.push(`/exams/${data.id}`) }
  }

  if (isDataLoading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-500">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-bold">Bạn chờ chút nhé, Sen đang dẫn bạn tới ngay đây …</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent p-4 md:p-8 relative text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden font-sans">
      
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-800/35 dark:to-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 bounce-float pointer-events-none"></div>
      <div className="fixed top-[25%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-400/24 to-pink-400/20 dark:from-purple-800/28 dark:to-pink-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 bounce-float-delayed pointer-events-none"></div>
      <div className="fixed bottom-[-15%] left-[20%] w-[700px] h-[700px] bg-gradient-to-t from-emerald-300/20 to-teal-400/14 dark:from-emerald-900/25 dark:to-teal-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 bounce-float pointer-events-none" style={{ animationDelay: '4s' }}></div>

      {showCodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className={`${glassCardStyles} rounded-3xl w-full max-w-sm p-8 border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 relative shadow-2xl`}>
              <button onClick={() => setShowCodeModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4"><KeyRound className="w-6 h-6 text-blue-600 dark:text-blue-400"/></div>
              <h3 className="text-2xl font-black mb-2">Đề thi nội bộ</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">Nhập mã truy cập do giáo viên cung cấp để mở khóa phòng thi.</p>
              
              <input 
                type="text" 
                value={examCode} 
                onChange={(e) => setExamCode(e.target.value.toUpperCase())} 
                placeholder="VD: SEN2026" 
                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-black tracking-widest text-center text-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-6 uppercase shadow-inner" 
              />
              
              <button onClick={handleJoinHiddenExam} disabled={codeLoading || !examCode} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 shadow-md transition-all active:scale-95">
                {codeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />} Xác nhận vào thi
              </button>
           </div>
        </div>
      )}

      <div className="relative z-10 p-4 md:p-6 max-w-[1400px] mx-auto">
        
        {showOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
             <div className={`${glassCardStyles} rounded-[2rem] w-full max-w-5xl max-h-[95vh] overflow-y-auto custom-scrollbar border-t-white/70 border-l-white/70 dark:border-t-white/20 dark:border-l-white/20`}>
              <div className="p-8 md:p-10">
                <div className="mb-8 flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white drop-shadow-sm">Hồ sơ năng lực 👋</h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-2 font-medium">Thiết lập dữ liệu để AI phân phối cấu trúc đề cá nhân hóa.</p>
                  </div>
                  {formData.fullName && (
                    <button onClick={() => setShowOnboarding(false)} className="p-2 bg-white/40 hover:bg-white/60 dark:bg-slate-800/50 dark:hover:bg-slate-700/70 rounded-full transition-colors backdrop-blur-sm border border-white/50 dark:border-white/10"><X className="w-6 h-6 text-slate-700 dark:text-slate-300" /></button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h3 className="font-bold text-lg text-blue-700 dark:text-blue-400 flex items-center gap-2 border-b border-slate-300/50 dark:border-slate-600/50 pb-2"><User className="w-5 h-5" /> Thông tin cá nhân</h3>
                    <div><label className="block text-sm font-bold mb-2">Họ và Tên (*)</label><input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md shadow-inner transition-colors" placeholder="Nguyễn Văn A" /></div>
                    <div><label className="block text-sm font-bold mb-2">Ngày sinh</label><input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner [color-scheme:light] dark:[color-scheme:dark]" /></div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Căn cước công dân (CCCD)</label>
                      <input type="text" value={formData.cccd} onChange={e => setFormData({...formData, cccd: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner" placeholder="Dùng định danh điểm thi..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-bold mb-2">Tỉnh</label><select value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner">{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                      <div><label className="block text-sm font-bold mb-2">Trường THPT</label><input type="text" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner" placeholder="VD: THPT Chuyên..." /></div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-bold text-lg text-orange-600 dark:text-orange-400 flex items-center gap-2 border-b border-slate-300/50 dark:border-slate-600/50 pb-2"><Target className="w-5 h-5" /> Định hướng & Kỳ thi</h3>
                    <div><label className="block text-sm font-bold mb-2">Nguyện vọng đại học</label><input type="text" value={formData.aspiration} onChange={e => setFormData({...formData, aspiration: e.target.value})} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner" placeholder="VD: Đại học Bách Khoa..." /></div>
                    <div>
                      <label className="block text-sm font-bold mb-3">Kỳ thi mục tiêu (*)</label>
                      <div className="flex flex-wrap gap-2">{EXAMS.map(exam => <button type="button" key={exam} onClick={() => toggleExam(exam)} className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-300 ${formData.targetExams.includes(exam) ? 'bg-blue-500 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/40 dark:bg-slate-800/40 border-slate-300/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 backdrop-blur-sm'}`}>{exam}</button>)}</div>
                    </div>

                    {formData.targetExams.includes('HSA') && (
                      <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-lg border border-white/50 dark:border-slate-700/50 p-5 rounded-2xl shadow-inner">
                        <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-3">Cấu trúc HSA</h4>
                        <div className="flex gap-3 mb-4">
                          <button type="button" onClick={() => setFormData({...formData, hsaOption: 'Tiếng Anh', hsaScienceSubjects: []})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${formData.hsaOption === 'Tiếng Anh' ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white/40 dark:bg-slate-900/40 border-slate-300/50 dark:border-slate-700/50'}`}>Tiếng Anh</button>
                          <button type="button" onClick={() => setFormData({...formData, hsaOption: 'Khoa học', hsaScienceSubjects: []})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${formData.hsaOption === 'Khoa học' ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white/40 dark:bg-slate-900/40 border-slate-300/50 dark:border-slate-700/50'}`}>Khoa học</button>
                        </div>
                        {formData.hsaOption === 'Khoa học' && (
                          <div className="flex flex-wrap gap-2">{HSA_SCIENCE_SUBJECTS.map(sub => <button type="button" key={sub} onClick={() => toggleHsaScienceSubject(sub)} disabled={!formData.hsaScienceSubjects.includes(sub) && formData.hsaScienceSubjects.length >= 3} className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${formData.hsaScienceSubjects.includes(sub) ? 'bg-purple-500 border-purple-500 text-white shadow-md' : 'bg-white/40 dark:bg-slate-900/40 border-slate-300/50 dark:border-slate-700/50 disabled:opacity-40'}`}>{sub}</button>)}</div>
                        )}
                      </div>
                    )}

                    {formData.targetExams.includes('THPTQG') && (
                      <div><label className="block text-sm font-bold mb-3">Tổ hợp môn THPTQG</label><div className="flex flex-wrap gap-2">{THPTQG_SUBJECTS.map(sub => <button type="button" key={sub} onClick={() => toggleSubject(sub)} className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${formData.targetSubjects.includes(sub) ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-white/40 dark:bg-slate-800/40 border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm'}`}>{sub}</button>)}</div></div>
                    )}
                  </div>
                </div>

                <div className="mt-10 flex justify-end">
                  <button onClick={handleSaveProfile} disabled={!formData.fullName || formData.targetExams.length === 0} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400/50 disabled:to-slate-400/50 disabled:backdrop-blur-md text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_8px_20px_rgba(59,130,246,0.3)] text-lg transition-all transform hover:-translate-y-0.5">Lưu & Khởi động</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-md h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-[40px] backdrop-saturate-[1.5] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto border-l border-white/60 dark:border-white/10 flex flex-col">
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center sticky top-0 z-10 bg-white/20 dark:bg-slate-900/20 backdrop-blur-md">
                <h2 className="text-2xl font-extrabold flex items-center gap-2 drop-shadow-sm"><Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Cài đặt</h2>
                <button onClick={() => setShowProfile(false)} className="p-2 rounded-full bg-white/40 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700 transition-colors border border-white/50 dark:border-white/10"><X className="w-5 h-5 text-slate-700 dark:text-slate-300" /></button>
              </div>

              <div className="p-6 space-y-8 flex-grow">
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">{isDarkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-orange-500" />}<span className="font-bold text-sm">Giao diện tối</span></div>
                    <button onClick={toggleDarkMode} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors border border-white/30 shadow-inner ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300/80'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                  </div>
                </div>

                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm">
                  <h3 className="text-sm font-bold mb-3">Tùy chọn hệ thống</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-yellow-400" /><div><p className="text-xs text-slate-500">Trợ lý Sen AI</p><p className="text-[11px] text-slate-500">Bật/Tắt trợ lý AI trên giao diện</p></div></div>
                      <button onClick={() => toggleAiEnabled()} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors border border-white/30 shadow-inner ${isAiEnabled ? 'bg-blue-600' : 'bg-slate-300/80'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isAiEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-red-400" /><div><p className="text-xs text-slate-500">Thông báo</p><p className="text-[11px] text-slate-500">Nhận thông báo mới từ hệ thống</p></div></div>
                      <button onClick={toggleNotifications} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors border border-white/30 shadow-inner ${notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300/80'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><KeyRound className="w-5 h-5 text-indigo-500" /><div><p className="text-xs text-slate-500">Ngôn ngữ</p><p className="text-[11px] text-slate-500">Chọn ngôn ngữ hiển thị</p></div></div>
                      <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-3 py-2 font-bold outline-none">
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><Lock className="w-5 h-5 text-slate-700" /><div><p className="text-xs text-slate-500">Đổi mật khẩu</p><p className="text-[11px] text-slate-500">Thay đổi mật khẩu đăng nhập</p></div></div>
                      <button onClick={() => setShowChangePassword(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">Đổi mật khẩu</button>
                    </div>
                  </div>
                </div>

                {showChangePassword && (
                  <div className="bg-white/30 dark:bg-slate-900/30 p-4 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm">
                    <label className="block text-xs font-bold mb-2">Mật khẩu mới</label>
                    <div className="flex gap-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="flex-1 bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-3 py-2 outline-none" placeholder="Mật khẩu tối thiểu 6 ký tự" /><button onClick={handleChangePassword} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold">Lưu</button></div>
                    <div className="mt-2"><button onClick={() => { setShowChangePassword(false); setNewPassword('') }} className="text-sm text-slate-500">Hủy</button></div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 drop-shadow-sm">Hồ sơ thí sinh</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/60 dark:border-slate-700/50 shadow-sm"><User className="w-5 h-5 text-blue-500 drop-shadow-sm" /><div><p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Họ và Tên</p><p className="font-bold text-sm">{formData.fullName || 'Chưa cập nhật'}</p></div></div>
                    <div className="flex items-center gap-3 p-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/60 dark:border-slate-700/50 shadow-sm"><MapPin className="w-5 h-5 text-emerald-500 drop-shadow-sm" /><div><p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Khu vực</p><p className="font-bold text-sm">{formData.province || 'Chưa rõ'} - {formData.school || 'Chưa rõ'}</p></div></div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/10 dark:bg-slate-900/10 backdrop-blur-md">
                <button onClick={() => { setShowOnboarding(true); setShowProfile(false); }} className="w-full py-3.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-sm rounded-xl font-bold text-sm text-slate-800 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-700 transition-all">
                  Cập nhật hồ sơ năng lực
                </button>
              </div>
            </div>
          </div>
        )}

        {showNotifications && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-[500px] h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl backdrop-saturate-[2] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto border-l border-white/60 dark:border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center sticky top-0 z-10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                <h2 className="text-2xl font-extrabold flex items-center gap-3 drop-shadow-sm"><Bell className="w-6 h-6 text-red-500 fill-red-500 animate-pulse" /> Bảng Thông Báo</h2>
                <button onClick={() => setShowNotifications(false)} className="p-2 rounded-full bg-white/40 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700 transition-colors border border-white/50 dark:border-white/10"><X className="w-5 h-5 text-slate-700 dark:text-slate-300" /></button>
              </div>

              <div className="p-6 flex-grow">
                {activeAnnouncement ? (
                  <div className="bg-white/60 dark:bg-slate-800/60 p-6 rounded-3xl border border-white/60 dark:border-slate-700/50 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
                    <AnnouncementRenderer text={activeAnnouncement} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Bell className="w-12 h-12 mb-4 opacity-30" />
                    <p className="font-bold">Hiện không có thông báo nào từ hệ thống.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`transition-all duration-500 ${(showOnboarding || showProfile || showCodeModal || showNotifications) ? 'opacity-30 pointer-events-none select-none blur-md scale-[0.98]' : ''}`}>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-3 md:gap-4">
            <div className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0" onClick={() => router.push('/dashboard')}>
              <div className="w-10 h-10 bg-gradient-to-br from-white/60 to-white/40 dark:from-slate-800/80 dark:to-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl flex items-center justify-center p-1 backdrop-blur-lg shadow-sm group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                <img src="/logo.png" alt="SenExam Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl md:text-2xl font-black tracking-tight drop-shadow-sm leading-none text-slate-900 dark:text-white">
                  SenExam<span className="text-blue-600 dark:text-blue-400 drop-shadow-md">.ME</span>
                </h1>
                <span className="text-[8px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  Nền tảng Học và Thi trực tuyến miễn phí
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGlobalSearch() } }} placeholder="Tìm nhanh tài liệu hoặc đề..." className="w-full pl-9 pr-10 py-2 rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
                <button onClick={() => handleGlobalSearch()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/20 hover:bg-white/30 text-slate-700 dark:text-slate-200">
                  {globalSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>

                {showGlobalResults && ((globalFoldersResults && globalFoldersResults.length > 0) || (globalDocsResults && globalDocsResults.length > 0) || (globalExamsResults && globalExamsResults.length > 0) || globalSearchLoading) && (
                  <div className="absolute right-0 left-auto mt-2 w-[min(980px,calc(100vw-1rem))] bg-white dark:bg-slate-900 border border-white/60 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden max-w-[calc(100vw-1rem)]">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="p-3 max-h-80 overflow-y-auto custom-scrollbar">
                      {globalSearchLoading && (
                        <div className="py-2 px-2 text-sm text-slate-500 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Đang tìm kiếm...
                        </div>
                      )}
                      {!!globalFoldersResults?.length && (
                        <div className="mb-2">
                          <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Thư mục</div>
                          {globalFoldersResults.map(folder => (
                            <div key={folder.id} onClick={() => { router.push(`/library?folder=${folder.id}`); setShowGlobalResults(false) }} className="py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md px-2 flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="font-bold text-sm truncate">{highlightText(folder.name || 'Không tên', globalQuery)}</div>
                                <div className="text-[11px] text-slate-500 truncate">Thư mục nội bộ</div>
                              </div>
                              <div className="text-[11px] text-slate-400 shrink-0">Mở</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!!globalDocsResults?.length && (
                        <div className="mb-2">
                          <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Tài liệu</div>
                          {globalDocsResults.map(d => (
                            <div
                              key={d.id}
                              onClick={() => { router.push(`/library?preview=${d.id}`); setShowGlobalResults(false) }}
                              onMouseEnter={() => scheduleHoverPreview(d)}
                              onMouseLeave={clearHoverPreview}
                              className="py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md px-2 flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-sm truncate">{highlightText(d.title || 'Không tên', globalQuery)}</div>
                                <div className="text-[11px] text-slate-500 truncate">Nội bộ{d.folder_name ? ` • ${d.folder_name}` : ' • mở trong thư viện'}</div>
                              </div>
                              <div className="text-[11px] text-slate-400 shrink-0">Xem</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!!globalExamsResults?.length && (
                        <div>
                          <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Đề thi</div>
                          {globalExamsResults.map(e => (
                            <div key={e.id} onClick={() => { router.push(`/exams/${e.id}`); setShowGlobalResults(false) }} className="py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md px-2">
                              <div className="font-bold text-sm">{highlightText(e.title || 'Không tên', globalQuery)}</div>
                              <div className="text-[11px] text-slate-500">Đề thi • {highlightText(e.exam_type || 'Không rõ', globalQuery)}{e.folder_name ? ` • ${e.folder_name}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!globalSearchLoading && !globalDocsResults?.length && !globalExamsResults?.length && globalQuery.trim().length >= 2 && (
                        <div className="py-2 px-2 text-sm text-slate-500">Không tìm thấy tài liệu hoặc đề thi phù hợp.</div>
                      )}
                      </div>

                      <div className="hidden lg:flex border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 min-h-[20rem] max-w-[320px]">
                        {hoverPreviewDoc ? (
                          <div className="w-full flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Xem nhanh</div>
                              <div className="font-bold text-sm truncate">{hoverPreviewDoc.title}</div>
                            </div>
                            <div className="flex-1 min-h-0">
                              <iframe key={hoverPreviewDoc.id} src={`/library?preview=${hoverPreviewDoc.id}&embed=1`} className="w-full h-full border-none" loading="lazy" />
                            </div>
                            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                              <button onClick={() => { router.push(`/library?preview=${hoverPreviewDoc.id}`); setShowGlobalResults(false) }} className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Mở chi tiết</button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-center p-4 text-center text-slate-500 text-sm">
                            Rê chuột vào một tài liệu để xem nhanh ở đây.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => router.push('/forum')} className={`${glassButtonStyles} flex items-center justify-center gap-1.5 px-4 py-2 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs md:text-sm`}>
                <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">Forum</span>
              </button>
              
              {(userRole === 'admin' || userRole === 'collab') && (
                <>
                  <button onClick={() => router.push('/announcements')} className={`${glassButtonStyles} flex items-center justify-center p-2 text-red-500 dark:text-red-400 rounded-xl transition-all`} title="Thông báo">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button onClick={() => router.push('/admin')} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-500/80 to-orange-500/80 hover:from-red-600 hover:to-orange-600 backdrop-blur-lg border border-red-400/30 text-white rounded-xl shadow-md font-bold text-xs md:text-sm transition-all hover:shadow-lg active:scale-95">
                    <ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
                  </button>
                </>
              )}

              <button onClick={() => setShowProfile(true)} className={`${glassButtonStyles} flex items-center justify-center gap-1.5 px-4 py-2 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs md:text-sm`}><Settings className="w-4 h-4" /></button>
              <button onClick={handleLogout} className={`${glassButtonStyles} flex items-center justify-center p-2 text-red-600 dark:text-red-400 rounded-xl font-bold`}><LogOut className="w-4 h-4" /></button>
            </div>
          </div>

          {activeAnnouncement && (
            <div className="mb-6 w-full animate-in fade-in slide-in-from-top-2 duration-500 relative z-20">
              <div className="bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-800/60 dark:to-slate-900/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-lg relative overflow-hidden group hover:shadow-xl transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
                <div className="absolute -right-32 -top-32 w-64 h-64 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/15 transition-colors"></div>
                <div className="relative z-10"><AnnouncementRenderer text={activeAnnouncement} /></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
            
            {/* Hero Card - Main Feature */}
            <div className="md:col-span-3 lg:col-span-4 bg-gradient-to-br from-blue-500/65 via-indigo-500/55 to-cyan-500/45 dark:from-blue-700/55 dark:via-indigo-800/45 dark:to-cyan-900/30 backdrop-blur-3xl backdrop-saturate-150 rounded-2xl p-7 md:p-8 text-white relative overflow-hidden shadow-[0_12px_36px_rgba(37,99,235,0.24)] hover:shadow-[0_16px_42px_rgba(37,99,235,0.3)] transition-all group border border-white/45 dark:border-white/10">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-lg rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/30 shadow-sm">
                    <Zap className="w-3 h-3 text-yellow-300 fill-yellow-300" /> Sẵn sàng
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight drop-shadow-md tracking-tight">
                    Chinh phục <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">{formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'Kỳ thi'}</span>
                  </h2>
                  <p className="text-blue-50/90 text-sm font-medium leading-relaxed drop-shadow-sm max-w-sm">
                    Cá nhân hóa đề thi phù hợp năng lực. Đo lường tiến bộ từng ngày.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button onClick={() => router.push('/exams')} className="bg-white/25 hover:bg-white/35 backdrop-blur-xl border border-white/40 text-white px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center justify-center gap-2 group/btn text-sm transition-all active:scale-95">
                    <Target className="w-4 h-4 group-hover/btn:scale-110 transition-transform" /> Kho đề <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                  <button onClick={() => setShowCodeModal(true)} className="bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/30 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-1.5 text-sm transition-all">
                    <KeyRound className="w-4 h-4" /> Code
                  </button>
                </div>
              </div>
              <BookOpen className="absolute -right-10 -bottom-10 w-48 h-48 text-white/8 blur-sm" />
            </div>

            {/* Stats Cards */}
            <div className={`${glassCardStyles} rounded-2xl p-5 md:p-6 flex flex-col justify-between border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 hover:shadow-md transition-all group`}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gradient-to-br from-orange-400/30 to-red-500/30 text-orange-600 dark:text-orange-400 rounded-lg backdrop-blur-md border border-orange-200/50 dark:border-orange-500/20 shadow-inner group-hover:scale-105 transition-transform">
                  <Trophy className="w-6 h-6 drop-shadow-md" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1 uppercase tracking-widest drop-shadow-sm">Điểm cao nhất</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm tracking-tight">
                  {studentHistoryList.length > 0 ? `${Math.max(...studentHistoryList.map(s => s.score || 0))}` : '--'}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className={`${glassCardStyles} rounded-2xl p-5 md:p-6 flex flex-col justify-between border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 hover:shadow-md transition-all group`}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-400/30 to-green-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg backdrop-blur-md border border-emerald-200/50 dark:border-emerald-500/20 shadow-inner group-hover:scale-105 transition-transform">
                  <BookOpen className="w-6 h-6 drop-shadow-md" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1 uppercase tracking-widest drop-shadow-sm">Bài làm</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white drop-shadow-sm tracking-tight">
                  {studentHistoryList.length}
                </p>
              </div>
            </div>

            {/* Community + Library Cards */}
            <div 
              onClick={() => router.push('/forum')}
              className={`${glassCardStyles} rounded-2xl p-5 md:p-6 flex flex-col justify-center border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 hover:shadow-md hover:-translate-y-0.5 group cursor-pointer relative overflow-hidden transition-all lg:col-span-3`}
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/15 dark:bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-500/25 transition-colors"></div>
              <div className="relative z-10">
                <div className="p-3 bg-gradient-to-br from-blue-400/30 to-indigo-500/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200/30 shadow-inner w-fit mb-3 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-5 h-5 drop-shadow-md" />
                </div>
                <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Cộng Đồng <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">
                  Nơi giao lưu học tập
                </p>
              </div>
            </div>

            <div 
              onClick={() => router.push('/library')}
              className={`${glassCardStyles} rounded-2xl p-5 md:p-6 flex flex-col justify-center border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer overflow-hidden relative lg:col-span-3`}
            >
              <div className="absolute -right-10 -top-10 w-36 h-36 bg-cyan-400/14 dark:bg-cyan-600/14 rounded-full blur-3xl group-hover:bg-cyan-400/22 transition-colors"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="p-3.5 bg-gradient-to-br from-cyan-400/30 to-blue-500/30 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-200/30 shadow-inner group-hover:scale-105 transition-transform shrink-0">
                  <FolderOpen className="w-6 h-6 drop-shadow-md" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    Thư Viện Số <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">
                    Tài liệu, chuyên đề và bài tập luyện tập đầy đủ
                  </p>
                </div>
              </div>
            </div>

            {/* History Section - Full Width */}
            <div className={`${glassCardStyles} lg:col-span-6 rounded-2xl p-5 md:p-6 flex flex-col overflow-hidden border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
              <h3 className="text-base font-extrabold flex items-center gap-2 mb-4 text-slate-900 dark:text-white drop-shadow-sm">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Lịch sử bài làm
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[250px] pr-2 space-y-2 custom-scrollbar">
                {studentHistoryList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 bg-white/30 dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-300/50 dark:border-slate-700/50 py-8 backdrop-blur-sm">
                    <BookOpen className="w-6 h-6 mb-2 opacity-50" />
                    <p className="text-xs font-bold">Chưa có dữ liệu</p>
                  </div>
                ) : (
                  studentHistoryList.map((sub) => {
                    const canReview = sub.exams?.allow_review;
                    return (
                      <div key={sub.id} className="p-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg rounded-lg border border-white/60 dark:border-slate-700/50 flex justify-between items-center gap-3 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-all shadow-sm group">
                        <div className="overflow-hidden flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate drop-shadow-sm">{sub.exams?.title}</p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">{new Date(sub.created_at).toLocaleString('vi-VN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} • {sub.exams?.exam_type}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm border backdrop-blur-md whitespace-nowrap ${sub.is_graded ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30'}`}>
                            {sub.is_graded ? `${sub.score} đ` : 'Chờ'}
                          </span>
                          {canReview && sub.is_graded ? (
                            <button onClick={() => router.push(`/submissions/${sub.id}/review`)} className="p-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 border border-blue-500/20 transition-all shadow-sm group-hover:scale-105" title="Xem chi tiết">
                              <Eye className="w-3.5 h-3.5"/>
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-500 italic font-bold px-1.5 py-1 bg-slate-400/10 rounded border border-slate-300/30 dark:border-slate-600/30">🔒</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <ChatOffline userName={formData.fullName ? formData.fullName.split(' ').pop() || '' : ''} avoid={showProfile} hidden={!isAiEnabled} />

    </div>
  )
}