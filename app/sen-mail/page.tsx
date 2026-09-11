'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { isDomainEmail } from '@/lib/authHelper'
import FepnMobileNav from '@/components/FepnMobileNav'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  Inbox,
  Send,
  Star,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertCircle,
  Search,
  Plus,
  ArrowLeft,
  Paperclip,
  Tag,
  Folder,
  Shield,
  ShieldCheck,
  LogOut,
  Mail,
  FileText,
  User,
  AtSign,
  Briefcase,
  CheckSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  X,
  Reply,
  Forward,
  MoreVertical,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export interface MailMessage {
  id: string
  sender_name: string
  sender_email: string
  recipient_email: string
  subject: string
  content: string
  created_at: string
  is_read: boolean
  is_starred: boolean
  folder: 'inbox' | 'sent' | 'trash'
  category: 'lab' | 'project' | 'faculty' | 'urgent' | 'general'
  priority: 'high' | 'normal' | 'low'
  has_attachment?: boolean
  attachment_name?: string
}

export interface WorkTask {
  id: string
  title: string
  description: string
  due_date: string
  priority: 'high' | 'normal' | 'low'
  status: 'todo' | 'in_progress' | 'completed'
  category: 'lab' | 'project' | 'faculty' | 'urgent' | 'general'
  created_at: string
}

export default function SenMailPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'inbox' | 'tasks' | 'starred' | 'sent' | 'trash'>('inbox')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Mail Data
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [showComposeModal, setShowComposeModal] = useState(false)

  // Tasks Data
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'pending' | 'completed'>('all')

  // Compose Form state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeCategory, setComposeCategory] = useState<'lab' | 'project' | 'faculty' | 'urgent' | 'general'>('general')
  const [composePriority, setComposePriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [composeBody, setComposeBody] = useState('')
  const [composeCreateTask, setComposeCreateTask] = useState(false)
  const [sendingMail, setSendingMail] = useState(false)

  // Task Form state
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [newTaskCategory, setNewTaskCategory] = useState<'lab' | 'project' | 'faculty' | 'urgent' | 'general'>('lab')

  // Reply state
  const [replyContent, setReplyContent] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  // Quick Notification
  const [notification, setNotification] = useState<string | null>(null)

  const showToast = (text: string) => {
    setNotification(text)
    setTimeout(() => setNotification(null), 3500)
  }

  // 1. Check Authentication & Domain Access
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/fepn-login?next=/sen-mail')
          return
        }

        setCurrentUser(user)
        const email = user.email || ''
        setUserEmail(email)

        // Tải dữ liệu thư và công việc
        loadMailData(email)
        loadTasksData(email)
      } catch (err) {
        console.error('Auth error in sen-mail:', err)
      } finally {
        setLoadingAuth(false)
      }
    }

    initAuth()
  }, [router])

  // 2. Load Mail Data (LocalStorage / Remote seed)
  const loadMailData = (email: string) => {
    const storageKey = `senmail_messages_${email || 'default'}`
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          return
        }
      }
    } catch (e) {}

    // Initial Seed Data
    const seedMessages: MailMessage[] = [
      {
        id: 'msg-welcome',
        sender_name: 'Quản Trị Hệ Thống FEPN',
        sender_email: 'admin@senexam.me',
        recipient_email: email,
        subject: 'Chào mừng bạn đến với Hòm Thư Đặc Quyền Sen Mail ⚡',
        content: `Kính gửi Cán bộ / Sinh viên Khoa Vật lý Kỹ thuật & Công nghệ Nano,\n\nBạn đang sử dụng hòm thư công việc Sen Mail dành riêng cho các tài khoản email đuôi tên miền (@fepn.edu.vn, @senexam.me, @vlkt.vnu.edu.vn).\n\nĐặc quyền của hòm thư Sen Mail:\n1. Đăng nhập trực tiếp bảo mật không cần chờ mã OTP hoặc Authenticator.\n2. Tích hợp bảng phân công nhiệm vụ và quản lý công việc (Work Tasks / To-Do).\n3. Kết nối trực tiếp với Kho học liệu FEPN, Lịch học và Hội đồng đề tài nghiên cứu.\n\nChúc bạn có một kỳ làm việc và học tập hiệu quả!\n\nTrân trọng,\nBan Điều Hành SenExam & Khoa FEPN.`,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        is_read: false,
        is_starred: true,
        folder: 'inbox',
        category: 'faculty',
        priority: 'high',
        has_attachment: true,
        attachment_name: 'Huong_dan_su_dung_SenMail_FEPN.pdf',
      },
      {
        id: 'msg-lab-nano',
        sender_name: 'Phòng Lab Công Nghệ Nano (402-E3)',
        sender_email: 'nano.lab@fepn.edu.vn',
        recipient_email: email,
        subject: 'Bàn giao thiết bị kính hiển vi AFM & Chuẩn bị vật liệu thí nghiệm tuần 8',
        content: `Kính gửi Thầy/Cô và các bạn sinh viên Lab 402,\n\nPhòng thí nghiệm đã hiệu chuẩn xong hệ thống kính hiển vi lực nguyên tử (AFM) và máy đo phổ huỳnh quang. Đề nghị các nhóm thực hiện đề tài màng mỏng oxit bán dẫn kiểm tra lịch và đăng ký ca sử dụng máy trước Thứ Sáu tuần này.\n\nDanh sách mẫu thí nghiệm đã được xếp tại tủ mát số 2.\n\nKỹ thuật viên Lab Nano.`,
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        is_read: false,
        is_starred: false,
        folder: 'inbox',
        category: 'lab',
        priority: 'high',
        has_attachment: true,
        attachment_name: 'Lich_truc_may_AFM_T8.xlsx',
      },
      {
        id: 'msg-project-review',
        sender_name: 'Hội Đồng Đồ Án K65 FEPN',
        sender_email: 'doan.vlkt@fepn.edu.vn',
        recipient_email: email,
        subject: 'Thông báo nộp báo cáo tiến độ Đồ án tốt nghiệp đợt 1',
        content: `Kính gửi các bạn sinh viên K65 chuẩn bị bảo vệ đồ án tốt nghiệp,\n\nHội đồng Khoa yêu cầu các bạn hoàn thành bản tóm tắt tiến độ nghiên cứu có chữ ký xác nhận của cán bộ hướng dẫn và nộp trực tuyến trước ngày 25 tháng này.\n\nCác bạn có thể theo dõi tiến độ công việc ngay tại tab "Nhiệm Vụ & Công Việc" của Sen Mail.\n\nBan Thư Ký Hội Đồng.`,
        created_at: new Date(Date.now() - 3600000 * 42).toISOString(),
        is_read: true,
        is_starred: true,
        folder: 'inbox',
        category: 'project',
        priority: 'normal',
      },
      {
        id: 'msg-sent-sample',
        sender_name: email ? email.split('@')[0] : 'Tôi',
        sender_email: email,
        recipient_email: 'nano.lab@fepn.edu.vn',
        subject: 'Đã gửi: Báo cáo kết quả đo quang phổ hạt nano kim loại',
        content: `Gửi Phòng Lab Nano,\n\nEm đã hoàn thành xong số liệu đo phổ hấp thụ UV-Vis của các mẫu sol-gel sáng nay và gửi kèm file dữ liệu thô (.csv). Nhờ phòng Lab kiểm tra giúp em ạ!\n\nEm cảm ơn!`,
        created_at: new Date(Date.now() - 3600000 * 60).toISOString(),
        is_read: true,
        is_starred: false,
        folder: 'sent',
        category: 'lab',
        priority: 'normal',
      },
    ]

    setMessages(seedMessages)
    try {
      localStorage.setItem(storageKey, JSON.stringify(seedMessages))
    } catch (e) {}
  }

  // 3. Load Tasks Data
  const loadTasksData = (email: string) => {
    const storageKey = `senmail_tasks_${email || 'default'}`
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed)
          return
        }
      }
    } catch (e) {}

    const seedTasks: WorkTask[] = [
      {
        id: 'task-1',
        title: 'Hoàn thiện bản thảo báo cáo tiến độ Đồ án Tốt nghiệp tuần 8',
        description: 'Tổng hợp đồ thị phổ XRD và AFM, gửi bản nháp cho cán bộ hướng dẫn duyệt qua Sen Mail.',
        due_date: new Date(Date.now() + 3600000 * 24 * 2).toISOString().slice(0, 10),
        priority: 'high',
        status: 'in_progress',
        category: 'project',
        created_at: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'Đăng ký lịch sử dụng máy AFM và đo mẫu màng mỏng tại Lab 402-E3',
        description: 'Liên hệ kỹ thuật viên nano.lab@fepn.edu.vn để xác nhận giờ đo thực tế.',
        due_date: new Date(Date.now() + 3600000 * 24 * 4).toISOString().slice(0, 10),
        priority: 'high',
        status: 'todo',
        category: 'lab',
        created_at: new Date().toISOString(),
      },
      {
        id: 'task-3',
        title: 'Tham gia buổi họp khoa học Khoa VLKT & Đánh giá giữa kỳ',
        description: 'Họp trực tiếp tại Hội trường 305-E3 hoặc phòng họp trực tuyến của Khoa.',
        due_date: new Date(Date.now() + 3600000 * 24 * 7).toISOString().slice(0, 10),
        priority: 'normal',
        status: 'todo',
        category: 'faculty',
        created_at: new Date().toISOString(),
      },
      {
        id: 'task-4',
        title: 'Sao lưu tài liệu môn Vật lý Bán Dẫn lên Kho Học Liệu FEPN',
        description: 'Tải các slide bài giảng và tệp giải bài tập tham khảo lên thư mục môn học.',
        due_date: new Date(Date.now() - 3600000 * 24).toISOString().slice(0, 10),
        priority: 'low',
        status: 'completed',
        category: 'general',
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      },
    ]

    setTasks(seedTasks)
    try {
      localStorage.setItem(storageKey, JSON.stringify(seedTasks))
    } catch (e) {}
  }

  // Save changes to storage
  const saveMessages = (newList: MailMessage[]) => {
    setMessages(newList)
    if (userEmail) {
      localStorage.setItem(`senmail_messages_${userEmail}`, JSON.stringify(newList))
    }
  }

  const saveTasks = (newList: WorkTask[]) => {
    setTasks(newList)
    if (userEmail) {
      localStorage.setItem(`senmail_tasks_${userEmail}`, JSON.stringify(newList))
    }
  }

  // Toggle Read
  const handleToggleRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const updated = messages.map((m) => (m.id === id ? { ...m, is_read: !m.is_read } : m))
    saveMessages(updated)
  }

  // Toggle Starred
  const handleToggleStar = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const updated = messages.map((m) => (m.id === id ? { ...m, is_starred: !m.is_starred } : m))
    saveMessages(updated)
  }

  // Move to Trash or Restore
  const handleDeleteMessage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const target = messages.find((m) => m.id === id)
    if (!target) return

    let updated: MailMessage[]
    if (target.folder === 'trash') {
      // Xóa vĩnh viễn
      updated = messages.filter((m) => m.id !== id)
      showToast('Đã xóa vĩnh viễn thư.')
    } else {
      // Chuyển vào thùng rác
      updated = messages.map((m) => (m.id === id ? { ...m, folder: 'trash' as const } : m))
      showToast('Đã chuyển thư vào Thùng rác.')
    }

    saveMessages(updated)
    if (selectedMessageId === id) {
      setSelectedMessageId(null)
    }
  }

  // Restore from trash
  const handleRestoreMessage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const updated = messages.map((m) => (m.id === id ? { ...m, folder: 'inbox' as const } : m))
    saveMessages(updated)
    showToast('Đã khôi phục thư về Hộp thư đến.')
  }

  // Handle Send New Mail
  const handleSendMail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeTo.trim()) {
      alert('Vui lòng nhập địa chỉ người nhận!')
      return
    }
    if (!composeSubject.trim()) {
      alert('Vui lòng nhập tiêu đề thư!')
      return
    }

    setSendingMail(true)

    setTimeout(() => {
      const newMail: MailMessage = {
        id: `msg-${Date.now()}`,
        sender_name: userEmail ? userEmail.split('@')[0] : 'Tôi',
        sender_email: userEmail,
        recipient_email: composeTo.trim(),
        subject: composeSubject.trim(),
        content: composeBody.trim() || '(Không có nội dung)',
        created_at: new Date().toISOString(),
        is_read: true,
        is_starred: false,
        folder: 'sent',
        category: composeCategory,
        priority: composePriority,
      }

      const updatedMessages = [newMail, ...messages]
      saveMessages(updatedMessages)

      // Nếu người dùng chọn tạo nhiệm vụ kèm theo
      if (composeCreateTask) {
        const newTask: WorkTask = {
          id: `task-${Date.now()}`,
          title: composeSubject.trim(),
          description: `Giao việc / Trao đổi với ${composeTo.trim()}: ${composeBody.slice(0, 100)}...`,
          due_date: new Date(Date.now() + 3600000 * 24 * 3).toISOString().slice(0, 10),
          priority: composePriority,
          status: 'todo',
          category: composeCategory,
          created_at: new Date().toISOString(),
        }
        saveTasks([newTask, ...tasks])
      }

      setSendingMail(false)
      setShowComposeModal(false)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setComposeCreateTask(false)
      showToast('Đã gửi thư và cập nhật công việc thành công! ⚡')
    }, 400)
  }

  // Handle Send Quick Reply
  const handleSendReply = (originalMsg: MailMessage) => {
    if (!replyContent.trim()) return
    const replyMail: MailMessage = {
      id: `msg-${Date.now()}`,
      sender_name: userEmail ? userEmail.split('@')[0] : 'Tôi',
      sender_email: userEmail,
      recipient_email: originalMsg.sender_email,
      subject: `Re: ${originalMsg.subject}`,
      content: `${replyContent.trim()}\n\n--- Vào lúc ${new Date(originalMsg.created_at).toLocaleString('vi-VN')}, ${originalMsg.sender_name} đã viết:\n>${originalMsg.content.replace(/\n/g, '\n> ')}`,
      created_at: new Date().toISOString(),
      is_read: true,
      is_starred: false,
      folder: 'sent',
      category: originalMsg.category,
      priority: originalMsg.priority,
    }

    saveMessages([replyMail, ...messages])
    setReplyContent('')
    setIsReplying(false)
    showToast(`Đã gửi câu trả lời tới ${originalMsg.sender_name}!`)
  }

  // Handle Create Work Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) {
      alert('Vui lòng nhập tên công việc!')
      return
    }

    const task: WorkTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Nhiệm vụ nội bộ Khoa FEPN',
      due_date: newTaskDueDate || new Date(Date.now() + 3600000 * 24 * 5).toISOString().slice(0, 10),
      priority: newTaskPriority,
      status: 'todo',
      category: newTaskCategory,
      created_at: new Date().toISOString(),
    }

    saveTasks([task, ...tasks])
    setShowAddTaskModal(false)
    setNewTaskTitle('')
    setNewTaskDesc('')
    setNewTaskDueDate('')
    showToast('Đã thêm nhiệm vụ mới vào bảng công việc! 📋')
  }

  // Toggle Task Status
  const handleToggleTaskStatus = (taskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'completed' ? 'todo' : 'completed'
        return { ...t, status: nextStatus as 'todo' | 'completed' }
      }
      return t
    })
    saveTasks(updated)
  }

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId)
    saveTasks(updated)
    showToast('Đã xóa nhiệm vụ.')
  }

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Filter by folder / tab
      if (activeTab === 'inbox' && msg.folder !== 'inbox') return false
      if (activeTab === 'sent' && msg.folder !== 'sent') return false
      if (activeTab === 'starred' && (!msg.is_starred || msg.folder === 'trash')) return false
      if (activeTab === 'trash' && msg.folder !== 'trash') return false

      // Filter by category
      if (activeCategoryFilter !== 'all' && msg.category !== activeCategoryFilter) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchSubject = msg.subject.toLowerCase().includes(q)
        const matchSender = msg.sender_name.toLowerCase().includes(q) || msg.sender_email.toLowerCase().includes(q)
        const matchContent = msg.content.toLowerCase().includes(q)
        if (!matchSubject && !matchSender && !matchContent) return false
      }

      return true
    })
  }, [messages, activeTab, activeCategoryFilter, searchQuery])

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskFilterStatus === 'pending' && task.status === 'completed') return false
      if (taskFilterStatus === 'completed' && task.status !== 'completed') return false
      if (activeCategoryFilter !== 'all' && task.category !== activeCategoryFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [tasks, taskFilterStatus, activeCategoryFilter, searchQuery])

  // Unread Count
  const unreadInboxCount = useMemo(() => {
    return messages.filter((m) => m.folder === 'inbox' && !m.is_read).length
  }, [messages])

  // Selected Message Object
  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null
    return messages.find((m) => m.id === selectedMessageId) || null
  }, [messages, selectedMessageId])

  // Category labels helper
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'lab':
        return { label: '🔬 Lab & NCKH', bg: 'bg-teal-50 text-teal-700 border-teal-200' }
      case 'project':
        return { label: '🎓 Đồ Án K65', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      case 'faculty':
        return { label: '🏛️ Họp Khoa', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'urgent':
        return { label: '⚡ Khẩn Cấp', bg: 'bg-rose-50 text-rose-700 border-rose-200' }
      default:
        return { label: '📁 Công Việc', bg: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 ${headingFont.variable} ${bodyFont.variable}`}
      style={{
        fontFamily: 'var(--font-fepn-body, sans-serif)',
        ...getModernThemeVars('fepn'),
      }}
    >
      {/* 1. TOP HEADER / APP BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-2xs">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          {/* Logo & Workspace Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/fepn-dashboard"
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-teal-500/30 bg-white p-1 shadow-sm hover:scale-105 transition"
              title="Quay lại Kho Học Liệu FEPN"
            >
              <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-black text-slate-900 leading-none tracking-tight flex items-center gap-1.5"
                  style={{ fontFamily: 'var(--font-fepn-heading, sans-serif)' }}
                >
                  <span>Sen Mail</span>
                  <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider">
                    Nội Bộ
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 font-bold hidden sm:block">
                Hòm Thư & Quản Lý Nhiệm Vụ Khoa FEPN
              </p>
            </div>
          </div>

          {/* Search Box in Header (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm thư, người gửi, công việc..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 bg-slate-100/70 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right Navigation Shortcuts */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/fepn-dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span>Kho Học Liệu</span>
            </Link>

            <Link
              href="/fepn-schedule"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition"
            >
              <Calendar className="h-3.5 w-3.5 text-sky-600" />
              <span>Thời Khóa Biểu</span>
            </Link>

            {/* User Domain Account Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-mono font-bold leading-none text-teal-900">{userEmail || 'domain.user'}</p>
                <span className="text-[10px] font-black text-emerald-600 flex items-center justify-end gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Bypass OTP Active
                </span>
              </div>

              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {userEmail?.charAt(0).toUpperCase() || 'S'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 animate-in slide-in-from-top-3 duration-200">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="h-4 w-4 text-teal-400" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 pb-24 md:pb-8">
        {/* ======================================================== */}
        {/* LEFT SIDEBAR: ACTIONS & FOLDERS (Col 1-3)                */}
        {/* ======================================================== */}
        <aside className="md:col-span-3 space-y-4">
          {/* Main Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setShowComposeModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs sm:text-sm font-black shadow-lg shadow-teal-600/25 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Soạn Thư Mới</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white border border-teal-500/30 hover:bg-teal-50/50 text-teal-800 text-xs sm:text-sm font-bold shadow-2xs transition"
            >
              <CheckSquare className="h-4 w-4 text-teal-600" />
              <span>+ Thêm Việc Cần Làm</span>
            </button>
          </div>

          {/* Navigation Folder List */}
          <div className="rounded-3xl bg-white border border-slate-200 p-3 shadow-sm space-y-1">
            <div className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Hòm Thư & Nhiệm Vụ
            </div>

            {/* 1. Hộp thư đến */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('inbox')
                setSelectedMessageId(null)
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'inbox'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className={`h-4 w-4 ${activeTab === 'inbox' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>Hộp Thư Đến</span>
              </div>
              {unreadInboxCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-black">
                  {unreadInboxCount}
                </span>
              )}
            </button>

            {/* 2. Danh mục công việc (Work Tasks) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('tasks')
                setSelectedMessageId(null)
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'tasks'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className={`h-4 w-4 ${activeTab === 'tasks' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>Nhiệm Vụ & Công Việc</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                {tasks.filter((t) => t.status !== 'completed').length} việc
              </span>
            </button>

            {/* 3. Đánh dấu sao */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('starred')
                setSelectedMessageId(null)
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'starred'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className={`h-4 w-4 ${activeTab === 'starred' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
                <span>Thư Quan Trọng</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {messages.filter((m) => m.is_starred && m.folder !== 'trash').length}
              </span>
            </button>

            {/* 4. Thư đã gửi */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('sent')
                setSelectedMessageId(null)
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'sent'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className={`h-4 w-4 ${activeTab === 'sent' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>Thư Đã Gửi</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {messages.filter((m) => m.folder === 'sent').length}
              </span>
            </button>

            {/* 5. Thùng rác */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('trash')
                setSelectedMessageId(null)
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'trash'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className={`h-4 w-4 ${activeTab === 'trash' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Thùng Rác</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {messages.filter((m) => m.folder === 'trash').length}
              </span>
            </button>
          </div>

          {/* Phân loại đề tài / Nhóm làm việc */}
          <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Chuyên Mục Công Việc
            </div>

            <div className="space-y-1 text-xs">
              {[
                { id: 'all', label: 'Tất cả mục', icon: Folder, color: 'text-slate-500' },
                { id: 'lab', label: 'Phòng Lab & Nghiên Cứu', icon: Briefcase, color: 'text-teal-600' },
                { id: 'project', label: 'Đồ Án Tốt Nghiệp K65', icon: FileText, color: 'text-indigo-600' },
                { id: 'faculty', label: 'Công Tác & Họp Khoa', icon: AtSign, color: 'text-amber-600' },
                { id: 'urgent', label: 'Việc Gấp / Deadline', icon: AlertCircle, color: 'text-rose-600' },
              ].map((cat) => {
                const Icon = cat.icon
                const isSelected = activeCategoryFilter === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition text-left font-bold ${
                      isSelected
                        ? 'bg-slate-100 text-slate-900 border border-slate-300'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dung Lượng Bộ Nhớ Hòm Thư FEPN Cloud */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-teal-950 p-4 text-white shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-teal-300 font-bold">Dung Lượng FEPN Cloud</span>
              <span className="text-[11px] text-teal-200/70 font-mono">1.2 GB / 15 GB</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-teal-400 h-full rounded-full w-[12%]" />
            </div>
            <p className="text-[10px] text-slate-300 leading-tight">
              Tài khoản tên miền được cấp 15 GB lưu trữ dữ liệu đề tài và học liệu đám mây.
            </p>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* RIGHT CONTENT WORKSPACE: MAIL LIST / DETAIL / TASKS     */}
        {/* ======================================================== */}
        <main className="md:col-span-9 space-y-4">
          {/* TAB 1: WORK TASKS BOARD (QUẢN LÝ CÔNG VIỆC HIỆN CÓ) */}
          {activeTab === 'tasks' ? (
            <div className="space-y-4">
              {/* Task Header & Filters */}
              <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-teal-600" />
                    <h2 className="text-lg font-black text-slate-900">Nhiệm Vụ & Công Việc Của Bạn</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Theo dõi các đầu việc nghiên cứu, hạn nộp đồ án và phân công từ Khoa
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={taskFilterStatus}
                    onChange={(e: any) => setTaskFilterStatus(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="all">Mọi trạng thái ({tasks.length})</option>
                    <option value="pending">Chưa hoàn thành ({tasks.filter((t) => t.status !== 'completed').length})</option>
                    <option value="completed">Đã hoàn thành ({tasks.filter((t) => t.status === 'completed').length})</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Thêm Nhiệm Vụ</span>
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5">
                {filteredTasks.length === 0 ? (
                  <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center text-slate-400 space-y-2 shadow-sm">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">Không có nhiệm vụ nào trong danh sách</p>
                    <p className="text-xs">Bạn đã hoàn tất tất cả công việc hoặc chưa thêm việc mới.</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isDone = task.status === 'completed'
                    const catBadge = getCategoryBadge(task.category)
                    const isOverdue = !isDone && new Date(task.due_date).getTime() < Date.now() - 86400000

                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-4 transition-all flex items-start gap-3.5 bg-white ${
                          isDone
                            ? 'border-slate-200/80 bg-slate-50/50 opacity-70'
                            : 'border-slate-200 hover:border-teal-300 hover:shadow-sm'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task.id)}
                          className="mt-0.5 shrink-0 text-slate-400 hover:text-teal-600 transition"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="h-5 w-5 hover:stroke-teal-600" />
                          )}
                        </button>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={`text-sm font-bold text-slate-900 ${
                                isDone ? 'line-through text-slate-400' : ''
                              }`}
                            >
                              {task.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catBadge.bg}`}>
                              {catBadge.label}
                            </span>
                            {task.priority === 'high' && (
                              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                Ưu tiên cao
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>

                          <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                            <div className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                              <Clock className="h-3 w-3" />
                              <span>Hạn: {new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
                              {isOverdue && <span className="text-[10px]">(Quá hạn)</span>}
                            </div>
                            <span>Thêm lúc: {new Date(task.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Xóa nhiệm vụ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : selectedMessage ? (
            /* ======================================================== */
            /* TAB 2: DETAIL VIEW CỦA THƯ ĐANG CHỌN                     */
            /* ======================================================== */
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-4">
              {/* Header của thư */}
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMessageId(null)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
                    title="Quay lại danh sách thư"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                      {selectedMessage.subject}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryBadge(selectedMessage.category).bg}`}>
                        {getCategoryBadge(selectedMessage.category).label}
                      </span>
                      {selectedMessage.priority === 'high' && (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold">
                          Quan trọng
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleToggleStar(selectedMessage.id, e)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
                    title={selectedMessage.is_starred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
                  >
                    <Star
                      className={`h-4 w-4 ${selectedMessage.is_starred ? 'text-amber-500 fill-amber-400' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMessage(selectedMessage.id, e)}
                    className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                    title="Xóa thư"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sender & Recipient Information */}
              <div className="px-6 py-2 flex items-center justify-between gap-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm">
                    {selectedMessage.sender_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">{selectedMessage.sender_name}</p>
                    <p className="text-[11px] font-mono text-slate-500">{selectedMessage.sender_email}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>{new Date(selectedMessage.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p>{new Date(selectedMessage.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              {/* Message Content */}
              <div className="p-6 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[160px]">
                {selectedMessage.content}
              </div>

              {/* Attachments Section if present */}
              {selectedMessage.has_attachment && (
                <div className="mx-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Paperclip className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{selectedMessage.attachment_name || 'Tep_dinh_kem_FEPN.pdf'}</p>
                      <span className="text-[10px] text-slate-400">File đính kèm công việc (1.8 MB)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Đang tải file đính kèm...')}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-teal-700 hover:bg-teal-50"
                  >
                    Tải Về
                  </button>
                </div>
              )}

              {/* Reply Section */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Reply className="h-3.5 w-3.5 text-teal-600" />
                    <span>Trả lời nhanh cho {selectedMessage.sender_name}</span>
                  </h4>
                </div>

                <textarea
                  rows={3}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Nhập nội dung phản hồi công việc..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendReply(selectedMessage)}
                    disabled={!replyContent.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Gửi Trả Lời</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* TAB 3: DANH SÁCH THƯ (INBOX / SENT / STARRED / TRASH)    */
            /* ======================================================== */
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              {/* Header list */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  {activeTab === 'inbox' && <Inbox className="h-5 w-5 text-teal-600" />}
                  {activeTab === 'sent' && <Send className="h-5 w-5 text-teal-600" />}
                  {activeTab === 'starred' && <Star className="h-5 w-5 text-amber-500 fill-amber-400" />}
                  {activeTab === 'trash' && <Trash2 className="h-5 w-5 text-rose-600" />}

                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    {activeTab === 'inbox' && 'Hộp Thư Đến'}
                    {activeTab === 'sent' && 'Thư Đã Gửi'}
                    {activeTab === 'starred' && 'Thư Quan Trọng'}
                    {activeTab === 'trash' && 'Thùng Rác'}
                    <span className="text-xs text-slate-400 font-medium ml-2">
                      ({filteredMessages.length} thư)
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (userEmail) {
                        loadMailData(userEmail)
                        showToast('Đã làm mới danh sách thư!')
                      }
                    }}
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
                    title="Tải lại hộp thư"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages Table / List */}
              <div className="divide-y divide-slate-100">
                {filteredMessages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <Inbox className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">Hòm thư trống</p>
                    <p className="text-xs">Không có email nào trong danh mục này.</p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const catBadge = getCategoryBadge(msg.category)
                    const isUnread = !msg.is_read && msg.folder === 'inbox'

                    return (
                      <div
                        key={msg.id}
                        onClick={() => {
                          setSelectedMessageId(msg.id)
                          if (!msg.is_read) {
                            handleToggleRead(msg.id)
                          }
                        }}
                        className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isUnread ? 'bg-teal-50/40 hover:bg-teal-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Star toggle */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(msg.id, e)}
                            className="p-1 text-slate-300 hover:text-amber-500 transition shrink-0"
                          >
                            <Star
                              className={`h-4 w-4 ${msg.is_starred ? 'text-amber-500 fill-amber-400' : ''}`}
                            />
                          </button>

                          {/* Sender name */}
                          <span
                            className={`text-xs w-32 sm:w-44 truncate shrink-0 ${
                              isUnread ? 'font-black text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {msg.sender_name}
                          </span>

                          {/* Subject & snippet */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold border shrink-0 ${catBadge.bg}`}>
                              {catBadge.label}
                            </span>
                            <p
                              className={`text-xs truncate ${
                                isUnread ? 'font-black text-slate-900' : 'text-slate-600'
                              }`}
                            >
                              {msg.subject}
                              <span className="font-normal text-slate-400 ml-1.5 hidden sm:inline">
                                — {msg.content.slice(0, 60)}...
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Attachment indicator & Date */}
                        <div className="flex items-center gap-3 shrink-0">
                          {msg.has_attachment && <Paperclip className="h-3.5 w-3.5 text-slate-400" />}

                          <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                            {new Date(msg.created_at).toLocaleDateString('vi-VN', {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                          </span>

                          {/* Quick delete / restore */}
                          {msg.folder === 'trash' ? (
                            <button
                              type="button"
                              onClick={(e) => handleRestoreMessage(msg.id, e)}
                              className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                              title="Khôi phục"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteMessage(msg.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Xóa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: SOẠN THƯ MỚI (COMPOSE MAIL)                     */}
      {/* ======================================================== */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <h3 className="text-base font-black">Soạn Thư & Giao Việc Sen Mail</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendMail} className="p-6 space-y-4">
              {/* To field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Người nhận (Email tên miền)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="vd: nano.lab@fepn.edu.vn hoặc admin@senexam.me"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                {/* Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                  <span>Gợi ý:</span>
                  {['nano.lab@fepn.edu.vn', 'admin@senexam.me', 'giangvien.vlkt@fepn.edu.vn'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setComposeTo(sug)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-teal-700 font-mono text-[10px]"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Tiêu đề thư</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="vd: Báo cáo kết quả thí nghiệm màng mỏng oxit..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Chuyên mục công việc</label>
                  <select
                    value={composeCategory}
                    onChange={(e: any) => setComposeCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="lab">🔬 Lab & NCKH</option>
                    <option value="project">🎓 Đồ Án Tốt Nghiệp</option>
                    <option value="faculty">🏛️ Họp & Công Tác Khoa</option>
                    <option value="urgent">⚡ Khẩn Cấp</option>
                    <option value="general">📁 Chung</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mức độ ưu tiên</label>
                  <select
                    value={composePriority}
                    onChange={(e: any) => setComposePriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="normal">Bình thường</option>
                    <option value="high">Ưu tiên cao / Khẩn</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nội dung thư / Nhiệm vụ</label>
                <textarea
                  rows={5}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Nhập chi tiết trao đổi công việc, link dữ liệu hoặc các yêu cầu phối hợp..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Checkbox: Also add to work tasks */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={composeCreateTask}
                  onChange={(e) => setComposeCreateTask(e.target.checked)}
                  className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Đồng thời ghim tiêu đề này vào bảng Nhiệm vụ & Công việc cần làm</span>
              </label>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={sendingMail}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{sendingMail ? 'Đang gửi...' : 'Gửi Thư'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: THÊM NHIỆM VỤ MỚI (ADD WORK TASK)              */}
      {/* ======================================================== */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-black text-slate-900">Thêm Nhiệm Vụ & Công Việc Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Tên công việc / Đầu việc</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="vd: Nộp bản nháp đồ án tốt nghiệp chương 3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Ghi chú thêm về yêu cầu, số liệu hoặc người phụ trách..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Hạn chót (Deadline)</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mức độ ưu tiên</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="normal">Bình thường</option>
                    <option value="high">Ưu tiên cao</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Chuyên mục</label>
                <select
                  value={newTaskCategory}
                  onChange={(e: any) => setNewTaskCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="lab">🔬 Lab & NCKH</option>
                  <option value="project">🎓 Đồ Án Tốt Nghiệp</option>
                  <option value="faculty">🏛️ Họp & Công Tác Khoa</option>
                  <option value="urgent">⚡ Việc Khẩn Cấp</option>
                  <option value="general">📁 Chung</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tạo Nhiệm Vụ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Unified 3-Button Navigation */}
      <FepnMobileNav
        activePage="dashboard"
        centerButton={{
          label: 'Soạn Thư',
          icon: <Send className="h-6 w-6" />,
          onClick: () => setShowComposeModal(true),
        }}
        customDrawerActions={[
          {
            label: 'Hộp Thư Đến',
            icon: <Inbox className="h-4 w-4 text-teal-600" />,
            onClick: () => {
              setActiveTab('inbox')
              setSelectedMessageId(null)
            },
          },
          {
            label: 'Nhiệm Vụ & To-Do',
            icon: <CheckSquare className="h-4 w-4 text-sky-600" />,
            onClick: () => {
              setActiveTab('tasks')
              setSelectedMessageId(null)
            },
          },
          {
            label: 'Thư Quan Trọng',
            icon: <Star className="h-4 w-4 text-amber-500" />,
            onClick: () => {
              setActiveTab('starred')
              setSelectedMessageId(null)
            },
          },
          {
            label: 'Thư Đã Gửi',
            icon: <Send className="h-4 w-4 text-indigo-600" />,
            onClick: () => {
              setActiveTab('sent')
              setSelectedMessageId(null)
            },
          },
          {
            label: '+ Thêm Việc Cần Làm',
            icon: <Plus className="h-4 w-4 text-emerald-600" />,
            onClick: () => setShowAddTaskModal(true),
          },
        ]}
        userEmail={userEmail}
        onLogout={async () => {
          await supabase.auth.signOut()
          router.push('/fepn-login')
        }}
      />
    </div>
  )
}
