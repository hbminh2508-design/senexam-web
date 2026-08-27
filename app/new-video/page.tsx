'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Video,
  Play,
  Search,
  Loader2,
  Sun,
  Moon,
  Clock,
  Sparkles,
  Maximize2,
  Download,
  Film,
  FolderOpen,
  Calendar,
  Layers,
  ChevronRight,
  Tv,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newvid-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newvid-body' })

export default function NewVideoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [videos, setVideos] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideo, setActiveVideo] = useState<any | null>(null)
  const [theaterMode, setTheaterMode] = useState(false)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const fetchVideos = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/new-sign')
        return
      }

      await ensureStudentProfile(user.id)

      const { data, error } = await supabase
        .from('library_documents')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) {
        const vids = data.filter((d) => {
          const title = (d.title || '').trim().toLowerCase()
          const isMediaExt = /\.(mp4|mkv|mov|avi|webm|flv|wmv|m4v|3gp|mp3|wav|ogg|m4a|aac|flac)$/i.test(title)
          const isMediaMime = d.mime_type && (d.mime_type.startsWith('video/') || d.mime_type.startsWith('audio/'))
          // Chỉ nhận diện các file video / audio, loại trừ hoàn toàn các file PDF, docs, sheets, images
          return isMediaExt || isMediaMime
        })
        setVideos(vids)
        if (vids.length > 0) {
          setActiveVideo(vids[0])
        }
      }
      setLoading(false)
    }

    fetchVideos()
  }, [router])

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

  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return videos
    return videos.filter((v) => (v.title || '').toLowerCase().includes(q))
  }, [videos, searchQuery])

  const videoStreamUrl = useMemo(() => {
    if (!activeVideo) return ''
    if (activeVideo.drive_file_id) {
      return `https://drive.google.com/file/d/${activeVideo.drive_file_id}/preview`
    }
    return activeVideo.url || activeVideo.file_url || ''
  }, [activeVideo])

  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang kết nối thư viện video bài giảng...</span>
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
        <div className="flex items-center justify-between pb-6 border-b border-black/10 dark:border-white/10">
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
                <span className="rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[11px] font-bold text-pink-600 dark:text-pink-400 border border-pink-500/20">
                  <Video className="inline h-3 w-3 mr-1" /> Sen Video 2.0
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newvid-heading)' }}>
                Kho Video Bài Giảng & Chuyên Đề
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Học trực quan qua các video bài giảng ngắn gọn, cô đọng kiến thức trọng tâm.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
          </button>
        </div>

        {/* MAIN VIDEO PLAYER + PLAYLIST LAYOUT */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* VIDEO PLAYER (2 COLS) */}
          <div className={`${theaterMode ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
            <div className="relative aspect-video w-full rounded-3xl border border-black/10 dark:border-white/10 bg-black shadow-2xl overflow-hidden">
              {activeVideo ? (
                <iframe
                  src={videoStreamUrl}
                  className="w-full h-full border-none"
                  allowFullScreen
                  title={activeVideo.title}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Film className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm font-bold">Chưa chọn video nào để phát</p>
                </div>
              )}
            </div>

            {/* Video Details Card */}
            {activeVideo && (
              <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="space-y-1">
                    <span className="rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 px-2.5 py-0.5 text-[10px] font-black uppercase border border-pink-500/20">
                      Đang phát
                    </span>
                    <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-newvid-heading)' }}>
                      {activeVideo.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTheaterMode(!theaterMode)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-black/10"
                    >
                      <Tv className="h-3.5 w-3.5" />
                      {theaterMode ? 'Thu gọn' : 'Chế độ Rạp'}
                    </button>
                    {activeVideo.drive_file_id && (
                      <a
                        href={`https://drive.google.com/file/d/${activeVideo.drive_file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold shadow-sm transition"
                      >
                        <Download className="h-3.5 w-3.5" /> Mở Drive
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-[#6B7280] dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Đăng ngày {new Date(activeVideo.created_at).toLocaleDateString('vi-VN')}
                  </span>
                  {activeVideo.is_vip_only && (
                    <span className="rounded-md bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 border border-amber-500/20">
                      VIP Chỉ dành riêng
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PLAYLIST SIDEBAR (1 COL) */}
          <div className={`${theaterMode ? 'lg:col-span-3' : 'lg:col-span-1'} space-y-4`}>
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-5 shadow-sm backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black" style={{ fontFamily: 'var(--font-newvid-heading)' }}>
                  Danh Sách Video ({filteredVideos.length})
                </h3>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Tìm kiếm video..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-9 pr-3 text-xs font-semibold outline-none focus:border-pink-500"
                />
              </div>

              {/* Videos List */}
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredVideos.length === 0 ? (
                  <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center py-8">
                    Không tìm thấy video nào.
                  </p>
                ) : (
                  filteredVideos.map((vid) => {
                    const isSelected = activeVideo?.id === vid.id
                    return (
                      <button
                        key={vid.id}
                        type="button"
                        onClick={() => setActiveVideo(vid)}
                        className={`w-full flex items-start gap-3 rounded-2xl p-3 text-left transition ${
                          isSelected
                            ? 'bg-pink-500/10 border border-pink-500/30 text-pink-900 dark:text-pink-200'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent text-[#4B5563] dark:text-slate-300'
                        }`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${
                          isSelected ? 'bg-pink-600 text-white' : 'bg-black/5 dark:bg-white/5 text-[#6B7280]'
                        }`}>
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        </div>
                        <div className="truncate flex-1">
                          <h4 className="text-xs font-bold truncate leading-snug">{vid.title}</h4>
                          <span className="text-[10px] text-[#6B7280] dark:text-slate-400 block mt-0.5">
                            {new Date(vid.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
