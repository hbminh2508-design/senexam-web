'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import {
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  LogOut,
  Upload,
  Image as ImageIcon,
  Video,
  BookOpen,
  CheckCircle2,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react'

// Helper: Format Google Drive & other image URLs for direct embedding
export function formatImageUrl(url?: string): string {
  if (!url) return ''
  const trimmed = url.trim()

  // 1. Data URLs & Blob URLs are returned as-is
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }

  // 2. Google Drive URLs
  if (trimmed.includes('drive.google.com')) {
    const match =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
      const fileId = match[1]
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
    }
  }

  return trimmed
}

// Helper: Client-side Image Compressor to avoid upload limits and ensure 100% display reliability
export function compressImageFile(file: File, maxWidth = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string) || '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let { width, height } = img

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve((e.target?.result as string) || '')
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        } catch {
          resolve((e.target?.result as string) || '')
        }
      }
      img.onerror = () => resolve((e.target?.result as string) || '')
      img.src = (e.target?.result as string) || ''
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

// Component: Safe Image with automatic Google Drive fallback and error suppression
function SafeImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [currentSrc, setCurrentSrc] = useState(() => formatImageUrl(src))
  const [hasError, setHasError] = useState(false)
  const [retryStage, setRetryStage] = useState(0)

  useEffect(() => {
    setCurrentSrc(formatImageUrl(src))
    setHasError(false)
    setRetryStage(0)
  }, [src])

  const handleError = () => {
    if (src.includes('drive.google.com') && retryStage === 0) {
      const match =
        src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        src.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        src.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        setRetryStage(1)
        setCurrentSrc(`https://lh3.googleusercontent.com/d/${match[1]}`)
        return
      }
    } else if (src.includes('drive.google.com') && retryStage === 1) {
      const match =
        src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        src.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        src.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        setRetryStage(2)
        setCurrentSrc(`https://drive.google.com/uc?export=view&id=${match[1]}`)
        return
      }
    }

    setHasError(true)
  }

  if (hasError || !currentSrc) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-xl text-slate-400 border border-slate-200">
        <ImageIcon className="h-8 w-8 text-slate-300 mb-1" />
        <span className="text-xs font-semibold text-slate-600">{alt}</span>
        {src.includes('drive.google.com') && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-[11px] text-sky-600 hover:underline inline-flex items-center gap-1 font-bold"
          >
            <span>Mở ảnh Google Drive</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  )
}

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export interface FepnRecapPost {
  id: string
  year: string
  title: string
  cover_image?: string
  content: string
  media_items?: Record<string, string> // e.g. { "{AnhTieuDe}": "https...", "{AnhDangBai}": "https..." }
  author_id?: string
  author_name?: string
  created_at?: string
  updated_at?: string
}

export default function FepnRecapPage() {
  const router = useRouter()
  const themeVars = useMemo(() => getModernThemeVars('indigo', false), [])

  // Auth State
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')

  // Recap Posts State
  const [posts, setPosts] = useState<FepnRecapPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [selectedPost, setSelectedPost] = useState<FepnRecapPost | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Split view state
  const [leftWidth, setLeftWidth] = useState<number>(38) // Percentage of left column
  const [isDragging, setIsDragging] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Admin Modal State
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [modalYear, setModalYear] = useState<string>(new Date().getFullYear().toString())
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')
  const [modalMediaItems, setModalMediaItems] = useState<Record<string, string>>({})
  const [modalCoverImage, setModalCoverImage] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [batchUploading, setBatchUploading] = useState(false)

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // 1. Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const currentUser = authData?.user

        if (!currentUser) {
          setAuthStatus('unauthenticated')
          setAuthLoading(false)
          return
        }

        setUser(currentUser)

        let role = 'student'
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profile?.role) {
          role = profile.role
          setUserRole(profile.role)
        }

        const email = currentUser.email?.toLowerCase() || ''
        const isVnu = email.endsWith('@vnu.edu.vn')
        const isAdmin = role === 'admin'

        if (isVnu || isAdmin) {
          setAuthStatus('authorized')
          await loadPosts()
        } else {
          setAuthStatus('restricted')
        }
      } catch (err) {
        console.error('Lỗi kiểm tra quyền truy cập:', err)
        setAuthStatus('restricted')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [])

  // 2. Load posts from Supabase
  const loadPosts = async () => {
    setLoadingPosts(true)
    try {
      const { data, error } = await supabase
        .from('fepn_recap_posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPosts(data)
        if (data.length > 0 && !selectedPost) {
          setSelectedPost(data[0])
        }
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Lỗi tải bài viết Recap:', err)
      setPosts([])
    } finally {
      setLoadingPosts(false)
    }
  }

  // 3. Resizable Column Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !splitContainerRef.current) return
      const containerRect = splitContainerRef.current.getBoundingClientRect()
      const newPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100
      const clamped = Math.min(Math.max(newPercentage, 25), 70)
      setLeftWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // 4. Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/fepn-login')
  }

  const isAdmin = userRole === 'admin'

  // Extract all distinct cohort years from posts
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    posts.forEach((p) => {
      if (p.year) years.add(p.year)
    })
    // Add recent default years
    ;['2025', '2024', '2023', '2022', '2021', '2020'].forEach((y) => years.add(y))
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [posts])

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchYear = selectedYear === 'all' || p.year === selectedYear
      const matchSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.author_name && p.author_name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchYear && matchSearch
    })
  }, [posts, selectedYear, searchQuery])

  // Detect media tags in modalContent dynamically
  // Matches {AnhTieuDe}, {AnhDangBai}, {AnhDangBai1}, {AnhDangBai2}, {VideoDangBai}, {VideoDangBai1}, etc.
  const detectedMediaTags = useMemo(() => {
    const tags: string[] = []
    const regex = /\{(AnhTieuDe|AnhDangBai\d*|VideoDangBai\d*)\}/g
    let match
    while ((match = regex.exec(modalContent)) !== null) {
      if (!tags.includes(match[0])) {
        tags.push(match[0])
      }
    }
    return tags
  }, [modalContent])

  // Insert syntax into modalContent at end
  const insertSyntax = (textToInsert: string) => {
    setModalContent((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + textToInsert + '\n')
  }

  // Insert next indexed {AnhDangBai + Số} tag (VD: {AnhDangBai1}, {AnhDangBai2}...)
  const handleInsertNextImageTag = () => {
    const matches = modalContent.match(/\{AnhDangBai(\d+)\}/g) || []
    let nextIndex = 1
    if (matches.length > 0) {
      const numbers = matches
        .map((m) => parseInt(m.replace(/[^0-9]/g, ''), 10))
        .filter((n) => !isNaN(n))
      if (numbers.length > 0) {
        nextIndex = Math.max(...numbers) + 1
      }
    } else if (modalContent.includes('{AnhDangBai}')) {
      nextIndex = 2
    }
    insertSyntax(`{AnhDangBai${nextIndex}}`)
  }

  // Insert next indexed {VideoDangBai + Số} tag (VD: {VideoDangBai1}, {VideoDangBai2}...)
  const handleInsertNextVideoTag = () => {
    const matches = modalContent.match(/\{VideoDangBai(\d+)\}/g) || []
    let nextIndex = 1
    if (matches.length > 0) {
      const numbers = matches
        .map((m) => parseInt(m.replace(/[^0-9]/g, ''), 10))
        .filter((n) => !isNaN(n))
      if (numbers.length > 0) {
        nextIndex = Math.max(...numbers) + 1
      }
    } else if (modalContent.includes('{VideoDangBai}')) {
      nextIndex = 2
    }
    insertSyntax(`{VideoDangBai${nextIndex}}`)
  }

  // Upload multiple images at once and generate {AnhDangBai1}, {AnhDangBai2}, ... AT THE VERY BOTTOM
  const handleBatchImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setBatchUploading(true)
    try {
      const matches = modalContent.match(/\{AnhDangBai(\d+)\}/g) || []
      let nextIndex = 1
      if (matches.length > 0) {
        const numbers = matches
          .map((m) => parseInt(m.replace(/[^0-9]/g, ''), 10))
          .filter((n) => !isNaN(n))
        if (numbers.length > 0) {
          nextIndex = Math.max(...numbers) + 1
        }
      } else if (modalContent.includes('{AnhDangBai}')) {
        nextIndex = 2
      }

      const newTags: string[] = []
      const newMediaMap: Record<string, string> = {}

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const currentIndex = nextIndex + i
        const tag = `{AnhDangBai${currentIndex}}`
        newTags.push(tag)

        // Nén ảnh client-side thành Data URL sắc nét, dung lượng tối ưu, tải tức thì không bao giờ lỗi
        const dataUrl = await compressImageFile(file)
        if (dataUrl) {
          newMediaMap[tag] = dataUrl
        }
      }

      // Tự động gán ảnh đầu tiên làm {AnhTieuDe} nếu chưa có ảnh tiêu đề
      if (!modalMediaItems['{AnhTieuDe}'] && !modalCoverImage && files.length > 0 && newMediaMap[newTags[0]]) {
        newMediaMap['{AnhTieuDe}'] = newMediaMap[newTags[0]]
        setModalCoverImage(newMediaMap[newTags[0]])
      }

      setModalMediaItems((prev) => ({ ...prev, ...newMediaMap }))

      // Tự động chèn các mã {AnhDangBaiSo} Ở DƯỚI CÙNG của nội dung bài viết
      const tagsBlock = newTags.join('\n\n')
      setModalContent((prev) => {
        const trimmed = prev.trimEnd()
        return trimmed ? `${trimmed}\n\n${tagsBlock}\n` : `${tagsBlock}\n`
      })

      alert(`🎉 Đã tải lên thành công ${files.length} ảnh! Các mã ${newTags.join(', ')} đã được thêm vào DƯỚI CÙNG của bài viết.`)
    } catch (err: any) {
      alert('Lỗi tải nhiều ảnh: ' + err.message)
    } finally {
      setBatchUploading(false)
      e.target.value = ''
    }
  }

  // Upload or set media for a tag
  const handleMediaUpload = async (tag: string, file: File) => {
    setUploadingSlot(tag)
    try {
      let finalUrl = ''

      // Nếu là ảnh: Nén trực tiếp thành Data URL chất lượng cao - 100% hiển thị không bao giờ bị lỗi
      if (file.type.startsWith('image/')) {
        finalUrl = await compressImageFile(file)
      } else {
        // Nếu là video: Tải lên Google Drive
        try {
          const uploadUrl = await initGoogleDriveUpload(file.name, file.type || 'application/octet-stream')
          const uploaded: any = await uploadFileToGoogleDrive(uploadUrl, file, file.name)
          const fileId = typeof uploaded === 'string' ? uploaded : uploaded?.id
          finalUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
        } catch (gdErr) {
          console.warn('Lỗi tải video lên Google Drive:', gdErr)
        }
      }

      if (!finalUrl) {
        throw new Error('Không thể xử lý tệp. Vui lòng thử lại hoặc dán trực tiếp link.')
      }

      setModalMediaItems((prev) => ({ ...prev, [tag]: finalUrl }))
      if (tag === '{AnhTieuDe}') {
        setModalCoverImage(finalUrl)
      }
    } catch (err: any) {
      alert('Lỗi tải tệp: ' + err.message)
    } finally {
      setUploadingSlot(null)
    }
  }

  // Open modal for new post
  const handleOpenNewPost = () => {
    setEditingPostId(null)
    setModalYear(new Date().getFullYear().toString())
    setModalTitle('')
    setModalContent(
      '#h1 Chào mừng Tân sinh viên Khoa FEPN\n' +
        '#Line\n' +
        'Khoa Vật lý Kỹ thuật và Công nghệ Nano tự hào chào đón các bạn sinh viên gia nhập đại gia đình FEPN.\n\n' +
        '#ChuThich:[Hành trình vạn dặm bắt đầu từ một bước chân. Chúc các bạn có những năm tháng rực rỡ nhất tại FEPN!]\n\n' +
        '{AnhTieuDe}\n\n' +
        '#h2 Các hoạt động định hướng và nghiên cứu khoa học\n' +
        'Sinh viên được làm quen với các phòng thí nghiệm hiện đại từ năm nhất.\n\n' +
        '{AnhDangBai1}\n'
    )
    setModalMediaItems({})
    setModalCoverImage('')
    setShowEditorModal(true)
  }

  // Open modal for editing existing post
  const handleOpenEditPost = (post: FepnRecapPost) => {
    setEditingPostId(post.id)
    setModalYear(post.year || new Date().getFullYear().toString())
    setModalTitle(post.title)
    setModalContent(post.content)
    setModalMediaItems(post.media_items || {})
    setModalCoverImage(post.cover_image || '')
    setShowEditorModal(true)
  }

  // Save post
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalTitle.trim()) {
      alert('Vui lòng nhập tiêu đề bài viết!')
      return
    }
    if (!modalContent.trim()) {
      alert('Vui lòng nhập nội dung bài viết!')
      return
    }

    setSavingPost(true)
    try {
      const coverImage = modalMediaItems['{AnhTieuDe}'] || modalCoverImage || ''

      const postPayload: any = {
        year: modalYear.trim(),
        title: modalTitle.trim(),
        content: modalContent.trim(),
        cover_image: coverImage,
        media_items: modalMediaItems,
        updated_at: new Date().toISOString(),
      }

      if (editingPostId) {
        const { data, error } = await supabase
          .from('fepn_recap_posts')
          .update(postPayload)
          .eq('id', editingPostId)
          .select('*')
          .single()

        if (error) throw error

        setPosts((prev) => prev.map((p) => (p.id === editingPostId ? data : p)))
        if (selectedPost?.id === editingPostId) {
          setSelectedPost(data)
        }
        alert('🎉 Đã cập nhật bài viết thành công!')
      } else {
        postPayload.author_id = user?.id
        postPayload.author_name = user?.email?.split('@')[0] || 'Admin FEPN'

        const { data, error } = await supabase.from('fepn_recap_posts').insert(postPayload).select('*').single()

        if (error) throw error

        setPosts((prev) => [data, ...prev])
        setSelectedPost(data)
        alert('🎉 Đã đăng bài viết Recap mới thành công!')
      }

      setShowEditorModal(false)
    } catch (err: any) {
      alert('Lỗi lưu bài viết: ' + err.message)
    } finally {
      setSavingPost(false)
    }
  }

  // Delete post
  const handleDeletePost = async (postId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa bài viết "${title}"?`)) return
    try {
      const { error } = await supabase.from('fepn_recap_posts').delete().eq('id', postId)
      if (error) throw error
      const updated = posts.filter((p) => p.id !== postId)
      setPosts(updated)
      if (selectedPost?.id === postId) {
        setSelectedPost(updated.length > 0 ? updated[0] : null)
      }
      alert('Đã xóa bài viết thành công!')
    } catch (err: any) {
      alert('Lỗi xóa bài viết: ' + err.message)
    }
  }

  // Format inline bold (#Bold:[text]), Markdown links ([label](url)), and clickable raw URLs (http://, https://, www.)
  const renderInlineFormatting = (text: string): React.ReactNode => {
    if (!text) return text

    // Tokenizer regex matching #Bold:[...], [label](url), and raw URLs
    const tokenRegex = /(#Bold:\[[\s\S]*?\]|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\)|https?:\/\/[^\s<)]+|www\.[^\s<)]+)/g
    const parts: React.ReactNode[] = []
    let lastIdx = 0
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index))
      }

      const token = match[0]
      const keyIndex = match.index

      if (token.startsWith('#Bold:[')) {
        const boldInner = token.slice(7, -1)
        parts.push(
          <strong key={`bold-${keyIndex}`} className="font-extrabold text-slate-900">
            {renderInlineFormatting(boldInner)}
          </strong>
        )
      } else if (token.startsWith('[') && token.includes('](')) {
        const mdMatch = token.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/)
        if (mdMatch) {
          const [, label, url] = mdMatch
          const href = url.startsWith('www.') ? `https://${url}` : url
          parts.push(
            <a
              key={`mdlink-${keyIndex}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:text-sky-800 underline underline-offset-2 font-bold inline-flex items-center gap-0.5 transition break-all"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{label}</span>
              <ExternalLink className="h-3 w-3 inline-block shrink-0 opacity-70" />
            </a>
          )
        } else {
          parts.push(token)
        }
      } else {
        // Raw URL
        const cleanUrl = token.replace(/[.,;:!?)\]]+$/, '')
        const trailing = token.slice(cleanUrl.length)
        const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl

        parts.push(
          <a
            key={`link-${keyIndex}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-800 underline underline-offset-2 font-bold inline-flex items-center gap-0.5 transition break-all"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{cleanUrl}</span>
            <ExternalLink className="h-3 w-3 inline-block shrink-0 opacity-70" />
          </a>
        )
        if (trailing) {
          parts.push(trailing)
        }
      }

      lastIdx = tokenRegex.lastIndex
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx))
    }

    return parts.length > 0 ? parts : text
  }

  // Custom Content Renderer with Drop Cap & Media Support
  const renderArticleContent = (content: string, mediaItems: Record<string, string> = {}) => {
    if (!content) return null

    const lines = content.split('\n')
    const renderedNodes: React.ReactNode[] = []
    let hasAppliedDropCap = false

    let i = 0
    while (i < lines.length) {
      const line = lines[i].trim()

      if (!line) {
        i++
        continue
      }

      // 1. Heading #h1
      if (line.startsWith('#h1 ')) {
        const text = line.replace(/^#h1\s+/, '')
        renderedNodes.push(
          <h1
            key={`h1-${i}`}
            className="text-2xl sm:text-3xl lg:text-4xl font-black text-sky-950 mt-8 mb-4 tracking-tight leading-snug"
            style={{ fontFamily: 'var(--font-fepn-heading)' }}
          >
            {renderInlineFormatting(text)}
          </h1>
        )
        i++
        continue
      }

      // 2. Heading #h2
      if (line.startsWith('#h2 ')) {
        const text = line.replace(/^#h2\s+/, '')
        renderedNodes.push(
          <h2
            key={`h2-${i}`}
            className="text-xl sm:text-2xl font-black text-sky-900 mt-7 mb-3 tracking-tight border-b border-sky-100 pb-2"
            style={{ fontFamily: 'var(--font-fepn-heading)' }}
          >
            {renderInlineFormatting(text)}
          </h2>
        )
        i++
        continue
      }

      // 3. Heading #h3
      if (line.startsWith('#h3 ')) {
        const text = line.replace(/^#h3\s+/, '')
        renderedNodes.push(
          <h3
            key={`h3-${i}`}
            className="text-lg sm:text-xl font-bold text-slate-800 mt-5 mb-2.5 tracking-tight"
            style={{ fontFamily: 'var(--font-fepn-heading)' }}
          >
            {renderInlineFormatting(text)}
          </h3>
        )
        i++
        continue
      }

      // 4. Separator #Line
      if (line === '#Line' || line.startsWith('#Line ')) {
        renderedNodes.push(
          <hr key={`line-${i}`} className="my-8 border-t-2 border-slate-200" />
        )
        i++
        continue
      }

      // 5. Blockquote #ChuThich:[Nội dung]
      if (line.startsWith('#ChuThich:[')) {
        const match = line.match(/^#ChuThich:\[(.*?)\]$/)
        const quoteContent = match ? match[1] : line.replace(/^#ChuThich:\[?/, '').replace(/\]$/, '')
        renderedNodes.push(
          <blockquote
            key={`quote-${i}`}
            className="my-7 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/40 to-sky-50/30 p-5 sm:p-6 border-l-4 border-sky-500 shadow-sm relative overflow-hidden"
          >
            <span
              className="text-5xl sm:text-6xl font-serif text-sky-300 font-black leading-none absolute -top-1 left-3 select-none pointer-events-none opacity-40"
              aria-hidden="true"
            >
              “
            </span>
            <div className="relative pl-7 text-slate-700 italic font-medium text-base sm:text-lg leading-relaxed">
              {renderInlineFormatting(quoteContent)}
            </div>
          </blockquote>
        )
        i++
        continue
      }

      // 6. Media Slot: {AnhTieuDe}, {AnhDangBai}, {AnhDangBai1}, {AnhDangBai2}, {VideoDangBai}, {VideoDangBai1}, etc.
      const mediaTagMatch = line.match(/^\{(AnhTieuDe|AnhDangBai\d*|VideoDangBai\d*)\}$/)
      if (mediaTagMatch) {
        const tag = mediaTagMatch[0]
        const mediaUrl = mediaItems[tag]

        if (tag.startsWith('{AnhTieuDe') || tag.startsWith('{AnhDangBai')) {
          const imgNumber = tag.replace(/[^0-9]/g, '')
          const imgLabel = tag.startsWith('{AnhTieuDe')
            ? 'Ảnh tiêu đề'
            : imgNumber
            ? `Ảnh bài viết #${imgNumber}`
            : 'Ảnh bài viết'

          renderedNodes.push(
            <figure key={`media-${i}`} className="my-7 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md">
              {mediaUrl ? (
                <div className="relative w-full h-auto max-h-[600px] overflow-hidden bg-slate-50 flex items-center justify-center">
                  <SafeImage
                    src={mediaUrl}
                    alt={imgLabel}
                    className="w-full h-auto object-contain max-h-[600px] transition duration-300 hover:scale-[1.01]"
                  />
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                  <span>Vị trí {imgLabel} ({tag}) - Chưa có ảnh tải lên</span>
                </div>
              )}
            </figure>
          )
        } else if (tag.startsWith('{VideoDangBai')) {
          const videoNumber = tag.replace(/[^0-9]/g, '')
          const videoLabel = videoNumber ? `Video bài viết #${videoNumber}` : 'Video bài viết'

          renderedNodes.push(
            <div key={`video-${i}`} className="my-7 rounded-2xl overflow-hidden border border-slate-200 bg-black shadow-lg">
              {mediaUrl ? (
                renderVideoEmbed(mediaUrl)
              ) : (
                <div className="p-8 text-center bg-slate-900 text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-2">
                  <Video className="h-8 w-8 text-slate-500" />
                  <span>Vị trí {videoLabel} ({tag}) - Chưa có video tải lên</span>
                </div>
              )}
            </div>
          )
        }

        i++
        continue
      }

      // 7. Regular Text Paragraph
      // If it is the VERY FIRST text paragraph, apply Journalism DROP CAP spanning 2 lines!
      if (!hasAppliedDropCap && line.length > 1) {
        hasAppliedDropCap = true
        const firstLetter = line.charAt(0)
        const remainingText = line.slice(1)

        renderedNodes.push(
          <p key={`p-${i}`} className="text-slate-700 text-base sm:text-lg leading-relaxed mb-5 clearfix">
            <span
              className="float-left text-5xl sm:text-6xl font-serif font-black text-sky-600 leading-none mr-3.5 mt-1 select-none"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {firstLetter}
            </span>
            {renderInlineFormatting(remainingText)}
          </p>
        )
      } else {
        renderedNodes.push(
          <p key={`p-${i}`} className="text-slate-700 text-base sm:text-lg leading-relaxed mb-5">
            {renderInlineFormatting(line)}
          </p>
        )
      }

      i++
    }

    return renderedNodes
  }

  // Render Video Helper - Smooth buffering & hardware-accelerated playback
  const renderVideoEmbed = (url: string) => {
    const formattedUrl = url.trim()

    // 1. YouTube
    if (formattedUrl.includes('youtube.com') || formattedUrl.includes('youtu.be')) {
      let videoId = ''
      if (formattedUrl.includes('v=')) {
        videoId = formattedUrl.split('v=')[1]?.split('&')[0] || ''
      } else if (formattedUrl.includes('youtu.be/')) {
        videoId = formattedUrl.split('youtu.be/')[1]?.split('?')[0] || ''
      } else if (formattedUrl.includes('embed/')) {
        return (
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
            <iframe
              src={formattedUrl}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          </div>
        )
      }
      if (videoId) {
        return (
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          </div>
        )
      }
    }

    // 2. Google Drive Video
    if (formattedUrl.includes('drive.google.com')) {
      const match =
        formattedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        formattedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        formattedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return (
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
            <iframe
              src={`https://drive.google.com/file/d/${match[1]}/preview`}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            />
          </div>
        )
      }
    }

    // 3. Direct HTML5 Video player (MP4, WebM) with hardware acceleration & smooth buffering
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg">
        <video
          controls
          preload="metadata"
          playsInline
          className="w-full max-h-[580px] bg-black object-contain"
          src={formattedUrl}
        />
      </div>
    )
  }

  // Loading Screen
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Đang tải FEPN Recap...</p>
      </div>
    )
  }

  // Unauthenticated Screen
  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
          <Sparkles className="mx-auto h-12 w-12 text-sky-600 mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Yêu cầu đăng nhập</h2>
          <p className="text-sm text-slate-600 mb-6">
            Bạn cần đăng nhập bằng tài khoản VNU (@vnu.edu.vn) để xem kỷ yếu và các hoạt động của Khoa FEPN.
          </p>
          <Link
            href="/fepn-login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-sky-700 transition"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 font-sans flex flex-col bg-slate-50`}
      style={{
        ...themeVars,
        background:
          'radial-gradient(circle at 15% 10%, rgba(224, 242, 254, 0.7), transparent 35%), radial-gradient(circle at 85% 15%, rgba(224, 231, 255, 0.7), transparent 45%), #F8FAFC',
      }}
    >
      {/* 1. TOP HEADER BRANDING */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl px-4 py-3 sm:px-6">
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
                    FEPN Recap
                  </h1>
                  <span className="rounded-md bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-sky-600">
                    Kỷ Yếu & Hoạt Động
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
                  Khoa Vật lý kỹ thuật & Công nghệ Nano - UET VNU
                </p>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Link back to Dashboard */}
            <Link
              href="/fepn-dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-sm"
              title="Về danh sách môn học"
            >
              <BookOpen className="h-3.5 w-3.5 text-sky-600" />
              <span>Môn Học FEPN</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Resizer Buttons */}
            <div className="hidden md:flex items-center gap-1 rounded-xl bg-black/5 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLeftWidth(30)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 30 ? 'bg-white shadow-sm text-sky-600' : 'text-slate-500 hover:text-black'}`}
                title="Cột trái 30% / Cột phải 70%"
              >
                30 : 70
              </button>
              <button
                type="button"
                onClick={() => setLeftWidth(38)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 38 ? 'bg-white shadow-sm text-sky-600' : 'text-slate-500 hover:text-black'}`}
                title="Cột trái 38% / Cột phải 62%"
              >
                38 : 62
              </button>
              <button
                type="button"
                onClick={() => setLeftWidth(50)}
                className={`px-2 py-1 rounded-lg transition ${leftWidth === 50 ? 'bg-white shadow-sm text-sky-600' : 'text-slate-500 hover:text-black'}`}
                title="Cột trái 50% / Cột phải 50%"
              >
                50 : 50
              </button>
            </div>

            {/* Admin Add Post Button */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenNewPost}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Đăng Bài Viết Mới</span>
              </button>
            )}

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-slate-800">{user?.email?.split('@')[0]}</p>
                <span className="text-[10px] font-black text-sky-600 uppercase">
                  {isAdmin ? 'Quản Trị Viên' : 'Sinh Viên VNU'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-sm transition"
                title="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN RESIZABLE SPLIT VIEW */}
      <div
        ref={splitContainerRef}
        className="mx-auto flex-1 w-full max-w-[1700px] flex flex-col lg:flex-row p-3 sm:p-5 gap-0 overflow-hidden"
      >
        {/* ======================================================== */}
        {/* CỘT TRÁI (LEFT COLUMN): ARTICLE LIST & COHORT YEAR FILTER */}
        {/* ======================================================== */}
        <div
          className="flex flex-col rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-lg overflow-hidden shrink-0"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Header & Year Pills */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Kỷ Yếu Từng Năm
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                {filteredPosts.length} bài viết
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài viết, năm nhập học..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Year Horizontal Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedYear('all')}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                  selectedYear === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả năm
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                    selectedYear === year
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Khóa {year}
                </button>
              ))}
            </div>
          </div>

          {/* List of Posts */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-190px)]">
            {loadingPosts ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-sky-600 mb-2" />
                <p className="text-xs font-semibold">Đang tải bài viết...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4 text-slate-400">
                <Sparkles className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600 mb-1">Chưa có bài viết nào</p>
                <p className="text-[11px] text-slate-400">
                  {selectedYear !== 'all'
                    ? `Không tìm thấy bài viết cho năm ${selectedYear}.`
                    : 'Admin có thể bấm nút "Đăng Bài Viết Mới" để thêm bài viết đầu tiên.'}
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenNewPost}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 px-3 py-1.5 text-xs font-bold hover:bg-sky-100 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tạo bài viết ngay</span>
                  </button>
                )}
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isSelected = selectedPost?.id === post.id
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className={`group relative flex gap-3 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/80 shadow-md ring-1 ring-sky-500/30'
                        : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50/70 shadow-2xs'
                    }`}
                  >
                    {/* Mini Thumbnail ({AnhTieuDe}) */}
                    <div className="relative h-16 w-20 sm:h-20 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                      {post.cover_image ? (
                        <SafeImage
                          src={post.cover_image}
                          alt={post.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="h-6 w-6 text-slate-300" />
                          <span className="text-[9px] font-bold mt-0.5">FEPN</span>
                        </div>
                      )}
                      <div className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-black text-white">
                        {post.year}
                      </div>
                    </div>

                    {/* Post Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-sky-700 transition leading-snug">
                          {post.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 font-normal">
                          {post.content.replace(/#[a-zA-Z0-9]+:?\[?|\]|\{[^}]+\}/g, '').trim()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-2 text-[10px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{post.created_at ? new Date(post.created_at).toLocaleDateString('vi-VN') : ''}</span>
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPost(post)}
                              className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-sky-100 transition"
                              title="Chỉnh sửa bài viết"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id, post.title)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-100 transition"
                              title="Xóa bài viết"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RESIZER DRAG HANDLE */}
        {/* ======================================================== */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden lg:flex w-3 items-center justify-center cursor-col-resize select-none hover:bg-sky-500/20 active:bg-sky-500/40 transition group"
          title="Kéo sang trái/phải để điều chỉnh kích thước 2 cột"
        >
          <div className="h-12 w-1 rounded-full bg-slate-300 group-hover:bg-sky-500 transition" />
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI (RIGHT COLUMN): ARTICLE CONTENT VIEWER */}
        {/* ======================================================== */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-lg overflow-hidden mt-4 lg:mt-0">
          {selectedPost ? (
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-120px)] p-4 sm:p-8 lg:p-10">
              {/* Header Bar: Year Badge, Author, Date, Admin Edit */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-sky-600 text-white px-3 py-1 text-xs font-black uppercase tracking-wider shadow-xs">
                    Khóa {selectedPost.year}
                  </span>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {selectedPost.created_at ? new Date(selectedPost.created_at).toLocaleDateString('vi-VN') : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPost.author_name && (
                    <span className="text-xs text-slate-500 font-medium">
                      Người đăng: <strong className="text-slate-800">{selectedPost.author_name}</strong>
                    </span>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditPost(selectedPost)}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Sửa bài</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Cover Hero Image ({AnhTieuDe}) */}
              {selectedPost.cover_image && (
                <div className="relative w-full max-h-[480px] overflow-hidden rounded-2xl mb-8 border border-slate-200 shadow-md bg-slate-100 flex items-center justify-center">
                  <SafeImage
                    src={selectedPost.cover_image}
                    alt={selectedPost.title}
                    className="w-full h-auto max-h-[480px] object-cover"
                  />
                </div>
              )}

              {/* Title */}
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-black text-sky-950 tracking-tight leading-snug mb-6"
                style={{ fontFamily: 'var(--font-fepn-heading)' }}
              >
                {selectedPost.title}
              </h1>

              {/* Article Content with Custom Parser & Drop Cap */}
              <div className="article-body prose prose-slate max-w-none">
                {renderArticleContent(selectedPost.content, selectedPost.media_items || {})}
              </div>

              {/* Article Footer */}
              <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 text-sky-600" />
                  <span>Khoa Vật lý kỹ thuật & Công nghệ Nano (FEPN - UET - VNU)</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Cập nhật lần cuối:{' '}
                  {selectedPost.updated_at
                    ? new Date(selectedPost.updated_at).toLocaleDateString('vi-VN')
                    : new Date().toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Sparkles className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700 mb-1">Chưa chọn bài viết</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Vui lòng chọn một bài viết từ danh sách bên trái để đọc nội dung kỷ yếu và xem hình ảnh hoạt động của Khoa FEPN.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADMIN POST AUTHORING & EDITING MODAL */}
      {/* ======================================================== */}
      {showEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-600" />
                <h3 className="text-base font-black text-slate-900">
                  {editingPostId ? 'Chỉnh Sửa Bài Viết Recap' : 'Đăng Bài Viết Recap Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSavePost} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Year Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Năm / Khóa nhập học *
                  </label>
                  <input
                    type="text"
                    value={modalYear}
                    onChange={(e) => setModalYear(e.target.value)}
                    placeholder="VD: 2024, 2025"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-bold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* Title */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Tiêu đề bài viết *
                  </label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="VD: Kỷ yếu Khóa K69 - Chặng đường khởi đầu rực rỡ"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-bold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Thanh công cụ định dạng & Thẻ phương tiện (Click để chèn nhanh)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => insertSyntax('#h1 Tiêu đề lớn')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #h1
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSyntax('#h2 Tiêu đề vừa')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #h2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSyntax('#h3 Tiêu đề nhỏ')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #h3
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSyntax('#Bold:[Nội dung in đậm]')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #Bold:[]
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSyntax('#Line')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #Line
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSyntax('#ChuThich:[Lời trích dẫn hoặc ghi chú nổi bật]')}
                    className="px-2.5 py-1 rounded bg-white font-bold text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition"
                  >
                    + #ChuThich:[]
                  </button>
                  <span className="h-4 w-px bg-slate-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertSyntax('{AnhTieuDe}')}
                    className="px-2.5 py-1 rounded bg-sky-100 font-black text-sky-800 border border-sky-300 hover:bg-sky-200 transition flex items-center gap-1"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>+ &#123;AnhTieuDe&#125;</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertNextImageTag}
                    className="px-2.5 py-1 rounded bg-indigo-50 font-black text-indigo-800 border border-indigo-300 hover:bg-indigo-100 transition flex items-center gap-1"
                    title="Chèn ảnh đăng bài tiếp theo (VD: {AnhDangBai1}, {AnhDangBai2}...)"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>+ &#123;AnhDangBai + Số&#125;</span>
                  </button>
                  <label
                    className="px-2.5 py-1 rounded bg-indigo-600 font-black text-white hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer shadow-xs"
                    title="Tải lên nhiều ảnh cùng một lúc từ máy tính"
                  >
                    {batchUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    <span>{batchUploading ? 'Đang tải nhiều ảnh...' : '📸 Tải nhiều ảnh cùng lúc'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={batchUploading}
                      className="hidden"
                      onChange={handleBatchImagesUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleInsertNextVideoTag}
                    className="px-2.5 py-1 rounded bg-amber-50 font-black text-amber-800 border border-amber-300 hover:bg-amber-100 transition flex items-center gap-1"
                    title="Chèn video đăng bài tiếp theo (VD: {VideoDangBai1}, {VideoDangBai2}...)"
                  >
                    <Video className="h-3 w-3" />
                    <span>+ &#123;VideoDangBai + Số&#125;</span>
                  </button>
                </div>
              </div>

              {/* Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Nội dung bài viết *
                </label>
                <textarea
                  rows={9}
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Nhập nội dung bài viết. Có thể sử dụng #h1, #h2, #h3, #Bold:[...], #Line, #ChuThich:[...], {AnhTieuDe}, {AnhDangBai}, {VideoDangBai}..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-800 font-mono leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </div>

              {/* Dynamic Interactive Media Slots */}
              {detectedMediaTags.length > 0 && (
                <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-sky-950">
                        Vị trí Media đã phát hiện ({detectedMediaTags.length})
                      </h4>
                    </div>
                    <span className="text-[11px] text-sky-700 font-medium">
                      Tải file từ máy tính hoặc dán trực tiếp URL
                    </span>
                  </div>

                  <div className="space-y-3">
                    {detectedMediaTags.map((tag) => {
                      const isCover = tag === '{AnhTieuDe}'
                      const isVideo = tag.startsWith('{VideoDangBai')
                      const isArticleImg = tag.startsWith('{AnhDangBai')
                      const currentUrl = modalMediaItems[tag] || (isCover ? modalCoverImage : '')
                      const isUploading = uploadingSlot === tag

                      let slotLabel = 'Ảnh đính kèm trong bài'
                      if (isCover) {
                        slotLabel = 'Ảnh bìa & Thumbnail danh sách'
                      } else if (isArticleImg) {
                        const num = tag.replace(/[^0-9]/g, '')
                        slotLabel = num ? `Ảnh bài viết số ${num}` : 'Ảnh bài viết'
                      } else if (isVideo) {
                        const num = tag.replace(/[^0-9]/g, '')
                        slotLabel = num ? `Video bài viết số ${num}` : 'Video bài viết'
                      }

                      return (
                        <div
                          key={tag}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-lg px-2 py-1 text-xs font-mono font-black ${
                                isCover
                                  ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                  : isVideo
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                              }`}
                            >
                              {tag}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {slotLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            {/* Mini Preview */}
                            {currentUrl && !isVideo && (
                              <div className="relative h-8 w-11 shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100 shadow-2xs">
                                <SafeImage src={currentUrl} alt={slotLabel} className="h-full w-full object-cover" />
                              </div>
                            )}

                            {/* File Upload Button */}
                            <label className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700 cursor-pointer transition">
                              {isUploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              <span>{isUploading ? 'Đang tải...' : 'Chọn tệp'}</span>
                              <input
                                type="file"
                                accept={isVideo ? 'video/*' : 'image/*'}
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleMediaUpload(tag, file)
                                }}
                              />
                            </label>

                            {/* Direct URL Input */}
                            <input
                              type="text"
                              value={currentUrl}
                              onChange={(e) => {
                                const val = e.target.value
                                setModalMediaItems((prev) => ({ ...prev, [tag]: val }))
                                if (isCover) setModalCoverImage(val)
                              }}
                              placeholder={isVideo ? 'Dán link YouTube / Drive...' : 'Hoặc dán URL ảnh...'}
                              className="flex-1 sm:w-64 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none"
                            />

                            {/* Clear button */}
                            {currentUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalMediaItems((prev) => {
                                    const copy = { ...prev }
                                    delete copy[tag]
                                    return copy
                                  })
                                  if (isCover) setModalCoverImage('')
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Xóa ảnh/video"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingPost}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-5 py-2 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 disabled:opacity-60"
                >
                  {savingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>{editingPostId ? 'Lưu thay đổi' : 'Đăng bài viết'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
