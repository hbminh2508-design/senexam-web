'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  LogOut, User, MessageSquare,
  Settings, X, Sun, Moon, GraduationCap, Loader2, KeyRound,
  Bell, FolderOpen, Sparkles, Lock, Music2, ArrowRight, Calculator,
  FlaskConical, PlaySquare, Wand2, Palette, Target
} from 'lucide-react'

import { AnnouncementRenderer } from './_home/Announcement'
import { THEME_COLORS, DEFAULT_THEME_COLOR } from '@/app/components/modernTheme'
import type { Feature } from './_home/types'

const ChatOffline = dynamic(() => import('@/app/components/ChatOffline'), { ssr: false })
const LegacyHome = dynamic(() => import('./_home/LegacyHome'), {
  loading: () => <HomeLoading />,
})
const ModernHome = dynamic(() => import('./_home/ModernHome'), {
  loading: () => <HomeLoading />,
})

function HomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )
}

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

  // -- Giao diện mới (Beta) — cờ bật thử nghiệm, lưu theo tài khoản trên Supabase --
  const [newUiEnabled, setNewUiEnabled] = useState(false)
  const [newUiSaving, setNewUiSaving] = useState(false)
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_THEME_COLOR)
  const [themeColorSaving, setThemeColorSaving] = useState(false)
  const [uiDensity, setUiDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

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

  // Đồng bộ cờ Giao diện mới + màu chủ đề + mật độ/animation ra localStorage để các trang khác đọc nhanh
  useEffect(() => {
    localStorage.setItem('senexam_new_ui', newUiEnabled ? '1' : '0')
    localStorage.setItem('senexam_theme_color', themeColor)
    localStorage.setItem('senexam_density', uiDensity)
    localStorage.setItem('senexam_animations', animationsEnabled ? '1' : '0')
  }, [newUiEnabled, themeColor, uiDensity, animationsEnabled])

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
        setNewUiEnabled(!!profile.new_ui_enabled)
        setThemeColor(profile.theme_color || DEFAULT_THEME_COLOR)
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
    setUiDensity(localStorage.getItem('senexam_density') === 'compact' ? 'compact' : 'comfortable')
    setAnimationsEnabled(localStorage.getItem('senexam_animations') !== '0')
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

  const toggleNewUi = async () => {
    const next = !newUiEnabled
    setNewUiEnabled(next)
    setNewUiSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').update({ new_ui_enabled: next }).eq('id', user.id)
      if (error) {
        setNewUiEnabled(!next)
        alert('Không thể lưu cài đặt giao diện: ' + error.message)
      }
    }
    setNewUiSaving(false)
  }

  const changeThemeColor = async (colorKey: string) => {
    const prev = themeColor
    setThemeColor(colorKey)
    setThemeColorSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').update({ theme_color: colorKey }).eq('id', user.id)
      if (error) {
        setThemeColor(prev)
        alert('Không thể lưu màu chủ đề: ' + error.message)
      }
    }
    setThemeColorSaving(false)
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
    { key: 'trial', label: 'Tính năng thử nghiệm', desc: 'AI tự đọc PDF và tạo đề tương tác để luyện tập.', icon: Wand2, color: 'amber', onSelect: () => router.push('/tinhnangthunghiem') },
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

  const overlayActive = showOnboarding || showProfile || showCodeModal || showNotifications || showCalculatorModal
  const HomeComponent = newUiEnabled ? ModernHome : LegacyHome

  return (
    <>
      <HomeComponent
        router={router}
        userRole={userRole}
        formData={formData}
        isDark={isDark}
        toggleTheme={toggleTheme}
        unreadCount={unreadCount}
        setShowNotifications={setShowNotifications}
        setShowProfile={setShowProfile}
        showFeatureMenu={showFeatureMenu}
        setShowFeatureMenu={setShowFeatureMenu}
        FEATURES={FEATURES as unknown as Feature[]}
        activeAnnouncement={activeAnnouncement}
        studentHistoryList={studentHistoryList}
        setShowCodeModal={setShowCodeModal}
        overlayActive={overlayActive}
        themeColor={themeColor}
        density={uiDensity}
        animationsEnabled={animationsEnabled}
      />


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
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 ml-2">Thử nghiệm</h3>

                <div className="bg-slate-50 dark:bg-[#121212] rounded-3xl border border-slate-100 dark:border-transparent overflow-hidden">
                  <div className="flex items-center justify-between p-4.5">
                    <div className="flex items-center gap-4">
                      <Palette className="w-5 h-5 text-indigo-500" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">Giao diện mới (Beta)</p>
                        <p className="text-[11px] font-medium text-slate-500">Nhẹ hơn, tải nhanh hơn. Đang thử nghiệm trước khi ra mắt cho mọi người.</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleNewUi}
                      disabled={newUiSaving}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${newUiEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'} disabled:opacity-60`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${newUiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {newUiEnabled && (
                    <div className="p-4.5 pt-0 space-y-5">
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Màu chủ đề</p>
                        <div className="flex flex-wrap gap-3">
                          {THEME_COLORS.map(c => (
                            <button
                              key={c.key}
                              onClick={() => changeThemeColor(c.key)}
                              disabled={themeColorSaving}
                              title={c.label}
                              className={`w-8 h-8 rounded-full transition-all disabled:opacity-60 ${themeColor === c.key ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-offset-[#121212] dark:ring-white scale-110' : 'hover:scale-105'}`}
                              style={{ background: isDark ? c.dark : c.light }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Mật độ hiển thị</p>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1A1A1A] rounded-xl p-1 w-fit">
                          <button
                            onClick={() => setUiDensity('comfortable')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${uiDensity === 'comfortable' ? 'bg-white dark:bg-[#2A2A2A] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                          >
                            Thoải mái
                          </button>
                          <button
                            onClick={() => setUiDensity('compact')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${uiDensity === 'compact' ? 'bg-white dark:bg-[#2A2A2A] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                          >
                            Gọn
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">Hiệu ứng chuyển động</p>
                          <p className="text-[11px] font-medium text-slate-500">Tắt để mượt hơn trên máy yếu</p>
                        </div>
                        <button onClick={() => setAnimationsEnabled(v => !v)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${animationsEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'}`}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${animationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  )}
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

    </>
  )
}