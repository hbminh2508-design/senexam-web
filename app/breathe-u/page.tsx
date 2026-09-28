'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BreatheLogo,
  SplashIllustration,
  LungsComparisonIllustration,
  ArticleHeroIllustration,
  ChallengeHeroIllustration,
  CommitmentHeroIllustration,
  CampusMapGraphic,
} from './components/BreatheIllustrations'
import {
  KNOWLEDGE_ARTICLES,
  CHALLENGES,
  BADGES,
  COMMUNITY_POSTS,
  MAP_MARKERS,
  INITIAL_REPORTS,
  type KnowledgeArticle,
  type Challenge,
  type BadgeItem,
  type CommunityPost,
  type MapMarker,
  type ViolationReport,
} from './data/breatheData'
import {
  Home,
  BookOpen,
  Award,
  AlertTriangle,
  Users,
  User,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Bell,
  Search,
  Bookmark,
  Share2,
  Heart,
  MessageSquare,
  Sparkles,
  Camera,
  ShieldCheck,
  Smartphone,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  HelpCircle,
  FileText,
  Clock,
  Plus,
  Compass,
  Check,
  Layers,
} from 'lucide-react'

// Định nghĩa mã của 14 màn hình
export type ScreenId =
  | '1_splash'
  | '2_login'
  | '3_register'
  | '4_home'
  | '5_knowledge'
  | '6_article'
  | '7_challenge'
  | '8_commitment'
  | '9_report'
  | '10_community'
  | '11_map'
  | '12_profile'
  | '13_achievement'
  | '14_settings'

const SCREEN_NAMES: Record<ScreenId, string> = {
  '1_splash': '1. Splash screen (khởi động)',
  '2_login': '2. Đăng nhập',
  '3_register': '3. Đăng ký',
  '4_home': '4. Trang chủ',
  '5_knowledge': '5. Trang kiến thức',
  '6_article': '6. Trang bài viết',
  '7_challenge': '7. Trang thử thách',
  '8_commitment': '8. Trang cam kết',
  '9_report': '9. Trang phản ánh',
  '10_community': '10. Trang cộng đồng',
  '11_map': '11. Trang bản đồ',
  '12_profile': '12. Trang cá nhân',
  '13_achievement': '13. Trang thành tích',
  '14_settings': '14. Trang cài đặt',
}

export default function BreatheUApplication() {
  // Trạng thái màn hình hiện tại
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('1_splash')
  // Lịch sử điều hướng để bấm Back (<) quay lại đúng màn trước đó
  const [history, setHistory] = useState<ScreenId[]>([])

  // Chế độ khung điện thoại (trên máy tính)
  const [isPhoneFrame, setIsPhoneFrame] = useState(true)
  // Chế độ tối
  const [isDark, setIsDark] = useState(false)

  // Dữ liệu người dùng & ứng dụng
  const [user, setUser] = useState({
    name: 'Nguyễn Minh Anh',
    email: 'minhanh@vnu.edu.vn',
    studentId: '22028912',
    school: 'Sinh viên ĐHQGHN',
    points: 320,
    rank: 12,
    badgesCount: 4,
    hasCommitted: false,
    committedAt: '',
    rememberLogin: true,
  })

  // State biểu mẫu đăng nhập / đăng ký
  const [loginEmail, setLoginEmail] = useState('minhanh@vnu.edu.vn')
  const [loginPass, setLoginPass] = useState('123456')
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regPassConfirm, setRegPassConfirm] = useState('')
  const [regAgreed, setRegAgreed] = useState(true)

  // State bài viết kiến thức
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'traditional' | 'vape'>('all')
  const [activeArticle, setActiveArticle] = useState<KnowledgeArticle>(KNOWLEDGE_ARTICLES[0])
  const [isBookmarked, setIsBookmarked] = useState(false)

  // State thử thách 7 ngày
  const [challengeTab, setChallengeTab] = useState<'active' | 'joined'>('active')
  const [challengeDays, setChallengeDays] = useState([true, true, true, false, false, false, false])
  const [checkedToday, setCheckedToday] = useState(false)

  // State cam kết
  const [commitName, setCommitName] = useState('Nguyễn Minh Anh')
  const [commitSuccess, setCommitSuccess] = useState(false)

  // State phản ánh
  const [reportTab, setReportTab] = useState<'create' | 'history'>('create')
  const [reportLocation, setReportLocation] = useState('Khuôn viên Nhà E3 - UET (144 Xuân Thủy)')
  const [reportType, setReportType] = useState('Hút thuốc lá điện tử (Pod / Vape)')
  const [reportDesc, setReportDesc] = useState('')
  const [reportsList, setReportsList] = useState<ViolationReport[]>(INITIAL_REPORTS)
  const [reportSuccess, setReportSuccess] = useState(false)

  // State cộng đồng
  const [communityTab, setCommunityTab] = useState<'posts' | 'events' | 'clubs'>('posts')
  const [posts, setPosts] = useState<CommunityPost[]>(COMMUNITY_POSTS)

  // State bản đồ
  const [mapCampus, setMapCampus] = useState<'cau_giay' | 'hoa_lac'>('cau_giay')
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>('m1')
  const [mapSearch, setMapSearch] = useState('')

  // State cài đặt
  const [notiEnabled, setNotiEnabled] = useState(true)

  // Hàm điều hướng
  const navigateTo = (screen: ScreenId) => {
    setHistory((prev) => [...prev, currentScreen])
    setCurrentScreen(screen)
  }

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory((old) => old.slice(0, -1))
      setCurrentScreen(prev)
    } else {
      setCurrentScreen('4_home')
    }
  }

  // Xử lý đăng nhập
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!loginEmail.trim() || !loginPass.trim()) {
      alert('Vui lòng nhập Email sinh viên và Mật khẩu.')
      return
    }
    const namePart = loginEmail.split('@')[0]
    setUser((prev) => ({
      ...prev,
      name: prev.name || namePart,
      email: loginEmail,
    }))
    navigateTo('4_home')
  }

  // Đăng nhập demo nhanh 1-click
  const handleQuickDemoLogin = () => {
    setLoginEmail('minhanh@vnu.edu.vn')
    setLoginPass('123456')
    navigateTo('4_home')
  }

  // Xử lý đăng ký
  const handleRegister = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!regName.trim() || !regEmail.trim() || !regPass.trim()) {
      alert('Vui lòng điền đầy đủ thông tin đăng ký.')
      return
    }
    if (regPass !== regPassConfirm) {
      alert('Mật khẩu xác nhận không khớp.')
      return
    }
    if (!regAgreed) {
      alert('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật.')
      return
    }
    setUser((prev) => ({
      ...prev,
      name: regName.trim(),
      email: regEmail.trim(),
    }))
    alert('Đăng ký tài khoản BREATHE U thành công! Chào mừng bạn gia nhập thế hệ không khói thuốc.')
    navigateTo('4_home')
  }

  // Điểm danh thử thách
  const handleCheckInChallenge = () => {
    if (checkedToday) return
    setChallengeDays((prev) => {
      const next = [...prev]
      const firstUnchecked = next.findIndex((d) => !d)
      if (firstUnchecked !== -1) next[firstUnchecked] = true
      return next
    })
    setCheckedToday(true)
    setUser((prev) => ({ ...prev, points: prev.points + 20 }))
    alert('🎉 Điểm danh thành công! Bạn nhận được +20 Điểm Breathe hôm nay!')
  }

  // Gửi cam kết
  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitName.trim()) {
      alert('Vui lòng nhập họ và tên của bạn.')
      return
    }
    setCommitSuccess(true)
    setUser((prev) => ({
      ...prev,
      hasCommitted: true,
      committedAt: new Date().toLocaleDateString('vi-VN'),
      points: prev.points + 50,
    }))
  }

  // Gửi phản ánh
  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault()
    const newRep: ViolationReport = {
      id: `rep-${Date.now()}`,
      locationName: reportLocation,
      violationType: reportType,
      description: reportDesc || 'Phát hiện hành vi vi phạm quy chế không khói thuốc.',
      timestamp: 'Vừa xong',
      status: 'pending',
    }
    setReportsList((prev) => [newRep, ...prev])
    setReportDesc('')
    setReportSuccess(true)
    setUser((prev) => ({ ...prev, points: prev.points + 30 }))
    setTimeout(() => setReportSuccess(false), 4000)
    setReportTab('history')
  }

  // Thả tim bài viết cộng đồng
  const handleLikePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked
          return {
            ...p,
            isLiked,
            likes: isLiked ? p.likes + 1 : p.likes - 1,
          }
        }
        return p
      })
    )
  }

  // Lọc bài viết
  const filteredArticles = KNOWLEDGE_ARTICLES.filter((a) => {
    if (selectedCategory === 'all') return true
    return a.category === selectedCategory || a.category === 'all'
  })

  // Điểm đánh dấu bản đồ theo cơ sở & tìm kiếm
  const filteredMarkers = MAP_MARKERS.filter((m) => {
    const matchCampus = m.campus === mapCampus
    const matchSearch = !mapSearch.trim() || m.name.toLowerCase().includes(mapSearch.toLowerCase()) || m.address.toLowerCase().includes(mapSearch.toLowerCase())
    return matchCampus && matchSearch
  })
  const currentMarker = MAP_MARKERS.find((m) => m.id === selectedMarkerId) || MAP_MARKERS[0]

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#080C14] text-slate-100' : 'bg-slate-100 text-slate-900'} py-4 px-2 sm:px-4 font-sans select-none transition-colors duration-200`}>
      
      {/* THANH CÔNG CỤ ĐIỀU KHIỂN DÙNG THỬ (TOP BAR CONTROLS) */}
      <header className="max-w-5xl mx-auto mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-black/10 dark:border-white/10 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BreatheLogo className="w-8 h-8 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">BREATHE U</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                K70P-ME2 ĐHQGHN
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Sản phẩm dùng thử 14 màn hình tương tác theo đúng bản phác thảo 2026
            </p>
          </div>
        </div>

        {/* BỘ CHUYỂN MÀN HÌNH NHANH (QUICK SCREEN SELECTOR) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1 text-xs border border-black/5 dark:border-white/5">
            <Layers className="h-3.5 w-3.5 text-emerald-500" />
            <select
              value={currentScreen}
              onChange={(e) => navigateTo(e.target.value as ScreenId)}
              className="bg-transparent font-bold text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {Object.entries(SCREEN_NAMES).map(([key, name]) => (
                <option key={key} value={key} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Nút chuyển đổi khung điện thoại / toàn màn hình */}
          <button
            type="button"
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title="Bật/tắt khung điện thoại mô phỏng"
          >
            {isPhoneFrame ? <Maximize2 className="h-3.5 w-3.5 text-sky-500" /> : <Smartphone className="h-3.5 w-3.5 text-emerald-500" />}
            <span className="hidden md:inline">{isPhoneFrame ? 'Toàn màn hình' : 'Khung điện thoại'}</span>
          </button>

          {/* Toggle Sáng / Tối */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-amber-500"
            title="Đổi giao diện sáng/tối"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>

          <Link
            href="/new-dashboard"
            className="text-xs font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 px-2 py-1"
          >
            Về SenExam
          </Link>
        </div>
      </header>

      {/* KHUNG THIẾT BỊ ỨNG DỤNG (PHONE SHELL CONTAINER) */}
      <main className="flex justify-center items-start pb-8">
        <div
          className={`w-full transition-all duration-300 ${
            isPhoneFrame
              ? 'max-w-[420px] rounded-[44px] border-[10px] border-slate-800 dark:border-slate-700 shadow-[0_25px_70px_rgba(0,0,0,0.35)] overflow-hidden bg-white dark:bg-slate-900 relative ring-1 ring-black/10'
              : 'max-w-2xl rounded-3xl border border-black/10 dark:border-white/10 shadow-xl overflow-hidden bg-white dark:bg-slate-900'
          }`}
          style={{ minHeight: isPhoneFrame ? '820px' : '780px' }}
        >
          {/* TAI THỎ / DYNAMIC ISLAND CHO KHUNG ĐIỆN THOẠI */}
          {isPhoneFrame && (
            <div className="h-7 w-full bg-slate-800 dark:bg-slate-700 flex items-center justify-between px-6 text-[11px] font-semibold text-white select-none">
              <span>9:41</span>
              <div className="w-20 h-4 bg-black rounded-full" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">5G</span>
                <div className="w-5 h-2.5 border border-white rounded-sm p-0.5 flex items-center">
                  <div className="w-full h-full bg-white rounded-2xs" />
                </div>
              </div>
            </div>
          )}

          {/* NỘI DUNG 14 MÀN HÌNH TƯƠNG ỨNG */}
          <div className="relative flex flex-col justify-between" style={{ minHeight: isPhoneFrame ? '793px' : '750px' }}>

            {/* ========================================================================= */}
            {/* MÀN HÌNH 1: SPLASH SCREEN (KHỞI ĐỘNG)                                     */}
            {/* ========================================================================= */}
            {currentScreen === '1_splash' && (
              <div className="p-6 flex flex-col items-center justify-between flex-1 text-center bg-gradient-to-b from-emerald-50/60 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
                <div className="w-full flex justify-start">
                  <button type="button" onClick={() => navigateTo('4_home')} className="text-slate-400 hover:text-slate-600 p-1">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center space-y-3 mt-2">
                  <BreatheLogo className="w-20 h-20" />
                  <h1 className="text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
                    BREATHE U
                  </h1>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed uppercase tracking-wider">
                    Một thế hệ<br />Một môi trường<br />Không khói thuốc
                  </p>
                </div>

                {/* Tranh minh họa 3 sinh viên ĐHQGHN */}
                <div className="w-full my-4">
                  <SplashIllustration className="w-full h-64 drop-shadow-md rounded-2xl" />
                </div>

                {/* Nút bắt đầu */}
                <div className="w-full space-y-3 pb-4">
                  <button
                    type="button"
                    onClick={() => navigateTo('2_login')}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition"
                  >
                    Bắt đầu ngay
                  </button>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Cuộc thi &ldquo;Sáng tạo vì một thế hệ không khói thuốc&rdquo; 2026 – ĐHQGHN
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 2: ĐĂNG NHẬP                                                    */}
            {/* ========================================================================= */}
            {currentScreen === '2_login' && (
              <div className="p-6 flex flex-col justify-between flex-1 bg-white dark:bg-slate-900">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <BreatheLogo className="w-10 h-10" />
                    <div className="w-5" />
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Đăng nhập</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Tiếp tục để cùng xây dựng môi trường không khói thuốc
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4 pt-2">
                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email sinh viên</label>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="minhanh@vnu.edu.vn"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mật khẩu</label>
                      <div className="relative">
                        <input
                          type={showLoginPass ? 'text' : 'password'}
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          placeholder="Mật khẩu của bạn"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPass(!showLoginPass)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                        >
                          {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-600 dark:text-slate-400">Ghi nhớ đăng nhập</span>
                      </label>
                      <button type="button" onClick={() => alert('Vui lòng liên hệ ban quản trị để cấp lại mật khẩu sinh viên.')} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                        Quên mật khẩu?
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition"
                    >
                      Đăng nhập
                    </button>
                  </form>

                  {/* Nút dùng thử nhanh (Demo 1-Click) */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleQuickDemoLogin}
                      className="w-full py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                      Trải nghiệm ngay tài khoản mẫu (1-Click)
                    </button>
                  </div>
                </div>

                <div className="text-center pt-6 pb-2 text-xs text-slate-500 dark:text-slate-400">
                  Chưa có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => navigateTo('3_register')}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Đăng ký ngay
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 3: ĐĂNG KÝ (TẠO TÀI KHOẢN)                                       */}
            {/* ========================================================================= */}
            {currentScreen === '3_register' && (
              <div className="p-6 flex flex-col justify-between flex-1 bg-white dark:bg-slate-900">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <BreatheLogo className="w-10 h-10" />
                    <div className="w-5" />
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Tạo tài khoản</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Tham gia BREATHE U ngay hôm nay
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-3 pt-1">
                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Họ và tên</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nguyễn Minh Anh"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email sinh viên (@vnu.edu.vn)</label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="ten.sinhvien@vnu.edu.vn"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mật khẩu</label>
                      <input
                        type="password"
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="Mật khẩu tối thiểu 6 ký tự"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Xác nhận mật khẩu</label>
                      <input
                        type="password"
                        value={regPassConfirm}
                        onChange={(e) => setRegPassConfirm(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        required
                      />
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer pt-1 text-xs">
                      <input
                        type="checkbox"
                        checked={regAgreed}
                        onChange={(e) => setRegAgreed(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <span className="text-slate-600 dark:text-slate-400">
                        Tôi đồng ý với <span className="text-emerald-600 font-bold hover:underline">Điều khoản sử dụng</span> và <span className="text-emerald-600 font-bold hover:underline">Chính sách bảo mật</span>
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition mt-2"
                    >
                      Đăng ký
                    </button>
                  </form>
                </div>

                <div className="text-center pt-4 pb-2 text-xs text-slate-500 dark:text-slate-400">
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => navigateTo('2_login')}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Đăng nhập
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 4: TRANG CHỦ                                                    */}
            {/* ========================================================================= */}
            {currentScreen === '4_home' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                {/* Header người dùng */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center text-lg font-black text-emerald-700 dark:text-emerald-300">
                      MA
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-none">Xin chào,</p>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{user.name}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Thông báo mới: Bạn có 1 thử thách đang chờ điểm danh!')}
                    className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                  </button>
                </div>

                {/* Banner: Cùng nhau xây dựng ĐHQGHN không khói thuốc */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 shadow-md mb-5">
                  <div className="relative z-10 max-w-[210px] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      Chiến dịch 2026
                    </span>
                    <h2 className="text-sm sm:text-base font-black leading-tight">
                      Cùng nhau xây dựng ĐHQGHN không khói thuốc!
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateTo('8_commitment')}
                      className="mt-2 inline-flex items-center gap-1 bg-white text-emerald-800 text-[11px] font-black px-2.5 py-1.5 rounded-xl shadow-sm hover:bg-emerald-50 transition"
                    >
                      Ký cam kết ngay →
                    </button>
                  </div>
                  {/* Tranh vẽ minh họa góc banner */}
                  <div className="absolute right-0 bottom-0 w-36 h-28 opacity-90 pointer-events-none">
                    <SplashIllustration className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* 6 LỰA CHỌN CÔNG NĂNG CHÍNH (GRID ICONS) */}
                <div className="mb-5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Tính năng nổi bật
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* 1. Kiến thức */}
                    <button
                      type="button"
                      onClick={() => navigateTo('5_knowledge')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm mb-1.5">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Kiến thức</span>
                    </button>

                    {/* 2. Thử thách */}
                    <button
                      type="button"
                      onClick={() => navigateTo('7_challenge')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm mb-1.5">
                        <Award className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Thử thách</span>
                    </button>

                    {/* 3. Cam kết */}
                    <button
                      type="button"
                      onClick={() => navigateTo('8_commitment')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm mb-1.5">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Cam kết</span>
                    </button>

                    {/* 4. Phản ánh */}
                    <button
                      type="button"
                      onClick={() => navigateTo('9_report')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm mb-1.5">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Phản ánh</span>
                    </button>

                    {/* 5. Cộng đồng */}
                    <button
                      type="button"
                      onClick={() => navigateTo('10_community')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm mb-1.5">
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Cộng đồng</span>
                    </button>

                    {/* 6. Bản đồ */}
                    <button
                      type="button"
                      onClick={() => navigateTo('11_map')}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/30 hover:scale-105 transition shadow-2xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm mb-1.5">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Bản đồ</span>
                    </button>
                  </div>
                </div>

                {/* THÀNH TÍCH CÁ NHÂN */}
                <div
                  onClick={() => navigateTo('13_achievement')}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-emerald-50/50 dark:from-slate-800/80 dark:to-slate-800/40 p-4 cursor-pointer hover:border-emerald-500/50 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Thành tích cá nhân
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{user.points}</p>
                        <p className="text-[10px] font-bold text-slate-500">Điểm Breathe</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">Hạng {user.rank}</p>
                        <p className="text-[10px] font-bold text-slate-500">Toàn trường</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 5: TRANG KIẾN THỨC                                              */}
            {/* ========================================================================= */}
            {currentScreen === '5_knowledge' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Kiến thức</h2>
                  <button type="button" onClick={() => alert('Đã mở danh sách bài viết đã lưu.')} className="p-1 text-slate-400 hover:text-slate-600">
                    <Bookmark className="h-5 w-5" />
                  </button>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'traditional', label: 'Thuốc lá truyền thống' },
                    { key: 'vape', label: 'Thuốc lá điện tử' },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setSelectedCategory(chip.key as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                        selectedCategory === chip.key
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Danh sách thẻ bài viết */}
                <div className="space-y-3">
                  {filteredArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => {
                        setActiveArticle(art)
                        navigateTo('6_article')
                      }}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition"
                    >
                      <div className="space-y-1 pr-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition leading-snug">
                          {art.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {art.readTime}</span>
                          <span>•</span>
                          <span>{art.views}</span>
                        </div>
                      </div>

                      {/* Icon minh họa tương ứng theo từng thẻ */}
                      <div className="shrink-0 h-14 w-14 rounded-xl bg-emerald-50 dark:bg-slate-700/60 flex items-center justify-center p-1 border border-emerald-100 dark:border-slate-700">
                        {art.iconType === 'lungs' && <span className="text-2xl">🫁</span>}
                        {art.iconType === 'vape' && <span className="text-2xl">🧪</span>}
                        {art.iconType === 'brain' && <span className="text-2xl">🧠</span>}
                        {art.iconType === 'law' && <span className="text-2xl">⚖️</span>}
                        {art.iconType === 'heart' && <span className="text-2xl">❤️</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 6: TRANG BÀI VIẾT CHI TIẾT                                      */}
            {/* ========================================================================= */}
            {currentScreen === '6_article' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bài viết chuyên sâu</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBookmarked(!isBookmarked)
                      alert(isBookmarked ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết vào danh sách yêu thích!')
                    }}
                    className={`p-1 transition ${isBookmarked ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-emerald-600' : ''}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                      {activeArticle.title}
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {activeArticle.readTime}</span>
                      <span>•</span>
                      <span>{activeArticle.views}</span>
                    </div>
                  </div>

                  {/* TRANH MINH HỌA HERO: HÚT VAPE & HO SẶC SỤA */}
                  <ArticleHeroIllustration className="w-full h-44 drop-shadow-sm" />

                  {/* KHỐI Ý CHÍNH */}
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 p-3.5 space-y-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Ý chính:
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {activeArticle.keyTakeaway}
                    </p>
                  </div>

                  {/* NỘI DUNG CHI TIẾT */}
                  <div className="space-y-3 pt-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Nội dung phân tích:
                    </h3>
                    {activeArticle.content.map((para, i) => (
                      <p key={i} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* TRANH ĐỐI CHIẾU 2 LÁ PHỔI */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 text-center">
                      Hình thái phế quản & dung tích phổi người trẻ:
                    </p>
                    <LungsComparisonIllustration className="w-full h-40" />
                  </div>

                  {/* Nút hành động */}
                  <div className="pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigateTo('7_challenge')}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition text-center shadow-md shadow-emerald-500/20"
                    >
                      Làm thử thách 7 ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('8_commitment')}
                      className="py-3 px-4 rounded-xl border border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition hover:bg-emerald-50"
                    >
                      Ký cam kết
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 7: TRANG THỬ THÁCH                                              */}
            {/* ========================================================================= */}
            {currentScreen === '7_challenge' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Thử thách</h2>
                  <div className="w-5" />
                </div>

                {/* Tabs: Đang diễn ra | Đã tham gia */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                  <button
                    type="button"
                    onClick={() => setChallengeTab('active')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      challengeTab === 'active' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Đang diễn ra
                  </button>
                  <button
                    type="button"
                    onClick={() => setChallengeTab('joined')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      challengeTab === 'joined' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Đã tham gia
                  </button>
                </div>

                {/* THỬ THÁCH NỔI BẬT: 7 NGÀY KHÔNG KHÓI THUỐC */}
                <div className="rounded-3xl border border-sky-200 dark:border-sky-900/50 bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-slate-800 dark:to-sky-950/30 p-4 shadow-sm mb-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                        Chuỗi 7 ngày
                      </span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                        THỬ THÁCH 7 NGÀY KHÔNG KHÓI THUỐC
                      </h3>
                      <p className="text-[11px] text-slate-500">Cùng nhau tạo nên phiên bản tốt hơn của chính mình!</p>
                    </div>
                    <ChallengeHeroIllustration className="w-20 h-20 shrink-0" />
                  </div>

                  {/* Theo dõi 7 ngày */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      {challengeDays.map((isDone, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400">N{idx + 1}</span>
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                              isDone
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}
                          >
                            {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckInChallenge}
                    disabled={checkedToday}
                    className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-md ${
                      checkedToday
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    }`}
                  >
                    {checkedToday ? '✓ Đã điểm danh hôm nay' : 'Tham gia ngay (+20 điểm)'}
                  </button>
                </div>

                {/* CÁC THỬ THÁCH KHÁC */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Các thử thách khác</h4>

                  {CHALLENGES.filter((c) => c.category === 'quick').map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3.5 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-emerald-600">
                          {c.icon === 'camera' && <Camera className="h-5 w-5" />}
                          {c.icon === 'book' && <BookOpen className="h-5 w-5" />}
                          {c.icon === 'share' && <Share2 className="h-5 w-5" />}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white">{c.title}</h5>
                          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">+{c.points} điểm</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUser((prev) => ({ ...prev, points: prev.points + c.points }))
                          alert(`🎉 Chúc mừng bạn đã hoàn thành nhiệm vụ "${c.title}" và nhận +${c.points} Điểm Breathe!`)
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 font-bold text-xs transition"
                      >
                        Tham gia
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 8: TRANG CAM KẾT                                                */}
            {/* ========================================================================= */}
            {currentScreen === '8_commitment' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Cam kết</h2>
                  <div className="w-5" />
                </div>

                <div className="flex flex-col items-center text-center space-y-4 pt-1">
                  {/* Minh họa Giấy cam kết & Bút ký */}
                  <CommitmentHeroIllustration className="w-44 h-44 drop-shadow-md" />

                  <div className="space-y-1 max-w-xs">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Cam kết của bạn</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-emerald-50/60 dark:bg-slate-800/60 p-3 rounded-2xl border border-emerald-500/20">
                      &ldquo;Tôi cam kết xây dựng và duy trì lối sống không khói thuốc, góp phần vì một môi trường học tập lành mạnh tại ĐHQGHN.&rdquo;
                    </p>
                  </div>

                  {!commitSuccess ? (
                    <form onSubmit={handleCommit} className="w-full space-y-3 pt-1">
                      <div className="space-y-1 text-left">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nhập tên của bạn</label>
                        <input
                          type="text"
                          value={commitName}
                          onChange={(e) => setCommitName(e.target.value)}
                          placeholder="Họ và tên sinh viên"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-center"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition"
                      >
                        Tôi cam kết!
                      </button>
                    </form>
                  ) : (
                    <div className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        <CheckCircle2 className="h-5 w-5" />
                        ĐÃ KÝ CAM KẾT THÀNH CÔNG!
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Cảm ơn bạn <span className="font-bold">{commitName}</span>. Bạn đã được cấp chứng nhận số và nhận +50 Điểm Breathe!
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateTo('13_achievement')}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300 underline"
                      >
                        Xem huy hiệu Cam kết trong Thành tích →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 9: TRANG PHẢN ÁNH                                               */}
            {/* ========================================================================= */}
            {currentScreen === '9_report' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Phản ánh</h2>
                  <div className="w-5" />
                </div>

                {/* Tabs: Gửi phản ánh | Lịch sử */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setReportTab('create')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      reportTab === 'create' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Gửi phản ánh
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportTab('history')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      reportTab === 'history' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Lịch sử ({reportsList.length})
                  </button>
                </div>

                {reportTab === 'create' ? (
                  <form onSubmit={handleSendReport} className="space-y-3.5">
                    {/* Địa điểm phát hiện */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-700 dark:text-slate-300">Địa điểm phát hiện</label>
                        <button
                          type="button"
                          onClick={() => navigateTo('11_map')}
                          className="text-emerald-600 font-bold hover:underline"
                        >
                          Chọn trên bản đồ →
                        </button>
                      </div>

                      {/* Bản đồ mini */}
                      <div className="h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                        <CampusMapGraphic markers={MAP_MARKERS} selectedMarkerId="m1" />
                        <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold shadow">
                          📍 {reportLocation}
                        </div>
                      </div>
                    </div>

                    {/* Hình ảnh (tùy chọn) */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Hình ảnh (tùy chọn)</label>
                      <div className="flex items-center gap-2">
                        <div
                          onClick={() => alert('Đã mở bộ chọn ảnh minh họa vi phạm thực tế!')}
                          className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 cursor-pointer"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-[9px] font-bold">Thêm ảnh</span>
                        </div>
                        {/* Ảnh mẫu minh họa */}
                        <div className="h-16 w-20 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-lg border border-slate-300 dark:border-slate-700 overflow-hidden relative">
                          <span className="text-2xl">🚭</span>
                          <span className="absolute bottom-1 text-[8px] font-bold bg-black/60 text-white px-1 rounded">Ảnh 1</span>
                        </div>
                      </div>
                    </div>

                    {/* Loại vi phạm */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Loại vi phạm</label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Hút thuốc lá điện tử (Pod / Vape)">Hút thuốc lá điện tử (Pod / Vape)</option>
                        <option value="Hút thuốc lá truyền thống">Hút thuốc lá truyền thống</option>
                        <option value="Bán thuốc lá trái phép gần trường">Bán thuốc lá trái phép gần trường</option>
                        <option value="Vứt tàn thuốc bừa bãi gây ô nhiễm">Vứt tàn thuốc bừa bãi gây ô nhiễm</option>
                      </select>
                    </div>

                    {/* Mô tả */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mô tả (tùy chọn)</label>
                      <textarea
                        rows={2}
                        value={reportDesc}
                        onChange={(e) => setReportDesc(e.target.value)}
                        placeholder="Mô tả chi tiết về địa điểm, thời gian phát hiện..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition"
                    >
                      Gửi phản ánh
                    </button>
                  </form>
                ) : (
                  <div className="space-y-2.5">
                    {reportsList.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">📍 {r.locationName}</span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              r.status === 'resolved'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-amber-500/10 text-amber-600'
                            }`}
                          >
                            {r.status === 'resolved' ? 'Đã xử lý' : 'Đang xử lý'}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{r.violationType}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{r.description}</p>
                        <p className="text-[9px] text-slate-400 pt-1">{r.timestamp}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 10: TRANG CỘNG ĐỒNG                                             */}
            {/* ========================================================================= */}
            {currentScreen === '10_community' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Cộng đồng</h2>
                  <div className="w-5" />
                </div>

                {/* Tabs: Bài viết | Sự kiện | Câu lạc bộ */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                  {[
                    { key: 'posts', label: 'Bài viết' },
                    { key: 'events', label: 'Sự kiện' },
                    { key: 'clubs', label: 'Câu lạc bộ' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCommunityTab(tab.key as any)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                        communityTab === tab.key ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Danh sách bài đăng cộng đồng */}
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 space-y-3 shadow-2xs"
                    >
                      {/* Author */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-lg">
                          {post.authorAvatar}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{post.authorName}</h4>
                          <p className="text-[10px] text-slate-400">{post.timeAgo}</p>
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {post.content}
                      </p>

                      {/* Banner hình ảnh sinh viên cầm biểu ngữ */}
                      {post.imageBanner && (
                        <div className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-emerald-50/50 dark:bg-slate-700/50 p-3 text-center">
                          <div className="py-4 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs uppercase tracking-wider shadow">
                            VÌ MỘT KHUÔN VIÊN KHÔNG KHÓI THUỐC
                          </div>
                          <p className="text-[10px] font-semibold text-slate-500 mt-2">
                            Chiến dịch tình nguyện sinh viên ĐHQGHN
                          </p>
                        </div>
                      )}

                      {/* Reaction bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleLikePost(post.id)}
                          className={`flex items-center gap-1.5 font-bold transition ${
                            post.isLiked ? 'text-rose-500' : 'hover:text-rose-500'
                          }`}
                        >
                          <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-rose-500' : ''}`} />
                          <span>{post.likes}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => alert('Mở cuộc thảo luận bình luận...')}
                          className="flex items-center gap-1.5 hover:text-sky-500 transition"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>{post.comments}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => alert('Đã sao chép liên kết bài viết để chia sẻ!')}
                          className="flex items-center gap-1.5 hover:text-emerald-500 transition"
                        >
                          <Share2 className="h-4 w-4" />
                          <span>{post.shares}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 11: TRANG BẢN ĐỒ                                                */}
            {/* ========================================================================= */}
            {currentScreen === '11_map' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Bản đồ không khói thuốc</h2>
                  <div className="w-5" />
                </div>

                {/* Tìm địa điểm */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    placeholder="Tìm địa điểm trong khuôn viên..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Campus switch */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setMapCampus('cau_giay')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                      mapCampus === 'cau_giay' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Cơ sở Cầu Giấy (144 Xuân Thủy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapCampus('hoa_lac')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                      mapCampus === 'hoa_lac' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Khu đô thị Hòa Lạc
                  </button>
                </div>

                {/* Bản đồ tương tác vector SVG */}
                <div className="mb-3">
                  <CampusMapGraphic
                    markers={filteredMarkers}
                    selectedMarkerId={selectedMarkerId}
                    onSelectMarker={(id) => setSelectedMarkerId(id)}
                  />
                </div>

                {/* Bảng chú giải (Legend) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-1.5 text-xs font-bold mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-700 dark:text-slate-300">Khu vực không khói thuốc</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-slate-700 dark:text-slate-300">Điểm vi phạm (đã xử lý)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-500" />
                    <span className="text-slate-700 dark:text-slate-300">Điểm vi phạm (đang xử lý)</span>
                  </div>
                </div>

                {/* Chi tiết địa điểm đang chọn */}
                {currentMarker && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-slate-800/80 p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">📍 {currentMarker.name}</h4>
                      <span className="text-[10px] font-bold text-slate-400">{currentMarker.updatedAt}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{currentMarker.address}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1">{currentMarker.description}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setReportLocation(currentMarker.name)
                        navigateTo('9_report')
                      }}
                      className="mt-2 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Báo cáo phản ánh tại vị trí này →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 12: TRANG CÁ NHÂN                                               */}
            {/* ========================================================================= */}
            {currentScreen === '12_profile' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Cá nhân</h2>
                  <button type="button" onClick={() => navigateTo('14_settings')} className="p-1 text-slate-400 hover:text-slate-600">
                    <Settings className="h-5 w-5" />
                  </button>
                </div>

                {/* Profile Box */}
                <div className="flex flex-col items-center text-center space-y-2 py-3">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 border-2 border-emerald-500 flex items-center justify-center text-3xl font-black text-emerald-700 dark:text-emerald-300 shadow">
                      🧑‍🎓
                    </div>
                    <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-xs">
                      ✓
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">{user.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Sinh viên ĐHQGHN
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 py-3 px-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center mb-4">
                  <div>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{user.points}</p>
                    <p className="text-[10px] font-bold text-slate-500">Điểm Breathe</p>
                  </div>
                  <div className="border-x border-slate-200 dark:border-slate-700">
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">Hạng {user.rank}</p>
                    <p className="text-[10px] font-bold text-slate-500">Toàn trường</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-sky-600 dark:text-sky-400">{user.badgesCount}</p>
                    <p className="text-[10px] font-bold text-slate-500">Huy hiệu</p>
                  </div>
                </div>

                {/* Menu list */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => alert(`Họ tên: ${user.name}\nMã sinh viên: ${user.studentId}\nĐơn vị: Trường Đại học Công nghệ (UET) - ĐHQGHN`)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <User className="h-4 w-4 text-emerald-500" /> Thông tin cá nhân
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('13_achievement')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Award className="h-4 w-4 text-amber-500" /> Thành tích & Huy hiệu
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReportTab('history')
                      navigateTo('9_report')
                    }}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Clock className="h-4 w-4 text-sky-500" /> Lịch sử tham gia
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('14_settings')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Settings className="h-4 w-4 text-indigo-500" /> Cài đặt ứng dụng
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => alert('Đội K70P-ME2: Hotline hỗ trợ chiến dịch ĐHQGHN không khói thuốc.')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <HelpCircle className="h-4 w-4 text-teal-500" /> Hỗ trợ & Trợ giúp
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('2_login')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 transition"
                  >
                    <span className="flex items-center gap-2.5 font-black">
                      <LogOut className="h-4 w-4" /> Đăng xuất
                    </span>
                    <ChevronRight className="h-4 w-4 text-rose-300" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 13: TRANG THÀNH TÍCH                                            */}
            {/* ========================================================================= */}
            {currentScreen === '13_achievement' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Thành tích</h2>
                  <div className="w-5" />
                </div>

                {/* Score card */}
                <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 shadow-lg mb-5 text-center space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Tổng điểm tích lũy</p>
                  <p className="text-4xl font-black">{user.points}</p>
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black">
                    <Award className="h-3.5 w-3.5" /> Hạng {user.rank} toàn trường
                  </div>
                </div>

                {/* HUY HIỆU ĐÃ ĐẠT ĐƯỢC */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Huy hiệu danh dự ({BADGES.filter((b) => b.unlocked).length}/{BADGES.length})
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    {BADGES.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded-2xl p-3 flex flex-col items-center text-center space-y-1.5 transition ${
                          b.unlocked
                            ? 'bg-white dark:bg-slate-800 border border-emerald-500/30 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                            b.unlocked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                          }`}
                        >
                          {b.category === 'starter' && '🌱'}
                          {b.category === 'knowledge' && '📖'}
                          {b.category === 'commitment' && '🛡️'}
                          {b.category === 'challenge' && '🏆'}
                          {b.category === 'community' && '🤝'}
                          {b.category === 'spread' && '📢'}
                        </div>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">{b.name}</p>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {b.unlocked ? `${b.pointsRequired} điểm` : <Lock className="h-3 w-3 inline" />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* MÀN HÌNH 14: TRANG CÀI ĐẶT                                               */}
            {/* ========================================================================= */}
            {currentScreen === '14_settings' && (
              <div className="p-4 flex flex-col flex-1 pb-20 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={goBack} className="p-1 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Cài đặt</h2>
                  <div className="w-5" />
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs font-bold">
                  <div className="p-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <User className="h-4 w-4 text-emerald-500" /> Thông tin tài khoản
                    </span>
                    <span className="text-slate-400 font-normal">{user.email}</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Bell className="h-4 w-4 text-amber-500" /> Nhận thông báo chiến dịch
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notiEnabled}
                        onChange={(e) => setNotiEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert('Chính sách quyền riêng tư của ĐHQGHN bảo vệ 100% dữ liệu sinh viên.')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Lock className="h-4 w-4 text-indigo-500" /> Quyền riêng tư & Bảo mật
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <div className="p-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Compass className="h-4 w-4 text-teal-500" /> Ngôn ngữ
                    </span>
                    <span className="text-emerald-600 font-bold">Tiếng Việt</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      {isDark ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
                      Chế độ giao diện
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDark(!isDark)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                    >
                      {isDark ? 'Tối' : 'Sáng'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert('Điều khoản sử dụng nền tảng BREATHE U 2026.')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <FileText className="h-4 w-4 text-slate-500" /> Điều khoản sử dụng
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>

                  <div className="p-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                      <Sparkles className="h-4 w-4 text-emerald-500" /> Phiên bản thử nghiệm
                    </span>
                    <span className="text-slate-400 font-normal">v1.0.0 (MVP 2026)</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* THANH ĐIỀU HƯỚNG DƯỚI ĐÁY 5 TAB (BOTTOM NAVIGATION BAR)                  */}
            {/* Hiển thị trên các màn hình chính (Trang chủ, Thử thách, Phản ánh...)       */}
            {/* ========================================================================= */}
            {currentScreen !== '1_splash' && currentScreen !== '2_login' && currentScreen !== '3_register' && (
              <nav className="absolute bottom-0 inset-x-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between z-30 select-none">
                {/* Tab 1: Trang chủ */}
                <button
                  type="button"
                  onClick={() => navigateTo('4_home')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                    currentScreen === '4_home' ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Home className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Trang chủ</span>
                </button>

                {/* Tab 2: Thử thách */}
                <button
                  type="button"
                  onClick={() => navigateTo('7_challenge')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                    currentScreen === '7_challenge' ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Award className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Thử thách</span>
                </button>

                {/* Tab 3: Phản ánh */}
                <button
                  type="button"
                  onClick={() => navigateTo('9_report')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                    currentScreen === '9_report' ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Phản ánh</span>
                </button>

                {/* Tab 4: Cộng đồng */}
                <button
                  type="button"
                  onClick={() => navigateTo('10_community')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                    currentScreen === '10_community' ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Users className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Cộng đồng</span>
                </button>

                {/* Tab 5: Cá nhân */}
                <button
                  type="button"
                  onClick={() => navigateTo('12_profile')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                    currentScreen === '12_profile' || currentScreen === '13_achievement' || currentScreen === '14_settings'
                      ? 'text-emerald-600 font-black'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <User className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Cá nhân</span>
                </button>
              </nav>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
