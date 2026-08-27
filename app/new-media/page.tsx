'use client'

import { useState, useEffect, useRef, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  MessageSquare,
  MessageCircle,
  Send,
  Sparkles,
  Heart,
  Share2,
  Bookmark,
  Plus,
  Search,
  Filter,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Clock,
  ThumbsUp,
  Tag,
  Radio,
  Flame,
  Award,
  Bot,
  Zap,
  Trash2,
  RefreshCw,
  Paperclip,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newmedia-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newmedia-body' })

type MediaTab = 'forum' | 'chat'

const SUBJECT_TAGS = ['Tất cả', 'Toán học', 'Vật lí', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Tiếng Anh', 'HSA', 'TSA', 'Tài liệu']

export default function NewMediaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)

  const [activeTab, setActiveTab] = useState<MediaTab>('forum')
  const [selectedTag, setSelectedTag] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  // REAL FORUM POSTS FROM SUPABASE
  const [posts, setPosts] = useState<any[]>([])
  const [postsLoading, setPostsLoading] = useState(false)

  // CREATE NEW POST MODAL STATE
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostSubject, setNewPostSubject] = useState('Toán học')
  const [creatingPost, setCreatingPost] = useState(false)

  // COMMENTS PER POST
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [activePostComments, setActivePostComments] = useState<Record<string, any[]>>({})
  const [expandedCommentPostIds, setExpandedCommentPostIds] = useState<string[]>([])

  // REAL CHAT MESSAGES FROM API
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const authHeaders = async (): Promise<Record<string, string> | undefined> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return undefined
    return { Authorization: `Bearer ${token}` }
  }

  // 1. FETCH REAL FORUM POSTS
  const fetchForumPosts = async () => {
    setPostsLoading(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, full_name, school, role),
          comments (id, content, created_at, user_id, profiles:user_id(full_name))
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setPosts(data)
      }
    } catch (e) {
      console.error('Error loading forum posts:', e)
    } finally {
      setPostsLoading(false)
    }
  }

  // 2. FETCH REAL CHAT MESSAGES
  const fetchChatMessages = async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/sen-messages?limit=50', {
        method: 'GET',
        headers: headers ? { ...headers, 'Content-Type': 'application/json' } : undefined,
      })
      if (res.ok) {
        const data = await res.json()
        setChatMessages(data.messages || [])
      }
    } catch (e) {
      console.error('Error fetching chat messages:', e)
    }
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      setCurrentUserId(user.id)
      await ensureStudentProfile(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUserProfile(p)

      await Promise.all([fetchForumPosts(), fetchChatMessages()])
      setLoading(false)
    }

    init()

    // Poll for new chat messages every 5 seconds when in chat tab
    const chatInterval = setInterval(() => {
      if (activeTab === 'chat') {
        fetchChatMessages()
      }
    }, 5000)

    return () => clearInterval(chatInterval)
  }, [router, activeTab])

  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [activeTab, chatMessages])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // TẠO BÀI VIẾT DIỄN ĐÀN THẬT LƯU VÀO SUPABASE
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostTitle.trim() || !newPostContent.trim() || !currentUserId) return

    setCreatingPost(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: currentUserId,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          category: newPostSubject,
          likes_count: 0,
          is_pinned: false,
        })
        .select(`
          *,
          profiles:user_id (id, full_name, school, role),
          comments (id, content, created_at, user_id, profiles:user_id(full_name))
        `)
        .single()

      if (error) throw error

      if (data) {
        setPosts([data, ...posts])
      }
      setNewPostTitle('')
      setNewPostContent('')
      setShowCreateModal(false)
    } catch (err: any) {
      alert(`Lỗi đăng bài: ${err.message}`)
    } finally {
      setCreatingPost(false)
    }
  }

  // BÌNH LUẬN THẬT LƯU VÀO SUPABASE
  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim()
    if (!text || !currentUserId) return

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          content: text,
        })
        .select('id, content, created_at, user_id, profiles:user_id(full_name)')
        .single()

      if (error) throw error

      // Cập nhật danh sách bài viết
      setPosts(
        posts.map((p) => {
          if (p.id === postId) {
            const currentC = Array.isArray(p.comments) ? p.comments : []
            return { ...p, comments: [...currentC, data] }
          }
          return p
        })
      )

      setCommentInputs({ ...commentInputs, [postId]: '' })
    } catch (err: any) {
      alert(`Lỗi gửi bình luận: ${err.message}`)
    }
  }

  // THÍCH BÀI VIẾT THẬT
  const handleLikePost = async (post: any) => {
    const newLikes = (post.likes_count || 0) + 1
    await supabase.from('posts').update({ likes_count: newLikes }).eq('id', post.id)
    setPosts(posts.map((p) => (p.id === post.id ? { ...p, likes_count: newLikes } : p)))
  }

  // GỬI TIN NHẮN TRÒ CHUYỆN THẬT
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || sendingChat) return

    setSendingChat(true)
    try {
      const headers = await authHeaders()
      const formData = new FormData()
      formData.append('message', chatInput.trim())

      const res = await fetch('/api/sen-messages', {
        method: 'POST',
        headers: headers ? { ...headers } : undefined,
        body: formData,
      })

      if (res.ok) {
        setChatInput('')
        await fetchChatMessages()
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSendingChat(false)
    }
  }

  const filteredPosts = posts.filter((p) => {
    const matchTag = selectedTag === 'Tất cả' || p.category === selectedTag
    const q = deferredSearch.toLowerCase().trim()
    const matchQ = !q || (p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q)
    return matchTag && matchQ
  })

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang tải trung tâm Sen Media...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="inline h-3 w-3 mr-1" /> Sen Media 2.0
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  Trực Tuyến
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
                Cộng Đồng Sĩ Tử & Trò Chuyện Trực Tiếp
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('forum')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'forum'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-indigo-500" /> Diễn Đàn & Hỏi Đáp Sĩ Tử ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'chat'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <MessageCircle className="h-4 w-4 text-cyan-500" /> Phòng Chat Trực Tiếp (Sen Messages)
          </button>
        </div>

        {/* TAB 1: FORUM & Q&A */}
        {activeTab === 'forum' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* SUBJECT FILTER SIDEBAR */}
            <div className="lg:col-span-1 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl space-y-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Đặt Câu Hỏi / Đăng Bài
              </button>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block px-2 mb-1">
                  Chủ Đề Thảo Luận
                </span>
                {SUBJECT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                      selectedTag === tag
                        ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#4B5563] dark:text-slate-300'
                    }`}
                  >
                    <span>{tag}</span>
                    {selectedTag === tag && <Tag className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>

            {/* FORUM POSTS FEED */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search Bar & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm câu hỏi, bài tập, thảo luận..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs font-semibold outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchForumPosts}
                  disabled={postsLoading}
                  className="h-11 w-11 flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 shadow-sm transition hover:scale-105"
                  title="Làm mới bài viết"
                >
                  <RefreshCw className={`h-4 w-4 text-indigo-500 ${postsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Posts List */}
              <div className="space-y-4">
                {postsLoading && posts.length === 0 ? (
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-12 text-center text-[#6B7280]">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-2" />
                    <p className="text-xs font-bold">Đang tải các bài viết từ cộng đồng...</p>
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-12 text-center text-[#6B7280] space-y-2">
                    <MessageSquare className="h-10 w-10 mx-auto opacity-40" />
                    <p className="text-xs font-bold">Chưa có bài viết nào trong danh mục này. Hãy là người đầu tiên đặt câu hỏi!</p>
                  </div>
                ) : (
                  filteredPosts.map((post) => {
                    const authorName = post.profiles?.full_name || 'Thí sinh SenExam'
                    const authorSchool = post.profiles?.school || ''
                    const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0

                    return (
                      <div
                        key={post.id}
                        className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm backdrop-blur-xl space-y-3 transition hover:shadow-md"
                      >
                        {/* Post Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-sm shadow-sm">
                              {authorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">{authorName}</h4>
                                {post.profiles?.role === 'admin' && (
                                  <span className="rounded-full bg-rose-500/15 text-rose-600 px-1.5 py-0.2 text-[9px] font-black uppercase">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#6B7280] dark:text-slate-400">
                                {authorSchool ? `${authorSchool} • ` : ''}
                                {new Date(post.created_at).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>

                          <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-0.5 text-[10px] font-black border border-indigo-500/20">
                            {post.category || 'Thảo luận'}
                          </span>
                        </div>

                        {/* Post Content */}
                        <div>
                          <h3 className="text-base font-black leading-snug" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
                            {post.title}
                          </h3>
                          <p className="mt-1 text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                            {post.content}
                          </p>
                        </div>

                        {/* Post Action Footer */}
                        <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleLikePost(post)}
                              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition hover:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            >
                              <Heart className="h-4 w-4 fill-current" />
                              <span>{post.likes_count || 0}</span>
                            </button>

                            <span className="inline-flex items-center gap-1 text-[#6B7280] font-bold">
                              <MessageCircle className="h-4 w-4" /> {commentsCount} câu trả lời
                            </span>
                          </div>
                        </div>

                        {/* Comments Section */}
                        <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2.5">
                          {Array.isArray(post.comments) && post.comments.map((cmt: any) => (
                            <div key={cmt.id} className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <strong className="text-slate-900 dark:text-white">
                                  {cmt.profiles?.full_name || 'Thí sinh'}
                                </strong>
                                <span className="text-[10px] text-[#6B7280]">
                                  {new Date(cmt.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[#4B5563] dark:text-slate-300 font-medium">{cmt.content}</p>
                            </div>
                          ))}

                          {/* Add Comment Input */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Viết câu trả lời hoặc lời giải của bạn..."
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(post.id)
                              }}
                              className="h-9 flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddComment(post.id)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIRECT CHAT ROOM (SEN MESSAGES) */}
        {activeTab === 'chat' && (
          <div className="mt-6 max-w-4xl mx-auto rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-2xl backdrop-blur-2xl flex flex-col h-[650px]">
            {/* Chat Room Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-sm">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
                    Phòng Chat Sĩ Tử Toàn Quốc (Sen Messages)
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ● Trực tuyến 24/7 • Không gian học tập trao đổi tích cực
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchChatMessages}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#6B7280]"
                title="Làm mới tin nhắn"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="text-center py-20 text-[#6B7280] text-xs">
                  Chưa có tin nhắn nào. Hãy là người đầu tiên gửi tin nhắn!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.user_id === currentUserId
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-[#6B7280] dark:text-slate-400 px-1 mb-0.5">
                        {msg.user_name || 'Thí sinh'} • {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div
                        className={`max-w-md rounded-2xl p-3 text-xs font-semibold shadow-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white'
                            : 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {msg.message}
                        {msg.attachment_url && (
                          <div className="mt-2 pt-2 border-t border-white/20">
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-[11px] block truncate font-bold"
                            >
                              📎 {msg.attachment_name || 'Tệp đính kèm'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChatMessage} className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập tin nhắn trao đổi với bạn bè sĩ tử..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="h-12 flex-1 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-xs sm:text-sm font-semibold outline-none focus:border-cyan-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || sendingChat}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {sendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[30px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
              Đăng Câu Hỏi / Bài Viết Lên Diễn Đàn
            </h3>

            <form onSubmit={handleCreatePost} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="text-[#6B7280] block mb-1">Môn học / Chủ đề:</label>
                <select
                  value={newPostSubject}
                  onChange={(e) => setNewPostSubject(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                >
                  {SUBJECT_TAGS.filter((t) => t !== 'Tất cả').map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#6B7280] block mb-1">Tiêu đề bài viết:</label>
                <input
                  type="text"
                  placeholder="VD: Hỏi bài toán xác suất trong đề thi thử THPT 2026..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                />
              </div>

              <div>
                <label className="text-[#6B7280] block mb-1">Nội dung chi tiết:</label>
                <textarea
                  rows={5}
                  placeholder="Mô tả cụ thể câu hỏi hoặc chia sẻ tài liệu của bạn..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingPost || !newPostTitle.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50"
                >
                  {creatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đăng Bài Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
