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
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  MapPin,
  Bell,
  Repeat,
  FileText,
  Search,
  Filter,
  Check,
  Flame,
  Award,
  Zap,
  Bookmark,
  Hourglass,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newsch-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newsch-body' })

export type ScheduleItem = {
  id: string
  title: string
  subject: string
  type: 'study' | 'mock_exam' | 'real_exam' | 'review'
  room: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  remindBefore: number // minutes: 0, 5, 15, 30, 60, 1440
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  repeatUntil?: string // YYYY-MM-DD
  note: string
  color: string
  isCompleted?: boolean
  createdAt: string
}

const SUBJECT_OPTIONS = [
  'Toán học',
  'Vật lí',
  'Hóa học',
  'Sinh học',
  'Ngữ văn',
  'Tiếng Anh',
  'Lịch sử',
  'Địa lí',
  'GDCD',
  'Tin học',
  'Đánh giá năng lực (HSA)',
  'Đánh giá tư duy (TSA)',
  'Kỳ thi THPT Quốc Gia 2026',
]

const COLOR_OPTIONS = [
  { name: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-500/30' },
  { name: 'Teal', bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-500/30' },
  { name: 'Amber', bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500/30' },
  { name: 'Rose', bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-500/30' },
  { name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500/30' },
  { name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500/30' },
]

export default function NewSchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Current calendar month view
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar')
  const [filterType, setFilterType] = useState<'all' | 'study' | 'mock_exam' | 'real_exam'>('all')

  // Schedules list
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])

  // Create Modal state
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0])
  const [type, setType] = useState<'study' | 'mock_exam' | 'real_exam' | 'review'>('study')
  const [room, setRoom] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:30')
  const [remindBefore, setRemindBefore] = useState('15')
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  const [repeatUntil, setRepeatUntil] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0].name)
  const [saving, setSaving] = useState(false)

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

      setUserId(user.id)
      await ensureStudentProfile(user.id)

      // Đọc danh sách lịch từ Supabase hoặc localStorage
      const localKey = `sen_schedules_${user.id}`
      const savedLocal = localStorage.getItem(localKey)
      if (savedLocal) {
        try {
          setSchedules(JSON.parse(savedLocal))
        } catch (e) {
          console.error(e)
        }
      }

      // Thử fetch từ bảng Supabase nếu có
      try {
        const { data } = await supabase
          .from('user_schedules')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true })

        if (data && data.length > 0) {
          setSchedules(data)
          localStorage.setItem(localKey, JSON.stringify(data))
        }
      } catch (e) {
        // Fallback local storage
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

  // LƯU LỊCH MỚI
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return

    setSaving(true)
    const newId = 'sch_' + Date.now()
    const newItem: ScheduleItem = {
      id: newId,
      title: title.trim(),
      subject,
      type,
      room: room.trim() || 'Phòng học cá nhân',
      date,
      startTime,
      endTime,
      remindBefore: parseInt(remindBefore) || 0,
      repeat,
      repeatUntil: repeat !== 'none' ? repeatUntil : undefined,
      note: note.trim(),
      color,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    }

    const updated = [...schedules, newItem]
    setSchedules(updated)
    if (userId) {
      localStorage.setItem(`sen_schedules_${userId}`, JSON.stringify(updated))
      try {
        await supabase.from('user_schedules').insert({
          id: newId,
          user_id: userId,
          title: newItem.title,
          subject: newItem.subject,
          type: newItem.type,
          room: newItem.room,
          date: newItem.date,
          start_time: newItem.startTime,
          end_time: newItem.endTime,
          remind_before: newItem.remindBefore,
          repeat: newItem.repeat,
          repeat_until: newItem.repeatUntil,
          note: newItem.note,
          color: newItem.color,
        })
      } catch (e) {
        // Ignore remote error
      }
    }

    // Reset Form
    setTitle('')
    setRoom('')
    setNote('')
    setShowModal(false)
    setSaving(false)
  }

  // XÓA LỊCH
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Xác nhận xóa lịch này khỏi thời khóa biểu?')) return
    const updated = schedules.filter((s) => s.id !== id)
    setSchedules(updated)
    if (userId) {
      localStorage.setItem(`sen_schedules_${userId}`, JSON.stringify(updated))
      try {
        await supabase.from('user_schedules').delete().eq('id', id)
      } catch (e) {}
    }
  }

  // TOGGLE HOÀN THÀNH
  const handleToggleComplete = (id: string) => {
    const updated = schedules.map((s) => (s.id === id ? { ...s, isCompleted: !s.isCompleted } : s))
    setSchedules(updated)
    if (userId) localStorage.setItem(`sen_schedules_${userId}`, JSON.stringify(updated))
  }

  // CALENDAR GRID CALCULATIONS
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = CN, 1 = T2
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Chuyển sang T2 = 0, ..., CN = 6
  const startOffset = (firstDayIndex + 6) % 7

  const prevMonthDays = new Date(year, month, 0).getDate()
  const calendarCells = []

  // Ngày tháng trước
  for (let i = startOffset - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isCurrentMonth: false, dateStr: '' })
  }
  // Ngày tháng này
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    calendarCells.push({ day: i, isCurrentMonth: true, dateStr: dStr })
  }
  // Ngày tháng sau bù cho đủ bội số 7
  const remaining = 7 - (calendarCells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calendarCells.push({ day: i, isCurrentMonth: false, dateStr: '' })
    }
  }

  // Sắp xếp lịch theo ngày được chọn hoặc theo thời gian
  const selectedDateSchedules = useMemo(() => {
    return schedules
      .filter((s) => {
        const matchesDate = s.date === selectedDate
        const matchesFilter = filterType === 'all' || s.type === filterType
        return matchesDate && matchesFilter
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [schedules, selectedDate, filterType])

  // Sự kiện gần nhất sắp tới
  const upcomingEvent = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    return schedules
      .filter((s) => s.date >= todayStr && !s.isCompleted)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0]
  }, [schedules])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải thời khóa biểu & lịch thi...</span>
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
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
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
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  <Calendar className="inline h-3.5 w-3.5 mr-1" /> Lịch Học & Lịch Thi 2.0
                </span>
                <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                  {schedules.length} lịch đã lên
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newsch-heading)' }}>
                Thời Khóa Biểu & Kế Hoạch Ôn Thi
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105"
            >
              <Plus className="h-4 w-4" /> Thêm Lịch Học / Thi
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* UPCOMING EVENT HERO BANNER */}
        {upcomingEvent && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                <Hourglass className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Lịch Sắp Tới Gần Nhất
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newsch-heading)' }}>
                  {upcomingEvent.title} ({upcomingEvent.subject})
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>📅 {new Date(upcomingEvent.date).toLocaleDateString('vi-VN')}</span>
                  <span>⏰ {upcomingEvent.startTime} - {upcomingEvent.endTime}</span>
                  <span>📍 {upcomingEvent.room}</span>
                </p>
              </div>
            </div>

            <span className="rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/5 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-400 shadow-sm whitespace-nowrap">
              🔔 Nhắc trước {upcomingEvent.remindBefore} phút
            </span>
          </div>
        )}

        {/* 2-COLUMN LAYOUT: CALENDAR GRID & DAILY DETAIL LIST */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* MONTH CALENDAR (7 COLS) */}
          <div className="lg:col-span-7 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            {/* Calendar Header Month Navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-newsch-heading)' }}>
                Tháng {month + 1}, {year}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(year, month - 1, 1))}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5"
                  title="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    setViewDate(now)
                    setSelectedDate(now.toISOString().split('T')[0])
                  }}
                  className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(year, month + 1, 1))}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5"
                  title="Tháng sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[11px] font-black uppercase text-[#6B7280] dark:text-slate-400">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
                <div key={w} className="py-1.5">{w}</div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={idx}
                      className="h-16 rounded-2xl border border-transparent p-1.5 text-center text-xs font-bold text-[#9CA3AF] opacity-30"
                    >
                      {cell.day}
                    </div>
                  )
                }

                const isSelected = selectedDate === cell.dateStr
                const isToday = cell.dateStr === new Date().toISOString().split('T')[0]
                const daySchedules = schedules.filter((s) => s.date === cell.dateStr)

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`h-16 rounded-2xl border p-1.5 text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-500/10 shadow-sm'
                        : 'border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${
                        isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white' : ''
                      }`}>
                        {cell.day}
                      </span>
                      {daySchedules.length > 0 && (
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">
                          {daySchedules.length}
                        </span>
                      )}
                    </div>

                    {/* Dots / mini badges */}
                    <div className="flex gap-0.5 overflow-hidden">
                      {daySchedules.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            s.type === 'real_exam'
                              ? 'bg-rose-500'
                              : s.type === 'mock_exam'
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* DAY DETAILS TIMELINE (5 COLS) */}
          <div className="lg:col-span-5 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                  Chi Tiết Lịch Trong Ngày
                </span>
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newsch-heading)' }}>
                  {new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDate(selectedDate)
                  setShowModal(true)
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 text-white px-2.5 py-1.5 text-xs font-bold shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm
              </button>
            </div>

            {/* Schedules List */}
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
              {selectedDateSchedules.length === 0 ? (
                <div className="py-16 text-center text-[#6B7280] space-y-2">
                  <Calendar className="h-10 w-10 mx-auto opacity-40" />
                  <p className="text-xs font-bold">Không có lịch học hoặc lịch thi nào trong ngày này.</p>
                </div>
              ) : (
                selectedDateSchedules.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition space-y-2.5 ${
                      item.isCompleted
                        ? 'opacity-60 bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                        : 'bg-white/90 dark:bg-slate-800/90 border-black/10 dark:border-white/15 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item.id)}
                          className={`flex h-5 w-5 items-center justify-center rounded-lg border transition ${
                            item.isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-black/20 dark:border-white/20 hover:border-emerald-500'
                          }`}
                        >
                          {item.isCompleted && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <h4 className={`text-xs font-black ${item.isCompleted ? 'line-through text-[#6B7280]' : 'text-slate-900 dark:text-white'}`}>
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                          item.type === 'real_exam'
                            ? 'bg-rose-500/15 text-rose-600'
                            : item.type === 'mock_exam'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-indigo-500/15 text-indigo-600'
                        }`}>
                          {item.type === 'real_exam' ? 'Thi chính thức' : item.type === 'mock_exam' ? 'Thi thử' : 'Lịch học'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(item.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#6B7280] dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{item.startTime} - {item.endTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        <span className="truncate">{item.room}</span>
                      </div>
                    </div>

                    {item.note && (
                      <p className="text-[11px] font-medium text-[#4B5563] dark:text-slate-300 bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-xl border border-black/5 dark:border-white/5">
                        📝 {item.note}
                      </p>
                    )}

                    {item.repeat !== 'none' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                        <Repeat className="h-3 w-3" /> Lặp lại {item.repeat === 'daily' ? 'hàng ngày' : item.repeat === 'weekly' ? 'hàng tuần' : 'hàng tháng'}
                        {item.repeatUntil ? ` đến ${new Date(item.repeatUntil).toLocaleDateString('vi-VN')}` : ''}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE SCHEDULE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newsch-heading)' }}>
              Lên Lịch Học / Lịch Thi Mới
            </h3>

            <form onSubmit={handleCreateSchedule} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="text-[#6B7280] block mb-1">Tên buổi học / Tiêu đề kỳ thi (*):</label>
                <input
                  type="text"
                  placeholder="VD: Thi thử THPT môn Toán lần 3, Học gia sư Lý..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7280] block mb-1">Môn học:</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7280] block mb-1">Phân loại:</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="study">Lịch học thường xuyên</option>
                    <option value="mock_exam">Lịch thi thử</option>
                    <option value="real_exam">Lịch thi chính thức</option>
                    <option value="review">Ôn tập chuyên đề</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#6B7280] block mb-1">Ngày bắt đầu:</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#6B7280] block mb-1">Giờ bắt đầu:</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#6B7280] block mb-1">Giờ kết thúc:</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7280] block mb-1">Phòng học / Phòng thi / Link:</label>
                  <input
                    type="text"
                    placeholder="VD: Phòng 204, Google Meet..."
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#6B7280] block mb-1">Nhắc nhở trước:</label>
                  <select
                    value={remindBefore}
                    onChange={(e) => setRemindBefore(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="0">Không nhắc</option>
                    <option value="5">5 phút trước</option>
                    <option value="15">15 phút trước</option>
                    <option value="30">30 phút trước</option>
                    <option value="60">1 tiếng trước</option>
                    <option value="1440">1 ngày trước</option>
                  </select>
                </div>
              </div>

              {/* Lặp lại */}
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280]">Lặp lại lịch:</span>
                  <select
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value as any)}
                    className="h-9 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none text-xs"
                  >
                    <option value="none">Không lặp lại</option>
                    <option value="daily">Hàng ngày</option>
                    <option value="weekly">Hàng tuần</option>
                    <option value="monthly">Hàng tháng</option>
                  </select>
                </div>

                {repeat !== 'none' && (
                  <div>
                    <label className="text-[#6B7280] block mb-1">Lặp lại đến ngày nào:</label>
                    <input
                      type="date"
                      value={repeatUntil}
                      onChange={(e) => setRepeatUntil(e.target.value)}
                      className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[#6B7280] block mb-1">Ghi chú chuẩn bị:</label>
                <textarea
                  rows={2}
                  placeholder="VD: Mang máy tính Casio fx-580, bút chì 2B, ôn tập chương 3..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-2.5 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu Lịch Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
