'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
} from 'lucide-react'

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

export default function MobileSenGroundPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get('tab') as 'exams' | 'library' | 'history') || 'exams'

  const [activeTab, setActiveTab] = useState<'exams' | 'library' | 'history'>(initialTab)
  const [loading, setLoading] = useState(true)

  // Data
  const [exams, setExams] = useState<ExamItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [docs, setDocs] = useState<DocItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])

  // Filters & State
  const [examSearch, setExamSearch] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')

  // Library Sub-state & Hierarchical Folder Navigation
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [folderHistory, setFolderHistory] = useState<string[]>([])
  const [libCategory, setLibCategory] = useState<'all' | 'slides' | 'exercises' | 'videos' | 'exams'>('all')
  const [libSearch, setLibSearch] = useState('')
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocItem | null>(null)

  // History Filter
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
    const tabParam = searchParams?.get('tab')
    if (tabParam === 'library' || tabParam === 'exams' || tabParam === 'history') {
      setActiveTab(tabParam)
    }
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
          const { data: subData } = await supabase
            .from('submissions')
            .select('id, exam_id, score, correct_count, total_questions, created_at, exams(title, subject, duration)')
            .eq('user_id', userRes.data.user.id)
            .order('created_at', { ascending: false })
          if (subData) setSubmissions(subData as any)
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

  // 1. Lọc đề thi
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

  // 2. Thư viện phân cấp môn học & thư mục con (Hierarchical Folder Tree)
  const currentFolder = folders.find((f) => f.id === activeFolderId)

  // Danh sách thư mục con của thư mục hiện tại (hoặc thư mục gốc nếu activeFolderId === null)
  const visibleFolders = useMemo(() => {
    if (!activeFolderId) {
      // Thư mục gốc: parent_id null hoặc không trỏ tới folder nào còn tồn tại
      return folders.filter((f) => !f.parent_id || !folders.some((p) => p.id === f.parent_id))
    }
    return folders.filter((f) => f.parent_id === activeFolderId)
  }, [folders, activeFolderId])

  // Danh sách tài liệu trong thư mục hiện tại
  const currentFolderDocs = useMemo(() => {
    if (!activeFolderId) return []
    return docs.filter((d) => d.folder_id === activeFolderId)
  }, [docs, activeFolderId])

  // Lọc tài liệu theo phân loại (Slide, Bài tập, Video, Đề thi)
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

  // Đề thi gắn kèm hoặc phù hợp với môn học hiện tại
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

  // Chuyển sâu vào một thư mục
  const handleOpenFolder = (folderId: string) => {
    setFolderHistory((prev) => [...prev, activeFolderId || 'root'])
    setActiveFolderId(folderId)
    setActivePreviewDoc(null)
  }

  // Quay lại thư mục cấp cha
  const handleFolderBack = () => {
    setActivePreviewDoc(null)
    if (folderHistory.length > 0) {
      const prev = folderHistory[folderHistory.length - 1]
      setFolderHistory((old) => old.slice(0, -1))
      setActiveFolderId(prev === 'root' ? null : prev)
    } else {
      setActiveFolderId(null)
    }
  }

  // 3. Thống kê lịch sử thi
  const historyStats = useMemo(() => {
    if (submissions.length === 0) return { total: 0, highest: 0, avg: 0, passRate: 0, excellent: 0 }
    const scores = submissions.map((s) => s.score || 0)
    const highest = Math.max(...scores)
    const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    const passCount = scores.filter((s) => s >= 5.0).length
    const passRate = Math.round((passCount / scores.length) * 100)
    const excellent = scores.filter((s) => s >= 8.0).length
    return { total: submissions.length, highest, avg, passRate, excellent }
  }, [submissions])

  const filteredSubmissions = useMemo(() => {
    if (!historySearch.trim()) return submissions
    return submissions.filter((sub) =>
      sub.exams?.title?.toLowerCase().includes(historySearch.toLowerCase()) ||
      sub.exams?.subject?.toLowerCase().includes(historySearch.toLowerCase())
    )
  }, [submissions, historySearch])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Đang nạp dữ liệu Sen Ground...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full p-4 space-y-4">
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
      {/* TAB 1: KHO ĐỀ THI                                         */}
      {/* ========================================================= */}
      {activeTab === 'exams' && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Ô tìm kiếm đề thi */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên đề thi, khối thi..."
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
              className="w-full h-10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

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
      {/* TAB 2: THƯ VIỆN SEN ONLINE (CÂY PHÂN CẤP MÔN HỌC & XEM FILE) */}
      {/* ========================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Header & Breadcrumb phân cấp */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                {currentFolder ? (
                  <button
                    type="button"
                    onClick={handleFolderBack}
                    className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-bold active:scale-95 transition"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
                  </button>
                ) : (
                  <span className="text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    Thư Viện Sen Online
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {currentFolder ? `${currentFolderDocs.length} tài liệu` : `${folders.length} thư mục môn`}
              </span>
            </div>

            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-violet-600" />
              <span>{currentFolder ? currentFolder.name : 'Danh mục các môn học & chuyên đề'}</span>
            </h3>
          </div>

          {/* Ô tìm kiếm tài liệu trong thư viện */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu, bài giảng..."
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
            />
          </div>

          {/* HIỂN THỊ CÁC THƯ MỤC CON / MÔN HỌC */}
          {visibleFolders.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400">
                {currentFolder ? 'Thư mục con' : 'Các môn học'}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {visibleFolders.map((f) => {
                  const subDocs = docs.filter((d) => d.folder_id === f.id).length
                  const childFolders = folders.filter((child) => child.parent_id === f.id).length

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleOpenFolder(f.id)}
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
                          <span className="text-[10px] text-slate-400">
                            {subDocs} tài liệu {childFolders > 0 ? `• ${childFolders} thư mục con` : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* NẾU ĐANG TRONG MỘT MÔN HỌC -> HIỂN THỊ CÁC TÀI LIỆU VÀ ĐỀ THI ĐI KÈM */}
          {currentFolder && (
            <div className="space-y-3 pt-2">
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

              {/* Danh sách đề thi gắn kèm */}
              {(libCategory === 'all' || libCategory === 'exams') && attachedExamsForFolder.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Đề thi ôn luyện môn này
                  </span>
                  <div className="space-y-1.5">
                    {attachedExamsForFolder.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs flex items-center justify-between gap-2"
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
                </div>
              )}

              {/* Danh sách tài liệu */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Tài liệu học tập ({filteredCategoryDocs.length})
                </span>
                {filteredCategoryDocs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-black/5 dark:bg-white/5 rounded-2xl">
                    Chưa có tài liệu nào trong mục này.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCategoryDocs.map((doc) => (
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
                    ))}
                  </div>
                )}
              </div>

              {/* Khung Xem Trước File Trực Tiếp Mobile (Nếu có file chọn) */}
              {activePreviewDoc && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-violet-500/30 space-y-3 shadow-md animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                      {activePreviewDoc.title}
                    </h4>
                    <div className="flex items-center gap-1.5">
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
                        onClick={() => setActivePreviewDoc(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        title="Đóng"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-80 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-slate-950">
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
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LỊCH SỬ THI CHI TIẾT                               */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* KPI Dashboard Thống Kê Nhanh */}
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
    </div>
  )
}
