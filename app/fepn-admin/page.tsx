'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import AdminSecurityVault, { FileEncryptionCenter } from '@/app/components/AdminSecurityVaultModal'
import {
  BookOpen,
  FolderOpen,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Users,
  FileLock2,
  Download,
  Upload,
  ArrowRight,
  LogOut,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Video,
  Award,
  Calendar,
  Clock,
  Database,
  Eye,
  RefreshCw,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export interface FepnSubject {
  id: string
  code: string
  name: string
  credits: number
  semester: string
  description?: string
  icon?: string
  created_at?: string
  total_materials?: number
}

export interface FepnMaterial {
  id: string
  subject_id: string
  title: string
  category: 'slide' | 'exercise' | 'video' | 'exam'
  file_url: string
  file_type?: string
  created_at?: string
}

export interface FepnUser {
  id: string
  email?: string
  full_name?: string
  role?: string
  created_at?: string
  admin_key_issued_at?: string
  [key: string]: any
}

export default function FepnAdminDashboardPage() {
  const router = useRouter()
  const themeVars = useMemo(() => getModernThemeVars('indigo', false), [])

  // Auth & Admin Verification
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthorized' | 'unauthenticated'>('loading')

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'materials' | 'recap' | 'vault'>('overview')

  // Deep Security Vault States
  const [isDeepVaultUnlocked, setIsDeepVaultUnlocked] = useState(false)
  const [activePayloadToken, setActivePayloadToken] = useState<string | null>(null)
  const [activeKeyId, setActiveKeyId] = useState<string>('')

  // Data States
  const [subjects, setSubjects] = useState<FepnSubject[]>([])
  const [materials, setMaterials] = useState<FepnMaterial[]>([])
  const [recapCount, setRecapCount] = useState(0)
  const [userList, setUserList] = useState<FepnUser[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [subCode, setSubCode] = useState('')
  const [subName, setSubName] = useState('')
  const [subCredits, setSubCredits] = useState(3)
  const [subSemester, setSubSemester] = useState('Kỳ 1')
  const [subDescription, setSubDescription] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)

  // Material Modal State
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [matSubjectId, setMatSubjectId] = useState('')
  const [matTitle, setMatTitle] = useState('')
  const [matCategory, setMatCategory] = useState<'slide' | 'exercise' | 'video' | 'exam'>('slide')
  const [matFileUrl, setMatFileUrl] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)

  // Filters & Search
  const [searchSubject, setSearchSubject] = useState('')
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('all')
  const [searchMaterial, setSearchMaterial] = useState('')
  const [selectedMatSubjectFilter, setSelectedMatSubjectFilter] = useState('all')
  const [selectedMatCategoryFilter, setSelectedMatCategoryFilter] = useState('all')

  // ========================================================
  // 1. AUTHENTICATION & ROLE CHECK
  // ========================================================
  const checkFepnAdmin = async () => {
    setAuthLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      let currentUser = userData?.user ?? null
      if (!currentUser) {
        const { data: sessionData } = await supabase.auth.getSession()
        currentUser = sessionData?.session?.user ?? null
      }

      if (!currentUser) {
        setAuthStatus('unauthenticated')
        setAuthLoading(false)
        return
      }

      setUser(currentUser)

      // Query user role in profiles (only select 'role' to avoid schema error on non-existent columns)
      let role = ''
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (!error && profile?.role) {
          role = profile.role
        }
      } catch (err) {
        console.warn('Could not read role from profiles:', err)
      }

      const userEmail = currentUser.email?.toLowerCase() || ''
      const userRoleLower = role.toLowerCase().trim()
      const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role || '').toLowerCase().trim()

      const isUserAdmin =
        userRoleLower === 'admin' ||
        userRoleLower === 'collab' ||
        metaRole === 'admin' ||
        metaRole === 'collab' ||
        userEmail === 'hoangbinhminh2508@gmail.com'

      // Auto-heal admin role in profiles for the creator/owner or meta-admin if missing
      if (isUserAdmin && userRoleLower !== 'admin' && userRoleLower !== 'collab') {
        try {
          await supabase.from('profiles').upsert({ id: currentUser.id, role: 'admin' }, { onConflict: 'id' })
        } catch {}
      }

      setIsAdmin(isUserAdmin)
      if (isUserAdmin) {
        setAuthStatus('authenticated')
      } else {
        setAuthStatus('unauthorized')
      }
    } catch (err) {
      console.error('Error checking FEPN admin:', err)
      setAuthStatus('unauthenticated')
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    checkFepnAdmin()
  }, [])

  // ========================================================
  // 2. FETCH FEPN DATA
  // ========================================================
  const fetchAllData = async () => {
    setLoadingData(true)
    try {
      // 1. Subjects
      const { data: subData } = await supabase
        .from('fepn_subjects')
        .select('*')
        .order('created_at', { ascending: false })
      setSubjects(subData || [])

      // 2. Materials
      const { data: matData } = await supabase
        .from('fepn_materials')
        .select('*')
        .order('created_at', { ascending: false })
      setMaterials(matData || [])

      // 3. Recap posts count
      const { count: recapC } = await supabase
        .from('fepn_recap_posts')
        .select('id', { count: 'exact', head: true })
      setRecapCount(recapC || 0)

      // 4. Profiles (for Deep Vault User Role Management)
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .limit(100)
      setUserList(usersData || [])
    } catch (err) {
      console.error('Error fetching FEPN admin data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchAllData()
    }
  }, [isAdmin])

  // Deep Vault Unlock Handler
  const handleVaultUnlockSuccess = (payloadToken: string, keyId: string) => {
    setIsDeepVaultUnlocked(true)
    setActivePayloadToken(payloadToken)
    setActiveKeyId(keyId)
  }

  const handleVaultLock = () => {
    setIsDeepVaultUnlocked(false)
    setActivePayloadToken(null)
    setActiveKeyId('')
  }

  // ========================================================
  // 3. SUBJECT ACTIONS
  // ========================================================
  const handleOpenNewSubject = () => {
    setEditingSubjectId(null)
    setSubCode('')
    setSubName('')
    setSubCredits(3)
    setSubSemester('Kỳ 1')
    setSubDescription('')
    setShowSubjectModal(true)
  }

  const handleOpenEditSubject = (sub: FepnSubject) => {
    setEditingSubjectId(sub.id)
    setSubCode(sub.code)
    setSubName(sub.name)
    setSubCredits(sub.credits)
    setSubSemester(sub.semester)
    setSubDescription(sub.description || '')
    setShowSubjectModal(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subCode.trim() || !subName.trim()) {
      alert('Vui lòng nhập mã môn và tên môn học!')
      return
    }

    setSavingSubject(true)
    try {
      const payload = {
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        credits: Number(subCredits) || 3,
        semester: subSemester,
        description: subDescription.trim(),
        updated_at: new Date().toISOString(),
      }

      if (editingSubjectId) {
        const { error } = await supabase
          .from('fepn_subjects')
          .update(payload)
          .eq('id', editingSubjectId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('fepn_subjects')
          .insert(payload)
        if (error) throw error
      }

      setShowSubjectModal(false)
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi lưu môn học: ' + err.message)
    } finally {
      setSavingSubject(false)
    }
  }

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa môn học "${name}"? Thao tác này sẽ xóa toàn bộ học liệu liên quan!`)) return
    try {
      const { error } = await supabase.from('fepn_subjects').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi xóa môn học: ' + err.message)
    }
  }

  // ========================================================
  // 4. MATERIAL ACTIONS
  // ========================================================
  const handleOpenNewMaterial = () => {
    setMatSubjectId(subjects[0]?.id || '')
    setMatTitle('')
    setMatCategory('slide')
    setMatFileUrl('')
    setShowMaterialModal(true)
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matSubjectId || !matTitle.trim() || !matFileUrl.trim()) {
      alert('Vui lòng điền đầy đủ môn học, tiêu đề và link tài liệu!')
      return
    }

    setSavingMaterial(true)
    try {
      const { error } = await supabase.from('fepn_materials').insert({
        subject_id: matSubjectId,
        title: matTitle.trim(),
        category: matCategory,
        file_url: matFileUrl.trim(),
        created_at: new Date().toISOString(),
      })
      if (error) throw error

      setShowMaterialModal(false)
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi lưu học liệu: ' + err.message)
    } finally {
      setSavingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (id: string, title: string) => {
    if (!confirm(`Xác nhận xóa học liệu "${title}"?`)) return
    try {
      const { error } = await supabase.from('fepn_materials').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi xóa tài liệu: ' + err.message)
    }
  }

  // User Role Change (Deep Vault Only)
  const handleChangeUserRole = async (targetUserId: string, newRole: string) => {
    if (!isDeepVaultUnlocked) {
      alert('Vui lòng mở khóa Deep Security Vault bằng file .key để thực hiện thay đổi quyền!')
      return
    }
    if (!confirm(`Xác nhận chuyển quyền người dùng sang "${newRole}"?`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId)
      if (error) throw error
      alert('Cập nhật quyền thành công!')
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi cập nhật quyền: ' + err.message)
    }
  }

  // Filtered Lists
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchSearch = s.code.toLowerCase().includes(searchSubject.toLowerCase()) ||
        s.name.toLowerCase().includes(searchSubject.toLowerCase())
      const matchSem = selectedSemesterFilter === 'all' || s.semester === selectedSemesterFilter
      return matchSearch && matchSem
    })
  }, [subjects, searchSubject, selectedSemesterFilter])

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch = m.title.toLowerCase().includes(searchMaterial.toLowerCase())
      const matchSub = selectedMatSubjectFilter === 'all' || m.subject_id === selectedMatSubjectFilter
      const matchCat = selectedMatCategoryFilter === 'all' || m.category === selectedMatCategoryFilter
      return matchSearch && matchSub && matchCat
    })
  }, [materials, searchMaterial, selectedMatSubjectFilter, selectedMatCategoryFilter])

  // Subject code to name lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, FepnSubject>()
    subjects.forEach((s) => map.set(s.id, s))
    return map
  }, [subjects])

  // ========================================================
  // LOADING / UNAUTHENTICATED SCREENS
  // ========================================================
  if (authLoading) {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] text-slate-900 font-sans`}>
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 backdrop-blur-2xl border border-black/10 shadow-2xl">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            <span className="font-bold text-sm tracking-wide">Đang xác thực quyền Quản trị FEPN...</span>
          </div>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthenticated' || authStatus === 'unauthorized') {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] text-slate-900 p-4 font-sans`}>
        <div className="flex flex-col items-center gap-4 w-full max-w-md p-8 rounded-3xl bg-white/90 backdrop-blur-2xl border border-black/10 shadow-2xl text-center">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>
          <div className="w-full">
            <h2 className="text-xl font-black text-slate-900 mb-2">
              {authStatus === 'unauthorized' ? 'Từ chối truy cập (403)' : 'Yêu cầu đăng nhập'}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {authStatus === 'unauthorized'
                ? 'Trang này chỉ dành riêng cho Quản trị viên Khoa Vật lý kỹ thuật & Công nghệ Nano.'
                : 'Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập bảng điều khiển FEPN Admin.'}
            </p>

            {user?.email && (
              <div className="mb-6 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
                <span className="text-slate-500 font-medium">Tài khoản hiện tại:</span>{' '}
                <strong className="text-sky-700 font-bold">{user.email}</strong>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => checkFepnAdmin()}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại xác thực quyền Admin
              </button>
              <Link
                href="/fepn-login"
                className="w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Đăng nhập tài khoản khác
              </Link>
              <Link
                href="/fepn-dashboard"
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-semibold transition"
              >
                Quay về FEPN Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================
  // MAIN DASHBOARD VIEW
  // ========================================================
  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 font-sans flex flex-col bg-slate-50`}
      style={{
        ...themeVars,
        background:
          'radial-gradient(circle at 10% 10%, rgba(224, 242, 254, 0.6), transparent 35%), radial-gradient(circle at 90% 15%, rgba(224, 231, 255, 0.6), transparent 40%), #F8FAFC',
      }}
    >
      {/* 1. TOP HEADER BRANDING */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-3 sm:px-6 shadow-2xs">
        <div className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/fepn-dashboard" className="flex items-center gap-3 group">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-sky-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-lg sm:text-xl font-black tracking-tight text-sky-950"
                    style={{ fontFamily: 'var(--font-fepn-heading)' }}
                  >
                    FEPN Admin Portal
                  </h1>
                  <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600">
                    Bảo mật tối cao
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
                  Khoa Vật lý kỹ thuật & Công nghệ Nano - UET VNU
                </p>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-2 hidden md:block" />

            {/* Subsite Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/fepn-dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                <span>Xem Môn Học</span>
              </Link>
              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <span>Xem Kỷ Yếu</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Vault Status Indicator */}
            <div
              onClick={() => setActiveTab('vault')}
              className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDeepVaultUnlocked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title="Nhấn để xem trạng thái Lớp Bảo Mật Sâu"
            >
              {isDeepVaultUnlocked ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Deep Vault: Đã Mở Khóa</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline">Deep Vault: Đang Khóa</span>
                </>
              )}
            </div>

            {/* User Details */}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-none text-slate-800">{user?.email?.split('@')[0]}</p>
              <span className="text-[10px] font-black text-amber-600 uppercase">
                Quản Trị Viên Khoa
              </span>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/fepn-login')
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-sm transition"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ADMIN TABS BAR */}
      <nav className="border-b border-slate-200 bg-white/70 backdrop-blur-md px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1700px] items-center gap-2 overflow-x-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Tổng Quan FEPN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Quản Lý Môn Học ({subjects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'materials'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Học Liệu & Đề Thi ({materials.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Kỷ Yếu Recap ({recapCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-sm'
                : isDeepVaultUnlocked
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            {isDeepVaultUnlocked ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <Shield className="h-4 w-4 text-amber-500" />}
            <span>Deep Security Vault (.key)</span>
          </button>
        </div>
      </nav>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 mx-auto w-full max-w-[1700px] p-4 sm:p-6 lg:p-8">
        {/* ======================================================== */}
        {/* TAB 1: TỔNG QUAN (OVERVIEW)                              */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tổng Môn Học</span>
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{subjects.length}</div>
                <p className="text-xs text-slate-400">Các môn chuyên ngành & đại cương Khoa FEPN</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tổng Học Liệu</span>
                  <FolderOpen className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{materials.length}</div>
                <p className="text-xs text-slate-400">Slide, bài tập, video và đề thi trực tuyến</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Bài Viết Kỷ Yếu</span>
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{recapCount}</div>
                <p className="text-xs text-slate-400">Ghi lại các hoạt động của từng khóa sinh viên</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tình Trạng An Ninh</span>
                  <ShieldCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-xl font-black text-amber-600">
                  {isDeepVaultUnlocked ? 'DEEP VAULT ONLINE' : 'CẤP ĐỘ 1: AN TOÀN'}
                </div>
                <p className="text-xs text-slate-400">Chứng chỉ Master Key 512-bit mã hóa quân sự</p>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-black text-slate-900">Thao Tác Nhanh Quản Trị FEPN</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('subjects')
                    handleOpenNewSubject()
                  }}
                  className="p-4 rounded-2xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-sky-600 text-white font-bold">
                    <Plus className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Thêm Môn Học Mới</h4>
                  <p className="text-xs text-slate-500">Nhập mã môn, số tín chỉ và cấu hình môn học</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('materials')
                    handleOpenNewMaterial()
                  }}
                  className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-indigo-600 text-white font-bold">
                    <Upload className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Đăng Học Liệu Mới</h4>
                  <p className="text-xs text-slate-500">Tải lên slide, bài tập hoặc đề thi cho sinh viên</p>
                </button>

                <Link
                  href="/fepn-recap"
                  className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-left transition space-y-2 block"
                >
                  <div className="p-2 w-fit rounded-xl bg-emerald-600 text-white font-bold">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Soạn Bài Viết Kỷ Yếu</h4>
                  <p className="text-xs text-slate-500">Mở giao diện Recap để thêm bài viết hoạt động</p>
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveTab('vault')}
                  className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-amber-600 text-white font-bold">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Mở Deep Security Vault</h4>
                  <p className="text-xs text-slate-500">Nộp file .key để mã hóa tệp tin & phân quyền</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ MÔN HỌC (SUBJECTS)                        */}
        {/* ======================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Danh Sách Môn Học FEPN</h3>
                <p className="text-xs text-slate-500">Quản lý chương trình đào tạo và học phần của Khoa</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchSubject}
                    onChange={(e) => setSearchSubject(e.target.value)}
                    placeholder="Tìm kiếm mã môn, tên môn..."
                    className="w-56 sm:w-64 pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <select
                  value={selectedSemesterFilter}
                  onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <option value="all">Tất cả học kỳ</option>
                  <option value="Kỳ 1">Kỳ 1</option>
                  <option value="Kỳ 2">Kỳ 2</option>
                  <option value="Kỳ Hè">Kỳ Hè</option>
                </select>

                <button
                  type="button"
                  onClick={handleOpenNewSubject}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Môn Học</span>
                </button>
              </div>
            </div>

            {/* Subjects Table */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã Môn</th>
                    <th className="px-5 py-3.5">Tên Môn Học</th>
                    <th className="px-5 py-3.5">Số Tín Chỉ</th>
                    <th className="px-5 py-3.5">Học Kỳ</th>
                    <th className="px-5 py-3.5">Mô Tả</th>
                    <th className="px-5 py-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        Không tìm thấy môn học nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3 font-mono font-black text-sky-700">
                          <Link href={`/tsv-fepn/${sub.code.toLowerCase()}`} className="hover:underline flex items-center gap-1">
                            <span>{sub.code}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900">{sub.name}</td>
                        <td className="px-5 py-3 font-semibold text-slate-600">{sub.credits} TC</td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            {sub.semester}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{sub.description || 'Chưa có mô tả'}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubject(sub)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              title="Sửa môn học"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(sub.id, sub.name)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                              title="Xóa môn học"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ HỌC LIỆU (MATERIALS)                      */}
        {/* ======================================================== */}
        {activeTab === 'materials' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Quản Lý Học Liệu & Đề Thi</h3>
                <p className="text-xs text-slate-500">Đăng và điều phối tài liệu các môn học Khoa FEPN</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchMaterial}
                    onChange={(e) => setSearchMaterial(e.target.value)}
                    placeholder="Tìm tên tài liệu..."
                    className="w-48 sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <select
                  value={selectedMatSubjectFilter}
                  onChange={(e) => setSelectedMatSubjectFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs max-w-[200px] truncate"
                >
                  <option value="all">Tất cả môn học</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMatCategoryFilter}
                  onChange={(e) => setSelectedMatCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="slide">Slide bài giảng</option>
                  <option value="exercise">Bài tập</option>
                  <option value="video">Video bài giảng</option>
                  <option value="exam">Đề thi & Đáp án</option>
                </select>

                <button
                  type="button"
                  onClick={handleOpenNewMaterial}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Đăng Tài Liệu</span>
                </button>
              </div>
            </div>

            {/* Materials Table */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Môn Học</th>
                    <th className="px-5 py-3.5">Tiêu Đề Học Liệu</th>
                    <th className="px-5 py-3.5">Phân Loại</th>
                    <th className="px-5 py-3.5">Đường Dẫn File</th>
                    <th className="px-5 py-3.5">Ngày Đăng</th>
                    <th className="px-5 py-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        Chưa có tài liệu nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat) => {
                      const sub = subjectMap.get(mat.subject_id)
                      return (
                        <tr key={mat.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3 font-mono font-bold text-slate-800">
                            {sub ? `${sub.code}` : 'Chưa gán'}
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900 max-w-sm truncate">
                            {mat.title}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                                mat.category === 'exam'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : mat.category === 'video'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : mat.category === 'exercise'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {mat.category}
                            </span>
                          </td>
                          <td className="px-5 py-3 max-w-xs truncate text-sky-600 font-mono text-[11px]">
                            <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              <span className="truncate">{mat.file_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                          <td className="px-5 py-3 text-slate-400">
                            {mat.created_at ? new Date(mat.created_at).toLocaleDateString('vi-VN') : ''}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                              title="Xóa tài liệu"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: QUẢN LÝ KỶ YẾU RECAP                             */}
        {/* ======================================================== */}
        {activeTab === 'recap' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Quản Lý Bài Viết Kỷ Yếu Recap</h3>
                <p className="text-xs text-slate-500">Theo dõi bài viết từng năm nhập học của sinh viên Khoa FEPN</p>
              </div>

              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
              >
                <span>Mở Trang FEPN Recap</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-sky-50 text-sky-600 w-fit mx-auto">
                <Calendar className="h-10 w-10" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Toàn bộ bài viết kỷ yếu đang được quản lý trực tiếp tại giao diện Recap
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện có <strong>{recapCount} bài viết</strong> đã đăng. Admin có thể mở trang FEPN Recap để viết bài mới bằng cú pháp tiêu đề `#h1, #h2`, chèn ảnh `{'{AnhTieuDe}'}`, `{'{AnhDangBai}'}` hoặc tải lên hàng loạt ảnh tự động.
              </p>
              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-md hover:bg-sky-700 transition"
              >
                Đến Giao Diện Soạn Thảo Recap
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: DEEP SECURITY VAULT (BẢO MẬT TỐI MẬT)            */}
        {/* ======================================================== */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <AdminSecurityVault
              userId={user?.id}
              userEmail={user?.email}
              isDeepVaultUnlocked={isDeepVaultUnlocked}
              activePayloadToken={activePayloadToken}
              onUnlockSuccess={handleVaultUnlockSuccess}
              onLockVault={handleVaultLock}
            >
              {/* UNLOCKED DEEP VAULT PROTECTED CONTENT */}
              <div className="space-y-8">
                {/* 1. File Encryption Center */}
                <FileEncryptionCenter payloadToken={activePayloadToken} />

                {/* 2. User & Admin Role Management */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          Phân Quyền Người Dùng & Cấp Quyền Quản Trị
                        </h4>
                        <p className="text-xs text-slate-500">
                          Chỉ có thể thay đổi khi đã mở khóa Deep Vault bằng file khóa .key
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Email Người Dùng</th>
                          <th className="px-4 py-3">Họ Tên</th>
                          <th className="px-4 py-3">Vai Trò Hiện Tại</th>
                          <th className="px-4 py-3">Trạng Thái Khóa .key</th>
                          <th className="px-4 py-3 text-right">Hành Động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userList.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-semibold text-slate-800">{u.email}</td>
                            <td className="px-4 py-3 text-slate-600">{u.full_name || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                                  u.role === 'admin'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {u.role === 'admin' ? 'Quản Trị Viên' : u.role || 'Sinh Viên'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                              {u.admin_key_issued_at ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Đã cấp khóa
                                </span>
                              ) : (
                                <span className="text-slate-400">Chưa cấp</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {u.role === 'admin' ? (
                                <button
                                  type="button"
                                  onClick={() => handleChangeUserRole(u.id, 'student')}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition"
                                >
                                  Hạ quyền sinh viên
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleChangeUserRole(u.id, 'admin')}
                                  className="px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold transition"
                                >
                                  Cấp quyền Admin
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Database Export & Backup */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">
                        Sao Lưu Toàn Bộ Cơ Sở Dữ Liệu FEPN
                      </h4>
                      <p className="text-xs text-slate-500">
                        Xuất file dữ liệu JSON môn học, học liệu và bài viết kỷ yếu để lưu trữ an toàn
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const backupData = {
                        exportedAt: new Date().toISOString(),
                        subjects,
                        materials,
                        recapCount,
                      }
                      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `FEPN_DATABASE_BACKUP_${new Date().toISOString().slice(0, 10)}.json`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-xs font-bold shadow-md hover:bg-black transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Tải Về File Sao Lưu Hệ Thống (.json)</span>
                  </button>
                </div>
              </div>
            </AdminSecurityVault>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* SUBJECT MODAL (CREATE / EDIT)                            */}
      {/* ======================================================== */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingSubjectId ? 'Chỉnh Sửa Môn Học FEPN' : 'Thêm Môn Học FEPN Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Môn Học (VD: EPN1001)</label>
                <input
                  type="text"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                  required
                  placeholder="EPN..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Môn Học</label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                  placeholder="Nhập tên môn học..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Tín Chỉ</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={subCredits}
                    onChange={(e) => setSubCredits(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Học Kỳ</label>
                  <select
                    value={subSemester}
                    onChange={(e) => setSubSemester(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="Kỳ 1">Kỳ 1</option>
                    <option value="Kỳ 2">Kỳ 2</option>
                    <option value="Kỳ Hè">Kỳ Hè</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Tóm Tắt</label>
                <textarea
                  rows={3}
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  placeholder="Mô tả nội dung môn học..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingSubject}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  {savingSubject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingSubjectId ? 'Cập Nhật Môn Học' : 'Thêm Môn Học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MATERIAL MODAL (UPLOAD / ADD)                           */}
      {/* ======================================================== */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Đăng Học Liệu / Đề Thi FEPN</h3>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Môn Học Thuộc Về</label>
                <select
                  value={matSubjectId}
                  onChange={(e) => setMatSubjectId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu Đề Tài Liệu</label>
                <input
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  required
                  placeholder="Ví dụ: Slide Bài Giảng Tuần 1, Đề Thi Cuối Kỳ 2025..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phân Loại Học Liệu</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['slide', 'exercise', 'video', 'exam'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMatCategory(cat)}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition border ${
                        matCategory === cat
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường Dẫn File (Link Google Drive, YouTube hoặc URL)
                </label>
                <input
                  type="url"
                  value={matFileUrl}
                  onChange={(e) => setMatFileUrl(e.target.value)}
                  required
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingMaterial}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  {savingMaterial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Đăng Học Liệu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
