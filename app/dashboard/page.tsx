'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  BookOpen, Clock, Trophy, Target, LogOut, User,
  ChevronRight, MessageSquare, Zap, ShieldCheck, AlertCircle, LayoutGrid,
  Settings, X, Sun, Moon, MapPin, GraduationCap, Loader2, Eye, KeyRound,
  Bell, FolderOpen, Sparkles, Lock, Music2, ArrowRight, Calculator, Hash,
  CheckCircle2, Info, BarChart3, FileText, FlaskConical, PlaySquare
} from 'lucide-react'

import ChatOffline from '@/app/components/ChatOffline'

// ============================================================================
// 1. KHAI BÁO CÁC HẰNG SỐ HỆ THỐNG
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

// 🌟 MATERIAL DESIGN 3 + LIQUID GLASS CONSTANTS
const mdCard = "bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-150 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner"
const mdButtonFilled = "bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-3.5 font-black transition-all duration-300 shadow-md hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
const mdButtonTonal = "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-full px-6 py-3 font-extrabold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
const mdIconButton = "p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors active:scale-95"

// Bảng màu tĩnh cho menu "Tất cả tính năng" (giữ literal để Tailwind JIT nhận diện)
const FEATURE_COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20",
  slate: "bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/40",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-500/20",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
  sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-500/20",
  rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
}

// Khai báo Interface cho Notification
interface SysNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
}

type MixedRange = { start: number; end: number; type: string; optionsCount: number }

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
  
  if (isNaN(target)) {
    return <span className="text-red-500 font-bold">[Lỗi định dạng ngày]</span>
  }
  
  const diff = target - now
  
  if (diff <= 0) {
    return (
      <span className="inline-block bg-slate-200 dark:bg-[#2A2A2A] text-slate-500 font-black px-4 py-1.5 rounded-full shadow-inner mx-1 text-sm">
        ⏳ Sự kiện đã diễn ra
      </span>
    )
  }
  
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  const s = Math.floor((diff / 1000) % 60)
  
  return (
    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black px-4 py-1.5 rounded-full shadow-[0_4px_15px_rgba(239,68,68,0.4)] mx-1 text-sm animate-pulse whitespace-nowrap">
      ⏳ {d} Ngày {h} Giờ {m} Phút {s} Giây
    </span>
  )
}

export const AnnouncementRenderer = ({ text }: { text: string }) => {
  const renderLine = (line: string, idx: number) => {
    let isH1 = false, isH2 = false, isH3 = false, isCenter = false;
    let content = line.trim();
    
    // Xử lý tag Center
    const centerMatch = content.match(/{Center:\s*(.*)}/i);
    if (centerMatch) {
      isCenter = true;
      content = content.replace(/{Center:\s*(.*)}/i, '$1').trim();
    }

    // Xử lý các tag Heading
    if (content.startsWith('###(H1)')) { 
      isH1 = true; 
      content = content.replace('###(H1)', '').trim() 
    }
    else if (content.startsWith('##(H2)')) { 
      isH2 = true; 
      content = content.replace('##(H2)', '').trim() 
    }
    else if (content.startsWith('#(H3)')) { 
      isH3 = true; 
      content = content.replace('#(H3)', '').trim() 
    }

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
            <span key={`qk-${match.index}`} className="text-yellow-300 font-black px-4 py-1.5 inline-flex items-center gap-2 mx-1 bg-red-600 rounded-full shadow-md uppercase tracking-wider">
              🇻🇳 🚜 314 {val} 🚩 🇻🇳
            </span>
          )
        }
        else if (tag === 'bold') {
          parts.push(
            <strong key={`b-${match.index}`} className="uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-wide">
              {val}
            </strong>
          )
        }
        else if (tag === 'underline') {
          parts.push(
            <u key={`u-${match.index}`} className="underline-offset-4 decoration-2 decoration-indigo-500">
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

    let baseClass = isH1 ? "text-3xl md:text-4xl font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight my-4 drop-shadow-md text-center w-full" :
                      isH2 ? "text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 my-3 text-center w-full" :
                      isH3 ? "text-xl font-bold text-slate-700 dark:text-slate-300 my-2" :
                      "text-base font-medium text-slate-700 dark:text-slate-300 my-1.5 leading-relaxed";

    if (isCenter) {
      baseClass += " flex justify-center items-center flex-wrap gap-2 text-center w-full";
    }

    return <div key={idx} className={baseClass}>{parseTags(content)}</div>;
  }
  
  return <div className="w-full space-y-1">{text.split('\n').map((line, idx) => renderLine(line, idx))}</div>
}

// ============================================================================
// 3. MAIN DASHBOARD PAGE COMPONENT
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
  
  // ĐỒNG BỘ: Sử dụng isDark
  const [isDark, setIsDark] = useState(false)
  
  // -- Data States --
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null)
  const [studentHistoryList, setStudentHistoryList] = useState<any[]>([])
  const [recentVideos, setRecentVideos] = useState<any[]>([])
  const [notifications, setNotifications] = useState<SysNotification[]>([
    { id: '1', title: 'SenExam V2.0', message: 'Hệ thống Material Design 3 đã được cập nhật thành công.', type: 'success', time: 'Vừa xong', read: false }
  ])

  // -- Modal Exam Code States --
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // -- Onboarding / Profile Form States --
  const [formData, setFormData] = useState({
    fullName: '', 
    dob: '', 
    cccd: '', 
    province: '', 
    school: '', 
    aspiration: '',
    targetExams: [] as string[], 
    targetSubjects: [] as string[],
    hsaOption: '' as 'Tiếng Anh' | 'Khoa học' | '', 
    hsaScienceSubjects: [] as string[]
  })

  // -- Settings States --
  const [isAiEnabled, setIsAiEnabled] = useState(true)
  const [language, setLanguage] = useState('vi')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // ----------------------------------------------------------------------------
  // 🌟 CALCULATOR MODAL STATES (TÍNH ĐIỂM ĐẠI HỌC)
  // ----------------------------------------------------------------------------
  const [showCalculatorModal, setShowCalculatorModal] = useState(false)
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [calcScores, setCalcScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [calcMainSubject, setCalcMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [calcPriorityScore, setCalcPriorityScore] = useState('')
  const [calcResult, setCalcResult] = useState<{
    rawScore: number;
    finalPriority: number;
    totalScore: number;
  } | null>(null)

  // -- Menu "Tất cả tính năng" (thay thế thanh search) --
  const [showFeatureMenu, setShowFeatureMenu] = useState(false)

  // ĐẾM THÔNG BÁO CHƯA ĐỌC
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  // ============================================================================
  // INITIALIZATION & EFFECTS
  // ============================================================================

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { 
        router.push('/login'); 
        return 
      }
      setUserEmail(user.email ?? null)

      // Kiểm tra hoặc tạo Profile nếu chưa có
      await ensureStudentProfile(user.id)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      if (profile) {
        setUserRole(profile.role || 'student')
        setFormData({
          fullName: profile.full_name || '', 
          dob: profile.dob || '', 
          cccd: profile.cccd || '',
          province: profile.province || '', 
          school: profile.school || '', 
          aspiration: profile.aspiration || '',
          targetExams: profile.target_exams || [], 
          targetSubjects: profile.target_subjects || [],
          hsaOption: profile.hsa_option || '', 
          hsaScienceSubjects: profile.hsa_science_subjects || []
        })

        // Bật Onboarding nếu thiếu thông tin cơ bản
        if (!profile.full_name || !profile.target_exams || profile.target_exams.length === 0) { 
          setShowOnboarding(true) 
        }

        // Fetch Lịch sử bài làm
        const { data: subHistory } = await supabase
          .from('submissions')
          .select('*, exams(title, exam_type, allow_review)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        setStudentHistoryList(subHistory || [])

        // Fetch Video mới nhất cho khối SenVideo trên Dashboard
        const role = profile.role || 'student'
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'collab'])
        const adminIds = admins ? admins.map(a => a.id) : []
        const { data: docsData } = await supabase.from('library_documents').select('id, title, drive_file_id, created_by, created_at').order('created_at', { ascending: false }).limit(100)
        if (docsData) {
          const vids = docsData.filter(d => {
            const isVideo = d.title && d.title.match(/\.(mp4|mkv|mov|avi|webm)$/i)
            if (!isVideo) return false
            if (role === 'student') return d.created_by === user.id || d.created_by === null || adminIds.includes(d.created_by)
            return true
          }).slice(0, 6)
          setRecentVideos(vids)
        }
      } else {
        setShowOnboarding(true)
      }

      // Fetch Thông báo (Announcements)
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

    // Khởi tạo Theme
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true); 
      document.documentElement.classList.add('dark')
    }

    // Load Local Settings
    setIsAiEnabled(localStorage.getItem('senai_enabled') !== '0')
    setLanguage(localStorage.getItem('senexam_lang') || 'vi')
    setNotificationsEnabled(localStorage.getItem('senexam_notifications') !== '0')
  }, [router])

  // Lắng nghe sự kiện để tính điểm tự động trong Modal Calculator
  useEffect(() => {
    if (!showCalculatorModal) return;

    // Dấu phẩy sẽ là dấu phẩy ở các bài toán
    const s1 = parseFloat(calcScores.sub1.replace(',', '.'))
    const s2 = parseFloat(calcScores.sub2.replace(',', '.'))
    const s3 = parseFloat(calcScores.sub3.replace(',', '.'))
    const baseP = parseFloat(calcPriorityScore.replace(',', '.')) || 0

    // Validate
    if (isNaN(s1) || isNaN(s2) || isNaN(s3) || s1 > 10 || s2 > 10 || s3 > 10 || s1 < 0 || s2 < 0 || s3 < 0) {
      setCalcResult(null)
      return
    }

    let rawScore = 0

    if (calcMode === 'standard') {
      rawScore = s1 + s2 + s3
    } else if (calcMode === 'hust') {
      const mainS = calcMainSubject === 'sub1' ? s1 : calcMainSubject === 'sub2' ? s2 : s3
      const otherSum = (s1 + s2 + s3) - mainS
      rawScore = ((mainS * 2 + otherSum) * 3) / 4
    }

    // Công thức tính điểm ưu tiên chuẩn Bộ GD&ĐT (Giảm trừ khi điểm >= 22.5)
    let actualPriority = baseP
    if (rawScore >= 22.5) {
      actualPriority = ((30 - rawScore) / 7.5) * baseP
    }

    rawScore = Math.round(rawScore * 100) / 100
    actualPriority = Math.round(actualPriority * 100) / 100
    const totalScore = Math.round((rawScore + actualPriority) * 100) / 100

    setCalcResult({ 
      rawScore, 
      finalPriority: Math.max(0, actualPriority), 
      totalScore 
    })
  }, [calcScores, calcMode, calcMainSubject, calcPriorityScore, showCalculatorModal])

  // ============================================================================
  // XỬ LÝ SỰ KIỆN (HANDLERS)
  // ============================================================================

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    router.push('/login') 
  }

  // ĐỒNG BỘ TÊN HÀM
  const toggleTheme = () => {
    if (isDark) { 
      document.documentElement.classList.remove('dark'); 
      localStorage.setItem('theme', 'light'); 
      setIsDark(false) 
    } 
    else { 
      document.documentElement.classList.add('dark'); 
      localStorage.setItem('theme', 'dark'); 
      setIsDark(true) 
    }
  }

  // Quản lý Form Onboarding
  const toggleExam = (exam: string) => { 
    setFormData(prev => ({ 
      ...prev, 
      targetExams: prev.targetExams.includes(exam) ? prev.targetExams.filter(e => e !== exam) : [...prev.targetExams, exam] 
    })) 
  }
  
  const toggleSubject = (subject: string) => { 
    setFormData(prev => ({ 
      ...prev, 
      targetSubjects: prev.targetSubjects.includes(subject) ? prev.targetSubjects.filter(s => s !== subject) : [...prev.targetSubjects, subject] 
    })) 
  }
  
  const toggleHsaScienceSubject = (subject: string) => {
    setFormData(prev => {
      const isSelected = prev.hsaScienceSubjects.includes(subject)
      if (isSelected) {
        return { ...prev, hsaScienceSubjects: prev.hsaScienceSubjects.filter(s => s !== subject) }
      }
      if (prev.hsaScienceSubjects.length < 3) {
        return { ...prev, hsaScienceSubjects: [...prev.hsaScienceSubjects, subject] }
      }
      return prev
    })
  }

  const handleSaveProfile = async () => {
    if (formData.targetExams.includes('HSA') && formData.hsaOption === 'Khoa học' && formData.hsaScienceSubjects.length !== 3) { 
      alert("Vui lòng chọn đủ 3 môn trong phần thi Khoa học của HSA!"); 
      return 
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase.from('profiles').update({
      full_name: formData.fullName, 
      dob: formData.dob || null, 
      cccd: formData.cccd, 
      province: formData.province, 
      school: formData.school, 
      aspiration: formData.aspiration, 
      target_exams: formData.targetExams, 
      target_subjects: formData.targetSubjects, 
      hsa_option: formData.hsaOption, 
      hsa_science_subjects: formData.hsaScienceSubjects
    }).eq('id', user.id)

    if (error) {
      alert("Có lỗi xảy ra: " + error.message)
    } else { 
      setShowOnboarding(false); 
      setShowProfile(false) 
    }
  }

  // Các hàm Setting
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
    if (newPassword.length < 6) { 
      alert('Mật khẩu phải có ít nhất 6 ký tự'); 
      return 
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { 
      alert('Bạn cần đăng nhập lại để đổi mật khẩu'); 
      return 
    }
    const { error: upErr } = await supabase.auth.updateUser({ password: newPassword })
    if (upErr) {
      alert('Lỗi khi đổi mật khẩu: ' + upErr.message)
    } else { 
      alert('Đổi mật khẩu thành công'); 
      setShowChangePassword(false); 
      setNewPassword('') 
    }
  }

  const handleJoinHiddenExam = async () => {
    if (!examCode.trim()) return
    setCodeLoading(true)
    const { data, error } = await supabase.from('exams').select('id, title').eq('access_code', examCode.trim().toUpperCase()).single()
    if (error || !data) { 
      alert('Mã đề thi không hợp lệ hoặc đã bị vô hiệu hóa!'); 
      setCodeLoading(false) 
    } else { 
      router.push(`/exams/${data.id}`) 
    }
  }

  // Calculator Score Input Handler
  const handleScoreCalcChange = (field: string, value: string) => {
    // Cho phép nhập số và dấu phẩy
    if (value === '' || /^[0-9.,]*$/.test(value)) {
      setCalcScores(prev => ({ ...prev, [field]: value }))
    }
  }

  // Danh sách "Tất cả tính năng" — thêm tính năng mới ở đây, không cần thêm ô mới ngoài màn hình chính
  const FEATURES = [
    { key: 'exams', label: 'Vào thi ngay', desc: 'Kho đề thi thử bám sát cấu trúc mới nhất.', icon: Target, color: 'indigo', onSelect: () => router.push('/exams') },
    { key: 'code', label: 'Nhập Code Đề', desc: 'Truy cập nhanh một đề thi bằng mã code.', icon: KeyRound, color: 'slate', onSelect: () => setShowCodeModal(true) },
    { key: 'focus', label: 'Phòng Tập Trung', desc: 'Kỹ thuật Pomodoro & Lo-Fi Chill không quảng cáo.', icon: Music2, color: 'purple', onSelect: () => router.push('/focus') },
    { key: 'library', label: 'Thư Viện Số', desc: 'Hàng ngàn tài liệu, sách và chuyên đề lưu trữ số.', icon: FolderOpen, color: 'cyan', onSelect: () => router.push('/library') },
    { key: 'senvideo', label: 'SenVideo', desc: 'Xem luồng Stream chất lượng cao không giật lag.', icon: PlaySquare, color: 'indigo', onSelect: () => router.push('/senvideo') },
    { key: 'lab', label: 'Phòng Thí Nghiệm', desc: 'Mô phỏng vật lý trực quan tích hợp Gia sư SenAI.', icon: FlaskConical, color: 'emerald', onSelect: () => router.push('/phongthinghiem') },
    { key: 'forum', label: 'Cộng Đồng', desc: 'Thảo luận ẩn danh, giao lưu phương pháp học tập.', icon: MessageSquare, color: 'sky', onSelect: () => router.push('/forum') },
    { key: 'score', label: 'Tính điểm ĐH', desc: 'Quy chuẩn thang 30. Tự động cộng/trừ ưu tiên.', icon: Calculator, color: 'rose', onSelect: () => router.push('/tinhdiem') },
  ] as const

  // ============================================================================
  // RENDER UI CHÍNH
  // ============================================================================

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400 mb-6" />
        <p className="font-extrabold text-slate-500 tracking-widest uppercase text-sm animate-pulse">Đang tải không gian SenExam...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 selection:bg-indigo-200 dark:selection:bg-indigo-900 overflow-x-hidden pb-10">
      
      {/* ========================================================= */}
      {/* 🌟 NỀN AMBIENT LIQUID GLASS MỚI DÀNH CHO DASHBOARD V2.0 */}
      {/* ========================================================= */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/20 to-indigo-400/10 dark:from-blue-800/20 dark:to-indigo-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed top-[30%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-400/15 to-pink-400/10 dark:from-purple-800/15 dark:to-pink-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* ========================================================= */}
      {/* 🌟 APP BAR (HEADER) - CHUẨN MATERIAL DESIGN 3 */}
      {/* ========================================================= */}
      <header className="h-[80px] px-4 sm:px-6 lg:px-10 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 transition-colors shadow-sm">
        
        {/* Lô-gô Section */}
        <div 
          className="flex items-center gap-3 cursor-pointer group shrink-0" 
          onClick={() => router.push('/dashboard')}
        >
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20 border border-slate-200 dark:border-white/10 flex items-center justify-center p-2.5 group-hover:scale-105 transition-transform duration-300 shadow-sm">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm scale-110" />
          </div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">SenExam</h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Hệ thống V2.0</span>
          </div>
        </div>

        {/* Thanh "Tất cả tính năng" trung tâm (thay thế thanh search) */}
        <div className="flex-1 max-w-2xl mx-4 md:mx-8 relative z-50">
          <button
            onClick={() => setShowFeatureMenu(v => !v)}
            className="w-full flex items-center gap-3 bg-slate-100/80 dark:bg-[#1A1A1A] hover:bg-slate-200/50 dark:hover:bg-[#202020] border-2 border-transparent rounded-full pl-5 pr-4 py-3 transition-all shadow-inner"
          >
            <LayoutGrid className="w-5 h-5 text-indigo-500 shrink-0"/>
            <span className="flex-1 text-left font-bold text-sm text-slate-500 dark:text-slate-400">Tất cả tính năng</span>
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showFeatureMenu ? 'rotate-90' : ''}`}/>
          </button>

          {/* Dropdown Menu tính năng (Floating Card) */}
          {showFeatureMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setShowFeatureMenu(false)} />
              <div className="absolute top-[calc(100%+12px)] w-full bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100] p-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEATURES.map(f => {
                    const Icon = f.icon
                    const colorClass = FEATURE_COLOR_MAP[f.color] ?? FEATURE_COLOR_MAP.indigo
                    return (
                      <button
                        key={f.key}
                        onClick={() => { f.onSelect(); setShowFeatureMenu(false) }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#2A2A2A] transition-colors text-left group"
                      >
                        <div className={`p-2.5 rounded-xl border shrink-0 group-hover:scale-110 transition-transform ${colorClass}`}>
                          <Icon className="w-5 h-5"/>
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">{f.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{f.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Nút Action góc phải */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {(userRole === 'admin' || userRole === 'collab') && (
            <button 
              onClick={() => router.push('/admin')} 
              className="hidden lg:flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-[#1E1E1E] dark:hover:bg-indigo-900/30 dark:text-indigo-400 px-5 py-3 rounded-full font-extrabold text-sm transition-colors border border-indigo-200 dark:border-indigo-900/50 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4"/> Bảng Quản trị
            </button>
          )}
          
          <button 
            onClick={() => setShowNotifications(true)} 
            className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 transition-colors active:scale-95 relative"
          >
            <Bell className="w-5 h-5"/>
            {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-[#121212] rounded-full"></span>}
          </button>
          
          <button 
            onClick={toggleTheme} 
            className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 transition-colors active:scale-95"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400"/> : <Moon className="w-5 h-5"/>}
          </button>
          
          <button 
            onClick={() => setShowProfile(true)} 
            className="ml-2 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-black shadow-md hover:shadow-lg hover:scale-105 transition-all"
          >
            {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5"/>}
          </button>
        </div>
      </header>

      {/* ============================================================================ */}
      {/* 🌟 KHÔNG GIAN LÀM VIỆC CHÍNH (MAIN WORKSPACE DASHBOARD) */}
      {/* ============================================================================ */}
      <main 
        className={`max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 relative z-10 transition-all duration-300 
          ${(showOnboarding || showProfile || showCodeModal || showNotifications || showCalculatorModal) ? 'opacity-30 pointer-events-none select-none blur-md scale-[0.98]' : ''}
        `}
      >
        
        {/* Banner Thông báo Khẩn cấp */}
        {activeAnnouncement && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl border border-indigo-200/50 dark:border-indigo-900/30 rounded-[2rem] p-6 flex items-start gap-5 animate-in fade-in slide-in-from-top-4 shadow-sm">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
              <AlertCircle className="w-7 h-7"/>
            </div>
            <div className="flex-1 min-w-0">
              <AnnouncementRenderer text={activeAnnouncement} />
            </div>
          </div>
        )}

        {/* 🌟 LƯỚI BENTO CẤP 1 (HERO BANNER + THỐNG KÊ) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6">
          
          {/* KHỐI HERO (Chiếm 8/12 cột) */}
          <div className="md:col-span-8 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-800 dark:via-blue-800 dark:to-cyan-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col justify-between min-h-[360px] group border border-white/20 dark:border-white/5">
            {/* Họa tiết lưới và ánh sáng chìm */}
            <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-white/20 rounded-full blur-[80px] group-hover:scale-110 transition-transform duration-1000 ease-out"></div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full text-[11px] font-black uppercase tracking-widest mb-6 shadow-sm border border-white/20">
                <Sparkles className="w-4 h-4 text-yellow-300" /> Bứt phá giới hạn
              </span>
              <h2 className="text-4xl lg:text-5xl font-black mb-5 leading-tight tracking-tight drop-shadow-md">
                Chinh phục mục tiêu <br/> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-white drop-shadow-none">
                  {formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'Kỳ thi sắp tới'}
                </span>
              </h2>
              <p className="text-blue-50/90 font-medium max-w-md leading-relaxed text-sm md:text-base mb-10 drop-shadow-sm">
                Không gian luyện thi cá nhân hóa. Đánh giá năng lực chính xác. Trải nghiệm làm bài trực tuyến mượt mà.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap gap-4">
              <button 
                onClick={() => router.push('/exams')} 
                className="bg-white text-indigo-700 hover:bg-slate-50 px-8 py-4 rounded-full font-black flex items-center gap-2 transition-transform active:scale-95 shadow-md"
              >
                <Target className="w-5 h-5"/> Vào thi ngay
              </button>
              <button 
                onClick={() => setShowCodeModal(true)} 
                className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/30 px-7 py-4 rounded-full font-bold flex items-center gap-2 transition-colors active:scale-95"
              >
                <KeyRound className="w-5 h-5"/> Nhập Code Đề
              </button>
            </div>
            
            <BookOpen className="absolute -right-10 -bottom-10 w-[300px] h-[300px] text-white/5 rotate-12 blur-[2px] pointer-events-none" />
          </div>

          {/* KHỐI THỐNG KÊ BÊN PHẢI (Chiếm 4/12 cột) */}
          <div className="md:col-span-4 flex flex-col gap-5 lg:gap-6">
            
            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 flex-1 flex flex-col justify-center items-center text-center group">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner border border-orange-100 dark:border-orange-500/20">
                <Trophy className="w-8 h-8 drop-shadow-sm"/>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Điểm cao nhất</p>
              <p className="text-[2.5rem] font-black text-slate-900 dark:text-white leading-none">
                {studentHistoryList.length > 0 ? Math.max(...studentHistoryList.map(s => s.score || 0)) : '--'}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 flex-1 flex flex-col justify-center items-center text-center group">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner border border-emerald-100 dark:border-emerald-500/20">
                <FileText className="w-8 h-8 drop-shadow-sm"/>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Số đề đã giải</p>
              <p className="text-[2.5rem] font-black text-slate-900 dark:text-white leading-none">
                {studentHistoryList.length}
              </p>
            </div>

          </div>
        </div>

        {/* 🌟 LƯỚI BENTO CẤP 2: BỘ 6 CÔNG CỤ (CHÈN THÊM PHÒNG THÍ NGHIỆM) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 lg:gap-6">
          
          <div 
            onClick={() => router.push('/focus')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-purple-100 dark:border-purple-500/20">
              <Music2 className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1">
              Phòng Tập Trung <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Kỹ thuật Pomodoro & Lo-Fi Chill không quảng cáo.
            </p>
          </div>
          
          <div 
            onClick={() => router.push('/library')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-cyan-100 dark:border-cyan-500/20">
              <FolderOpen className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-1">
              Thư Viện Số <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Hàng ngàn tài liệu, sách và chuyên đề lưu trữ số.
            </p>
          </div>

          <div 
            onClick={() => router.push('/senvideo')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500 relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors pointer-events-none"></div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-indigo-100 dark:border-indigo-500/20 relative z-10">
              <PlaySquare className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1 relative z-10">
              SenVideo <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed relative z-10">
              Xem luồng Stream chất lượng cao không giật lag.
            </p>
          </div>

          {/* 🌟 NÚT MỚI: PHÒNG THÍ NGHIỆM ẢO */}
          <div 
            onClick={() => router.push('/phongthinghiem')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500 relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors pointer-events-none"></div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-emerald-100 dark:border-emerald-500/20 relative z-10">
              <FlaskConical className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1 relative z-10">
              Phòng Thí Nghiệm <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed relative z-10">
              Mô phỏng vật lý trực quan tích hợp Gia sư SenAI.
            </p>
          </div>

          <div 
            onClick={() => router.push('/forum')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-sky-100 dark:border-sky-500/20">
              <MessageSquare className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors flex items-center gap-1">
              Cộng Đồng <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Thảo luận ẩn danh, giao lưu phương pháp học tập.
            </p>
          </div>

          <div 
            onClick={() => router.push('/tinhdiem')} 
            className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-rose-100 dark:border-rose-500/20">
              <Calculator className="w-6 h-6 drop-shadow-sm"/>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors flex items-center gap-1">
              Tính điểm ĐH <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Quy chuẩn thang 30. Tự động cộng/trừ ưu tiên.
            </p>
          </div>

        </div>

        {/* 🌟 VIDEO MỚI NHẤT (SENVIDEO) VỚI THUMBNAIL */}
        {recentVideos.length > 0 && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm mt-5 lg:mt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <PlaySquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>
                Video mới nhất
              </h3>
              <button onClick={() => router.push('/senvideo')} className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all">
                Xem tất cả <ArrowRight className="w-3.5 h-3.5"/>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {recentVideos.map(vid => (
                <div key={vid.id} onClick={() => router.push('/senvideo')} className="group cursor-pointer">
                  <div className="w-full aspect-video bg-indigo-100 dark:bg-indigo-900/20 rounded-xl overflow-hidden relative mb-2">
                    <img
                      src={`/api/drive/thumbnail?fileId=${vid.drive_file_id}`}
                      alt={vid.title}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                      <PlaySquare className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity"/>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{vid.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🌟 LỊCH SỬ BÀI LÀM KIỂU BẢNG (LIST VIEW V2.0) */}
        <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/> 
              Lịch sử bài làm gần đây
            </h3>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 dark:bg-[#1E1E1E] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-4"/>
                <p className="font-bold text-slate-500 dark:text-slate-400 text-sm">Chưa ghi nhận hoạt động thi nào trên hệ thống.</p>
              </div>
            ) : (
              studentHistoryList.map(sub => (
                <div 
                  key={sub.id} 
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 rounded-[1.5rem] bg-slate-50 dark:bg-[#1E1E1E] hover:bg-slate-100 dark:hover:bg-[#252525] border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform group-hover:text-indigo-500">
                      <FileText className="w-6 h-6"/>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 dark:text-white truncate text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {sub.exams?.title}
                      </h4>
                      <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-bold">
                        <span>{new Date(sub.created_at).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <span className="uppercase tracking-widest text-indigo-500 dark:text-indigo-400">{sub.exams?.exam_type}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto pl-16 sm:pl-0 shrink-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-4 sm:pt-0 mt-2 sm:mt-0">
                    <div className={`px-5 py-2.5 rounded-full text-xs font-black shadow-sm ${
                        sub.is_graded 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                      }`}
                    >
                      {sub.is_graded ? `${String(sub.score).replace('.', ',')} Điểm` : 'Đang chờ chấm'}
                    </div>
                    {sub.exams?.allow_review && sub.is_graded ? (
                      <button 
                        onClick={() => router.push(`/submissions/${sub.id}/review`)} 
                        className="p-3.5 rounded-xl bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:text-slate-300 shadow-sm transition-all group-hover:scale-105 active:scale-95" 
                        title="Xem lại bài làm"
                      >
                        <ArrowRight className="w-5 h-5"/>
                      </button>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#1A1A1A] text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-transparent cursor-not-allowed" title="Bài thi này không hỗ trợ xem lại">
                        <Lock className="w-5 h-5"/>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* ========================================================= */}
      {/* 🌟 OVERLAYS: MODALS & SIDE PANELS V2.0 */}
      {/* ========================================================= */}

      {/* 1. Modal Nhập Code Đề Private */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-[#1E1E1E] rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative border border-slate-100 dark:border-white/5">
              <button onClick={() => setShowCodeModal(false)} className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
              
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-[1.2rem] flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-500/20 shadow-inner">
                <KeyRound className="w-8 h-8 text-indigo-600 dark:text-indigo-400"/>
              </div>
              
              <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Truy cập đề ẩn</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium leading-relaxed">Nhập mã Code do giáo viên cung cấp để giải khóa đề thi bảo mật.</p>
              
              <input 
                type="text" 
                value={examCode} 
                onChange={(e) => setExamCode(e.target.value.toUpperCase())} 
                placeholder="NHẬP MÃ TẠI ĐÂY" 
                className="w-full bg-slate-50 dark:bg-[#121212] border-transparent focus:bg-white dark:focus:bg-[#121212] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-black tracking-widest text-center text-xl outline-none transition-all mb-6 uppercase shadow-inner" 
              />
              
              <button 
                onClick={handleJoinHiddenExam} 
                disabled={codeLoading || !examCode} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl w-full py-4 font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-base"
              >
                {codeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mở khóa phòng thi'}
              </button>
           </div>
        </div>
      )}

      {/* 2. Slide-over Profile / Cài đặt hệ thống */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-md h-full bg-white dark:bg-[#1E1E1E] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto flex flex-col animate-in slide-in-from-right border-l border-slate-200 dark:border-white/5">
            <div className="p-6 flex justify-between items-center sticky top-0 z-10 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500"/> Cài đặt
              </h2>
              <button onClick={() => setShowProfile(false)} className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="p-6 space-y-8 flex-grow">
              
              {/* Profile Overview Card */}
              <div className="bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/5 rounded-3xl p-5 flex items-center gap-4 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-2xl shrink-0">
                  {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User/>}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white truncate text-base">{formData.fullName || 'Chưa cập nhật tên'}</h3>
                  <p className="text-sm font-medium text-slate-500 truncate">{userEmail}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 ml-2">Cấu hình Giao diện & AI</h3>
                
                <div className="bg-slate-50 dark:bg-[#121212] rounded-3xl border border-slate-100 dark:border-transparent overflow-hidden">
                  <div className="flex items-center justify-between p-4.5 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-4">
                      {isDark ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-orange-500" />}
                      <div><p className="font-bold text-slate-900 dark:text-white text-sm">Chế độ tối (Dark Mode)</p></div>
                    </div>
                    <button onClick={toggleTheme} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isDark ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                  </div>

                  <div className="flex items-center justify-between p-4.5 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-4">
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                      <div><p className="font-bold text-slate-900 dark:text-white text-sm">Trợ lý Sen AI</p><p className="text-[11px] font-medium text-slate-500">Hiển thị Bong bóng AI</p></div>
                    </div>
                    <button onClick={() => toggleAiEnabled()} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isAiEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isAiEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                  </div>

                  <div className="flex items-center justify-between p-4.5">
                    <div className="flex items-center gap-4">
                      <Bell className="w-5 h-5 text-rose-500" />
                      <div><p className="font-bold text-slate-900 dark:text-white text-sm">Thông báo hệ thống</p></div>
                    </div>
                    <button onClick={toggleNotifications} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 ml-2">Tài khoản & Bảo mật</h3>
                
                <div className="bg-slate-50 dark:bg-[#121212] rounded-3xl border border-slate-100 dark:border-transparent overflow-hidden">
                  <div className="flex items-center justify-between p-4.5 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-4">
                      <Lock className="w-5 h-5 text-slate-500" />
                      <div><p className="font-bold text-slate-900 dark:text-white text-sm">Đổi mật khẩu</p></div>
                    </div>
                    <button onClick={() => setShowChangePassword(!showChangePassword)} className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg tracking-wider">Mở</button>
                  </div>

                  {showChangePassword && (
                    <div className="p-4 bg-slate-100 dark:bg-[#1A1A1A]">
                      <input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        className="w-full bg-white dark:bg-[#252525] border-transparent focus:bg-white dark:focus:bg-[#252525] border-2 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all font-medium text-slate-900 dark:text-white text-sm shadow-sm mb-3" 
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" 
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowChangePassword(false); setNewPassword('') }} className="bg-slate-200 hover:bg-slate-300 dark:bg-[#333333] dark:hover:bg-[#444444] text-slate-700 dark:text-slate-300 rounded-xl px-4 py-2.5 font-bold transition-all flex-1 text-sm">Hủy</button>
                        <button onClick={handleChangePassword} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 font-bold transition-all flex-1 text-sm shadow-md">Lưu mới</button>
                      </div>
                    </div>
                  )}

                  <div className="p-4.5">
                    <div className="flex items-center gap-4">
                      <GraduationCap className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">Hồ sơ thí sinh</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{formData.province ? `${formData.school} - ${formData.province}` : 'Chưa cập nhật trường/tỉnh'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* 🌟 THÊM NÚT ĐĂNG XUẤT VÀ CẬP NHẬT HỒ SƠ TẠI ĐÂY */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#121212] flex flex-col gap-3">
              <button 
                onClick={() => { setShowOnboarding(true); setShowProfile(false); }} 
                className="w-full bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-2xl py-4 font-black transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
              >
                Cập nhật Hồ sơ Năng lực
              </button>

              <button 
                onClick={handleLogout} 
                className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-2xl py-4 font-black transition-all shadow-sm active:scale-95 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" /> Đăng xuất tài khoản
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* 3. Fullscreen Onboarding / Thiết lập Hồ sơ Năng lực v2 */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm transition-all overflow-y-auto">
           <div className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] w-full max-w-4xl shadow-2xl my-auto animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="mb-10 flex justify-between items-start">
                <div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Hồ sơ năng lực 👋</h2>
                  <p className="text-slate-500 mt-2 font-medium">Thiết lập dữ liệu cá nhân để AI phân phối cấu trúc đề phù hợp nhất.</p>
                </div>
                {formData.fullName && (
                  <button onClick={() => setShowOnboarding(false)} className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#2A2A2A] dark:hover:bg-[#333333] rounded-full transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div className="space-y-6">
                  <h3 className="font-black text-sm text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-3">Thông tin cá nhân</h3>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-slate-500">Họ và Tên (*)</label>
                    <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner" placeholder="Nhập họ tên của bạn..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">Ngày sinh</label>
                      <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-4 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner [color-scheme:light] dark:[color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">Số CCCD</label>
                      <input type="text" value={formData.cccd} onChange={e => setFormData({...formData, cccd: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner" placeholder="Định danh..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">Tỉnh/TP</label>
                      <select value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-4 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner">
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">Trường THPT</label>
                      <input type="text" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner" placeholder="Tên trường..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-black text-sm text-orange-600 dark:text-orange-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-3">Định hướng kỳ thi</h3>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-slate-500">Nguyện vọng Đại học</label>
                    <input type="text" value={formData.aspiration} onChange={e => setFormData({...formData, aspiration: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner" placeholder="VD: Đại học Quốc Gia..." />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold mb-3 text-slate-500">Chọn Kỳ thi mục tiêu (*)</label>
                    <div className="flex flex-wrap gap-2.5">
                      {EXAMS.map(exam => (
                        <button 
                          type="button" 
                          key={exam} 
                          onClick={() => toggleExam(exam)} 
                          className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border border-transparent ${formData.targetExams.includes(exam) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                        >
                          {exam}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.targetExams.includes('HSA') && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 md:p-6 rounded-[1.5rem] border border-indigo-100 dark:border-indigo-900/30">
                      <h4 className="font-black text-indigo-700 dark:text-indigo-400 mb-4 text-sm">Cấu trúc đề môn tự chọn HSA</h4>
                      <div className="flex gap-2 mb-4">
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, hsaOption: 'Tiếng Anh', hsaScienceSubjects: []})} 
                          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${formData.hsaOption === 'Tiếng Anh' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5'}`}
                        >
                          Tiếng Anh
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, hsaOption: 'Khoa học', hsaScienceSubjects: []})} 
                          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${formData.hsaOption === 'Khoa học' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5'}`}
                        >
                          Khoa học (Chọn 3)
                        </button>
                      </div>
                      {formData.hsaOption === 'Khoa học' && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-indigo-200/50 dark:border-indigo-800/50">
                          {HSA_SCIENCE_SUBJECTS.map(sub => (
                            <button 
                              type="button" 
                              key={sub} 
                              onClick={() => toggleHsaScienceSubject(sub)} 
                              disabled={!formData.hsaScienceSubjects.includes(sub) && formData.hsaScienceSubjects.length >= 3} 
                              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${formData.hsaScienceSubjects.includes(sub) ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {formData.targetExams.includes('THPTQG') && (
                    <div>
                      <label className="block text-xs font-bold mb-3 text-slate-500">Tổ hợp môn THPTQG</label>
                      <div className="flex flex-wrap gap-2.5">
                        {THPTQG_SUBJECTS.map(sub => (
                          <button 
                            type="button" 
                            key={sub} 
                            onClick={() => toggleSubject(sub)} 
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border border-transparent ${formData.targetSubjects.includes(sub) ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-700'}`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 flex justify-end pt-6 border-t border-slate-100 dark:border-white/5">
                <button 
                  onClick={handleSaveProfile} 
                  disabled={!formData.fullName || formData.targetExams.length === 0} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full py-4 px-10 font-black transition-all duration-300 shadow-md hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-base"
                >
                  Lưu dữ liệu & Bắt đầu <ArrowRight className="w-5 h-5"/>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Slide-over Notifications */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 dark:bg-black/50 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-sm h-full bg-slate-50 dark:bg-[#1E1E1E] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto flex flex-col animate-in slide-in-from-right border-l border-slate-200 dark:border-white/5">
            <div className="p-6 flex justify-between items-center sticky top-0 z-10 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-500 fill-indigo-500" /> Thông Báo</h2>
              <button onClick={() => setShowNotifications(false)} className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="p-4 flex-grow space-y-4">
              {activeAnnouncement ? (
                <div className="bg-white dark:bg-[#252525] p-5 rounded-3xl border border-slate-200 dark:border-transparent shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                  <AnnouncementRenderer text={activeAnnouncement} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Bell className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-bold text-sm">Hộp thư trống.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOT CHAT MẶC ĐỊNH */}
      <ChatOffline 
        userName={formData.fullName ? formData.fullName.split(' ').pop() || '' : ''} 
        avoid={showProfile || showOnboarding || showCalculatorModal} 
        hidden={!isAiEnabled} 
      />

    </div>
  )
}