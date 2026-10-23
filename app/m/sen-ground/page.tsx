'use client'

import React, { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'
import {
  Zap,
  BookOpen,
  History,
  Search,
  Filter,
  ChevronRight,
  Clock,
  FileText,
  CheckCircle2,
  Trophy,
  ArrowLeft,
  ExternalLink,
  Download,
  Folder,
  FolderOpen,
  Crown,
  Sparkles,
  Layers,
  ChevronDown,
  RotateCcw,
  Flame,
  Award,
  Video,
  FileSpreadsheet,
  X,
  Package,
  Plus,
  Shuffle,
  Menu,
  Maximize2,
  Minimize2,
  Trash2,
  AlertCircle,
  HelpCircle,
  Check,
  Send,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.05'

interface ExamItem {
  id: string
  title: string
  subject?: string
  exam_type?: string
  duration?: number
  total_questions?: number
  created_at: string
}

interface FolderItem {
  id: string
  name: string
  parent_id: string | null
  created_at?: string
}

interface DocItem {
  id: string
  title: string
  drive_file_id: string
  folder_id: string | null
  created_at: string
  is_vip_only?: boolean
  description?: string | null
}

interface SubmissionItem {
  id: string
  exam_id: string
  score: number
  correct_count: number
  total_questions: number
  created_at: string
  exams?: { title: string; subject?: string; duration?: number }
}

interface ExamCollection {
  id: string
  title: string
  subject?: string
  description?: string
  exam_ids?: string[]
}

function MobileSenGroundContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getInitialTab = (): 'exams' | 'library' | 'history' => {
    const t = searchParams?.get('tab')
    if (t === 'library' || t === 'exams' || t === 'history') return t
    if (searchParams?.has('exams')) return 'exams'
    if (searchParams?.has('library')) return 'library'
    if (searchParams?.has('history')) return 'history'
    return 'exams'
  }

  const [activeTab, setActiveTab] = useState<'exams' | 'library' | 'history'>(getInitialTab())
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // 1. Dữ liệu hệ thống
  const [exams, setExams] = useState<ExamItem[]>([])
  const [collections, setCollections] = useState<ExamCollection[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [docs, setDocs] = useState<DocItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])

  // 2. Tab Kho đề
  const [examSearch, setExamSearch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [activeCollection, setActiveCollection] = useState<ExamCollection | null>(null)
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false)

  // 3. Tab Thư viện Sen Online (FEPN x SenExam)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [folderHistory, setFolderHistory] = useState<string[]>([])
  const [libCategory, setLibCategory] = useState<'all' | 'slides' | 'exercises' | 'videos' | 'exams'>('all')
  const [libSearch, setLibSearch] = useState('')
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocItem | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)
  const [showFloatingTree, setShowFloatingTree] = useState(false)
  const [showCreateLibModal, setShowCreateLibModal] = useState(false)
  const [newLibName, setNewLibName] = useState('')

  // 4. Tab Lịch sử
  const [historySearch, setHistorySearch] = useState('')

  const SUBJECTS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'Toán', label: 'Toán' },
    { key: 'Vật lý', label: 'Vật lý' },
    { key: 'Hóa học', label: 'Hóa học' },
    { key: 'Sinh học', label: 'Sinh học' },
    { key: 'Tiếng Anh', label: 'Tiếng Anh' },
    { key: 'Ngữ văn', label: 'Ngữ văn' },
    { key: 'Lịch sử', label: 'Lịch sử' },
    { key: 'Địa lý', label: 'Địa lý' },
    { key: 'Tin học', label: 'Tin học' },
  ]

  useEffect(() => {
    const t = getInitialTab()
    setActiveTab(t)
  }, [searchParams])

  useEffect(() => {
    async function loadAllData() {
      try {
        setLoading(true)
        const [examRes, folderRes, docRes, userRes] = await Promise.all([
          supabase.from('exams').select('*').order('created_at', { ascending: false }),
          supabase.from('library_folders').select('*').order('name', { ascending: true }),
          supabase.from('library_documents').select('*').order('created_at', { ascending: false }),
          supabase.auth.getUser(),
        ])

        if (examRes.data) setExams(examRes.data)
        if (folderRes.data) setFolders(folderRes.data)
        if (docRes.data) setDocs(docRes.data)

        if (userRes.data?.user) {
          setCurrentUserId(userRes.data.user.id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userRes.data.user.id)
            .maybeSingle()
          if (profile?.role === 'admin') setIsAdmin(true)

          const { data: subData } = await supabase
            .from('submissions')
            .select('id, exam_id, score, correct_count, total_questions, created_at, exams(title, subject, duration)')
            .eq('user_id', userRes.data.user.id)
            .order('created_at', { ascending: false })
          if (subData) setSubmissions(subData as any)
        }

        // Tải tuyển tập đề
        try {
          const colRes = await fetch('/api/exam-collections')
          if (colRes.ok) {
            const colJson = await colRes.json()
            if (colJson.collections) setCollections(colJson.collections)
          }
        } catch (e) {
          console.warn('Lỗi tải tuyển tập:', e)
        }
      } catch (err) {
        console.error('Error loading mobile sen ground:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAllData()
  }, [])

  const handleTabChange = (tab: 'exams' | 'library' | 'history') => {
    setActiveTab(tab)
    router.replace(`/m/sen-ground?tab=${tab}`, { scroll: false })
  }

  // Lọc đề thi
  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      const matchSub =
        selectedSubject === 'all' ||
        (ex.subject && ex.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
      const matchSearch =
        !examSearch.trim() || ex.title.toLowerCase().includes(examSearch.toLowerCase())
      return matchSub && matchSearch
    })
  }, [exams, selectedSubject, examSearch])

  // Thư viện phân cấp
  const currentFolder = folders.find((f) => f.id === activeFolderId)
  const visibleFolders = useMemo(() => {
    if (!activeFolderId) {
      return folders.filter((f) => !f.parent_id || !folders.some((p) => p.id === f.parent_id))
    }
    return folders.filter((f) => f.parent_id === activeFolderId)
  }, [folders, activeFolderId])

  const currentFolderDocs = useMemo(() => {
    if (!activeFolderId) return []
    return docs.filter((d) => d.folder_id === activeFolderId)
  }, [docs, activeFolderId])

  const filteredCategoryDocs = useMemo(() => {
    let result = currentFolderDocs
    if (libSearch.trim()) {
      result = result.filter((d) => d.title.toLowerCase().includes(libSearch.toLowerCase()))
    }
    if (libCategory === 'slides') {
      return result.filter(
        (d) =>
          !d.description?.includes('[CATEGORY:exercises]') &&
          !d.description?.includes('[CATEGORY:videos]') &&
          !d.description?.includes('[ATTACHED_EXAM:')
      )
    }
    if (libCategory === 'exercises') {
      return result.filter((d) => d.description?.includes('[CATEGORY:exercises]'))
    }
    if (libCategory === 'videos') {
      return result.filter((d) => d.description?.includes('[CATEGORY:videos]'))
    }
    if (libCategory === 'exams') {
      return result.filter((d) => d.description?.includes('[ATTACHED_EXAM:'))
    }
    return result
  }, [currentFolderDocs, libCategory, libSearch])

  const attachedExamsForFolder = useMemo(() => {
    if (!currentFolder) return []
    const attachedExamDocs = currentFolderDocs.filter((d) => d.description?.includes('[ATTACHED_EXAM:'))
    const attachedIds = attachedExamDocs.map((d) => {
      const m = d.description?.match(/\[ATTACHED_EXAM:([^\]]+)\]/)
      return m ? m[1] : d.drive_file_id
    })
    return exams.filter(
      (ex) =>
        attachedIds.includes(ex.id) ||
        (ex.subject && currentFolder.name.toLowerCase().includes(ex.subject.toLowerCase()))
    )
  }, [currentFolder, currentFolderDocs, exams])

  // Lịch sử stats
  const historyStats = useMemo(() => {
    if (submissions.length === 0) return { total: 0, highest: 0, avg: 0, passRate: 0 }
    const scores = submissions.map((s) => s.score || 0)
    const highest = Math.max(...scores)
    const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    const passCount = scores.filter((s) => s >= 5.0).length
    const passRate = Math.round((passCount / scores.length) * 100)
    return { total: submissions.length, highest, avg, passRate }
  }, [submissions])

  const filteredSubmissions = useMemo(() => {
    if (!historySearch.trim()) return submissions
    return submissions.filter(
      (sub) =>
        sub.exams?.title?.toLowerCase().includes(historySearch.toLowerCase()) ||
        sub.exams?.subject?.toLowerCase().includes(historySearch.toLowerCase())
    )
  }, [submissions, historySearch])

  // Xử lý tạo thư mục Thư viện
  const handleCreateFolder = async () => {
    if (!newLibName.trim()) return
    try {
      const { data, error } = await supabase
        .from('library_folders')
        .insert([{ name: newLibName.trim(), parent_id: activeFolderId, created_by: currentUserId }])
        .select()
        .single()
      if (error) throw error
      if (data) setFolders((prev) => [...prev, data])
      setNewLibName('')
      setShowCreateLibModal(false)
    } catch (e: any) {
      alert(`Không thể tạo thư mục: ${e.message}`)
    }
  }

  if (loading) {
    return (
      <ModernLoading
        title="SenExam 2.0 Mobile"
        subtitle={`Đang nạp dữ liệu Sen Ground (v${MOBILE_VERSION})...`}
      />
    )
  }

  return (
    <div className="flex-1 w-full p-4 space-y-4 pb-12">
      {/* 1. HEADER 3 TABS ĐIỀU HƯỚNG */}
      <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10">
        <button
          type="button"
          onClick={() => handleTabChange('exams')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 ${
            activeTab === 'exams'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Kho Đề Thi</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('library')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 ${
            activeTab === 'library'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Thư Viện Sen</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 ${
            activeTab === 'history'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Lịch Sử Thi</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: KHO ĐỀ THI & TUYỂN TẬP ĐỀ (EXAMS)                   */}
      {/* ========================================================= */}
      {activeTab === 'exams' && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Header Action Bar: Tìm kiếm + Nút Tuyển tập đề (Chỉ để icon như PC) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm đề thi, khối thi..."
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                className="w-full h-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            {/* Nút Tuyển tập đề: Chỉ để icon */}
            <button
              type="button"
              onClick={() => {
                if (collections.length > 0) setActiveCollection(collections[0])
              }}
              title="Quản lý tuyển tập đề"
              className="w-10 h-10 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center active:scale-95 transition shadow-xs cursor-pointer shrink-0"
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>

          {/* Dải tuyển tập đề (Exam Collections) */}
          {collections.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Package className="h-3 w-3" /> Tuyển Tập Đề Chọn Lọc
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-2.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 min-w-[200px] flex items-center justify-between gap-2 shrink-0 shadow-xs"
                  >
                    <div className="truncate">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {col.title}
                      </h5>
                      <span className="text-[10px] text-slate-400">
                        {col.exam_ids?.length || 0} đề thi
                      </span>
                    </div>

                    {/* Nút MỞ: Có icon quyển sách mở cạnh chữ "Mở" */}
                    <button
                      type="button"
                      onClick={() => setActiveCollection(col)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-[10px] flex items-center gap-1 active:scale-95 transition shrink-0"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Mở</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Xem chi tiết Tuyển tập đề */}
          {activeCollection && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-500/30 space-y-2.5 shadow-md animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-indigo-600">Tuyển tập đề</span>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {activeCollection.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCollection(null)}
                  className="p-1 rounded text-slate-400 hover:text-black dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {exams
                  .filter((ex) => activeCollection.exam_ids?.includes(ex.id))
                  .map((ex) => (
                    <div
                      key={ex.id}
                      className="p-2 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-between text-xs"
                    >
                      <span className="truncate pr-2 font-bold text-slate-800 dark:text-slate-200">
                        {ex.title}
                      </span>
                      <Link
                        href={`/m/exams/${ex.id}`}
                        className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shrink-0"
                      >
                        ⚡ Vào thi
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Dải phân loại môn thi trượt ngang */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUBJECTS.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSelectedSubject(sub.key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition active:scale-95 ${
                  selectedSubject === sub.key
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/10'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Danh sách đề thi */}
          <div className="space-y-2.5">
            {filteredExams.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-black/5 dark:bg-white/5 rounded-2xl">
                Không tìm thấy đề thi phù hợp.
              </div>
            ) : (
              filteredExams.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        {ex.exam_type || 'Đề Khảo Thí'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ex.duration || 50} phút • {ex.total_questions || 40} câu
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {ex.title}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                    <span className="text-[10px] text-slate-400">
                      Môn: <strong className="text-slate-700 dark:text-slate-200">{ex.subject || 'Tổng hợp'}</strong>
                    </span>
                    <Link
                      href={`/m/exams/${ex.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs shadow-xs active:scale-95 transition"
                    >
                      <Zap className="h-3 w-3" /> Vào thi ngay
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: THƯ VIỆN SEN ONLINE (FEPN x SENEXAM)               */}
      {/* ========================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Header Môn Học: Nút 3 gạch ngang mở Floating Tree to */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* NÚT 3 GẠCH NGANG: Mở Floating Sơ Đồ Cây To */}
                <button
                  type="button"
                  onClick={() => setShowFloatingTree(true)}
                  className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-200 active:scale-95 transition"
                  title="Mở sơ đồ cây môn học"
                >
                  <Menu className="h-4 w-4" />
                </button>

                {currentFolder && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFolderId(null)
                      setActivePreviewDoc(null)
                    }}
                    className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-bold active:scale-95"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Tất cả môn
                  </button>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateLibModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-violet-600 text-white font-bold text-[10px] flex items-center gap-1 active:scale-95 transition"
                >
                  <Plus className="h-3 w-3" /> Tạo thư mục
                </button>
              )}
            </div>

            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-violet-600" />
              <span>{currentFolder ? currentFolder.name : 'Danh mục các môn học & chuyên đề'}</span>
            </h3>
          </div>

          {/* Ô tìm kiếm tài liệu */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tài liệu học tập, bài giảng..."
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
            />
          </div>

          {/* Sơ đồ cây nhỏ khi đang trong môn */}
          {currentFolder ? (
            <div className="space-y-3">
              {/* Category Filter: Tất cả | Slide | Bài tập | Video | Đề thi kèm */}
              <div className="grid grid-cols-5 gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-center">
                {(['all', 'slides', 'exercises', 'videos', 'exams'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setLibCategory(cat)
                      setActivePreviewDoc(null)
                    }}
                    className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition ${
                      libCategory === cat
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat === 'all'
                      ? 'Tất cả'
                      : cat === 'slides'
                      ? 'Slide'
                      : cat === 'exercises'
                      ? 'Bài tập'
                      : cat === 'videos'
                      ? 'Video'
                      : 'Đề thi'}
                  </button>
                ))}
              </div>

              {/* Đề thi kèm môn */}
              {(libCategory === 'all' || libCategory === 'exams') && attachedExamsForFolder.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Đề thi kèm theo môn này
                  </span>
                  {attachedExamsForFolder.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="truncate">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {ex.title}
                        </h5>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ex.duration || 50} phút • {ex.total_questions || 40} câu
                        </span>
                      </div>
                      <Link
                        href={`/m/exams/${ex.id}`}
                        className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[11px] shrink-0 active:scale-95 transition"
                      >
                        ⚡ Vào thi
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Danh sách tài liệu */}
              <div className="space-y-2">
                {filteredCategoryDocs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-black/5 dark:bg-white/5 rounded-2xl">
                    Chưa có tài liệu trong mục này.
                  </div>
                ) : (
                  filteredCategoryDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setActivePreviewDoc(doc)}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                        activePreviewDoc?.id === doc.id
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {doc.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>

              {/* Xem trực tiếp tài liệu Google Drive / PDF inline */}
              {activePreviewDoc && (
                <div className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-violet-500/30 space-y-3 shadow-md animate-in fade-in ${
                  isPreviewFullscreen ? 'fixed inset-0 z-50 rounded-none p-4' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                      {activePreviewDoc.title}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-black dark:hover:text-white"
                        title="Phóng to"
                      >
                        {isPreviewFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </button>
                      <a
                        href={`https://drive.google.com/file/d/${activePreviewDoc.drive_file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-black dark:hover:text-white"
                        title="Mở tab mới"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://drive.google.com/uc?export=download&id=${activePreviewDoc.drive_file_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-black dark:hover:text-white"
                        title="Tải về"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePreviewDoc(null)
                          setIsPreviewFullscreen(false)
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        title="Đóng"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className={`w-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-slate-950 ${
                    isPreviewFullscreen ? 'h-[calc(100vh-5rem)]' : 'h-80'
                  }`}>
                    <iframe
                      src={`https://drive.google.com/file/d/${activePreviewDoc.drive_file_id}/preview#toolbar=0&navpanes=0`}
                      className="w-full h-full border-none"
                      allow="autoplay"
                      title={activePreviewDoc.title}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Danh mục môn học gốc */
            <div className="grid grid-cols-1 gap-2">
              {visibleFolders.map((f) => {
                const subDocs = docs.filter((d) => d.folder_id === f.id).length
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFolderId(f.id)
                      setLibCategory('all')
                      setActivePreviewDoc(null)
                    }}
                    className="w-full p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-between text-left active:scale-98 transition shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                        <Folder className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {f.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {subDocs} tài liệu
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                )
              })}
            </div>
          )}

          {/* FLOATING SƠ ĐỒ CÂY TO (DRAWER KHI BẤM NÚT 3 GẠCH) */}
          {showFloatingTree && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-start animate-in fade-in">
              <div className="w-4/5 max-w-xs h-full bg-white dark:bg-slate-900 p-4 space-y-4 shadow-2xl flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-violet-600 flex items-center gap-1">
                      <FolderOpen className="h-4 w-4" /> Sơ Đồ Cây Môn Học
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFloatingTree(false)}
                      className="p-1 rounded text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setActiveFolderId(f.id)
                          setShowFloatingTree(false)
                          setActivePreviewDoc(null)
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition ${
                          activeFolderId === f.id
                            ? 'bg-violet-600 text-white'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center font-mono">
                  SenExam Thư Viện Online v{MOBILE_VERSION}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LỊCH SỬ THI CHI TIẾT (HISTORY)                     */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[9px] text-slate-400 font-bold block">Tổng bài</span>
              <p className="text-sm font-black text-slate-900 dark:text-white">{historyStats.total}</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[9px] text-slate-400 font-bold block">Cao nhất</span>
              <p className="text-sm font-black text-amber-500">{historyStats.highest}</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[9px] text-slate-400 font-bold block">Điểm TB</span>
              <p className="text-sm font-black text-violet-600">{historyStats.avg}</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[9px] text-slate-400 font-bold block">Tỉ lệ đạt</span>
              <p className="text-sm font-black text-emerald-500">{historyStats.passRate}%</p>
            </div>
          </div>

          {/* Ô tìm kiếm bài nộp */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên bài thi, môn học..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
            />
          </div>

          {/* Danh Sách Bài Nộp Chi Tiết */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-500">
              Danh Sách Bài Thi Đã Làm ({filteredSubmissions.length})
            </h4>

            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-black/5 dark:bg-white/5 rounded-2xl">
                Bạn chưa có lịch sử làm bài thi nào.
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const isGood = (sub.score || 0) >= 8.0
                const isPass = (sub.score || 0) >= 5.0

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sub.exams?.title || 'Đề thi đã hoàn thành'}
                        </h5>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sub.created_at).toLocaleString('vi-VN')} • Đúng {sub.correct_count}/{sub.total_questions} câu
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-black ${
                            isGood ? 'text-emerald-500' : isPass ? 'text-amber-500' : 'text-rose-500'
                          }`}
                        >
                          {sub.score}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">/ 10</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-black/5 dark:border-white/5">
                      <span className="text-[10px] text-slate-400">
                        Môn: <strong className="text-slate-600 dark:text-slate-300">{sub.exams?.subject || 'Tổng hợp'}</strong>
                      </span>
                      <Link
                        href={`/m/exams/${sub.exam_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        <RotateCcw className="h-3 w-3" /> Làm lại đề
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* FOOTER MÃ PHIÊN BẢN */}
      <div className="pt-2 text-center text-[10px] text-slate-400 font-mono">
        SenExam Mobile v{MOBILE_VERSION}
      </div>
    </div>
  )
}

export default function MobileSenGroundPage() {
  return (
    <Suspense fallback={<ModernLoading title="SenExam 2.0 Mobile" subtitle="Đang tải dữ liệu Sen Ground..." />}>
      <MobileSenGroundContent />
    </Suspense>
  )
}
