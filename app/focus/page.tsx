'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, TimerReset, Timer, PlayCircle, PauseCircle, LibraryBig, Video, Music2, Palette, ArrowRight, MoonStar, SunMedium, SquarePlay } from 'lucide-react'

const STUDY_BACKGROUNDS = [
  {
    id: 'aurora',
    name: 'Aurora',
    className: 'bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.35),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(248,113,113,0.28),_transparent_30%),linear-gradient(135deg,_#08111f_0%,_#101a33_48%,_#1b2748_100%)]',
  },
  {
    id: 'paper',
    name: 'Paper',
    className: 'bg-[linear-gradient(135deg,_#f6efe8_0%,_#e8eef8_52%,_#dde9e3_100%)]',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    className: 'bg-[radial-gradient(circle_at_center,_rgba(129,140,248,0.2),_transparent_36%),linear-gradient(180deg,_#050816_0%,_#111827_48%,_#1f2937_100%)]',
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    className: 'bg-[linear-gradient(135deg,_#fff4db_0%,_#ffd7c2_46%,_#ffe9f3_100%)]',
  },
]

const LIBRARY_SHORTCUTS = [
  { title: 'Toàn bộ thư viện', description: 'Mở không gian lưu trữ tài liệu và đề thi', href: '/library' },
  { title: 'Đề thi gần đây', description: 'Nhanh chóng vào khu vực đề và bài làm', href: '/library?folder=recent' },
  { title: 'Tài liệu ôn tập', description: 'Các file PDF, slide và ghi chú học tập', href: '/library?folder=study' },
]

const YOUTUBE_SUGGESTIONS = [
  {
    title: 'Lo-fi hip hop radio',
    description: 'Kênh nhạc nền kinh điển để tập trung',
    videoId: 'DWcJFNfaw9c',
  },
  {
    title: 'Relaxing study beats',
    description: 'Nhịp nhẹ, ít lời, hợp với đọc và làm bài',
    videoId: '2OEL4P1Rz04',
  },
  {
    title: 'Ambient focus session',
    description: 'Âm nền êm, phù hợp cho khung học dài',
    videoId: 'HkZ8BitJhvc',
  },
]

const LOFI_PLAYLIST = [
  { title: 'Chill beats to study to', artist: 'lofi girl', videoId: 'DWcJFNfaw9c' },
  { title: 'Study and relax', artist: 'chillhop music', videoId: '2OEL4P1Rz04' },
  { title: 'Late night coding', artist: 'focus mix', videoId: 'HkZ8BitJhvc' },
  { title: 'Soft piano focus', artist: 'relaxing ambient', videoId: 'DWcJFNfaw9c' },
]

type TimerMode = 'countdown' | 'stopwatch'

function getEmbedUrl(videoId: string, autoplay = false) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&fs=1${autoplay ? '&autoplay=1&mute=1' : ''}`
}

export default function FocusRoomPage() {
  const [backgroundId, setBackgroundId] = useState(STUDY_BACKGROUNDS[0].id)
  const [tab, setTab] = useState<'library' | 'youtube'>('library')
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown')
  const [countdownInput, setCountdownInput] = useState('45:00')
  const [countdownSeconds, setCountdownSeconds] = useState(45 * 60)
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState(YOUTUBE_SUGGESTIONS[0].videoId)
  const [selectedLofiVideoId, setSelectedLofiVideoId] = useState(LOFI_PLAYLIST[0].videoId)

  const activeBackground = useMemo(() => STUDY_BACKGROUNDS.find(item => item.id === backgroundId) ?? STUDY_BACKGROUNDS[0], [backgroundId])
  const isLightBackground = backgroundId === 'paper' || backgroundId === 'sunrise'
  const shellTextClass = isLightBackground ? 'text-slate-950' : 'text-slate-100'
  const cardClass = isLightBackground
    ? 'border border-slate-300/70 bg-white/82 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl'
    : 'border border-white/15 bg-slate-950/35 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl'
  const softTextClass = isLightBackground ? 'text-slate-700' : 'text-white/75'
  const mutedTextClass = isLightBackground ? 'text-slate-600' : 'text-white/60'
  const parseCountdownValue = (value: string) => {
    const normalized = value.trim()
    const parts = normalized.split(':').map(part => Number(part))
    if (parts.length !== 2 || parts.some(num => Number.isNaN(num))) return null
    const [minutes, seconds] = parts
    return Math.max(minutes * 60 + seconds, 0)
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isRunning) return
      if (timerMode === 'countdown') {
        setCountdownSeconds(prev => Math.max(prev - 1, 0))
        return
      }
      setStopwatchSeconds(prev => prev + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isRunning, timerMode])

  const formattedCountdown = useMemo(() => {
    const total = Math.max(countdownSeconds, 0)
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [countdownSeconds])

  const formattedStopwatch = useMemo(() => {
    const total = Math.max(stopwatchSeconds, 0)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
  }, [stopwatchSeconds])

  const filteredSuggestions = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return YOUTUBE_SUGGESTIONS
    return YOUTUBE_SUGGESTIONS.filter(item =>
      `${item.title} ${item.description}`.toLowerCase().includes(keyword),
    )
  }, [searchTerm])

  const currentTimerDisplay = timerMode === 'countdown' ? formattedCountdown : formattedStopwatch

  const handleCountdownInputChange = (value: string) => {
    setCountdownInput(value)
    const parsedSeconds = parseCountdownValue(value)
    if (parsedSeconds !== null) {
      setCountdownSeconds(parsedSeconds)
    }
  }

  const handlePlayLofiTrack = (videoId: string) => {
    setSelectedLofiVideoId(videoId)
    setSelectedVideoId(videoId)
    setTab('youtube')
  }

  const handleResetTimer = () => {
    setIsRunning(false)
    if (timerMode === 'countdown') {
      setCountdownSeconds(45 * 60)
      setCountdownInput('45:00')
      return
    }
    setStopwatchSeconds(0)
  }

  const handleStartPause = () => {
    if (timerMode === 'countdown' && countdownSeconds === 0) {
      setCountdownSeconds(45 * 60)
      setCountdownInput('45:00')
    }
    setIsRunning(prev => !prev)
  }

  return (
    <main className={`min-h-screen ${shellTextClass} ${activeBackground.className}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-5 px-3 py-4 sm:px-5 lg:px-6">
        <section className={`rounded-[2rem] p-5 shadow-[0_20px_80px_rgba(15,23,42,0.28)] ${cardClass}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${isLightBackground ? 'border border-slate-300 bg-white/75 text-slate-700' : 'border border-white/15 bg-white/10 text-white/80'}`}>
                <MoonStar className="h-4 w-4" />
                Focus Room
              </div>
              <h1 className={`text-3xl font-black tracking-tight sm:text-4xl ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>
                Phòng tập trung học bài
              </h1>
              <p className={`max-w-3xl text-sm leading-6 sm:text-base ${softTextClass}`}>
                Chọn nền phù hợp, mở tài liệu, nghe lo-fi và giữ nhịp học theo cách của bạn.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {STUDY_BACKGROUNDS.map(background => (
                <button
                  key={background.id}
                  type="button"
                  onClick={() => setBackgroundId(background.id)}
                  className={`group rounded-2xl px-4 py-3 text-left transition ${background.id === backgroundId ? (isLightBackground ? 'border border-slate-400 bg-white/90 shadow-lg' : 'border border-white/60 bg-white/20 shadow-lg') : (isLightBackground ? 'border border-slate-300 bg-white/65 hover:bg-white/80' : 'border border-white/10 bg-white/5 hover:bg-white/10')}`}
                >
                  <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${isLightBackground ? 'bg-slate-900/10 text-slate-900' : 'bg-white/15 text-white'}`}>
                    <Palette className="h-5 w-5" />
                  </div>
                  <div className={`text-sm font-bold ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>{background.name}</div>
                  <div className={`text-xs ${mutedTextClass}`}>Nền tùy chọn</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.94fr)_minmax(0,1.18fr)] items-stretch">
          <article className={`h-full min-h-[720px] rounded-[2rem] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] ${cardClass}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${isLightBackground ? 'text-cyan-700/80' : 'text-cyan-200/80'}`}>Tab 1</p>
                <h2 className={`text-xl font-black ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>Tài liệu & YouTube</h2>
              </div>
              <div className={`inline-flex rounded-full p-1 ${isLightBackground ? 'border border-slate-300 bg-white/70' : 'border border-white/10 bg-white/10'}`}>
                <button
                  type="button"
                  onClick={() => setTab('library')}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === 'library' ? (isLightBackground ? 'bg-slate-900 text-white' : 'bg-white text-slate-900') : (isLightBackground ? 'text-slate-700 hover:text-slate-950' : 'text-white/75 hover:text-white')}`}
                >
                  Thư viện
                </button>
                <button
                  type="button"
                  onClick={() => setTab('youtube')}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === 'youtube' ? (isLightBackground ? 'bg-slate-900 text-white' : 'bg-white text-slate-900') : (isLightBackground ? 'text-slate-700 hover:text-slate-950' : 'text-white/75 hover:text-white')}`}
                >
                  YouTube
                </button>
              </div>
            </div>

            {tab === 'library' ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-4 ${isLightBackground ? 'border border-slate-300 bg-white/80' : 'border border-white/10 bg-white/5'}`}>
                  <div className={`mb-3 flex items-center gap-2 ${isLightBackground ? 'text-slate-950' : 'text-white/90'}`}>
                    <LibraryBig className="h-5 w-5" />
                    <span className="text-sm font-semibold">Truy cập thư viện</span>
                  </div>
                  <p className={`text-sm leading-6 ${softTextClass}`}>
                    Mở nhanh thư viện để tìm file, đề thi, ghi chú hoặc tài liệu ôn tập.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/library"
                      className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Vào thư viện
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/library"
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${isLightBackground ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50' : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'}`}
                    >
                      Xem toàn bộ file
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {LIBRARY_SHORTCUTS.map(item => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className={`group flex items-start justify-between gap-4 rounded-2xl p-4 transition ${isLightBackground ? 'border border-slate-300 bg-white/75 hover:border-cyan-400/40 hover:bg-white' : 'border border-white/10 bg-white/5 hover:border-cyan-300/40 hover:bg-white/10'}`}
                    >
                      <div>
                        <div className={`text-sm font-bold ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>{item.title}</div>
                        <div className={`mt-1 text-sm leading-6 ${mutedTextClass}`}>{item.description}</div>
                      </div>
                      <ArrowRight className={`mt-1 h-4 w-4 transition group-hover:translate-x-0.5 ${isLightBackground ? 'text-slate-500 group-hover:text-cyan-700' : 'text-white/50 group-hover:text-cyan-200'}`} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isLightBackground ? 'border border-slate-300 bg-white/85' : 'border border-white/10 bg-white/5'}`}>
                  <Search className={`h-5 w-5 ${isLightBackground ? 'text-slate-500' : 'text-white/60'}`} />
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Tìm video lo-fi, piano, ambient..."
                    className={`w-full bg-transparent text-sm outline-none ${isLightBackground ? 'text-slate-950 placeholder:text-slate-400' : 'text-white placeholder:text-white/40'}`}
                  />
                </label>

                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
                  <iframe
                    title="YouTube focus player"
                    key={selectedVideoId}
                    className="aspect-video w-full min-h-[320px]"
                    src={getEmbedUrl(selectedVideoId, true)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {filteredSuggestions.map(video => (
                    <button
                      key={video.videoId}
                      type="button"
                      onClick={() => setSelectedVideoId(video.videoId)}
                      className={`rounded-2xl border p-3 text-left transition ${selectedVideoId === video.videoId ? (isLightBackground ? 'border-cyan-500/60 bg-cyan-50' : 'border-cyan-300/70 bg-cyan-300/10') : (isLightBackground ? 'border-slate-300 bg-white/75 hover:bg-white' : 'border-white/10 bg-white/5 hover:bg-white/10')}`}
                    >
                      <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${isLightBackground ? 'bg-slate-900/10 text-slate-900' : 'bg-white/10 text-white'}`}>
                        <Video className="h-5 w-5" />
                      </div>
                      <div className={`text-sm font-bold ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>{video.title}</div>
                      <div className={`mt-1 text-xs leading-5 ${mutedTextClass}`}>{video.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>

          <article className={`h-full min-h-[720px] rounded-[2rem] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] ${cardClass}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${isLightBackground ? 'text-amber-700/80' : 'text-amber-200/80'}`}>Tab 2</p>
                <h2 className={`text-xl font-black ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>Đồng hồ tập trung</h2>
              </div>
              <div className={`inline-flex rounded-full p-1 ${isLightBackground ? 'border border-slate-300 bg-white/70' : 'border border-white/10 bg-white/10'}`}>
                <button
                  type="button"
                  onClick={() => setTimerMode('countdown')}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${timerMode === 'countdown' ? (isLightBackground ? 'bg-slate-900 text-white' : 'bg-white text-slate-900') : (isLightBackground ? 'text-slate-700 hover:text-slate-950' : 'text-white/75 hover:text-white')}`}
                >
                  Đếm ngược
                </button>
                <button
                  type="button"
                  onClick={() => setTimerMode('stopwatch')}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${timerMode === 'stopwatch' ? (isLightBackground ? 'bg-slate-900 text-white' : 'bg-white text-slate-900') : (isLightBackground ? 'text-slate-700 hover:text-slate-950' : 'text-white/75 hover:text-white')}`}
                >
                  Đếm thời gian
                </button>
              </div>
            </div>

            <div className={`rounded-[1.75rem] p-5 text-center shadow-inner ${isLightBackground ? 'border border-slate-300 bg-gradient-to-b from-white/90 to-white/70' : 'border border-white/10 bg-gradient-to-b from-white/10 to-white/5'}`}>
              <div className={`mb-2 flex items-center justify-center gap-2 ${softTextClass}`}>
                <Timer className="h-5 w-5" />
                <span className="text-sm font-medium">{timerMode === 'countdown' ? 'Pomodoro / nghỉ giữa giờ' : 'Session đang chạy'}</span>
              </div>
              <div className={`text-5xl font-black tracking-[0.08em] sm:text-6xl ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>
                {currentTimerDisplay}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleStartPause}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  {isRunning ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                  {isRunning ? 'Tạm dừng' : 'Bắt đầu'}
                </button>
                <button
                  type="button"
                  onClick={handleResetTimer}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${isLightBackground ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50' : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'}`}
                >
                  <TimerReset className="h-5 w-5" />
                  Reset
                </button>
              </div>
            </div>

            <div className={`mt-5 space-y-4 rounded-2xl p-4 ${isLightBackground ? 'border border-slate-300 bg-white/75' : 'border border-white/10 bg-white/5'}`}>
              {timerMode === 'countdown' ? (
                <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${softTextClass}`}>Đặt thời gian bắt đầu</span>
                  <input
                    value={countdownInput}
                    onChange={event => handleCountdownInputChange(event.target.value)}
                    placeholder="45:00"
                    className={`w-full rounded-2xl px-4 py-3 text-sm outline-none ${isLightBackground ? 'border border-slate-300 bg-white text-slate-950 placeholder:text-slate-400' : 'border border-white/10 bg-black/20 text-white placeholder:text-white/40'}`}
                  />
                </label>
              ) : (
                <div className={`rounded-2xl px-4 py-3 text-sm ${isLightBackground ? 'border border-slate-300 bg-white text-slate-700' : 'border border-white/10 bg-black/20 text-white/70'}`}>
                  Đồng hồ sẽ chạy từ 00:00 cho đến khi bạn dừng lại.
                </div>
              )}

              <div className={`rounded-2xl px-4 py-3 text-sm ${isLightBackground ? 'border border-slate-300 bg-white text-slate-700' : 'border border-white/10 bg-black/20 text-white/70'}`}>
                Gợi ý: chia phiên học thành 25 phút tập trung và 5 phút nghỉ để giữ nhịp lâu hơn.
              </div>
            </div>
          </article>

          <article className={`h-full min-h-[720px] rounded-[2rem] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] ${cardClass}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${isLightBackground ? 'text-fuchsia-700/80' : 'text-fuchsia-200/80'}`}>Tab 3</p>
                <h2 className={`text-xl font-black ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>Lofi chill cho học bài</h2>
              </div>
              <Music2 className={`h-5 w-5 ${isLightBackground ? 'text-slate-600' : 'text-white/70'}`} />
            </div>

            <div className={`rounded-[1.5rem] p-4 ${isLightBackground ? 'border border-slate-300 bg-white/75' : 'border border-white/10 bg-white/5'}`}>
              <p className={`text-sm leading-6 ${softTextClass}`}>
                Chọn một bài để phát ngay ở khung bên trái. Cột này chỉ hiển thị danh sách để tránh chiếm thêm không gian video.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {LOFI_PLAYLIST.map(track => (
                <button
                  key={track.videoId}
                  type="button"
                  onClick={() => handlePlayLofiTrack(track.videoId)}
                  className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${selectedLofiVideoId === track.videoId ? (isLightBackground ? 'border border-fuchsia-400/50 bg-fuchsia-50' : 'border border-fuchsia-300/40 bg-fuchsia-300/10') : (isLightBackground ? 'border border-slate-300 bg-white/75 hover:bg-white' : 'border border-white/10 bg-white/5 hover:bg-white/10')}`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isLightBackground ? 'bg-slate-900/10 text-slate-900' : 'bg-white/10 text-white'}`}>
                    <SquarePlay className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-bold ${isLightBackground ? 'text-slate-950' : 'text-white'}`}>{track.title}</div>
                    <div className={`text-xs ${mutedTextClass}`}>{track.artist}</div>
                  </div>
                  <ArrowRight className={`h-4 w-4 transition group-hover:translate-x-0.5 ${isLightBackground ? 'text-slate-500 group-hover:text-fuchsia-700' : 'text-white/45 group-hover:text-fuchsia-200'}`} />
                </button>
              ))}
            </div>

            <div className={`mt-5 rounded-2xl p-4 ${isLightBackground ? 'border border-slate-300 bg-gradient-to-br from-fuchsia-100 to-cyan-50' : 'border border-white/10 bg-gradient-to-br from-fuchsia-500/15 to-cyan-500/10'}`}>
              <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${isLightBackground ? 'text-slate-950' : 'text-white/90'}`}>
                <SunMedium className="h-4 w-4" />
                Cài đặt nhẹ
              </div>
              <p className={`text-sm leading-6 ${softTextClass}`}>
                Mở một bản lo-fi, hạ ánh sáng màn hình và để nền bạn chọn hỗ trợ nhịp tập trung.
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
