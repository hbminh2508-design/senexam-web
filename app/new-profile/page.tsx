'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { linkWithGoogle } from '@/lib/authHelper'
import {
  ArrowLeft,
  User,
  School,
  MapPin,
  Mail,
  Phone,
  Target,
  Crown,
  Coins,
  ShieldCheck,
  KeyRound,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  LogOut,
  Save,
  Check,
  Flame,
  Star,
  Settings,
  ChevronRight,
  Gift,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newprof-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newprof-body' })

const EXAM_BLOCKS = [
  'A00 (Toán, Lý, Hóa)',
  'A01 (Toán, Lý, Anh)',
  'B00 (Toán, Hóa, Sinh)',
  'C00 (Văn, Sử, Địa)',
  'D01 (Toán, Văn, Anh)',
  'D07 (Toán, Hóa, Anh)',
  'HSA (ĐGNL ĐHQGHN)',
  'TSA (ĐGTD ĐHBK Hà Nội)',
  'V-SAT (Đánh giá đầu vào)',
]

export default function NewProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  // Form profile fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')
  const [grade, setGrade] = useState('12')
  const [targetExams, setTargetExams] = useState<string[]>([])
  const [targetScore, setTargetScore] = useState('27')

  // Status & saving states
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Feedback form state
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'exam' | 'other'>('feature')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([])

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const u = auth.user
      if (!u) {
        router.replace('/new-sign')
        return
      }

      setUser(u)
      await ensureStudentProfile(u.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (p) {
        setProfile(p)
        setFullName(p.full_name || u.user_metadata?.full_name || '')
        setPhoneNumber(p.phone_number || '')
        setSchool(p.school || '')
        setProvince(p.province || '')
        setGrade(p.grade || '12')
        setTargetExams(Array.isArray(p.target_exams) ? p.target_exams : ['A00 (Toán, Lý, Hóa)'])
        setTargetScore(p.target_score || '27')
      }

      // Fetch user's previous feedbacks
      const { data: fbData } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setMyFeedbacks(fbData || [])
      setLoading(false)
    }

    init()
  }, [router])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Toggle target exam selection
  const handleToggleExamBlock = (block: string) => {
    if (targetExams.includes(block)) {
      setTargetExams(targetExams.filter((b) => b !== block))
    } else {
      setTargetExams([...targetExams, block])
    }
  }

  // Lưu thông tin cá nhân
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    setProfileMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          school: school.trim(),
          province: province.trim(),
          grade: grade,
          target_exams: targetExams,
          target_score: targetScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setProfileMsg({ type: 'success', text: 'Cập nhật thông tin hồ sơ thành công!' })
      setTimeout(() => setProfileMsg(null), 3000)
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Lỗi khi lưu thông tin.' })
    } finally {
      setSavingProfile(false)
    }
  }

  // Đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' })
      return
    }

    setSavingPassword(true)
    setPasswordMsg(null)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(null), 3000)
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Lỗi khi đổi mật khẩu.' })
    } finally {
      setSavingPassword(false)
    }
  }

  // Gửi phản hồi / góp ý cho Admin
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackContent.trim() || !user) return

    setSendingFeedback(true)
    setFeedbackMsg(null)

    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_name: fullName || user.email,
          content: feedbackContent.trim(),
          category: feedbackCategory,
        })
        .select('*')
        .single()

      if (error) throw error

      setFeedbackMsg({ type: 'success', text: 'Cảm ơn bạn! Góp ý đã được gửi thành công đến Ban Quản Trị SenExam.' })
      setFeedbackContent('')
      if (data) setMyFeedbacks([data, ...myFeedbacks])
      setTimeout(() => setFeedbackMsg(null), 4000)
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi gửi góp ý.' })
    } finally {
      setSendingFeedback(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/new-sign')
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải thông tin hồ sơ thí sinh...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <User className="inline h-3 w-3 mr-1" /> Hồ Sơ Thí Sinh
                </span>
                {profile?.role === 'admin' && (
                  <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[10px] font-black uppercase">
                    Quản Trị Viên
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newprof-heading)' }}>
                Quản Lý Hồ Sơ & Cài Đặt Cá Nhân
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 px-3.5 py-2 text-xs font-bold transition"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>

        {/* PROFILE OVERVIEW HERO CARD */}
        <div className="mt-6 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white text-3xl font-black shadow-lg">
              {fullName ? fullName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newprof-heading)' }}>
                  {fullName || 'Thí sinh SenExam'}
                </h2>
                {profile?.vip_expires_at && (
                  <span className="rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                    VIP Member
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {user?.email}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-slate-400 flex items-center gap-2">
                <span>Trường: <strong>{school || 'Chưa cập nhật'}</strong></span>
                <span>• Tỉnh: <strong>{province || 'Toàn quốc'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              href="/new-sencash"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-700 dark:text-amber-300 shadow-sm transition hover:scale-105"
            >
              <Coins className="h-4 w-4 text-amber-500" />
              <span>{(profile?.sencash_balance || 0).toLocaleString('vi-VN')} SC</span>
            </Link>
            <Link
              href="/new-codes"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
            >
              <Gift className="h-4 w-4 text-amber-400" />
              <span>Nhập Code</span>
            </Link>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: EDIT PROFILE & FEEDBACK */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUMN 1 & 2: FORM EDIT PROFILE */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* THÔNG TIN HỌC TẬP & CÁ NHÂN */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-5">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newprof-heading)' }}>
                <User className="h-5 w-5 text-indigo-500" /> Chỉnh Sửa Thông Tin Học Tập
              </h3>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Họ và tên thí sinh</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Số điện thoại / Zalo</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0987654321"
                      className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Trường THPT</label>
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="THPT Chuyên Hà Nội - Amsterdam..."
                      className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Tỉnh / Thành phố</label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Hà Nội, TP.HCM..."
                      className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Khối thi & Mục tiêu */}
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-2">
                    Khối thi & Kỳ thi mục tiêu (chọn một hoặc nhiều)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EXAM_BLOCKS.map((block) => {
                      const isSel = targetExams.includes(block)
                      return (
                        <button
                          key={block}
                          type="button"
                          onClick={() => handleToggleExamBlock(block)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                            isSel
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
                          }`}
                        >
                          {block}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Điểm số mục tiêu</label>
                  <input
                    type="text"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    placeholder="27+ THPTQG, 100+ HSA, 80+ TSA"
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-indigo-500"
                  />
                </div>

                {profileMsg && (
                  <div className={`rounded-xl p-3 text-xs font-bold flex items-center gap-2 ${
                    profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}>
                    {profileMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu Thông Tin Hồ Sơ
                </button>
              </form>
            </div>

            {/* BẢO MẬT & ĐỔI MẬT KHẨU */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newprof-heading)' }}>
                <KeyRound className="h-5 w-5 text-amber-500" /> Đổi Mật Khẩu Đăng Nhập
              </h3>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs font-bold max-w-md">
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 outline-none focus:border-amber-500"
                  />
                </div>

                {passwordMsg && (
                  <div className={`rounded-xl p-3 text-xs font-bold flex items-center gap-2 ${
                    passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}>
                    {passwordMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Cập Nhật Mật Khẩu
                </button>
              </form>
            </div>
          </div>

          {/* COLUMN 3: GỬI PHẢN HỒI / GÓP Ý CHO ADMIN */}
          <div className="space-y-6">
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-black/10 dark:border-white/10">
                <MessageSquare className="h-5 w-5 text-rose-500" />
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newprof-heading)' }}>
                  Gửi Góp Ý & Báo Lỗi Cho Admin
                </h3>
              </div>

              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Ý kiến đóng góp của bạn giúp SenExam ngày càng hoàn thiện hơn!
              </p>

              <form onSubmit={handleSendFeedback} className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Loại góp ý:</label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="feature">✨ Đề xuất tính năng mới</option>
                    <option value="bug">🐛 Báo lỗi giao diện / chức năng</option>
                    <option value="exam">📝 Góp ý nội dung đề thi & đáp án</option>
                    <option value="other">💬 Ý kiến đóng góp khác</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Nội dung chi tiết:</label>
                  <textarea
                    rows={4}
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="Mô tả cụ thể góp ý hoặc lỗi bạn gặp phải..."
                    className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-rose-500"
                  />
                </div>

                {feedbackMsg && (
                  <div className={`rounded-xl p-3 text-xs font-bold flex items-center gap-2 ${
                    feedbackMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}>
                    {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{feedbackMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingFeedback || !feedbackContent.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {sendingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gửi Góp Ý Đến Admin
                </button>
              </form>
            </div>

            {/* FEEDBACK HISTORY */}
            {myFeedbacks.length > 0 && (
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                  Góp ý gần đây của bạn ({myFeedbacks.length})
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {myFeedbacks.map((fb) => (
                    <div key={fb.id} className="rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                        {fb.content}
                      </p>
                      <span className="text-[10px] text-[#6B7280] block mt-1">
                        {new Date(fb.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
