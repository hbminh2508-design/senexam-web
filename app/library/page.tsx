'use client'

export const dynamic = 'force-dynamic'

import { useDeferredValue, useEffect, useState, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Folder, FileText, ArrowLeft, PlusCircle, Trash2, 
  UploadCloud, Loader2, X, ChevronRight, Download, BookOpen, Search,
  ListChecks, Scissors, Copy, ClipboardPaste, CheckCircle2, Edit, ArrowUpDown, Maximize2, ExternalLink,
  Image, Video, Music, Palette
} from 'lucide-react'

import { glassSearchInputClass, highlightSearchText } from '@/app/components/searchUtils'

const glassCardStyles = "liquid-panel"

type SelectedItem = { id: string, type: 'folder' | 'document', data: any }

export default function LibraryPage() {
  // build-fix: ensure all hooks are defined in component scope (moved search useEffect outside JSX)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('student')
  
  const [folders, setFolders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  
  const [folderPath, setFolderPath] = useState<{id: string | null, name: string}[]>([{ id: null, name: 'Trang chủ Thư viện' }])
  const currentFolderId = folderPath[folderPath.length - 1].id

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [isCompact, setIsCompact] = useState(false)

  // Folder customizations (color, icon) stored in localStorage to avoid DB migration
  const [folderCustomizations, setFolderCustomizations] = useState<Record<string, { color?: string, icon?: string }>>({})
  const [showFolderSettingsModal, setShowFolderSettingsModal] = useState(false)
  const [folderSettingsTarget, setFolderSettingsTarget] = useState<any | null>(null)
  const [folderSettingsColor, setFolderSettingsColor] = useState<string | undefined>(undefined)
  const [folderSettingsIcon, setFolderSettingsIcon] = useState<string | undefined>(undefined)
  
  // STATE: SẮP XẾP A-Z
  const [sortByName, setSortByName] = useState(false)

  // Modal Create/Upload
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error', message: string}>({ type: 'idle', message: '' })

  // 🌟 STATE MỚI: QUẢN LÝ XEM TRƯỚC TÀI LIỆU TRỰC TIẾP TRÊN WEB ĐỒNG BỘ
  const [previewDoc, setPreviewDoc] = useState<any | null>(null)

  // Drag & Drop
  const [draggedItem, setDraggedItem] = useState<{id: string, type: 'folder' | 'document'} | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Select Mode & Clipboard
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [clipboard, setClipboard] = useState<{action: 'cut' | 'copy', items: SelectedItem[]} | null>(null)

  // Rename
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SelectedItem | null>(null)
  const [renameInput, setRenameInput] = useState('')

  // Global search results (search across whole library regardless of current folder)
  const [searchFoldersResults, setSearchFoldersResults] = useState<any[] | null>(null)
  const [searchDocsResults, setSearchDocsResults] = useState<any[] | null>(null)
  const [searchExamsResults, setSearchExamsResults] = useState<any[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)
  const searchDebounceRef = useRef<number | null>(null)
  const searchRequestRef = useRef(0)
  const [isEmbedPreview, setIsEmbedPreview] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'student')
      
      await fetchContents(null)
      setLoading(false)
    }

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
    init()
  }, [router])

  const routeQueryRef = useRef<string | null>(null)

  useEffect(() => {
    const currentQuery = searchParams.toString()
    if (routeQueryRef.current === currentQuery) return
    routeQueryRef.current = currentQuery

    const applyRouteState = async () => {
      try {
        const previewId = searchParams.get('preview')
        const folderId = searchParams.get('folder')
        setIsEmbedPreview(searchParams.get('embed') === '1')

        if (previewId) {
          const { data, error } = await supabase.from('library_documents').select('*').eq('id', previewId).single()
          if (!error && data) setPreviewDoc(data)
        } else {
          setPreviewDoc(null)
        }

        if (folderId) {
          const chain: { id: string | null, name: string }[] = []
          let currentId: string | null = folderId
          let guard = 0

          while (currentId && guard < 20) {
            const { data: folderData, error }: { data: { id: string, name: string, parent_id: string | null } | null, error: any } = await supabase.from('library_folders').select('id,name,parent_id').eq('id', currentId).single()
            if (error || !folderData) break
            chain.unshift({ id: folderData.id, name: folderData.name })
            currentId = folderData.parent_id || null
            guard += 1
          }

          if (chain.length > 0) {
            const rootPath = [{ id: null, name: 'Trang chủ Thư viện' }, ...chain]
            setFolderPath(rootPath)
            await fetchContents(chain[chain.length - 1].id)
          } else if (!previewId) {
            setFolderPath([{ id: null, name: 'Trang chủ Thư viện' }])
            await fetchContents(null)
          }
        } else if (!previewId) {
          setFolderPath([{ id: null, name: 'Trang chủ Thư viện' }])
          await fetchContents(null)
        }
      } catch (e) { /* ignore */ }
    }

    applyRouteState()
  }, [searchParams])

  // Debounce searchQuery -> globalSearch
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    if (!searchQuery || searchQuery.trim().length < 2) {
      searchRequestRef.current += 1
      setSearchFoldersResults(null); setSearchDocsResults(null); setSearchExamsResults(null); setSearchLoading(false); return
    }
    // @ts-ignore
    searchDebounceRef.current = window.setTimeout(() => { globalSearch(searchQuery) }, 500)
    return () => { if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current) }
  }, [searchQuery])

  // Fullscreenchange listener to update state when user exits fullscreen
  useEffect(() => {
    const onFull = () => {
      const fs = document.fullscreenElement || (document as any).webkitFullscreenElement
      setIsPreviewFullscreen(!!fs)
      if (!fs) {
        // when exiting fullscreen, if preview was open we keep it
      }
    }
    document.addEventListener('fullscreenchange', onFull)
    document.addEventListener('webkitfullscreenchange', onFull)
    return () => {
      document.removeEventListener('fullscreenchange', onFull)
      document.removeEventListener('webkitfullscreenchange', onFull)
    }
  }, [])

  const scoreResult = (text: string, query: string) => {
    const source = text.toLowerCase()
    const needle = query.toLowerCase().trim()
    if (!needle) return 0
    if (source === needle) return 100
    if (source.startsWith(needle)) return 80
    if (source.includes(needle)) return 60
    const words = needle.split(/\s+/).filter(Boolean)
    const matchedWords = words.filter(word => source.includes(word)).length
    return matchedWords * 10
  }

  const rankByQuery = (items: any[], query: string, labelGetter: (item: any) => string) => {
    return [...items].sort((a, b) => scoreResult(labelGetter(b), query) - scoreResult(labelGetter(a), query))
  }

  const buildSearchBlob = (item: any, folderName?: string) => {
    return Object.values(item)
      .filter(value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      .map(value => String(value))
      .concat(folderName ? [folderName] : [])
      .join(' ')
      .toLowerCase()
  }

  const globalSearch = async (q: string) => {
    const qtrim = q.trim()
    if (!qtrim) {
      searchRequestRef.current += 1
      setSearchFoldersResults(null); setSearchDocsResults(null); setSearchExamsResults(null); setSearchLoading(false); return
    }
    const requestId = ++searchRequestRef.current
    setSearchLoading(true)
    try {
      const [fRes, dRes, eRes] = await Promise.all([
        supabase.from('library_folders').select('*').limit(1000),
        supabase.from('library_documents').select('*').limit(1000),
        supabase.from('exams').select('*').limit(1000)
      ])
      if (requestId !== searchRequestRef.current) return

      const folders = fRes.data || []
      const folderMap = new Map<string, any>(folders.map((folder: any) => [folder.id, folder]))
      const folderBlobQuery = qtrim.toLowerCase()

      const searchFolders = folders.filter((folder: any) => buildSearchBlob(folder).includes(folderBlobQuery))

      const searchDocs = (dRes.data || [])
        .map((doc: any) => ({ ...doc, folder_name: doc.folder_id ? folderMap.get(doc.folder_id)?.name || '' : '' }))
        .filter((doc: any) => buildSearchBlob(doc, doc.folder_name).includes(folderBlobQuery) || (doc.folder_name && scoreResult(doc.folder_name, qtrim) > 0))

      const searchExams = (eRes.data || [])
        .map((exam: any) => ({ ...exam, folder_name: exam.folder_id ? folderMap.get(exam.folder_id)?.name || exam.folder_name || '' : exam.folder_name || '' }))
        .filter((exam: any) => buildSearchBlob(exam, exam.folder_name).includes(folderBlobQuery) || (exam.folder_name && scoreResult(exam.folder_name, qtrim) > 0))

      setSearchFoldersResults(rankByQuery(searchFolders, qtrim, item => buildSearchBlob(item)))
      setSearchDocsResults(rankByQuery(searchDocs, qtrim, item => buildSearchBlob(item, item.folder_name)))
      setSearchExamsResults(rankByQuery(searchExams, qtrim, item => buildSearchBlob(item, item.folder_name)))
    } catch (e) { console.warn('Search failed', e) }
    if (requestId === searchRequestRef.current) setSearchLoading(false)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('library_folder_customizations')
      if (raw) setFolderCustomizations(JSON.parse(raw))
    } catch (e) { /* ignore */ }
  }, [])

  const fetchContents = async (folderId: string | null) => {
    const folderQuery = supabase.from('library_folders').select('*').order('created_at', { ascending: false })
    if (folderId) folderQuery.eq('parent_id', folderId); else folderQuery.is('parent_id', null);
    
    const docQuery = supabase.from('library_documents').select('*').order('created_at', { ascending: false })
    if (folderId) docQuery.eq('folder_id', folderId); else docQuery.is('folder_id', null);

    const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])
    const fdata = folderRes.data || []
    setFolders(fdata)
    // Đồng bộ màu/icon từ DB vào trạng thái client và localStorage
    try {
      const map: Record<string, { color?: string, icon?: string }> = {}
      for (const f of fdata) {
        if (f.id && (f.color || f.icon)) map[f.id] = { color: f.color, icon: f.icon }
      }
      if (Object.keys(map).length > 0) {
        setFolderCustomizations(map)
        try { localStorage.setItem('library_folder_customizations', JSON.stringify(map)) } catch (e) {}
      }
    } catch (e) { /* ignore */ }
    setDocuments(docRes.data || [])
  }

  const handleOpenFolder = async (folderId: string, folderName: string) => {
    setSearchQuery(''); setIsSelectMode(false); setSelectedItems([]);
    setFolderPath([...folderPath, { id: folderId, name: folderName }])
    await fetchContents(folderId)
  }

  const handleNavigateBreadcrumb = async (index: number) => {
    setSearchQuery(''); setIsSelectMode(false); setSelectedItems([]);
    const newPath = folderPath.slice(0, index + 1)
    setFolderPath(newPath)
    await fetchContents(newPath[newPath.length - 1].id)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('library_folders').insert({ 
      name: newFolderName, created_by: user?.id, parent_id: currentFolderId 
    })
    if (!error) {
      setShowFolderModal(false); setNewFolderName(''); fetchContents(currentFolderId)
    } else { alert("Lỗi tạo thư mục: " + error.message) }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (docFiles.length === 0) return

    try {
      setUploadStatus({ type: 'uploading', message: `Bắt đầu xử lý ${docFiles.length} tài liệu...` })
      const { data: { user } } = await supabase.auth.getUser()

      for (let i = 0; i < docFiles.length; i++) {
        const file = docFiles[i];
        const finalTitle = (docFiles.length === 1 && docTitle.trim()) ? docTitle.trim() : file.name;

        setUploadStatus({ type: 'uploading', message: `[${i + 1}/${docFiles.length}] Đang cấp phép tải file: ${file.name}...` })
        const initRes = await fetch('/api/upload-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: finalTitle, mimeType: file.type })
        });
        
        if (!initRes.ok) throw new Error("Không thể khởi tạo kết nối Google Drive.");
        const { uploadUrl } = await initRes.json();

        setUploadStatus({ type: 'uploading', message: `[${i + 1}/${docFiles.length}] Đang đẩy file lên Đám mây...` })
        const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!uploadRes.ok) throw new Error("Lỗi đứt đoạn đường truyền.");
        
        const fileId = (await uploadRes.json()).id;

        setUploadStatus({ type: 'uploading', message: `[${i + 1}/${docFiles.length}] Đang đồng bộ vào Thư viện...` })
        // Lưu trữ thông tin tệp cơ bản (không giả định schema mới trên DB)
        const { error: dbError } = await supabase.from('library_documents').insert({
          folder_id: currentFolderId, title: finalTitle, drive_file_id: fileId, created_by: user?.id
        })
        if (dbError) throw new Error(dbError.message)
      }
      
      setUploadStatus({ type: 'success', message: `Tuyệt vời! Đã tải thành công ${docFiles.length} tài liệu!` })
      setDocTitle(''); setDocFiles([]); 
      setTimeout(() => { setShowDocModal(false); setUploadStatus({type: 'idle', message: ''}) }, 2000);
      fetchContents(currentFolderId)
    } catch (err: any) { setUploadStatus({ type: 'error', message: err.message || 'Có lỗi xảy ra.' }) }
  }

  const handleRename = async () => {
    if (!renameInput.trim() || !renameTarget) return;
    try {
      if (renameTarget.type === 'folder') {
        await supabase.from('library_folders').update({ name: renameInput.trim() }).eq('id', renameTarget.id);
      } else {
        await supabase.from('library_documents').update({ title: renameInput.trim() }).eq('id', renameTarget.id);
      }
      setShowRenameModal(false); setIsSelectMode(false); setSelectedItems([]);
      fetchContents(currentFolderId);
    } catch (e) {
      alert("Lỗi đổi tên!");
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string, type: 'folder' | 'document') => {
    if (userRole !== 'admin' && userRole !== 'collab') return;
    setDraggedItem({ id, type }); e.dataTransfer.effectAllowed = "move"
  }

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault(); e.stopPropagation(); setDragOverId(null);
    if (!draggedItem) return;
    if (draggedItem.type === 'folder' && draggedItem.id === targetFolderId) return; 

    try {
      if (draggedItem.type === 'document') await supabase.from('library_documents').update({ folder_id: targetFolderId }).eq('id', draggedItem.id);
      else if (draggedItem.type === 'folder') await supabase.from('library_folders').update({ parent_id: targetFolderId }).eq('id', draggedItem.id);
      fetchContents(currentFolderId);
    } catch (err) { alert("Lỗi khi di chuyển dữ liệu") }
    setDraggedItem(null)
  }

  const toggleSelection = (id: string, type: 'folder' | 'document', data: any) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === id);
      if (exists) return prev.filter(i => i.id !== id);
      return [...prev, { id, type, data }];
    })
  }

  const handleSetClipboard = (action: 'cut' | 'copy') => {
    setClipboard({ action, items: selectedItems });
    setSelectedItems([]); setIsSelectMode(false);
  }

  const handlePaste = async () => {
    if (!clipboard) return;
    if (clipboard.action === 'cut' && clipboard.items.some(i => i.type === 'folder' && i.id === currentFolderId)) {
      alert("Lỗi Logic: Không thể di chuyển thư mục vào bên trong chính nó!"); return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser()
      for (const item of clipboard.items) {
        if (clipboard.action === 'cut') {
          if (item.type === 'folder') await supabase.from('library_folders').update({ parent_id: currentFolderId }).eq('id', item.id);
          else await supabase.from('library_documents').update({ folder_id: currentFolderId }).eq('id', item.id);
        } else {
          if (item.type === 'folder') await supabase.from('library_folders').insert({ name: item.data.name + ' (Bản sao)', parent_id: currentFolderId, created_by: user?.id });
          else await supabase.from('library_documents').insert({ title: item.data.title + ' (Bản sao)', drive_file_id: item.data.drive_file_id, folder_id: currentFolderId, created_by: user?.id });
        }
      }
      setClipboard(null); await fetchContents(currentFolderId);
    } catch (err: any) { alert("Có lỗi khi dán: " + err.message); }
    setLoading(false);
  }

  const handleBulkDelete = async () => {
    if (userRole !== 'admin') return alert("Chỉ Admin mới có quyền xóa tài liệu!");
    if (!confirm(`Xóa vĩnh viễn ${selectedItems.length} mục đã chọn khỏi hệ thống?`)) return;
    
    setLoading(true);
    try {
      for (const item of selectedItems) {
        if (item.type === 'folder') await supabase.from('library_folders').delete().eq('id', item.id);
        else await supabase.from('library_documents').delete().eq('id', item.id);
      }
      setSelectedItems([]); setIsSelectMode(false); await fetchContents(currentFolderId);
    } catch (err) { alert("Lỗi khi xóa hệ thống"); }
    setLoading(false);
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá Thư mục này cùng toàn bộ tài liệu bên trong?')) return
    const { error } = await supabase.from('library_folders').delete().eq('id', id)
    if (!error) setFolders(folders.filter(f => f.id !== id))
  }
  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Xoá vĩnh viễn tài liệu này khỏi hệ thống?')) return
    const { error } = await supabase.from('library_documents').delete().eq('id', id)
    if (!error) setDocuments(documents.filter(d => d.id !== id))
  }

  const openFolderSettings = (folder: any) => {
    setFolderSettingsTarget(folder)
    const meta = folderCustomizations[folder.id] || {}
    setFolderSettingsColor(meta.color)
    setFolderSettingsIcon(meta.icon)
    setShowFolderSettingsModal(true)
  }

  const saveFolderSettings = () => {
    if (!folderSettingsTarget) return
    const id = folderSettingsTarget.id
    const next = { ...folderCustomizations, [id]: { color: folderSettingsColor, icon: folderSettingsIcon } }
    setFolderCustomizations(next)
    try { localStorage.setItem('library_folder_customizations', JSON.stringify(next)) } catch (e) {}
    // Cập nhật vào Supabase để đồng bộ giữa thiết bị
    (async () => {
      try {
        await supabase.from('library_folders').update({ color: folderSettingsColor || null, icon: folderSettingsIcon || null }).eq('id', id)
        // Cập nhật nhanh state folders
        setFolders(prev => prev.map(f => f.id === id ? { ...f, color: folderSettingsColor, icon: folderSettingsIcon } : f))
      } catch (e) { console.warn('Không thể lưu cấu hình thư mục lên DB', e) }
    })()
    setShowFolderSettingsModal(false)
  }

  // ÁP DỤNG THUẬT TOÁN TÌM KIẾM & SẮP XẾP TỰ NHIÊN (NATURAL SORT)
  // Helper to detect file kind from title extension
  const getFileKind = (title: string) => {
    const t = title.toLowerCase()
    if (t.match(/\.(mp4|mov|webm|mkv)$/)) return 'video'
    if (t.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio'
    if (t.match(/\.(jpe?g|png|gif|bmp|webp|heic)$/)) return 'image'
    if (t.match(/\.pdf$/)) return 'pdf'
    return 'other'
  }

  let displayFolders = searchFoldersResults !== null ? (searchFoldersResults) : folders.filter(f => f.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
  let displayDocuments = searchDocsResults !== null ? (searchDocsResults) : documents.filter(d => d.title.toLowerCase().includes(deferredSearchQuery.toLowerCase()))

  if (sortByName) {
    displayFolders.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' }));
    displayDocuments.sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' }));
  }

  // TỐI ƯU URL PHỤC VỤ PREVIEW VÀ DIRECT DOWNLOAD TRÊN IPHONE
  const proctorUrls = useMemo(() => {
    if (!previewDoc) return { preview: '', download: '', driveOpen: '' };
    return {
      preview: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/preview`,
      download: `https://drive.google.com/uc?export=download&id=${previewDoc.drive_file_id}`,
      driveOpen: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/view`
    };
  }, [previewDoc])

  if (loading) return (
    <div className="app-shell min-h-screen flex items-center justify-center font-bold text-blue-600 bg-transparent animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-lg opacity-20 animate-pulse"></div>
          <Loader2 className="w-12 h-12 animate-spin relative" />
        </div>
        <p className="text-lg font-bold">Đang khởi tạo thư viện số...</p>
      </div>
    </div>
  )

  if (isEmbedPreview && previewDoc) {
    return (
      <div className="w-full h-full min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Xem nhanh nội bộ</p>
            <h3 className="font-black truncate">{previewDoc.title}</h3>
          </div>
          <button onClick={() => router.push(`/library?preview=${previewDoc.id}`)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shrink-0">
            Mở chi tiết
          </button>
        </div>
        <div className="flex-1 min-h-0 relative bg-slate-100 dark:bg-slate-950">
          <div ref={previewRef} className="absolute inset-0 flex items-center justify-center">
            {(() => {
              const kind = getFileKind(previewDoc.title || '')
              if (kind === 'pdf') {
                return <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none bg-transparent" allow="autoplay" />
              }
              if (kind === 'image') {
                return <img src={proctorUrls.download} alt={previewDoc.title} className="max-h-full max-w-full object-contain" />
              }
              if (kind === 'video') {
                return <video controls src={proctorUrls.download} className="max-h-full max-w-full bg-black" />
              }
              if (kind === 'audio') {
                return <audio controls src={proctorUrls.download} className="w-full px-4" />
              }
              return <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none bg-transparent" allow="autoplay" />
            })()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent p-4 md:p-8 relative text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden pb-32">
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-bl from-blue-400/40 to-cyan-400/30 dark:from-blue-800/40 dark:to-cyan-900/30 rounded-full blur-[120px] pointer-events-none"></div>

      {/* 🌟 WINDOW LIVE PREVIEW (XEM FILE & TẢI TRỰC TIẾP KHÔNG BỊ VĂNG KHỎI WEB) */}
      {previewDoc && (
        <div className="fixed inset-0 z-[999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            
            {/* Header toolbar */}
            <div className="h-16 px-4 sm:px-6 liquid-panel-strong rounded-t-[3rem] border-b dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-5 h-5 text-red-500 shrink-0 shadow-sm" />
                <div className="truncate">
                  <h3 className="font-extrabold text-sm md:text-base truncate">{previewDoc.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tài liệu số hệ thống</p>
                </div>
              </div>
              
              {/* Toolbar điều hướng tệp đính kèm */}
              <div className="flex items-center gap-2">
                {/* 1. Nút tải trực tiếp */}
                <a 
                  href={proctorUrls.download} 
                  className="p-2 md:px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-xs font-bold border border-blue-200/30"
                  title="Tải tệp trực tiếp"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">Tải trực tiếp</span>
                </a>
                
                {/* 2. Nút chuyển sang Drive ở góc trên bên phải */}
                <a 
                  href={proctorUrls.driveOpen} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 md:px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
                  title="Mở rộng bằng tab Google Drive"
                >
                  <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Mở rộng Drive</span>
                </a>

                {/* 2.5 Nút fullscreen */}
                <button onClick={async () => {
                  try {
                    const el = previewRef.current || document.documentElement
                    if (el.requestFullscreen) await el.requestFullscreen()
                    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
                    setIsPreviewFullscreen(true)
                  } catch (e) { console.warn('Fullscreen failed', e) }
                }} className="p-2 md:px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold" title="Xem toàn màn hình">
                  <Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Toàn màn hình</span>
                </button>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

                {/* 3. Nút đóng cửa sổ */}
                <button onClick={() => setPreviewDoc(null)} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Khung nhúng/preview cho nhiều loại tệp (pdf, ảnh, video, audio) */}
            <div ref={previewRef} className="flex-1 bg-slate-100 dark:bg-slate-950 relative flex items-center justify-center">
              {(() => {
                const kind = getFileKind(previewDoc.title || '')
                if (kind === 'pdf') {
                  return <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none bg-transparent" allow="autoplay" />
                }
                if (kind === 'image') {
                  return <img src={proctorUrls.download} alt={previewDoc.title} className="max-h-[86vh] max-w-full object-contain" />
                }
                if (kind === 'video') {
                  return <video controls src={proctorUrls.download} className="max-h-[86vh] max-w-full bg-black" />
                }
                if (kind === 'audio') {
                  return <audio controls src={proctorUrls.download} className="w-full" />
                }
                return <iframe src={proctorUrls.preview} className="absolute inset-0 w-full h-full border-none bg-transparent" allow="autoplay" />
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- FLOATING ACTION BARS --- */}
      {isSelectMode && selectedItems.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-slate-700 apps-shadow px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[90] animate-in slide-in-from-bottom-10 duration-300">
           <span className="font-extrabold text-sm mr-2 text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-lg">{selectedItems.length} mục đã chọn</span>
           
           {selectedItems.length === 1 && (userRole === 'admin' || userRole === 'collab') && (
             <button onClick={() => {
               setRenameTarget(selectedItems[0]);
               setRenameInput(selectedItems[0].type === 'folder' ? selectedItems[0].data.name : selectedItems[0].data.title);
               setShowRenameModal(true);
             }} className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-4 py-2.5 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors font-bold text-sm">
               <Edit className="w-4 h-4"/> Đổi tên
             </button>
           )}

           {userRole === 'admin' && (
             <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-bold text-sm">
               <Trash2 className="w-4 h-4"/> Xóa
             </button>
           )}
           <button onClick={() => handleSetClipboard('cut')} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-bold text-sm">
             <Scissors className="w-4 h-4"/> Cắt
           </button>
           <button onClick={() => handleSetClipboard('copy')} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors font-bold text-sm">
             <Copy className="w-4 h-4"/> Sao chép
           </button>
        </div>
      )}

      {clipboard && !isSelectMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-blue-400/50 px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(59,130,246,0.3)] flex items-center gap-4 z-[90] animate-bounce duration-700">
           <div className="flex flex-col">
             <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">Đang lưu {clipboard.items.length} mục</span>
             <span className="text-[10px] font-bold text-slate-500 uppercase">Lệnh: {clipboard.action === 'cut' ? 'Cắt' : 'Sao chép'}</span>
           </div>
           <button onClick={handlePaste} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-md">
             <ClipboardPaste className="w-4 h-4"/> Dán vào đây
           </button>
           <button onClick={() => setClipboard(null)} className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
             <X className="w-4 h-4"/>
           </button>
        </div>
      )}

      {/* --- MODAL ĐỔI TÊN --- */}
      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`${glassCardStyles} rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowRenameModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center mb-4"><Edit className="w-6 h-6 text-amber-600 dark:text-amber-400"/></div>
            <h3 className="text-xl font-black mb-2">Đổi tên {renameTarget.type === 'folder' ? 'thư mục' : 'tài liệu'}</h3>
            <input type="text" value={renameInput} onChange={(e) => setRenameInput(e.target.value)} className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-500 mb-6 shadow-inner" />
            <button onClick={handleRename} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Lưu Tên Mới</button>
          </div>
        </div>
      )}

      {/* --- MODALS CREATE/UPLOAD --- */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`${glassCardStyles} rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4"><Folder className="w-6 h-6 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400"/></div>
            <h3 className="text-xl font-black mb-2">Tạo thư mục mới</h3>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Tên thư mục..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6 shadow-inner" />
            <button onClick={handleCreateFolder} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Tạo Thư Mục</button>
          </div>
        </div>
      )}

      {showFolderSettingsModal && folderSettingsTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`${glassCardStyles} rounded-[2.5rem] w-full max-w-sm p-6 shadow-2xl relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowFolderSettingsModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="mb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/60 dark:bg-slate-800/40">
                <Folder className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-black text-lg">Cấu hình thư mục</h3>
                <p className="text-xs text-slate-500">Thư mục: {folderSettingsTarget.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Màu nổi bật</label>
                <input type="color" value={folderSettingsColor || '#3b82f6'} onChange={(e) => setFolderSettingsColor(e.target.value)} className="w-20 h-10 p-0 border-none bg-transparent" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Biểu tượng (emoji hoặc text)</label>
                <input type="text" value={folderSettingsIcon || ''} onChange={(e) => setFolderSettingsIcon(e.target.value)} placeholder="Ví dụ: 📁, 📚, 🧪" className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold outline-none" />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button onClick={saveFolderSettings} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold">Lưu</button>
              <button onClick={() => setShowFolderSettingsModal(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-3 rounded-xl font-bold">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`${glassCardStyles} rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => { setShowDocModal(false); setUploadStatus({type:'idle', message:''}); setDocFiles([]) }} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-emerald-600 dark:text-emerald-400"/></div>
            <h3 className="text-xl font-black mb-4">Tải tài liệu lên</h3>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              {docFiles.length <= 1 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Tên tài liệu hiển thị</label>
                  <input type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Nếu bỏ trống sẽ lấy tên gốc của file..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Chọn file (PDF, ảnh, video, audio)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input type="file" accept=".pdf,image/*,video/*,audio/*" multiple onChange={(e) => setDocFiles(Array.from(e.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                    {docFiles.length > 0 ? `Đã chọn ${docFiles.length} file tài liệu` : 'Nhấn vào đây để chọn file'}
                  </p>
                </div>
                {docFiles.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto custom-scrollbar text-[11px] font-bold text-slate-500 space-y-1">
                    {docFiles.map(f => <div key={f.name} className="truncate">📄 {f.name}</div>)}
                  </div>
                )}
              </div>
              
              {uploadStatus.type !== 'idle' && <div className={`p-3 rounded-xl text-xs font-bold ${uploadStatus.type === 'uploading' ? 'bg-blue-50 text-blue-600' : uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{uploadStatus.message}</div>}
              <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95 mt-4">
                {uploadStatus.type === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Bắt đầu tải lên'}
              </button>
            </form>
          </div>
        </div>
      )}

  
      <div className="relative z-10 max-w-[1400px] mx-auto">
        
        {/* HEADER & THANH TÌM KIẾM */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex-1">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3">
              <ArrowLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm flex items-center gap-3 mb-4">
              Thư Viện Số <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </h1>
            
            {/* Breadcrumb đường dẫn */}
            <div className="flex items-center flex-wrap gap-2 text-sm font-bold bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/60 dark:border-slate-700/50 w-fit shadow-sm">
              {folderPath.map((step, index) => (
                <div key={index} className="flex items-center gap-2"
                     onDragOver={(e) => { e.preventDefault(); setDragOverId(step.id || 'root') }}
                     onDragLeave={() => setDragOverId(null)}
                     onDrop={(e) => handleDrop(e, step.id)}
                >
                  <span onClick={() => handleNavigateBreadcrumb(index)} 
                        className={`cursor-pointer px-2 py-1 rounded-lg transition-colors ${dragOverId === (step.id || 'root') ? 'bg-blue-200 dark:bg-blue-900 text-blue-700' : index === folderPath.length - 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700'}`}>
                    {step.name}
                  </span>
                  {index < folderPath.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Thanh Tìm kiếm */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); globalSearch(searchQuery) } }} placeholder="Tìm kiếm (toàn bộ thư viện)..." className={`${glassSearchInputClass} pl-9 pr-10 py-3`} />
              <button onClick={() => globalSearch(searchQuery)} title="Tìm kiếm toàn cục" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/20 hover:bg-white/30 text-slate-700 dark:text-slate-200">{searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</button>
            </div>

            <button onClick={() => setIsCompact(!isCompact)} className={`w-full sm:w-auto px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${isCompact ? 'bg-slate-100 dark:bg-slate-800 text-slate-900' : 'bg-white/40 dark:bg-slate-800/50'}`}>
              {isCompact ? 'Chế độ Gọn' : 'Chế độ Thường'}
            </button>

            {(userRole === 'admin' || userRole === 'collab') && (
              <>
                {/* Sắp xếp A-Z */}
                <button onClick={() => setSortByName(!sortByName)} className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${sortByName ? 'bg-indigo-100 text-indigo-700 border-indigo-300 border' : 'bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-white/60'}`}>
                  <ArrowUpDown className="w-5 h-5" /> {sortByName ? 'Xếp theo Ngày' : 'Gọn gàng (A-Z)'}
                </button>

                {/* Sắp xếp (Chọn nhiều) */}
                <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedItems([]); setClipboard(null); }} className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${isSelectMode ? 'bg-amber-100 text-amber-700 border-amber-300 border' : 'bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-white/60'}`}>
                  <ListChecks className="w-5 h-5" /> {isSelectMode ? 'Hủy Chọn' : 'Sắp xếp (Chọn)'}
                </button>

                <button onClick={() => setShowFolderModal(true)} className="w-full sm:w-auto bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white px-5 py-3 rounded-2xl font-bold flex items-center center gap-2 shadow-sm hover:bg-white/60 transition-colors">
                  <PlusCircle className="w-5 h-5 text-blue-600" /> Thư Mục
                </button>
                <button onClick={() => setShowDocModal(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-colors">
                  <UploadCloud className="w-5 h-5" /> Tải Lên
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className={`${glassCardStyles} rounded-[3rem] p-6 md:p-10 min-h-[60vh] border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20 animate-in fade-in duration-500`}>
          
          {displayFolders.length === 0 && displayDocuments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 pt-20">
              <Search className="w-16 h-16 mb-4" />
              <p className="font-bold text-lg">Không tìm thấy thư mục hay tài liệu nào.</p>
            </div>
          ) : (
            <>
              {/* LƯỚI THƯ MỤC */}
              {displayFolders.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2 drop-shadow-sm">Thư mục</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {displayFolders.map(folder => {
                      const isSelected = selectedItems.some(i => i.id === folder.id);
                      return (
                        <div key={folder.id} 
                            draggable={!isSelectMode && (userRole === 'admin' || userRole === 'collab')}
                            onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
                            onDragOver={(e) => { if (!isSelectMode) { e.preventDefault(); setDragOverId(folder.id); } }}
                            onDragLeave={() => setDragOverId(null)}
                            onDrop={(e) => { if (!isSelectMode) handleDrop(e, folder.id); }}
                            onClick={(e) => {
                              if (isSelectMode) { e.preventDefault(); toggleSelection(folder.id, 'folder', folder); } 
                              else { handleOpenFolder(folder.id, folder.name); }
                            }} 
                            className={`group cursor-pointer flex flex-col items-center gap-3 relative ${isCompact ? 'p-2 rounded-2xl' : 'p-4 rounded-[2rem]'} transition-all duration-300 ${dragOverId === folder.id ? 'bg-blue-100/50 dark:bg-blue-900/30 scale-105 border-2 border-dashed border-blue-400' : isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 shadow-md' : 'hover:bg-white/40 dark:hover:bg-slate-800/40 hover:scale-105 hover:shadow-lg'} animate-in fade-in duration-500`}>
                          
                          {isSelectMode && (
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white/50'}`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                          )}

                          {/* Settings quick action (admin/collab) */}
                          {(userRole === 'admin' || userRole === 'collab') && (
                            <button onClick={(e) => { e.stopPropagation(); openFolderSettings(folder) }} className="absolute top-2 left-2 p-1 rounded-lg bg-white/60 dark:bg-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Palette className="w-4 h-4 text-slate-600 dark:text-slate-200" />
                            </button>
                          )}

                          <div className="relative w-20 h-16 flex items-center justify-center">
                            <Folder
                              className="w-full h-full drop-shadow-[0_10px_15px_rgba(59,130,246,0.18)] transition-transform group-hover:scale-110"
                              strokeWidth={1.4}
                              fill="currentColor"
                              stroke="currentColor"
                              style={{ color: folderCustomizations[folder.id]?.color || '#3b82f6' }}
                            />
                          </div>
                          <p className={`font-black text-sm text-center ${isCompact ? 'text-[12px]' : ''} text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors line-clamp-2 px-1`}>{folderCustomizations[folder.id]?.icon ? <>{folderCustomizations[folder.id].icon} {highlightSearchText(folder.name, deferredSearchQuery)}</> : highlightSearchText(folder.name, deferredSearchQuery)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* LƯỚI TÀI LIỆU */}
              {displayDocuments.length > 0 && (
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2 drop-shadow-sm">Tài liệu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {displayDocuments.map(doc => {
                      const isSelected = selectedItems.some(i => i.id === doc.id);
                      const kind = getFileKind(doc.title || '')
                      return (
                        <div key={doc.id} 
                            draggable={!isSelectMode && (userRole === 'admin' || userRole === 'collab')}
                            onDragStart={(e) => handleDragStart(e, doc.id, 'document')}
                            onClick={(e) => {
                              if (isSelectMode) { 
                                e.preventDefault(); 
                                toggleSelection(doc.id, 'document', doc); 
                              } else { 
                                setPreviewDoc(doc); 
                              }
                            }} 
                            className={`backdrop-blur-md ${isCompact ? 'rounded-xl p-3' : 'rounded-[1.75rem] p-4'} transition-all duration-300 cursor-pointer group relative flex items-center gap-4 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 shadow-md transform scale-[1.02]' : 'bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-700 hover:-translate-y-2 hover:shadow-xl hover:scale-105'} animate-in fade-in duration-500`}>
                          
                          {isSelectMode && (
                            <div className={`absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white/50'}`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                          )}

                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                            {kind === 'image' && <Image className="w-6 h-6" />}
                            {kind === 'video' && <Video className="w-6 h-6" />}
                            {kind === 'audio' && <Music className="w-6 h-6" />}
                            {kind === 'pdf' && <FileText className="w-6 h-6" />}
                            {kind === 'other' && <FileText className="w-6 h-6" />}
                          </div>
                          <div className={`flex-1 overflow-hidden transition-all ${isSelectMode ? 'pr-8' : 'pr-2'}`}>
                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors text-sm leading-snug">{highlightSearchText(doc.title, deferredSearchQuery)}</h3>
                            <span className="text-[10px] font-bold text-slate-400 mt-1 block">{doc.folder_name ? `${doc.folder_name} • ` : ''}{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                          
                          {!isSelectMode && (
                            <span className="absolute right-4 text-blue-500 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-xs transition-all font-bold">
                              Đọc <Maximize2 className="w-3 h-3 ml-0.5" />
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Kết quả Đề thi khi tìm kiếm toàn cục */}
              {searchExamsResults && searchExamsResults.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2 drop-shadow-sm">Đề thi liên quan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchExamsResults.map((exam: any) => (
                      <div key={exam.id} onClick={() => router.push(`/exams/${exam.id}`)} className="cursor-pointer p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-700 hover:shadow-lg hover:-translate-y-1 transition-all">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{exam.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Loại: {exam.exam_type || 'Không rõ'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}