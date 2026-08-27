'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newmedia-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newmedia-body' })

type MediaTab = 'forum' | 'chat' | 'senai_helper'

const SUBJECT_TAGS = ['Tất cả', 'Toán học', 'Vật lí', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Tiếng Anh', 'HSA', 'TSA', 'Tài liệu']

export default function NewMediaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)

  const [activeTab, setActiveTab] = useState<MediaTab>('forum')
  const [selectedTag, setSelectedTag] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')

  // FORUM POSTS STATE
  const [posts, setPosts] = useState<any[]>([
    {
      id: 'p1',
      author: 'Nguyễn Minh Trí (THPT Chuyên KHTN)',
      avatar: 'M',
      time: '15 phút trước',
      subject: 'Toán học',
      title: 'Hỏi cách tìm cực trị hàm hợp $f(x^3 - 3x)$ trong đề khảo sát HSA 2026',
      content: 'Chào các bạn, mình đang gặp khó ở câu vận dụng cao về cực trị hàm số liên quan đến phép biến đổi $f(u)$. Có bạn nào có công thức tính nhanh đạo hàm cấp 1 hoặc bảng biến thiên mẫu không ạ?',
      likes: 24,
      isLiked: false,
      comments: [
        { id: 'c1', author: 'Lê Hoàng', text: 'Bạn đạo hàm $u\'(x) \\cdot f\'(u) = 0$ rồi vẽ bảng ghép trục nhé, 1 phút là ra!', time: '10 phút trước' },
      ],
    },
    {
      id: 'p2',
      author: 'Trần Thu Hà',
      avatar: 'H',
      time: '1 giờ trước',
      subject: 'Hóa học',
      title: 'Chia sẻ sơ đồ tư duy toàn bộ lý thuyết Este - Lipit - Peptit trọng tâm',
      content: 'Mình vừa tổng hợp lại toàn bộ lý thuyết và các phản ứng đặc trưng thường gặp trong đề thi tốt nghiệp THPT 2026. Chúc cả nhà ôn thi thật tốt nhé!',
      likes: 58,
      isLiked: true,
      comments: [
        { id: 'c2', author: 'Phạm Nam', text: 'Cảm ơn bạn nhiều, tài liệu rất chi tiết!', time: '45 phút trước' },
      ],
    },
    {
      id: 'p3',
      author: 'Vũ Đức Duy',
      avatar: 'D',
      time: '3 giờ trước',
      subject: 'TSA',
      title: 'Kinh nghiệm phân bổ thời gian phần Tư duy Khoa học giải quyết vấn đề TSA',
      content: 'Kỳ thi TSA năm nay đòi hỏi phản xạ đọc biểu đồ và dữ liệu rất nhanh. Mọi người nên dành 25 phút đầu cho đọc hiểu và 35 phút cho khoa học.',
      likes: 42,
      isLiked: false,
      comments: [],
    },
  ])

  // CREATE NEW POST MODAL STATE
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostSubject, setNewPostSubject] = useState('Toán học')
  const [creatingPost, setCreatingPost] = useState(false)

  // COMMENT INPUT STATE
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  // DIRECT CHAT MESSAGES STATE (REAL-TIME ROOM)
  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: 'm1', sender: 'Nguyễn Văn An', text: 'Chào mọi người! Tối nay có ai luyện đề Toán THPT trên SenExam không?', time: '17:15', isMe: false },
    { id: 'm2', sender: 'Trần Mai', text: 'Có mình nè! Mình đang làm đề HSA số 02 trên kho đề mới.', time: '17:18', isMe: false },
    { id: 'm3', sender: 'Admin SenExam', text: '🔥 Đã mở cổng đổi Gift Code sự kiện và bảng tin thông báo mới tại Sen Media nhé các sĩ tử!', time: '17:20', isMe: false, isAdmin: true },
  ])
  const [chatInput, setChatInput] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)

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

      setCurrentUser(user)
      await ensureStudentProfile(user.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setUserProfile(p)
      setLoading(false)
    }

    init()
  }, [router])

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

  // THÍCH BÀI VIẾT
  const handleLikePost = (postId: string) => {
    setPosts(
      posts.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked
          return { ...p, isLiked, likes: isLiked ? p.likes + 1 : p.likes - 1 }
        }
        return p
      })
    )
  }

  // TẠO BÀI VIẾT DIỄN ĐÀN MỚI
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostTitle.trim() || !newPostContent.trim()) return

    setCreatingPost(true)
    const newPost = {
      id: 'p_' + Date.now(),
      author: userProfile?.full_name || currentUser?.email || 'Bạn',
      avatar: (userProfile?.full_name || 'B').charAt(0).toUpperCase(),
      time: 'Vừa xong',
      subject: newPostSubject,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      likes: 0,
      isLiked: false,
      comments: [],
    }

    setPosts([newPost, ...posts])
    setNewPostTitle('')
    setNewPostContent('')
    setShowCreateModal(false)
    setCreatingPost(false)
  }

  // BÌNH LUẬN DƯỚI BÀI VIẾT
  const handleAddComment = (postId: string) => {
    const text = (commentInputs[postId] || '').trim()
    if (!text) return

    setPosts(
      posts.map((p) => {
        if (p.id === postId) {
          const newComment = {
            id: 'c_' + Date.now(),
            author: userProfile?.full_name || currentUser?.email || 'Bạn',
            text: text,
            time: 'Vừa xong',
          }
          return { ...p, comments: [...p.comments, newComment] }
        }
        return p
      })
    )

    setCommentInputs({ ...commentInputs, [postId]: '' })
  }

  // GỬI TIN NHẮN TRÒ CHUYỆN TRỰC TIẾP
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const newMsg = {
      id: 'm_' + Date.now(),
      sender: userProfile?.full_name || 'Tôi',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    }

    setChatMessages([...chatMessages, newMsg])
    setChatInput('')
  }

  const filteredPosts = posts.filter((p) => {
    const matchTag = selectedTag === 'Tất cả' || p.subject === selectedTag
    const q = searchQuery.toLowerCase().trim()
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    return matchTag && matchQ
  })

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="font-bold text-sm">Đang kết nối không gian Sen Media...</span>
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
                  Online
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
                Cộng Đồng Sĩ Tử & Trò Chuyện Trực Tuyến
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
            <MessageSquare className="h-4 w-4 text-indigo-500" /> Diễn Đàn & Hỏi Đáp Sĩ Tử
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
              {/* Search Bar */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bài viết, câu hỏi, tài liệu ôn thi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-10 pr-4 text-xs font-semibold outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Posts List */}
              <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-12 text-center text-[#6B7280] space-y-2">
                    <MessageSquare className="h-10 w-10 mx-auto opacity-40" />
                    <p className="text-xs font-bold">Chưa có bài viết nào trong chủ đề này. Hãy là người đầu tiên đặt câu hỏi!</p>
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-6 shadow-sm backdrop-blur-xl space-y-3 transition hover:shadow-md"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-sm shadow-sm">
                            {post.avatar}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">{post.author}</h4>
                            <span className="text-[10px] text-[#6B7280] dark:text-slate-400">{post.time}</span>
                          </div>
                        </div>

                        <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-0.5 text-[10px] font-black border border-indigo-500/20">
                          {post.subject}
                        </span>
                      </div>

                      {/* Post Content */}
                      <div>
                        <h3 className="text-base font-black leading-snug" style={{ fontFamily: 'var(--font-newmedia-heading)' }}>
                          {post.title}
                        </h3>
                        <p className="mt-1 text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
                          {post.content}
                        </p>
                      </div>

                      {/* Post Action Footer */}
                      <div className="pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleLikePost(post.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition ${
                              post.isLiked
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : 'hover:bg-black/5 text-[#6B7280]'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                            <span>{post.likes}</span>
                          </button>

                          <span className="inline-flex items-center gap-1 text-[#6B7280] font-bold">
                            <MessageCircle className="h-4 w-4" /> {post.comments.length} thảo luận
                          </span>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2.5">
                        {post.comments.map((cmt: any) => (
                          <div key={cmt.id} className="rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-900 dark:text-white">{cmt.author}</strong>
                              <span className="text-[10px] text-[#6B7280]">{cmt.time}</span>
                            </div>
                            <p className="text-[#4B5563] dark:text-slate-300 font-medium">{cmt.text}</p>
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
                  ))
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
            </div>

            {/* Chat Messages Log */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-[#6B7280] dark:text-slate-400 px-1 mb-0.5">
                    {msg.sender} • {msg.time}
                  </span>
                  <div
                    className={`max-w-md rounded-2xl p-3 text-xs font-semibold shadow-sm ${
                      msg.isAdmin
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold'
                        : msg.isMe
                        ? 'bg-indigo-600 text-white'
                        : 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChatMessage} className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập tin nhắn trò chuyện với bạn bè sĩ tử..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="h-12 flex-1 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-xs sm:text-sm font-semibold outline-none focus:border-cyan-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
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
                  Đăng Bài Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
