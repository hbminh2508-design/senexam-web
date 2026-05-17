'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Folder, FileText, ArrowLeft, PlusCircle, Trash2, 
  UploadCloud, Loader2, X, ChevronRight, Download, BookOpen
} from 'lucide-react'

const glassCardStyles = "bg-white/30 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]"

export default function LibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('student')
  
  const [folders, setFolders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  
  // Navigation State
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string} | null>(null)
  
  // Modal States
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  
  const [showDocModal, setShowDocModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error', message: string}>({ type: 'idle', message: '' })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'student')
      
      await fetchFolders()
      setLoading(false)
    }

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }

    init()
  }, [router])

  const fetchFolders = async () => {
    const { data } = await supabase.from('library_folders').select('*').order('created_at', { ascending: false })
    setFolders(data || [])
  }

  const fetchDocuments = async (folderId: string) => {
    const { data } = await supabase.from('library_documents').select('*').eq('folder_id', folderId).order('created_at', { ascending: false })
    setDocuments(data || [])
  }

  const handleOpenFolder = async (folder: any) => {
    setCurrentFolder({ id: folder.id, name: folder.name })
    await fetchDocuments(folder.id)
  }

  const handleBackToRoot = async () => {
    setCurrentFolder(null)
    await fetchFolders()
  }

  // --- ACTIONS CHO ADMIN & COLLAB ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('library_folders').insert({ name: newFolderName, created_by: user?.id })
    if (!error) {
      setShowFolderModal(false)
      setNewFolderName('')
      fetchFolders()
    } else { alert("Lỗi tạo thư mục: " + error.message) }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docTitle || !docFile || !currentFolder) return

    try {
      setUploadStatus({ type: 'uploading', message: 'Đang đẩy tài liệu lên kho lưu trữ đám mây...' })
      const formData = new FormData()
      formData.append('file', docFile)
      formData.append('title', docTitle)

      // Tái sử dụng API upload Google Drive hiện có
      const response = await fetch('/api/upload-exam', { method: 'POST', body: formData })
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         throw new Error("Tài liệu quá lớn hoặc hệ thống quá tải (Lỗi Server).");
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Lỗi API Google Drive')

      const { data: { user } } = await supabase.auth.getUser()
      const { error: dbError } = await supabase.from('library_documents').insert({
        folder_id: currentFolder.id, title: docTitle, drive_file_id: result.driveFileId, created_by: user?.id
      })

      if (dbError) throw new Error(dbError.message)
      
      setUploadStatus({ type: 'success', message: 'Tải tài liệu lên thành công!' })
      setDocTitle(''); setDocFile(null); setShowDocModal(false);
      fetchDocuments(currentFolder.id)
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Có lỗi xảy ra.' })
    }
  }

  // --- DELETE ACTIONS (CHỈ DÀNH CHO ADMIN) ---
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600 bg-slate-50 dark:bg-slate-950">Đang khởi tạo thư viện số...</div>

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 relative text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden">
      
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-bl from-blue-400/40 to-cyan-400/30 dark:from-blue-800/40 dark:to-cyan-900/30 rounded-full blur-[120px] pointer-events-none"></div>

      {/* --- MODAL TẠO THƯ MỤC MỚI --- */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassCardStyles} rounded-3xl w-full max-w-sm p-8 shadow-2xl relative`}>
            <button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4"><Folder className="w-6 h-6 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400"/></div>
            <h3 className="text-xl font-black mb-2">Tạo thư mục mới</h3>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Tên thư mục (VD: Tài liệu Tiếng Anh)" className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6 shadow-inner" />
            <button onClick={handleCreateFolder} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Tạo Thư Mục</button>
          </div>
        </div>
      )}

      {/* --- MODAL UPLOAD TÀI LIỆU --- */}
      {showDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassCardStyles} rounded-3xl w-full max-w-md p-8 shadow-2xl relative`}>
            <button onClick={() => { setShowDocModal(false); setUploadStatus({type:'idle', message:''}) }} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-emerald-600 dark:text-emerald-400"/></div>
            <h3 className="text-xl font-black mb-4">Tải tài liệu lên</h3>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Tên tài liệu hiển thị</label>
                <input type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="VD: 500 Câu Trắc nghiệm Hình học..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">File tài liệu (PDF)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input type="file" accept=".pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{docFile ? docFile.name : 'Nhấn chọn file'}</p>
                </div>
              </div>
              
              {uploadStatus.type !== 'idle' && (
                <div className={`p-3 rounded-xl text-xs font-bold ${uploadStatus.type === 'uploading' ? 'bg-blue-50 text-blue-600' : uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {uploadStatus.message}
                </div>
              )}

              <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95 mt-4">
                {uploadStatus.type === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Bắt đầu tải lên'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3">
              <ArrowLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm flex items-center gap-3">
              Thư Viện Số <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </h1>
            
            {/* Breadcrumb hiện đại */}
            <div className="flex items-center gap-2 mt-4 text-sm font-bold">
              <span onClick={handleBackToRoot} className={`cursor-pointer transition-colors ${currentFolder ? 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400' : 'text-blue-600 dark:text-blue-400'}`}>
                Trang chủ Thư viện
              </span>
              {currentFolder && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <span className="text-blue-600 dark:text-blue-400">{currentFolder.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {/* COLLAB VÀ ADMIN MỚI THẤY NÚT NÀY */}
            {(userRole === 'admin' || userRole === 'collab') && (
              <>
                {!currentFolder ? (
                  <button onClick={() => setShowFolderModal(true)} className="bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm hover:scale-105 transition-transform">
                    <PlusCircle className="w-5 h-5 text-blue-600" /> Tạo Thư Mục
                  </button>
                ) : (
                  <button onClick={() => setShowDocModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:scale-105 transition-transform">
                    <UploadCloud className="w-5 h-5" /> Tải Tài Liệu
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className={`${glassCardStyles} rounded-[2.5rem] p-6 md:p-10 min-h-[60vh] border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
          
          {/* VIEW: MÀN HÌNH ROOT (HIỂN THỊ THƯ MỤC) */}
          {!currentFolder ? (
            folders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 pt-20">
                <Folder className="w-20 h-20 mb-4" />
                <p className="font-bold text-lg">Chưa có thư mục tài liệu nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                {folders.map(folder => (
                  <div key={folder.id} onClick={() => handleOpenFolder(folder)} className="group cursor-pointer flex flex-col items-center gap-3 relative">
                    <div className="w-28 h-28 md:w-32 md:h-32 relative transform group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-300">
                      {/* Lấy hình ảnh folder-icon.jpg mà bạn vừa up */}
                      <img src="/folder-icon.jpg" alt="Folder" className="w-full h-full object-contain drop-shadow-xl" />
                      
                      {/* CHỈ ADMIN MỚI ĐƯỢC XOÁ */}
                      {userRole === 'admin' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id) }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-200 hover:scale-110 z-10" title="Xóa thư mục">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="font-black text-sm text-center text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 px-2">
                      {folder.name}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            
            /* VIEW: BÊN TRONG THƯ MỤC (HIỂN THỊ TÀI LIỆU) */
            documents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 pt-20">
                <FileText className="w-16 h-16 mb-4" />
                <p className="font-bold text-lg">Thư mục này đang trống.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => window.open(`https://drive.google.com/file/d/${doc.drive_file_id}/view`, '_blank')} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-700 rounded-2xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer group relative flex flex-col justify-between h-40">
                    <div>
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl flex items-center justify-center mb-3">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors">{doc.title}</h3>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <span className="text-[10px] font-bold text-slate-400">{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    </div>

                    {/* CHỈ ADMIN MỚI ĐƯỢC XOÁ */}
                    {userRole === 'admin' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id) }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors z-10 bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-md opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}