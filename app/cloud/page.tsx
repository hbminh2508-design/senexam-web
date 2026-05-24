'use client'

import { useEffect, useState } from 'react'
import { Cloud, Database, FolderOpen, Lock, PlusCircle, ShieldCheck, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react'

type VaultItem = {
  id: string
  title: string
  category: string
  note: string
  createdAt: string
}

const CLOUD_STORAGE_KEY = 'sen_cloud_vault_v1'
const FREE_QUOTA_GB = 30

const readVaultItems = () => {
  if (typeof window === 'undefined') return [] as VaultItem[]
  try {
    const raw = localStorage.getItem(CLOUD_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as VaultItem[]) : []
  } catch {
    return [] as VaultItem[]
  }
}

const createVaultItem = (title: string, category: string, note: string): VaultItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  category,
  note,
  createdAt: new Date().toISOString()
})

export default function CloudPage() {
  const [items, setItems] = useState<VaultItem[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Tài liệu cá nhân')
  const [note, setNote] = useState('')

  useEffect(() => {
    setItems(readVaultItems())
  }, [])

  const saveItems = (next: VaultItem[]) => {
    setItems(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(next))
    }
  }

  const handleCreateItem = () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tên dữ liệu cần lưu.')
      return
    }

    const nextItem = createVaultItem(title.trim(), category.trim() || 'Tài liệu cá nhân', note.trim())
    const nextItems = [nextItem, ...items]
    saveItems(nextItems)
    setTitle('')
    setCategory('Tài liệu cá nhân')
    setNote('')
    alert('Dữ liệu đã được thêm vào Sen Cloud AI.')
  }

  const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="app-shell min-h-screen bg-transparent text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto relative">
        <div className="absolute -top-20 right-0 w-72 h-72 bg-sky-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-32 left-0 w-80 h-80 bg-indigo-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="liquid-panel rounded-[2rem] p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/45 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Sen Cloud AI
              </div>
              <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                Không gian lưu trữ riêng cho học sinh, có AI hỗ trợ và 30GB miễn phí.
              </h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Tạo kho dữ liệu cá nhân, lưu ghi chú và tài liệu quan trọng, đồng thời giữ trải nghiệm tách biệt với thư viện học tập thông thường.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Miễn phí</p>
                <p className="text-3xl font-black text-sky-600 dark:text-sky-300">30GB</p>
              </div>
              <div className="rounded-2xl bg-white/55 dark:bg-slate-900/45 border border-white/60 dark:border-white/10 px-4 py-3 shadow-sm min-w-[140px]">
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 dark:text-slate-400">Đang lưu</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{items.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 liquid-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-sky-500" /> Kho dữ liệu cá nhân
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tạo nhanh một mục lưu trữ riêng và giữ dữ liệu của bạn ở nơi tách biệt.</p>
              </div>
              <button
                onClick={handleCreateItem}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" /> Lưu vào cloud
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Tên dữ liệu</label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="VD: Đề cương Toán học kỳ 2" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Danh mục</label>
                <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="VD: Tài liệu cá nhân" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">Ghi chú</label>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Mô tả ngắn nội dung cần lưu hoặc cách dùng dữ liệu này" className="w-full rounded-xl bg-white/55 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20 resize-none" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-400/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-1">Lưu trữ riêng</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Mỗi tài khoản có vùng lưu trữ tách biệt để tránh lẫn dữ liệu học tập.</p>
              </div>

              <div className="rounded-2xl bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-400/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-1">Bảo mật</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Thiết kế như một kho riêng, phù hợp cho tài liệu, ghi chú và dữ liệu cá nhân.</p>
              </div>

              <div className="rounded-2xl bg-white/45 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-400/20">
                    <Lock className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-1">Kho học tập</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Dùng cho tài liệu, ghi chú, hình ảnh và nội dung học tập cần quản lý riêng.</p>
              </div>
            </div>
          </div>

          <div className="liquid-panel rounded-[2rem] p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <FolderOpen className="w-5 h-5 text-sky-500" /> Dữ liệu gần đây
            </div>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/60 dark:border-slate-700/60 bg-white/35 dark:bg-slate-900/30 p-5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Chưa có dữ liệu nào. Hãy thêm mục đầu tiên để khởi tạo Sen Cloud AI.
              </div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1 custom-scrollbar">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white/50 dark:bg-slate-900/35 border border-white/60 dark:border-white/10 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-black text-base text-slate-900 dark:text-white truncate">{item.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{item.category}</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    </div>
                    {item.note && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{item.note}</p>}
                    <p className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400">Tạo lúc {formatDate(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 border border-sky-200/40 dark:border-sky-400/20 p-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <ChevronRight className="w-4 h-4 text-sky-500" /> Mẹo dùng nhanh
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Lưu các mục nhỏ theo từng môn, từng dự án hoặc từng lớp để quản lý dữ liệu cá nhân rõ ràng hơn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
