'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  LogOut, User, MessageSquare,
  Settings, X, Sun, Moon, GraduationCap, Loader2, KeyRound,
  Bell, FolderOpen, Sparkles, Lock, Music2, ArrowRight, Calculator,
  FlaskConical, PlaySquare, Wand2, Palette, Target, RefreshCw, Rocket, CheckCircle2, Crown
} from 'lucide-react'

import { AnnouncementRenderer } from './_home/Announcement'
import ModernLoading from '@/app/components/ModernLoading'
import CrossfadeIcon from '@/app/components/CrossfadeIcon'
import { THEME_COLORS, DEFAULT_THEME_COLOR, getModernThemeVars } from '@/app/components/modernTheme'
import { UI_PREFS_CHANGED_EVENT } from '@/app/components/useNewUiPrefs'
import { fetchSystemRelease, isNewerVersion, CURRENT_APP_VERSION, getAckedVersion, ackVersion } from '@/lib/systemRelease'
import type { Feature } from './_home/types'

const ChatOffline = dynamic(() => import('@/app/components/ChatOffline'), { ssr: false })
// `loading` is intentionally omitted here: both chunks are warmed up manually
// (see the prefetch effect below) well before `isDataLoading` clears, so this
// fallback would otherwise flash a second, visually different loading screen
// right after the one below resolves.
const LegacyHome = dynamic(() => import('./_home/LegacyHome'))
const ModernHome = dynamic(() => import('./_home/ModernHome'))

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
  const [isVip, setIsVip] = useState(false)
  
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
  const [notifications, setNotifications] = useState<SysNotification[]>([])

  // -- Modal Exam Code States --
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const examCodeInputRefs = useRef<Array<HTMLInputElement | null>>([])

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

  // -- Chương trình Beta: tham gia bằng cách trả lời đúng 2 câu hỏi --
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [showBetaJoinModal, setShowBetaJoinModal] = useState(false)
  const [betaAnswer1, setBetaAnswer1] = useState('')
  const [betaAnswer2, setBetaAnswer2] = useState('')
  const [betaJoinError, setBetaJoinError] = useState('')
  const [betaJoinSaving, setBetaJoinSaving] = useState(false)

  const normalizeAnswer = (s: string) => s.trim().toLowerCase().normalize('NFC')

  const handleSubmitBetaJoin = async () => {
    setBetaJoinError('')
    const correct1 = normalizeAnswer(betaAnswer1) === normalizeAnswer('Hoàng Bình Minh')
    const correct2 = normalizeAnswer(betaAnswer2) === '2007'
    if (!correct1 || !correct2) {
      setBetaJoinError('Câu trả lời chưa đúng, bạn thử lại nhé.')
      return
    }
    setBetaJoinSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('profiles').update({ is_beta_tester: true }).eq('id', user.id)
      if (error) throw error
      setIsBetaTester(true)
      localStorage.setItem('senexam_beta_tester', '1')
      window.dispatchEvent(new Event(UI_PREFS_CHANGED_EVENT))
      refreshPublishedVersion(true)
      setShowBetaJoinModal(false)
      setBetaAnswer1('')
      setBetaAnswer2('')
    } catch {
      setBetaJoinError('Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setBetaJoinSaving(false)
    }
  }

  const handleLeaveBeta = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Rời Beta thì cũng tự động quay về Giao diện cũ — Giao diện mới chỉ dành cho thành viên Beta
    await supabase.from('profiles').update({ is_beta_tester: false, new_ui_enabled: false }).eq('id', user.id)
    setIsBetaTester(false)
    setNewUiEnabled(false)
    localStorage.setItem('senexam_beta_tester', '0')
    localStorage.setItem('senexam_new_ui', '0')
    window.dispatchEvent(new Event(UI_PREFS_CHANGED_EVENT))
    refreshPublishedVersion(false)
  }

  // -- Phiên bản đang hiển thị: ưu tiên bản đã công bố trên kênh của người dùng (cập nhật
  // ngay khi Admin đẩy version mới, không phụ thuộc build tĩnh của package.json) --
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null)
  const displayVersion = publishedVersion || CURRENT_APP_VERSION

  const refreshPublishedVersion = async (betaTester: boolean) => {
    const release = await fetchSystemRelease()
    if (!release) return
    const channelVersion = betaTester && release.beta_published ? release.beta_version : (release.stable_published ? release.stable_version : null)
    setPublishedVersion(channelVersion)
  }

  // -- Kiểm tra cập nhật phiên bản mới do Admin đẩy ra (theo đúng kênh Beta/Chính thức) --
  const [updateCheckState, setUpdateCheckState] = useState<'idle' | 'checking' | 'up_to_date' | 'available'>('idle')
  const [latestReleaseInfo, setLatestReleaseInfo] = useState<{ version: string; changelog: string } | null>(null)

  const handleCheckForUpdate = async () => {
    setUpdateCheckState('checking')
    const release = await fetchSystemRelease()
    const channelVersion = isBetaTester ? release?.beta_version : release?.stable_version
    const channelChangelog = isBetaTester ? release?.beta_changelog : release?.stable_changelog
    const channelPublished = isBetaTester ? release?.beta_published : release?.stable_published
    const acked = getAckedVersion()

    if (release && channelPublished && channelVersion) {
      setPublishedVersion(channelVersion)
    }

    if (
      release && channelPublished && channelVersion &&
      isNewerVersion(CURRENT_APP_VERSION, channelVersion) &&
      channelVersion !== acked
    ) {
      setLatestReleaseInfo({ version: channelVersion, changelog: channelChangelog || '' })
      setUpdateCheckState('available')
    } else {
      setLatestReleaseInfo(null)
      setUpdateCheckState('up_to_date')
    }
  }

  const handleApplyUpdate = () => {
    if (latestReleaseInfo) ackVersion(latestReleaseInfo.version)
    window.location.reload()
  }

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

  // Khi mở hộp Thông báo, đánh dấu đã đọc toàn bộ và ghi lại vào localStorage
  // (chưa có bảng lưu trạng thái đọc theo từng người dùng trên Supabase nên dùng localStorage)
  useEffect(() => {
    if (!showNotifications) return
    setNotifications(prev => {
      if (!prev.some(n => !n.read)) return prev
      const prevRead: string[] = JSON.parse(localStorage.getItem('senexam_read_notifications') || '[]')
      const merged = Array.from(new Set([...prevRead, ...prev.map(n => n.id)]))
      localStorage.setItem('senexam_read_notifications', JSON.stringify(merged))
      return prev.map(n => ({ ...n, read: true }))
    })
  }, [showNotifications])

  // Đồng bộ cờ Giao diện mới + màu chủ đề + mật độ/animation ra localStorage để các trang khác đọc nhanh
  useEffect(() => {
    localStorage.setItem('senexam_new_ui', newUiEnabled ? '1' : '0')
    localStorage.setItem('senexam_theme_color', themeColor)
    localStorage.setItem('senexam_density', uiDensity)
    localStorage.setItem('senexam_animations', animationsEnabled ? '1' : '0')
    window.dispatchEvent(new Event(UI_PREFS_CHANGED_EVENT))
  }, [newUiEnabled, themeColor, uiDensity, animationsEnabled])

  // ============================================================================
  // INITIALIZATION & EFFECTS
  // ============================================================================

  // Warm up both Home chunks in parallel with the profile/data fetch below, so
  // whichever one ends up rendered (newUiEnabled resolves partway through that
  // fetch) is already cached by the time isDataLoading clears — otherwise
  // next/dynamic's own loading fallback flashes a second loading screen right
  // after this one.
  useEffect(() => {
    import('./_home/LegacyHome')
    import('./_home/ModernHome')
  }, [])

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
        setIsVip(!!profile.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now())
        // Giao diện mới chỉ dành cho thành viên Beta — nếu tài khoản cũ từng bật trước khi
        // có luật này mà chưa tham gia Beta, tự động đưa về Giao diện cũ để đồng bộ đúng luật.
        const effectiveNewUi = !!profile.new_ui_enabled && !!profile.is_beta_tester
        setNewUiEnabled(effectiveNewUi)
        if (profile.new_ui_enabled && !profile.is_beta_tester) {
          supabase.from('profiles').update({ new_ui_enabled: false }).eq('id', user.id).then(() => {})
        }
        setThemeColor(profile.theme_color || DEFAULT_THEME_COLOR)
        setIsBetaTester(!!profile.is_beta_tester)
        localStorage.setItem('senexam_beta_tester', profile.is_beta_tester ? '1' : '0')
        localStorage.setItem('senexam_new_ui', effectiveNewUi ? '1' : '0')
        refreshPublishedVersion(!!profile.is_beta_tester)
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

      // Fetch Thông báo (Announcements) do Admin phát — banner chính chỉ lấy cái mới nhất,
      // còn hộp Thông báo (góc phải) hiển thị toàn bộ các thông báo đang hoạt động
      const nowISO = new Date().toISOString()
      const { data: notifRows } = await supabase
        .from('announcements')
        .select('id, content, created_at')
        .eq('is_active', true)
        .or(`start_time.is.null,start_time.lte.${nowISO}`)
        .or(`end_time.is.null,end_time.gte.${nowISO}`)
        .order('created_at', { ascending: false })

      if (notifRows && notifRows.length > 0) {
        setActiveAnnouncement(notifRows[0].content)
        const readIds: string[] = JSON.parse(localStorage.getItem('senexam_read_notifications') || '[]')
        const readSet = new Set(readIds)
        setNotifications(notifRows.map(row => ({
          id: row.id,
          title: 'Thông báo từ SenExam',
          message: row.content,
          type: 'info' as const,
          time: new Date(row.created_at).toLocaleString('vi-VN'),
          read: readSet.has(row.id),
        })))
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
    // Chỉ người dùng đã tham gia Chương trình Beta mới được bật Giao diện mới
    if (next && !isBetaTester) {
      setShowBetaJoinModal(true)
      return
    }
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

  // -- OTP-style Exam Code Box Handlers --
  const handleExamCodeBoxChange = (index: number, rawValue: string) => {
    const char = rawValue.trim().slice(-1).toUpperCase()
    const chars = examCode.padEnd(6, ' ').split('')
    chars[index] = char || ' '
    const next = chars.join('').replace(/\s+$/, '')
    setExamCode(next)
    if (char && index < 5) {
      examCodeInputRefs.current[index + 1]?.focus()
    }
  }

  const handleExamCodeBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !examCode[index] && index > 0) {
      examCodeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleExamCodeBoxPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (!pasted) return
    setExamCode(pasted)
    const focusIndex = Math.min(pasted.length, 5)
    examCodeInputRefs.current[focusIndex]?.focus()
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
    { key: 'vip', label: isVip ? 'Thành viên VIP' : 'Nâng cấp VIP', desc: 'Không quảng cáo, tài liệu riêng, cập nhật sớm hơn.', icon: Crown, color: 'amber', onSelect: () => router.push('/vip') },
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
    // Always the same shared screen regardless of newUiEnabled: that flag
    // only settles partway through the fetch above, so branching this gate
    // on it made the loading screen visibly switch style mid-load (legacy →
    // modern) for Beta users — the "duplicated loading screen" bug.
    return (
      <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải không gian SenExam..." />
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
        isBetaTester={isBetaTester}
      />


      {/* ========================================================= */}
      {/* 🌟 OVERLAYS: MODALS & SIDE PANELS V2.0 */}
      {/* ========================================================= */}

      {/* 1. Modal Nhập Code Đề Private */}
      {showCodeModal && (
        <div
          className={newUiEnabled ? 'fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'}
          style={newUiEnabled ? { ...getModernThemeVars(themeColor, isDark), background: 'rgba(0,0,0,0.45)' } as React.CSSProperties : undefined}
        >
           <div
             className={newUiEnabled ? 'ms-glass rounded-[2.5rem] w-full max-w-sm p-8 relative border' : 'bg-white dark:bg-[#1E1E1E] rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative border border-slate-100 dark:border-white/5'}
             style={newUiEnabled ? { borderColor: 'var(--border)', color: 'var(--text)' } : undefined}
           >
              <button onClick={() => setShowCodeModal(false)} className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"><X className="w-5 h-5" style={newUiEnabled ? { color: 'var(--text-muted)' } : { color: '#64748b' }}/></button>

              <div
                className={newUiEnabled ? 'w-16 h-16 rounded-[1.2rem] flex items-center justify-center mb-6 border' : 'w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-[1.2rem] flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-500/20 shadow-inner'}
                style={newUiEnabled ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } : undefined}
              >
                <KeyRound className={newUiEnabled ? 'w-8 h-8' : 'w-8 h-8 text-indigo-600 dark:text-indigo-400'} style={newUiEnabled ? { color: 'var(--accent)' } : undefined}/>
              </div>

              <h3 className={newUiEnabled ? 'text-2xl font-black mb-2' : 'text-2xl font-black mb-2 text-slate-900 dark:text-white'}>Truy cập đề ẩn</h3>
              <p className={newUiEnabled ? 'text-sm mb-6 font-medium leading-relaxed' : 'text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium leading-relaxed'} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>Nhập mã Code do giáo viên cung cấp để giải khóa đề thi bảo mật.</p>

              <div className="flex items-center justify-between gap-2 mb-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { examCodeInputRefs.current[i] = el }}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={examCode[i] ?? ''}
                    onChange={(e) => handleExamCodeBoxChange(i, e.target.value)}
                    onKeyDown={(e) => handleExamCodeBoxKeyDown(i, e)}
                    onPaste={handleExamCodeBoxPaste}
                    className={newUiEnabled ? 'w-full aspect-square min-w-0 border-2 rounded-2xl font-black text-center text-xl outline-none transition-all uppercase' : 'w-full aspect-square min-w-0 bg-slate-50 dark:bg-[#121212] border-transparent focus:bg-white dark:focus:bg-[#121212] border-2 focus:border-indigo-500 rounded-2xl text-slate-900 dark:text-white font-black text-center text-xl outline-none transition-all uppercase shadow-inner'}
                    style={newUiEnabled ? { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' } : undefined}
                    onFocus={newUiEnabled ? (e) => { e.currentTarget.style.borderColor = 'var(--accent)' } : undefined}
                    onBlur={newUiEnabled ? (e) => { e.currentTarget.style.borderColor = 'var(--border)' } : undefined}
                  />
                ))}
              </div>

              <button
                onClick={handleJoinHiddenExam}
                disabled={codeLoading || !examCode}
                className={newUiEnabled ? 'rounded-2xl w-full py-4 font-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-base' : 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl w-full py-4 font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-base'}
                style={newUiEnabled ? { background: 'var(--accent)', color: '#fff' } : undefined}
              >
                {codeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mở khóa phòng thi'}
              </button>
           </div>
        </div>
      )}

      {/* 1.5. Modal tham gia Chương trình Beta — trả lời 2 câu hỏi để mở khóa */}
      {showBetaJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative border border-slate-100 dark:border-white/5">
            <button onClick={() => { setShowBetaJoinModal(false); setBetaJoinError(''); }} className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] transition-colors"><X className="w-5 h-5 text-slate-500"/></button>

            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-[1.2rem] flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-500/20 shadow-inner">
              <Rocket className="w-8 h-8 text-indigo-600 dark:text-indigo-400"/>
            </div>

            <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Tham gia Beta</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium leading-relaxed">Trả lời đúng 2 câu hỏi nhỏ để mở khóa chương trình thử nghiệm.</p>

            <div className="space-y-4 mb-2">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Người tạo ra trang web này là ai?</label>
                <input type="text" value={betaAnswer1} onChange={(e) => setBetaAnswer1(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border-transparent focus:bg-white dark:focus:bg-[#121212] border-2 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Người tạo ra web này sinh năm bao nhiêu?</label>
                <input type="text" value={betaAnswer2} onChange={(e) => setBetaAnswer2(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121212] border-transparent focus:bg-white dark:focus:bg-[#121212] border-2 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none transition-all shadow-inner" />
              </div>
            </div>

            {betaJoinError && <p className="text-xs font-bold text-rose-500 mb-4">{betaJoinError}</p>}

            <button
              onClick={handleSubmitBetaJoin}
              disabled={betaJoinSaving || !betaAnswer1.trim() || !betaAnswer2.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl w-full py-4 font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 text-base mt-2"
            >
              {betaJoinSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác nhận tham gia'}
            </button>
          </div>
        </div>
      )}

      {/* 2. Slide-over Profile / Cài đặt hệ thống */}
      {showProfile && (
        <div
          className={`fixed inset-0 z-50 flex justify-end bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm transition-all duration-300`}
          style={newUiEnabled ? getModernThemeVars(themeColor, isDark) : undefined}
        >
          <div
            className={
              newUiEnabled
                ? 'ms-glass w-full max-w-md my-4 mr-4 h-[calc(100%-2rem)] rounded-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right border'
                : 'w-full max-w-md h-full bg-white dark:bg-[#1E1E1E] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto flex flex-col animate-in slide-in-from-right border-l border-slate-200 dark:border-white/5'
            }
            style={newUiEnabled ? { borderColor: 'var(--border)', color: 'var(--text)' } : undefined}
          >
            <div
              className={
                newUiEnabled
                  ? 'p-6 flex justify-between items-center sticky top-0 z-10 backdrop-blur-xl border-b'
                  : 'p-6 flex justify-between items-center sticky top-0 z-10 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/5'
              }
              style={newUiEnabled ? { background: 'color-mix(in srgb, var(--glass-surface) 85%, transparent)', borderColor: 'var(--border)' } : undefined}
            >
              <h2 className={newUiEnabled ? 'text-xl font-black flex items-center gap-2' : 'text-xl font-black text-slate-900 dark:text-white flex items-center gap-2'} style={newUiEnabled ? { color: 'var(--text)' } : undefined}>
                <Settings className={newUiEnabled ? 'w-5 h-5' : 'w-5 h-5 text-indigo-500'} style={newUiEnabled ? { color: 'var(--accent)' } : undefined} /> Cài đặt
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
                      <CrossfadeIcon show={isDark} first={<Moon className="w-5 h-5 text-indigo-500" />} second={<Sun className="w-5 h-5 text-orange-500" />} />
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
                        <p className="text-[11px] font-medium text-slate-500">
                          {isBetaTester ? 'Material Glass 2.0 — nhẹ, đẹp, có thể quay lại giao diện cũ bất cứ lúc nào.' : 'Chỉ dành cho thành viên Beta — tham gia Beta ở mục trên để mở khóa.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleNewUi}
                      disabled={newUiSaving}
                      title={!isBetaTester ? 'Tham gia Beta để mở khóa' : undefined}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${newUiEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#333333]'} disabled:opacity-60 ${!isBetaTester ? 'opacity-50' : ''}`}
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
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 ml-2">Chương trình Beta</h3>
                <div className="bg-slate-50 dark:bg-[#121212] rounded-3xl border border-slate-100 dark:border-transparent overflow-hidden p-4.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <Rocket className="w-5 h-5 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          Người dùng Beta
                          {isBetaTester && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 tracking-widest">BETA</span>}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500">Nhận bản cập nhật thử nghiệm sớm hơn, có tick BETA cạnh tên ứng dụng.</p>
                      </div>
                    </div>
                    {isBetaTester ? (
                      <button onClick={handleLeaveBeta} className="shrink-0 text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">Rời Beta</button>
                    ) : (
                      <button onClick={() => setShowBetaJoinModal(true)} className="shrink-0 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors">Tham gia Beta</button>
                    )}
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
            <div
              className={
                newUiEnabled
                  ? 'p-6 border-t flex flex-col gap-3 rounded-b-2xl'
                  : 'p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#121212] flex flex-col gap-3'
              }
              style={newUiEnabled ? { borderColor: 'var(--border)', background: 'var(--surface)' } : undefined}
            >
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

              <p
                className={newUiEnabled ? 'text-center text-[11px] font-medium pt-1' : 'text-center text-[11px] font-medium text-slate-400 dark:text-slate-600 pt-1'}
                style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}
              >
                Phiên bản {displayVersion}
              </p>

              {/* Kiểm tra cập nhật */}
              <div className="pt-1">
                {updateCheckState === 'available' && latestReleaseInfo ? (
                  <div
                    className={newUiEnabled ? 'rounded-2xl p-4 space-y-3' : 'rounded-2xl p-4 space-y-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30'}
                    style={newUiEnabled ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4" style={newUiEnabled ? { color: 'var(--accent)' } : undefined} />
                      <p className={newUiEnabled ? 'font-black text-sm' : 'font-black text-sm text-emerald-700 dark:text-emerald-400'} style={newUiEnabled ? { color: 'var(--accent)' } : undefined}>
                        Có bản cập nhật mới: v{latestReleaseInfo.version}
                      </p>
                    </div>
                    {latestReleaseInfo.changelog && (
                      <p className={newUiEnabled ? 'text-xs whitespace-pre-wrap' : 'text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-300'} style={newUiEnabled ? { color: 'var(--text-muted)' } : undefined}>
                        {latestReleaseInfo.changelog}
                      </p>
                    )}
                    <button
                      onClick={handleApplyUpdate}
                      className={newUiEnabled ? 'w-full rounded-xl py-2.5 font-black text-xs flex items-center justify-center gap-2 text-white' : 'w-full rounded-xl py-2.5 font-black text-xs flex items-center justify-center gap-2 text-white bg-emerald-600 hover:bg-emerald-700'}
                      style={newUiEnabled ? { background: 'var(--accent)' } : undefined}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Cập nhật ngay
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCheckForUpdate}
                    disabled={updateCheckState === 'checking'}
                    className={newUiEnabled ? 'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold disabled:opacity-60 border' : 'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60'}
                    style={newUiEnabled ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : undefined}
                  >
                    {updateCheckState === 'checking' ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra...</>
                    ) : updateCheckState === 'up_to_date' ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Đã là bản mới nhất</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Kiểm tra cập nhật</>
                    )}
                  </button>
                )}
              </div>
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

      {/* 4. Slide-over Notifications — danh sách thông báo do Admin phát, đồng bộ 1 style xuyên suốt Chính thức/Beta */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-50 flex justify-end backdrop-blur-sm transition-all duration-300"
          style={newUiEnabled ? { ...getModernThemeVars(themeColor, isDark), background: 'rgba(0,0,0,0.35)' } as React.CSSProperties : { background: 'rgba(15,23,42,0.2)' }}
        >
          <div
            className={newUiEnabled ? 'w-full max-w-sm h-full overflow-y-auto flex flex-col animate-in slide-in-from-right border-l' : 'w-full max-w-sm h-full bg-slate-50 dark:bg-[#1E1E1E] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto flex flex-col animate-in slide-in-from-right border-l border-slate-200 dark:border-white/5'}
            style={newUiEnabled ? { background: 'var(--surface)', borderColor: 'var(--border)' } : undefined}
          >
            <div
              className={newUiEnabled ? 'p-6 flex justify-between items-center sticky top-0 z-10 backdrop-blur-xl border-b' : 'p-6 flex justify-between items-center sticky top-0 z-10 bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5'}
              style={newUiEnabled ? { background: 'color-mix(in srgb, var(--surface) 85%, transparent)', borderColor: 'var(--border)' } : undefined}
            >
              <h2 className={newUiEnabled ? 'text-xl font-black flex items-center gap-2' : 'text-xl font-black text-slate-900 dark:text-white flex items-center gap-2'} style={newUiEnabled ? { color: 'var(--text)' } : undefined}>
                <Bell className={newUiEnabled ? 'w-5 h-5' : 'w-5 h-5 text-indigo-500 fill-indigo-500'} style={newUiEnabled ? { color: 'var(--accent)' } : undefined} /> Thông Báo
              </h2>
              <button onClick={() => setShowNotifications(false)} className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" style={newUiEnabled ? { color: 'var(--text-muted)' } : { color: '#64748b' }} />
              </button>
            </div>

            <div className="p-4 flex-grow space-y-4">
              {notifications.length > 0 ? (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={newUiEnabled ? 'p-5 rounded-3xl relative overflow-hidden border' : 'bg-white dark:bg-[#252525] p-5 rounded-3xl border border-slate-200 dark:border-transparent shadow-sm relative overflow-hidden'}
                    style={newUiEnabled ? { background: 'var(--bg)', borderColor: 'var(--border)' } : undefined}
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: newUiEnabled ? 'var(--accent)' : '#3b82f6' }} />
                    {!n.read && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full" style={{ background: newUiEnabled ? 'var(--accent)' : '#3b82f6' }} />
                    )}
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: newUiEnabled ? 'var(--text-muted)' : '#94a3b8' }}>{n.time}</p>
                    <AnnouncementRenderer text={n.message} />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center" style={{ color: newUiEnabled ? 'var(--text-muted)' : '#94a3b8' }}>
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