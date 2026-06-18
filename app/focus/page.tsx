'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Search, TimerReset, Timer, PlayCircle, PauseCircle, LibraryBig, 
  Video, Music2, Palette, ArrowRight, MoonStar, SunMedium, SquarePlay, 
  PlusCircle, Volume2, Gauge, SkipBack, SkipForward, ArrowLeft, 
  Maximize2, Minimize2, Bot, Sparkles, Send, Image as ImageIcon, FileText, Trash2, Loader2, GripVertical
} from 'lucide-react'

// 🌟 THƯ VIỆN RENDER MARKDOWN & CÔNG THỨC TOÁN HỌC
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// ============================================================================
// CONSTANTS & DATA
// ============================================================================

const STUDY_BACKGROUNDS = [
  {
    id: 'aurora',
    name: 'Aurora Dreams',
    className: 'bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.15),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(167,139,250,0.15),_transparent_40%),linear-gradient(135deg,_#08111f_0%,_#101a33_100%)]',
  },
  {
    id: 'midnight',
    name: 'Midnight Focus',
    className: 'bg-[radial-gradient(circle_at_center,_rgba(129,140,248,0.1),_transparent_50%),linear-gradient(180deg,_#050816_0%,_#0f172a_100%)]',
  },
  {
    id: 'forest',
    name: 'Deep Forest',
    className: 'bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.1),_transparent_40%),linear-gradient(135deg,_#022c22_0%,_#064e3b_100%)]',
  },
  {
    id: 'sunset',
    name: 'Sunset Vibe',
    className: 'bg-[radial-gradient(circle_at_bottom_left,_rgba(2fb,146,60,0.15),_transparent_40%),linear-gradient(135deg,_#450a0a_0%,_#7c2d12_100%)]',
  },
]

const LOFI_PLAYLIST = [
  { title: 'Lofi Girl - chill beats', artist: 'lofi girl', videoId: 'DWcJFNfaw9c' },
  { title: 'Study and relax piano', artist: 'chillhop', videoId: '2OEL4P1Rz04' },
  { title: 'Late night coding vibes', artist: 'focus mix', videoId: 'HkZ8BitJhvc' },
  { title: 'Aesthetic rainy focus', artist: 'ambient', videoId: '7NOSDKb0HlU' },
]

type TimerMode = 'countdown' | 'stopwatch'
type VideoTrack = { title: string; description?: string; artist?: string; videoId: string }
type LibraryDoc = { id: string; title: string; drive_file_id: string | null }
type ChatFile = { url: string; base64: string; mimeType: string; isPdf: boolean; name: string }
type ChatMessage = { role: 'user' | 'model'; text: string; files?: ChatFile[] }
type YouTubePlayer = any // Bypassing strict YT types for simplicity in React

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function extractYoutubeId(input: string) {
  const value = input.trim()
  const rawIdPattern = /^[a-zA-Z0-9_-]{11}$/
  if (rawIdPattern.test(value)) return value
  try {
    const parsed = new URL(value)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1)
    if (parsed.hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v')
      if (watchId) return watchId
      const embedMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
      if (embedMatch) return embedMatch[1]
    }
  } catch { return null }
  return null
}

const mdCard = "bg-white/5 dark:bg-[#1A1A1A]/60 backdrop-blur-2xl backdrop-saturate-[1.5] border border-white/20 dark:border-white/10 shadow-lg rounded-[2rem] overflow-hidden transition-all duration-300"

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function FocusRoomPage() {
  const router = useRouter()
  
  // -- Cấu trúc Layout (Split Pane) --
  const [leftWidth, setLeftWidth] = useState(55) // Theo phần trăm (%)
  const [isDragging, setIsDragging] = useState(false)

  // -- States: Giao diện & Chủ đề --
  const [isDark, setIsDark] = useState(true) // Focus room ưu tiên nền tối
  const [backgroundId, setBackgroundId] = useState(STUDY_BACKGROUNDS[0].id)
  const activeBackground = useMemo(() => STUDY_BACKGROUNDS.find(item => item.id === backgroundId) ?? STUDY_BACKGROUNDS[0], [backgroundId])

  // -- States: Bộ đếm thời gian --
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown')
  const [countdownInput, setCountdownInput] = useState('45')
  const [countdownSeconds, setCountdownSeconds] = useState(45 * 60)
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // -- States: Video Player --
  const [selectedVideoId, setSelectedVideoId] = useState(LOFI_PLAYLIST[0].videoId)
  const [isVideoMaximized, setIsVideoMaximized] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(50)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)

  // -- States: Thư viện --
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([])
  const [activeLibraryDoc, setActiveLibraryDoc] = useState<LibraryDoc | null>(null)
  
  // -- States: SenAI Chat --
  const [messages, setMessages] = useState<ChatMessage[]>([{ 
    role: 'model', 
    text: 'Chào bạn! Mình là **Trợ lý Focus Room**. Mình có thể giúp bạn giải bài tập, dịch tài liệu, hoặc tự động thiết lập thời gian học và chọn nhạc cho bạn. Kéo thả PDF hoặc hình ảnh vào đây nhé! 🚀' 
  }])
  const [chatInput, setChatInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<ChatFile[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [userName, setUserName] = useState('Học sinh')

  // ============================================================================
  // EFFECTS: LAYOUT RESIZING
  // ============================================================================
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newWidth = (e.clientX / window.innerWidth) * 100
      setLeftWidth(Math.max(30, Math.min(newWidth, 70))) // Giới hạn từ 30% đến 70%
    }
    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // ============================================================================
  // EFFECTS: INITIALIZATION
  // ============================================================================
  useEffect(() => {
    document.documentElement.classList.add('dark') // Ép Darkmode cho đẹp
    
    // Lấy tên người dùng
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        if (data?.full_name) setUserName(data.full_name)
      }
      
      // Load Library
      const { data: docs } = await supabase.from('library_documents').select('id,title,drive_file_id').not('drive_file_id', 'is', null).limit(20)
      if (docs) setLibraryDocs(docs)
    }
    fetchUser()
  }, [])

  // ============================================================================
  // EFFECTS: TIMER TICK
  // ============================================================================
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isRunning) return
      if (timerMode === 'countdown') {
        setCountdownSeconds(prev => {
          if (prev <= 1) { setIsRunning(false); alert('Hết giờ học rồi! Nghỉ ngơi chút nhé 🌸'); return 0 }
          return prev - 1
        })
      } else {
        setStopwatchSeconds(prev => prev + 1)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isRunning, timerMode])

  const currentTimerDisplay = useMemo(() => {
    const total = timerMode === 'countdown' ? countdownSeconds : stopwatchSeconds
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [countdownSeconds, stopwatchSeconds, timerMode])

  // ============================================================================
  // EFFECTS: YOUTUBE IFRAME API
  // ============================================================================
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return
      playerRef.current = new window.YT.Player('focus-yt-player', {
        videoId: selectedVideoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(volumeLevel)
            setIsPlayerReady(true)
          },
        },
      })
    }

    if (window.YT?.Player) { initPlayer(); return }
    const scriptId = 'youtube-iframe-api'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId; script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
    window.onYouTubeIframeAPIReady = initPlayer
  }, [selectedVideoId]) // Phụ thuộc vào VideoID để load lại

  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      playerRef.current.loadVideoById(selectedVideoId)
    }
  }, [selectedVideoId, isPlayerReady])

  useEffect(() => {
    if (isPlayerReady && playerRef.current) playerRef.current.setVolume(volumeLevel)
  }, [volumeLevel, isPlayerReady])

  // ============================================================================
  // HANDLERS: SEN AI CHAT (MULTIMODAL + COMMAND EXECUTION)
  // ============================================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const isPdf = file.type === 'application/pdf'
      if (!isPdf && !file.type.startsWith('image/')) {
        alert('Chỉ hỗ trợ file PDF hoặc Hình ảnh (JPG, PNG).')
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1]
        setSelectedFiles(prev => [...prev, { 
          url: URL.createObjectURL(file), 
          base64: base64Data, 
          mimeType: file.type,
          isPdf,
          name: file.name
        }])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!chatInput.trim() && selectedFiles.length === 0) || isChatLoading) return

    const userText = chatInput.trim()
    const userFiles = [...selectedFiles]
    setChatInput('')
    setSelectedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: userText, files: userFiles }]
    setMessages(nextHistory)
    setIsChatLoading(true)

    // Scroll bottom
    setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight }, 50)

    try {
      const systemContext = `Bạn là SenAI - Trợ lý Học tập thông minh trong Phòng Tập Trung (Focus Room) của hệ thống SenExam.
      Tên người dùng: ${userName}. (Nếu tên chứa chữ "Minh", đây là Boss/Người sáng lập hệ thống).
      
      NHIỆM VỤ ĐẶC BIỆT (SMART ACTIONS):
      Bạn có quyền ĐIỀU KHIỂN phòng học của học sinh bằng cách chèn các [MÃ LỆNH] vào câu trả lời của mình. Hãy tự động chèn mã nếu người dùng yêu cầu:
      1. Để đặt đồng hồ đếm ngược: Chèn [TIMER:số_phút]. Ví dụ: [TIMER:25] (để đặt 25 phút).
      2. Để chuyển nhạc/video: Chèn [PLAY:YoutubeID]. Ví dụ nhạc Lofi: [PLAY:DWcJFNfaw9c], Piano: [PLAY:2OEL4P1Rz04], Mưa: [PLAY:7NOSDKb0HlU].
      
      QUY TẮC HIỂN THỊ:
      - Sử dụng dấu chấm "." cho phép nhân, phẩy "," cho thập phân.
      - LUÔN LUÔN BỌC CÔNG THỨC TOÁN HỌC TRONG DẤU $ (inline) hoặc $$ (block).
      - Hãy đọc kỹ file ảnh/PDF người dùng gửi lên để giải đáp thật chi tiết, từng bước một.`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: messages.map(m => ({ role: m.role, text: m.text })), // Chỉ gửi text history
          images: userFiles.map(f => ({ mimeType: f.mimeType, base64: f.base64 })),
          context: systemContext
        }),
      })

      const data = await response.json()
      if (response.ok && data.text) {
        let aiRawText = data.text

        // 🌟 XỬ LÝ LỆNH NGẦM (ACTION PARSER)
        // 1. Lệnh Đặt thời gian
        const timerMatch = aiRawText.match(/\[TIMER:(\d+)\]/i)
        if (timerMatch) {
          const minutes = parseInt(timerMatch[1])
          setCountdownSeconds(minutes * 60)
          setCountdownInput(String(minutes))
          setTimerMode('countdown')
          setIsRunning(true)
          aiRawText = aiRawText.replace(/\[TIMER:\d+\]/gi, '') // Xóa tag
        }

        // 2. Lệnh Mở nhạc
        const playMatch = aiRawText.match(/\[PLAY:([a-zA-Z0-9_-]{11})\]/i)
        if (playMatch) {
          setSelectedVideoId(playMatch[1])
          if (!isRunning) setIsRunning(true)
          aiRawText = aiRawText.replace(/\[PLAY:[a-zA-Z0-9_-]{11}\]/gi, '')
        }

        setMessages([...nextHistory, { role: 'model', text: aiRawText.trim() }])
      } else {
        throw new Error('API Error')
      }
    } catch (error) {
      setMessages([...nextHistory, { role: 'model', text: '⚠️ Xin lỗi, mình đang mất kết nối tới máy chủ AI. Bạn hãy thử lại nhé!' }])
    } finally {
      setIsChatLoading(false)
      setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight }, 100)
    }
  }

  // ============================================================================
  // RENDER UI
  // ============================================================================
  return (
    <div className={`h-screen w-full flex flex-col text-white font-sans overflow-hidden transition-colors duration-1000 ${activeBackground.className}`}>
      
      {/* 🌟 OVERLAY TRONG SUỐT CHO KÉO THẢ CHỐNG LAG IFRAME */}
      {isDragging && <div className="fixed inset-0 z-[9999] cursor-col-resize" />}

      {/* 🌟 HEADER CHUNG */}
      <header className="h-[70px] shrink-0 px-6 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md relative z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2.5 rounded-full hover:bg-white/10 transition-colors border border-white/20">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              Focus Room <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
            </h1>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Không gian luyện thi đỉnh cao</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {STUDY_BACKGROUNDS.map(bg => (
            <button
              key={bg.id}
              onClick={() => setBackgroundId(bg.id)}
              title={bg.name}
              className={`w-8 h-8 rounded-full border-2 transition-all ${backgroundId === bg.id ? 'border-cyan-400 scale-110' : 'border-transparent hover:border-white/50'}`}
              style={{ background: bg.id === 'midnight' ? '#0f172a' : bg.id === 'forest' ? '#064e3b' : bg.id === 'sunset' ? '#7c2d12' : '#101a33' }}
            />
          ))}
        </div>
      </header>

      {/* 🌟 MAIN SPLIT LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* ========================================================= */}
        {/* PANEL TRÁI: ĐIỀU KHIỂN FOCUS (LƯỚI BENTO) */}
        {/* ========================================================= */}
        <div style={{ width: `${leftWidth}%` }} className="h-full p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          
          {/* HÀNG 1: ĐỒNG HỒ & TRÌNH PHÁT NHẠC */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            
            {/* THẺ ĐỒNG HỒ */}
            <div className={`${mdCard} p-6 flex flex-col items-center justify-center relative overflow-hidden group`}>
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-50"></div>
              
              <div className="flex items-center gap-2 bg-white/10 rounded-full p-1 mb-6 border border-white/10">
                <button onClick={() => setTimerMode('countdown')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${timerMode === 'countdown' ? 'bg-cyan-500 text-black shadow-md' : 'text-white/60 hover:text-white'}`}>Đếm ngược</button>
                <button onClick={() => setTimerMode('stopwatch')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${timerMode === 'stopwatch' ? 'bg-cyan-500 text-black shadow-md' : 'text-white/60 hover:text-white'}`}>Tính giờ</button>
              </div>

              <div className="text-[5rem] lg:text-[6rem] font-black tracking-tighter leading-none mb-6 drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                {currentTimerDisplay}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setIsRunning(!isRunning)} className="w-14 h-14 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center transition-transform active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                  {isRunning ? <PauseCircle className="w-8 h-8"/> : <PlayCircle className="w-8 h-8"/>}
                </button>
                <button onClick={() => { setIsRunning(false); if(timerMode==='countdown') setCountdownSeconds(parseInt(countdownInput)*60); else setStopwatchSeconds(0) }} className="w-12 h-12 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <TimerReset className="w-5 h-5"/>
                </button>
              </div>

              {timerMode === 'countdown' && !isRunning && (
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-xs text-white/50 font-bold uppercase">Cài đặt (phút):</span>
                  <input 
                    type="number" 
                    value={countdownInput}
                    onChange={(e) => { setCountdownInput(e.target.value); setCountdownSeconds(parseInt(e.target.value)*60 || 0) }}
                    className="w-16 bg-black/30 border border-white/20 rounded-lg px-2 py-1 text-center font-bold text-sm outline-none focus:border-cyan-400"
                  />
                </div>
              )}
            </div>

            {/* THẺ TRÌNH PHÁT VIDEO LOFI */}
            <div className={`${mdCard} flex flex-col p-4`}>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-black text-sm uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                  <Music2 className="w-4 h-4"/> Lofi & Media
                </h3>
                <button onClick={() => setIsVideoMaximized(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white" title="Phóng to Video">
                  <Maximize2 className="w-4 h-4"/>
                </button>
              </div>

              {/* 🌟 CONTAINER VIDEO CÓ THỂ BẬT FULLSCREEN */}
              <div className={`transition-all duration-500 bg-black overflow-hidden ${isVideoMaximized ? 'fixed inset-4 z-[200] rounded-[2rem] shadow-2xl' : 'relative w-full aspect-video rounded-2xl mb-4 border border-white/10'}`}>
                {isVideoMaximized && (
                  <button onClick={() => setIsVideoMaximized(false)} className="absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors">
                    <Minimize2 className="w-6 h-6"/>
                  </button>
                )}
                <div id="focus-yt-player" className="w-full h-full pointer-events-none sm:pointer-events-auto"></div>
              </div>

              {/* Media Controls */}
              <div className="bg-black/20 rounded-2xl p-3 border border-white/10 flex items-center gap-4">
                <Volume2 className="w-5 h-5 text-white/50 shrink-0"/>
                <input 
                  type="range" min={0} max={100} value={volumeLevel} 
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Quick Playlist */}
              <div className="mt-3 flex overflow-x-auto gap-2 custom-scrollbar pb-2">
                {LOFI_PLAYLIST.map(track => (
                  <button 
                    key={track.videoId} onClick={() => setSelectedVideoId(track.videoId)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${selectedVideoId === track.videoId ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'}`}
                  >
                    {track.title}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* HÀNG 2: THƯ VIỆN & TÀI LIỆU */}
          <div className={`${mdCard} p-6 flex-1 flex flex-col min-h-[300px]`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <LibraryBig className="w-4 h-4"/> Thư viện Tài liệu
              </h3>
              {activeLibraryDoc && (
                <button onClick={() => setActiveLibraryDoc(null)} className="text-xs bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full font-bold hover:bg-rose-500/40 transition-colors">
                  Đóng File
                </button>
              )}
            </div>

            {activeLibraryDoc && activeLibraryDoc.drive_file_id ? (
              <div className="flex-1 bg-white rounded-2xl overflow-hidden relative border border-white/20 shadow-inner">
                <iframe src={`https://drive.google.com/file/d/${activeLibraryDoc.drive_file_id}/preview`} className="absolute inset-0 w-full h-full border-none"></iframe>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded-2xl border border-white/5 p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {libraryDocs.map(doc => (
                  <div key={doc.id} onClick={() => setActiveLibraryDoc(doc)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <FileText className="w-4 h-4"/>
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate text-white/90 group-hover:text-white">{doc.title}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Click để mở PDF</p>
                    </div>
                  </div>
                ))}
                {libraryDocs.length === 0 && <p className="text-center text-white/40 col-span-full py-10 text-sm font-bold">Đang tải tài liệu...</p>}
              </div>
            )}
          </div>

        </div>

        {/* ========================================================= */}
        {/* DRAGGABLE DIVIDER */}
        {/* ========================================================= */}
        <div 
          onMouseDown={() => setIsDragging(true)}
          className="w-1.5 hover:w-2 bg-white/5 hover:bg-cyan-400/50 cursor-col-resize z-30 transition-all flex items-center justify-center relative group"
        >
          <div className="h-8 w-1 bg-white/30 rounded-full group-hover:bg-cyan-400"></div>
        </div>

        {/* ========================================================= */}
        {/* PANEL PHẢI: SEN AI WORKSPACE (CHAT) */}
        {/* ========================================================= */}
        <div style={{ width: `${100 - leftWidth}%` }} className="h-full bg-black/40 backdrop-blur-3xl border-l border-white/10 flex flex-col relative">
          
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-gradient-to-r from-indigo-500/10 to-transparent">
            <div className="w-10 h-10 rounded-[12px] bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-indigo-400"/>
            </div>
            <div>
              <h2 className="font-black text-white flex items-center gap-2">Gia sư SenAI <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400"/></h2>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Hỗ trợ giải bài & Điều khiển phòng</p>
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mr-3 mt-1 shadow-sm border border-indigo-400/20">
                    <Bot className="w-4 h-4"/>
                  </div>
                )}

                <div className={`max-w-[90%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mb-1">
                      {msg.files.map((file, i) => (
                        <div key={i} className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-white/20 shadow-md bg-black/50">
                          {file.isPdf ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white/50 p-2 text-center">
                              <FileText className="w-8 h-8 mb-1"/>
                              <span className="text-[10px] font-bold truncate w-full">{file.name}</span>
                            </div>
                          ) : (
                            <img src={file.url} alt="Upload" className="w-full h-full object-cover"/>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.text && (
                    <div className={`px-5 py-3.5 rounded-[1.2rem] text-[14px] font-medium leading-relaxed shadow-sm overflow-x-auto ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-br-sm' 
                        : 'bg-white/10 border border-white/10 text-white/90 rounded-bl-sm backdrop-blur-md'
                    }`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-extrabold text-white" {...props} />,
                          a: ({node, ...props}) => <a className="underline font-bold text-cyan-400 hover:text-cyan-300" target="_blank" {...props} />,
                          code: ({node, inline, ...props}: any) => 
                            inline 
                              ? <code className="bg-black/30 px-1.5 py-0.5 rounded text-pink-300 text-[12px] font-mono" {...props} />
                              : <div className="bg-black/50 p-3 rounded-lg my-2"><code className="text-white/80 font-mono text-[12px]" {...props} /></div>
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start items-end">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mr-3 shadow-sm border border-indigo-400/20">
                  <Sparkles className="w-4 h-4 animate-pulse text-yellow-400"/>
                </div>
                <div className="bg-white/10 border border-white/10 px-5 py-3.5 rounded-[1.2rem] rounded-bl-sm shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white/50"/>
                  <span className="text-[12px] text-white/50 font-bold">SenAI đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-black/20 border-t border-white/10 shrink-0">
            {selectedFiles.length > 0 && (
              <div className="flex items-center gap-2 mb-3 bg-black/40 p-2 rounded-xl border border-white/10 overflow-x-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/20 group bg-black">
                    {file.isPdf ? <div className="w-full h-full flex items-center justify-center text-white/50"><FileText className="w-5 h-5"/></div> : <img src={file.url} alt="Preview" className="w-full h-full object-cover"/>}
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4 text-rose-400"/></button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-[1.5rem] p-1.5 focus-within:border-indigo-400/50 transition-all">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" multiple className="hidden" />
              
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-full hover:bg-white/10 text-white/50 transition-colors shrink-0">
                <ImageIcon className="w-5 h-5"/>
              </button>

              <textarea
                ref={textareaRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSendMessage() } }}
                placeholder="Gửi PDF/Ảnh để giải toán, hoặc nhờ đặt giờ học..."
                className="flex-1 bg-transparent border-none outline-none resize-none py-3 px-1 max-h-[120px] custom-scrollbar text-sm font-medium text-white placeholder:text-white/30"
                rows={1}
              />

              <button type="submit" disabled={(!chatInput.trim() && selectedFiles.length === 0) || isChatLoading} className="p-3 bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/5 disabled:text-white/20 text-white rounded-full transition-transform active:scale-95 shadow-md shrink-0">
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}