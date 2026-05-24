'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  ArrowLeft, ArrowUpDown, BookOpen, CheckCircle2, ChevronRight, ClipboardPaste, Cloud, Copy,
  Edit, ExternalLink, FileText, Folder, FolderOpen, Image, Loader2, Lock, Maximize2, Music,
  Palette, PlusCircle, Scissors, Search, Trash2, UploadCloud, Video, X
} from 'lucide-react'

type SelectedItem = { id: string, type: 'folder' | 'document', data: any }
type CloudFolder = { id: string, name: string, parent_id: string | null, created_by?: string | null, created_at?: string }
type CloudDocument = { id: string, title: string, folder_id: string | null, drive_file_id: string, created_by?: string | null, created_at?: string, description?: string | null }
type CloudSearchParams = Record<string, string | string[] | undefined>

const FREE_QUOTA_GB = 30
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024 * 1024
const CLOUD_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.mp4,.mp3,.wav,.ogg,.txt,.ipynb,image/*,video/*,audio/*'

const getFileKind = (title: string) => {
  const lower = title.toLowerCase()
  if (lower.match(/\.(mp4|mov|webm|mkv)$/)) return 'video'
  if (lower.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio'
  if (lower.match(/\.(jpe?g|png|gif|bmp|webp|heic)$/)) return 'image'
  if (lower.match(/\.pdf$/)) return 'pdf'
  if (lower.match(/\.(docx?|pptx?|txt|ipynb)$/)) return 'doc'
  return 'other'
}

const getMimeType = (file: File) => {
  if (file.type) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.ipynb')) return 'application/json'
  return 'application/octet-stream'
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function CloudPage({ searchParams = {} }: { searchParams?: CloudSearchParams }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [folders, setFolders] = useState<CloudFolder[]>([])
  const [documents, setDocuments] = useState<CloudDocument[]>([])
  const [folderPath, setFolderPath] = useState<{ id: string | null, name: string }[]>([{ id: null, name: 'Trang chủ Sen Cloud AI' }])
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [sortByName, setSortByName] = useState(false)
  const [isCompact, setIsCompact] = useState(false)

  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<{ type: 'idle' | 'uploading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' })

  const [previewDoc, setPreviewDoc] = useState<CloudDocument | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)

  const [draggedItem, setDraggedItem] = useState<{ id: string, type: 'folder' | 'document' } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy', items: SelectedItem[] } | null>(null)

  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SelectedItem | null>(null)
  const [renameInput, setRenameInput] = useState('')

  const folderIdFromPath = folderPath[folderPath.length - 1].id

  const refreshCloud = async (targetFolderId: string | null = folderIdFromPath) => {
    if (!userId) return
    const [folderRes, docRes] = await Promise.all([
      supabase.from('library_folders').select('id,name,parent_id,created_by,created_at').eq('created_by', userId).order('created_at', { ascending: false }),
      supabase.from('library_documents').select('id,title,folder_id,drive_file_id,created_by,created_at,description').eq('created_by', userId).order('created_at', { ascending: false })
    ])

    setFolders((folderRes.data || []) as CloudFolder[])
    setDocuments((docRes.data || []) as CloudDocument[])

    if (targetFolderId !== folderIdFromPath) {
      const rootFolder = targetFolderId ? (folderRes.data || []).find((folder: CloudFolder) => folder.id === targetFolderId) : null
      if (targetFolderId && rootFolder) {
        const chain: { id: string | null, name: string }[] = [{ id: null, name: 'Trang chủ Sen Cloud AI' }]
        const lookup = new Map<string, CloudFolder>((folderRes.data || []).map((folder: CloudFolder) => [folder.id, folder]))
        let current: CloudFolder | undefined = rootFolder
        const temp: { id: string | null, name: string }[] = []
        while (current) {
          temp.unshift({ id: current.id, name: current.name })
          current = current.parent_id ? lookup.get(current.parent_id) : undefined
        }
        setFolderPath(chain.concat(temp))
      } else {
        setFolderPath([{ id: null, name: 'Trang chủ Sen Cloud AI' }])
      }
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [folderRes, docRes] = await Promise.all([
        supabase.from('library_folders').select('id,name,parent_id,created_by,created_at').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('library_documents').select('id,title,folder_id,drive_file_id,created_by,created_at,description').eq('created_by', user.id).order('created_at', { ascending: false })
      ])

      setFolders((folderRes.data || []) as CloudFolder[])
      setDocuments((docRes.data || []) as CloudDocument[])
      setLoading(false)
    }

    init()
  }, [router])

  const currentFolderId = folderIdFromPath
  const currentFolders = folders.filter((folder) => folder.parent_id === currentFolderId)
  const currentDocuments = documents.filter((document) => document.folder_id === currentFolderId)

  const displayFolders = useMemo(() => {
    const items = currentFolders.filter((folder) => folder.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
    return sortByName ? [...items].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' })) : items
  }, [currentFolders, deferredSearchQuery, sortByName])

  const displayDocuments = useMemo(() => {
    const items = currentDocuments.filter((document) => document.title.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
    return sortByName ? [...items].sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' })) : items
  }, [currentDocuments, deferredSearchQuery, sortByName])

  const totalUsedBytes = documents.length * 8 * 1024 * 1024
  const usedPercent = Math.min(100, Math.round((totalUsedBytes / (FREE_QUOTA_GB * 1024 * 1024 * 1024)) * 100))

  const acceptParam = CLOUD_ACCEPT
  const proctorUrls = useMemo(() => {
    if (!previewDoc) return { preview: '', download: '', driveOpen: '' }
    return {
      preview: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/preview`,
      download: `https://drive.google.com/uc?export=download&id=${previewDoc.drive_file_id}`,
      driveOpen: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/view`
    }
  }, [previewDoc])

  const requestDocumentAccess = async (doc: CloudDocument) => !!doc

  const handleOpenDocument = async (doc: CloudDocument) => {
    const allowed = await requestDocumentAccess(doc)
    if (!allowed) return
    setPreviewDoc(doc)
  }

  const handleOpenFolder = (folderId: string, folderName: string) => {
    setSearchQuery('')
    setIsSelectMode(false)
    setSelectedItems([])
    setFolderPath((current) => [...current, { id: folderId, name: folderName }])
  }

  const handleNavigateBreadcrumb = (index: number) => {
    setSearchQuery('')
    setIsSelectMode(false)
    setSelectedItems([])
    setFolderPath((current) => current.slice(0, index + 1))
  }

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return
    const { error } = await supabase.from('library_folders').insert({ name: newFolderName.trim(), created_by: userId, parent_id: currentFolderId })
    if (!error) {
      setShowFolderModal(false)
      setNewFolderName('')
      await refreshCloud()
    } else {
      alert('Lỗi tạo thư mục: ' + error.message)
    }
  }

  const handleUploadDocument = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId || docFiles.length === 0) return

    const totalSize = docFiles.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_UPLOAD_BYTES) {
      setUploadStatus({ type: 'error', message: `Tổng dung lượng vượt giới hạn 1.5GB (${formatBytes(totalSize)}).` })
      return
    }

    try {
      setUploadStatus({ type: 'uploading', message: `Bắt đầu xử lý ${docFiles.length} file...` })
      for (let index = 0; index < docFiles.length; index += 1) {
        const file = docFiles[index]
        const finalTitle = docFiles.length === 1 && docTitle.trim() ? docTitle.trim() : file.name
        setUploadStatus({ type: 'uploading', message: `[${index + 1}/${docFiles.length}] Đang tải ${file.name}...` })
        const uploadUrl = await initGoogleDriveUpload(finalTitle, getMimeType(file))
        const uploadedData = await uploadFileToGoogleDrive(uploadUrl, file, finalTitle)
        const fileId = uploadedData?.id || uploadedData?.driveFileId
        if (!fileId) throw new Error('Không nhận được mã file từ Google Drive.')

        const { error } = await supabase.from('library_documents').insert({
          folder_id: currentFolderId,
          title: finalTitle,
          drive_file_id: fileId,
          created_by: userId
        })
        if (error) throw error
      }

      setUploadStatus({ type: 'success', message: `Đã tải thành công ${docFiles.length} file.` })
      setDocTitle('')
      setDocFiles([])
      setTimeout(() => {
        setShowDocModal(false)
        setUploadStatus({ type: 'idle', message: '' })
      }, 1200)
      await refreshCloud()
    } catch (error: any) {
      setUploadStatus({ type: 'error', message: error?.message || 'Có lỗi xảy ra khi tải file.' })
    }
  }

  const toggleSelection = (id: string, type: 'folder' | 'document', data: any) => {
    setSelectedItems((current) => {
      const exists = current.find((item) => item.id === id)
      if (exists) return current.filter((item) => item.id !== id)
      return [...current, { id, type, data }]
    })
  }

  const handleSetClipboard = (action: 'cut' | 'copy') => {
    setClipboard({ action, items: selectedItems })
    setSelectedItems([])
    setIsSelectMode(false)
  }

  const handlePaste = async () => {
    if (!clipboard || !userId) return
    try {
      for (const item of clipboard.items) {
        if (clipboard.action === 'cut') {
          if (item.type === 'folder') await supabase.from('library_folders').update({ parent_id: currentFolderId }).eq('id', item.id)
          else await supabase.from('library_documents').update({ folder_id: currentFolderId }).eq('id', item.id)
        } else {
          if (item.type === 'folder') {
            await supabase.from('library_folders').insert({ name: `${item.data.name} (Bản sao)`, parent_id: currentFolderId, created_by: userId })
          } else {
            await supabase.from('library_documents').insert({
              title: `${item.data.title} (Bản sao)`,
              drive_file_id: item.data.drive_file_id,
              folder_id: currentFolderId,
              created_by: userId
            })
          }
        }
      }
      setClipboard(null)
      await refreshCloud()
    } catch (error: any) {
      alert('Có lỗi khi dán: ' + (error?.message || 'Không xác định'))
    }
  }

  const handleRename = async () => {
    if (!renameTarget || !renameInput.trim()) return
    if (renameTarget.type === 'folder') await supabase.from('library_folders').update({ name: renameInput.trim() }).eq('id', renameTarget.id)
    else await supabase.from('library_documents').update({ title: renameInput.trim() }).eq('id', renameTarget.id)
    setShowRenameModal(false)
    setIsSelectMode(false)
    setSelectedItems([])
    await refreshCloud()
  }

  const handleDragStart = (event: React.DragEvent, id: string, type: 'folder' | 'document') => {
    setDraggedItem({ id, type })
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (event: React.DragEvent, targetFolderId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverId(null)
    if (!draggedItem || draggedItem.id === targetFolderId) return

    if (draggedItem.type === 'document') await supabase.from('library_documents').update({ folder_id: targetFolderId }).eq('id', draggedItem.id)
    else await supabase.from('library_folders').update({ parent_id: targetFolderId }).eq('id', draggedItem.id)
    setDraggedItem(null)
    await refreshCloud()
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Xóa ${selectedItems.length} mục đã chọn?`)) return
    for (const item of selectedItems) {
      if (item.type === 'folder') await supabase.from('library_folders').delete().eq('id', item.id)
      else await supabase.from('library_documents').delete().eq('id', item.id)
    }
    setSelectedItems([])
    setIsSelectMode(false)
    await refreshCloud()
  }

  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center bg-transparent font-bold text-sky-600 dark:text-sky-400">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin" />
          <p>Đang khởi tạo Sen Cloud AI...</p>
        </div>
      </div>
    )
  }

  if (previewDoc) {
    const kind = getFileKind(previewDoc.title || '')
    return (
      <div className="w-full h-full min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md gap-3">
          <button onClick={() => setPreviewDoc(null)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Xem tệp</p>
            <h3 className="font-black truncate">{previewDoc.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={proctorUrls.download} className="p-2 md:px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-xs font-bold border border-blue-200/30">
              <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Tải</span>
            </a>
            <a href={proctorUrls.driveOpen} target="_blank" rel="noreferrer" className="p-2 md:px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold">
              <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Drive</span>
            </a>
            <button onClick={async () => {
              try {
                const el = previewRef.current || document.documentElement
                if (el.requestFullscreen) await el.requestFullscreen()
                else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
                setIsPreviewFullscreen(true)
              } catch (error) {
                console.warn(error)
              }
            }} className="p-2 md:px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold">
              <Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Full</span>
            </button>
          </div>
        </div>
        <div ref={previewRef} className="flex-1 min-h-0 relative bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          {kind === 'pdf' && <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />}
          {kind === 'image' && <img src={proctorUrls.download} alt={previewDoc.title} className="max-h-full max-w-full object-contain" />}
          {kind === 'video' && <video controls src={proctorUrls.download} className="max-h-full max-w-full bg-black" />}
          {kind === 'audio' && <audio controls src={proctorUrls.download} className="w-full px-4" />}
          {(kind === 'doc' || kind === 'other') && <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none" allow="autoplay" />}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent p-4 md:p-8 relative text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden pb-32">
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-bl from-sky-400/35 to-cyan-400/25 dark:from-sky-800/35 dark:to-cyan-900/25 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 transition-colors mb-3">
              <ArrowLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/45 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300 mb-3">
              <Cloud className="w-3.5 h-3.5" /> Sen Cloud AI
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-sm flex items-center gap-3 mb-2">
              Cloud riêng của bạn <BookOpen className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Tạo folder, sắp xếp, di chuyển, đổi tên, sao chép và dán tài liệu của riêng bạn. Hỗ trợ PDF, DOCX, PPT, MP4, MP3, TXT, IPYNB và nhiều file cùng lúc đến 1.5GB.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Giới hạn miễn phí</p>
              <p className="text-3xl font-black text-sky-600 dark:text-sky-300">30GB</p>
            </div>
            <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Đang lưu</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{documents.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 liquid-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-sky-500" /> Kho dữ liệu cá nhân
                </h2>
                <div className="mt-3 flex items-center flex-wrap gap-2 text-sm font-bold bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/60 dark:border-slate-700/50 w-fit shadow-sm">
                  {folderPath.map((step, index) => (
                    <div key={`${step.name}-${index}`} className="flex items-center gap-2"
                      onDragOver={(event) => { event.preventDefault(); setDragOverId(step.id || 'root') }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(event) => handleDrop(event, step.id)}
                    >
                      <span onClick={() => handleNavigateBreadcrumb(index)} className={`cursor-pointer px-2 py-1 rounded-lg transition-colors ${dragOverId === (step.id || 'root') ? 'bg-sky-200 dark:bg-sky-900 text-sky-700' : index === folderPath.length - 1 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700'}`}>
                        {step.name}
                      </span>
                      {index < folderPath.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative w-full sm:w-72 shrink-0">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm trong cloud..." className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20" />
                </div>
                <button onClick={() => setSortByName(!sortByName)} className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 ${sortByName ? 'bg-sky-100 text-sky-700 border-sky-300 border' : 'bg-white/40 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white'}`}>
                  <ArrowUpDown className="w-5 h-5" /> {sortByName ? 'Xếp theo ngày' : 'A-Z'}
                </button>
                <button onClick={() => setIsCompact(!isCompact)} className="px-4 py-3 rounded-xl font-bold bg-white/40 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white">
                  {isCompact ? 'Chế độ gọn' : 'Chế độ thường'}
                </button>
                <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedItems([]); setClipboard(null) }} className={`px-4 py-3 rounded-xl font-bold ${isSelectMode ? 'bg-amber-100 text-amber-700 border-amber-300 border' : 'bg-white/40 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white'}`}>
                  Chọn nhiều
                </button>
                <button onClick={() => setShowFolderModal(true)} className="px-4 py-3 rounded-xl font-bold bg-white/40 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-sky-600" /> Folder
                </button>
                <button onClick={() => setShowDocModal(true)} className="px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5" /> Tải lên
                </button>
              </div>
            </div>

            <div className={`${selectedItems.length > 0 || clipboard ? 'mb-6' : ''} rounded-[2rem] bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-slate-700/40 p-4`}>
              {displayFolders.length === 0 && displayDocuments.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-500 opacity-70 py-10">
                  <Search className="w-16 h-16 mb-4" />
                  <p className="font-bold text-lg">Chưa có folder hoặc tài liệu nào.</p>
                </div>
              ) : (
                <>
                  {displayFolders.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2">Thư mục</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                        {displayFolders.map((folder) => {
                          const isSelected = selectedItems.some((item) => item.id === folder.id)
                          return (
                            <div key={folder.id}
                              draggable={!isSelectMode}
                              onDragStart={(event) => handleDragStart(event, folder.id, 'folder')}
                              onDragOver={(event) => { if (!isSelectMode) { event.preventDefault(); setDragOverId(folder.id) } }}
                              onDragLeave={() => setDragOverId(null)}
                              onDrop={(event) => { if (!isSelectMode) handleDrop(event, folder.id) }}
                              onClick={(event) => {
                                if (isSelectMode) {
                                  event.preventDefault();
                                  toggleSelection(folder.id, 'folder', folder)
                                } else {
                                  handleOpenFolder(folder.id, folder.name)
                                }
                              }}
                              className={`group cursor-pointer relative flex flex-col items-center justify-between ${isCompact ? 'p-3 rounded-2xl min-h-[130px]' : 'p-4 rounded-[1.75rem] min-h-[160px]'} transition-all ${dragOverId === folder.id ? 'bg-sky-100/70 dark:bg-sky-900/30 scale-[1.02] border-2 border-dashed border-sky-400' : isSelected ? 'bg-sky-50 dark:bg-sky-900/20 ring-2 ring-sky-500 shadow-md' : 'bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-700 hover:-translate-y-1 hover:shadow-lg'} animate-in fade-in duration-500`}
                            >
                              {isSelectMode && (
                                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white/50'}`}>
                                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                </div>
                              )}
                              <div className="relative w-16 h-16 flex items-center justify-center">
                                <Folder className="w-full h-full text-sky-600 drop-shadow-[0_10px_15px_rgba(59,130,246,0.18)] transition-transform group-hover:scale-110" fill="currentColor" stroke="currentColor" />
                              </div>
                              <p className={`font-black text-sm text-center ${isCompact ? 'text-[12px]' : ''} text-slate-800 dark:text-slate-200 group-hover:text-sky-600 transition-colors line-clamp-2 px-1`}>{folder.name}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {displayDocuments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2">Tài liệu</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {displayDocuments.map((doc) => {
                          const isSelected = selectedItems.some((item) => item.id === doc.id)
                          const kind = getFileKind(doc.title || '')
                          return (
                            <div key={doc.id}
                              draggable={!isSelectMode}
                              onDragStart={(event) => handleDragStart(event, doc.id, 'document')}
                              onClick={(event) => {
                                if (isSelectMode) {
                                  event.preventDefault();
                                  toggleSelection(doc.id, 'document', doc)
                                } else {
                                  handleOpenDocument(doc)
                                }
                              }}
                              className={`relative group cursor-pointer flex items-center gap-4 ${isCompact ? 'rounded-xl p-3' : 'rounded-[1.5rem] p-4'} transition-all duration-300 ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 border-2 border-sky-500 shadow-md' : 'bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-700 hover:-translate-y-1 hover:shadow-xl'} animate-in fade-in duration-500`}
                            >
                              {isSelectMode && (
                                <div className={`absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white/50'}`}>
                                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                </div>
                              )}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${kind === 'image' ? 'bg-emerald-100 text-emerald-600' : kind === 'video' ? 'bg-violet-100 text-violet-600' : kind === 'audio' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                {kind === 'image' && <Image className="w-6 h-6" />}
                                {kind === 'video' && <Video className="w-6 h-6" />}
                                {kind === 'audio' && <Music className="w-6 h-6" />}
                                {(kind === 'pdf' || kind === 'doc' || kind === 'other') && <FileText className="w-6 h-6" />}
                              </div>
                              <div className={`flex-1 overflow-hidden ${isSelectMode ? 'pr-8' : 'pr-2'}`}>
                                <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-sky-600 transition-colors text-sm leading-snug">{doc.title}</h3>
                                <span className="text-[10px] font-bold text-slate-400 mt-1 block">{doc.created_at ? new Date(doc.created_at).toLocaleDateString('vi-VN') : ''}</span>
                              </div>
                              <span className="absolute right-4 text-sky-500 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-xs transition-all font-bold">
                                Mở <Maximize2 className="w-3 h-3 ml-0.5" />
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="liquid-panel rounded-[2rem] p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <Cloud className="w-5 h-5 text-sky-500" /> Thông tin cloud
            </div>

            <div className="rounded-2xl bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 dark:text-slate-400 mb-1">Dung lượng miễn phí</p>
              <p className="text-3xl font-black text-sky-600 dark:text-sky-300">30GB</p>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500" style={{ width: `${usedPercent}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">Đã dùng ước tính {formatBytes(totalUsedBytes)} / {FREE_QUOTA_GB}GB</p>
            </div>

            <div className="rounded-2xl bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Tính năng</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Tạo folder, di chuyển, đổi tên, sao chép, dán và xem trước tài liệu ngay trong cloud riêng.
              </p>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 to-cyan-500/15 border border-sky-200/40 dark:border-sky-400/20 p-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <ChevronRight className="w-4 h-4 text-sky-500" /> Mẹo dùng nhanh
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Dùng kéo-thả để chuyển file vào folder khác hoặc chọn nhiều mục để cắt, sao chép và dán hàng loạt.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isSelectMode && selectedItems.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-slate-700 px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[90] animate-in slide-in-from-bottom-10 duration-300">
          <span className="font-extrabold text-sm mr-2 text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-lg">{selectedItems.length} mục đã chọn</span>
          <button onClick={() => {
            const target = selectedItems[0]
            if (!target) return
            setRenameTarget(target)
            setRenameInput(target.type === 'folder' ? target.data.name : target.data.title)
            setShowRenameModal(true)
          }} className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-4 py-2.5 rounded-xl font-bold text-sm">
            <Edit className="w-4 h-4" /> Đổi tên
          </button>
          <button onClick={handleDeleteSelected} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl font-bold text-sm">
            <Trash2 className="w-4 h-4" /> Xóa
          </button>
          <button onClick={() => handleSetClipboard('cut')} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm">
            <Scissors className="w-4 h-4" /> Cắt
          </button>
          <button onClick={() => handleSetClipboard('copy')} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-xl font-bold text-sm">
            <Copy className="w-4 h-4" /> Sao chép
          </button>
        </div>
      )}

      {clipboard && !isSelectMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-blue-400/50 px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(59,130,246,0.3)] flex items-center gap-4 z-[90] animate-bounce duration-700">
          <div className="flex flex-col">
            <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">Đang lưu {clipboard.items.length} mục</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Lệnh: {clipboard.action === 'cut' ? 'Cắt' : 'Sao chép'}</span>
          </div>
          <button onClick={handlePaste} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md">
            <ClipboardPaste className="w-4 h-4" /> Dán vào đây
          </button>
          <button onClick={() => setClipboard(null)} className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="liquid-panel rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowRenameModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center mb-4"><Edit className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <h3 className="text-xl font-black mb-2">Đổi tên {renameTarget.type === 'folder' ? 'thư mục' : 'tài liệu'}</h3>
            <input value={renameInput} onChange={(event) => setRenameInput(event.target.value)} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-500 mb-6 shadow-inner" />
            <button onClick={handleRename} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Lưu tên mới</button>
          </div>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="liquid-panel rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center mb-4"><Folder className="w-6 h-6 text-sky-600 dark:text-sky-400" /></div>
            <h3 className="text-xl font-black mb-2">Tạo thư mục mới</h3>
            <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Tên thư mục..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-sky-500 mb-6 shadow-inner" />
            <button onClick={handleCreateFolder} className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Tạo thư mục</button>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="liquid-panel rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => { setShowDocModal(false); setUploadStatus({ type: 'idle', message: '' }); setDocFiles([]) }} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
            <h3 className="text-xl font-black mb-4">Tải tài liệu lên</h3>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              {docFiles.length <= 1 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Tên tài liệu hiển thị</label>
                  <input value={docTitle} onChange={(event) => setDocTitle(event.target.value)} placeholder="Nếu bỏ trống sẽ lấy tên file..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Chọn file</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input type="file" accept={acceptParam} multiple onChange={(event) => setDocFiles(Array.from(event.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{docFiles.length > 0 ? `Đã chọn ${docFiles.length} file` : 'Nhấn vào đây để chọn file'}</p>
                </div>
                {docFiles.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto custom-scrollbar text-[11px] font-bold text-slate-500 space-y-1">
                    {docFiles.map((file) => <div key={`${file.name}-${file.size}`} className="truncate">• {file.name}</div>)}
                  </div>
                )}
              </div>
              {uploadStatus.type !== 'idle' && <div className={`p-3 rounded-xl text-xs font-bold ${uploadStatus.type === 'uploading' ? 'bg-blue-50 text-blue-600' : uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{uploadStatus.message}</div>}
              <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95 mt-4">
                {uploadStatus.type === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bắt đầu tải lên'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
