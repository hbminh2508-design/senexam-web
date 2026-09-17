'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import SebLogo from '@/components/SebLogo'
import {
  ArrowLeft,
  User,
  Mail,
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  RotateCcw,
  LogOut,
  Save,
  Loader2,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-seb-body' })

export default function SebProfilePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])

  // Form edit profile state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [school, setSchool] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    document.documentElement.classList.remove('dark')

    const loadProfileData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          router.replace('/seb-login')
          return
        }
        setCurrentUser(user)

        // 1. Lấy thông tin cá nhân từ bảng profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileData) {
          setProfile(profileData)
          setFullName(profileData.full_name || '')
          setPhone(profileData.phone || '')
          setSchool(profileData.school || '')
        }

        // 2. Lấy danh sách các bài thi đã làm và điểm số
        const { data: subsData } = await supabase
          .from('submissions')
          .select(`
            id,
            score,
            total_questions,
            submitted_at,
            created_at,
            tab_switches,
            blur_count,
            exams (
              id,
              title,
              duration,
              allow_review,
              exam_type
            )
          `)
          .eq('user_id', user.id)
          .order('submitted_at', { ascending: false })

        setSubmissions(subsData || [])
      } catch (err) {
        console.error('Lỗi tải dữ liệu hồ sơ SEB:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfileData()
  }, [router])

  // Cập nhật thông tin cá nhân
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setSavingProfile(true)
    setSaveMsg('')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          school: school.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) throw error
      setSaveMsg('Cập nhật thông tin thành công!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err: any) {
      setSaveMsg('Lỗi cập nhật: ' + err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  // Thống kê điểm số
  const totalCompleted = submissions.length
  const avgScore =
    totalCompleted > 0
      ? (
          submissions.reduce((sum, s) => sum + (Number(s.score) || 0), 0) /
          totalCompleted
        ).toFixed(1)
      : '0.0'
  const highestScore =
    totalCompleted > 0
      ? Math.max(...submissions.map((s) => Number(s.score) || 0)).toFixed(1)
      : '0.0'

  return (
    <div
      className={`min-h-screen w-full bg-slate-50 flex flex-col text-slate-800 antialiased ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-seb-body)' }}
    >
      {/* Top Navbar */}
      <header className="h-16 w-full border-b border-sky-100 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/seb-dashboard"
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <SebLogo size={34} showText={true} />
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/seb-dashboard"
            className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold transition"
          >
            Quay Lại Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Profile Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-sky-100 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700 text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            {fullName
              ? fullName.charAt(0).toUpperCase()
              : currentUser?.email?.charAt(0).toUpperCase() || 'S'}
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: 'var(--font-seb-heading)' }}
            >
              {fullName || 'Hồ Sơ Thí Sinh'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser?.email}</p>
            {school && (
              <p className="text-xs text-sky-700 font-bold mt-1 bg-sky-50 inline-block px-2 py-0.5 rounded-md border border-sky-100">
                {school}
              </p>
            )}
          </div>

          {/* 3 Thống Kê Điểm Số Nhanh */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Đã Thi</span>
              <p className="text-lg font-black text-sky-700">{totalCompleted}</p>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Điểm TB</span>
              <p className="text-lg font-black text-emerald-700">{avgScore}</p>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Cao Nhất</span>
              <p className="text-lg font-black text-amber-700">{highestScore}</p>
            </div>
          </div>
        </div>

        {/* 2 Cột: Cột Trái Cập nhật thông tin / Cột Phải Bảng điểm và Lịch sử bài đã thi */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 1: Thông tin cá nhân */}
          <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm h-fit">
            <h3
              className="text-base font-black text-slate-900 mb-4"
              style={{ fontFamily: 'var(--font-seb-heading)' }}
            >
              Thông Tin Cá Nhân
            </h3>

            {saveMsg && (
              <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                {saveMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Họ và Tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn An"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Số Điện Thoại</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0987654321"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Trường / Đơn Vị Học Tập</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Ví dụ: THPT Chuyên KHTN, ĐHQGHN"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-sky-500/20"
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Lưu Thay Đổi</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Cột 2: Bảng Điểm & Các Bài Đã Làm */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-sky-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-sky-600" />
                <h3
                  className="text-base font-black text-slate-900"
                  style={{ fontFamily: 'var(--font-seb-heading)' }}
                >
                  Các Bài Thi Đã Làm ({submissions.length})
                </h3>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium">
                Bạn chưa hoàn thành bài thi nào trên hệ thống Safe Exam Browser.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {submissions.map((sub) => {
                  const exam = sub.exams
                  const submittedDate = sub.submitted_at
                    ? new Date(sub.submitted_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'

                  const scoreNum = Number(sub.score) || 0
                  const isGoodScore = scoreNum >= 8

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-200 transition-all duration-200 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {exam?.exam_type || 'Đề Thi SEB'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {exam?.title || 'Đề thi không xác định'}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {submittedDate}
                          </span>
                          {sub.tab_switches > 0 && (
                            <span className="text-rose-600 font-bold">
                              ⚠️ Chuyển tab: {sub.tab_switches} lần
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Điểm số */}
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">
                            Điểm số
                          </span>
                          <span
                            className={`text-base font-black ${
                              isGoodScore ? 'text-emerald-600' : 'text-sky-600'
                            }`}
                          >
                            {scoreNum.toFixed(2)}
                          </span>
                        </div>

                        {exam?.allow_review && (
                          <Link
                            href={`/exams/${exam.id}/review`}
                            className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1.5 rounded-xl border border-sky-100 transition"
                          >
                            Xem lại
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
