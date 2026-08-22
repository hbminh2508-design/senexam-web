'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardPaste,
  Cloud,
  Copy,
  Crown,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  PlusCircle,
  Scissors,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

import { supabase } from '@/lib/supabaseClient'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'
import { highlightSearchText } from '@/app/components/searchUtils'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'

type FolderRow = {
  id: string
  name: string
  parent_id: string | null
  created_by: string | null
  created_at: string
}

type DocRow = {
  id: string
  title: string
  drive_file_id: string
  folder_id: string | null
  created_by: string | null
  created_at: string
  is_vip_only?: boolean
  description?: string | null
}

type Crumb = { id: string | null; name: string; segment: string | null }
type SelectedItem = { id: string; type: 'folder' | 'document'; data: FolderRow | DocRow }
type Role = 'student' | 'admin' | 'collab'
type AiMessage = { role: 'user' | 'model'; text: string; isError?: boolean }

const DOCUMENT_SECURITY_PREFIX = '__SENEXAM_SECURITY__:'

const slugify = (value: string) => {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'folder'
}

const folderSegment = (name: string, id: string) => `${slugify(name)}--${id}`

const extractUuid = (segment: string) => {
  const match = segment.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
  return match ? match[1] : null
}

const isHiddenDocument = (doc: DocRow) => {
  if (!doc.description || !doc.description.startsWith(DOCUMENT_SECURITY_PREFIX)) return false
  try {
    const parsed = JSON.parse(doc.description.slice(DOCUMENT_SECURITY_PREFIX.length))
    return !!parsed?.hidden
  } catch {
    return false
  }
}

const getFileKind = (t: string) => t.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? 'image' : t.match(/\.pdf$/i) ? 'pdf' : 'other'

export default function LibraryNewClient({ slugSegments }: { slugSegments: string[] }) {
  const router = useRouter()
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isBetaTester, setIsBetaTester] = useState(false)

  const [role, setRole] = useState<Role>('student')
  const [userId, setUserId] = useState<string | null>(null)
  const [isVip, setIsVip] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: null, name: 'Thư viện số', segment: null }])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [pathError, setPathError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [sortByName, setSortByName] = useState(true)

  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'uploading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })

  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SelectedItem | null>(null)
  const [renameInput, setRenameInput] = useState('')

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy'; items: SelectedItem[] } | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'folder' | 'document' } | null>(null)

  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null)

  const [isAiMode, setIsAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [isAiSearching, setIsAiSearching] = useState(false)
  const aiChatScrollRef = useRef<HTMLDivElement>(null)

  const canManage = role === 'admin' || role === 'collab'

  const canSeeFolder = (folder: FolderRow, nextRole: Role) => nextRole === 'admin' || nextRole === 'collab' || folder.created_by == null

  const canSeeDoc = (doc: DocRow, nextRole: Role, nextVip: boolean) => {
    if (isHiddenDocument(doc)) return false
    if (doc.is_vip_only && !nextVip && nextRole !== 'admin' && nextRole !== 'collab') return false
    if (nextRole === 'admin' || nextRole === 'collab') return true
    return doc.created_by == null
  }

  const fetchContents = async (folderId: string | null, nextRole: Role, nextVip: boolean) => {
    const folderQuery = supabase.from('library_folders').select('id,name,parent_id,created_by,created_at').order('created_at', { ascending: false })
    const docQuery = supabase.from('library_documents').select('id,title,drive_file_id,folder_id,created_by,created_at,is_vip_only,description').order('created_at', { ascending: false })

    if (folderId) {
      folderQuery.eq('parent_id', folderId)
      docQuery.eq('folder_id', folderId)
    } else {
      folderQuery.is('parent_id', null)
      docQuery.is('folder_id', null)
    }

    const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])

    const visibleFolders = ((folderRes.data || []) as FolderRow[]).filter((f) => canSeeFolder(f, nextRole))
    const visibleDocs = ((docRes.data || []) as DocRow[]).filter((d) => canSeeDoc(d, nextRole, nextVip))

    setFolders(visibleFolders)
    setDocuments(visibleDocs)
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
      if (dark) document.documentElement.classList.add('dark')
      if (!cancelled) setIsDark(dark)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, vip_expires_at, is_beta_tester')
        .eq('id', user.id)
        .single()

      if (!profile?.is_beta_tester) {
        if (!cancelled) {
          setIsBetaTester(false)
          setLoading(false)
        }
        return
      }

      const nextRole = (profile.role || 'student') as Role
      const nextVip = !!profile.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token || null

      const baseCrumbs: Crumb[] = [{ id: null, name: 'Thư viện số', segment: null }]
      let parentId: string | null = null

      try {
        for (const seg of slugSegments) {
          const id = extractUuid(seg)
          if (!id) throw new Error('invalid-segment')

          const { data: folder, error } = await supabase
            .from('library_folders')
            .select('id,name,parent_id,created_by')
            .eq('id', id)
            .single()

          if (error || !folder) throw new Error('folder-not-found')
          if (folder.parent_id !== parentId) throw new Error('wrong-parent')
          if (!canSeeFolder(folder as FolderRow, nextRole)) throw new Error('access-denied')

          parentId = folder.id
          baseCrumbs.push({ id: folder.id, name: folder.name, segment: folderSegment(folder.name, folder.id) })
        }

        if (cancelled) return
        setRole(nextRole)
        setUserId(user.id)
        setIsVip(nextVip)
        setAccessToken(token)
        setIsBetaTester(true)
        setCurrentFolderId(parentId)
        setBreadcrumbs(baseCrumbs)
        setPathError(null)
        await fetchContents(parentId, nextRole, nextVip)
      } catch {
        if (!cancelled) {
          setPathError('Không tìm thấy thư mục theo đường dẫn hiện tại hoặc bạn không có quyền truy cập.')
          setFolders([])
          setDocuments([])
          setCurrentFolderId(null)
          setBreadcrumbs([{ id: null, name: 'Thư viện số', segment: null }])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [router, slugSegments.join('/')])

  useEffect(() => {
    if (aiChatScrollRef.current) aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight
  }, [aiMessages, isAiSearching])

  const openFolder = (folder: FolderRow) => {
    const nextSegment = folderSegment(folder.name, folder.id)
    const nextPath = slugSegments.length ? `/lib-new/${[...slugSegments, nextSegment].join('/')}` : `/lib-new/${nextSegment}`
    router.push(nextPath)
  }

  const goBreadcrumb = (index: number) => {
    if (index <= 0) {
      router.push('/lib-new')
      return
    }
    const next = breadcrumbs.slice(1, index + 1).map((c) => c.segment!).join('/')
    router.push(`/lib-new/${next}`)
  }

  const refreshCurrent = async () => {
    await fetchContents(currentFolderId, role, isVip)
  }

  const handleCreateFolder = async () => {
    if (!canManage || !newFolderName.trim() || !userId) return
    const payload = {
      name: newFolderName.trim(),
      parent_id: currentFolderId,
      created_by: null,
    }
    const { error } = await supabase.from('library_folders').insert(payload)
    if (error) {
      alert('Không thể tạo thư mục: ' + error.message)
      return
    }
    setNewFolderName('')
    setShowFolderModal(false)
    refreshCurrent()
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage || docFiles.length === 0) return

    try {
      setUploadStatus({ type: 'uploading', message: `Đang xử lý ${docFiles.length} tệp...` })
      for (let i = 0; i < docFiles.length; i++) {
        const file = docFiles[i]
        const title = docFiles.length === 1 && docTitle.trim() ? docTitle.trim() : file.name
        setUploadStatus({ type: 'uploading', message: `[${i + 1}/${docFiles.length}] Đang tải lên...` })

        const uploadUrl = await initGoogleDriveUpload(title, file.type || 'application/octet-stream')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, file, title)

        const { error } = await supabase.from('library_documents').insert({
          folder_id: currentFolderId,
          title,
          drive_file_id: uploaded.id,
          created_by: null,
          is_vip_only: false,
        })

        if (error) throw error
      }

      setUploadStatus({ type: 'success', message: 'Tải lên thành công.' })
      setDocFiles([])
      setDocTitle('')
      setTimeout(() => {
        setShowDocModal(false)
        setUploadStatus({ type: 'idle', message: '' })
      }, 900)
      refreshCurrent()
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err?.message || 'Lỗi tải tệp.' })
    }
  }

  const openRename = () => {
    if (!canManage || selectedItems.length !== 1) return
    const target = selectedItems[0]
    setRenameTarget(target)
    setRenameInput(target.type === 'folder' ? (target.data as FolderRow).name : (target.data as DocRow).title)
    setShowRenameModal(true)
  }

  const handleRename = async () => {
    if (!canManage || !renameTarget || !renameInput.trim()) return
    const table = renameTarget.type === 'folder' ? 'library_folders' : 'library_documents'
    const payload = renameTarget.type === 'folder' ? { name: renameInput.trim() } : { title: renameInput.trim() }
    const { error } = await supabase.from(table).update(payload).eq('id', renameTarget.id)
    if (error) {
      alert('Không thể đổi tên: ' + error.message)
      return
    }
    setShowRenameModal(false)
    setRenameTarget(null)
    setSelectedItems([])
    setIsSelectMode(false)
    refreshCurrent()
  }

  const toggleSelection = (id: string, type: 'folder' | 'document', data: FolderRow | DocRow) => {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.id === id)) return prev.filter((i) => i.id !== id)
      return [...prev, { id, type, data }]
    })
  }

  const handleBulkDelete = async () => {
    if (!canManage || selectedItems.length === 0) return
    if (!confirm(`Xóa ${selectedItems.length} mục đã chọn?`)) return

    for (const item of selectedItems) {
      const table = item.type === 'folder' ? 'library_folders' : 'library_documents'
      const { error } = await supabase.from(table).delete().eq('id', item.id)
      if (error) {
        alert('Có lỗi khi xóa: ' + error.message)
        break
      }
    }

    setSelectedItems([])
    setIsSelectMode(false)
    refreshCurrent()
  }

  const handleSetClipboard = (action: 'cut' | 'copy') => {
    if (!canManage || selectedItems.length === 0) return
    setClipboard({ action, items: selectedItems })
    setSelectedItems([])
    setIsSelectMode(false)
  }

  const handlePaste = async () => {
    if (!canManage || !clipboard) return

    try {
      for (const item of clipboard.items) {
        if (clipboard.action === 'cut') {
          const table = item.type === 'folder' ? 'library_folders' : 'library_documents'
          const payload = item.type === 'folder' ? { parent_id: currentFolderId } : { folder_id: currentFolderId }
          const { error } = await supabase.from(table).update(payload).eq('id', item.id)
          if (error) throw error
        } else {
          if (item.type === 'folder') {
            const source = item.data as FolderRow
            const { error } = await supabase.from('library_folders').insert({
              name: `${source.name} (Sao chép)`,
              parent_id: currentFolderId,
              created_by: null,
            })
            if (error) throw error
          } else {
            const source = item.data as DocRow
            const { error } = await supabase.from('library_documents').insert({
              title: `${source.title} (Sao chép)`,
              drive_file_id: source.drive_file_id,
              folder_id: currentFolderId,
              created_by: null,
              is_vip_only: !!source.is_vip_only,
            })
            if (error) throw error
          }
        }
      }

      setClipboard(null)
      refreshCurrent()
    } catch (err: any) {
      alert('Không thể dán dữ liệu: ' + (err?.message || 'Lỗi không xác định'))
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string, type: 'folder' | 'document') => {
    if (!canManage || isSelectMode) return
    setDraggedItem({ id, type })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropToFolder = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    if (!canManage || !draggedItem) return
    if (draggedItem.type === 'folder' && draggedItem.id === folderId) return

    const table = draggedItem.type === 'folder' ? 'library_folders' : 'library_documents'
    const payload = draggedItem.type === 'folder' ? { parent_id: folderId } : { folder_id: folderId }
    const { error } = await supabase.from(table).update(payload).eq('id', draggedItem.id)
    setDraggedItem(null)
    if (error) {
      alert('Không thể di chuyển: ' + error.message)
      return
    }
    refreshCurrent()
  }

  const handleAskSenAI = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = aiQuery.trim()
    if (!q || isAiSearching) return

    setAiQuery('')
    setAiMessages((prev) => [...prev, { role: 'user', text: q }])
    setIsAiSearching(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Người dùng cần tìm tài liệu trong thư viện. Câu hỏi: "${q}". Hãy trả về đúng 1 từ khóa ngắn gọn nhất để tìm kiếm trong tiêu đề thư mục/tệp. Không giải thích thêm.`,
          history: [],
        }),
      })

      const data = await res.json()
      const text = (data?.text || '').toString().trim()
      if (!text) {
        setAiMessages((prev) => [...prev, { role: 'model', text: 'Mình chưa rút được từ khóa. Bạn thử mô tả ngắn hơn nhé.', isError: true }])
      } else {
        const keyword = text.replace(/["']/g, '').slice(0, 60)
        setSearchQuery(keyword)
        setAiMessages((prev) => [...prev, { role: 'model', text: `Mình đang lọc theo từ khóa: **${keyword}**` }])
      }
    } catch {
      setAiMessages((prev) => [...prev, { role: 'model', text: 'Lỗi gọi SenAI, thử lại sau nhé.', isError: true }])
    }

    setIsAiSearching(false)
  }

  const displayFolders = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase()
    const arr = !q ? folders : folders.filter((f) => f.name.toLowerCase().includes(q))
    if (sortByName) arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr
  }, [folders, deferredSearchQuery, sortByName])

  const displayDocs = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase()
    const arr = !q ? documents : documents.filter((d) => d.title.toLowerCase().includes(q))
    if (sortByName) arr.sort((a, b) => a.title.localeCompare(b.title))
    return arr
  }, [documents, deferredSearchQuery, sortByName])

  const previewUrls = useMemo(() => {
    if (!previewDoc) return { preview: '', download: '', open: '' }
    const vipParams = previewDoc.is_vip_only ? `&documentId=${previewDoc.id}&token=${encodeURIComponent(accessToken || '')}` : ''
    return {
      preview: `/api/drive/stream?fileId=${previewDoc.drive_file_id}${vipParams}`,
      download: `/api/drive/stream?fileId=${previewDoc.drive_file_id}&download=1${vipParams}`,
      open: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/view`,
    }
  }, [previewDoc, accessToken])

  if (loading) {
    return newUiEnabled
      ? <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải Thư viện số Beta..." />
      : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  if (!isBetaTester) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#141414] p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-black mb-2">Thư viện số Beta</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Trang này chỉ mở cho tài khoản đã tham gia chương trình Beta.</p>
          <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold">Quay về Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen font-sans pb-24"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={newUiEnabled ? ({ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties) : undefined}
    >
      {previewDoc && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="h-14 px-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm truncate">{previewDoc.title}</h3>
              <div className="flex items-center gap-2">
                <a href={previewUrls.download} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-[#202020] inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />Tải</a>
                <a href={previewUrls.open} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#202020] inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Mở Drive</a>
                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 bg-black/5 dark:bg-black/40">
              {getFileKind(previewDoc.title) === 'image'
                ? <img src={previewUrls.download} className="w-full h-full object-contain" />
                : <iframe src={previewUrls.preview} className="w-full h-full border-none" />}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push('/dashboard')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] p-6 mb-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight inline-flex items-center gap-2">
                <Cloud className="w-6 h-6 text-sky-500" /> Thư viện số
                <span className="text-[10px] px-2 py-1 rounded-md uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Beta</span>
              </h1>
              <div className="mt-3 flex items-center flex-wrap gap-2 text-xs font-semibold text-slate-500">
                {breadcrumbs.map((crumb, idx) => (
                  <div key={`${crumb.id || 'root'}-${idx}`} className="inline-flex items-center gap-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropToFolder(e, crumb.id)}>
                    <button onClick={() => goBreadcrumb(idx)} className={`px-2 py-1 rounded-md ${idx === breadcrumbs.length - 1 ? 'text-indigo-600 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-[#202020]'}`}>
                      {crumb.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm thư mục, tệp..." className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#101010] pl-9 pr-3 py-2.5 text-sm outline-none" />
              </div>

              <button onClick={() => setIsAiMode((v) => !v)} className={`px-3 py-2 rounded-lg text-xs font-semibold border ${isAiMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-slate-200 dark:border-white/10'}`}>
                SenAI
              </button>

              <button onClick={() => setSortByName((v) => !v)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 inline-flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5" /> {sortByName ? 'A-Z' : 'Mới nhất'}
              </button>

              {canManage && (
                <>
                  <button onClick={() => { setIsSelectMode((v) => !v); setSelectedItems([]) }} className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10">Chọn</button>
                  <button onClick={() => setShowFolderModal(true)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 inline-flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" />Thư mục</button>
                  <button onClick={() => setShowDocModal(true)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white inline-flex items-center gap-1.5"><UploadCloud className="w-3.5 h-3.5" />Tải lên</button>
                </>
              )}
            </div>
          </div>
        </div>

        {isAiMode && (
          <div className="mb-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151515] overflow-hidden h-[320px] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 font-semibold text-sm">
              <Bot className="w-4 h-4 text-indigo-500" /> SenAI tìm kiếm thông minh
            </div>
            <div ref={aiChatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2 rounded-xl text-[13px] ${m.role === 'user' ? 'bg-indigo-600 text-white' : m.isError ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 dark:bg-[#202020]'}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({ node, ...props }: any) => <p className="m-0" {...props} /> }}>{m.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiSearching && <p className="text-xs text-slate-500 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang xử lý...</p>}
            </div>
            <form onSubmit={handleAskSenAI} className="p-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
              <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none" placeholder="Mô tả tài liệu bạn cần tìm..." />
              <button type="submit" disabled={!aiQuery.trim() || isAiSearching} className="p-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        )}

        {pathError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-4 text-sm text-rose-700 dark:text-rose-300">{pathError}</div>
        ) : (
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] p-5" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropToFolder(e, currentFolderId)}>
            {displayFolders.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Thư mục</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {displayFolders.map((folder) => {
                    const selected = selectedItems.some((i) => i.id === folder.id)
                    return (
                      <div key={folder.id} draggable={canManage && !isSelectMode} onDragStart={(e) => handleDragStart(e, folder.id, 'folder')} className="relative">
                        <button onClick={() => isSelectMode ? toggleSelection(folder.id, 'folder', folder) : openFolder(folder)} className={`w-full rounded-2xl border p-4 text-center transition-colors ${selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1B1B1B] hover:bg-slate-100 dark:hover:bg-[#212121]'}`}>
                          {isSelectMode && <span className="absolute top-2 right-2">{selected ? <CheckCircle2 className="w-4 h-4 text-indigo-600" /> : <span className="w-4 h-4 inline-block rounded-full border border-slate-300" />}</span>}
                          <Folder className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
                          <p className="text-xs font-bold line-clamp-2">{highlightSearchText(folder.name, deferredSearchQuery)}</p>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {displayDocs.map((doc) => {
                const selected = selectedItems.some((i) => i.id === doc.id)
                return (
                  <div key={doc.id} draggable={canManage && !isSelectMode} onDragStart={(e) => handleDragStart(e, doc.id, 'document')}>
                    <button onClick={() => isSelectMode ? toggleSelection(doc.id, 'document', doc) : setPreviewDoc(doc)} className={`w-full text-left rounded-xl border px-4 py-3 transition-colors flex items-center justify-between gap-3 ${selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1B1B1B] hover:bg-slate-100 dark:hover:bg-[#212121]'}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate inline-flex items-center gap-1.5">
                          {isSelectMode && (selected ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> : <span className="w-3.5 h-3.5 inline-block rounded-full border border-slate-300" />)}
                          {doc.is_vip_only && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                          {highlightSearchText(doc.title, deferredSearchQuery)}
                        </p>
                        <p className="text-[11px] text-slate-500">{new Date(doc.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  </div>
                )
              })}
            </div>

            {displayFolders.length === 0 && displayDocs.length === 0 && (
              <div className="py-14 text-center text-slate-500">
                <Folder className="w-9 h-9 mx-auto mb-2" />
                <p className="text-sm font-semibold">Không có dữ liệu trong thư mục này.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {canManage && isSelectMode && selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151515] shadow-lg px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">{selectedItems.length} mục</span>
          {selectedItems.length === 1 && <button onClick={openRename} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#202020] inline-flex items-center gap-1"><Edit className="w-3.5 h-3.5" />Đổi tên</button>}
          <button onClick={() => handleSetClipboard('cut')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#202020] inline-flex items-center gap-1"><Scissors className="w-3.5 h-3.5" />Cắt</button>
          <button onClick={() => handleSetClipboard('copy')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#202020] inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" />Sao chép</button>
          <button onClick={handleBulkDelete} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Xóa</button>
        </div>
      )}

      {canManage && clipboard && !isSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-[#151515] shadow-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs font-semibold text-indigo-600">Đang giữ {clipboard.items.length} mục</span>
          <button onClick={handlePaste} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white inline-flex items-center gap-1"><ClipboardPaste className="w-3.5 h-3.5" />Dán</button>
          <button onClick={() => setClipboard(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151515] p-6 relative">
            <button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-semibold mb-4">Tạo thư mục</h3>
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none mb-4" placeholder="Tên thư mục..." />
            <button onClick={handleCreateFolder} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Tạo mới</button>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151515] p-6 relative">
            <button onClick={() => { setShowDocModal(false); setDocFiles([]); setUploadStatus({ type: 'idle', message: '' }) }} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-semibold mb-4">Tải tài liệu lên</h3>
            <form onSubmit={handleUploadDocument} className="space-y-3">
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none" placeholder="Tên hiển thị (nếu tải 1 tệp)..." />
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-5 text-center relative">
                <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setDocFiles(Array.from(e.target.files || []))} />
                <p className="text-sm text-slate-500">{docFiles.length ? `Đã chọn ${docFiles.length} tệp` : 'Nhấn để chọn tệp'}</p>
              </div>
              {uploadStatus.type !== 'idle' && <p className={`text-xs ${uploadStatus.type === 'error' ? 'text-rose-600' : 'text-indigo-600'}`}>{uploadStatus.message}</p>}
              <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">
                {uploadStatus.type === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Bắt đầu tải'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151515] p-6 relative">
            <button onClick={() => setShowRenameModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-semibold mb-4">Đổi tên</h3>
            <input value={renameInput} onChange={(e) => setRenameInput(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none mb-4" />
            <button onClick={handleRename} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Lưu thay đổi</button>
          </div>
        </div>
      )}
    </div>
  )
}
