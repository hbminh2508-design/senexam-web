'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Bell,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Megaphone,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  Info,
  AlertTriangle,
  Award,
  CheckCheck,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newann-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newann-body' })

// Component đếm ngược thời gian thực cho sự kiện
export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const target = new Date(targetDate).getTime()
  if (isNaN(target)) return <span className="text-rose-500 font-bold">[Lỗi định dạng ngày]</span>

  const diff = target - now
  if (diff <= 0) {
    return (
      <span className="inline-block bg-black/10 dark:bg-white/10 text-[#6B7280] dark:text-slate-400 font-black px-3 py-1 rounded-xl mx-1 text-xs">
        ⏳ Sự kiện đã kết thúc
      </span>
    )
  }

  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / (1000 * 60)) % 60)
  const s = Math.floor((diff / 1000) % 60)

  return (
    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black px-3 py-1 rounded-xl shadow-md mx-1 text-xs animate-pulse whitespace-nowrap">
      ⏳ Còn {d} ngày {h} giờ {m} phút {s} giây
    </span>
  )
}

// Bộ phân tích và hiển thị nội dung thông báo
export const AnnouncementRenderer = ({ text }: { text: string }) => {
  if (!text) return null
  const lines = text.split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        let isH1 = false
        let isH2 = false
        let isH3 = false
        let isCenter = false
        let content = line.trim()

        const centerMatch = content.match(/{Center:\s*(.*)}/i)
        if (centerMatch) {
          isCenter = true
          content = centerMatch[1].trim()
        }

        if (content.startsWith('###(H1)')) {
          isH1 = true
          content = content.replace('###(H1)', '').trim()
        } else if (content.startsWith('##(H2)')) {
          isH2 = true
          content = content.replace('##(H2)', '').trim()
        } else if (content.startsWith('#(H3)')) {
          isH3 = true
          content = content.replace('#(H3)', '').trim()
        }

        const parseTags = (str: string) => {
          const regex = /{(time_|bold|underline):\s*([^}]+)}/gi
          const parts = []
          let lastIndex = 0
          let match

          while ((match = regex.exec(str)) !== null) {
            if (match.index > lastIndex) {
              parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex, match.index)}</span>)
            }
            const tag = match[1].toLowerCase()
            const val = match[2]

            if (tag === 'time_') {
              parts.push(<CountdownTimer key={`time-${match.index}`} targetDate={val} />)
            } else if (tag === 'bold') {
              parts.push(
                <strong key={`b-${match.index}`} className="font-black text-indigo-600 dark:text-indigo-400">
                  {val}
                </strong>
              )
            } else if (tag === 'underline') {
              parts.push(
                <u key={`u-${match.index}`} className="underline underline-offset-4 decoration-indigo-500">
                  {val}
                </u>
              )
            }
            lastIndex = regex.lastIndex
          }
          if (lastIndex < str.length) {
            parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex)}</span>)
          }
          return parts
        }

        let baseClass = isH1
          ? 'text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-400 my-2'
          : isH2
          ? 'text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 my-1.5'
          : isH3
          ? 'text-base font-bold text-slate-700 dark:text-slate-200 my-1'
          : 'text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed'

        if (isCenter) baseClass += ' text-center w-full block'

        return (
          <div key={idx} className={baseClass}>
            {parseTags(content)}
          </div>
        )
      })}
    </div>
  )
}

export default function NewAnnouncementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [activeAnnouncement, setActiveAnnouncement] = useState<any | null>(null)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      setCurrentUserId(user.id)
      await ensureStudentProfile(user.id)

      // Đọc danh sách ID đã đọc từ localStorage
      const localKey = `sen_read_announcements_${user.id}`
      const savedRead = JSON.parse(localStorage.getItem(localKey) || '[]')
      setReadIds(savedRead)

      // Fetch tất cả thông báo hệ thống
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setAnnouncements(data)
        if (data.length > 0) {
          setActiveAnnouncement(data[0])
          // Tự động đánh dấu đã xem thông báo đầu tiên
          if (!savedRead.includes(data[0].id)) {
            const updated = [...savedRead, data[0].id]
            setReadIds(updated)
            localStorage.setItem(localKey, JSON.stringify(updated))
          }
        }
      }
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

  // Khi bấm vào xem một thông báo cụ thể
  const handleSelectAnnouncement = (item: any) => {
    setActiveAnnouncement(item)
    if (!readIds.includes(item.id) && currentUserId) {
      const updated = [...readIds, item.id]
      setReadIds(updated)
      localStorage.setItem(`sen_read_announcements_${currentUserId}`, JSON.stringify(updated))
    }
  }

  // Đánh dấu tất cả thông báo là đã đọc
  const handleMarkAllRead = () => {
    if (!currentUserId) return
    const allIds = announcements.map((a) => a.id)
    setReadIds(allIds)
    localStorage.setItem(`sen_read_announcements_${currentUserId}`, JSON.stringify(allIds))
  }

  const unreadCount = useMemo(() => {
    return announcements.filter((a) => !readIds.includes(a.id)).length
  }, [announcements, readIds])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải bảng thông báo hệ thống...</span>
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
                <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <Megaphone className="inline h-3 w-3 mr-1" /> Trung Tâm Thông Báo
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
                    {unreadCount} tin mới
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newann-heading)' }}>
                Bảng Tin & Thông Báo Từ Admin
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold shadow-sm transition hover:bg-black/5"
              >
                <CheckCheck className="h-4 w-4 text-teal-500" /> Đánh dấu đã đọc tất cả
              </button>
            )}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: ANNOUNCEMENT LIST & DETAIL VIEWER */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LIST SIDEBAR (1 COL) */}
          <div className="lg:col-span-1 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl space-y-3">
            <h3 className="text-sm font-black" style={{ fontFamily: 'var(--font-newann-heading)' }}>
              Tất Cả Bản Tin ({announcements.length})
            </h3>

            <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {announcements.length === 0 ? (
                <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center py-8">
                  Chưa có thông báo nào từ ban quản trị.
                </p>
              ) : (
                announcements.map((item) => {
                  const isSelected = activeAnnouncement?.id === item.id
                  const isRead = readIds.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectAnnouncement(item)}
                      className={`w-full flex items-start gap-3 rounded-2xl p-3.5 text-left transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 border border-black/5 dark:border-white/5'
                      }`}
                    >
                      <div className="relative mt-0.5">
                        <Bell className={`h-4 w-4 shrink-0 ${isSelected ? 'text-amber-300' : 'text-indigo-500'}`} />
                        {!isRead && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-[#6B7280] dark:text-slate-400'}`}>
                            {new Date(item.created_at).toLocaleDateString('vi-VN')}
                          </span>
                          {!isRead && (
                            <span className="rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 text-[9px] font-black uppercase">
                              Mới
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-bold line-clamp-2 mt-0.5 ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                          {item.title || item.content?.slice(0, 60) || 'Thông báo hệ thống'}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* DETAIL VIEWER (2 COLS) */}
          <div className="lg:col-span-2 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            {activeAnnouncement ? (
              <div className="space-y-6">
                <div className="pb-4 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 text-xs font-black uppercase border border-indigo-500/20">
                      Bản Tin Chính Thức
                    </span>
                    <h2 className="mt-2 text-xl sm:text-2xl font-black" style={{ fontFamily: 'var(--font-newann-heading)' }}>
                      {activeAnnouncement.title || 'Thông Báo Từ Ban Quản Trị SenExam'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-slate-400">
                    <Calendar className="h-4 w-4" />
                    <span>Đăng ngày {new Date(activeAnnouncement.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                {/* Announcement Body Content */}
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-6 text-sm">
                  <AnnouncementRenderer text={activeAnnouncement.content} />
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-[#6B7280] dark:text-slate-400 space-y-2">
                <Megaphone className="h-12 w-12 mx-auto opacity-40" />
                <p className="font-bold text-sm">Hãy chọn một thông báo từ danh sách bên trái để đọc nội dung.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
