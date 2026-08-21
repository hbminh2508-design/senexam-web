'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Crown,
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

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

const canSeeItem = (createdBy: string | null, role: string, userId: string) => {
  if (role === 'admin' || role === 'collab') return true
  return createdBy === null || createdBy === userId
}

export default function LibraryNewClient({ slugSegments }: { slugSegments: string[] }) {
  const router = useRouter()
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [role, setRole] = useState<'student' | 'admin' | 'collab'>('student')
  const [userId, setUserId] = useState<string | null>(null)
  const [isVip, setIsVip] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: null, name: 'Lib New', segment: null }])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [pathError, setPathError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null)

  const canManage = role === 'admin' || role === 'collab'

  const fetchContents = async (folderId: string | null, nextRole: string, nextUserId: string, nextVip: boolean) => {
    const folderQuery = supabase.from('library_folders').select('id,name,parent_id,created_by,created_at').order('name', { ascending: true })
    const docQuery = supabase.from('library_documents').select('id,title,drive_file_id,folder_id,created_by,created_at,is_vip_only,description').order('title', { ascending: true })

    if (folderId) {
      folderQuery.eq('parent_id', folderId)
      docQuery.eq('folder_id', folderId)
    } else {
      folderQuery.is('parent_id', null)
      docQuery.is('folder_id', null)
    }

    const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])
    const rawFolders = (folderRes.data || []) as FolderRow[]
    const rawDocs = (docRes.data || []) as DocRow[]

    const filteredFolders = rawFolders.filter((f) => canSeeItem(f.created_by, nextRole, nextUserId))
    const filteredDocs = rawDocs
      .filter((d) => canSeeItem(d.created_by, nextRole, nextUserId))
      .filter((d) => (nextRole === 'admin' || nextRole === 'collab') ? true : !isHiddenDocument(d))
      .filter((d) => (d.is_vip_only ? nextVip : true))

    setFolders(filteredFolders)
    setDocuments(filteredDocs)
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

      const nextRole = (profile.role || 'student') as 'student' | 'admin' | 'collab'
      const nextVip = !!profile.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now()

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token || null

      const baseCrumbs: Crumb[] = [{ id: null, name: 'Lib New', segment: null }]
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
          if (!canSeeItem(folder.created_by, nextRole, user.id)) throw new Error('access-denied')

          parentId = folder.id
          baseCrumbs.push({ id: folder.id, name: folder.name, segment: folderSegment(folder.name, folder.id) })
        }

        if (cancelled) return
        setUserId(user.id)
        setRole(nextRole)
        setIsVip(nextVip)
        setAccessToken(token)
        setIsBetaTester(true)
        setBreadcrumbs(baseCrumbs)
        setCurrentFolderId(parentId)
        setPathError(null)
        await fetchContents(parentId, nextRole, user.id, nextVip)
      } catch {
        if (!cancelled) {
          setPathError('Không tìm thấy thư mục theo đường dẫn hiện tại hoặc bạn không có quyền truy cập.')
          setFolders([])
          setDocuments([])
          setBreadcrumbs([{ id: null, name: 'Lib New', segment: null }])
          setCurrentFolderId(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [router, slugSegments.join('/')])

  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.name.toLowerCase().includes(q))
  }, [folders, searchQuery])

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return documents
    return documents.filter((d) => d.title.toLowerCase().includes(q))
  }, [documents, searchQuery])

  const previewUrls = useMemo(() => {
    if (!previewDoc) return { preview: '', open: '' }
    const vipParams = previewDoc.is_vip_only ? `&documentId=${previewDoc.id}&token=${encodeURIComponent(accessToken || '')}` : ''
    return {
      preview: `/api/drive/stream?fileId=${previewDoc.drive_file_id}${vipParams}`,
      open: `https://drive.google.com/file/d/${previewDoc.drive_file_id}/view`,
    }
  }, [previewDoc, accessToken])

  const pushFolder = (folder: FolderRow) => {
    const next = folderSegment(folder.name, folder.id)
    const nextPath = slugSegments.length > 0 ? `/lib-new/${[...slugSegments, next].join('/')}` : `/lib-new/${next}`
    router.push(nextPath)
  }

  const pushBreadcrumb = (index: number) => {
    if (index <= 0) {
      router.push('/lib-new')
      return
    }
    const next = breadcrumbs.slice(1, index + 1).map((c) => c.segment!).join('/')
    router.push(`/lib-new/${next}`)
  }

  if (loading) {
    return newUiEnabled
      ? <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải thư viện mới..." />
      : <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  if (!isBetaTester) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#141414] p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-black mb-2">Lib New đang ở kênh Beta</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Trang này chỉ mở cho tài khoản đã tham gia chương trình Beta.</p>
          <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold">Quay về Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen font-sans pb-20"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={newUiEnabled ? ({ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties) : undefined}
    >
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="h-14 px-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm truncate">{previewDoc.title}</h3>
              <div className="flex items-center gap-2">
                <a href={previewUrls.open} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#202020] inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Mở Drive</a>
                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202020]"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <iframe src={previewUrls.preview} className="w-full h-full border-none" />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.push('/dashboard')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] p-6 mb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight inline-flex items-center gap-2">
                <Cloud className="w-6 h-6 text-sky-500" /> Lib New
                <span className="text-[10px] px-2 py-1 rounded-md uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Beta</span>
              </h1>
              <div className="mt-3 flex items-center flex-wrap gap-2 text-xs font-semibold text-slate-500">
                {breadcrumbs.map((crumb, idx) => (
                  <div key={`${crumb.id || 'root'}-${idx}`} className="inline-flex items-center gap-2">
                    <button onClick={() => pushBreadcrumb(idx)} className={`px-2 py-1 rounded-md ${idx === breadcrumbs.length - 1 ? 'text-indigo-600 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-[#202020]'}`}>
                      {crumb.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm thư mục hoặc tài liệu..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#101010] pl-9 pr-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {pathError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-4 text-sm text-rose-700 dark:text-rose-300">{pathError}</div>
        ) : (
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#151515] p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-7">
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => pushFolder(folder)}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1B1B1B] p-4 text-center hover:-translate-y-0.5 transition-transform"
                >
                  <Folder className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
                  <div className="text-xs font-bold line-clamp-2">{folder.name}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setPreviewDoc(doc)}
                  className="w-full text-left rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1B1B1B] px-4 py-3 hover:bg-slate-100 dark:hover:bg-[#212121] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate inline-flex items-center gap-1.5">
                      {doc.is_vip_only && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      {doc.title}
                    </p>
                    <p className="text-[11px] text-slate-500">{new Date(doc.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>

            {filteredFolders.length === 0 && filteredDocs.length === 0 && (
              <div className="py-14 text-center text-slate-500">
                <Folder className="w-9 h-9 mx-auto mb-2" />
                <p className="text-sm font-semibold">Không có dữ liệu trong thư mục này.</p>
              </div>
            )}

            {canManage && currentFolderId === null && (
              <p className="mt-5 text-xs text-slate-500">Bạn có thể tiếp tục quản trị chi tiết ở thư viện cũ nếu cần thao tác hàng loạt nâng cao.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
