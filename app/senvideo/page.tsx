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

  // Upload States
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadStatus, setUploadStatus] = useState({ uploading: false, msg: '' })

  // VLC Player States
  const [activeVideo, setActiveVideo] = useState<any | null>(null)
  const [copied, setCopied] = useState(false)

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

      // Lấy danh sách ID của Admin và Collab để hiển thị video dùng chung cho học sinh
      const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin','collab'])
      const adminIds = admins ? admins.map(a => a.id) : []

      // Fetch toàn bộ tài liệu (Giới hạn 2000 để tối ưu RLS)
      const { data, error } = await supabase.from('library_documents').select('*').order('created_at', { ascending: false }).limit(2000)
      if (error) throw error;

      if (data) {
        // Thuật toán bọc thép: Lọc file video và Check quyền
        const vids = data.filter(d => {
          // 1. Phải là file Video (Đã sửa lỗi Regex cực mạnh để bắt mọi biến thể)
          const isVideo = d.title && d.title.match(/\.(mp4|mkv|mov|avi|webm)$/i);
          if (!isVideo) return false;

          // 2. Quyền hiển thị (Học sinh chỉ thấy video của mình hoặc của Thầy cô)
          if (role === 'student') {
            return d.created_by === user.id || d.created_by === null || adminIds.includes(d.created_by);
          }
          // Admin thì thấy hết
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
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
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

      // 1. Tự động định tuyến vào thư mục "Student" nếu là học sinh
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
        
        // 2. BẢO VỆ ĐUÔI FILE: Tự động gắn thêm đuôi .mp4 nếu người dùng nhập tên tùy chỉnh mà quên ghi đuôi
        const fileExt = file.name.split('.').pop() || 'mp4';
        let finalTitle = (uploadFiles.length === 1 && uploadTitle) ? uploadTitle.trim() : file.name;
        
        if (!finalTitle.match(/\.(mp4|mkv|mov|avi|webm)$/i)) {
           finalTitle = `${finalTitle}.${fileExt}`;
        }
        
        setUploadStatus({ uploading: true, msg: `Đang đẩy [${i+1}/${uploadFiles.length}] lên Google Drive...` })
        const url = await initGoogleDriveUpload(finalTitle, file.type)
        const d = await uploadFileToGoogleDrive(url, file, finalTitle)
        
        if (!d?.id) throw new Error('Lỗi từ máy chủ Google Drive')

        setUploadStatus({ uploading: true, msg: `Đang lưu dữ liệu vào hệ thống...` })
        await supabase.from('library_documents').insert({ 
          title: finalTitle, 
          drive_file_id: d.id, 
          created_by: role === 'student' ? user?.id : null, // Admin up thì là Public (null)
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
  // XỬ LÝ LẤY LINK & RENDER GIAO DIỆN
  // ==========================================================================
  const vlcLink = activeVideo ? `${window.location.origin}/api/drive/stream?fileId=${activeVideo.drive_file_id}` : ''
  const handleCopy = () => {
    navigator.clipboard.writeText(vlcLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const displayVideos = videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0A0A0A]"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>

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
          {/* Nút Upload chỉ dành cho Admin/Collab hoặc muốn mở cho Học sinh cũng được */}
          <button onClick={() => setShowUpload(true)} className={`${headerBtn} bg-indigo-600 text-white hover:bg-indigo-700 border-none`}><UploadCloud className="w-4 h-4"/> Tải Video</button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">
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
                <div key={vid.id} onClick={() => setActiveVideo(vid)} className="group cursor-pointer bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 rounded-[1.5rem] p-4 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="w-full aspect-video bg-indigo-100 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-125 transition-transform"><PlaySquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/></div>
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
      {/* 🌟 MODAL VLC PLAYER (LẤY LINK STREAM) */}
      {/* ========================================================= */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className={`${mdCard} w-full max-w-2xl p-0 shadow-2xl relative overflow-hidden animate-in zoom-in-95`}>
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#1A1A1A]/50 flex justify-between items-center">
              <h3 className="font-black text-lg flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><MonitorPlay className="w-6 h-6"/> Lấy Link Stream VLC</h3>
              <button onClick={() => {setActiveVideo(null); setCopied(false)}} className="p-2 bg-slate-200 dark:bg-[#202020] rounded-full hover:scale-105"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div>
                <p className="text-sm font-bold text-slate-500 mb-2">Video đã chọn:</p>
                <p className="font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-[#252525] p-3 rounded-xl line-clamp-2 border border-slate-200 dark:border-white/5">{activeVideo.title}</p>
              </div>

              {/* Box Copy Link */}
              <div className="relative">
                <label className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2"><Cloud className="w-4 h-4"/> Link Stream Trực Tiếp (Bypass Drive)</label>
                <div className="flex gap-2">
                  <input readOnly value={vlcLink} className={`${inputClass} !text-indigo-600 dark:!text-indigo-400 !bg-indigo-50 dark:!bg-indigo-900/10 truncate font-mono`} />
                  <button onClick={handleCopy} className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shrink-0">
                    {copied ? <CheckCircle2 className="w-5 h-5"/> : <Copy className="w-5 h-5"/>} {copied ? 'Đã chép' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Hướng dẫn sử dụng VLC */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-[1.5rem] mt-4">
                <h4 className="font-black text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2"><Info className="w-5 h-5"/> Hướng dẫn xem qua VLC (Chống giật lag)</h4>
                <ol className="text-[13px] font-medium text-amber-800 dark:text-amber-500 space-y-2.5 list-decimal list-inside">
                  <li>Tải và mở phần mềm <strong>VLC Media Player</strong> trên máy tính/điện thoại.</li>
                  <li>Trên menu VLC, chọn <strong>Media</strong> <ArrowLeft className="w-3 h-3 inline rotate-180"/> <strong>Open Network Stream...</strong> (Phím tắt: <kbd className="bg-amber-200 dark:bg-amber-800 px-1 rounded">Ctrl + N</kbd>).</li>
                  <li>Dán đường link bạn vừa copy ở trên vào ô URL.</li>
                  <li>Bấm <strong>Play (Phát)</strong> và thưởng thức video chất lượng gốc không giới hạn dung lượng!</li>
                </ol>
              </div>
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