'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, Video, UploadCloud, Loader2, X, Search, 
  PlaySquare, Copy, CheckCircle2, MonitorPlay, Info, Cloud
} from 'lucide-react'

// Tái sử dụng API Upload Drive
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'

// --- CONSTANTS & STYLES ---
const mdCard = "bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl backdrop-saturate-[1.5] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm"
const inputClass = "w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none font-bold text-sm shadow-inner transition-all text-slate-900 dark:text-white"
const headerBtn = "px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-sm transition-all border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-sm"

export default function SenVideoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('student')
  const [videos, setVideos] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({})

  // Upload States
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadStatus, setUploadStatus] = useState({ uploading: false, msg: '' })

  // Video Player & VLC States
  const [activeVideo, setActiveVideo] = useState<any | null>(null)
  const [showVlcInfo, setShowVlcInfo] = useState(false)
  const [copied, setCopied] = useState(false)
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()
  const [isDark, setIsDark] = useState(false)

  // ==========================================================================
  // KHỞI TẠO VÀ LẤY DỮ LIỆU TỪ SUPABASE
  // ==========================================================================
  const fetchVideos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'student'
      setUserRole(role)

      const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin','collab'])
      const adminIds = admins ? admins.map(a => a.id) : []

      const { data, error } = await supabase.from('library_documents').select('*').order('created_at', { ascending: false }).limit(2000)
      if (error) throw error;

      if (data) {
        const vids = data.filter(d => {
          const isVideo = d.title && d.title.match(/\.(mp4|mkv|mov|avi|webm)$/i);
          if (!isVideo) return false;
          if (role === 'student') return d.created_by === user.id || d.created_by === null || adminIds.includes(d.created_by);
          return true;
        })
        setVideos(vids)
      }
    } catch (e) {
      console.error("Lỗi fetch video:", e);
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
    fetchVideos()
  }, [])

  // ==========================================================================
  // XỬ LÝ TẢI LÊN VIDEO (UPLOAD VÀO DRIVE & ĐỒNG BỘ SUPABASE)
  // ==========================================================================
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (uploadFiles.length === 0) return
    
    setUploadStatus({ uploading: true, msg: 'Đang chuẩn bị dữ liệu phân quyền...' })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
      const role = profile?.role || 'student'

      let uploadFolderId = null;
      if (role === 'student') {
        const { data: folders } = await supabase.from('library_folders').select('id').eq('name', 'Student').eq('created_by', user?.id).single();
        if (folders) {
          uploadFolderId = folders.id;
        } else {
          const { data: newFolder } = await supabase.from('library_folders').insert({ name: 'Student', created_by: user?.id, parent_id: null }).select('id').single();
          uploadFolderId = newFolder?.id || null;
        }
      }

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i]
        const fileExt = file.name.split('.').pop() || 'mp4';
        let finalTitle = (uploadFiles.length === 1 && uploadTitle) ? uploadTitle.trim() : file.name;
        
        if (!finalTitle.match(/\.(mp4|mkv|mov|avi|webm)$/i)) finalTitle = `${finalTitle}.${fileExt}`;
        
        setUploadStatus({ uploading: true, msg: `Đang đẩy [${i+1}/${uploadFiles.length}] lên Google Drive...` })
        const url = await initGoogleDriveUpload(finalTitle, file.type)
        const d = await uploadFileToGoogleDrive(url, file, finalTitle)
        
        if (!d?.id) throw new Error('Lỗi từ máy chủ Google Drive')

        setUploadStatus({ uploading: true, msg: `Đang lưu dữ liệu vào hệ thống...` })
        await supabase.from('library_documents').insert({ 
          title: finalTitle, 
          drive_file_id: d.id, 
          created_by: role === 'student' ? user?.id : null,
          folder_id: uploadFolderId
        })
      }
      setUploadStatus({ uploading: false, msg: 'Thành công!' }); setUploadFiles([]); setUploadTitle('')
      setTimeout(() => setShowUpload(false), 1000); 
      fetchVideos()
    } catch (err: any) { 
      setUploadStatus({ uploading: false, msg: `Lỗi: ${err.message}` }) 
    }
  }

  // ==========================================================================
  // XỬ LÝ LẤY LINK STREAM & VIDEO PLAYER
  // ==========================================================================
  const streamLink = activeVideo ? `${window.location.origin}/api/drive/stream?fileId=${activeVideo.drive_file_id}` : ''
  const handleCopy = () => {
    navigator.clipboard.writeText(streamLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const displayVideos = videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) {
    if (newUiEnabled) {
      return (
        <div className="min-h-screen flex items-center justify-center font-sans" style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )
    }
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
  }

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans pb-16"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="p-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"><ArrowLeft className="w-4 h-4"/></button>
            <h1 className="font-semibold text-base flex items-center gap-2"><PlaySquare className="w-4 h-4" style={{ color: 'var(--accent)' }}/> SenVideo</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Tìm video..." className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none bg-transparent" style={{ border: '1px solid var(--border)' }} />
            </div>
            <button onClick={() => setShowUpload(true)} className="px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5" style={{ background: 'var(--accent)', color: '#fff' }}><UploadCloud className="w-4 h-4"/> Tải Video</button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {displayVideos.length === 0 ? (
            <div className="rounded-2xl p-16 text-center" style={{ border: '1px dashed var(--border)' }}>
              <Video className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }}/>
              <p className="font-medium">Kho video trống</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bấm "Tải Video" góc trên để lưu bài giảng nhé!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayVideos.map(vid => (
                <div key={vid.id} onClick={() => { setActiveVideo(vid); setShowVlcInfo(false); }} className="group cursor-pointer rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-full aspect-video rounded-lg flex items-center justify-center mb-2 relative overflow-hidden" style={{ background: 'var(--accent-soft)' }}>
                    {failedThumbs[vid.id] ? (
                      <PlaySquare className="w-6 h-6" style={{ color: 'var(--accent)' }}/>
                    ) : (
                      <img
                        src={`/api/drive/thumbnail?fileId=${vid.drive_file_id}`}
                        alt={vid.title}
                        loading="lazy"
                        onError={() => setFailedThumbs(prev => ({ ...prev, [vid.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <h3 className="text-xs font-medium line-clamp-2 leading-snug">{vid.title}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/70">
            <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="p-4 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-medium text-sm truncate pr-4 flex items-center gap-2"><MonitorPlay className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }}/> {activeVideo.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setShowVlcInfo(!showVlcInfo)} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Cloud className="w-3.5 h-3.5"/> VLC
                  </button>
                  <button onClick={() => {setActiveVideo(null); setCopied(false); setShowVlcInfo(false)}} className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><X className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-black flex flex-col relative">
                <video src={streamLink} controls autoPlay playsInline className="w-full h-full max-h-[70vh] object-contain bg-black outline-none" />
                {showVlcInfo && (
                  <div className="absolute top-0 left-0 w-full p-5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-sm flex items-center gap-2"><Info className="w-4 h-4" style={{ color: 'var(--accent)' }}/> Mở qua VLC (chống giật lag)</h4>
                      <button onClick={() => setShowVlcInfo(false)} className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><X className="w-3.5 h-3.5"/></button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input readOnly value={streamLink} className="flex-1 rounded-lg px-3 py-2 text-xs font-mono outline-none bg-transparent" style={{ border: '1px solid var(--border)' }} />
                      <button onClick={handleCopy} className="px-4 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
                        {copied ? <CheckCircle2 className="w-4 h-4"/> : <Copy className="w-4 h-4"/>} {copied ? 'Đã chép' : 'Copy'}
                      </button>
                    </div>
                    <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: 'var(--text-muted)' }}>
                      <li>Mở <strong>VLC Media Player</strong>.</li>
                      <li>Vào <strong>Media → Open Network Stream</strong> (Ctrl+N).</li>
                      <li>Dán link vừa copy và bấm <strong>Play</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showUpload && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md rounded-2xl p-6 relative" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <button onClick={() => setShowUpload(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><X className="w-4 h-4"/></button>
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><UploadCloud className="w-4 h-4" style={{ color: 'var(--accent)' }}/> Upload Video</h3>
              <form onSubmit={handleUpload} className="space-y-3">
                {uploadFiles.length <= 1 && (
                  <input type="text" value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} placeholder="Tên hiển thị (nếu trống lấy tên file)..." className="w-full rounded-lg px-3 py-2.5 text-sm outline-none bg-transparent" style={{ border: '1px solid var(--border)' }} />
                )}
                <div className="rounded-xl p-5 text-center relative cursor-pointer" style={{ border: '1px dashed var(--border)' }}>
                  <input type="file" accept="video/*" multiple onChange={e=>setUploadFiles(Array.from(e.target.files||[]))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Video className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{uploadFiles.length > 0 ? `Đã chọn ${uploadFiles.length} video` : 'Kéo thả video vào đây'}</p>
                </div>
                {uploadStatus.msg && <div className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{uploadStatus.msg}</div>}
                <button type="submit" disabled={uploadStatus.uploading} className="w-full py-2.5 rounded-lg text-sm font-medium flex justify-center items-center gap-2" style={{ background: 'var(--accent)', color: '#fff' }}>
                  {uploadStatus.uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Tải lên Drive'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER */}
      <header className="h-[80px] bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 transition-transform"><ArrowLeft className="w-5 h-5"/></button>
          <div><h1 className="font-black text-xl flex items-center gap-2"><PlaySquare className="text-indigo-500"/> SenVideo</h1><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lưu trữ & Stream mượt mà</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Tìm video..." className={`${inputClass} pl-10 py-2.5`} />
          </div>
          <button onClick={() => setShowUpload(true)} className={`${headerBtn} bg-indigo-600 text-white hover:bg-indigo-700 border-none`}><UploadCloud className="w-4 h-4"/> Tải Video</button>
        </div>
      </header>

      {/* Ô TÌM KIẾM RIÊNG CHO MOBILE (ẩn trên md+ vì đã có ở header) */}
      <div className="md:hidden px-4 pt-4 relative z-10">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Tìm video..." className={`${inputClass} w-full pl-10 py-2.5`} />
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="max-w-[1400px] mx-auto pt-4 md:pt-8 px-4 md:px-8 relative z-10">
        <div className={`${mdCard} p-6 md:p-8 min-h-[70vh]`}>
          
          {displayVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 opacity-50">
              <Video className="w-20 h-20 mb-4 text-slate-400"/>
              <p className="font-black text-lg">Kho video trống</p>
              <p className="text-sm font-bold text-slate-500 mt-2">Bấm 'Tải Video' góc trên để lưu bài giảng nhé!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in">
              {displayVideos.map(vid => (
                <div key={vid.id} onClick={() => { setActiveVideo(vid); setShowVlcInfo(false); }} className="group cursor-pointer bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-[1.5rem] p-4 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="w-full aspect-video bg-indigo-100 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                    {failedThumbs[vid.id] ? (
                      <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-125 transition-transform"><PlaySquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/></div>
                    ) : (
                      <>
                        <img
                          src={`/api/drive/thumbnail?fileId=${vid.drive_file_id}`}
                          alt={vid.title}
                          loading="lazy"
                          onError={() => setFailedThumbs(prev => ({ ...prev, [vid.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all"><PlaySquare className="w-6 h-6 text-white"/></div>
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] text-white font-bold">DRIVE MP4</div>
                  </div>
                  <h3 className="font-black text-[13px] line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">{vid.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">{new Date(vid.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🌟 MODAL VIDEO PLAYER & TÍCH HỢP VLC STREAM */}
      {/* ========================================================= */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className={`${mdCard} w-full max-w-5xl p-0 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 border border-slate-200 dark:border-white/10`}>
            
            {/* Header Modal */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1A1A1A]/50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2 text-indigo-600 dark:text-indigo-400 truncate pr-4">
                <MonitorPlay className="w-6 h-6 shrink-0"/> <span className="truncate">{activeVideo.title}</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowVlcInfo(!showVlcInfo)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm ${showVlcInfo ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'}`}>
                  <Cloud className="w-4 h-4"/> <span className="hidden sm:inline">VLC Stream</span>
                </button>
                <button onClick={() => {setActiveVideo(null); setCopied(false); setShowVlcInfo(false)}} className="p-2 bg-slate-200 dark:bg-[#202020] rounded-full hover:scale-105 hover:bg-rose-100 hover:text-rose-500 transition-all"><X className="w-5 h-5"/></button>
              </div>
            </div>

            {/* Khung chứa Video và Bảng hướng dẫn VLC */}
            <div className="flex-1 overflow-hidden bg-black flex flex-col relative">
              
              {/* Web Video Player */}
              <video 
                src={streamLink} 
                controls 
                autoPlay 
                playsInline
                className="w-full h-full max-h-[75vh] object-contain bg-black outline-none"
              />

              {/* Bảng hướng dẫn VLC (Trượt xuống đè lên video nếu bật) */}
              {showVlcInfo && (
                <div className="absolute top-0 left-0 w-full p-6 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl z-10 border-b border-slate-200 dark:border-white/10 animate-in slide-in-from-top-4 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-2"><Info className="w-5 h-5"/> Mở rộng qua VLC (Chống giật lag)</h4>
                    <button onClick={() => setShowVlcInfo(false)} className="p-1.5 bg-slate-100 dark:bg-[#2A2A2A] rounded-lg hover:text-rose-500"><X className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="relative mb-4">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">Copy Link Stream API này vào VLC:</label>
                    <div className="flex gap-2">
                      <input readOnly value={streamLink} className={`${inputClass} !text-indigo-600 dark:!text-indigo-400 !bg-indigo-50 dark:!bg-indigo-900/10 truncate font-mono`} />
                      <button onClick={handleCopy} className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shrink-0 shadow-md">
                        {copied ? <CheckCircle2 className="w-5 h-5"/> : <Copy className="w-5 h-5"/>} <span className="hidden sm:inline">{copied ? 'Đã chép' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <ol className="text-[13px] font-medium text-amber-800 dark:text-amber-500 space-y-2.5 list-decimal list-inside bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <li>Tải và mở phần mềm <strong>VLC Media Player</strong> trên máy tính/điện thoại.</li>
                    <li>Trên menu VLC, chọn <strong>Media</strong> <ArrowLeft className="w-3 h-3 inline rotate-180"/> <strong>Open Network Stream...</strong> (Phím tắt: <kbd className="bg-amber-200 dark:bg-amber-800 px-1 rounded shadow-sm">Ctrl + N</kbd>).</li>
                    <li>Dán đường link vừa copy vào ô URL và bấm <strong>Play</strong>.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL UPLOAD VIDEO */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className={`${mdCard} w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95`}>
            <button onClick={() => setShowUpload(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-[#202020]"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-indigo-600"/></div>
            <h3 className="text-xl font-black mb-4">Upload Video</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadFiles.length <= 1 && (
                <input type="text" value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} placeholder="Tên hiển thị (nếu trống sẽ lấy tên file)..." className={inputClass} />
              )}
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-[#202020] cursor-pointer relative">
                <input type="file" accept="video/*" multiple onChange={e=>setUploadFiles(Array.from(e.target.files||[]))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Video className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-500">{uploadFiles.length > 0 ? `Đã chọn ${uploadFiles.length} video` : 'Kéo thả video vào đây'}</p>
              </div>
              {uploadStatus.msg && <div className="text-xs font-bold text-indigo-500">{uploadStatus.msg}</div>}
              <button type="submit" disabled={uploadStatus.uploading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black shadow-md flex justify-center items-center gap-2">
                {uploadStatus.uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Tải lên Drive'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}