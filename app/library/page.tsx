'use client'

import { useDeferredValue, useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Folder, FileText, ArrowLeft, PlusCircle, Trash2, UploadCloud, Loader2, X, ChevronRight, 
  Download, BookOpen, Search, ListChecks, Scissors, Copy, ClipboardPaste, CheckCircle2, 
  Edit, ArrowUpDown, Maximize2, ExternalLink, Image, Video, Music, Palette, Lock, Unlock, 
  Eye, EyeOff, Cloud, Library, Home, Sparkles, Bot, Send
} from 'lucide-react'

// Imports hệ thống
import { glassSearchInputClass, highlightSearchText } from '@/app/components/searchUtils'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================
const glassCardStyles = "liquid-panel"
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all font-medium text-sm shadow-inner"
const headerBtn = "px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all backdrop-blur-md border border-white/60 dark:border-slate-700 bg-white/35 dark:bg-slate-800/55 text-slate-900 dark:text-white hover:bg-white/55 dark:hover:bg-slate-800/70 text-sm"

const STUDENT_UPLOAD_FOLDER_NAME = 'Student'
const LIBRARY_SCOPE_STORAGE_KEY = 'library_scope_v1'
const DOCUMENT_UNLOCK_STORAGE_KEY = 'library_document_unlocks_v1'
const DOCUMENT_SECURITY_PREFIX = '__SENEXAM_SECURITY__:'

type LibraryScope = 'private' | 'shared'
type SelectedItem = { id: string, type: 'folder' | 'document', data: any }
type DocumentSecurity = { hidden?: boolean, passwordHash?: string, passwordSalt?: string }
type AiMessage = { role: 'user' | 'model'; text: string; isError?: boolean }

export default function LibraryPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const router = useRouter()
  
  // STATES HỆ THỐNG
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('student')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [libraryScope, setLibraryScope] = useState<LibraryScope>('private')
  const [adminUploaderIds, setAdminUploaderIds] = useState<string[]>([])
  
  // STATES DỮ LIỆU
  const [folders, setFolders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [folderPath, setFolderPath] = useState<{id: string | null, name: string}[]>([{ id: null, name: 'Trang chủ Thư viện' }])
  const currentFolderId = folderPath[folderPath.length - 1].id
  
  // STATES TÌM KIẾM & UI
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [isCompact, setIsCompact] = useState(false)
  const [sortByName, setSortByName] = useState(false)
  
  // STATES BẢO MẬT & META
  const [folderCustomizations, setFolderCustomizations] = useState<Record<string, { color?: string, icon?: string }>>({})
  const [documentSecurity, setDocumentSecurity] = useState<Record<string, DocumentSecurity>>({})
  const [unlockedDocumentIds, setUnlockedDocumentIds] = useState<Record<string, true>>({})
  const [studentUploadFolderId, setStudentUploadFolderId] = useState<string | null>(null)
  
  // STATES VẬT LÝ & TƯƠNG TÁC
  const [previewDoc, setPreviewDoc] = useState<any | null>(null)
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [clipboard, setClipboard] = useState<{action: 'cut' | 'copy', items: SelectedItem[]} | null>(null)
  const [draggedItem, setDraggedItem] = useState<{id: string, type: 'folder' | 'document'} | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  
  // STATES MODAL
  const [showFolderModal, setShowFolderModal] = useState(false); const [newFolderName, setNewFolderName] = useState('')
  const [showDocModal, setShowDocModal] = useState(false); const [docTitle, setDocTitle] = useState(''); const [docFiles, setDocFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<{type: 'idle'|'uploading'|'success'|'error', message: string}>({ type: 'idle', message: '' })
  const [showRenameModal, setShowRenameModal] = useState(false); const [renameTarget, setRenameTarget] = useState<SelectedItem | null>(null); const [renameInput, setRenameInput] = useState('')
  
  // STATES AI & GLOBAL SEARCH
  const [isAiMode, setIsAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [isAiSearching, setIsAiSearching] = useState(false)
  const aiChatScrollRef = useRef<HTMLDivElement>(null)
  
  const [searchFoldersResults, setSearchFoldersResults] = useState<any[] | null>(null)
  const [searchDocsResults, setSearchDocsResults] = useState<any[] | null>(null)
  const [searchExamsResults, setSearchExamsResults] = useState<any[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  
  const previewRef = useRef<HTMLDivElement | null>(null)
  const searchDebounceRef = useRef<number | null>(null)
  const fetchContentsRequestRef = useRef(0)
  const studentFolderEnsureRef = useRef(false)

  // ============================================================================
  // CÁC HÀM TIỆN ÍCH & SECURITY
  // ============================================================================
  const isAdmin = userRole === 'admin'
  const canManageLibrary = userRole === 'admin' || userRole === 'collab'
  const isStudentLibrary = userRole === 'student'
  const showAdminControls = canManageLibrary || isStudentLibrary

  const hashPassword = async (password: string, salt: string) => {
    const encoded = new TextEncoder().encode(`${salt}:${password}`)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const getDocumentSecurity = (doc: any) => {
    if (documentSecurity[doc.id]) return documentSecurity[doc.id]
    if (!doc.description || !doc.description.startsWith(DOCUMENT_SECURITY_PREFIX)) return {}
    try { return JSON.parse(doc.description.slice(DOCUMENT_SECURITY_PREFIX.length)) } catch { return {} }
  }

  const isDocumentHidden = (doc: any) => !!getDocumentSecurity(doc)?.hidden
  const isDocumentLocked = (doc: any) => !!getDocumentSecurity(doc)?.passwordHash
  const isDocumentUnlocked = (doc: any) => isAdmin || !!unlockedDocumentIds[doc.id]

  const requestDocumentAccess = async (doc: any) => {
    if (isDocumentHidden(doc) && !isAdmin) { alert('Tài liệu này đang ẩn.'); return false }
    if (isDocumentLocked(doc) && !isDocumentUnlocked(doc)) {
      const password = window.prompt('Tài liệu bảo mật. Nhập mật khẩu:')
      if (!password) return false
      const sec = getDocumentSecurity(doc)
      if (!sec?.passwordHash || !sec.passwordSalt) return false
      if (await hashPassword(password, sec.passwordSalt) !== sec.passwordHash) { alert('Sai mật khẩu!'); return false }
      setUnlockedDocumentIds(p => { const n = {...p, [doc.id]: true}; try{sessionStorage.setItem(DOCUMENT_UNLOCK_STORAGE_KEY, JSON.stringify(n))}catch(e){}; return n })
    }
    return true
  }

  const ensureStudentUploadFolder = async (rootFolders: any[]) => {
    if (studentFolderEnsureRef.current) return studentUploadFolderId
    studentFolderEnsureRef.current = true
    const existing = rootFolders.find(f => (f.name === STUDENT_UPLOAD_FOLDER_NAME || f.name === 'Dành cho học sinh/Sinh viên chia sẻ') && f.created_by === currentUserId)
    if (existing?.id) { setStudentUploadFolderId(existing.id); return existing.id }
    try {
      const { data, error } = await supabase.from('library_folders').insert({ name: STUDENT_UPLOAD_FOLDER_NAME, created_by: currentUserId, parent_id: null }).select('id').single()
      if (!error && data?.id) { setStudentUploadFolderId(data.id); return data.id }
    } catch (e) {}
    return null
  }

  const isItemVisibleInScope = (item: any, itemKind: 'folder' | 'document', scope: LibraryScope, rootFolderId: string | null, userIdOverride?: string | null) => {
    if (!isStudentLibrary) return true
    const effectiveUserId = userIdOverride ?? currentUserId
    const ownedByCurrentUser = !!effectiveUserId && item?.created_by === effectiveUserId
    const isStudentRootContainer = itemKind === 'folder' && item?.id === studentUploadFolderId
    if (!effectiveUserId) return true
    if (scope === 'private') {
      if (rootFolderId === null) return isStudentRootContainer || ownedByCurrentUser
      return ownedByCurrentUser || isStudentRootContainer
    }
    if (rootFolderId === null) return !isStudentRootContainer && !ownedByCurrentUser
    return !ownedByCurrentUser && !isStudentRootContainer
  }

  // ============================================================================
  // LOGIC ĐỒNG BỘ DỮ LIỆU CHÍNH (ĐÃ KHÔI PHỤC)
  // ============================================================================
  const fetchContents = async (folderId: string | null, scopeOverride?: LibraryScope, userIdOverride?: string | null) => {
    const effectiveScope = scopeOverride || libraryScope
    const effectiveUserId = userIdOverride || currentUserId
    const requestId = ++fetchContentsRequestRef.current

    const folderQuery = supabase.from('library_folders').select('*').order('created_at', { ascending: false })
    if (folderId) folderQuery.eq('parent_id', folderId); else folderQuery.is('parent_id', null)

    const docQuery = supabase.from('library_documents').select('*').order('created_at', { ascending: false })
    if (folderId) docQuery.eq('folder_id', folderId); else docQuery.is('folder_id', null)

    const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])
    const fdata = folderRes.data || []
    const docsWithSecurity = (docRes.data || []).map((doc: any) => ({ ...doc, _security: getDocumentSecurity(doc) }))

    const visibleFolders = fdata.filter(folder => {
      if (isStudentLibrary) {
        if (effectiveScope === 'private') {
          if (folderId === null) return folder.id === studentUploadFolderId || (effectiveUserId && folder.created_by === effectiveUserId)
          return (effectiveUserId && folder.created_by === effectiveUserId) || folder.id === studentUploadFolderId
        }
        return (folder.created_by == null) || adminUploaderIds.includes(folder.created_by)
      }
      return true
    })

    const visibleDocs = docsWithSecurity.filter((doc: any) => {
      if (!(isAdmin || !doc._security?.hidden)) return false
      if (isStudentLibrary) {
        if (effectiveScope === 'private') return (doc.created_by === effectiveUserId) || (doc.folder_id === studentUploadFolderId)
        return (doc.created_by == null) || adminUploaderIds.includes(doc.created_by)
      }
      return true
    })

    if (requestId === fetchContentsRequestRef.current) {
      setFolders(visibleFolders); setDocuments(visibleDocs)
      try {
        const cMap: any = {}; visibleFolders.forEach(f => { if(f.color || f.icon) cMap[f.id] = {color: f.color, icon: f.icon} })
        if (Object.keys(cMap).length > 0) { setFolderCustomizations(cMap); localStorage.setItem('library_folder_customizations', JSON.stringify(cMap)) }
      } catch(e) {}
    }
    return { folders: visibleFolders, documents: visibleDocs }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentUserId(user.id); setUserRole(profile?.role || 'student')

      let initScope: LibraryScope = profile?.role === 'student' ? 'private' : 'shared'
      try { const s = localStorage.getItem(LIBRARY_SCOPE_STORAGE_KEY); if (profile?.role === 'student' && (s === 'private' || s === 'shared')) initScope = s as LibraryScope } catch(e) {}
      try { const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin','collab']); if (admins) setAdminUploaderIds(admins.map(a => a.id)) } catch(e) {}
      
      setLibraryScope(initScope)
      const rootData = await fetchContents(null, initScope, user.id)
      try { const r = sessionStorage.getItem(DOCUMENT_UNLOCK_STORAGE_KEY); if (r) setUnlockedDocumentIds(JSON.parse(r)) } catch(e) {}

      if (initScope === 'private' && !searchParams?.folder && !searchParams?.preview) {
        const targetId = await ensureStudentUploadFolder(rootData?.folders || [])
        if (targetId) { setFolderPath([{id: null, name: 'Sen Home'}, {id: targetId, name: rootData?.folders?.find((f:any)=>f.id===targetId)?.name || STUDENT_UPLOAD_FOLDER_NAME}]); await fetchContents(targetId, initScope, user.id) }
      }
      setLoading(false)
    }
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
    init()
  }, [router])

  // ============================================================================
  // TÌM KIẾM GLOBAL & SENAI SEARCH
  // ============================================================================
  const scoreRes = (txt: string, q: string) => { const s = txt.toLowerCase(); const n = q.toLowerCase().trim(); if(!n) return 0; if(s===n) return 100; if(s.startsWith(n)) return 80; if(s.includes(n)) return 60; return n.split(/\s+/).filter(w=>s.includes(w)).length * 10 }
  
  const globalSearch = async (q: string) => {
    if (!q.trim()) { setSearchFoldersResults(null); setSearchDocsResults(null); setSearchExamsResults(null); return }
    setSearchLoading(true)
    try {
      const [fRes, dRes, eRes] = await Promise.all([supabase.from('library_folders').select('*').limit(1000), supabase.from('library_documents').select('*').limit(1000), supabase.from('exams').select('*').limit(1000)])
      
      const sf = (fRes.data || []).filter((f:any) => isItemVisibleInScope(f, 'folder', libraryScope, null, currentUserId) && f.name.toLowerCase().includes(q.toLowerCase())).sort((a:any, b:any) => scoreRes(b.name, q) - scoreRes(a.name, q))
      const sd = (dRes.data || []).filter((d:any) => (isAdmin || !getDocumentSecurity(d)?.hidden) && isItemVisibleInScope(d, 'document', libraryScope, null, currentUserId) && d.title.toLowerCase().includes(q.toLowerCase())).sort((a:any, b:any) => scoreRes(b.title, q) - scoreRes(a.title, q))
      const se = (eRes.data || []).filter((e:any) => e.title.toLowerCase().includes(q.toLowerCase())).sort((a:any, b:any) => scoreRes(b.title, q) - scoreRes(a.title, q))
      
      setSearchFoldersResults(sf); setSearchDocsResults(sd); setSearchExamsResults(se)
    } catch(e) {}
    setSearchLoading(false)
  }

  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    if (!searchQuery || searchQuery.trim().length < 2) { setSearchFoldersResults(null); setSearchDocsResults(null); setSearchExamsResults(null); return }
    // @ts-ignore
    searchDebounceRef.current = window.setTimeout(() => globalSearch(searchQuery), 500)
    return () => clearTimeout(searchDebounceRef.current!)
  }, [searchQuery])

  useEffect(() => { if (aiChatScrollRef.current) aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight }, [aiMessages, isAiSearching])
  
  const handleAskSenAI = async (e: React.FormEvent) => {
    e.preventDefault(); const q = aiQuery.trim(); if (!q || isAiSearching) return;
    setAiQuery(''); setAiMessages(p => [...p, { role: 'user', text: q }]); setIsAiSearching(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Người dùng tìm: "${q}". Trích xuất 1 TỪ KHÓA chính để điền vào thanh tìm kiếm. Không giải thích.`, history: [] }) })
      const data = await res.json()
      if (data.text) {
        if (data.text.trim().length > 30) setAiMessages(p => [...p, { role: 'model', text: data.text.trim() }])
        else { setAiMessages(p => [...p, { role: 'model', text: `Mình đang lọc từ khóa **"${data.text.trim()}"** trên hệ thống nhé!` }]); setSearchQuery(data.text.trim().replace(/["']/g, '')) }
      }
    } catch (e) { setAiMessages(p => [...p, { role: 'model', text: 'Lỗi máy chủ AI.', isError: true }]) }
    setIsAiSearching(false)
  }

  // ============================================================================
  // CÁC HÀM TƯƠNG TÁC VẬT LÝ (CRUD, CLIPBOARD, DRAG & DROP)
  // ============================================================================
  const syncLibraryScope = async (next: LibraryScope) => { setLibraryScope(next); localStorage.setItem(LIBRARY_SCOPE_STORAGE_KEY, next); setSearchQuery(''); setSelectedItems([]); setIsSelectMode(false); setClipboard(null); setFolderPath([{id: null, name: 'Sen Home'}]); const r = await fetchContents(null, next); if (next === 'private') { const t = await ensureStudentUploadFolder(r.folders); if (t) { setFolderPath([{id:null, name:'Sen Home'}, {id:t, name:STUDENT_UPLOAD_FOLDER_NAME}]); fetchContents(t, next) } } }
  const handleOpenDocument = async (doc: any) => { const allowed = await requestDocumentAccess(doc); if (allowed) setPreviewDoc(doc) }
  const handleOpenFolder = async (id: string, name: string) => { setSearchQuery(''); setIsSelectMode(false); setSelectedItems([]); setFolderPath([...folderPath, { id, name }]); fetchContents(id) }
  const handleNavigateBreadcrumb = async (idx: number) => { setSearchQuery(''); setIsSelectMode(false); setSelectedItems([]); const np = folderPath.slice(0, idx + 1); setFolderPath(np); fetchContents(np[np.length - 1].id) }
  const handleCreateFolder = async () => { if (!newFolderName.trim()) return; const { error } = await supabase.from('library_folders').insert({ name: newFolderName, created_by: currentUserId, parent_id: currentFolderId }); if (!error) { setShowFolderModal(false); setNewFolderName(''); fetchContents(currentFolderId) } else alert("Lỗi: " + error.message) }
  const handleRename = async () => { if (!renameInput.trim() || !renameTarget) return; try { await supabase.from(renameTarget.type === 'folder' ? 'library_folders' : 'library_documents').update(renameTarget.type === 'folder' ? {name: renameInput.trim()} : {title: renameInput.trim()}).eq('id', renameTarget.id); setShowRenameModal(false); setIsSelectMode(false); setSelectedItems([]); fetchContents(currentFolderId) } catch (e) { alert("Lỗi đổi tên!") } }
  const toggleSelection = (id: string, type: 'folder' | 'document', data: any) => setSelectedItems(p => p.find(i => i.id === id) ? p.filter(i => i.id !== id) : [...p, { id, type, data }])
  const handleSetClipboard = (action: 'cut' | 'copy') => { setClipboard({ action, items: selectedItems }); setSelectedItems([]); setIsSelectMode(false) }
  const handlePaste = async () => {
    if (!clipboard) return; if (clipboard.action === 'cut' && clipboard.items.some(i => i.type === 'folder' && i.id === currentFolderId)) return alert("Lỗi Logic đệ quy!");
    setLoading(true); try {
      for (const item of clipboard.items) {
        if (clipboard.action === 'cut') await supabase.from(item.type === 'folder' ? 'library_folders' : 'library_documents').update(item.type === 'folder' ? {parent_id: currentFolderId} : {folder_id: currentFolderId}).eq('id', item.id)
        else await supabase.from(item.type === 'folder' ? 'library_folders' : 'library_documents').insert(item.type === 'folder' ? {name: item.data.name + ' (Sao)', parent_id: currentFolderId, created_by: currentUserId} : {title: item.data.title + ' (Sao)', drive_file_id: item.data.drive_file_id, folder_id: currentFolderId, created_by: currentUserId})
      }
      setClipboard(null); fetchContents(currentFolderId)
    } catch(e) { alert("Lỗi dán!") } setLoading(false)
  }
  const handleBulkDelete = async () => { if(!confirm(`Xóa ${selectedItems.length} mục?`)) return; setLoading(true); try { for (const item of selectedItems) await supabase.from(item.type === 'folder' ? 'library_folders' : 'library_documents').delete().eq('id', item.id); setSelectedItems([]); setIsSelectMode(false); fetchContents(currentFolderId) } catch(e){} setLoading(false) }

  const handleDragStart = (e: React.DragEvent, id: string, type: 'folder'|'document') => { if (!canManageLibrary) return; setDraggedItem({ id, type }); e.dataTransfer.effectAllowed = "move" }
  const handleDrop = async (e: React.DragEvent, targetId: string | null) => { e.preventDefault(); setDragOverId(null); if (!draggedItem || (draggedItem.type === 'folder' && draggedItem.id === targetId)) return; try { await supabase.from(draggedItem.type === 'document' ? 'library_documents' : 'library_folders').update(draggedItem.type === 'document' ? {folder_id: targetId} : {parent_id: targetId}).eq('id', draggedItem.id); fetchContents(currentFolderId) } catch(err){} setDraggedItem(null) }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault(); if (docFiles.length === 0) return
    try {
      setUploadStatus({ type: 'uploading', message: `Xử lý ${docFiles.length} tài liệu...` }); 
      let uFolder = currentFolderId
      if (libraryScope === 'private' && isStudentLibrary && !uFolder) {
        uFolder = studentUploadFolderId || await ensureStudentUploadFolder(folders)
      }
      if (libraryScope === 'private' && !uFolder) throw new Error('Chưa xác định được thư mục đích để tải lên.')

      for (let i = 0; i < docFiles.length; i++) {
        const f = docFiles[i]; const t = (docFiles.length === 1 && docTitle) ? docTitle : f.name
        setUploadStatus({ type: 'uploading', message: `[${i+1}/${docFiles.length}] Up Google Drive...` })
        
        const url = await initGoogleDriveUpload(t, f.type)
        const d = await uploadFileToGoogleDrive(url, f, t)
        
        if (!d?.id) throw new Error('Lỗi Drive')
        await supabase.from('library_documents').insert({ folder_id: uFolder, title: t, drive_file_id: d.id, created_by: libraryScope==='shared' ? null : currentUserId })
      }
      setUploadStatus({ type: 'success', message: 'Thành công!' }); setDocTitle(''); setDocFiles([]); 
      setTimeout(() => { setShowDocModal(false); setUploadStatus({type:'idle', message:''}) }, 1500); 
      fetchContents(currentFolderId)
    } catch (e: any) { setUploadStatus({ type: 'error', message: e.message }) }
  }

  // Tiện ích UI
  const getFileKind = (t: string) => t.match(/\.(mp4|mov|webm)$/i) ? 'video' : t.match(/\.(mp3|wav)$/i) ? 'audio' : t.match(/\.(png|jpg|jpeg)$/i) ? 'image' : t.match(/\.pdf$/i) ? 'pdf' : 'other'
  let dFolders = searchFoldersResults || folders.filter(f => f.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
  let dDocs = searchDocsResults || documents.filter(d => d.title.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
  if (sortByName) { dFolders.sort((a,b)=>a.name.localeCompare(b.name)); dDocs.sort((a,b)=>a.title.localeCompare(b.title)) }
  const pUrls = useMemo(() => previewDoc ? { preview: `/api/drive/stream?fileId=${previewDoc.drive_file_id}`, download: `/api/drive/stream?fileId=${previewDoc.drive_file_id}&download=1`, open: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/view` } : {preview:'', download:'', open:''}, [previewDoc])

  // ============================================================================
  // RENDER GIAO DIỆN CHÍNH
  // ============================================================================
  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]"><Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" /><p className="font-bold text-slate-500">Đang khởi tạo thư viện...</p></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-32 transition-colors duration-500">
      
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/5 dark:from-indigo-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 🌟 MODALS QUAN TRỌNG */}
      {previewDoc && (
        <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-3 md:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-[#121212] w-full max-w-5xl h-[90vh] rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="h-16 px-4 bg-slate-50/80 dark:bg-[#1A1A1A]/80 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 truncate"><FileText className="w-5 h-5 text-indigo-500 shrink-0" /><h3 className="font-extrabold text-sm truncate">{previewDoc.title}</h3></div>
              <div className="flex gap-2">
                <a href={pUrls.download} className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 rounded-xl font-bold text-xs flex items-center gap-1"><Download className="w-4 h-4"/>Tải</a>
                <a href={pUrls.open} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 dark:bg-[#202020] rounded-xl font-bold text-xs flex items-center gap-1"><ExternalLink className="w-4 h-4"/>Mở Drive</a>
                <button onClick={() => setPreviewDoc(null)} className="p-2 bg-rose-50 text-rose-500 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div ref={previewRef} className="flex-1 bg-slate-100/50 dark:bg-[#0A0A0A] flex items-center justify-center relative">
              {getFileKind(previewDoc.title)==='pdf' ? <iframe src={pUrls.preview} className="absolute inset-0 w-full h-full border-none"/> : getFileKind(previewDoc.title)==='image' ? <img src={pUrls.download} className="max-h-[86vh] max-w-full object-contain"/> : <iframe src={pUrls.preview} className="absolute inset-0 w-full h-full border-none"/>}
            </div>
          </div>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"><div className={`${mdCard} w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95`}><button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#202020]"><X className="w-5 h-5"/></button><div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4"><Folder className="w-6 h-6 text-blue-500"/></div><h3 className="text-xl font-black mb-2">Tạo thư mục</h3><input type="text" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} className={`${mdInput} mb-6`} placeholder="Tên..." /><button onClick={handleCreateFolder} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md">Tạo mới</button></div></div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"><div className={`${mdCard} w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95`}><button onClick={() => {setShowDocModal(false); setDocFiles([])}} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#202020]"><X className="w-5 h-5"/></button><div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-emerald-500"/></div><h3 className="text-xl font-black mb-4">Tải tài liệu lên</h3><form onSubmit={handleUploadDocument} className="space-y-4"><input type="text" value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="Tên file hiển thị (nếu tải 1 file)..." className={mdInput} /><div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl p-6 text-center relative hover:bg-slate-50 dark:hover:bg-[#202020] cursor-pointer"><input type="file" multiple onChange={e=>setDocFiles(Array.from(e.target.files||[]))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" /><p className="font-bold text-sm text-slate-500">{docFiles.length > 0 ? `Đã chọn ${docFiles.length} file` : 'Kéo thả hoặc nhấn để chọn file'}</p></div>{uploadStatus.type!=='idle' && <div className="text-xs font-bold text-blue-500">{uploadStatus.message}</div>}<button type="submit" disabled={uploadStatus.type==='uploading'} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md">{uploadStatus.type==='uploading' ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'Bắt đầu tải'}</button></form></div></div>
      )}

      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"><div className={`${mdCard} w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95`}><button onClick={() => setShowRenameModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#202020]"><X className="w-5 h-5"/></button><div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center mb-4"><Edit className="w-6 h-6 text-amber-500"/></div><h3 className="text-xl font-black mb-2">Đổi tên</h3><input type="text" value={renameInput} onChange={e=>setRenameInput(e.target.value)} className={`${mdInput} mb-6`} /><button onClick={handleRename} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-md">Lưu Tên Mới</button></div></div>
      )}

      {/* 🌟 FLOATING BARS (Thao tác nhóm) */}
      {isSelectMode && selectedItems.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[90] animate-in slide-in-from-bottom-10"><span className="font-extrabold text-sm mr-2 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-[#252525] px-3 py-1.5 rounded-lg">{selectedItems.length} mục</span><button onClick={handleBulkDelete} className="flex gap-2 bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-100"><Trash2 className="w-4 h-4"/> Xóa</button><button onClick={()=>handleSetClipboard('cut')} className="flex gap-2 bg-slate-100 dark:bg-[#202020] px-4 py-2.5 rounded-xl font-bold text-sm"><Scissors className="w-4 h-4"/> Cắt</button><button onClick={()=>handleSetClipboard('copy')} className="flex gap-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100"><Copy className="w-4 h-4"/> Copy</button></div>
      )}
      {clipboard && !isSelectMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-2xl border border-indigo-400/50 px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 z-[90] animate-bounce"><span className="font-extrabold text-sm text-indigo-600">Đang giữ {clipboard.items.length} mục</span><button onClick={handlePaste} className="flex gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:scale-105"><ClipboardPaste className="w-4 h-4"/> Dán</button><button onClick={()=>setClipboard(null)} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-xl hover:bg-rose-100 text-rose-500"><X className="w-4 h-4"/></button></div>
      )}

      {/* 🌟 KẾT CẤU WORKSPACE CHÍNH */}
      <div className="relative z-10 max-w-[1500px] mx-auto pt-6 px-4 md:px-8">
        
        {/* Header Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
          <div className="flex-1">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-3"><ArrowLeft className="w-4 h-4" /> Dashboard</button>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3 mb-4 text-slate-900 dark:text-white">{libraryScope === 'private' ? 'SenCloud' : 'SenLib'} <Cloud className="w-8 h-8 text-cyan-500" /></h1>
            <div className="flex items-center flex-wrap gap-2 text-sm font-bold bg-white/60 dark:bg-[#1A1A1A]/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-white/5 w-fit shadow-sm">
              {folderPath.map((step, index) => (
                <div key={index} className="flex items-center gap-2" onDragOver={(e) => { e.preventDefault(); setDragOverId(step.id || 'root') }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => handleDrop(e, step.id)}>
                  <span onClick={() => handleNavigateBreadcrumb(index)} className={`cursor-pointer px-2 py-1 rounded-lg transition-colors ${dragOverId === (step.id || 'root') ? 'bg-indigo-100 text-indigo-700' : index === folderPath.length - 1 ? 'text-indigo-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-[#252525]'}`}>{step.name}</span>
                  {index < folderPath.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center">
            {/* Thanh Tìm kiếm Vật lý */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tài liệu..." className={`${mdInput} pl-10`} />
            </div>

            {/* Nút SenAI */}
            <button onClick={() => setIsAiMode(!isAiMode)} className={`${headerBtn} ${isAiMode ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : ''}`}><Sparkles className={`w-4 h-4 ${isAiMode ? 'animate-pulse' : 'text-yellow-500'}`} /> SenAI Search</button>

            {isStudentLibrary && <button onClick={() => syncLibraryScope(libraryScope === 'private' ? 'shared' : 'private')} className={headerBtn}>{libraryScope === 'private' ? <Unlock className="w-4 h-4 text-emerald-500"/> : <Lock className="w-4 h-4 text-cyan-500"/>} {libraryScope === 'private' ? 'SenLib' : 'SenCloud'}</button>}
            
            {showAdminControls && (
              <>
                <button onClick={() => setSortByName(!sortByName)} className={headerBtn}><ArrowUpDown className="w-4 h-4" /> {sortByName ? 'Xếp A-Z' : 'Xếp Ngày'}</button>
                <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedItems([]); setClipboard(null); }} className={headerBtn}><ListChecks className="w-4 h-4" /> Chọn</button>
                <button onClick={() => setShowFolderModal(true)} className={headerBtn}><PlusCircle className="w-4 h-4 text-blue-500" /> Thư Mục</button>
                {/* 🌟 FIX BUGS MÀU NÚT "TẢI LÊN" LÀ Ở ĐÂY NÀY SẾP 🌟 */}
                <button onClick={() => setShowDocModal(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" /> Tải Lên
                </button>
              </>
            )}
          </div>
        </div>

        {/* 🌟 WIDGET SENAI SMART SEARCH */}
        {isAiMode && (
          <div className="mb-8 bg-white dark:bg-[#161616] rounded-[2rem] border border-indigo-200 dark:border-indigo-500/30 shadow-xl overflow-hidden animate-in fade-in flex flex-col h-[350px]">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-blue-500"></div>
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1A1A1A]/50"><div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Bot className="w-5 h-5 text-indigo-600"/></div><div><h4 className="font-black text-sm text-slate-900 dark:text-white">SenAI Assistant</h4><p className="text-[10px] font-bold text-slate-500 uppercase">Trợ lý tìm kiếm</p></div></div>
            <div ref={aiChatScrollRef} className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5 bg-white dark:bg-[#161616]">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3 mt-1"><Bot className="w-4 h-4"/></div>}
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-[13px] font-medium shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : msg.isError ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 dark:bg-[#202020] rounded-bl-sm border border-slate-100 dark:border-white/5'}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}: any) => <p className="m-0" {...props} />, strong: ({node, ...props}: any) => <strong className="font-black text-indigo-600 dark:text-indigo-400" {...props} /> }}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAiSearching && <div className="flex items-center gap-3"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin"/><div className="text-[12px] text-slate-500 font-bold italic">SenAI đang suy nghĩ...</div></div>}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#1A1A1A]">
              <form onSubmit={handleAskSenAI} className="relative flex items-center">
                <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Nhập yêu cầu tìm kiếm tự nhiên..." className={`${mdInput} pr-14 rounded-full`} />
                <button type="submit" disabled={!aiQuery.trim() || isAiSearching} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-full"><Send className="w-4 h-4 ml-0.5" /></button>
              </form>
            </div>
          </div>
        )}

        {/* 🌟 LƯỚI HIỂN THỊ DỮ LIỆU */}
        <div className={`${mdCard} p-6 md:p-8 min-h-[50vh]`}>
          {dFolders.length === 0 && dDocs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 pt-10"><Folder className="w-20 h-20 mb-4 stroke-[1]" /><p className="font-black text-xl mb-2">Chưa có dữ liệu</p></div>
          ) : (
            <>
              {dFolders.length > 0 && (
                <div className="mb-10 animate-in fade-in">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5 flex gap-2"><Folder className="w-4 h-4"/> Thư mục</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {dFolders.map(f => {
                      const sel = selectedItems.some(i => i.id === f.id);
                      return (
                        <div key={f.id} draggable={!isSelectMode && showAdminControls} onDragStart={(e) => handleDragStart(e, f.id, 'folder')} onDragOver={(e) => { if (!isSelectMode) { e.preventDefault(); setDragOverId(f.id); } }} onDragLeave={() => setDragOverId(null)} onDrop={(e) => { if (!isSelectMode) handleDrop(e, f.id); }} onClick={(e) => { if (isSelectMode) { e.preventDefault(); toggleSelection(f.id, 'folder', f); } else { handleOpenFolder(f.id, f.name); } }} 
                          className={`group cursor-pointer flex flex-col items-center justify-center gap-3 relative p-5 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-[2rem] transition-all duration-300 ${dragOverId === f.id ? 'ring-2 ring-indigo-500 scale-105' : sel ? 'ring-2 ring-blue-500 shadow-md bg-blue-50 dark:bg-blue-900/20' : 'hover:-translate-y-1 hover:shadow-lg'}`}>
                          {isSelectMode && <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>{sel && <CheckCircle2 className="w-3 h-3" />}</div>}
                          <Folder className="w-16 h-16 transition-transform group-hover:scale-110" strokeWidth={1.5} fill="currentColor" style={{ color: '#6366f1' }} />
                          <p className="font-black text-[13px] text-center line-clamp-2 px-2 leading-tight">{highlightSearchText(f.name, deferredSearchQuery)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {dDocs.length > 0 && (
                <div className="animate-in fade-in">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5 flex gap-2"><FileText className="w-4 h-4"/> Tài liệu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {dDocs.map(d => {
                      const sel = selectedItems.some(i => i.id === d.id); const k = getFileKind(d.title || '')
                      return (
                        <div key={d.id} draggable={!isSelectMode && showAdminControls} onDragStart={(e) => handleDragStart(e, d.id, 'document')} onClick={(e) => { if (isSelectMode) { e.preventDefault(); toggleSelection(d.id, 'document', d); } else { handleOpenDocument(d); } }} 
                          className={`group cursor-pointer flex items-center gap-4 relative p-4 bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-[1.5rem] transition-all duration-300 ${sel ? 'ring-2 ring-blue-500 shadow-md bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : 'hover:-translate-y-1 hover:shadow-lg'}`}>
                          {isSelectMode && <div className={`absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>{sel && <CheckCircle2 className="w-3 h-3" />}</div>}
                          <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-inner ${sel ? 'bg-blue-100 text-blue-600' : 'bg-rose-50 text-rose-500'}`}>
                            {k === 'pdf' ? <FileText className="w-6 h-6"/> : k === 'image' ? <Image className="w-6 h-6"/> : <FileText className="w-6 h-6"/>}
                          </div>
                          <div className={`flex-1 min-w-0 ${isSelectMode ? 'pr-8' : 'pr-2'}`}>
                            <h3 className="font-black text-[13px] line-clamp-2 leading-snug">{highlightSearchText(d.title, deferredSearchQuery)}</h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(d.created_at).toLocaleDateString('vi-VN')}</p>
                          </div>
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
    </div>
  )
}