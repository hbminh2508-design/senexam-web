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
  const [subFilter, setSubFilter] = useState<'all' | 'seb' | 'senexam'>('all')

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

        // 2. Lấy danh sách toàn bộ các bài thi đã làm từ SenExam và SEB với cơ chế truy vấn linh hoạt
        let subsList: any[] = []

        // Thử lấy kèm quan hệ exams(*)
        const { data: joinedSubs, error: joinErr } = await supabase
          .from('submissions')
          .select('*, exams(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!joinErr && Array.isArray(joinedSubs) && joinedSubs.length > 0) {
          subsList = joinedSubs
        } else {
          // Fallback: Lấy trực tiếp từ submissions rồi tra cứu thông tin đề thi exams
          const { data: rawSubs, error: rawErr } = await supabase
            .from('submissions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (rawErr) {
            console.error('Lỗi lấy bài nộp raw:', rawErr)
          } else if (rawSubs && rawSubs.length > 0) {
            const examIds = Array.from(new Set(rawSubs.map((s) => s.exam_id).filter(Boolean)))
            const examMap: Record<string, any> = {}

            if (examIds.length > 0) {
              const { data: examsData } = await supabase
                .from('exams')
                .select('id, title, duration, allow_review, exam_type, require_seb, subjects')
                .in('id', examIds)

              if (examsData) {
                examsData.forEach((ex) => {
                  examMap[ex.id] = ex
                })
              }
            }

            subsList = rawSubs.map((s) => ({
              ...s,
              exams: s.exams || examMap[s.exam_id] || null,
            }))
          }
        }

        setSubmissions(subsList)
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

  const sebSubsCount = submissions.filter((s) => s.exams?.require_seb === true).length
  const senSubsCount = submissions.filter((s) => !s.exams?.require_seb).length

  const filteredSubmissions = submissions.filter((sub) => {
    if (subFilter === 'seb') {
      return sub.exams?.require_seb === true
    }
    if (subFilter === 'senexam') {
      return !sub.exams?.require_seb
    }
    return true
  })

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

        {/* Banner Đồng Bộ Dữ Liệu Toàn Diện Từ SenExam */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Dữ Liệu Đã Đồng Bộ Hoàn Toàn Với SenExam
              </h4>
              <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                Toàn bộ lịch sử làm bài, số lần thi và điểm số từ SenExam đã được tích hợp đầy đủ vào tài khoản SEB của bạn.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <span className="text-xs font-black text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
              {submissions.length} bài thi đã đồng bộ
            </span>
          </div>
        </div>

        {/* 2 Cột: Thông Tin Cá Nhân (Trái) & Lịch Sử Làm Bài (Phải) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 1: Thông Tin Cá Nhân */}
          <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <User className="h-4 w-4 text-sky-600" />
              <h3
                className="text-base font-black text-slate-900"
                style={{ fontFamily: 'var(--font-seb-heading)' }}
              >
                Thông Tin Cá Nhân
              </h3>
            </div>

            {saveMsg && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold border ${
                  saveMsg.includes('Lỗi')
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
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
                  placeholder="Nguyễn Văn A"
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
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-sky-600" />
                <h3
                  className="text-base font-black text-slate-900"
                  style={{ fontFamily: 'var(--font-seb-heading)' }}
                >
                  Lịch Sử Làm Bài ({filteredSubmissions.length})
                </h3>
              </div>

              {/* Bộ lọc bài thi SEB / SenExam */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSubFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    subFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tất cả ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('seb')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    subFilter === 'seb'
                      ? 'bg-white text-sky-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Bảo Mật SEB ({sebSubsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubFilter('senexam')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    subFilter === 'senexam'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  SenExam ({senSubsCount})
                </button>
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium">
                Chưa có bài thi nào trong danh mục đã chọn.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {filteredSubmissions.map((sub) => {
                  const exam = sub.exams
                  const submittedDate = (sub.submitted_at || sub.created_at)
                    ? new Date(sub.submitted_at || sub.created_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'

                  const scoreNum = Number(sub.score) || 0
                  const isGoodScore = scoreNum >= 8
                  const isSebExam = exam?.require_seb === true

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-200 transition-all duration-200 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                              isSebExam
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isSebExam ? '🛡️ Bảo Mật SEB' : '📘 Đề Thi SenExam'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {exam?.exam_type || 'BÀI THI'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {exam?.title || 'Đề thi không xác định'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {submittedDate}
                          </span>
                          {sub.time_spent ? (
                            <span>• {Math.round(sub.time_spent / 60)} phút</span>
                          ) : exam?.duration ? (
                            <span>• {exam.duration} phút</span>
                          ) : null}
                          {sub.tab_switches > 0 && (
                            <span className="text-amber-700 font-bold">
                              • Mất tiêu điểm: {sub.tab_switches} lần
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Điểm số & Xem lại */}
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

                        <Link
                          href={`/submissions/${sub.id}/review?from=seb`}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 transition shadow-2xs hover:bg-sky-100"
                        >
                          Xem lại
                        </Link>
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
