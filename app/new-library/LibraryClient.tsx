'use client'

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Folder,
  FolderPlus,
  FileText,
  Search,
  UploadCloud,
  ChevronRight,
  Download,
  Lock,
  Eye,
  Trash2,
  LogIn,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Server,
  Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ProtectedDocViewer from '@/app/components/ProtectedDocViewer'

interface FolderItem {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

interface DocumentItem {
  id: string
  title: string
  folder_id: string | null
  created_at: string
  drive_file_id?: string
  description?: string
  is_vip_only?: boolean
}

export default function LibraryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Thư viện Sen' },
  ])

  const [folders, setFolders] = useState<FolderItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('guest')
  const [authChecked, setAuthChecked] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  // Protected Viewer Modal
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Admin Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadAllowDownload, setUploadAllowDownload] = useState(true)
  const [uploadIsVip, setUploadIsVip] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const canManage = userRole === 'admin' || userRole === 'teacher' || userRole === 'collab'

  // 1. Kiểm tra phiên đăng nhập (cho phép khách vãng lai)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          setUserRole(profile?.role || 'student')
        } else {
          setUserRole('guest')
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra phiên:', err)
        setUserRole('guest')
      } finally {
        setAuthChecked(true)
      }
    }

    checkAuth()
  }, [])

  // 2. Tải danh sách thư mục & tài liệu theo currentFolderId
  const loadContents = async (folderId: string | null) => {
    setLoading(true)
    try {
      const folderQuery = supabase
        .from('library_folders')
        .select('*')
        .order('name', { ascending: true })

      const docQuery = supabase
        .from('library_documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (folderId) {
        folderQuery.eq('parent_id', folderId)
        docQuery.eq('folder_id', folderId)
      } else {
        folderQuery.is('parent_id', null)
        docQuery.is('folder_id', null)
      }

      const [fRes, dRes] = await Promise.all([folderQuery, docQuery])
      setFolders(fRes.data || [])
      setDocuments(dRes.data || [])
    } catch (err) {
      console.error('Lỗi tải dữ liệu thư viện:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContents(currentFolderId)
  }, [currentFolderId])

  // Điều hướng folder
  const handleOpenFolder = (folder: FolderItem) => {
    setCurrentFolderId(folder.id)
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }])
    setSearchQuery('')
  }

  const handleNavigateCrumb = (targetId: string | null, index: number) => {
    setCurrentFolderId(targetId)
    setFolderPath((prev) => prev.slice(0, index + 1))
    setSearchQuery('')
  }

  // Lọc tài liệu theo từ khóa tìm kiếm
  const filteredFolders = useMemo(() => {
    if (!deferredSearch.trim()) return folders
    const q = deferredSearch.toLowerCase()
    return folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [folders, deferredSearch])

  const filteredDocs = useMemo(() => {
    if (!deferredSearch.trim()) return documents
    const q = deferredSearch.toLowerCase()
    return documents.filter((d) => d.title.toLowerCase().includes(q))
  }, [documents, deferredSearch])

  // Lấy quyền download của 1 tài liệu
  const checkDocDownloadable = (doc: DocumentItem) => {
    if (!doc.description) return true
    try {
      const meta = JSON.parse(doc.description)
      return meta.allowDownload !== false
    } catch {
      return true
    }
  }

  // Xử lý tải về từ thẻ tài liệu
  const handleDownloadClick = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation()
    const canDownload = checkDocDownloadable(doc)
    if (!canDownload) {
      alert('Tài liệu này là đề thi bảo mật, không được phép tải về máy!')
      return
    }

    if (!currentUser) {
      setShowLoginModal(true)
      return
    }

    window.open(`/api/library/stream?id=${encodeURIComponent(doc.id)}&download=1`, '_blank')
  }

  // Tạo thư mục mới
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim() || !canManage) return

    try {
      const { error } = await supabase.from('library_folders').insert({
        name: newFolderName.trim(),
        parent_id: currentFolderId,
        created_by: currentUser?.id || null,
      })
      if (error) throw error

      setNewFolderName('')
      setShowCreateFolder(false)
      loadContents(currentFolderId)
    } catch (err: any) {
      alert('Lỗi tạo thư mục: ' + err.message)
    }
  }

  // Tải file mới lên Azure VPS
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !canManage) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle.trim() || uploadFile.name)
      if (currentFolderId) formData.append('folderId', currentFolderId)
      formData.append('allowDownload', uploadAllowDownload ? 'true' : 'false')
      formData.append('isVipOnly', uploadIsVip ? 'true' : 'false')

      const res = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi tải lên máy chủ')

      setUploadFile(null)
      setUploadTitle('')
      setShowUpload(false)
      loadContents(currentFolderId)
    } catch (err: any) {
      setUploadError(err.message || 'Lỗi tải lên tệp')
    } finally {
      setIsUploading(false)
    }
  }

  // Xóa tài liệu / thư mục
  const handleDeleteItem = async (e: React.MouseEvent, type: 'folder' | 'doc', id: string, name: string) => {
    e.stopPropagation()
    if (!canManage) return
    if (!confirm(`Bạn có chắc chắn muốn xóa "${name}"?`)) return

    try {
      const table = type === 'folder' ? 'library_folders' : 'library_documents'
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      loadContents(currentFolderId)
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 🌟 BANNER ĐÓN TIẾP KHÁCH VÃNG LAI */}
      {!currentUser && authChecked && (
        <aside aria-label="Khách vãng lai" className="bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-slate-900 border-b border-indigo-500/20 px-4 py-3 text-xs sm:text-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
            <div className="flex items-center gap-2 text-indigo-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Thư viện mở SenExam:</strong> Bạn đang xem dưới chế độ khách vãng lai. Có thể xem trước tất cả tài liệu.
              </span>
            </div>
            <Link
              href="/new-idp"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shrink-0 shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              Đăng nhập để tải tài liệu
            </Link>
          </div>
        </aside>
      )}

      {/* HEADER CHÍNH */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Logo & Trở về */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition shrink-0"
              title="Về Bảng điều khiển"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-600/30 text-indigo-400">
                    <Folder className="w-4 h-4" />
                  </span>
                  Thư Viện SenExam
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Server className="w-3 h-3" /> Azure Cloud
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Kho học liệu và đề thi số hóa chính quy</p>
            </div>
          </div>

          {/* Ô tìm kiếm & Tác vụ */}
          <div className="flex items-center gap-2 flex-1 max-w-md md:ml-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm thư mục, đề thi, học liệu..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Nút tác vụ Quản trị nếu có quyền */}
            {canManage && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
                  title="Tạo thư mục mới"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-900/30"
                  title="Tải tài liệu mới lên Azure"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span className="hidden sm:inline">Tải lên Azure</span>
                </button>
              </div>
            )}

            {/* Tài khoản hoặc Nút đăng nhập */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 shrink-0">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline font-semibold max-w-[100px] truncate">
                  {currentUser.email?.split('@')[0]}
                </span>
              </div>
            ) : (
              <Link
                href="/new-idp"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>

        {/* Breadcrumb cây thư mục */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1 text-xs text-slate-400 overflow-x-auto py-1">
          {folderPath.map((crumb, idx) => {
            const isLast = idx === folderPath.length - 1
            return (
              <React.Fragment key={crumb.id || 'root'}>
                <button
                  onClick={() => handleNavigateCrumb(crumb.id, idx)}
                  className={`font-semibold transition hover:text-white shrink-0 ${
                    isLast ? 'text-indigo-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  {crumb.name}
                </button>
                {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              </React.Fragment>
            )
          })}
        </div>
      </header>

      {/* THÂN NỘI DUNG THƯ VIỆN */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">Đang truy xuất tài liệu từ hệ thống...</span>
          </div>
        ) : filteredFolders.length === 0 && filteredDocs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-12 text-center max-w-md mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Folder className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">Thư mục hiện tại chưa có tài liệu</h3>
            <p className="text-xs text-slate-400 mb-5">
              {canManage
                ? 'Bạn có thể bấm "Tải lên Azure" hoặc "Tạo thư mục" để bắt đầu cấp dữ liệu mới.'
                : 'Giáo viên đang cập nhật học liệu mới lên hệ thống. Vui lòng quay lại sau!'}
            </p>
            {canManage && (
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
              >
                <UploadCloud className="w-4 h-4" /> Tải tài liệu đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. DANH SÁCH THƯ MỤC */}
            {filteredFolders.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-400" /> Thư mục ({filteredFolders.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleOpenFolder(folder)}
                      className="group p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-indigo-500/40 transition cursor-pointer flex flex-col justify-between min-h-[90px] relative overflow-hidden shadow-xs hover:shadow-indigo-500/10"
                    >
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition">
                          <Folder className="w-5 h-5 fill-amber-400/20" />
                        </div>
                        {canManage && (
                          <button
                            onClick={(e) => handleDeleteItem(e, 'folder', folder.id, folder.name)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                            title="Xóa thư mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                        {folder.name}
                      </h4>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. DANH SÁCH TÀI LIỆU & ĐỀ THI */}
            {filteredDocs.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" /> Tài liệu & Đề thi ({filteredDocs.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredDocs.map((doc) => {
                    const canDownload = checkDocDownloadable(doc)
                    const isAzure = doc.drive_file_id?.startsWith('azure:') || doc.description?.includes('"storage":"azure"')

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setActiveDoc(doc)}
                        className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-800/90 border border-white/5 hover:border-indigo-500/50 transition cursor-pointer flex flex-col justify-between gap-4 shadow-sm relative overflow-hidden"
                      >
                        {/* Header card */}
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4
                              className="text-xs font-bold text-slate-100 group-hover:text-white line-clamp-2 leading-relaxed"
                              title={doc.title}
                            >
                              {doc.title}
                            </h4>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                              {isAzure && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                                  Azure
                                </span>
                              )}
                              {!canDownload && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                  Chỉ xem
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                          {/* Nút Xem (Mọi người đều xem được) */}
                          <button
                            onClick={() => setActiveDoc(doc)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem đề
                          </button>

                          <div className="flex items-center gap-1.5">
                            {/* Nút Tải về (Tùy theo quyền & đăng nhập) */}
                            {!canDownload ? (
                              <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Cấm tải
                              </span>
                            ) : currentUser ? (
                              <button
                                onClick={(e) => handleDownloadClick(e, doc)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition"
                                title="Tải tài liệu về máy"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleDownloadClick(e, doc)}
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-indigo-300 text-[10px] font-bold transition flex items-center gap-1"
                                title="Đăng nhập để tải về"
                              >
                                <Lock className="w-3 h-3" /> Đăng nhập để tải
                              </button>
                            )}

                            {/* Xóa cho Admin */}
                            {canManage && (
                              <button
                                onClick={(e) => handleDeleteItem(e, 'doc', doc.id, doc.title)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                                title="Xóa tài liệu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* 🌟 1. PROTECTED DOC VIEWER (CANVAS ENGINE, CHỐNG TẢI LẬU GOOGLE DRIVE) */}
      {activeDoc && (
        <ProtectedDocViewer
          documentId={activeDoc.id}
          driveFileId={activeDoc.drive_file_id}
          title={activeDoc.title}
          canDownload={checkDocDownloadable(activeDoc)}
          isLoggedIn={!!currentUser}
          onClose={() => setActiveDoc(null)}
          onRequireLogin={() => setShowLoginModal(true)}
        />
      )}

      {/* 🌟 2. POPUP YÊU CẦU ĐĂNG NHẬP (DÀNH CHO KHÁCH VÃNG LAI BẤM TẢI) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Yêu cầu đăng nhập tài khoản</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Bạn có thể xem trước tất cả tài liệu miễn phí. Để tải file gốc về máy tính hoặc điện thoại, vui lòng đăng nhập vào tài khoản SenExam.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition"
              >
                Để sau
              </button>
              <Link
                href="/new-idp"
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-900/30 inline-flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" /> Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 3. MODAL TẠO THƯ MỤC MỚI (ADMIN) */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFolderSubmit}
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400" /> Tạo thư mục mới
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateFolder(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nhập tên thư mục (vd: Đề thi Toán học kỳ 1)..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 mb-4"
              required
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateFolder(false)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
              >
                Tạo thư mục
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 4. MODAL TẢI FILE LÊN AZURE VPS (ADMIN) */}
      {showUpload && (
        <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUploadSubmit}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/10 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Tải tài liệu mới lên Azure</h3>
                  <p className="text-[11px] text-slate-400">Lưu trữ bảo mật trực tiếp trên SSD máy chủ Azure</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Chọn tệp */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chọn tệp tài liệu / Đề thi (PDF, DOCX, Ảnh...)
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setUploadFile(f)
                    if (f && !uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''))
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  required
                />
              </div>

              {/* Tên hiển thị */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tiêu đề hiển thị
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Nhập tiêu đề tài liệu..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              {/* Tùy chọn quyền tải xuống */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Cho phép học sinh tải về</span>
                    <span className="text-[11px] text-slate-400 block">
                      Tắt nút này nếu đây là đề kiểm tra/đề thi chỉ được xem trực tiếp
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uploadAllowDownload}
                    onChange={(e) => setUploadAllowDownload(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-white/20"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-900/30"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải lên Azure...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" /> Bắt đầu tải lên
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
