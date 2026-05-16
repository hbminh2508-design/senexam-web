'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Megaphone, Save, ArrowLeft, Loader2, Calendar, Trash2 } from 'lucide-react'

const glassCardStyles = "bg-white/30 dark:bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]"

// 🌟 COMPONENT ĐẾM NGƯỢC THỜI GIAN THỰC
export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())
  
  useEffect(() => { 
    const timer = setInterval(() => setNow(Date.now()), 1000); 
    return () => clearInterval(timer) 
  }, [])
  
  const target = new Date(targetDate).getTime()
  if (isNaN(target)) return <span className="text-red-500 font-bold">[Lỗi định dạng ngày]</span>
  
  const diff = target - now
  if (diff <= 0) return <span className="inline-block bg-slate-200 dark:bg-slate-800 text-slate-500 font-black px-3 py-1 rounded-xl shadow-inner mx-1 text-sm">⏳ Sự kiện đã diễn ra</span>
  
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  const s = Math.floor((diff / 1000) % 60)
  
  return (
    <span className="inline-block bg-gradient-to-r from-red-600 to-orange-600 text-white font-black px-3 py-1.5 rounded-xl shadow-[0_4px_15px_rgba(239,68,68,0.4)] mx-1 text-sm animate-pulse">
      ⏳ {d} Ngày {h} Giờ {m} Phút {s} Giây
    </span>
  )
}

// 🌟 BỘ XỬ LÝ CÚ PHÁP (PARSER)
export const AnnouncementRenderer = ({ text }: { text: string }) => {
  const renderLine = (line: string, idx: number) => {
    let isH1 = false, isH2 = false, isH3 = false;
    let content = line;
    
    if (content.startsWith('###(H1)')) { isH1 = true; content = content.replace('###(H1)', '').trim() }
    else if (content.startsWith('##(H2)')) { isH2 = true; content = content.replace('##(H2)', '').trim() }
    else if (content.startsWith('#(H3)')) { isH3 = true; content = content.replace('#(H3)', '').trim() }

    const parseTags = (str: string) => {
      const regex = /{(time_|Quoc_Khanh|Bold|Underline):\s*([^}]+)}/gi;
      const parts = []; let lastIndex = 0; let match;
      
      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex, match.index)}</span>)
        
        const tag = match[1].toLowerCase(); 
        const val = match[2];
        
        if (tag === 'time_') {
          parts.push(<CountdownTimer key={`time-${match.index}`} targetDate={val} />)
        }
        else if (tag === 'quoc_khanh') {
          parts.push(<span key={`qk-${match.index}`} className="text-yellow-300 font-black px-3 py-1 inline-flex items-center gap-2 mx-1 bg-red-600 rounded-lg shadow-md uppercase tracking-wider">🇻🇳 🚜 314 {val} 🚩 🇻🇳</span>)
        }
        else if (tag === 'bold') {
          parts.push(<strong key={`b-${match.index}`} className="uppercase font-black text-blue-600 dark:text-blue-400 tracking-wide">{val}</strong>)
        }
        else if (tag === 'underline') {
          parts.push(<u key={`u-${match.index}`} className="underline-offset-4 decoration-2 decoration-blue-500">{val}</u>)
        }
        
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < str.length) parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex)}</span>)
      return parts;
    };

    const baseClass = isH1 ? "text-3xl md:text-4xl font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight my-4 drop-shadow-md text-center" :
                      isH2 ? "text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 my-3 text-center" :
                      isH3 ? "text-xl font-bold text-slate-700 dark:text-slate-300 my-2" :
                      "text-base font-medium text-slate-700 dark:text-slate-300 my-1 leading-relaxed";

    return <div key={idx} className={baseClass}>{parseTags(content)}</div>;
  }
  
  return <div className="w-full">{text.split('\n').map((line, idx) => renderLine(line, idx))}</div>
}

export default function AnnouncementsAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [announcements, setAnnouncements] = useState<any[]>([])
  
  const [content, setContent] = useState('###(H1) CHÀO MỪNG ĐẾN VỚI SENEXAM\n\nĐây là thông báo mẫu. Kỳ thi THPT Quốc Gia sẽ diễn ra sau:\n{time_: 2026-06-25T08:00}\n\n{Quoc_Khanh: Chào mừng ngày Giải phóng miền Nam}')
  const [isActive, setIsActive] = useState(true)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'collab') { router.push('/dashboard'); return }
      
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      setAnnouncements(data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const handleSave = async () => {
    if (!content.trim()) return alert("Nội dung không được để trống!")
    setSaving(true)
    const st = startTime ? new Date(startTime).toISOString() : null
    const et = endTime ? new Date(endTime).toISOString() : null

    const { error } = await supabase.from('announcements').insert({
      content, is_active: isActive, start_time: st, end_time: et
    })
    
    if (error) alert("Lỗi: " + error.message)
    else {
      alert("Đăng thông báo thành công!")
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      setAnnouncements(data || [])
      setContent(''); setStartTime(''); setEndTime(''); setIsActive(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá vĩnh viễn thông báo này?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(announcements.filter(a => a.id !== id))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Xác thực quyền quản trị...</div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-10 relative overflow-x-hidden font-sans">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-red-400/30 to-orange-400/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8 border-b dark:border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin')} className="p-2.5 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 transition-colors shadow-sm"><ArrowLeft className="w-5 h-5"/></button>
            <div>
              <h1 className="text-3xl font-black flex items-center gap-3"><Megaphone className="w-8 h-8 text-red-500" /> Trạm Phát Sóng Thông Báo</h1>
              <p className="text-sm font-medium text-slate-500 mt-1">Điều khiển các bảng tin nổi bật trên Dashboard của tất cả học sinh.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cột trái: Soạn thảo */}
          <div className="space-y-6">
            <div className={`${glassCardStyles} p-6 rounded-3xl border-t-white/60 border-l-white/60`}>
              <h2 className="text-lg font-black mb-4 border-b dark:border-slate-700 pb-2">Bảng Hướng Dẫn Cú Pháp</h2>
              <ul className="space-y-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                <li><code className="text-blue-500 font-black bg-blue-50 px-1 py-0.5 rounded">###(H1) Nội dung</code> - Tạo Tiêu đề to nhất (H1, H2, H3).</li>
                <li><code className="text-red-500 font-black bg-red-50 px-1 py-0.5 rounded">{`{time_: 2026-06-25T08:00}`}</code> - Bộ đếm ngược thời gian tới ngày được chỉ định (YYYY-MM-DDTHH:mm).</li>
                <li><code className="text-yellow-600 font-black bg-yellow-50 px-1 py-0.5 rounded">{`{Quoc_Khanh: Ngày Độc Lập}`}</code> - Gắn cờ, xe tăng 314 và nền đỏ chữ vàng.</li>
                <li><code className="font-black bg-slate-100 px-1 py-0.5 rounded">{`{Bold: Chú ý}`}</code> - Viết HOA và In đậm chữ.</li>
                <li><code className="font-black bg-slate-100 px-1 py-0.5 rounded">{`{Underline: Quan trọng}`}</code> - Gạch chân dưới chữ.</li>
              </ul>
            </div>

            <div className={`${glassCardStyles} p-6 rounded-3xl border-t-white/60 border-l-white/60 space-y-5`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black">Thiết lập hiển thị</h3>
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-emerald-500" /> Kích hoạt ngay
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold mb-1 text-slate-500">Bắt đầu hiển thị từ</label><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-2.5 text-xs font-bold rounded-xl border dark:border-slate-700 dark:bg-slate-900 outline-none" /></div>
                <div><label className="block text-xs font-bold mb-1 text-slate-500">Ẩn tự động vào lúc</label><input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-2.5 text-xs font-bold rounded-xl border dark:border-slate-700 dark:bg-slate-900 outline-none" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2">Nội dung Thông báo</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-40 p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium custom-scrollbar" placeholder="Nhập cú pháp tại đây..." />
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:scale-[1.02] text-white font-black py-3.5 rounded-xl transition-all shadow-[0_4px_15px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Đăng Tải Thông Báo
              </button>
            </div>
          </div>

          {/* Cột phải: Live Preview và Lịch sử */}
          <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl border-2 border-dashed border-blue-300 dark:border-slate-700 relative min-h-[250px] shadow-inner">
              <span className="absolute -top-3 left-6 bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase">Live Preview (Xem trước)</span>
              {content ? <AnnouncementRenderer text={content} /> : <p className="text-slate-400 italic text-sm text-center mt-10">Giao diện thông báo sẽ hiển thị ở đây...</p>}
            </div>

            <div className={`${glassCardStyles} p-6 rounded-3xl`}>
              <h3 className="font-black mb-4 flex items-center gap-2"><Calendar className="w-5 h-5"/> Quản lý các luồng thông báo</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {announcements.map(a => (
                  <div key={a.id} className="p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm flex items-start justify-between gap-4">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        {a.is_active ? <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded">Đang Bật</span> : <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded">Tắt</span>}
                        <span className="text-[10px] text-slate-400 font-bold">{new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{a.content}</p>
                    </div>
                    <button onClick={() => handleDelete(a.id)} className="p-2 text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}