'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { 
  MessageSquare, Edit3, Search, ChevronLeft, 
  MessageCircle, Clock, User, Filter, X, Loader2, Send, Paperclip, FileIcon, Download,
  Pin, PinOff, Trash2
} from 'lucide-react'

import { glassSearchInputClass, highlightSearchText } from '@/app/components/searchUtils'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'

const glassCardStyles = "liquid-panel"
const CATEGORIES = ['Tất cả', 'Hỏi đáp bài tập', 'Chia sẻ tài liệu', 'Thảo luận chung', 'Góc tâm sự']

export default function ForumPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<any[]>([])
  
  const [currentUserRole, setCurrentUserRole] = useState('student')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [activeCategory, setActiveCategory] = useState('Tất cả')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('Hỏi đáp bài tập')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  const fetchPosts = async () => {
    // Sắp xếp ưu tiên bài được ghim (is_pinned) lên trước, sau đó mới tới thời gian mới nhất
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (full_name, school, role),
        comments (count)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPosts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setCurrentUserRole(profile?.role || 'student')
      }
      await fetchPosts()
    }
    initData()

    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) {
      document.documentElement.classList.add('dark')
    }
    setIsDark(dark)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 1024 * 1024 * 1024) {
        alert('File quá lớn! Vui lòng chọn file có dung lượng dưới 1GB.')
        setAttachedFile(null); e.target.value = ''; return
      }
      setAttachedFile(file)
    }
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes'
    const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      let driveFileId = null; let fileName = null; let fileSize = null

      if (attachedFile) {
        setUploadStatus('Đang khởi tạo kết nối Google Drive...')
        const uploadUrl = await initGoogleDriveUpload(attachedFile.name, attachedFile.type || 'application/octet-stream')

        setUploadStatus('Đang đẩy tài liệu trực tiếp lên Google Drive...')
        const uploadData = await uploadFileToGoogleDrive(uploadUrl, attachedFile, attachedFile.name)
        driveFileId = uploadData.id; fileName = attachedFile.name; fileSize = formatBytes(attachedFile.size)
      }

      setUploadStatus('Đang lưu bài viết...')
      const { error } = await supabase.from('posts').insert({
        title: newTitle, content: newContent, category: newCategory, user_id: user.id, drive_file_id: driveFileId, file_name: fileName, file_size: fileSize
      })

      if (error) throw error
      setShowCreateModal(false); setNewTitle(''); setNewContent(''); setAttachedFile(null); setUploadStatus('')
      await fetchPosts()
    } catch (err: any) { alert('Lỗi đăng bài: ' + err.message); setUploadStatus('') } 
    finally { setIsSubmitting(false) }
  }

  // 🌟 HÀM XÓA BÀI VIẾT CHO ADMIN/COLLAB
  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation() // Ngăn không cho click chuyển trang
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn bài đăng này khỏi hệ thống?')) return
    
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) alert('Lỗi xóa bài: ' + error.message)
    else await fetchPosts()
  }

  // 🌟 HÀM GHIM / BỎ GHIM BÀI VIẾT CHO ADMIN/COLLAB
  const handleTogglePin = async (e: React.MouseEvent, postId: string, currentPinStatus: boolean) => {
    e.stopPropagation()
    const { error } = await supabase.from('posts').update({ is_pinned: !currentPinStatus }).eq('id', postId)
    if (error) alert('Lỗi ghim bài: ' + error.message)
    else await fetchPosts()
  }

  const filteredPosts = posts.filter(post => {
    const matchCat = activeCategory === 'Tất cả' || post.category === activeCategory
    const searchTerm = deferredSearchQuery.toLowerCase()
    const matchSearch = post.title.toLowerCase().includes(searchTerm) || post.content.toLowerCase().includes(searchTerm)
    return matchCat && matchSearch
  })

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
      return (
        <div className="min-h-screen flex items-center justify-center font-sans" style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )
    }
    return <div className="app-shell min-h-screen flex items-center justify-center bg-transparent"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>
  }

  const canManage = currentUserRole === 'admin' || currentUserRole === 'collab'

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans pb-16"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Edit3 className="w-5 h-5" style={{ color: 'var(--accent)' }}/> Chủ đề thảo luận mới</h2>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"><X className="w-4 h-4"/></button>
                </div>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Chủ đề bài viết (*)</label>
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none bg-transparent" style={{ border: '1px solid var(--border)' }} placeholder="VD: Xin tài liệu ôn tập Toán ĐGNL..." required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Chuyên mục</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full sm:w-1/2 rounded-lg px-3 py-2.5 text-sm outline-none bg-transparent" style={{ border: '1px solid var(--border)' }}>
                      {CATEGORIES.filter(c => c !== 'Tất cả').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nội dung chi tiết (*)</label>
                    <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full min-h-[130px] rounded-lg px-3 py-2.5 text-sm outline-none bg-transparent resize-y" style={{ border: '1px solid var(--border)' }} placeholder="Nhập nội dung chia sẻ hoặc câu hỏi..." required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Đính kèm tài liệu (Max 1GB)</label>
                    <div className="relative flex items-center justify-center p-5 rounded-xl cursor-pointer" style={{ border: '1px dashed var(--border)' }}>
                      <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="flex flex-col items-center gap-1.5 pointer-events-none text-center">
                        <Paperclip className="w-5 h-5" style={{ color: 'var(--accent)' }}/>
                        {attachedFile ? (
                          <><p className="text-sm font-medium truncate max-w-[250px]">{attachedFile.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(attachedFile.size)}</p></>
                        ) : (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nhấn hoặc kéo thả file vào đây</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSubmitting && (
                    <div className="p-3 rounded-lg text-sm font-medium flex items-center gap-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> {uploadStatus}
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isSubmitting || !newTitle || !newContent} className="px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Xuất bản
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-opacity ${showCreateModal ? 'opacity-30 pointer-events-none' : ''}`}>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft className="w-4 h-4" /> Về trang chủ
          </button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">Hội Sĩ Tử <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent)' }}/></h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Giải đáp thắc mắc, chia sẻ tài liệu và thảo luận đề thi.</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2" style={{ background: 'var(--accent)', color: '#fff' }}>
              <Edit3 className="w-4 h-4"/> Đăng chủ đề mới
            </button>
          </div>

          <div className="rounded-xl p-3 flex flex-col sm:flex-row gap-3 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Tìm kiếm câu hỏi, tài liệu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none bg-transparent" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={activeCategory === cat ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}>{cat}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl p-16 text-center" style={{ border: '1px dashed var(--border)' }}>
                <MessageCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <h3 className="font-medium">Chưa có bài thảo luận nào</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Hãy là người đầu tiên khơi mào chủ đề này!</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => router.push(`/forum/${post.id}`)}
                  className="rounded-xl p-5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] group"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-base font-semibold line-clamp-2 flex items-center gap-1.5">
                      {post.is_pinned && <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />}
                      {highlightSearchText(post.title, deferredSearchQuery)}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{post.category}</span>
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => handleTogglePin(e, post.id, post.is_pinned)} title={post.is_pinned ? "Bỏ ghim" : "Ghim"} className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                            {post.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={(e) => handleDeletePost(e, post.id)} title="Xóa" className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{highlightSearchText(post.content, deferredSearchQuery)}</p>
                  {post.drive_file_id && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <Download className="w-3.5 h-3.5"/> {post.file_name}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 text-xs font-medium" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {post.profiles?.full_name || 'Thành viên ẩn danh'}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeAgo(post.created_at)}</span>
                    </div>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments?.[0]?.count || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent text-slate-900 dark:text-slate-100 relative font-sans overflow-x-hidden pb-20">
      
      {/* BACKGROUND ORBS */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-800/35 dark:to-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 bounce-float pointer-events-none"></div>
      <div className="fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-t from-purple-300/25 to-pink-400/18 dark:from-purple-900/25 dark:to-pink-900/18 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[150px] opacity-70 bounce-float-delayed pointer-events-none"></div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
           <div className={`${glassCardStyles} rounded-[2rem] w-full max-w-3xl max-h-[95vh] overflow-y-auto custom-scrollbar border-t-white/70 border-l-white/70 dark:border-t-white/20 dark:border-l-white/20`}>
            <div className="p-8">
              <div className="flex justify-between items-center mb-6 border-b border-slate-300/50 dark:border-white/20 pb-4">
                <h2 className="text-2xl font-extrabold flex items-center gap-2"><Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-500"/> Khởi tạo chủ đề thảo luận</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 bg-white/40 hover:bg-white/60 dark:bg-slate-800/50 rounded-full transition-colors"><X className="w-5 h-5"/></button>
              </div>
              
              <form onSubmit={handleCreatePost} className="space-y-5">
                <div><label className="block text-sm font-bold mb-2">Chủ đề bài viết (*)</label><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md shadow-inner" placeholder="VD: Xin tài liệu ôn tập Toán ĐGNL..." required /></div>
                <div><label className="block text-sm font-bold mb-2">Chuyên mục phân loại</label><select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full sm:w-1/2 bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none backdrop-blur-md shadow-inner font-bold text-sm">{CATEGORIES.filter(c => c !== 'Tất cả').map(c => <option key={c} value={c} className="dark:bg-slate-800">{c}</option>)}</select></div>
                <div><label className="block text-sm font-bold mb-2">Nội dung chi tiết (*)</label><textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full min-h-[150px] bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-slate-700/50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md shadow-inner resize-y" placeholder="Nhập nội dung chia sẻ hoặc câu hỏi của bạn vào đây..." required /></div>
                
                <div>
                  <label className="block text-sm font-bold mb-2">Đính kèm tài liệu (Mọi định dạng, Max 1GB)</label>
                  <div className="relative flex items-center justify-center p-6 border-2 border-dashed border-blue-400/50 dark:border-blue-500/30 rounded-2xl bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group">
                    <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                      {attachedFile ? (
                        <><div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg"><FileIcon className="w-6 h-6"/></div><p className="font-bold text-sm text-blue-700 dark:text-blue-400 truncate max-w-[250px]">{attachedFile.name}</p><p className="text-xs font-bold text-slate-500">{formatBytes(attachedFile.size)}</p></>
                      ) : (
                        <><div className="w-12 h-12 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Paperclip className="w-5 h-5 text-blue-500"/></div><p className="font-bold text-sm text-slate-600 dark:text-slate-300">Nhấn hoặc kéo thả file đính kèm vào đây</p><p className="text-xs font-medium text-slate-500">Hỗ trợ PDF, Word, Excel, Video, ZIP...</p></>
                      )}
                    </div>
                  </div>
                </div>

                {isSubmitting && (<div className="p-3 bg-blue-100/80 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-sm font-bold flex items-center gap-2 animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /> {uploadStatus}</div>)}

                <div className="flex justify-end pt-4 border-t border-slate-300/50 dark:border-white/10">
                  <button type="submit" disabled={isSubmitting || !newTitle || !newContent} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white px-8 py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(59,130,246,0.4)] flex items-center gap-2 transition-all hover:-translate-y-0.5">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Xuất bản bài viết
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className={`relative z-10 p-4 md:p-8 max-w-6xl mx-auto transition-all duration-500 ${showCreateModal ? 'blur-sm opacity-50 pointer-events-none scale-[0.98]' : ''}`}>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3"><ChevronLeft className="w-4 h-4" /> Trở về Dashboard</button>
            <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm flex items-center gap-3">Hội Sĩ Tử <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400 drop-shadow-md" /></h1>
            <p className="text-slate-600 dark:text-slate-300 font-medium mt-2 bg-white/40 dark:bg-slate-900/40 w-fit px-4 py-1.5 rounded-full backdrop-blur-md border border-white/30 dark:border-slate-700/50">Nơi giải đáp thắc mắc, chia sẻ tài liệu và thảo luận đề thi toàn quốc.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl text-blue-700 dark:text-blue-400 border border-white/50 dark:border-white/10 px-6 py-3.5 rounded-2xl font-black shadow-[0_8px_30px_rgb(0,0,0,0.05)] flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700 transition-all hover:-translate-y-1"><Edit3 className="w-5 h-5"/> Đăng chủ đề mới</button>
        </div>

        <div className={`${glassCardStyles} rounded-2xl p-4 flex flex-col sm:flex-row gap-4 mb-8 border-t-white/60 border-l-white/60`}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
            <input type="text" placeholder="Tìm kiếm câu hỏi, môn học, tài liệu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${glassSearchInputClass} pl-10 pr-4 py-3 shadow-inner`} />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeCategory === cat ? 'bg-gradient-to-r from-blue-500 to-indigo-500 border-blue-500 text-white shadow-md' : 'bg-white/40 dark:bg-slate-800/40 border-white/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {filteredPosts.length === 0 ? (
            <div className={`${glassCardStyles} rounded-[2rem] p-16 text-center flex flex-col items-center justify-center border-t-white/60 border-l-white/60`}>
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-800"><MessageCircle className="w-10 h-10 text-blue-400" /></div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">Chưa có bài thảo luận nào</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium">Hãy là người đầu tiên khơi mào chủ đề này trên diễn đàn!</p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div 
                key={post.id} 
                onClick={() => router.push(`/forum/${post.id}`)}
                className={`${glassCardStyles} ${post.is_pinned ? 'ring-2 ring-orange-400/50 dark:ring-orange-500/30' : ''} rounded-[1.5rem] p-6 hover:-translate-y-1 transition-all duration-300 border-t-white/60 border-l-white/60 cursor-pointer group hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 drop-shadow-sm flex items-center gap-2">
                    {post.is_pinned && <Pin className="w-4 h-4 text-orange-500 fill-orange-500 rotate-45 shrink-0" />}
                    {highlightSearchText(post.title, deferredSearchQuery)}
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <span className="shrink-0 px-3 py-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur-md">
                      {post.category}
                    </span>
                    
                    {/* 🌟 NÚT QUẢN LÝ CHO ADMIN/COLLAB (GHIM & XÓA) */}
                    {canManage && (
                      <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleTogglePin(e, post.id, post.is_pinned)}
                          title={post.is_pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                          className="p-2 sm:p-1.5 bg-white/60 dark:bg-slate-700/60 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 rounded-md border border-white/40 dark:border-slate-600 transition-colors backdrop-blur-sm"
                        >
                          {post.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => handleDeletePost(e, post.id)}
                          title="Xóa bài viết"
                          className="p-2 sm:p-1.5 bg-white/60 dark:bg-slate-700/60 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-md border border-white/40 dark:border-slate-600 transition-colors backdrop-blur-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 font-medium leading-relaxed">
                  {highlightSearchText(post.content, deferredSearchQuery)}
                </p>

                {post.drive_file_id && (
                  <div className="mb-4 inline-flex items-center gap-2 bg-blue-50/80 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl backdrop-blur-sm">
                    <div className="p-1.5 bg-blue-500 rounded-lg text-white"><Download className="w-3.5 h-3.5"/></div>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate max-w-[200px] sm:max-w-[300px]">Đính kèm: {post.file_name}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white/50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md ml-2">{post.file_size}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-300/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg shadow-sm">
                      <User className="w-3.5 h-3.5 text-slate-400" /> 
                      <span className={post.profiles?.role === 'admin' || post.profiles?.role === 'collab' ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}>
                        {post.profiles?.full_name || 'Thành viên ẩn danh'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {timeAgo(post.created_at)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-sm font-black bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50 shadow-sm px-4 py-1.5 rounded-xl">
                    <MessageCircle className="w-4 h-4" /> {post.comments?.[0]?.count || 0}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}