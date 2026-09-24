'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  ArrowLeft, MessageCircle, Clock, User,
  Send, Loader2, Download, FileText, Pin, PinOff, Trash2
} from 'lucide-react'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'

const glassCardStyles = "liquid-panel"

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [currentUserRole, setCurrentUserRole] = useState('student')

  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const fetchData = async () => {
    const postId = params.id as string

    // Get current user role
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentUserRole(profile?.role || 'student')
    }

    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('*, profiles:user_id (full_name, role, school)')
      .eq('id', postId)
      .single()

    if (postError || !postData) {
      alert('Bài viết không tồn tại hoặc đã bị xóa!')
      router.push('/forum')
      return
    }

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles:user_id (full_name, role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    setPost(postData)
    setComments(commentsData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) {
      document.documentElement.classList.add('dark')
    }
    setIsDark(dark)
  }, [params.id, router])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('comments').insert({
      post_id: post.id, user_id: user.id, content: newComment
    })

    if (error) alert('Lỗi gửi bình luận: ' + error.message)
    else { setNewComment(''); await fetchData() }
    setIsSubmitting(false)
  }

  // 🌟 HÀM XÓA BÀI TỪ TRONG TRANG CHI TIẾT
  const handleDeletePost = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn bài đăng này khỏi hệ thống?')) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) alert('Lỗi xóa bài: ' + error.message)
    else router.push('/forum')
  }

  // 🌟 HÀM GHIM TỪ TRONG TRANG CHI TIẾT
  const handleTogglePin = async () => {
    const { error } = await supabase.from('posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id)
    if (error) alert('Lỗi ghim bài: ' + error.message)
    else await fetchData()
  }

  const timeAgo = (dateString: string) => {
    const now = new Date(); const past = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)
    if (diffInSeconds < 60) return `${diffInSeconds} giây trước`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`
    return past.toLocaleDateString('vi-VN')
  }

  if (loading) {
    if (newUiEnabled) {
      return <ModernLoading themeColor={themeColor} isDark={isDark} label="Đang tải bài viết..." />
    }
    return <div className="app-shell min-h-screen flex items-center justify-center bg-transparent"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>
  }

  const canManage = currentUserRole === 'admin' || currentUserRole === 'collab'

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans pb-20"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button onClick={() => router.push('/forum')} className="flex items-center gap-2 text-sm font-medium mb-6 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="w-4 h-4" /> Trở về Hội Sĩ Tử
          </button>

          <div
            className="rounded-2xl p-6 md:p-10 mb-8"
            style={{ background: 'var(--surface)', border: post.is_pinned ? '1px solid var(--accent)' : '1px solid var(--border)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {post.category}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleString('vi-VN')}
                </span>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePin}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    {post.is_pinned ? <><PinOff className="w-3.5 h-3.5" /> Bỏ ghim</> : <><Pin className="w-3.5 h-3.5" /> Ghim lên đầu</>}
                  </button>
                  <button
                    onClick={handleDeletePost}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    style={{ border: '1px solid var(--border)', color: '#DC2626' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa bài
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold mb-6 leading-snug flex items-start gap-3">
              {post.is_pinned && <Pin className="w-6 h-6 rotate-45 shrink-0 mt-1" style={{ color: 'var(--accent)' }} />}
              {post.title}
            </h1>

            <div className="flex items-center gap-3 pb-6 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {post.profiles?.full_name?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  {post.profiles?.full_name || 'Thành viên ẩn danh'}
                  {(post.profiles?.role === 'admin' || post.profiles?.role === 'collab') && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>QUẢN TRỊ</span>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.profiles?.school || 'Chưa cập nhật trường'}</p>
              </div>
            </div>

            <div className="text-base leading-relaxed font-normal whitespace-pre-wrap mb-8">
              {post.content}
            </div>

            {post.drive_file_id && (
              <div className="mt-6 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{post.file_name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Dung lượng: {post.file_size}</p>
                  </div>
                </div>

                <a
                  href={`https://drive.google.com/file/d/${post.drive_file_id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 px-5 py-2.5 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Download className="w-4 h-4" /> Tải xuống tài liệu
                </a>
              </div>
            )}
          </div>

          {/* COMMENTS SECTION */}
          <div className="rounded-2xl p-6 md:p-10" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-8">
              <MessageCircle className="w-5 h-5" style={{ color: 'var(--accent)' }} /> Bình luận ({comments.length})
            </h3>

            <form onSubmit={handleAddComment} className="mb-10 relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full min-h-[120px] rounded-2xl p-4 outline-none resize-y text-sm font-normal bg-transparent"
                style={{ border: '1px solid var(--border)' }}
                placeholder="Chia sẻ ý kiến hoặc câu trả lời của bạn..."
                required
              />
              <div className="flex justify-end mt-3">
                <button type="submit" disabled={isSubmitting || !newComment.trim()} className="px-6 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2" style={{ background: 'var(--accent)', color: '#fff' }}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gửi bình luận
                </button>
              </div>
            </form>

            <div className="space-y-6">
              {comments.length === 0 ? (
                <div className="text-center py-8 font-medium" style={{ color: 'var(--text-muted)' }}>Chưa có bình luận nào. Hãy là người đầu tiên lên tiếng!</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold shrink-0" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                      {comment.profiles?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 rounded-2xl p-4 relative" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {comment.profiles?.full_name || 'Ẩn danh'}
                          {(comment.profiles?.role === 'admin' || comment.profiles?.role === 'collab') && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>QUẢN TRỊ</span>
                          )}
                        </p>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap font-normal">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent text-slate-900 dark:text-slate-100 relative font-sans overflow-x-hidden pb-20">
      
      {/* BACKGROUND ORBS */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-800/35 dark:to-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 bounce-float pointer-events-none"></div>
      <div className="fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-t from-purple-300/25 to-pink-400/18 dark:from-purple-900/25 dark:to-pink-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 bounce-float-delayed pointer-events-none" style={{ animationDelay: '3s' }}></div>

      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto">
        
        <button onClick={() => router.push('/forum')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Trở về Hội Sĩ Tử
        </button>

        <div className={`${glassCardStyles} ${post.is_pinned ? 'ring-2 ring-orange-400/50 dark:ring-orange-500/30' : ''} rounded-[2rem] p-6 md:p-10 mb-8 border-t-white/60 border-l-white/60 shadow-lg`}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-black uppercase tracking-wider backdrop-blur-sm shadow-sm border border-blue-200/50 dark:border-blue-800/50">
                {post.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleString('vi-VN')}
              </span>
            </div>

            {/* 🌟 NÚT QUẢN LÝ Ở TRANG CHI TIẾT */}
            {canManage && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleTogglePin} 
                  className="px-3 py-1.5 bg-white/60 dark:bg-slate-700/60 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg text-xs font-bold border border-white/40 dark:border-slate-600 transition-colors backdrop-blur-sm flex items-center gap-1.5"
                >
                  {post.is_pinned ? <><PinOff className="w-3.5 h-3.5"/> Bỏ ghim</> : <><Pin className="w-3.5 h-3.5"/> Ghim lên đầu</>}
                </button>
                <button 
                  onClick={handleDeletePost} 
                  className="px-3 py-1.5 bg-white/60 dark:bg-slate-700/60 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-bold border border-white/40 dark:border-slate-600 transition-colors backdrop-blur-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5"/> Xóa bài
                </button>
              </div>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-6 leading-snug drop-shadow-sm flex items-start gap-3">
            {post.is_pinned && <Pin className="w-8 h-8 text-orange-500 fill-orange-500 rotate-45 shrink-0 mt-1" />}
            {post.title}
          </h1>

          <div className="flex items-center gap-3 pb-6 border-b border-slate-300/50 dark:border-slate-700/50 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
              {post.profiles?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                {post.profiles?.full_name || 'Thành viên ẩn danh'}
                {(post.profiles?.role === 'admin' || post.profiles?.role === 'collab') && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">QUẢN TRỊ</span>}
              </p>
              <p className="text-xs text-slate-500 font-medium">{post.profiles?.school || 'Chưa cập nhật trường'}</p>
            </div>
          </div>

          <div className="text-slate-700 dark:text-slate-300 text-base leading-relaxed font-medium whitespace-pre-wrap mb-8">
            {post.content}
          </div>

          {post.drive_file_id && (
            <div className="mt-6 p-5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{post.file_name}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Dung lượng: {post.file_size}</p>
                </div>
              </div>
              
              <a 
                href={`https://drive.google.com/file/d/${post.drive_file_id}/view`} 
                target="_blank" 
                rel="noreferrer"
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" /> Tải xuống tài liệu
              </a>
            </div>
          )}
        </div>

        {/* COMMENTS SECTION */}
        <div className={`${glassCardStyles} rounded-[2rem] p-6 md:p-10 border-t-white/60 border-l-white/60`}>
          <h3 className="text-xl font-extrabold flex items-center gap-2 mb-8 drop-shadow-sm">
            <MessageCircle className="w-6 h-6 text-blue-500" /> Bình luận ({comments.length})
          </h3>

          <form onSubmit={handleAddComment} className="mb-10 relative">
            <textarea 
              value={newComment} 
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full min-h-[120px] bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-slate-700/50 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md shadow-inner resize-y text-sm font-medium" 
              placeholder="Chia sẻ ý kiến hoặc câu trả lời của bạn..." 
              required 
            />
            <div className="flex justify-end mt-3">
              <button type="submit" disabled={isSubmitting || !newComment.trim()} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all hover:-translate-y-0.5">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Gửi bình luận
              </button>
            </div>
          </form>

          <div className="space-y-6">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 font-medium">Chưa có bình luận nào. Hãy là người đầu tiên lên tiếng!</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-4 group">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0 shadow-inner">
                    {comment.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        {comment.profiles?.full_name || 'Ẩn danh'}
                        {(comment.profiles?.role === 'admin' || comment.profiles?.role === 'collab') && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm">QUẢN TRỊ</span>}
                      </p>
                      <span className="text-xs font-bold text-slate-400">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}