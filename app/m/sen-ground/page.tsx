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
  exams?: { title: string; subject?: string }
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

  // Library Sub-state
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [libCategory, setLibCategory] = useState<'slides' | 'exercises' | 'videos' | 'exams'>('slides')
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocItem | null>(null)

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
            .select('id, exam_id, score, correct_count, total_questions, created_at, exams(title, subject)')
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

  // Lọc thư viện
  const activeFolder = folders.find((f) => f.id === activeFolderId)
  const activeFolderDocs = useMemo(() => {
    if (!activeFolderId) return []
    return docs.filter((d) => d.folder_id === activeFolderId)
  }, [docs, activeFolderId])

  const categoryDocs = useMemo(() => {
    if (libCategory === 'exercises') {
      return activeFolderDocs.filter((d) => d.description?.includes('[CATEGORY:exercises]'))
    }
    if (libCategory === 'videos') {
      return activeFolderDocs.filter((d) => d.description?.includes('[CATEGORY:videos]'))
    }
    return activeFolderDocs.filter(
      (d) =>
        !d.description?.includes('[CATEGORY:exercises]') &&
        !d.description?.includes('[CATEGORY:videos]') &&
        !d.description?.includes('[ATTACHED_EXAM:')
    )
  }, [activeFolderDocs, libCategory])

  // Đề thi gắn kèm trong môn
  const attachedExamsForFolder = useMemo(() => {
    if (!activeFolder) return []
    const attachedExamDocs = activeFolderDocs.filter((d) => d.description?.includes('[ATTACHED_EXAM:'))
    const attachedIds = attachedExamDocs.map((d) => {
      const m = d.description?.match(/\[ATTACHED_EXAM:([^\]]+)\]/)
      return m ? m[1] : d.drive_file_id
    })
    return exams.filter((ex) => attachedIds.includes(ex.id) || (ex.subject && activeFolder.name.toLowerCase().includes(ex.subject.toLowerCase())))
  }, [activeFolder, activeFolderDocs, exams])

  // Thống kê lịch sử
  const historyStats = useMemo(() => {
    if (submissions.length === 0) return { total: 0, highest: 0, avg: 0 }
    const scores = submissions.map((s) => s.score || 0)
    const highest = Math.max(...scores)
    const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    return { total: submissions.length, highest, avg }
  }, [submissions])

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
          <span>Lịch Sử</span>
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
              className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
            />
          </div>

          {/* Lưới đề thi */}
          <div className="space-y-2.5">
            {filteredExams.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
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
                      Môn: <strong className="text-slate-600 dark:text-slate-300">{ex.subject || 'Tổng hợp'}</strong>
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
      {/* TAB 2: THƯ VIỆN SEN ONLINE (CÂY MÔN HỌC & XEM FILE MOBILE) */}
      {/* ========================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-4 animate-in fade-in">
          {/* TRƯỜNG HỢP 2A: CHƯA CHỌN MÔN -> HIỂN THỊ DANH SÁCH MÔN HỌC */}
          {!activeFolder ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500">Môn Học & Khối Chuyên Đề</span>
                <span className="text-[10px] font-mono text-slate-400">{folders.length} môn</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {folders.map((f) => {
                  const docCount = docs.filter((d) => d.folder_id === f.id).length
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setActiveFolderId(f.id)
                        setLibCategory('slides')
                        setActivePreviewDoc(null)
                      }}
                      className="w-full p-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-between text-left active:scale-98 transition cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {f.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {docCount} tài liệu học tập
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2B: ĐÃ CHỌN MÔN -> CHI TIẾT MÔN HỌC MOBILE */
            <div className="space-y-3.5">
              {/* Header Môn Học */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFolderId(null)
                      setActivePreviewDoc(null)
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Tất cả môn
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activeFolderDocs.length} tài liệu
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {activeFolder.name}
                </h3>
              </div>

              {/* Category Tabs: Slide, Bài Tập, Video, Đề Thi */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-center">
                {(['slides', 'exercises', 'videos', 'exams'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setLibCategory(cat)
                      setActivePreviewDoc(null)
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-black uppercase transition ${
                      libCategory === cat
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat === 'slides' ? 'Slide' : cat === 'exercises' ? 'Bài tập' : cat === 'videos' ? 'Video' : 'Đề thi'}
                  </button>
                ))}
              </div>

              {/* Danh Sách Thành Phần */}
              {libCategory === 'exams' ? (
                /* Tab Đề Thi Trong Môn */
                <div className="space-y-2">
                  {attachedExamsForFolder.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Chưa có đề thi gắn kèm cho môn này.
                    </div>
                  ) : (
                    attachedExamsForFolder.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-3 rounded-2xl border border-amber-500/20 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {ex.title}
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            {ex.duration || 50} phút • {ex.total_questions || 40} câu
                          </span>
                        </div>
                        <Link
                          href={`/m/exams/${ex.id}`}
                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[11px] shrink-0"
                        >
                          ⚡ Vào thi
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Tab Tài Liệu (Slide, Bài Tập, Video) */
                <div className="space-y-2">
                  {categoryDocs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Chưa có tài liệu trong mục này.
                    </div>
                  ) : (
                    categoryDocs.map((doc) => (
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
              )}

              {/* Khung Xem Trước File Trực Tiếp Mobile (Nếu có file chọn) */}
              {activePreviewDoc && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                      {activePreviewDoc.title}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://drive.google.com/file/d/${activePreviewDoc.drive_file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-black"
                        title="Mở tab mới"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://drive.google.com/uc?export=download&id=${activePreviewDoc.drive_file_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-black"
                        title="Tải về"
                      >
                        <Download className="h-4 w-4" />
                      </a>
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
      {/* TAB 3: LỊCH SỬ BÀI NỘP                                     */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* KPI Thống Kê Nhanh */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[10px] text-slate-400 font-bold block">Tổng bài</span>
              <p className="text-base font-black text-slate-900 dark:text-white">{historyStats.total}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[10px] text-slate-400 font-bold block">Cao nhất</span>
              <p className="text-base font-black text-amber-500">{historyStats.highest}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-center">
              <span className="text-[10px] text-slate-400 font-bold block">Điểm TB</span>
              <p className="text-base font-black text-violet-600">{historyStats.avg}</p>
            </div>
          </div>

          {/* Danh Sách Bài Nộp */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-500">Bài Thi Gần Đây</h4>
            {submissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Bạn chưa hoàn thành bài thi nào.
              </div>
            ) : (
              submissions.map((sub) => {
                const isGood = (sub.score || 0) >= 8.0
                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {sub.exams?.title || 'Đề thi đã hoàn thành'}
                      </h5>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sub.created_at).toLocaleDateString('vi-VN')} • Đúng {sub.correct_count}/{sub.total_questions}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-base font-black ${isGood ? 'text-emerald-500' : 'text-violet-600'}`}>
                        {sub.score}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">/ 10</span>
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
