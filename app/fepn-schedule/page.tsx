'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Plus,
  Trash2,
  Edit3,
  Mail,
  BellRing,
  Printer,
  Search,
  BookOpen,
  GraduationCap,
  X,
  Check,
  Copy,
  ArrowLeft,
  Send,
  Loader2,
  Layers,
  ArrowRight,
  Sliders,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Bell,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

// ========================================================
// 1. DATA TYPES & INTERFACES
// ========================================================
export interface FepnScheduleSession {
  id: string
  day_of_week: 2 | 3 | 4 | 5 | 6 | 7 | 8 // 2: Thứ 2, ..., 7: Thứ 7, 8: Chủ Nhật
  shift_name: string // "Ca 1 (Tiết 1-3)", "Ca 2", ...
  start_time: string // "07:00"
  end_time: string // "09:50"
  classroom: string // "Phòng 301-G2", "Lab Nano-E3", ...
  type?: 'theory' | 'practice' | 'exercise' | 'exam' | 'other'
  lecturer?: string
  notes?: string
  shift_mode?: 'preset' | 'custom' // Chọn ca có sẵn hoặc nhập ca tùy ý
  preset_shift_id?: string // Khóa tham chiếu ca có sẵn
}

export interface FepnShiftConfig {
  id: string
  shift_name: string // "Ca 1"
  period_label: string // "Tiết 1 - 3"
  start_time: string // "07:00"
  end_time: string // "09:50"
  order_index?: number
}


export interface FepnScheduleSubject {
  id: string
  subject_id?: string
  code?: string
  name: string
  credits?: number
  color: string
  lecturers: string[]
  default_classroom: string
  sessions: FepnScheduleSession[]
  notify_email: boolean
  student_email?: string
  created_at?: string
  updated_at?: string
}

// Bảng màu nhẹ nhàng, hiện đại, đồng nhất với FEPN Dashboard
const COLOR_PALETTES: Record<
  string,
  {
    name: string
    bgGradient: string
    borderColor: string
    badgeBg: string
    badgeText: string
    accentColor: string
    cardBg: string
  }
> = {
  sky: {
    name: 'Xanh Biển FEPN (Sky)',
    bgGradient: 'from-sky-500/10 via-blue-500/10 to-indigo-500/5',
    borderColor: 'border-sky-300 dark:border-sky-800',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300',
    badgeText: 'text-sky-800 dark:text-sky-300',
    accentColor: '#0284c7',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-sky-500/50',
  },
  emerald: {
    name: 'Xanh Ngọc (Emerald)',
    bgGradient: 'from-emerald-500/10 via-teal-500/10 to-emerald-500/5',
    borderColor: 'border-emerald-300 dark:border-emerald-800',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    accentColor: '#059669',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-emerald-500/50',
  },
  indigo: {
    name: 'Xanh Chàm (Indigo)',
    bgGradient: 'from-indigo-500/10 via-blue-500/10 to-indigo-500/5',
    borderColor: 'border-indigo-300 dark:border-indigo-800',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    accentColor: '#4f46e5',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-indigo-500/50',
  },
  amber: {
    name: 'Cam Hổ Phách (Amber)',
    bgGradient: 'from-amber-500/10 via-orange-500/10 to-amber-500/5',
    borderColor: 'border-amber-300 dark:border-amber-800',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300',
    badgeText: 'text-amber-800 dark:text-amber-300',
    accentColor: '#d97706',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-amber-500/50',
  },
  rose: {
    name: 'Hồng Đào (Rose)',
    bgGradient: 'from-rose-500/10 via-pink-500/10 to-rose-500/5',
    borderColor: 'border-rose-300 dark:border-rose-800',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300',
    badgeText: 'text-rose-800 dark:text-rose-300',
    accentColor: '#e11d48',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-rose-500/50',
  },
  violet: {
    name: 'Tím Thạch Anh (Violet)',
    bgGradient: 'from-purple-500/10 via-indigo-500/10 to-purple-500/5',
    borderColor: 'border-purple-300 dark:border-purple-800',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300',
    badgeText: 'text-purple-800 dark:text-purple-300',
    accentColor: '#7c3aed',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-purple-500/50',
  },
  teal: {
    name: 'Xanh Mòng Két (Teal)',
    bgGradient: 'from-teal-500/10 via-cyan-500/10 to-teal-500/5',
    borderColor: 'border-teal-300 dark:border-teal-800',
    badgeBg: 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300',
    badgeText: 'text-teal-800 dark:text-teal-300',
    accentColor: '#0d9488',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-teal-500/50',
  },
  cyan: {
    name: 'Xanh Băng (Cyan)',
    bgGradient: 'from-cyan-500/10 via-sky-500/10 to-cyan-500/5',
    borderColor: 'border-cyan-300 dark:border-cyan-800',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    accentColor: '#0891b2',
    cardBg: 'bg-white dark:bg-slate-900 hover:border-cyan-500/50',
  },
}

// Danh sách các thứ trong tuần
const DAYS_OF_WEEK: Array<{ id: 2 | 3 | 4 | 5 | 6 | 7 | 8; name: string; shortName: string }> = [
  { id: 2, name: 'Thứ Hai', shortName: 'Thứ 2' },
  { id: 3, name: 'Thứ Ba', shortName: 'Thứ 3' },
  { id: 4, name: 'Thứ Tư', shortName: 'Thứ 4' },
  { id: 5, name: 'Thứ Năm', shortName: 'Thứ 5' },
  { id: 6, name: 'Thứ Sáu', shortName: 'Thứ 6' },
  { id: 7, name: 'Thứ Bảy', shortName: 'Thứ 7' },
  { id: 8, name: 'Chủ Nhật', shortName: 'Chủ Nhật' },
]

// Ca học mẫu chuẩn ĐHQGHN (Sinh viên có thể tùy chỉnh lại ca x từ tiết mấy tới tiết mấy và khung giờ)
export const DEFAULT_FEPN_SHIFTS: FepnShiftConfig[] = [
  { id: 'shift-1', shift_name: 'Ca 1', period_label: 'Tiết 1 - 3', start_time: '07:00', end_time: '09:50', order_index: 1 },
  { id: 'shift-2', shift_name: 'Ca 2', period_label: 'Tiết 4 - 6', start_time: '10:00', end_time: '12:50', order_index: 2 },
  { id: 'shift-3', shift_name: 'Ca 3', period_label: 'Tiết 7 - 9', start_time: '13:00', end_time: '15:50', order_index: 3 },
  { id: 'shift-4', shift_name: 'Ca 4', period_label: 'Tiết 10 - 12', start_time: '16:00', end_time: '18:50', order_index: 4 },
  { id: 'shift-5', shift_name: 'Ca 5', period_label: 'Tiết 13 - 15 (Tối)', start_time: '19:00', end_time: '21:30', order_index: 5 },
]


// Dữ liệu mẫu khởi tạo chuẩn màu sắc FEPN
const INITIAL_DEMO_SUBJECTS: FepnScheduleSubject[] = [
  {
    id: 'demo-1',
    code: 'EPN2001',
    name: 'Cơ Học Lượng Tử & Vật Lý Hạt Nhân',
    credits: 3,
    color: 'sky',
    lecturers: ['PGS.TS Nguyễn Văn Hiển', 'TS. Lê Hồng Phong'],
    default_classroom: 'Phòng 301-G2',
    notify_email: true,
    sessions: [
      {
        id: 's-1',
        day_of_week: 2,
        shift_name: 'Ca 1 (Tiết 1 - 3)',
        start_time: '07:00',
        end_time: '09:50',
        classroom: 'Phòng 301-G2 (Tòa G2)',
        type: 'theory',
        lecturer: 'PGS.TS Nguyễn Văn Hiển',
        notes: 'Lý thuyết lượng tử và phương trình Schrodinger',
      },
      {
        id: 's-2',
        day_of_week: 4,
        shift_name: 'Ca 2 (Tiết 4 - 6)',
        start_time: '10:00',
        end_time: '12:50',
        classroom: 'Lab Vật Lý 402-E3',
        type: 'practice',
        lecturer: 'TS. Lê Hồng Phong',
        notes: 'Thực hành mô phỏng phổ quang học và ma trận spin',
      },
    ],
  },
  {
    id: 'demo-2',
    code: 'EPN3005',
    name: 'Vật Lý Bán Dẫn & Công Nghệ Vi Mạch Nano',
    credits: 3,
    color: 'emerald',
    lecturers: ['GS.TS Phạm Thành Huy', 'ThS. Đỗ Thùy Linh'],
    default_classroom: 'Phòng 204-G3',
    notify_email: true,
    sessions: [
      {
        id: 's-3',
        day_of_week: 3,
        shift_name: 'Ca 3 (Tiết 7 - 9)',
        start_time: '13:00',
        end_time: '15:50',
        classroom: 'Phòng Hội Thảo 204-G3',
        type: 'theory',
        lecturer: 'GS.TS Phạm Thành Huy',
        notes: 'Cấu trúc dải năng lượng và vùng tiếp xúc p-n',
      },
      {
        id: 's-4',
        day_of_week: 6,
        shift_name: 'Ca 1 (Tiết 1 - 3)',
        start_time: '07:00',
        end_time: '09:50',
        classroom: 'Phòng Sạch Vi Chế Tạo Cleanroom E3',
        type: 'practice',
        lecturer: 'ThS. Đỗ Thùy Linh',
        notes: 'Chế tạo cảm biến FET và màng mỏng bán dẫn',
      },
    ],
  },
  {
    id: 'demo-3',
    code: 'PHY1100',
    name: 'Vật Lý Đại Cương 1 (Cơ - Nhiệt)',
    credits: 4,
    color: 'indigo',
    lecturers: ['PGS.TS Trần Quốc Bình'],
    default_classroom: 'Hội Trường 100-G2',
    notify_email: true,
    sessions: [
      {
        id: 's-5',
        day_of_week: 5,
        shift_name: 'Ca 2 (Tiết 4 - 6)',
        start_time: '10:00',
        end_time: '12:50',
        classroom: 'Hội Trường 100-G2',
        type: 'theory',
        lecturer: 'PGS.TS Trần Quốc Bình',
        notes: 'Nguyên lý chuyển động bảo toàn và nhiệt động lực học',
      },
    ],
  },
]

export default function FepnSchedulePage() {
  // 1. Auth & User State
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // 2. Schedule & Subjects State
  const [subjects, setSubjects] = useState<FepnScheduleSubject[]>([])
  const [fepnSubjectCatalog, setFepnSubjectCatalog] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'vertical' | 'grid'>('vertical')
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')

  // 3. Time & Real-time Class Tracking
  const [nowDate, setNowDate] = useState<Date>(new Date())

  // 4. Modals State
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<FepnScheduleSubject | null>(null)
  const [courseModalTab, setCourseModalTab] = useState<'fepn' | 'custom'>('fepn')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // 5. Test Email State
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null)

  // 6. Course Form State
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formCredits, setFormCredits] = useState(3)
  const [formColor, setFormColor] = useState('sky')
  const [formDefaultRoom, setFormDefaultRoom] = useState('')
  const [formLecturers, setFormLecturers] = useState<string[]>([])
  const [newLecturerInput, setNewLecturerInput] = useState('')
  const [formSessions, setFormSessions] = useState<FepnScheduleSession[]>([])
  const [formNotifyEmail, setFormNotifyEmail] = useState(true)
  const [fepnCatalogSearch, setFepnCatalogSearch] = useState('')

  // 7. General Notification Settings
  const [customNotificationEmail, setCustomNotificationEmail] = useState('')
  const [copiedSchedule, setCopiedSchedule] = useState(false)
  const [emailServerStatus, setEmailServerStatus] = useState<{
    configured: boolean
    provider: string
    details: string
    loading: boolean
  }>({ configured: false, provider: 'none', details: 'Đang kiểm tra...', loading: true })
  const [browserNotifyPermission, setBrowserNotifyPermission] = useState<'default' | 'granted' | 'denied'>('default')

  // 8. Custom Study Shifts State (Quản lý ca học tùy chỉnh)
  const [shifts, setShifts] = useState<FepnShiftConfig[]>(DEFAULT_FEPN_SHIFTS)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editingShiftsList, setEditingShiftsList] = useState<FepnShiftConfig[]>(DEFAULT_FEPN_SHIFTS)

  // ========================================================
  // 2. INITIALIZE USER & LOAD SCHEDULE
  // ========================================================
  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        setAuthLoading(true)
        const { data: userData } = await supabase.auth.getUser()
        const currentUser = userData?.user ?? null

        if (!isMounted) return

        if (currentUser) {
          setUser(currentUser)
          setCustomNotificationEmail(currentUser.email || '')
          await loadSchedule(currentUser.id, currentUser.email || '')
          await loadShifts(currentUser.id)
        } else {
          await loadSchedule('guest', '')
          await loadShifts('guest')
        }

        // Tải danh mục môn học FEPN từ bảng fepn_subjects
        try {
          const { data: subs } = await supabase
            .from('fepn_subjects')
            .select('id, code, name, credits')
            .order('name', { ascending: true })

          if (isMounted && subs && subs.length > 0) {
            setFepnSubjectCatalog(subs)
          } else if (isMounted) {
            setFepnSubjectCatalog([
              { id: 'sub-1', code: 'PHY1100', name: 'Vật Lý Đại Cương 1 (Cơ - Nhiệt)', credits: 4 },
              { id: 'sub-2', code: 'PHY1101', name: 'Vật Lý Đại Cương 2 (Điện - Quang)', credits: 4 },
              { id: 'sub-3', code: 'EPN2001', name: 'Cơ Học Lượng Tử & Vật Lý Hạt Nhân', credits: 3 },
              { id: 'sub-4', code: 'EPN2005', name: 'Vật Lý Nhiệt & Thống Kê', credits: 3 },
              { id: 'sub-5', code: 'EPN3001', name: 'Vật Lý Chất Rắn & Cấu Trúc Tinh Thể', credits: 3 },
              { id: 'sub-6', code: 'EPN3005', name: 'Vật Lý Bán Dẫn & Công Nghệ Vi Mạch', credits: 3 },
              { id: 'sub-7', code: 'EPN3010', name: 'Quang Học & Công Nghệ Laser', credits: 3 },
              { id: 'sub-8', code: 'EPN4001', name: 'Công Nghệ Vật Liệu & Linh Kiện Nano', credits: 3 },
              { id: 'sub-9', code: 'EPN4005', name: 'Thực Tập Chuyên Ngành Khoa VLKT', credits: 4 },
              { id: 'sub-10', code: 'INT1004', name: 'Tin Học Cơ Sở & Lập Trình Python', credits: 3 },
            ])
          }
        } catch {}
      } catch (e) {
        console.warn('Init schedule notice:', e)
        if (isMounted) loadSchedule('guest', '')
      } finally {
        if (isMounted) {
          setTimeout(() => setAuthLoading(false), 300)
        }
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [])

  // Cập nhật đồng hồ thời gian thực mỗi 15 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // Kiểm tra trạng thái máy chủ gửi email & quyền thông báo trình duyệt
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotifyPermission(Notification.permission)
    }

    const checkServerStatus = async () => {
      try {
        const res = await fetch('/api/fepn-schedule/send-reminders?status=1')
        if (res.ok) {
          const data = await res.json()
          setEmailServerStatus({
            configured: !!data.configured,
            provider: data.provider || 'none',
            details: data.details || '',
            loading: false,
          })
        }
      } catch (e) {
        setEmailServerStatus((prev) => ({ ...prev, loading: false }))
      }
    }
    checkServerStatus()
  }, [])

  // Tự động quét và kích hoạt nhắc nhở trước 30 phút khi sinh viên đang mở ứng dụng
  useEffect(() => {
    if (!subjects || subjects.length === 0) return

    const targetEmail = customNotificationEmail || user?.email || ''
    if (!targetEmail || !targetEmail.includes('@')) return

    const checkAndTriggerReminders = async () => {
      const now = new Date()
      const jsDay = now.getDay()
      const currentDay = jsDay === 0 ? 8 : ((jsDay + 1) as 2 | 3 | 4 | 5 | 6 | 7 | 8)
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const todayStr = now.toISOString().split('T')[0]

      const queue: any[] = []

      for (const sub of subjects) {
        if (sub.notify_email === false) continue
        for (const sess of sub.sessions) {
          if (sess.day_of_week === currentDay) {
            const [h, m] = (sess.start_time || '').split(':').map(Number)
            if (isNaN(h)) continue
            const startM = h * 60 + (m || 0)
            const diff = startM - currentMinutes

            // Cửa sổ thông báo 30 phút: từ 20 đến 35 phút trước giờ vào lớp
            if (diff >= 20 && diff <= 35) {
              const storageKey = `fepn_reminded_${sub.id}_${sess.id || sess.start_time}_${todayStr}`
              const alreadySent = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null

              if (!alreadySent) {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(storageKey, 'true')
                }

                queue.push({
                  studentEmail: targetEmail,
                  studentName: user?.user_metadata?.full_name || 'Sinh viên FEPN',
                  subjectName: sub.name,
                  subjectCode: sub.code || 'EPN',
                  shiftName: sess.shift_name,
                  startTime: sess.start_time,
                  endTime: sess.end_time,
                  classroom: sess.classroom || sub.default_classroom,
                  lecturers: sub.lecturers,
                  sessionType:
                    sess.type === 'practice'
                      ? 'Thực hành / Thí nghiệm'
                      : sess.type === 'exercise'
                      ? 'Bài tập / Thảo luận'
                      : sess.type === 'exam'
                      ? 'Kiểm tra / Thi giữa kỳ'
                      : 'Lý thuyết chính khóa',
                  notes: sess.notes,
                })

                // Thông báo trực tiếp trên màn hình máy tính/điện thoại nếu đã cấp quyền
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(`⏰ FEPN: Sắp đến giờ học môn ${sub.name}`, {
                      body: `Ca học ${sess.shift_name} (${sess.start_time} - ${sess.end_time}) tại ${sess.classroom || sub.default_classroom}.`,
                      icon: '/icons/fepn-logo.png',
                    })
                  } catch (e) {}
                }
              }
            }
          }
        }
      }

      if (queue.length > 0) {
        try {
          console.log(`[FEPN Auto-Reminder] Kích hoạt gửi nhắc nhở cho ${queue.length} ca học`)
          await fetch('/api/fepn-schedule/send-reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'batch', items: queue }),
          })
        } catch (e) {
          console.warn('[FEPN Auto-Reminder] Gửi nhắc nhở thất bại:', e)
        }
      }
    }

    checkAndTriggerReminders()
    const interval = setInterval(checkAndTriggerReminders, 30000)
    return () => clearInterval(interval)
  }, [subjects, user, customNotificationEmail])

  const handleRequestBrowserNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission()
        setBrowserNotifyPermission(perm)
        if (perm === 'granted') {
          new Notification('FEPN Schedule', {
            body: 'Đã bật thông báo trình duyệt thành công! Bạn sẽ nhận được chuông cảnh báo trước 30 phút mỗi khi sắp vào lớp.',
            icon: '/icons/fepn-logo.png',
          })
        }
      } catch (e) {
        console.warn('Lỗi xin quyền notification:', e)
      }
    }
  }

  // Tải thời khóa biểu từ Supabase & LocalStorage (Tách biệt độc lập theo User ID, không chèn demo cho tài khoản thật)
  const loadSchedule = async (userId: string, email: string) => {
    // 1. Thử tải từ Supabase nếu sinh viên đã đăng nhập
    if (userId && userId !== 'guest') {
      try {
        const { data, error } = await supabase
          .from('fepn_schedule_subjects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (!error && data) {
          const formatted: FepnScheduleSubject[] = data.map((row: any) => ({
            id: String(row.id),
            subject_id: row.subject_id || undefined,
            code: row.code || '',
            name: row.name || 'Môn học',
            credits: Number(row.credits) || 3,
            color: row.color || 'sky',
            lecturers: Array.isArray(row.lecturers) ? row.lecturers : [],
            default_classroom: row.default_classroom || '',
            sessions: Array.isArray(row.sessions) ? row.sessions : [],
            notify_email: row.notify_email !== false,
            student_email: row.student_email || email,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }))

          setSubjects(formatted)
          localStorage.setItem(`fepn_schedule_${userId}`, JSON.stringify(formatted))
          return
        }
      } catch (err) {
        console.warn('Supabase fetch schedule notice:', err)
      }
    }

    // 2. Fallback đọc từ LocalStorage
    const key = `fepn_schedule_${userId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setSubjects(parsed)
          return
        }
      } catch (e) {}
    }

    // Nếu là sinh viên đã đăng nhập nhưng chưa có môn nào trong DB: Khởi tạo trống, tuyệt đối không chèn demo
    if (userId && userId !== 'guest') {
      setSubjects([])
      localStorage.setItem(key, JSON.stringify([]))
      return
    }

    // Chỉ khi là khách vãng lai (guest) xem thử thì mới nạp dữ liệu mẫu
    const initial = INITIAL_DEMO_SUBJECTS.map((s) => ({
      ...s,
      student_email: email,
    }))
    setSubjects(initial)
    localStorage.setItem(key, JSON.stringify(initial))
  }

  // Lưu thời khóa biểu
  const saveSchedule = (newSubjects: FepnScheduleSubject[]) => {
    setSubjects(newSubjects)
    const userId = user?.id || 'guest'
    const key = `fepn_schedule_${userId}`
    localStorage.setItem(key, JSON.stringify(newSubjects))
  }

  // Tải danh sách ca học cấu hình từ Supabase & LocalStorage
  const loadShifts = async (userId: string) => {
    if (userId && userId !== 'guest') {
      try {
        const { data, error } = await supabase
          .from('fepn_schedule_shifts')
          .select('*')
          .eq('user_id', userId)
          .order('order_index', { ascending: true })

        if (!error && data && data.length > 0) {
          const formatted: FepnShiftConfig[] = data.map((d: any) => ({
            id: String(d.id),
            shift_name: d.shift_name,
            period_label: d.period_label || '',
            start_time: d.start_time,
            end_time: d.end_time,
            order_index: d.order_index,
          }))
          setShifts(formatted)
          localStorage.setItem(`fepn_schedule_shifts_${userId}`, JSON.stringify(formatted))
          return
        }
      } catch (e) {
        console.warn('Load shifts error:', e)
      }
    }

    const key = `fepn_schedule_shifts_${userId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShifts(parsed)
          return
        }
      } catch (e) {}
    }

    setShifts(DEFAULT_FEPN_SHIFTS)
  }

  const handleOpenShiftModal = () => {
    setEditingShiftsList([...shifts])
    setShowShiftModal(true)
  }

  const handleSaveShifts = async (newShifts: FepnShiftConfig[]) => {
    setShifts(newShifts)
    const userId = user?.id || 'guest'
    const key = `fepn_schedule_shifts_${userId}`
    localStorage.setItem(key, JSON.stringify(newShifts))
    setShowShiftModal(false)

    if (user?.id) {
      try {
        await supabase.from('fepn_schedule_shifts').delete().eq('user_id', user.id)
        const rows = newShifts.map((s, idx) => ({
          user_id: user.id,
          shift_name: s.shift_name.trim(),
          period_label: s.period_label.trim(),
          start_time: s.start_time,
          end_time: s.end_time,
          order_index: idx + 1,
        }))
        await supabase.from('fepn_schedule_shifts').insert(rows)
      } catch (e) {
        console.warn('Save shifts to Supabase error:', e)
      }
    }
  }

  // ========================================================
  // 3. REALTIME ACTIVE & UPCOMING CLASS CALCULATOR
  // ========================================================
  const currentFepnDay = useMemo(() => {
    const jsDay = nowDate.getDay()
    return jsDay === 0 ? 8 : ((jsDay + 1) as 2 | 3 | 4 | 5 | 6 | 7 | 8)
  }, [nowDate])

  const currentTimeMinutes = useMemo(() => {
    return nowDate.getHours() * 60 + nowDate.getMinutes()
  }, [nowDate])

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const { activeSession, upcomingSession } = useMemo(() => {
    let active: { subject: FepnScheduleSubject; session: FepnScheduleSession } | null = null
    let upcoming: { subject: FepnScheduleSubject; session: FepnScheduleSession; minutesLeft: number } | null = null
    let minDiff = Infinity

    for (const sub of subjects) {
      for (const sess of sub.sessions) {
        if (sess.day_of_week === currentFepnDay) {
          const startM = parseTimeToMinutes(sess.start_time)
          const endM = parseTimeToMinutes(sess.end_time)

          if (currentTimeMinutes >= startM && currentTimeMinutes <= endM) {
            active = { subject: sub, session: sess }
          } else if (startM > currentTimeMinutes) {
            const diff = startM - currentTimeMinutes
            if (diff <= 60 && diff < minDiff) {
              minDiff = diff
              upcoming = { subject: sub, session: sess, minutesLeft: diff }
            }
          }
        }
      }
    }

    return { activeSession: active, upcomingSession: upcoming }
  }, [subjects, currentFepnDay, currentTimeMinutes])

  // ========================================================
  // 4. MODAL & FORM HANDLERS
  // ========================================================
  const handleOpenAddModal = (initialCatalogItem?: any) => {
    setEditingCourse(null)
    if (initialCatalogItem) {
      setCourseModalTab('fepn')
      setFormName(initialCatalogItem.name)
      setFormCode(initialCatalogItem.code || '')
      setFormCredits(initialCatalogItem.credits || 3)
    } else {
      setCourseModalTab('custom')
      setFormName('')
      setFormCode('')
      setFormCredits(3)
    }
    setFormColor('sky')
    setFormDefaultRoom('Phòng 301-G2')
    setFormLecturers([])
    setNewLecturerInput('')
    const firstShift = shifts[0] || DEFAULT_FEPN_SHIFTS[0]
    setFormSessions([
      {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}-1`,
        day_of_week: 2,
        shift_mode: 'preset',
        preset_shift_id: firstShift.id,
        shift_name: `${firstShift.shift_name}${firstShift.period_label ? ` (${firstShift.period_label})` : ''}`,
        start_time: firstShift.start_time,
        end_time: firstShift.end_time,
        classroom: 'Phòng 301-G2',
        type: 'theory',
        notes: '',
      },
    ])
    setFormNotifyEmail(true)
    setShowCourseModal(true)
  }

  const handleOpenEditModal = (course: FepnScheduleSubject) => {
    setEditingCourse(course)
    setCourseModalTab(course.subject_id ? 'fepn' : 'custom')
    setFormName(course.name)
    setFormCode(course.code || '')
    setFormCredits(course.credits || 3)
    setFormColor(course.color || 'sky')
    setFormDefaultRoom(course.default_classroom || '')
    setFormLecturers(course.lecturers || [])
    setNewLecturerInput('')
    setFormSessions(
      course.sessions && course.sessions.length > 0
        ? JSON.parse(JSON.stringify(course.sessions))
        : [
            {
              id: `sess-${Date.now()}`,
              day_of_week: 2,
              shift_name: 'Ca 1 (Tiết 1 - 3)',
              start_time: '07:00',
              end_time: '09:50',
              classroom: course.default_classroom || 'Phòng 301-G2',
              type: 'theory',
            },
          ]
    )
    setFormNotifyEmail(course.notify_email ?? true)
    setShowCourseModal(true)
  }

  const handleAddLecturer = () => {
    const val = newLecturerInput.trim()
    if (!val) return
    if (!formLecturers.includes(val)) {
      setFormLecturers([...formLecturers, val])
    }
    setNewLecturerInput('')
  }

  const handleRemoveLecturer = (index: number) => {
    setFormLecturers(formLecturers.filter((_, i) => i !== index))
  }

  const handleAddSession = () => {
    const shiftToPick = shifts[formSessions.length % shifts.length] || shifts[0] || DEFAULT_FEPN_SHIFTS[0]
    const nextDay = ((formSessions.length * 2 + 2) % 7 + 2) as any
    const newSess: FepnScheduleSession = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}-${formSessions.length + 1}`,
      day_of_week: nextDay,
      shift_mode: 'preset',
      preset_shift_id: shiftToPick.id,
      shift_name: `${shiftToPick.shift_name}${shiftToPick.period_label ? ` (${shiftToPick.period_label})` : ''}`,
      start_time: shiftToPick.start_time,
      end_time: shiftToPick.end_time,
      classroom: formDefaultRoom || 'Phòng 301-G2',
      type: 'theory',
      notes: '',
    }
    setFormSessions([...formSessions, newSess])
  }

  const handleUpdateSession = (index: number, patch: Partial<FepnScheduleSession>) => {
    const updated = [...formSessions]
    updated[index] = { ...updated[index], ...patch }
    setFormSessions(updated)
  }

  const handleRemoveSession = (index: number) => {
    if (formSessions.length <= 1) {
      alert('Mỗi môn học cần có ít nhất 1 ca học trong tuần!')
      return
    }
    setFormSessions(formSessions.filter((_, i) => i !== index))
  }

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      alert('Vui lòng nhập tên môn học!')
      return
    }
    if (formSessions.length === 0) {
      alert('Vui lòng thêm ít nhất 1 ca học trong tuần cho môn này!')
      return
    }

    const emailToUse = customNotificationEmail || user?.email || 'sinhvien@vnu.edu.vn'

    if (editingCourse) {
      let savedCourse: FepnScheduleSubject | null = null
      const updatedList = subjects.map((sub) => {
        if (sub.id === editingCourse.id) {
          savedCourse = {
            ...sub,
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            credits: Number(formCredits) || 3,
            color: formColor,
            default_classroom: formDefaultRoom.trim(),
            lecturers: formLecturers,
            sessions: formSessions,
            notify_email: formNotifyEmail,
            student_email: emailToUse,
            updated_at: new Date().toISOString(),
          }
          return savedCourse
        }
        return sub
      })
      saveSchedule(updatedList)

      if (user?.id && savedCourse) {
        const sc: FepnScheduleSubject = savedCourse
        supabase
          .from('fepn_schedule_subjects')
          .upsert({
            id: sc.id,
            user_id: user.id,
            code: sc.code,
            name: sc.name,
            credits: sc.credits,
            color: sc.color,
            default_classroom: sc.default_classroom,
            lecturers: sc.lecturers,
            sessions: sc.sessions,
            notify_email: sc.notify_email,
            student_email: sc.student_email,
          })
          .then(({ error }) => {
            if (error) console.warn('Lỗi cập nhật môn học lên Supabase:', error.message)
          })
      }
    } else {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `course-${Date.now()}`
      const newCourse: FepnScheduleSubject = {
        id: newId,
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        credits: Number(formCredits) || 3,
        color: formColor,
        default_classroom: formDefaultRoom.trim(),
        lecturers: formLecturers,
        sessions: formSessions,
        notify_email: formNotifyEmail,
        student_email: emailToUse,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      saveSchedule([newCourse, ...subjects])

      if (user?.id) {
        supabase
          .from('fepn_schedule_subjects')
          .insert({
            id: newCourse.id,
            user_id: user.id,
            code: newCourse.code,
            name: newCourse.name,
            credits: newCourse.credits,
            color: newCourse.color,
            default_classroom: newCourse.default_classroom,
            lecturers: newCourse.lecturers,
            sessions: newCourse.sessions,
            notify_email: newCourse.notify_email,
            student_email: newCourse.student_email,
          })
          .then(({ error }) => {
            if (error) console.warn('Lỗi thêm môn học lên Supabase:', error.message)
          })
      }
    }

    setShowCourseModal(false)
  }

  const handleDeleteCourse = (id: string) => {
    const updated = subjects.filter((s) => s.id !== id)
    saveSchedule(updated)
    setDeleteConfirmId(null)

    if (user?.id) {
      supabase
        .from('fepn_schedule_subjects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.warn('Lỗi xóa môn học trên Supabase:', error.message)
        })
    }
  }

  // ========================================================
  // 5. TEST EMAIL REMINDER SENDER
  // ========================================================
  const handleSendTestEmail = async (customSubject?: FepnScheduleSubject) => {
    const targetEmail = customNotificationEmail || user?.email || ''
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Vui lòng nhập địa chỉ email nhận thông báo hợp lệ!')
      return
    }

    const subjectToUse = customSubject || subjects[0]
    if (!subjectToUse || !subjectToUse.sessions || subjectToUse.sessions.length === 0) {
      alert('Bạn cần có ít nhất 1 môn học và ca học trong thời khóa biểu để gửi thử nghiệm!')
      return
    }

    const firstSession = subjectToUse.sessions[0]

    setSendingTestEmail(true)
    setTestEmailResult(null)

    try {
      const payload = {
        action: 'test',
        testItem: {
          studentEmail: targetEmail,
          studentName: user?.user_metadata?.full_name || 'Sinh viên VNU',
          subjectName: subjectToUse.name,
          subjectCode: subjectToUse.code || 'EPN2001',
          shiftName: firstSession.shift_name,
          startTime: firstSession.start_time,
          endTime: firstSession.end_time,
          classroom: firstSession.classroom || subjectToUse.default_classroom,
          lecturers: subjectToUse.lecturers,
          sessionType:
            firstSession.type === 'practice'
              ? 'Thực hành / Thí nghiệm'
              : firstSession.type === 'exercise'
              ? 'Bài tập / Thảo luận'
              : firstSession.type === 'exam'
              ? 'Kiểm tra / Thi giữa kỳ'
              : 'Lý thuyết chính khóa',
          notes: firstSession.notes || 'Đây là email gửi thử nghiệm tính năng nhắc nhở 30 phút.',
        },
      }

      const res = await fetch('/api/fepn-schedule/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || `Đã gửi thành công email nhắc nhở đến "${targetEmail}". Bạn hãy kiểm tra hộp thư đến (hoặc hòm thư Spam/Quảng cáo nhé)!`,
        })
      } else {
        setTestEmailResult({
          success: false,
          message: data.message || data.error || 'Có lỗi xảy ra khi gửi email thử nghiệm.',
        })
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: 'Lỗi kết nối tới máy chủ gửi mail: ' + err.message,
      })
    } finally {
      setSendingTestEmail(false)
    }
  }

  // ========================================================
  // 6. FILTERED TIMETABLE FEED
  // ========================================================
  const scheduleByDay = useMemo(() => {
    const map = new Map<number, Array<{ subject: FepnScheduleSubject; session: FepnScheduleSession }>>()

    for (const d of DAYS_OF_WEEK) {
      map.set(d.id, [])
    }

    for (const sub of subjects) {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase()
        const matchName = sub.name.toLowerCase().includes(kw)
        const matchCode = sub.code?.toLowerCase().includes(kw)
        const matchRoom = sub.default_classroom?.toLowerCase().includes(kw)
        const matchLecturer = sub.lecturers.some((l) => l.toLowerCase().includes(kw))
        if (!matchName && !matchCode && !matchRoom && !matchLecturer) continue
      }

      for (const sess of sub.sessions) {
        const list = map.get(sess.day_of_week) || []
        list.push({ subject: sub, session: sess })
        map.set(sess.day_of_week, list)
      }
    }

    for (const [, list] of map.entries()) {
      list.sort((a, b) => parseTimeToMinutes(a.session.start_time) - parseTimeToMinutes(b.session.start_time))
    }

    return map
  }, [subjects, searchKeyword])

  // ========================================================
  // 6.1 KIỂM TRA TRÙNG LỊCH HỌC TRONG CÙNG NGÀY
  // ========================================================
  const conflictingSessionIds = useMemo(() => {
    const conflictSet = new Set<string>()
    const sessionsByDay: Record<number, Array<{ id: string; start: number; end: number }>> = {}
    
    for (const sub of subjects) {
      for (const sess of sub.sessions) {
        const start = parseTimeToMinutes(sess.start_time)
        const end = parseTimeToMinutes(sess.end_time)
        if (!sessionsByDay[sess.day_of_week]) {
          sessionsByDay[sess.day_of_week] = []
        }
        sessionsByDay[sess.day_of_week].push({ id: sess.id, start, end })
      }
    }

    for (const day in sessionsByDay) {
      const list = sessionsByDay[day]
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]
          const b = list[j]
          // Giao nhau về thời gian trong ngày
          if (a.start < b.end && b.start < a.end) {
            conflictSet.add(a.id)
            conflictSet.add(b.id)
          }
        }
      }
    }
    return conflictSet
  }, [subjects])

  // ========================================================
  // 6.2 XUẤT THỜI KHÓA BIỂU DẠNG FILE LỊCH (.ICS)
  // ========================================================
  const handleExportICalendar = () => {
    if (subjects.length === 0) {
      alert('Chưa có môn học nào trong thời khóa biểu để xuất file lịch.')
      return
    }

    const dayToIcalMap: Record<number, string> = {
      2: 'MO',
      3: 'TU',
      4: 'WE',
      5: 'TH',
      6: 'FR',
      7: 'SA',
      8: 'SU',
    }

    const now = new Date()
    const todayDay = now.getDay() === 0 ? 8 : now.getDay() + 1
    
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FEPN Schedule//SenExam//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Thời Khóa Biểu FEPN',
      'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    ]

    for (const sub of subjects) {
      for (const sess of sub.sessions) {
        const byDay = dayToIcalMap[sess.day_of_week] || 'MO'
        const [startH, startM] = sess.start_time.split(':').map(Number)
        const [endH, endM] = sess.end_time.split(':').map(Number)

        const targetDate = new Date(now)
        const diffDays = sess.day_of_week - todayDay
        targetDate.setDate(now.getDate() + diffDays)
        
        const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
        const y = targetDate.getFullYear()
        const m = pad(targetDate.getMonth() + 1)
        const d = pad(targetDate.getDate())

        const dtStart = `${y}${m}${d}T${pad(startH || 0)}${pad(startM || 0)}00`
        const dtEnd = `${y}${m}${d}T${pad(endH || 0)}${pad(endM || 0)}00`
        const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        const uid = `fepn-${sess.id}-${Date.now()}@senexam.me`

        const typeLabel =
          sess.type === 'exercise'
            ? '[Bài Tập]'
            : sess.type === 'practice'
            ? '[Thực Hành]'
            : sess.type === 'exam'
            ? '[Thi / KT]'
            : '[Lý Thuyết]'

        icsLines.push('BEGIN:VEVENT')
        icsLines.push(`UID:${uid}`)
        icsLines.push(`DTSTAMP:${stamp}`)
        icsLines.push(`DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`)
        icsLines.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`)
        icsLines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`)
        icsLines.push(`SUMMARY:${typeLabel} ${sub.name} - ${sess.shift_name}`)
        icsLines.push(`LOCATION:${sess.classroom || sub.default_classroom || 'Khoa VLKT'}`)
        icsLines.push(`DESCRIPTION:Mã môn: ${sub.code || 'N/A'}\\nGiảng viên: ${sub.lecturers.join(', ') || 'Khoa VLKT'}\\nGhi chú: ${sess.notes || ''}`)
        icsLines.push('STATUS:CONFIRMED')
        icsLines.push('END:VEVENT')
      }
    }

    icsLines.push('END:VCALENDAR')

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'thoi-khoa-bieu-fepn.ics')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCopyScheduleSummary = () => {
    let text = `📅 THỜI KHÓA BIỂU TUẦN FEPN - KHOA VẬT LÝ KỸ THUẬT\n`
    for (const day of DAYS_OF_WEEK) {
      const items = scheduleByDay.get(day.id) || []
      if (items.length > 0) {
        text += `\n📌 ${day.name.toUpperCase()}:\n`
        for (const item of items) {
          text += `  • [${item.session.start_time} - ${item.session.end_time}] ${item.subject.name} (${item.session.classroom}) - GV: ${item.subject.lecturers.join(', ') || 'Khoa VLKT'}\n`
        }
      }
    }
    navigator.clipboard.writeText(text)
    setCopiedSchedule(true)
    setTimeout(() => setCopiedSchedule(false), 2500)
  }

  // ========================================================
  // VIEW: LOADING SCREEN (ĐỒNG BỘ CÓ LOGO & NÚT VỀ DASHBOARD)
  // ========================================================
  if (authLoading) {
    return (
      <div
        className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 font-sans p-4`}
      >
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl max-w-sm w-full text-center">
          <div className="relative h-16 w-16 mx-auto">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <span className="font-bold text-sm tracking-wide text-slate-800 dark:text-slate-200">
              Đang tải FEPN Schedule...
            </span>
          </div>
          <p className="text-xs text-slate-500">Đang đồng bộ thời khóa biểu và ca học của bạn</p>
          <Link
            href="/fepn-dashboard"
            className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay về Dashboard FEPN</span>
          </Link>
        </div>
      </div>
    )
  }

  // ========================================================
  // VIEW: MAIN PAGE
  // ========================================================
  return (
    <div
      className={`min-h-screen bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 transition-colors pb-24 overflow-x-hidden print:p-0 print:m-0 print:bg-white print:text-black ${bodyFont.className}`}
    >
      {/* 1. TOP HEADER & BRANDING (NO-PRINT) */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl no-print print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/fepn-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 hover:scale-105 transition shrink-0"
              title="Quay lại FEPN Dashboard"
            >
              <Calendar className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white"
                  style={{ fontFamily: 'var(--font-fepn-heading)' }}
                >
                  FEPN Schedule
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] font-black uppercase">
                  Thời Khóa Biểu
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Lịch học tuần Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Quay về Dashboard */}
            <Link
              href="/fepn-dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
              title="Trở về Trang chủ FEPN Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-sky-600" />
              <span className="hidden sm:inline">Về Dashboard</span>
            </Link>

            {/* Nút Điều Chỉnh Ca Học */}
            <button
              type="button"
              onClick={handleOpenShiftModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-xs hover:scale-105"
              title="Tùy chỉnh các ca học: Ca x từ tiết nào tới tiết nào và thời gian"
            >
              <Clock className="h-4 w-4 text-sky-600" />
              <span className="hidden lg:inline">Chỉnh Ca Học</span>
            </button>

            {/* Nút Nhắc Nhở Email (Không rung lắc, màu xanh đồng nhất) */}
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-800 dark:text-sky-300 text-xs font-bold transition shadow-xs hover:scale-105"
              title="Cài đặt thông báo qua Email trước 30 phút"
            >
              <BellRing className="h-4 w-4 text-sky-600" />
              <span className="hidden md:inline">Nhắc Email 30p</span>
            </button>

            {/* Nút Thêm Môn Học (Xanh chuẩn đồng nhất Dashboard) */}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 transition hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Môn Học</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. PRINT-ONLY HEADER (Chỉ hiện khi In để bản in trang trọng, sạch đẹp) */}
      <div className="hidden print:block max-w-5xl mx-auto p-4 mb-4 text-center border-b-2 border-slate-900">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC CÔNG NGHỆ
        </h3>
        <h2 className="text-lg font-black uppercase text-slate-900 mt-0.5">
          KHOA VẬT LÝ KỸ THUẬT & CÔNG NGHỆ NANO
        </h2>
        <h1 className="text-xl font-black uppercase text-sky-900 mt-2">
          THỜI KHÓA BIỂU HỌC TẬP HẰNG TUẦN
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Sinh viên: <strong>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'VNU'}</strong> |
          Email: {user?.email || 'Chưa cập nhật'} | Ngày in: {nowDate.toLocaleDateString('vi-VN')}
        </p>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* BANNER REAL-TIME ACTIVE / UPCOMING CLASS TRACKER (NO-PRINT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print print:hidden">
          {/* Card Ca học đang diễn ra / Ca sắp tới (Đồng màu xanh dịu nhẹ với Dashboard) */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-500/20 text-slate-900 dark:text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider shadow-2xs">
                  <span>Trạng Thái Lớp Học Hôm Nay</span>
                </div>

                {/* Có chỉ báo ngày và giờ bên cạnh theo yêu cầu */}
                <div className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>
                    {DAYS_OF_WEEK.find((d) => d.id === currentFepnDay)?.name}, {nowDate.toLocaleDateString('vi-VN')}
                  </span>
                  <span className="font-mono font-black text-sky-600 dark:text-sky-400 ml-2">
                    • {nowDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>

              {activeSession ? (
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Đang Trong Giờ Học
                    </span>
                    {activeSession.session.type && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          activeSession.session.type === 'exercise'
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : activeSession.session.type === 'practice'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : activeSession.session.type === 'exam'
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {activeSession.session.type === 'exercise'
                          ? 'Bài Tập'
                          : activeSession.session.type === 'practice'
                          ? 'Thực Hành'
                          : activeSession.session.type === 'exam'
                          ? 'Thi / KT'
                          : 'Lý Thuyết'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1 text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    {activeSession.subject.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs mt-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="inline-flex items-center gap-1 font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-2xs">
                      <Clock className="h-3.5 w-3.5 text-sky-600" />
                      {activeSession.session.start_time} - {activeSession.session.end_time}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-400 shadow-2xs">
                      <MapPin className="h-3.5 w-3.5" />
                      {activeSession.session.classroom || activeSession.subject.default_classroom}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-2xs">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                      {activeSession.subject.lecturers.join(', ') || 'Khoa VLKT'}
                    </span>
                  </div>
                </div>
              ) : upcomingSession ? (
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-300 text-amber-800 dark:text-amber-300 text-[11px] font-black uppercase">
                      Sắp Vào Lớp (Còn {upcomingSession.minutesLeft} phút)
                    </span>
                    {upcomingSession.session.type && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          upcomingSession.session.type === 'exercise'
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : upcomingSession.session.type === 'practice'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : upcomingSession.session.type === 'exam'
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {upcomingSession.session.type === 'exercise'
                          ? 'Bài Tập'
                          : upcomingSession.session.type === 'practice'
                          ? 'Thực Hành'
                          : upcomingSession.session.type === 'exam'
                          ? 'Thi / KT'
                          : 'Lý Thuyết'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1 text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    {upcomingSession.subject.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs mt-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="inline-flex items-center gap-1 font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-2xs">
                      <Clock className="h-3.5 w-3.5 text-sky-600" />
                      Bắt đầu lúc {upcomingSession.session.start_time}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-400 shadow-2xs">
                      <MapPin className="h-3.5 w-3.5" />
                      {upcomingSession.session.classroom || upcomingSession.subject.default_classroom}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-2xs">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                      {upcomingSession.subject.lecturers.join(', ') || 'Khoa VLKT'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-3 pb-1">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Hiện không có ca học nào đang diễn ra
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Hãy kiểm tra lịch các ngày tiếp theo bên dưới để chủ động chuẩn bị tài liệu và bài tập trước khi lên lớp!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card Quản lý nhanh & Thống kê */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Tổng Quan Tuần</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[10px] font-black border border-sky-200 dark:border-sky-800">
                  Học Kỳ FEPN
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Môn Đang Học</span>
                  <p className="text-2xl font-black text-sky-600 font-mono mt-0.5">{subjects.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng Số Ca/Tuần</span>
                  <p className="text-2xl font-black text-blue-600 font-mono mt-0.5">
                    {subjects.reduce((sum, s) => sum + s.sessions.length, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyScheduleSummary}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1.5"
                title="Sao chép toàn bộ lịch học vào clipboard"
              >
                {copiedSchedule ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSchedule ? 'Đã Sao Chép' : 'Sao Chép Lịch'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1.5"
                title="Chỉ in bảng thời khóa biểu sạch đẹp"
              >
                <Printer className="h-3.5 w-3.5 text-sky-600" />
                <span>In Lịch</span>
              </button>

              <button
                type="button"
                onClick={handleExportICalendar}
                className="py-2 px-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-xs font-bold text-sky-800 dark:text-sky-300 transition flex items-center justify-center gap-1.5"
                title="Xuất lịch học dạng .ics để đồng bộ Google Calendar / Apple Calendar"
              >
                <Calendar className="h-3.5 w-3.5 text-sky-600" />
                <span className="hidden sm:inline">Xuất</span>
                <span>.ics</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. TOOLBAR: CHẾ ĐỘ XEM & BỘ LỌC NGÀY (NO-PRINT) */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print print:hidden">
          {/* Chuyển đổi chế độ xem Dọc / Bảng tuần */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('vertical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'vertical'
                  ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Dạng Dọc</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Bảng Tuần</span>
            </button>
          </div>

          {/* Lọc nhanh theo ngày & Nút Nhảy Tới Hôm Nay */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedDayFilter(currentFepnDay)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 flex items-center gap-1.5 ${
                selectedDayFilter === currentFepnDay
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
              }`}
              title="Xem ngay lịch học hôm nay"
            >
              <Clock className="h-3 w-3" />
              <span>Hôm Nay</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDayFilter(null)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedDayFilter === null
                  ? 'bg-sky-600 text-white font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Cả Tuần
            </button>
            {DAYS_OF_WEEK.map((d) => {
              const isToday = d.id === currentFepnDay
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDayFilter(d.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                    selectedDayFilter === d.id
                      ? 'bg-sky-600 text-white font-black shadow-xs'
                      : isToday
                      ? 'bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span>{d.shortName}</span>
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>}
                </button>
              )
            })}
          </div>

          {/* Tìm kiếm */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm môn, phòng, giảng viên..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            5. BẢN IN RIÊNG BIỆT (PRINT-ONLY DEDICATED TABLE)
            ======================================================== */}
        <div className="hidden print:block space-y-4">
          <table className="w-full text-left border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-black">
                <th className="p-2 border-r border-slate-300 w-24">Thứ</th>
                <th className="p-2 border-r border-slate-300 w-32">Ca / Giờ Học</th>
                <th className="p-2 border-r border-slate-300">Tên Môn Học & Mã HP</th>
                <th className="p-2 border-r border-slate-300 w-32">Phòng Học</th>
                <th className="p-2 border-r border-slate-300">Giảng Viên</th>
                <th className="p-2 w-32">Hình Thức</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {DAYS_OF_WEEK.map((day) => {
                const sessions = scheduleByDay.get(day.id) || []
                if (sessions.length === 0) return null
                return sessions.map(({ subject, session }, idx) => (
                  <tr key={`${day.id}-${session.id}`} className="break-inside-avoid">
                    {idx === 0 ? (
                      <td
                        rowSpan={sessions.length}
                        className="p-2 border-r border-slate-300 font-black align-top bg-slate-50/50"
                      >
                        {day.name}
                      </td>
                    ) : null}
                    <td className="p-2 border-r border-slate-300 font-mono font-bold">
                      {session.start_time} - {session.end_time}
                      <div className="text-[10px] font-sans text-slate-500 font-normal">{session.shift_name}</div>
                    </td>
                    <td className="p-2 border-r border-slate-300">
                      <div className="font-bold text-slate-900">{subject.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {subject.code} {subject.credits ? `• ${subject.credits} TC` : ''}
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                      {session.classroom || subject.default_classroom}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-slate-700">
                      {session.lecturer || subject.lecturers.join(', ') || 'Khoa VLKT'}
                    </td>
                    <td className="p-2 text-slate-600">
                      {session.type === 'practice'
                        ? 'Thực hành'
                        : session.type === 'exercise'
                        ? 'Bài tập'
                        : session.type === 'exam'
                        ? 'Thi / KT'
                        : 'Lý thuyết'}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>

        {/* ========================================================
            6. CHẾ ĐỘ HIỂN THỊ 1: DẠNG DỌC RỰC RỠ NHIỀU MÀU SẮC (VERTICAL SCHEDULE FEED)
            ======================================================== */}
        {viewMode === 'vertical' && (
          <div className="space-y-8 no-print print:hidden">
            {DAYS_OF_WEEK.filter((d) => selectedDayFilter === null || selectedDayFilter === d.id).map((day) => {
              const sessionsList = scheduleByDay.get(day.id) || []
              const isToday = day.id === currentFepnDay

              return (
                <div
                  key={day.id}
                  className={`p-5 sm:p-6 rounded-3xl border transition-all duration-300 ${
                    isToday
                      ? 'bg-gradient-to-b from-sky-50/50 via-white to-white dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900 border-sky-400/40 shadow-md shadow-sky-500/5 ring-1 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  {/* Tiêu đề Thứ trong tuần */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black text-sm shadow-xs ${
                          isToday
                            ? 'bg-sky-600 text-white shadow-sky-600/25'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {day.shortName.replace('Thứ ', 'T').replace('Chủ Nhật', 'CN')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white"
                            style={{ fontFamily: 'var(--font-fepn-heading)' }}
                          >
                            {day.name}
                          </h3>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-black uppercase tracking-wider">
                              Hôm Nay
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {sessionsList.length > 0
                            ? `${sessionsList.length} ca học trong ngày`
                            : 'Không có lịch học'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModal()}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/50 p-2 rounded-xl transition"
                      title="Thêm ca học cho thứ này"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Thêm Ca</span>
                    </button>
                  </div>

                  {/* Danh sách thẻ môn học dạng dọc */}
                  {sessionsList.length === 0 ? (
                    <div className="py-8 text-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-slate-400">
                      <Calendar className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-1" />
                      <p className="text-xs font-medium">Hôm nay không có môn học nào được lên lịch.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal()}
                        className="mt-2 text-xs font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm môn vào {day.name}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sessionsList.map(({ subject, session }) => {
                        const palette = COLOR_PALETTES[subject.color] || COLOR_PALETTES.sky
                        const isCurrentActive =
                          activeSession?.subject.id === subject.id && activeSession?.session.id === session.id

                        return (
                          <div
                            key={session.id}
                            className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 shadow-xs hover:shadow-md ${
                              palette.cardBg
                            } ${palette.borderColor} ${
                              isCurrentActive ? 'ring-2 ring-emerald-500 shadow-emerald-500/10' : ''
                            }`}
                          >
                            {/* Dải màu nhận diện trên đỉnh thẻ */}
                            <div
                              className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl"
                              style={{ backgroundColor: palette.accentColor }}
                            />

                            <div className="flex items-start justify-between gap-2 pt-1">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Khung giờ học to rõ */}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-black text-xs text-slate-800 dark:text-slate-200">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    {session.start_time} - {session.end_time}
                                  </span>

                                  {/* Tên Ca Học */}
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${palette.badgeBg}`}>
                                    {session.shift_name}
                                  </span>
                                   {isCurrentActive && (
                                     <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                       Đang Diễn Ra
                                     </span>
                                   )}

                                   {conflictingSessionIds.has(session.id) && (
                                     <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-1" title="Ca học này bị trùng giờ với một ca học khác trong cùng ngày">
                                       ⚠️ Trùng Giờ
                                     </span>
                                   )}

                                  {/* Loại buổi học */}
                                  {session.type && (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                        session.type === 'exercise'
                                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                          : session.type === 'practice'
                                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                          : session.type === 'exam'
                                          ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {session.type === 'exercise'
                                        ? 'Bài Tập'
                                        : session.type === 'practice'
                                        ? 'Thực Hành'
                                        : session.type === 'exam'
                                        ? 'Thi / KT'
                                        : 'Lý Thuyết'}
                                    </span>
                                  )}
                                </div>

                                {/* Tên môn học */}
                                <h4
                                  className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white pt-1"
                                  style={{ fontFamily: 'var(--font-fepn-heading)' }}
                                >
                                  {subject.name}
                                </h4>

                                {subject.code && (
                                  <p className="text-[11px] font-bold font-mono text-slate-400 tracking-wider">
                                    {subject.code} {subject.credits ? `• ${subject.credits} tín chỉ` : ''}
                                  </p>
                                )}
                              </div>

                              {/* Thao tác sửa / xóa môn */}
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(subject)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                                  title="Chỉnh sửa môn học"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(subject.id)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition"
                                  title="Xóa môn này khỏi thời khóa biểu"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Thông tin chi tiết: Phòng học & Thầy cô */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <MapPin className="h-3.5 w-3.5" />
                                </div>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {session.classroom || subject.default_classroom || 'Chưa cập nhật phòng'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 shrink-0">
                                  <UserCheck className="h-3.5 w-3.5" />
                                </div>
                                <div className="text-slate-600 dark:text-slate-400 truncate">
                                  {session.lecturer || subject.lecturers.join(', ') || 'Khoa VLKT phụ trách'}
                                </div>
                              </div>

                              {session.notes && (
                                <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                                  {session.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ========================================================
            7. CHẾ ĐỘ HIỂN THỊ 2: BẢNG LƯỚI TUẦN (WEEKLY GRID VIEW)
            ======================================================== */}
        {viewMode === 'grid' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden overflow-x-auto no-print print:hidden">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 w-32">Ca / Khung Giờ</th>
                  {DAYS_OF_WEEK.map((day) => {
                    const isToday = day.id === currentFepnDay
                    return (
                      <th
                        key={day.id}
                        className={`p-4 text-xs font-black uppercase tracking-wider ${
                          isToday
                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-x border-sky-200 dark:border-sky-800'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{day.name}</span>
                          {isToday && <span className="h-2 w-2 rounded-full bg-sky-600"></span>}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shifts.map((shift, shiftIndex) => (
                  <tr key={shift.id || shiftIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-r border-slate-200 dark:border-slate-800 align-top">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{shift.shift_name}</span>
                      {shift.period_label && (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold block">{shift.period_label}</span>
                      )}
                      <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                        {shift.start_time} - {shift.end_time}
                      </span>
                    </td>

                    {DAYS_OF_WEEK.map((day) => {
                      const isToday = day.id === currentFepnDay
                      const dayItems = scheduleByDay.get(day.id) || []
                      const shiftItems = dayItems.filter((item) => {
                        return (
                          item.session.shift_name.toLowerCase().includes(shift.shift_name.toLowerCase()) ||
                          (item.session.start_time >= shift.start_time && item.session.start_time <= shift.end_time)
                        )
                      })

                      return (
                        <td
                          key={day.id}
                          className={`p-2 align-top border-r border-slate-100 dark:border-slate-800 ${
                            isToday ? 'bg-sky-50/20 dark:bg-sky-950/10' : ''
                          }`}
                        >
                          {shiftItems.map(({ subject, session }) => {
                            const palette = COLOR_PALETTES[subject.color] || COLOR_PALETTES.sky
                            return (
                              <div
                                key={session.id}
                                onClick={() => handleOpenEditModal(subject)}
                                className={`p-2.5 rounded-xl border mb-1.5 cursor-pointer transition shadow-2xs hover:scale-102 ${
                                  palette.cardBg
                                } ${palette.borderColor}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${palette.badgeBg}`}>
                                      {session.start_time}
                                    </span>
                                    {conflictingSessionIds.has(session.id) && (
                                      <span className="text-[9px] font-black px-1 py-0.2 rounded bg-rose-500 text-white shadow-xs" title="Trùng giờ học với môn khác trong ngày">
                                        ⚠️
                                      </span>
                                    )}
                                  </div>
                                  {session.type && (
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        session.type === 'exercise'
                                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                          : session.type === 'practice'
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                          : session.type === 'exam'
                                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {session.type === 'exercise'
                                        ? 'Bài Tập'
                                        : session.type === 'practice'
                                        ? 'Thực Hành'
                                        : session.type === 'exam'
                                        ? 'Thi'
                                        : 'Lý Thuyết'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-black text-slate-900 dark:text-white mt-1 line-clamp-2">
                                  {subject.name}
                                </p>
                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{session.classroom || subject.default_classroom}</span>
                                </div>
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ========================================================
          8. MODAL CÀI ĐẶT / THÊM MÔN HỌC (FIX TRÀN MÀN HÌNH)
          ======================================================== */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-in fade-in no-print print:hidden">
          <div className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Header Modal (Pinned at top) */}
            <div className="shrink-0 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/30">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingCourse ? 'Chỉnh Sửa Môn Học' : 'Thêm Môn Học Vào Thời Khóa Biểu'}
                  </h3>
                  <p className="text-xs text-slate-500">Cấu hình nhiều phòng học, nhiều ca học & giảng viên</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveCourse} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* TAB CHỌN: TỪ FEPN HAY TỰ NHẬP */}
              {!editingCourse && (
                <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setCourseModalTab('fepn')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      courseModalTab === 'fepn'
                        ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Chọn Nhanh Từ Môn FEPN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseModalTab('custom')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      courseModalTab === 'custom'
                        ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Tự Nhập Môn Tự Chọn / Khác</span>
                  </button>
                </div>
              )}

              {/* Gợi ý chọn từ danh mục FEPN */}
              {courseModalTab === 'fepn' && !editingCourse && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-800 dark:text-sky-300">
                      Chọn môn học trong chương trình Khoa VLKT:
                    </span>
                    <span className="text-[10px] text-slate-400">{fepnSubjectCatalog.length} môn có sẵn</span>
                  </div>

                  <input
                    type="text"
                    value={fepnCatalogSearch}
                    onChange={(e) => setFepnCatalogSearch(e.target.value)}
                    placeholder="Lọc môn học theo tên hoặc mã..."
                    className="w-full px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-1 focus:ring-sky-500"
                  />

                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
                    {fepnSubjectCatalog
                      .filter(
                        (s) =>
                          !fepnCatalogSearch ||
                          s.name.toLowerCase().includes(fepnCatalogSearch.toLowerCase()) ||
                          s.code?.toLowerCase().includes(fepnCatalogSearch.toLowerCase())
                      )
                      .map((sub) => (
                        <div
                          key={sub.id}
                          onClick={() => {
                            setFormName(sub.name)
                            setFormCode(sub.code || '')
                            setFormCredits(sub.credits || 3)
                          }}
                          className={`p-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-between ${
                            formName === sub.name
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{sub.name}</span>
                          <span className="font-mono text-[11px] opacity-80">{sub.code}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* THÔNG TIN CƠ BẢN CỦA MÔN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên Môn Học *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Cơ Học Lượng Tử, Vật Lý Bán Dẫn..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mã Môn / Tín Chỉ</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="Mã (EPN2001)"
                      className="w-2/3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold uppercase outline-none focus:border-sky-500"
                    />
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={formCredits}
                      onChange={(e) => setFormCredits(Number(e.target.value))}
                      className="w-1/3 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-center outline-none focus:border-sky-500"
                      title="Số tín chỉ"
                    />
                  </div>
                </div>
              </div>

              {/* BẢNG CHỌN MÀU SẮC */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Màu Sắc Nhận Diện Môn Học:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormColor(key)}
                      className={`h-8 rounded-xl flex items-center justify-center transition hover:scale-105 border-2 ${
                        formColor === key ? 'border-slate-900 dark:border-white shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: pal.accentColor }}
                      title={pal.name}
                    >
                      {formColor === key && <Check className="h-4 w-4 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* GIẢNG VIÊN DẠY HỌC (HỖ TRỢ NHIỀU THẦY CÔ) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Giáo Viên Giảng Dạy (Hỗ trợ thêm nhiều thầy cô):</span>
                  <span className="text-[10px] text-slate-400">Nhập họ tên rồi bấm Thêm</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLecturerInput}
                    onChange={(e) => setNewLecturerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddLecturer()
                      }
                    }}
                    placeholder="VD: PGS.TS Nguyễn Văn A, TS. Trần Thị B..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLecturer}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition"
                  >
                    + Thêm Thầy/Cô
                  </button>
                </div>

                {formLecturers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formLecturers.map((lec, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{lec}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLecturer(idx)}
                          className="hover:text-rose-600 ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* THIẾT LẬP CÁC CA HỌC (NHIỀU THỜI GIAN, NHIỀU PHÒNG KHÁC NHAU) */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Lịch Học & Phòng Học (Nhiều ca trong tuần)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Có thể cài đặt nhiều phòng học và nhiều thứ khác nhau cho môn này
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-xs font-bold transition inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Buổi Học Khác</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formSessions.map((sess, idx) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 relative"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                        <span className="text-[11px] font-black uppercase text-sky-600">
                          Buổi {idx + 1} trong tuần
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Lựa chọn Ca Có Sẵn hoặc Ca Tùy Ý */}
                          <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-700/80 p-0.5 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                const matchedShift =
                                  shifts.find((s) => s.id === sess.preset_shift_id) || shifts[0] || DEFAULT_FEPN_SHIFTS[0]
                                handleUpdateSession(idx, {
                                  shift_mode: 'preset',
                                  preset_shift_id: matchedShift.id,
                                  shift_name: `${matchedShift.shift_name}${matchedShift.period_label ? ` (${matchedShift.period_label})` : ''}`,
                                  start_time: matchedShift.start_time,
                                  end_time: matchedShift.end_time,
                                })
                              }}
                              className={`px-2.5 py-0.5 rounded-md transition ${
                                sess.shift_mode !== 'custom'
                                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-2xs font-black'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              Ca Có Sẵn
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateSession(idx, {
                                  shift_mode: 'custom',
                                })
                              }}
                              className={`px-2.5 py-0.5 rounded-md transition ${
                                sess.shift_mode === 'custom'
                                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-2xs font-black'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              Ca Tùy Ý
                            </button>
                          </div>

                          {formSessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSession(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition"
                              title="Xóa buổi này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {sess.shift_mode !== 'custom' ? (
                        /* CHẾ ĐỘ 1: CHỌN CA CÓ SẴN (TỰ ĐỘNG ĐIỀN TIẾT & GIỜ) */
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          {/* Thứ trong tuần */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Thứ Trong Tuần</label>
                            <select
                              value={sess.day_of_week}
                              onChange={(e) =>
                                handleUpdateSession(idx, { day_of_week: Number(e.target.value) as any })
                              }
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                            >
                              {DAYS_OF_WEEK.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Chọn Ca có sẵn */}
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Chọn Ca Học Có Sẵn</label>
                              <button
                                type="button"
                                onClick={() => handleOpenShiftModal()}
                                className="text-[10px] font-bold text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1"
                                title="Chỉnh sửa ca x từ tiết mấy tới tiết mấy và thời gian"
                              >
                                <Sliders className="h-3 w-3" />
                                <span>Chỉnh Giờ Ca</span>
                              </button>
                            </div>
                            <select
                              value={
                                sess.preset_shift_id ||
                                shifts.find((s) => s.start_time === sess.start_time)?.id ||
                                shifts[0]?.id
                              }
                              onChange={(e) => {
                                const selectedShift = shifts.find((s) => s.id === e.target.value)
                                if (selectedShift) {
                                  handleUpdateSession(idx, {
                                    preset_shift_id: selectedShift.id,
                                    shift_name: `${selectedShift.shift_name}${selectedShift.period_label ? ` (${selectedShift.period_label})` : ''}`,
                                    start_time: selectedShift.start_time,
                                    end_time: selectedShift.end_time,
                                  })
                                }
                              }}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-xs font-bold text-sky-900 dark:text-sky-200"
                            >
                              {shifts.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.shift_name}: {s.period_label} ({s.start_time} - {s.end_time})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Khung giờ tự động */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Khung Giờ</label>
                            <div className="mt-1 px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-mono font-bold text-sky-800 dark:text-sky-300 flex items-center justify-between">
                              <span>{sess.start_time} - {sess.end_time}</span>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* CHẾ ĐỘ 2: NHẬP CA HỌC TÙY Ý */
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          {/* Thứ trong tuần */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Thứ Trong Tuần</label>
                            <select
                              value={sess.day_of_week}
                              onChange={(e) =>
                                handleUpdateSession(idx, { day_of_week: Number(e.target.value) as any })
                              }
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                            >
                              {DAYS_OF_WEEK.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tên Ca tùy ý */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Tên Ca / Tiết Học Tùy Ý</label>
                            <input
                              type="text"
                              value={sess.shift_name}
                              onChange={(e) => handleUpdateSession(idx, { shift_name: e.target.value })}
                              placeholder="VD: Ca Chiều, Phụ Đạo, Ôn Thi..."
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                            />
                          </div>

                          {/* Giờ bắt đầu tùy ý */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Giờ Bắt Đầu</label>
                            <input
                              type="time"
                              value={sess.start_time}
                              onChange={(e) => handleUpdateSession(idx, { start_time: e.target.value })}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                            />
                          </div>

                          {/* Giờ kết thúc tùy ý */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Giờ Kết Thúc</label>
                            <input
                              type="time"
                              value={sess.end_time}
                              onChange={(e) => handleUpdateSession(idx, { end_time: e.target.value })}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Phòng học riêng */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">
                            Phòng Học Buổi Này (VD: 301-G2 hoặc Lab Nano)
                          </label>
                          <input
                            type="text"
                            value={sess.classroom}
                            onChange={(e) => handleUpdateSession(idx, { classroom: e.target.value })}
                            placeholder="VD: Phòng 302-E3, Lab 402..."
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                          />
                        </div>

                        {/* Loại buổi học */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Hình Thức Buổi Học</label>
                          <select
                            value={sess.type || 'theory'}
                            onChange={(e) => handleUpdateSession(idx, { type: e.target.value as any })}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                          >
                            <option value="theory">Lý Thuyết Chính Khóa</option>
                            <option value="practice">Thực Hành / Thí Nghiệm Phòng Lab</option>
                            <option value="exercise">Bài Tập / Thảo Luận</option>
                            <option value="exam">Kiểm Tra / Thi Giữa Kỳ</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BẬT NHẬN EMAIL NHẮC 30 PHÚT */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Gửi email thông báo trước khi vào học 30 phút
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Hệ thống sẽ gửi email kèm thông tin phòng học và giáo viên phụ trách
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formNotifyEmail}
                    onChange={(e) => setFormNotifyEmail(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Pinned Footer Action Buttons */}
              <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 transition hover:scale-105"
                >
                  {editingCourse ? 'Lưu Thay Đổi' : 'Thêm Vào Lịch Học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          9. MODAL CÀI ĐẶT EMAIL & TEST GỬI EMAIL NHẮC 30 PHÚT
          ======================================================== */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-in fade-in no-print print:hidden">
          <div className="relative w-full max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Cài Đặt Email Nhắc Nhở</h3>
                  <p className="text-xs text-slate-500">Thông báo ca học trước 30 phút</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Trạng thái dịch vụ gửi email từ máy chủ */}
              {emailServerStatus.loading ? (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  <span>Đang kiểm tra kết nối dịch vụ email máy chủ...</span>
                </div>
              ) : emailServerStatus.configured ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-xs"></span>
                    Kênh gửi mail: {emailServerStatus.details}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                    Hệ thống sẽ tự động quét và gửi email nhắc nhở trước 30 phút mỗi khi đến giờ học qua Vercel Cron & Bộ điều phối thời gian thực.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    Máy chủ chưa cấu hình biến môi trường gửi email
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                    Để email có thể chuyển phát thực tế đến hộp thư sinh viên, hãy thêm biến môi trường trên Vercel:
                    <span className="block mt-1.5 font-mono text-[10px] bg-amber-100 dark:bg-amber-900/60 p-2 rounded-xl text-amber-900 dark:text-amber-200 select-all">
                      GMAIL_USER = your-email@gmail.com<br />
                      GMAIL_PASS = xxxx xxxx xxxx xxxx (Mật khẩu ứng dụng 16 chữ)<br />
                      hoặc RESEND_API_KEY = re_...
                    </span>
                  </p>
                </div>
              )}

              {/* Tùy chọn thông báo đẩy trình duyệt */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-sky-600" />
                    Chuông Báo Trên Màn Hình Trình Duyệt
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {browserNotifyPermission === 'granted'
                      ? 'Đã bật: Nhận popup cảnh báo trước 30 phút trên máy tính/điện thoại.'
                      : 'Bật để nhận popup cảnh báo 30 phút trực tiếp khi mở web.'}
                  </p>
                </div>
                {browserNotifyPermission === 'granted' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                    Đã Bật ✔
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotification}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold shrink-0 transition"
                  >
                    Bật Ngay
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Địa Chỉ Email Nhận Thông Báo:
                </label>
                <input
                  type="email"
                  value={customNotificationEmail}
                  onChange={(e) => setCustomNotificationEmail(e.target.value)}
                  placeholder="name@vnu.edu.vn hoặc email cá nhân..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">
                  Mặc định sẽ gửi về email VNU tài khoản của bạn. Bạn có thể đổi sang email cá nhân bất kỳ lúc nào.
                </p>
              </div>

              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    testEmailResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {testEmailResult.message}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSendTestEmail()}
                  disabled={sendingTestEmail}
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-2"
                >
                  {sendingTestEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Gửi Thử Email Nhắc Nhở Ngay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Lưu & Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          10. MODAL XÁC NHẬN XÓA MÔN HỌC
          ======================================================== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in no-print print:hidden">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Xác Nhận Xóa Môn Học?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ các ca học và phòng học liên quan đến môn này sẽ bị xóa khỏi thời khóa biểu của bạn.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCourse(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition"
              >
                Đồng Ý Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          11. MODAL ĐIỀU CHỈNH & CẤU HÌNH KHUNG GIỜ CA HỌC
          ======================================================== */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-in fade-in no-print print:hidden">
          <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Header Modal (Pinned at top) */}
            <div className="shrink-0 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Điều Chỉnh Khung Giờ Ca Học
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cấu hình ca x từ tiết mấy tới tiết mấy và thời gian từ mấy giờ đến mấy giờ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body: Danh sách các ca học (Cuộn độc lập) */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Danh Sách Các Ca Học Có Sẵn ({editingShiftsList.length} ca):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = editingShiftsList.length + 1
                    const newShiftItem: FepnShiftConfig = {
                      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `shift-${Date.now()}`,
                      shift_name: `Ca ${nextNum}`,
                      period_label: `Tiết ${(nextNum - 1) * 3 + 1} - ${nextNum * 3}`,
                      start_time: '12:00',
                      end_time: '14:50',
                      order_index: nextNum,
                    }
                    setEditingShiftsList([...editingShiftsList, newShiftItem])
                  }}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm Ca Mới</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {editingShiftsList.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                  >
                    {/* Tên Ca (VD: Ca 1) */}
                    <div className="sm:w-28 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tên Ca</label>
                      <input
                        type="text"
                        value={item.shift_name}
                        onChange={(e) => {
                          const updated = [...editingShiftsList]
                          updated[index] = { ...updated[index], shift_name: e.target.value }
                          setEditingShiftsList(updated)
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-sky-700 dark:text-sky-400"
                        placeholder="VD: Ca 1"
                      />
                    </div>

                    {/* Tiết học (VD: Tiết 1 - 3) */}
                    <div className="sm:w-36 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Từ Tiết - Đến Tiết</label>
                      <input
                        type="text"
                        value={item.period_label}
                        onChange={(e) => {
                          const updated = [...editingShiftsList]
                          updated[index] = { ...updated[index], period_label: e.target.value }
                          setEditingShiftsList(updated)
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                        placeholder="VD: Tiết 1 - 3"
                      />
                    </div>

                    {/* Giờ bắt đầu */}
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Bắt Đầu</label>
                      <input
                        type="time"
                        value={item.start_time}
                        onChange={(e) => {
                          const updated = [...editingShiftsList]
                          updated[index] = { ...updated[index], start_time: e.target.value }
                          setEditingShiftsList(updated)
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                    </div>

                    {/* Giờ kết thúc */}
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Kết Thúc</label>
                      <input
                        type="time"
                        value={item.end_time}
                        onChange={(e) => {
                          const updated = [...editingShiftsList]
                          updated[index] = { ...updated[index], end_time: e.target.value }
                          setEditingShiftsList(updated)
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                    </div>

                    {/* Nút Xóa Ca */}
                    {editingShiftsList.length > 1 && (
                      <div className="sm:self-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShiftsList(editingShiftsList.filter((_, i) => i !== index))
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                          title="Xóa ca này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setEditingShiftsList(DEFAULT_FEPN_SHIFTS)}
                  className="text-xs font-bold text-slate-500 hover:text-sky-600 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Khôi phục 5 ca mặc định ĐHQGHN</span>
                </button>
              </div>
            </div>

            {/* Pinned Footer Action Buttons */}
            <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveShifts(editingShiftsList)}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 transition hover:scale-105"
              >
                Lưu Cấu Hình Ca Học
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
