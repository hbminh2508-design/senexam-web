'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  BookOpen, Clock, Trophy, Target, LogOut, User, 
  ChevronRight, MessageSquare, Zap, ShieldCheck, AlertCircle,
  Settings, X, Sun, Moon, MapPin, GraduationCap, Loader2, Eye, KeyRound
} from 'lucide-react'

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

// 🌟 APPLE'S LIQUID GLASS CSS CONSTANTS
const glassCardStyles = "bg-white/30 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]"
const glassButtonStyles = "bg-white/40 dark:bg-slate-800/50 backdrop-blur-xl backdrop-saturate-[1.2] border border-white/60 dark:border-white/10 shadow-sm hover:bg-white/60 dark:hover:bg-slate-700/50 transition-all duration-300"

export default function DashboardPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  
  const [isDataLoading, setIsDataLoading] = useState(true) 
  const [showOnboarding, setShowOnboarding] = useState(false) 
  const [showProfile, setShowProfile] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [studentHistoryList, setStudentHistoryList] = useState<any[]>([])

  // 🌟 STATES CHO TÍNH NĂNG NHẬP MÃ ĐỀ THI ẨN
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [examCode, setExamCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

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

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      userEmail ?? setUserEmail(user.email ?? null)

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

      setIsDataLoading(false)
    }
    
    fetchUserData()

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDarkMode(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDarkMode(true)
    }
  }

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
      if (isSelected) return { ...prev, hsaScienceSubjects: prev.hsaScienceSubjects.filter(s => s !== subject) }
      if (prev.hsaScienceSubjects.length < 3) return { ...prev, hsaScienceSubjects: [...prev.hsaScienceSubjects, subject] }
      return prev
    })
  }

  const handleSaveProfile = async () => {
    if (formData.targetExams.includes('HSA') && formData.hsaOption === 'Khoa học' && formData.hsaScienceSubjects.length !== 3) {
      alert("Vui lòng chọn đủ 3 môn trong phần thi Khoa học của HSA!")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
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
      })
      .eq('id', user.id)

    if (error) {
      alert("Có lỗi xảy ra: " + error.message)
    } else {
      setShowOnboarding(false)
      setShowProfile(false)
    }
  }

  // 🌟 HÀM XỬ LÝ VÀO PHÒNG THI ẨN
  const handleJoinHiddenExam = async () => {
    if (!examCode.trim()) return
    setCodeLoading(true)
    const { data, error } = await supabase
      .from('exams')
      .select('id, title')
      .eq('access_code', examCode.trim().toUpperCase())
      .single()
    
    if (error || !data) {
      alert('Mã đề thi không hợp lệ hoặc đã bị vô hiệu hóa!')
      setCodeLoading(false)
    } else {
      router.push(`/exams/${data.id}`)
    }
  }

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-500">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-bold">Đang tải kiến trúc Liquid Glass...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 relative text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden font-sans">
      
      {/* 🌟 APPLE LIQUID GLASS ORBS BACKGROUND 🌟 */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/40 to-indigo-400/30 dark:from-blue-800/40 dark:to-indigo-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 animate-pulse pointer-events-none"></div>
      <div className="fixed top-[25%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-400/40 to-pink-400/30 dark:from-purple-800/40 dark:to-pink-900/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="fixed bottom-[-15%] left-[20%] w-[700px] h-[700px] bg-gradient-to-t from-emerald-300/30 to-teal-400/20 dark:from-emerald-900/30 dark:to-teal-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 animate-pulse pointer-events-none" style={{ animationDelay: '4s' }}></div>

      {/* 🌟 MODAL NHẬP MÃ ĐỀ THI ẨN */}
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
        
        {/* --- POPUP ONBOARDING (LIQUID GLASS) --- */}
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

        {/* --- SETTINGS SIDE PANEL (LIQUID GLASS) --- */}
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

        {/* --- MAIN DASHBOARD (LIQUID GLASS PANELS) --- */}
        <div className={`transition-all duration-500 ${(showOnboarding || showProfile || showCodeModal) ? 'opacity-30 pointer-events-none select-none blur-md scale-[0.98]' : ''}`}>
          
          {/* 🌟 CẬP NHẬT HEADER KÈM LOGO */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div className="flex items-center gap-3 cursor-pointer select-none group shrink-0" onClick={() => router.push('/dashboard')}>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/50 dark:bg-slate-900/60 border border-white/60 dark:border-white/10 rounded-xl flex items-center justify-center p-1 backdrop-blur-md shadow-sm group-hover:scale-105 transition-transform duration-300">
                <img src="/logo.png" alt="SenExam Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm leading-none text-slate-900 dark:text-white">
                  SenExam<span className="text-blue-600 dark:text-blue-400 drop-shadow-md">.COM</span>
                </h1>
                <span className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Học tập & Thi cử trực tuyến
                </span>
              </div>
            </div>
            
            <div className="flex gap-3 items-center flex-wrap">
              <button onClick={() => router.push('/forum')} className={`${glassButtonStyles} flex items-center justify-center gap-2 px-5 py-2.5 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-sm`}>
                <MessageSquare className="w-4 h-4" /> Thảo luận Forum
              </button>
              {(userRole === 'admin' || userRole === 'collab') && (
                <button onClick={() => router.push('/admin')} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500/90 to-orange-500/90 backdrop-blur-md border border-white/30 text-white rounded-2xl shadow-[0_4px_15px_rgba(239,68,68,0.3)] font-black hover:scale-105 transition-transform text-sm">
                  <ShieldCheck className="w-4 h-4" /> Trạm Admin
                </button>
              )}
              <button onClick={() => setShowProfile(true)} className={`${glassButtonStyles} flex items-center justify-center gap-2 px-5 py-2.5 text-slate-800 dark:text-slate-200 rounded-2xl font-bold text-sm`}><Settings className="w-4 h-4" /> Cài đặt</button>
              <button onClick={handleLogout} className={`${glassButtonStyles} flex items-center justify-center gap-2 px-5 py-2.5 text-red-600 dark:text-red-400 rounded-2xl font-bold text-sm`}><LogOut className="w-4 h-4" /></button>
            </div>
          </div>

          {/* BENTO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6">
            
            {/* LARGE HERO CARD - DEEP GLASSMORPHISM */}
            <div className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-blue-500/60 to-indigo-600/60 dark:from-blue-700/50 dark:to-indigo-900/50 backdrop-blur-3xl backdrop-saturate-[1.5] rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] border border-white/40 border-b-white/10 border-r-white/10 transition-all hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 transform translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/20 backdrop-blur-xl rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/30 shadow-sm drop-shadow-md">
                    <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" /> Hệ thống sẵn sàng
                  </div>
                  <h2 className="text-4xl font-extrabold mb-4 leading-tight drop-shadow-md">
                    Chinh phục <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">{formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'Kỳ thi'}</span>
                  </h2>
                  <p className="text-blue-50/90 mb-8 max-w-sm text-base font-medium leading-relaxed drop-shadow-sm">
                    Dữ liệu đề thi đã được cá nhân hóa. Sẵn sàng đo lường năng lực của bạn ngay hôm nay!
                  </p>
                </div>
                
                {/* 🌟 NÚT VÀO KHO ĐỀ & NHẬP MÃ ĐỀ ẨN */}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => router.push('/exams')} className="bg-white/20 hover:bg-white/30 backdrop-blur-2xl border border-white/40 text-white px-8 py-4 rounded-2xl font-black shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex items-center justify-center gap-3 group text-base transition-all">
                    <Target className="w-5 h-5 group-hover:scale-110 transition-transform" /> Vào kho đề thi <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button onClick={() => setShowCodeModal(true)} className="bg-white/10 hover:bg-white/20 backdrop-blur-2xl border border-white/30 text-white px-6 py-4 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 transition-all">
                    <KeyRound className="w-5 h-5" /> Đề thi riêng
                  </button>
                </div>
              </div>
              <BookOpen className="absolute -right-12 -bottom-12 w-72 h-72 text-white/10 transform -rotate-12 blur-[2px]" />
            </div>

            {/* SMALL GLASS CARD 1 */}
            <div className={`${glassCardStyles} rounded-[2.5rem] p-8 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
              <div className="flex justify-between items-start">
                <div className="p-4 bg-gradient-to-br from-orange-400/30 to-red-500/30 text-orange-600 dark:text-orange-400 rounded-2xl backdrop-blur-md border border-orange-200/50 dark:border-orange-500/20 shadow-inner">
                  <Trophy className="w-8 h-8 drop-shadow-md" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1 uppercase tracking-wider drop-shadow-sm">Đỉnh cao điểm số</p>
                <p className="text-5xl font-black text-slate-900 dark:text-white drop-shadow-sm">
                  {studentHistoryList.length > 0 ? `${Math.max(...studentHistoryList.map(s => s.score || 0))}` : '--'}
                </p>
              </div>
            </div>

            <div 
              onClick={() => router.push('/forum')}
              className={`${glassCardStyles} rounded-[2.5rem] p-8 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[0_8px_32px_0_rgba(59,130,246,0.2)] transition-all duration-300 border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 group cursor-pointer relative overflow-hidden`}
            >
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
              <div className="z-10">
                <div className="p-4 bg-gradient-to-br from-blue-400/30 to-indigo-500/30 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200/30 shadow-inner w-fit mb-5 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-8 h-8 drop-shadow-md" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Cộng Đồng <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed">
                  Nơi giao lưu của mọi người
                </p>
              </div>
            </div>

            {/* RECENT HISTORY CARD (LONG) */}
            <div className={`${glassCardStyles} md:col-span-2 rounded-[2.5rem] p-8 flex flex-col overflow-hidden border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
              <h3 className="text-lg font-extrabold flex items-center gap-2 mb-4 text-slate-900 dark:text-white drop-shadow-sm">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Lịch sử phân tích điểm
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[190px] pr-2 space-y-3 custom-scrollbar">
                {studentHistoryList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 bg-white/30 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-300/50 dark:border-slate-700/50 py-8 backdrop-blur-sm">
                    <BookOpen className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-bold">Chưa phát sinh dữ liệu làm bài</p>
                  </div>
                ) : (
                  studentHistoryList.map((sub) => {
                    const canReview = sub.exams?.allow_review;
                    return (
                      <div key={sub.id} className="p-3.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/60 dark:border-slate-700/50 flex justify-between items-center gap-4 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-colors shadow-sm">
                        <div className="overflow-hidden flex-1">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate drop-shadow-sm">{sub.exams?.title}</p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-bold">{new Date(sub.created_at).toLocaleString('vi-VN')} - Hệ: {sub.exams?.exam_type}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-sm border backdrop-blur-md ${sub.is_graded ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30'}`}>
                            {sub.is_graded ? `${sub.score} đ` : 'Chờ duyệt'}
                          </span>
                          {canReview && sub.is_graded ? (
                            <button onClick={() => router.push(`/submissions/${sub.id}/review`)} className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 border border-blue-500/20 transition-all shadow-sm" title="Khám phá lời giải chi tiết">
                              <Eye className="w-4 h-4"/>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic font-bold px-2" title="Khóa xem chi tiết">Bảo mật</span>
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
    </div>
  )
}