'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Flame,
  Sun,
  Moon,
  Timer,
  Coffee,
  CloudRain,
  Waves,
  Trees,
  Music,
  Clock,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newfocus-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newfocus-body' })

type PomodoroMode = 'pomodoro' | 'shortBreak' | 'longBreak'

const MODE_TIMES: Record<PomodoroMode, number> = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Mưa rơi', icon: CloudRain, src: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg' },
  { id: 'waves', name: 'Sóng biển', icon: Waves, src: 'https://actions.google.com/sounds/v1/water/ocean_waves.ogg' },
  { id: 'forest', name: 'Rừng đêm', icon: Trees, src: 'https://actions.google.com/sounds/v1/animals/crickets_night.ogg' },
  { id: 'lofi', name: 'Lofi Cafe', icon: Coffee, src: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
]

const YOUTUBE_TRACKS = [
  { title: 'Lofi Girl - Chill Beats to Relax/Study', id: 'jfKfPfyJRdk' },
  { title: 'Study & Relax Piano Music (Chillhop)', id: '2OEL4P1Rz04' },
  { title: 'Late Night Coding & Focus Mix', id: 'HkZ8BitJhvc' },
  { title: 'Aesthetic Rainy Window Ambient', id: '7NOSDKb0HlU' },
]

const BACKGROUND_THEMES = [
  { id: 'aurora', name: 'Aurora Dreams', gradient: 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.25), transparent 40%), radial-gradient(circle at 90% 90%, rgba(168, 85, 247, 0.25), transparent 40%), #0A1128' },
  { id: 'midnight', name: 'Midnight Deep', gradient: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.18), transparent 50%), #050816' },
  { id: 'forest', name: 'Rừng Thông Zen', gradient: 'radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.2), transparent 45%), #022C22' },
  { id: 'sunset', name: 'Hoàng Hôn Ấm', gradient: 'radial-gradient(circle at 20% 80%, rgba(249, 115, 22, 0.25), transparent 45%), #290B0B' },
]

export default function NewFocusPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [mode, setMode] = useState<PomodoroMode>('pomodoro')
  const [timeLeft, setTimeLeft] = useState(MODE_TIMES.pomodoro)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)

  // Ambient Sound
  const [activeSound, setActiveSound] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Task List
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([
    { id: '1', text: 'Ôn tập 20 câu trắc nghiệm Toán giải tích', done: false },
    { id: '2', text: 'Đọc lại lý thuyết Este - Lipit', done: true },
  ])
  // YouTube Lofi
  const [selectedYoutubeId, setSelectedYoutubeId] = useState('jfKfPfyJRdk')
  const [newTaskText, setNewTaskText] = useState('')

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

  // Timer Tick
  useEffect(() => {
    let interval: any = null
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1)
      }, 1000)
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false)
      if (mode === 'pomodoro') {
        setSessionsCompleted((s) => s + 1)
        alert('🎉 Chúc mừng bạn đã hoàn thành một phiên tập trung sâu!')
      }
    }
    return () => clearInterval(interval)
  }, [isRunning, timeLeft, mode])

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

  const handleSwitchMode = (newMode: PomodoroMode) => {
    setMode(newMode)
    setIsRunning(false)
    setTimeLeft(MODE_TIMES[newMode])
  }

  const handleResetTimer = () => {
    setIsRunning(false)
    setTimeLeft(MODE_TIMES[mode])
  }

  const handleToggleSound = (sound: typeof AMBIENT_SOUNDS[0]) => {
    if (activeSound === sound.id) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setActiveSound(null)
    } else {
      if (audioRef.current) {
        audioRef.current.src = sound.src
        audioRef.current.play().catch(() => {})
      }
      setActiveSound(sound.id)
    }
  }

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskText.trim()) return
    setTasks([...tasks, { id: Date.now().toString(), text: newTaskText.trim(), done: false }])
    setNewTaskText('')
  }

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300 flex flex-col justify-between`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <audio ref={audioRef} loop />

      {/* HEADER */}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
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
                <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <Flame className="inline h-3 w-3 mr-1" /> Không Gian Focus 2.0
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newfocus-heading)' }}>
                Tập Trung Sâu & Quản Lý Ca Học
              </h1>
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

        {/* MAIN BODY: TIMER CARD + TASK LIST CARD */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* POMODORO TIMER CARD */}
          <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
            {/* Mode Switcher */}
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-black/5 dark:bg-white/5 p-1.5">
              <button
                type="button"
                onClick={() => handleSwitchMode('pomodoro')}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  mode === 'pomodoro'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                    : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                }`}
              >
                Học tập (25p)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('shortBreak')}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  mode === 'shortBreak'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                    : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                }`}
              >
                Nghỉ ngắn (5p)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('longBreak')}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  mode === 'longBreak'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                    : 'text-[#6B7280] hover:text-black dark:hover:text-white'
                }`}
              >
                Nghỉ dài (15p)
              </button>
            </div>

            {/* Giant Digital Clock */}
            <div className="py-4">
              <div
                className="font-mono text-7xl sm:text-8xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400 select-none drop-shadow-sm"
                style={{ fontFamily: 'monospace' }}
              >
                {timeFormatted}
              </div>
              <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-widest mt-2 block">
                {mode === 'pomodoro' ? '🎯 Phiên tập trung' : '☕ Giờ giải lao'}
              </span>
            </div>

            {/* Timer Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className={`flex h-14 w-36 items-center justify-center gap-2 rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 ${
                  isRunning
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-[#111827] dark:bg-white text-white dark:text-slate-900'
                }`}
              >
                {isRunning ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                {isRunning ? 'Tạm dừng' : 'Bắt đầu'}
              </button>

              <button
                type="button"
                onClick={handleResetTimer}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105 active:scale-95"
                title="Đặt lại đồng hồ"
              >
                <RotateCcw className="h-5 w-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Ambient Sound Toggles */}
            <div className="pt-4 border-t border-black/10 dark:border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-3">
                Âm Thanh Môi Trường Giúp Tập Trung
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AMBIENT_SOUNDS.map((sound) => {
                  const Icon = sound.icon
                  const isPlayingSound = activeSound === sound.id
                  return (
                    <button
                      key={sound.id}
                      type="button"
                      onClick={() => handleToggleSound(sound)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-xs font-bold border transition ${
                        isPlayingSound
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                          : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{sound.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* TASK LIST & FOCUS STATS */}
          <div className="space-y-6">
            {/* Focus Streak Card */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newfocus-heading)' }}>
                    Phiên hoàn thành hôm nay
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">
                    Mỗi phiên kéo dài 25 phút giúp tối đa hóa phản xạ
                  </p>
                </div>
              </div>
              <div className="text-3xl font-black text-orange-500" style={{ fontFamily: 'var(--font-newfocus-heading)' }}>
                {sessionsCompleted} 🔥
              </div>
            </div>

            {/* Todo List Card */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newfocus-heading)' }}>
                  Mục Tiêu Ca Học ({tasks.filter((t) => t.done).length}/{tasks.length})
                </h3>
              </div>

              {/* Add Task Form */}
              <form onSubmit={handleAddTask} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Thêm việc cần làm trong ca học này..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow transition hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Tasks List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs font-bold transition ${
                      task.done
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-[#6B7280] line-through'
                        : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 flex-1 cursor-pointer"
                      onClick={() => handleToggleTask(task.id)}
                    >
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${task.done ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`}
                      />
                      <span>{task.text}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* LO-FI YOUTUBE STREAM PLAYER WIDGET */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-newfocus-heading)' }}>
                    Nhạc Lo-Fi Học Tập (YouTube)
                  </h3>
                </div>
              </div>

              {/* YouTube Iframe Player */}
              <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 aspect-video bg-black shadow-inner">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedYoutubeId}?autoplay=1&mute=0&controls=1&loop=1&playlist=${selectedYoutubeId}`}
                  title="YouTube Lo-Fi Live"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Quick Track Switcher */}
              <div className="grid grid-cols-2 gap-2">
                {YOUTUBE_TRACKS.map((trk) => (
                  <button
                    key={trk.id}
                    type="button"
                    onClick={() => setSelectedYoutubeId(trk.id)}
                    className={`rounded-xl border p-2.5 text-left text-[11px] font-bold transition line-clamp-1 ${
                      selectedYoutubeId === trk.id
                        ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10'
                    }`}
                  >
                    🎵 {trk.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
