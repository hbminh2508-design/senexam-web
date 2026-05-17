'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Folder, FileText, ArrowLeft, PlusCircle, Trash2, 
  UploadCloud, Loader2, X, ChevronRight, Download, BookOpen, Search
} from 'lucide-react'

const glassCardStyles = "bg-white/30 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]"

export default function LibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('student')
  
  const [folders, setFolders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  
  // 🌟 ĐÃ NÂNG CẤP: Dùng Mảng để lưu Đường dẫn thư mục lồng nhau
  const [folderPath, setFolderPath] = useState<{id: string | null, name: string}[]>([{ id: null, name: 'Trang chủ Thư viện' }])
  const currentFolderId = folderPath[folderPath.length - 1].id

  // 🌟 THANH TÌM KIẾM
  const [searchQuery, setSearchQuery] = useState('')

  // Modal States
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{type: 'idle' | 'uploading' | 'success' | 'error', message: string}>({ type: 'idle', message: '' })

  // 🌟 DRAG & DROP STATES
  const [draggedItem, setDraggedItem] = useState<{id: string, type: 'folder' | 'document'} | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'student')
      
      await fetchContents(null)
      setLoading(false)
    }

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
    init()
  }, [router])

  // Lấy dữ liệu theo ID thư mục hiện tại
  const fetchContents = async (folderId: string | null) => {
    const folderQuery = supabase.from('library_folders').select('*').order('created_at', { ascending: false })
    if (folderId) folderQuery.eq('parent_id', folderId); else folderQuery.is('parent_id', null);
    
    const docQuery = supabase.from('library_documents').select('*').order('created_at', { ascending: false })
    if (folderId) docQuery.eq('folder_id', folderId); else docQuery.is('folder_id', null);

    const [folderRes, docRes] = await Promise.all([folderQuery, docQuery])
    setFolders(folderRes.data || [])
    setDocuments(docRes.data || [])
  }

  // Chuyển hướng thư mục
  const handleOpenFolder = async (folderId: string, folderName: string) => {
    setSearchQuery('')
    setFolderPath([...folderPath, { id: folderId, name: folderName }])
    await fetchContents(folderId)
  }

  // Bấm vào thanh Breadcrumb để quay lại
  const handleNavigateBreadcrumb = async (index: number) => {
    setSearchQuery('')
    const newPath = folderPath.slice(0, index + 1)
    setFolderPath(newPath)
    await fetchContents(newPath[newPath.length - 1].id)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('library_folders').insert({ 
      name: newFolderName, 
      created_by: user?.id,
      parent_id: currentFolderId 
    })
    if (!error) {
      setShowFolderModal(false); setNewFolderName(''); fetchContents(currentFolderId)
    } else { alert("Lỗi tạo thư mục: " + error.message) }
  }

  // TẢI FILE BYPASS VERCEL
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docTitle || !docFile) return

    try {
      setUploadStatus({ type: 'uploading', message: 'Đang xin cấp phép tải lên từ Google Drive...' })
      const initRes = await fetch('/api/upload-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: docTitle, mimeType: docFile.type })
      });
      
      if (!initRes.ok) throw new Error("Không thể khởi tạo kết nối với Google Drive.");
      const { uploadUrl } = await initRes.json();

      setUploadStatus({ type: 'uploading', message: `Đang đẩy trực tiếp file ${docFile.name} lên Đám mây...` })
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': docFile.type }, body: docFile });
      if (!uploadRes.ok) throw new Error("Quá trình đẩy dữ liệu bị đứt đoạn. Vui lòng thử lại.");
      
      const fileId = (await uploadRes.json()).id;

      setUploadStatus({ type: 'uploading', message: 'Đang đồng bộ dữ liệu vào Thư Viện...' })
      const { data: { user } } = await supabase.auth.getUser()
      const { error: dbError } = await supabase.from('library_documents').insert({
        folder_id: currentFolderId, title: docTitle, drive_file_id: fileId, created_by: user?.id
      })

      if (dbError) throw new Error(dbError.message)
      
      setUploadStatus({ type: 'success', message: 'Đã tải thành công tài liệu!' })
      setDocTitle(''); setDocFile(null); setShowDocModal(false);
      fetchContents(currentFolderId)
    } catch (err: any) { setUploadStatus({ type: 'error', message: err.message || 'Có lỗi xảy ra.' }) }
  }

  // --- ACTIONS XÓA ---
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

  // --- DRAG & DROP TÍNH NĂNG ---
  const handleDragStart = (e: React.DragEvent, id: string, type: 'folder' | 'document') => {
    if (userRole !== 'admin' && userRole !== 'collab') return;
    setDraggedItem({ id, type })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault(); e.stopPropagation(); setDragOverId(null);
    if (!draggedItem) return;
    if (draggedItem.type === 'folder' && draggedItem.id === targetFolderId) return; // Chống drop vào chính nó

    try {
      if (draggedItem.type === 'document') {
        await supabase.from('library_documents').update({ folder_id: targetFolderId }).eq('id', draggedItem.id);
      } else if (draggedItem.type === 'folder') {
        await supabase.from('library_folders').update({ parent_id: targetFolderId }).eq('id', draggedItem.id);
      }
      fetchContents(currentFolderId);
    } catch (err) { alert("Lỗi khi di chuyển dữ liệu") }
    setDraggedItem(null)
  }

  // Lọc dữ liệu theo Search
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredDocuments = documents.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600 bg-slate-50 dark:bg-slate-950">Đang khởi tạo thư viện số...</div>

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/80 p-4 md:p-8 relative text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden">
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-bl from-blue-400/40 to-cyan-400/30 dark:from-blue-800/40 dark:to-cyan-900/30 rounded-full blur-[120px] pointer-events-none"></div>

      {/* --- MODALS --- */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassCardStyles} rounded-3xl w-full max-w-sm p-8 shadow-2xl relative`}>
            <button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4"><Folder className="w-6 h-6 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400"/></div>
            <h3 className="text-xl font-black mb-2">Tạo thư mục mới</h3>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Tên thư mục (VD: Đề thi thử)" className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-6 shadow-inner" />
            <button onClick={handleCreateFolder} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95">Tạo Thư Mục</button>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassCardStyles} rounded-3xl w-full max-w-md p-8 shadow-2xl relative`}>
            <button onClick={() => { setShowDocModal(false); setUploadStatus({type:'idle', message:''}) }} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5"/></button>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4"><UploadCloud className="w-6 h-6 text-emerald-600 dark:text-emerald-400"/></div>
            <h3 className="text-xl font-black mb-4">Tải tài liệu lên</h3>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Tên tài liệu hiển thị</label>
                <input type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="VD: Sách Luyện Thi THPT..." className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">File tài liệu (PDF)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input type="file" accept=".pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{docFile ? docFile.name : 'Nhấn chọn file'}</p>
                </div>
              </div>
              {uploadStatus.type !== 'idle' && <div className={`p-3 rounded-xl text-xs font-bold ${uploadStatus.type === 'uploading' ? 'bg-blue-50 text-blue-600' : uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{uploadStatus.message}</div>}
              <button type="submit" disabled={uploadStatus.type === 'uploading'} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md transition-all active:scale-95 mt-4">
                {uploadStatus.type === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Bắt đầu tải lên'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto">
        
        {/* HEADER & THANH TÌM KIẾM */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex-1">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors mb-3">
              <ArrowLeft className="w-4 h-4" /> Về trang chủ
            </button>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm flex items-center gap-3 mb-4">
              Thư Viện Số <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </h1>
            
            {/* Breadcrumb - CÓ THỂ DROP FILE VÀO ĐÂY ĐỂ ĐẨY RA NGOÀI */}
            <div className="flex items-center flex-wrap gap-2 text-sm font-bold bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/60 dark:border-slate-700/50 w-fit">
              {folderPath.map((step, index) => (
                <div key={index} className="flex items-center gap-2"
                     onDragOver={(e) => { e.preventDefault(); setDragOverId(step.id || 'root') }}
                     onDragLeave={() => setDragOverId(null)}
                     onDrop={(e) => handleDrop(e, step.id)}
                >
                  <span onClick={() => handleNavigateBreadcrumb(index)} 
                        className={`cursor-pointer px-2 py-1 rounded-lg transition-colors ${dragOverId === (step.id || 'root') ? 'bg-blue-200 dark:bg-blue-900 text-blue-700' : index === folderPath.length - 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700'}`}>
                    {step.name}
                  </span>
                  {index < folderPath.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* THANH TÌM KIẾM */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm tài liệu..." className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
            </div>

            {(userRole === 'admin' || userRole === 'collab') && (
              <>
                <button onClick={() => setShowFolderModal(true)} className="w-full sm:w-auto bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/60 dark:border-slate-700 text-slate-900 dark:text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-white/60 transition-colors">
                  <PlusCircle className="w-5 h-5 text-blue-600" /> Tạo Thư Mục
                </button>
                <button onClick={() => setShowDocModal(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-colors">
                  <UploadCloud className="w-5 h-5" /> Tải Lên
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className={`${glassCardStyles} rounded-[2.5rem] p-6 md:p-10 min-h-[60vh] border-t-white/60 border-l-white/60 dark:border-t-white/20 dark:border-l-white/20`}>
          
          {filteredFolders.length === 0 && filteredDocuments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 pt-20">
              <Search className="w-16 h-16 mb-4" />
              <p className="font-bold text-lg">Không tìm thấy thư mục hay tài liệu nào.</p>
            </div>
          ) : (
            <>
              {/* LƯỚI THƯ MỤC */}
              {filteredFolders.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2 drop-shadow-sm">Thư mục</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {filteredFolders.map(folder => (
                      <div key={folder.id} 
                           draggable={userRole === 'admin' || userRole === 'collab'}
                           onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
                           onDragOver={(e) => { e.preventDefault(); setDragOverId(folder.id) }}
                           onDragLeave={() => setDragOverId(null)}
                           onDrop={(e) => handleDrop(e, folder.id)}
                           onClick={() => handleOpenFolder(folder.id, folder.name)} 
                           className={`group cursor-pointer flex flex-col items-center gap-3 relative p-4 rounded-3xl transition-all duration-300 ${dragOverId === folder.id ? 'bg-blue-100/50 dark:bg-blue-900/30 scale-105 border-2 border-dashed border-blue-400' : 'hover:bg-white/40 dark:hover:bg-slate-800/40'}`}>
                        
                        <div className="relative w-24 h-20 flex items-center justify-center">
                          <Folder className="w-full h-full text-blue-400/80 fill-blue-500/90 drop-shadow-[0_10px_15px_rgba(59,130,246,0.3)] transition-transform group-hover:scale-110" strokeWidth={1} />
                          {userRole === 'admin' && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id) }} className="absolute -top-1 -right-1 bg-white/90 dark:bg-slate-800/90 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:scale-110 z-10 border border-slate-200">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="font-black text-sm text-center text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors line-clamp-2 px-1">{folder.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LƯỚI TÀI LIỆU */}
              {filteredDocuments.length > 0 && (
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-2 drop-shadow-sm">Tài liệu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocuments.map(doc => (
                      <div key={doc.id} 
                           draggable={userRole === 'admin' || userRole === 'collab'}
                           onDragStart={(e) => handleDragStart(e, doc.id, 'document')}
                           onClick={() => window.open(`https://drive.google.com/file/d/${doc.drive_file_id}/view`, '_blank')} 
                           className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-700 rounded-2xl p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer group relative flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 overflow-hidden pr-6">
                          <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors text-sm">{doc.title}</h3>
                          <span className="text-[10px] font-bold text-slate-400 mt-1 block">{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {userRole === 'admin' && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id) }} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-300 hover:text-red-500 transition-colors z-10 bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
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