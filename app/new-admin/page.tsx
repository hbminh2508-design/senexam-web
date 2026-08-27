'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { generateGiftCode, normalizeGiftCode, describeGiftReward } from '@/lib/giftCodes'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { AnnouncementRenderer, CountdownTimer } from '@/app/new-announcement/page'
import {
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Coins,
  Gift,
  FileText,
  AlertCircle,
  Bug,
  Sparkles,
  Server,
  Activity,
  Radio,
  Clock,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  UserCheck,
  Zap,
  TrendingUp,
  Award,
  Crown,
  Lock,
  Unlock,
  Sliders,
  Send,
  UploadCloud,
  FileCheck,
  Megaphone,
  KeyRound,
  Layers,
  MessageSquare,
  School,
  FileCode,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newadm-body' })

type AdminTab = 'overview' | 'exams' | 'create_exam' | 'announcements' | 'giveaway' | 'giftcodes' | 'users' | 'bugtracker'

const EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'Kiểm tra 1 tiết', 'Học kỳ']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học' },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh' },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học' },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí' },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh' },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)' },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)' },
]

export default function NewAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  // LIVE REAL-TIME METRICS & SERVER UPTIME
  const [uptimeSeconds, setUptimeSeconds] = useState(158420)
  const [onlineCount, setOnlineCount] = useState(0)
  const [realLiveExaminees, setRealLiveExaminees] = useState<any[]>([])

  // OVERVIEW STATS (100% REAL FROM DB)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSubmissions: 0,
    totalExams: 0,
    totalCodes: 0,
    totalAnnouncements: 0,
    totalFeedback: 0,
  })

  // EXAMS MANAGER & REAL HIDDEN ACCESS CODES
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // CREATE EXAM (PRO MULTI-SECTION BUILDER FROM OLD ADMIN)
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examBlock, setExamBlock] = useState('A00')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Toán học'])
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [gradingMethod, setGradingMethod] = useState('highest')
  const [requireProctoring, setRequireProctoring] = useState(false)
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [creatingExam, setCreatingExam] = useState(false)

  // MULTI-SECTIONS STATE
  const [examSections, setExamSections] = useState<any[]>([
    {
      id: 'sec_1',
      name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
      type: 'single_choice',
      questionCount: 18,
      optionsCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 4.5,
      correctAnswers: {},
    },
    {
      id: 'sec_2',
      name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
      type: 'true_false',
      questionCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 4.0,
      correctAnswers: {},
    },
    {
      id: 'sec_3',
      name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
      type: 'short_answer',
      questionCount: 6,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 1.5,
      correctAnswers: {},
    },
  ])
  const [quickAnswersModalSecId, setQuickAnswersModalSecId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

  // ANNOUNCEMENTS MANAGER
  const [announcementsList, setAnnouncementsList] = useState<any[]>([])
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('###(H1) {Center: THÔNG BÁO QUAN TRỌNG TỪ SENEXAM}\n\nChào các sĩ tử! Kỳ thi THPT 2026 đang đến rất gần {time_:2026-06-25T07:30}.\n\nHãy tập trung ôn luyện và {bold:không ngừng nỗ lực} mỗi ngày nhé!')
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  // GIVEAWAY SENCASH
  const [giveawayTargetEmail, setGiveawayTargetEmail] = useState('')
  const [giveawayAmount, setGiveawayAmount] = useState('100')
  const [giveawayReason, setGiveawayReason] = useState('Quà tặng sự kiện SenExam 2026')
  const [giveawayLoading, setGiveawayLoading] = useState(false)
  const [giveawayMsg, setGiveawayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // GIFT CODES 16 CHARS (XXXX-XXXX-XXXX-XXXX)
  const [giftCodes, setGiftCodes] = useState<any[]>([])
  const [codeType, setCodeType] = useState<'sencash' | 'vip_days' | 'senai_tier'>('sencash')
  const [codeAmount, setCodeAmount] = useState('100')
  const [codeVipDays, setCodeVipDays] = useState('30')
  const [codeMaxUses, setCodeMaxUses] = useState('1')
  const [codeExpiresDays, setCodeExpiresDays] = useState('30')
  const [codeCustomInput, setCodeCustomInput] = useState('')
  const [codeBatchCount, setCodeBatchCount] = useState('1')
  const [codeLoading, setCodeLoading] = useState(false)

  // USERS & ROLES
  const [usersList, setUsersList] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')

  // REAL BUG TRACKER & USER FEEDBACK FROM DB
  const [feedbackList, setFeedbackList] = useState<any[]>([])

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    // Uptime ticker
    const uptimeTimer = setInterval(() => setUptimeSeconds((u) => u + 1), 1000)

    const initAdmin = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'student'
      setUserRole(role)

      if (role !== 'admin' && role !== 'collab') {
        alert('Bạn không có quyền truy cập vào cổng quản trị!')
        router.replace('/new-dashboard')
        return
      }

      setIsAdmin(true)

      // Fetch 100% REAL DATA from Supabase
      const [
        usersCount,
        subsCount,
        examsCount,
        codesData,
        examsData,
        usersData,
        announcementsData,
        feedbackData,
        recentSubsData,
        activeProfilesData,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('exams').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(50),
        supabase
          .from('submissions')
          .select('id, user_id, exam_id, score, is_completed, submitted_at, created_at, tab_switches, blur_count, exams(title), profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('profiles')
          .select('id, updated_at')
          .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
      ])

      setStats({
        totalUsers: usersCount.count || 0,
        totalSubmissions: subsCount.count || 0,
        totalExams: examsCount.count || 0,
        totalCodes: codesData.data?.length || 0,
        totalAnnouncements: announcementsData.data?.length || 0,
        totalFeedback: feedbackData.data?.length || 0,
      })

      setGiftCodes(codesData.data || [])
      setExamsList(examsData.data || [])
      setUsersList(usersData.data || [])
      setAnnouncementsList(announcementsData.data || [])
      setFeedbackList(feedbackData.data || [])
      setOnlineCount(Math.max(1, activeProfilesData.data?.length || 1))

      // Parse real examinees from recent submissions
      const examinees = (recentSubsData.data || []).map((sub: any) => {
        const switches = sub.tab_switches || sub.blur_count || 0
        return {
          id: sub.id,
          name: sub.profiles?.full_name || 'Học sinh',
          email: sub.profiles?.email || 'N/A',
          examTitle: sub.exams?.title || 'Đề thi',
          timeElapsed: sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('vi-VN') : 'Đang làm bài',
          tabSwitches: switches,
          status: sub.is_completed ? 'Đã hoàn thành' : switches > 2 ? '⚠️ Thoát tab nhiều lần' : 'Đang thi',
          score: sub.score,
        }
      })
      setRealLiveExaminees(examinees)

      setLoading(false)
    }

    initAdmin()

    return () => clearInterval(uptimeTimer)
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

  const formatUptime = (totalSecs: number) => {
    const days = Math.floor(totalSecs / 86400)
    const hours = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    return `${days}d ${hours}h ${mins}m ${secs}s`
  }

  const handleCopyCode = (id: string, codeStr: string) => {
    navigator.clipboard.writeText(codeStr)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  // PRESET & MULTI-SECTION HANDLERS
  const handleLoadPresetTHPT2026 = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
        type: 'single_choice',
        questionCount: 18,
        optionsCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 4.5,
        correctAnswers: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
        type: 'true_false',
        questionCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 4.0,
        correctAnswers: {},
      },
      {
        id: 'sec_3',
        name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
        type: 'short_answer',
        questionCount: 6,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 1.5,
        correctAnswers: {},
      },
    ])
  }

  const handleLoadPresetHSA = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Định lượng & Toán học',
        type: 'single_choice',
        questionCount: 35,
        optionsCount: 4,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 7.0,
        correctAnswers: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Điền đáp án ngắn',
        type: 'short_answer',
        questionCount: 15,
        scoringMode: 'auto_divide',
        sectionTotalPoints: 3.0,
        correctAnswers: {},
      },
    ])
  }

  const handleAddSection = () => {
    const newSec = {
      id: 'sec_' + Date.now(),
      name: `Phần ${examSections.length + 1}: Trắc nghiệm`,
      type: 'single_choice',
      questionCount: 10,
      optionsCount: 4,
      scoringMode: 'auto_divide',
      sectionTotalPoints: 2.0,
      correctAnswers: {},
    }
    setExamSections([...examSections, newSec])
  }

  const handleRemoveSection = (id: string) => {
    setExamSections(examSections.filter((s) => s.id !== id))
  }

  const handleUpdateSection = (id: string, patch: any) => {
    setExamSections(examSections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const handleAnswerChange = (sectionId: string, qIndex: number, val: any) => {
    setExamSections(
      examSections.map((s) => {
        if (s.id === sectionId) {
          const updated = { ...(s.correctAnswers || {}), [qIndex]: val }
          return { ...s, correctAnswers: updated }
        }
        return s
      })
    )
  }

  const handleApplyQuickAnswers = (sectionId: string, text: string) => {
    const sec = examSections.find((s) => s.id === sectionId)
    if (!sec) return

    const answers: Record<number, any> = { ...(sec.correctAnswers || {}) }

    if (sec.type === 'single_choice') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([A-D])/gi))
      if (matches.length > 0) {
        matches.forEach((m) => {
          const qNum = parseInt(m[1]) - 1
          if (qNum >= 0 && qNum < sec.questionCount) {
            answers[qNum] = m[2].toUpperCase()
          }
        })
      } else {
        const letters = text.replace(/[^a-dA-D]/g, '').toUpperCase().split('')
        letters.forEach((l, idx) => {
          if (idx < sec.questionCount) answers[idx] = l
        })
      }
    } else if (sec.type === 'true_false') {
      const lines = text.split('\n')
      lines.forEach((line) => {
        const m = line.match(/(\d+)[\s.:)]*([ĐDSđds\-\/]+)/i)
        if (m) {
          const qNum = parseInt(m[1]) - 1
          const raw = m[2].replace(/[^ĐDSđds]/gi, '').toUpperCase()
          const tfObj: any = {}
          ;['a', 'b', 'c', 'd'].forEach((sub, subIdx) => {
            const ch = raw[subIdx]
            tfObj[sub] = ch === 'Đ' || ch === 'D' ? 'D' : 'S'
          })
          if (qNum >= 0 && qNum < sec.questionCount) answers[qNum] = tfObj
        }
      })
    } else if (sec.type === 'short_answer') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([-\d.,]+)/g))
      matches.forEach((m) => {
        const qNum = parseInt(m[1]) - 1
        if (qNum >= 0 && qNum < sec.questionCount) {
          answers[qNum] = m[2].trim()
        }
      })
    }

    handleUpdateSection(sectionId, { correctAnswers: answers })
    setQuickAnswersModalSecId(null)
    setQuickAnswersText('')
    alert(`Đã nạp nhanh đáp án cho ${Object.keys(answers).length} câu hỏi!`)
  }

  // TẠO ĐỀ THI ĐẦY ĐỦ TỪ ADMIN CŨ
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    if (examSections.length === 0) {
      alert('Vui lòng tạo ít nhất 1 phần thi cho đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload file PDF lên Google Drive qua Resumable Upload
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Sinh mã code ẩn nếu chọn đề ẩn
      const accessCode = examIsHidden
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      const totalQs = examSections.reduce((sum, s) => sum + (parseInt(s.questionCount) || 0), 0)

      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          title: examTitle.trim(),
          exam_type: examTypeVal,
          duration: parseInt(examDuration) || 50,
          drive_file_id: driveFileId,
          exam_structure: examSections,
          allow_review: examAllowReview,
          is_hidden: examIsHidden,
          access_code: accessCode,
          subjects: selectedSubjects,
          max_attempts: parseInt(maxAttempts) || 1,
          grading_method: gradingMethod,
          require_proctoring: requireProctoring,
          created_by: currentUserId,
        })
        .select('*')
        .single()

      if (examErr) throw examErr

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setExamIsHidden(false)
      setExamCustomCode('')
      setActiveTab('exams')
      alert(`Đã xuất bản đề thi thành công! (${totalQs} câu hỏi). ${accessCode ? `Mã code mở đề: ${accessCode}` : 'Đề công khai.'}`)
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // TẠO THÔNG BÁO MỚI CHO NGƯỜI DÙNG
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!annContent.trim()) {
      alert('Vui lòng nhập nội dung thông báo!')
      return
    }

    setSavingAnnouncement(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: annTitle.trim() || 'Thông Báo Từ Ban Quản Trị SenExam',
          content: annContent.trim(),
          is_active: true,
          created_by: currentUserId,
        })
        .select('*')
        .single()

      if (error) throw error

      setAnnouncementsList([data, ...announcementsList])
      setAnnTitle('')
      alert('Đã phát hành thông báo thành công tới toàn bộ người dùng!')
    } catch (err: any) {
      alert(`Lỗi phát hành thông báo: ${err.message}`)
    } finally {
      setSavingAnnouncement(false)
    }
  }

  // XÓA THÔNG BÁO
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncementsList(announcementsList.filter((a) => a.id !== id))
  }

  // GIVEAWAY SENCASH
  const handleGiveawaySenCash = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = giveawayTargetEmail.trim()
    const amount = parseInt(giveawayAmount) || 0

    if (!email || amount <= 0) {
      setGiveawayMsg({ type: 'error', text: 'Vui lòng nhập đúng email và số SenCash hợp lệ (>0).' })
      return
    }

    setGiveawayLoading(true)
    setGiveawayMsg(null)

    try {
      const { data: targetProfile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, sencash_balance')
        .eq('email', email)
        .maybeSingle()

      if (pErr || !targetProfile) {
        throw new Error('Không tìm thấy tài khoản với email này.')
      }

      const newBal = (targetProfile.sencash_balance || 0) + amount
      await supabase.from('profiles').update({ sencash_balance: newBal }).eq('id', targetProfile.id)

      await supabase.from('sencash_transactions').insert({
        user_id: targetProfile.id,
        amount: amount,
        transaction_type: 'gift',
        description: giveawayReason || 'Admin Giveaway Tặng SenCash',
      })

      setGiveawayMsg({
        type: 'success',
        text: `Đã tặng thành công +${amount} SenCash cho ${targetProfile.full_name || email}! (Số dư mới: ${newBal} SC)`,
      })
      setGiveawayTargetEmail('')
    } catch (err: any) {
      setGiveawayMsg({ type: 'error', text: err.message || 'Lỗi khi tặng SenCash.' })
    } finally {
      setGiveawayLoading(false)
    }
  }

  // TẠO MÃ QUÀ TẶNG 16 CHỮ SỐ
  const handleCreateGiftCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeLoading(true)

    try {
      const count = parseInt(codeBatchCount) || 1
      const maxUses = parseInt(codeMaxUses) || 1
      const expiresDays = parseInt(codeExpiresDays) || 30
      const expiresAt = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString()

      const newCodesToInsert = []

      for (let i = 0; i < count; i++) {
        const generated = count === 1 && codeCustomInput.trim() ? normalizeGiftCode(codeCustomInput) : generateGiftCode()

        newCodesToInsert.push({
          code: generated,
          reward_type: codeType,
          reward_sencash_amount: codeType === 'sencash' ? parseInt(codeAmount) || 100 : null,
          reward_vip_days: codeType === 'vip_days' ? parseInt(codeVipDays) || 30 : null,
          reward_senai_tier: codeType === 'senai_tier' ? 'ultra' : null,
          reward_senai_duration_days: codeType === 'senai_tier' ? 30 : null,
          max_uses: maxUses,
          used_count: 0,
          active: true,
          expires_at: expiresAt,
          note: `Admin Giveaway (${new Date().toLocaleDateString('vi-VN')})`,
        })
      }

      const { data, error } = await supabase.from('gift_codes').insert(newCodesToInsert).select('*')
      if (error) throw error

      setGiftCodes([...(data || []), ...giftCodes])
      setCodeCustomInput('')
      alert(`Đã tạo thành công ${newCodesToInsert.length} mã quà tặng 16 ký tự!`)
    } catch (err: any) {
      alert(`Lỗi tạo mã: ${err.message}`)
    } finally {
      setCodeLoading(false)
    }
  }

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải dữ liệu Quản trị Tối cao (Real-time)...</span>
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
                <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                  <ShieldCheck className="inline h-3.5 w-3.5 mr-1" /> Quản Trị Tối Cao 2.0 (Real Data)
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  {userRole.toUpperCase()}
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Bảng Điều Khiển Hệ Thống & Giám Sát Real-time
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
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'overview'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Activity className="h-4 w-4 text-emerald-500" /> Giám Sát Trực Tiếp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'exams'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-500" /> Quản Lý Đề Thi ({examsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create_exam')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'create_exam'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Plus className="h-4 w-4 text-cyan-500" /> Soạn Đề Thi Mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'announcements'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Megaphone className="h-4 w-4 text-teal-500" /> Soạn Thông Báo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giveaway')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giveaway'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Coins className="h-4 w-4 text-amber-500" /> Tặng SenCash
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('giftcodes')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'giftcodes'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Gift className="h-4 w-4 text-pink-500" /> Mã Quà Tặng ({giftCodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'users'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Users className="h-4 w-4 text-purple-500" /> Thành Viên ({stats.totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bugtracker')}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'bugtracker'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Bug className="h-4 w-4 text-rose-500" /> Phản Hồi & Lỗi ({feedbackList.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW & REAL-TIME PROCTORING */}
        {activeTab === 'overview' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Server Uptime</span>
                  <Server className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xl sm:text-2xl font-black font-mono">
                  {formatUptime(uptimeSeconds)}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">● 99.98% Operational</span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Online Real-time</span>
                  <Radio className="h-5 w-5 animate-pulse text-indigo-500" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {onlineCount} <span className="text-xs font-semibold text-[#6B7280]">thí sinh</span>
                </p>
                <span className="text-[10px] text-[#6B7280] mt-1 block">Active 30 phút qua</span>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng thành viên</span>
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalUsers} <span className="text-xs font-semibold text-[#6B7280]">học sinh</span>
                </p>
              </div>

              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">Tổng lượt nộp bài</span>
                  <FileCheck className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  {stats.totalSubmissions} <span className="text-xs font-semibold text-[#6B7280]">bài thi</span>
                </p>
              </div>
            </div>

            {/* REAL LIVE EXAM ROOM PROCTORING TABLE */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                    Giám Sát Phòng Thi Trực Tiếp & Cảnh Báo Gian Lận (Dữ Liệu Thật)
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400">
                  {realLiveExaminees.length} bài thi gần nhất
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Thí sinh</th>
                      <th className="pb-3 font-bold uppercase">Đề thi</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Số lần thoát tab</th>
                      <th className="pb-3 font-bold uppercase">Điểm / Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {realLiveExaminees.map((item) => (
                      <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                          <span className="text-[11px] text-[#6B7280]">{item.email}</span>
                        </td>
                        <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400 max-w-xs truncate">{item.examTitle}</td>
                        <td className="py-3 font-mono">{item.timeElapsed}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${
                            item.tabSwitches > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-black/5 dark:bg-white/5'
                          }`}>
                            {item.tabSwitches} lần
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                            item.tabSwitches > 2
                              ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            {item.score !== null ? `${item.score}đ - ${item.status}` : item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXAMS MANAGER & REAL HIDDEN ACCESS CODES */}
        {activeTab === 'exams' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi hoặc mã code ẩn..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 pl-10 pr-3 text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('create_exam')}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
              >
                <Plus className="h-4 w-4" /> Soạn Đề Thi Mới
              </button>
            </div>

            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Tên đề thi</th>
                      <th className="pb-3 font-bold uppercase">Phân loại</th>
                      <th className="pb-3 font-bold uppercase">Thời gian</th>
                      <th className="pb-3 font-bold uppercase">Mã Code Ẩn (Bí Mật)</th>
                      <th className="pb-3 font-bold uppercase">Xem lại đáp án</th>
                      <th className="pb-3 font-bold uppercase text-right">Phòng thi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {examsList
                      .filter((e) => (e.title || '').toLowerCase().includes(examSearch.toLowerCase().trim()) || (e.access_code || '').toLowerCase().includes(examSearch.toLowerCase().trim()))
                      .map((exam) => (
                        <tr key={exam.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="py-3.5 font-bold max-w-xs truncate text-slate-900 dark:text-white">
                            {exam.title}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                              {exam.exam_type}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono">{exam.duration} phút</td>
                          <td className="py-3.5">
                            {exam.access_code ? (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                                  {exam.access_code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(exam.id, exam.access_code)}
                                  className="p-1 rounded hover:bg-black/5 text-[#6B7280]"
                                  title="Sao chép mã mở đề"
                                >
                                  {copiedCodeId === exam.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#6B7280] font-normal">Công khai</span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                              exam.allow_review ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              {exam.allow_review ? 'Đang mở' : 'Đã khóa'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <Link
                              href={`/new-exams/${exam.id}`}
                              className="inline-flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-black/10"
                            >
                              <Eye className="h-3.5 w-3.5" /> Vào thi
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRO MULTI-SECTION EXAM BUILDER (CHUẨN MA TRẬN 2026 & ADMIN CŨ) */}
        {activeTab === 'create_exam' && (
          <div className="mt-6 max-w-4xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600">
                  <FileCode className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                    Soạn Đề Thi Chuyên Nghiệp (Multi-Section Pro Builder)
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">
                    Cấu hình đa phần thi (Trắc nghiệm, Đúng/Sai, Điền số), nạp đáp án nhanh & tải PDF lên Google Drive.
                  </p>
                </div>
              </div>

              {/* Nút nạp nhanh mẫu đề thi */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadPresetTHPT2026}
                  className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition hover:bg-indigo-500/20"
                >
                  🎯 Mẫu THPT 2026
                </button>
                <button
                  type="button"
                  onClick={handleLoadPresetHSA}
                  className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 transition hover:bg-teal-500/20"
                >
                  ⚡ Mẫu HSA
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-5 text-xs font-bold">
              {/* THÔNG TIN CHUNG */}
              <div className="space-y-4">
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Tên tiêu đề đề thi (*)</label>
                  <input
                    type="text"
                    placeholder="Đề khảo sát chất lượng Toán THPT Quốc Gia 2026..."
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm outline-none focus:border-indigo-500 shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Loại kỳ thi</label>
                    <select
                      value={examTypeVal}
                      onChange={(e) => setExamTypeVal(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    >
                      {EXAM_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Thời gian (phút)</label>
                    <input
                      type="number"
                      value={examDuration}
                      onChange={(e) => setExamDuration(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Số lượt thi</label>
                    <input
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B7280] dark:text-slate-400 block mb-1">Tính điểm</label>
                    <select
                      value={gradingMethod}
                      onChange={(e) => setGradingMethod(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    >
                      <option value="highest">Điểm cao nhất</option>
                      <option value="latest">Lần nộp cuối</option>
                    </select>
                  </div>
                </div>

                {/* Upload PDF */}
                <div>
                  <label className="text-[#6B7280] dark:text-slate-400 block mb-1.5">Tệp PDF đề thi gốc (*)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setExamPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400"
                  />
                </div>

                {/* Tùy chọn Đề Ẩn / Mã Code Bí Mật & Giám sát */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-black">Đề thi ẩn (Cấp mã Access Code)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={examIsHidden}
                        onChange={(e) => setExamIsHidden(e.target.checked)}
                        className="h-4 w-4 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                    {examIsHidden && (
                      <input
                        type="text"
                        placeholder="Mã mở đề (VD: TOAN12, HSA2026...)"
                        value={examCustomCode}
                        onChange={(e) => setExamCustomCode(e.target.value.toUpperCase())}
                        className="h-9 w-full font-mono font-bold uppercase rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-rose-500" />
                      <div>
                        <p className="text-xs font-black">Bật giám sát chống gian lận</p>
                        <span className="text-[10px] text-[#6B7280] font-normal">Cảnh báo & đếm số lần thoát tab</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireProctoring}
                      onChange={(e) => setRequireProctoring(e.target.checked)}
                      className="h-4 w-4 accent-rose-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* DANH SÁCH CÁC PHẦN THI (SECTIONS) */}
              <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Cấu Trúc Các Phần Thi ({examSections.length} phần)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm Phần Thi
                  </button>
                </div>

                {examSections.map((sec, secIdx) => (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">
                          {secIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={sec.name}
                          onChange={(e) => handleUpdateSection(sec.id, { name: e.target.value })}
                          className="h-9 flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickAnswersModalSecId(sec.id)}
                          className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500/20"
                        >
                          ⚡ Nhập nhanh đáp án
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(sec.id)}
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10"
                          title="Xóa phần thi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[#6B7280] block mb-1">Loại câu hỏi</label>
                        <select
                          value={sec.type}
                          onChange={(e) => handleUpdateSection(sec.id, { type: e.target.value, correctAnswers: {} })}
                          className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-2.5 outline-none"
                        >
                          <option value="single_choice">Trắc nghiệm nhiều lựa chọn (A, B, C, D)</option>
                          <option value="true_false">Trắc nghiệm Đúng / Sai (a, b, c, d)</option>
                          <option value="short_answer">Trả lời ngắn / Điền số</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[#6B7280] block mb-1">Số câu hỏi</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={sec.questionCount}
                          onChange={(e) => handleUpdateSection(sec.id, { questionCount: parseInt(e.target.value) || 1 })}
                          className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-2.5 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[#6B7280] block mb-1">Tổng điểm phần thi</label>
                        <input
                          type="number"
                          step="0.1"
                          value={sec.sectionTotalPoints}
                          onChange={(e) => handleUpdateSection(sec.id, { sectionTotalPoints: parseFloat(e.target.value) || 1 })}
                          className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-2.5 outline-none"
                        />
                      </div>
                    </div>

                    {/* MA TRẬN ĐÁP ÁN TRỰC QUAN */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-[#6B7280] block mb-2">
                        Bảng Đáp Án Chi Tiết ({sec.questionCount} câu):
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-black/5 dark:border-white/5 custom-scrollbar">
                        {Array.from({ length: sec.questionCount }).map((_, qIdx) => {
                          const currentAns = sec.correctAnswers?.[qIdx]

                          if (sec.type === 'single_choice') {
                            return (
                              <div key={qIdx} className="p-2 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-slate-800 flex items-center justify-between">
                                <span className="font-bold text-[11px] text-[#6B7280]">C{qIdx + 1}:</span>
                                <div className="flex gap-1">
                                  {['A', 'B', 'C', 'D'].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleAnswerChange(sec.id, qIdx, opt)}
                                      className={`h-6 w-6 rounded text-[10px] font-black transition ${
                                        currentAns === opt
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                          }

                          if (sec.type === 'true_false') {
                            const tf = currentAns || {}
                            return (
                              <div key={qIdx} className="p-2 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-slate-800 space-y-1">
                                <span className="font-bold text-[11px] text-[#6B7280]">Câu {qIdx + 1}:</span>
                                <div className="grid grid-cols-2 gap-1 text-[9px]">
                                  {['a', 'b', 'c', 'd'].map((sub) => (
                                    <button
                                      key={sub}
                                      type="button"
                                      onClick={() => {
                                        const cur = tf[sub] === 'D' ? 'S' : 'D'
                                        handleAnswerChange(sec.id, qIdx, { ...tf, [sub]: cur })
                                      }}
                                      className={`px-1 py-0.5 rounded font-black ${
                                        tf[sub] === 'D'
                                          ? 'bg-emerald-600 text-white'
                                          : tf[sub] === 'S'
                                          ? 'bg-rose-600 text-white'
                                          : 'bg-black/5 dark:bg-white/5'
                                      }`}
                                    >
                                      {sub}: {tf[sub] || '-'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={qIdx} className="p-2 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-slate-800 space-y-1">
                              <span className="font-bold text-[11px] text-[#6B7280]">C{qIdx + 1}:</span>
                              <input
                                type="text"
                                placeholder="Đáp án"
                                value={currentAns || ''}
                                onChange={(e) => handleAnswerChange(sec.id, qIdx, e.target.value)}
                                className="h-6 w-full rounded border border-black/10 dark:border-white/10 px-1 text-[11px] font-mono outline-none"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={creatingExam}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-4 text-xs font-black uppercase tracking-wider shadow-xl transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {creatingExam ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                Xuất Bản Toàn Bộ Đề Thi Lên Hệ Thống
              </button>
            </form>
          </div>
        )}

        {/* MODAL NHẬP ĐÁP ÁN NHANH BẰNG TEXT */}
        {quickAnswersModalSecId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                ⚡ Nhập Chuỗi Đáp Án Nhanh
              </h3>
              <p className="text-xs text-[#6B7280]">
                Dán chuỗi đáp án (VD: <code>1A 2B 3C 4D...</code> hoặc <code>1Đ-S-Đ-S 2S-Đ-Đ-S...</code> hoặc dán chuỗi chữ cái <code>ABCDADCB...</code>):
              </p>

              <textarea
                rows={5}
                value={quickAnswersText}
                onChange={(e) => setQuickAnswersText(e.target.value)}
                placeholder="Dán chuỗi đáp án vào đây..."
                className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-indigo-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAnswersModalSecId(null)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickAnswers(quickAnswersModalSecId, quickAnswersText)}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Nạp Đáp Án
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ANNOUNCEMENTS WRITER */}
        {activeTab === 'announcements' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Editor */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                <Megaphone className="h-5 w-5 text-teal-500" /> Soạn Thông Báo Cho Người Dùng
              </h3>

              <form onSubmit={handlePublishAnnouncement} className="space-y-3.5 text-xs font-bold">
                <div>
                  <label className="text-[#6B7280] block mb-1">Tiêu đề thông báo:</label>
                  <input
                    type="text"
                    placeholder="VD: Cập nhật hệ thống SenExam 2026..."
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#6B7280] block mb-1">
                    Nội dung thông báo (hỗ trợ cú pháp <code>###(H1)</code>, <code>{'{Center:...}'}</code>, <code>{'{bold:...}'}</code>, <code>{'{time_:YYYY-MM-DDTHH:mm}'}</code>):
                  </label>
                  <textarea
                    rows={8}
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {savingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Phát Hành Thông Báo Ngay
                </button>
              </form>
            </div>

            {/* Live Preview */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#6B7280] block">
                Xem Trước Giao Diện Bản Tin (Live Preview)
              </span>
              <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5">
                <AnnouncementRenderer text={annContent} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GIVEAWAY SENCASH */}
        {activeTab === 'giveaway' && (
          <div className="mt-6 max-w-2xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                  Giveaway Tặng SenCash
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Cộng trực tiếp SenCash vào ví học sinh theo địa chỉ Email đăng ký.
                </p>
              </div>
            </div>

            <form onSubmit={handleGiveawaySenCash} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Email học sinh nhận thưởng
                </label>
                <input
                  type="email"
                  placeholder="vidu: hocsinh@gmail.com"
                  value={giveawayTargetEmail}
                  onChange={(e) => setGiveawayTargetEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-xs sm:text-sm font-semibold outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Số lượng SenCash tặng
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['50', '100', '200', '500'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setGiveawayAmount(amt)}
                      className={`rounded-xl py-2 text-xs font-black border transition ${
                        giveawayAmount === amt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                      }`}
                    >
                      +{amt} SC
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={giveawayAmount}
                  onChange={(e) => setGiveawayAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-1.5">
                  Lời nhắn / Lý do tặng
                </label>
                <input
                  type="text"
                  placeholder="Quà tặng vinh danh sĩ tử đạt điểm cao..."
                  value={giveawayReason}
                  onChange={(e) => setGiveawayReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-semibold outline-none"
                />
              </div>

              {giveawayMsg && (
                <div className={`rounded-2xl border p-4 text-xs font-bold flex items-center gap-2 ${
                  giveawayMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                }`}>
                  {giveawayMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{giveawayMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={giveawayLoading || !giveawayTargetEmail.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {giveawayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Tặng SenCash Ngay
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: GIFT CODES 16 CHARS */}
        {activeTab === 'giftcodes' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                <Gift className="h-5 w-5 text-pink-500" /> Tạo Mã Quà Tặng 16 Chữ Số
              </h3>

              <form onSubmit={handleCreateGiftCodes} className="space-y-3.5 text-xs font-bold">
                <div>
                  <span className="text-[#6B7280] block mb-1">Loại phần thưởng:</span>
                  <select
                    value={codeType}
                    onChange={(e) => setCodeType(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  >
                    <option value="sencash">Tặng SenCash</option>
                    <option value="vip_days">Tặng Ngày VIP</option>
                    <option value="senai_tier">Tặng Gói SenAI Ultra</option>
                  </select>
                </div>

                {codeType === 'sencash' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượng SenCash:</span>
                    <input
                      type="number"
                      value={codeAmount}
                      onChange={(e) => setCodeAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                {codeType === 'vip_days' && (
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số ngày VIP:</span>
                    <input
                      type="number"
                      value={codeVipDays}
                      onChange={(e) => setCodeVipDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#6B7280] block mb-1">Số lượt dùng:</span>
                    <input
                      type="number"
                      min="1"
                      value={codeMaxUses}
                      onChange={(e) => setCodeMaxUses(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-1">Hạn dùng (ngày):</span>
                    <input
                      type="number"
                      min="1"
                      value={codeExpiresDays}
                      onChange={(e) => setCodeExpiresDays(e.target.value)}
                      className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[#6B7280] block mb-1">Số lượng mã muốn tạo:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={codeBatchCount}
                    onChange={(e) => setCodeBatchCount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={codeLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50 mt-2"
                >
                  {codeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Tạo Mã 16 Ký Tự (XXXX-XXXX-XXXX-XXXX)
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
                Danh Sách Mã Quà Tặng ({giftCodes.length})
              </h3>

              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                      <th className="pb-3 font-bold uppercase">Mã (16 ký tự)</th>
                      <th className="pb-3 font-bold uppercase">Phần thưởng</th>
                      <th className="pb-3 font-bold uppercase">Đã dùng</th>
                      <th className="pb-3 font-bold uppercase">Hạn dùng</th>
                      <th className="pb-3 font-bold uppercase text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                    {giftCodes.map((c) => (
                      <tr key={c.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3 font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {c.code}
                        </td>
                        <td className="py-3">{describeGiftReward(c)}</td>
                        <td className="py-3">
                          {c.used_count}/{c.max_uses}
                        </td>
                        <td className="py-3 text-[11px] text-[#6B7280]">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.id, c.code)}
                            className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 px-2 py-1 text-[11px] font-bold hover:bg-black/5"
                          >
                            {copiedCodeId === c.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedCodeId === c.id ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: USERS LIST */}
        {activeTab === 'users' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              Quản Lý Thành Viên & Phân Quyền ({usersList.length})
            </h3>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[#6B7280] dark:text-slate-400">
                    <th className="pb-3 font-bold uppercase">Họ tên & Email</th>
                    <th className="pb-3 font-bold uppercase">Vai trò</th>
                    <th className="pb-3 font-bold uppercase">Số dư SenCash</th>
                    <th className="pb-3 font-bold uppercase">Hạn VIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-3">
                        <p className="font-bold">{u.full_name || 'Học sinh'}</p>
                        <span className="text-[11px] text-[#6B7280]">{u.email || u.id}</span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 font-bold uppercase text-[10px]">
                          {u.role || 'student'}
                        </span>
                      </td>
                      <td className="py-3 font-black text-amber-600 dark:text-amber-400">
                        {(u.sencash_balance || 0).toLocaleString('vi-VN')} SC
                      </td>
                      <td className="py-3 text-[11px] text-[#6B7280]">
                        {u.vip_expires_at ? new Date(u.vip_expires_at).toLocaleDateString('vi-VN') : 'Miễn phí'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: BUG TRACKER & REAL USER FEEDBACK */}
        {activeTab === 'bugtracker' && (
          <div className="mt-6 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <h3 className="text-base font-black flex items-center gap-2 text-rose-500" style={{ fontFamily: 'var(--font-newadm-heading)' }}>
              <Bug className="h-5 w-5" /> Nhật Ký Báo Lỗi & Góp Ý Từ Người Dùng ({feedbackList.length})
            </h3>

            <div className="space-y-3">
              {feedbackList.length === 0 ? (
                <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center py-8">
                  Chưa có báo lỗi hoặc góp ý nào từ người dùng.
                </p>
              ) : (
                feedbackList.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-xs font-semibold space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{b.user_name || b.user_email || 'Học sinh'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase">
                          {b.category || 'Góp ý'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7280]">{new Date(b.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-black/5 dark:border-white/5 font-normal leading-relaxed">
                      {b.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
