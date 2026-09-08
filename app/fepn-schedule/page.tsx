'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Users,
  Plus,
  Trash2,
  Edit3,
  Mail,
  Bell,
  BellRing,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer,
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  X,
  ChevronRight,
  Info,
  RefreshCw,
  Layers,
  Check,
  Copy,
  AlertTriangle,
  ArrowRight,
  Volume2,
  Send,
  Loader2,
  SlidersHorizontal,
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
}

export interface FepnScheduleSubject {
  id: string
  subject_id?: string
  code?: string
  name: string
  credits?: number
  color: string // color theme key
  lecturers: string[]
  default_classroom: string
  sessions: FepnScheduleSession[]
  notify_email: boolean
  student_email?: string
  created_at?: string
  updated_at?: string
}

// Bảng màu gradient phong phú rực rỡ dạng dọc
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
  rose: {
    name: 'Hồng Đào (Rose)',
    bgGradient: 'from-rose-500/15 via-pink-500/10 to-rose-500/5',
    borderColor: 'border-rose-400/40',
    badgeBg: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
    badgeText: 'text-rose-700 dark:text-rose-300',
    accentColor: '#f43f5e',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-rose-500/60',
  },
  violet: {
    name: 'Tím Thạch Anh (Violet)',
    bgGradient: 'from-purple-500/15 via-indigo-500/10 to-purple-500/5',
    borderColor: 'border-purple-400/40',
    badgeBg: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
    badgeText: 'text-purple-700 dark:text-purple-300',
    accentColor: '#8b5cf6',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-purple-500/60',
  },
  sky: {
    name: 'Xanh Đại Dương (Sky)',
    bgGradient: 'from-sky-500/15 via-blue-500/10 to-sky-500/5',
    borderColor: 'border-sky-400/40',
    badgeBg: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
    badgeText: 'text-sky-700 dark:text-sky-300',
    accentColor: '#0ea5e9',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-sky-500/60',
  },
  emerald: {
    name: 'Xanh Ngọc Bích (Emerald)',
    bgGradient: 'from-emerald-500/15 via-teal-500/10 to-emerald-500/5',
    borderColor: 'border-emerald-400/40',
    badgeBg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    accentColor: '#10b981',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-emerald-500/60',
  },
  amber: {
    name: 'Cam Hổ Phách (Amber)',
    bgGradient: 'from-amber-500/15 via-orange-500/10 to-amber-500/5',
    borderColor: 'border-amber-400/40',
    badgeBg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    badgeText: 'text-amber-700 dark:text-amber-300',
    accentColor: '#f59e0b',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-amber-500/60',
  },
  cyan: {
    name: 'Xanh Băng (Cyan)',
    bgGradient: 'from-cyan-500/15 via-sky-500/10 to-cyan-500/5',
    borderColor: 'border-cyan-400/40',
    badgeBg: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    accentColor: '#06b6d4',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-cyan-500/60',
  },
  fuchsia: {
    name: 'Hồng Fuchsia (Neon)',
    bgGradient: 'from-fuchsia-500/15 via-pink-500/10 to-fuchsia-500/5',
    borderColor: 'border-fuchsia-400/40',
    badgeBg: 'bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300',
    badgeText: 'text-fuchsia-700 dark:text-fuchsia-300',
    accentColor: '#d946ef',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-fuchsia-500/60',
  },
  indigo: {
    name: 'Xanh Chàm (Indigo)',
    bgGradient: 'from-indigo-500/15 via-purple-500/10 to-indigo-500/5',
    borderColor: 'border-indigo-400/40',
    badgeBg: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    accentColor: '#6366f1',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 hover:border-indigo-500/60',
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

// Ca học mẫu chuẩn ĐHQGHN
const DEFAULT_SHIFTS = [
  { name: 'Ca 1 (Tiết 1 - 3)', start: '07:00', end: '09:50' },
  { name: 'Ca 2 (Tiết 4 - 6)', start: '10:00', end: '12:50' },
  { name: 'Ca 3 (Tiết 7 - 9)', start: '13:00', end: '15:50' },
  { name: 'Ca 4 (Tiết 10 - 12)', start: '16:00', end: '18:50' },
  { name: 'Ca 5 (Tối: Tiết 13 - 15)', start: '19:00', end: '21:30' },
]

// Dữ liệu mẫu khởi tạo ấn tượng nếu sinh viên chưa có môn
const INITIAL_DEMO_SUBJECTS: FepnScheduleSubject[] = [
  {
    id: 'demo-1',
    code: 'EPN2001',
    name: 'Cơ Học Lượng Tử & Vật Lý Hạt Nhân',
    credits: 3,
    color: 'violet',
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
    color: 'sky',
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
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading')

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
  const [formColor, setFormColor] = useState('violet')
  const [formDefaultRoom, setFormDefaultRoom] = useState('')
  const [formLecturers, setFormLecturers] = useState<string[]>([])
  const [newLecturerInput, setNewLecturerInput] = useState('')
  const [formSessions, setFormSessions] = useState<FepnScheduleSession[]>([])
  const [formNotifyEmail, setFormNotifyEmail] = useState(true)
  const [fepnCatalogSearch, setFepnCatalogSearch] = useState('')

  // 7. General Notification Settings
  const [emailAlertEnabled, setEmailAlertEnabled] = useState(true)
  const [customNotificationEmail, setCustomNotificationEmail] = useState('')
  const [copiedSchedule, setCopiedSchedule] = useState(false)

  // ========================================================
  // 2. INITIALIZE USER & LOAD SCHEDULE
  // ========================================================
  useEffect(() => {
    const init = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const currentUser = userData?.user ?? null

        if (currentUser) {
          setUser(currentUser)
          setAuthStatus('authenticated')
          setCustomNotificationEmail(currentUser.email || '')
          loadSchedule(currentUser.id, currentUser.email || '')
        } else {
          setAuthStatus('guest')
          loadSchedule('guest', '')
        }

        // Tải danh mục môn học FEPN từ bảng fepn_subjects
        const { data: subs } = await supabase
          .from('fepn_subjects')
          .select('id, code, name, credits')
          .order('name', { ascending: true })

        if (subs && subs.length > 0) {
          setFepnSubjectCatalog(subs)
        } else {
          // Fallback catalog chuẩn FEPN
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
      } catch (e) {
        console.warn('Init error, using fallback:', e)
        setAuthStatus('guest')
        loadSchedule('guest', '')
      }
    }

    init()
  }, [])

  // Cập nhật đồng hồ thời gian thực mỗi 15 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // Tải thời khóa biểu từ localStorage hoặc Supabase
  const loadSchedule = (userId: string, email: string) => {
    const key = `fepn_schedule_${userId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSubjects(parsed)
          return
        }
      } catch (e) {}
    }

    // Nếu chưa có, gán dữ liệu mẫu sinh động để sinh viên trải nghiệm ngay
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

  // ========================================================
  // 3. REALTIME ACTIVE & UPCOMING CLASS CALCULATOR
  // ========================================================
  // Chuyển thứ JavaScript (0 = CN, 1 = T2) sang hệ FEPN (2 = T2, 8 = CN)
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

  // Tìm ca học hiện tại đang diễn ra và ca sắp diễn ra trong 60 phút
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
    setFormColor('violet')
    setFormDefaultRoom('Phòng 301-G2')
    setFormLecturers([])
    setNewLecturerInput('')
    setFormSessions([
      {
        id: `sess-${Date.now()}-1`,
        day_of_week: 2,
        shift_name: 'Ca 1 (Tiết 1 - 3)',
        start_time: '07:00',
        end_time: '09:50',
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
    setFormColor(course.color || 'violet')
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
    const newSess: FepnScheduleSession = {
      id: `sess-${Date.now()}-${formSessions.length + 1}`,
      day_of_week: 4,
      shift_name: 'Ca 2 (Tiết 4 - 6)',
      start_time: '10:00',
      end_time: '12:50',
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
      // Cập nhật môn học hiện có
      const updatedList = subjects.map((sub) => {
        if (sub.id === editingCourse.id) {
          return {
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
        }
        return sub
      })
      saveSchedule(updatedList)
    } else {
      // Thêm môn học mới
      const newCourse: FepnScheduleSubject = {
        id: `course-${Date.now()}`,
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
    }

    setShowCourseModal(false)
  }

  const handleDeleteCourse = (id: string) => {
    const updated = subjects.filter((s) => s.id !== id)
    saveSchedule(updated)
    setDeleteConfirmId(null)
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
          sessionType: firstSession.type === 'practice' ? 'Thực hành / Thí nghiệm' : 'Lý thuyết',
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
          message: `Đã gửi thành công email nhắc nhở mô phỏng đến "${targetEmail}". Bạn hãy kiểm tra hộp thư đến (hoặc hòm thư Spam/Quảng cáo nhé)!`,
        })
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || 'Có lỗi xảy ra khi gửi email thử nghiệm.',
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
  // 6. FILTERED TIMETABLE FEED (DẠNG DỌC CHỦ ĐẠO)
  // ========================================================
  // Nhóm các ca học theo từng ngày trong tuần (Thứ 2 -> Chủ Nhật)
  const scheduleByDay = useMemo(() => {
    const map = new Map<number, Array<{ subject: FepnScheduleSubject; session: FepnScheduleSession }>>()

    for (const d of DAYS_OF_WEEK) {
      map.set(d.id, [])
    }

    for (const sub of subjects) {
      // Lọc theo từ khóa tìm kiếm (nếu có)
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

    // Sắp xếp các ca học trong mỗi ngày theo thời gian bắt đầu (07:00 -> 19:00)
    for (const [dayId, list] of map.entries()) {
      list.sort((a, b) => parseTimeToMinutes(a.session.start_time) - parseTimeToMinutes(b.session.start_time))
    }

    return map
  }, [subjects, searchKeyword])

  // Sao chép tóm tắt thời khóa biểu
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
  // RENDER GIAO DIỆN CHÍNH
  // ========================================================
  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-24 ${bodyFont.className}`}
    >
      {/* 1. TOP HEADER & BRANDING */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/fepn-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-600 text-white shadow-md shadow-indigo-500/20 hover:scale-105 transition"
              title="Quay lại FEPN Dashboard"
            >
              <Calendar className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 bg-clip-text text-transparent"
                  style={{ fontFamily: 'var(--font-fepn-heading)' }}
                >
                  FEPN Schedule
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[10px] font-black uppercase">
                  Thời Khóa Biểu
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Lịch học tuần Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Nhắc Nhở Email */}
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 text-violet-700 dark:text-violet-300 text-xs font-bold transition shadow-xs hover:scale-105"
              title="Cài đặt thông báo qua Email trước 30 phút"
            >
              <BellRing className="h-4 w-4 text-violet-600 animate-bounce" />
              <span className="hidden md:inline">Nhắc Email 30p</span>
            </button>

            {/* Nút Thêm Môn Học */}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 transition hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Môn Học</span>
            </button>

            {/* Quay về Dashboard */}
            <Link
              href="/fepn-dashboard"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Trở về Trang chủ FEPN"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* BANNER REAL-TIME ACTIVE / UPCOMING CLASS TRACKER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card Ca học đang diễn ra / Ca sắp tới */}
          <div className="lg:col-span-2 p-5 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Trạng Thái Lớp Học Hôm Nay ({DAYS_OF_WEEK.find((d) => d.id === currentFepnDay)?.name})</span>
                </div>
                <div className="text-right font-mono text-xs font-bold text-white/90">
                  {nowDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>

              {activeSession ? (
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                      Đang Trong Giờ Học
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    {activeSession.subject.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs mt-2 text-white/90 font-medium">
                    <span className="inline-flex items-center gap-1 font-mono font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3.5 w-3.5" />
                      {activeSession.session.start_time} - {activeSession.session.end_time}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                      <MapPin className="h-3.5 w-3.5 text-amber-300" />
                      {activeSession.session.classroom || activeSession.subject.default_classroom}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg">
                      <UserCheck className="h-3.5 w-3.5" />
                      {activeSession.subject.lecturers.join(', ') || 'Khoa VLKT'}
                    </span>
                  </div>
                </div>
              ) : upcomingSession ? (
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black uppercase">
                      ⏰ Sắp Vào Lớp (Còn {upcomingSession.minutesLeft} phút)
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    {upcomingSession.subject.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs mt-2 text-white/90 font-medium">
                    <span className="inline-flex items-center gap-1 font-mono font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3.5 w-3.5" />
                      Bắt đầu lúc {upcomingSession.session.start_time}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                      <MapPin className="h-3.5 w-3.5 text-amber-300" />
                      {upcomingSession.session.classroom || upcomingSession.subject.default_classroom}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg">
                      <UserCheck className="h-3.5 w-3.5" />
                      {upcomingSession.subject.lecturers.join(', ') || 'Khoa VLKT'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-3 pb-1">
                  <h2 className="text-lg sm:text-xl font-black" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Hiện không có ca học nào đang diễn ra
                  </h2>
                  <p className="text-xs text-white/80 mt-1">
                    Hãy kiểm tra lịch các ngày tiếp theo bên dưới để chủ động chuẩn bị tài liệu và bài tập trước khi lên lớp!
                  </p>
                </div>
              )}
            </div>

            {/* Decorative background glow */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Card Quản lý nhanh & Thống kê */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Tổng Quan Tuần</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[10px] font-black">
                  Học Kỳ FEPN
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Môn Đang Học</span>
                  <p className="text-2xl font-black text-violet-600 font-mono mt-0.5">{subjects.length}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng Số Ca/Tuần</span>
                  <p className="text-2xl font-black text-indigo-600 font-mono mt-0.5">
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
                title="In thời khóa biểu"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>In Lịch</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. TOOLBAR: CHẾ ĐỘ XEM & BỘ LỌC NGÀY */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Chuyển đổi chế độ xem Dọc / Bảng tuần */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('vertical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'vertical'
                  ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Dạng Dọc Theo Ngày</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Bảng Lưới Tuần</span>
            </button>
          </div>

          {/* Lọc nhanh theo ngày */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedDayFilter(null)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedDayFilter === null
                  ? 'bg-violet-600 text-white font-black shadow-xs'
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
                      ? 'bg-violet-600 text-white font-black shadow-xs'
                      : isToday
                      ? 'bg-violet-50 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span>{d.shortName}</span>
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>}
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
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
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
            4. CHẾ ĐỘ HIỂN THỊ 1: DẠNG DỌC RỰC RỠ NHIỀU MÀU SẮC (VERTICAL SCHEDULE FEED)
            ======================================================== */}
        {viewMode === 'vertical' && (
          <div className="space-y-8">
            {DAYS_OF_WEEK.filter((d) => selectedDayFilter === null || selectedDayFilter === d.id).map((day) => {
              const sessionsList = scheduleByDay.get(day.id) || []
              const isToday = day.id === currentFepnDay

              return (
                <div
                  key={day.id}
                  className={`p-5 sm:p-6 rounded-3xl border transition-all duration-300 ${
                    isToday
                      ? 'bg-gradient-to-b from-violet-50/50 via-white to-white dark:from-violet-950/20 dark:via-slate-900 dark:to-slate-900 border-violet-500/40 shadow-lg shadow-violet-500/5 ring-1 ring-violet-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  {/* Tiêu đề Thứ trong tuần */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl font-black text-sm shadow-xs ${
                          isToday
                            ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-violet-500/25'
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
                            <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
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
                      className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/50 p-2 rounded-xl transition"
                      title="Thêm ca học cho thứ này"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Thêm Ca</span>
                    </button>
                  </div>

                  {/* Danh sách thẻ môn học dạng dọc nhiều màu sắc */}
                  {sessionsList.length === 0 ? (
                    <div className="py-8 text-center rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-slate-400">
                      <Calendar className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 mb-1" />
                      <p className="text-xs font-medium">Hôm nay không có môn học nào được lên lịch.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal()}
                        className="mt-2 text-xs font-bold text-violet-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm môn vào {day.name}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sessionsList.map(({ subject, session }) => {
                        const palette = COLOR_PALETTES[subject.color] || COLOR_PALETTES.violet
                        const isCurrentActive =
                          activeSession?.subject.id === subject.id && activeSession?.session.id === session.id

                        return (
                          <div
                            key={session.id}
                            className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 shadow-sm hover:shadow-md ${
                              palette.cardBg
                            } ${palette.borderColor} ${
                              isCurrentActive
                                ? 'ring-2 ring-emerald-500 shadow-emerald-500/10'
                                : ''
                            }`}
                          >
                            {/* Dải màu Gradient Banner */}
                            <div
                              className={`absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r ${palette.bgGradient}`}
                              style={{ backgroundColor: palette.accentColor }}
                            />

                            <div className="flex items-start justify-between gap-2 pt-1">
                              <div className="space-y-1">
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

                                  {/* Loại buổi học */}
                                  {session.type && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      {session.type === 'practice'
                                        ? 'Thực Hành'
                                        : session.type === 'exam'
                                        ? 'Thi / Kiểm Tra'
                                        : 'Lý Thuyết'}
                                    </span>
                                  )}

                                  {isCurrentActive && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                                      Đang Diễn Ra
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
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 shrink-0">
                                  <UserCheck className="h-3.5 w-3.5" />
                                </div>
                                <div className="text-slate-600 dark:text-slate-400 truncate">
                                  {session.lecturer || subject.lecturers.join(', ') || 'Khoa VLKT phụ trách'}
                                </div>
                              </div>

                              {session.notes && (
                                <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                                  📝 {session.notes}
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
            5. CHẾ ĐỘ HIỂN THỊ 2: BẢNG LƯỚI TUẦN (WEEKLY GRID VIEW)
            ======================================================== */}
        {viewMode === 'grid' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden overflow-x-auto">
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
                            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-x border-violet-200 dark:border-violet-800'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{day.name}</span>
                          {isToday && <span className="h-2 w-2 rounded-full bg-violet-600"></span>}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEFAULT_SHIFTS.map((shift, shiftIndex) => (
                  <tr key={shiftIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-r border-slate-200 dark:border-slate-800 align-top">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{shift.name}</span>
                      <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                        {shift.start} - {shift.end}
                      </span>
                    </td>

                    {DAYS_OF_WEEK.map((day) => {
                      const isToday = day.id === currentFepnDay
                      const dayItems = scheduleByDay.get(day.id) || []
                      const shiftItems = dayItems.filter((item) => {
                        return (
                          item.session.shift_name.includes(`Ca ${shiftIndex + 1}`) ||
                          (item.session.start_time >= shift.start && item.session.start_time <= shift.end)
                        )
                      })

                      return (
                        <td
                          key={day.id}
                          className={`p-2 align-top border-r border-slate-100 dark:border-slate-800 ${
                            isToday ? 'bg-violet-50/20 dark:bg-violet-950/10' : ''
                          }`}
                        >
                          {shiftItems.map(({ subject, session }) => {
                            const palette = COLOR_PALETTES[subject.color] || COLOR_PALETTES.violet
                            return (
                              <div
                                key={session.id}
                                onClick={() => handleOpenEditModal(subject)}
                                className={`p-2.5 rounded-xl border mb-1.5 cursor-pointer transition shadow-2xs hover:scale-102 ${
                                  palette.cardBg
                                } ${palette.borderColor}`}
                              >
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${palette.badgeBg}`}>
                                  {session.start_time}
                                </span>
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
          6. MODAL CÀI ĐẶT / THÊM MÔN HỌC
          ======================================================== */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            {/* Header Modal */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
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

            <form onSubmit={handleSaveCourse} className="p-5 sm:p-6 space-y-6">
              {/* TAB CHỌN: TỪ FEPN HAY TỰ NHẬP */}
              {!editingCourse && (
                <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setCourseModalTab('fepn')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      courseModalTab === 'fepn'
                        ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs font-black'
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
                        ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-xs font-black'
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
                <div className="space-y-2 p-3.5 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/70 dark:border-violet-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-violet-800 dark:text-violet-300">
                      Chọn môn học trong chương trình Khoa VLKT:
                    </span>
                    <span className="text-[10px] text-slate-400">{fepnSubjectCatalog.length} môn có sẵn</span>
                  </div>

                  <input
                    type="text"
                    value={fepnCatalogSearch}
                    onChange={(e) => setFepnCatalogSearch(e.target.value)}
                    placeholder="Lọc môn học theo tên hoặc mã..."
                    className="w-full px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-1 focus:ring-violet-500"
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
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
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
                      className="w-2/3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold uppercase outline-none focus:border-violet-500"
                    />
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={formCredits}
                      onChange={(e) => setFormCredits(Number(e.target.value))}
                      className="w-1/3 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-center outline-none focus:border-violet-500"
                      title="Số tín chỉ"
                    />
                  </div>
                </div>
              </div>

              {/* BẢNG CHỌN MÀU SẮC RỰC RỠ */}
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
                      className={`h-9 rounded-xl flex items-center justify-center transition hover:scale-105 border-2 ${
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
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLecturer}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
                  >
                    + Thêm Thầy/Cô
                  </button>
                </div>

                {/* Danh sách thẻ giảng viên đã thêm */}
                {formLecturers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formLecturers.map((lec, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-bold border border-violet-200 dark:border-violet-800"
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
                    className="px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 text-violet-700 dark:text-violet-300 text-xs font-bold transition inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Buổi Học Khác</span>
                  </button>
                </div>

                {/* Danh sách các buổi học */}
                <div className="space-y-3">
                  {formSessions.map((sess, idx) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-violet-600">
                          Buổi {idx + 1} trong tuần
                        </span>
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

                        {/* Tên Ca Học */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Ca / Tiết</label>
                          <input
                            type="text"
                            value={sess.shift_name}
                            onChange={(e) => handleUpdateSession(idx, { shift_name: e.target.value })}
                            placeholder="Ca 1 (Tiết 1-3)"
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                          />
                        </div>

                        {/* Giờ bắt đầu */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Giờ Bắt Đầu</label>
                          <input
                            type="time"
                            value={sess.start_time}
                            onChange={(e) => handleUpdateSession(idx, { start_time: e.target.value })}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                          />
                        </div>

                        {/* Giờ kết thúc */}
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Phòng học riêng cho buổi này */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">
                            Phòng Học Buổi Này (Ví dụ: 301-G2 hoặc Lab Nano)
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
                  <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600">
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
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {/* FOOTER ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105"
                >
                  {editingCourse ? 'Lưu Thay Đổi' : 'Thêm Vào Lịch Học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          7. MODAL CÀI ĐẶT EMAIL & TEST GỬI EMAIL NHẮC 30 PHÚT
          ======================================================== */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600">
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

            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-xs text-sky-800 dark:text-sky-300 font-medium">
                💡 Hệ thống được tối ưu kiểm soát nhịp gửi (batching 5 mail/lần, delay 600ms) để không bao giờ bị nghẽn hay quá tải khi gửi cùng lúc nhiều sinh viên.
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-violet-500 text-slate-900 dark:text-white"
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
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition flex items-center justify-center gap-2"
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
          8. MODAL XÁC NHẬN XÓA MÔN HỌC
          ======================================================== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in">
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
    </div>
  )
}
