'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Mic,
  Headphones,
  BookOpen,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { FepnMaterial } from '@/app/tsv-fepn/[slug]/page'

interface FepnAudioLectureViewerProps {
  material: FepnMaterial
  subjectName: string
  userRole?: string
  onUpdateMaterial?: (updated: FepnMaterial) => void
}

export default function FepnAudioLectureViewer({
  material,
  subjectName,
  userRole = 'student',
  onUpdateMaterial,
}: FepnAudioLectureViewerProps) {
  // Trạng thái phát âm thanh
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [audioError, setAudioError] = useState(false)

  // Trạng thái AI phân tích
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [analysisText, setAnalysisText] = useState<string>('')
  const [usedModel, setUsedModel] = useState<string>('gemini-3.8-flash')

  // Trích xuất link phát âm thanh tối ưu (xử lý Google Drive stream)
  const getPlayableAudioUrl = (url: string) => {
    if (!url) return ''
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        return `https://docs.google.com/uc?export=download&id=${match[1]}`
      }
    }
    return url
  }

  // Khởi tạo bản phân tích từ extra_info hoặc description của material
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setAudioError(false)

    let content = ''
    if (material.extra_info) {
      try {
        const parsed = JSON.parse(material.extra_info)
        if (parsed.analysis) {
          content = parsed.analysis
          if (parsed.model) setUsedModel(parsed.model)
        } else {
          content = material.extra_info
        }
      } catch {
        content = material.extra_info
      }
    } else if (material.description && material.description.length > 50) {
      content = material.description
    }

    setAnalysisText(content)
  }, [material])

  // Định dạng thời gian mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) {
      const remMins = mins % 60
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Điều khiển Audio
  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Không thể tự động phát:', err)
          setAudioError(true)
        })
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setAudioError(false)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value)
    setCurrentTime(targetTime)
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime
    }
  }

  const changeRate = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    audioRef.current.muted = nextMuted
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val
      audioRef.current.muted = val === 0
      setIsMuted(val === 0)
    }
  }

  // Sao chép toàn bộ lời giảng và kiến thức AI
  const handleCopyNotes = () => {
    if (!analysisText) return
    navigator.clipboard.writeText(analysisText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const isAdmin = userRole === 'admin' || userRole === 'collab'

  // Phân tích hoặc Phân tích lại bằng AI gemini-3.8-flash
  const handleAnalyzeWithGemini = async () => {
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/fepn-materials/analyze-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: material.id,
          audioUrl: material.file_url,
          subjectName,
          title: material.title,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi phân tích bài giảng')
      }

      const generatedAnalysis = data.analysis || ''
      setAnalysisText(generatedAnalysis)
      if (data.model) setUsedModel(data.model)

      // Cập nhật lưu trữ vào cơ sở dữ liệu Supabase (extra_info)
      const payloadInfo = JSON.stringify({
        analysis: generatedAnalysis,
        model: data.model || 'gemini-3.8-flash',
        analyzed_at: new Date().toISOString(),
      })

      try {
        await supabase
          .from('fepn_materials')
          .update({
            extra_info: payloadInfo,
          })
          .eq('id', material.id)
      } catch (dbErr) {
        console.warn('Lỗi cập nhật client supabase:', dbErr)
      }

      if (onUpdateMaterial) {
        onUpdateMaterial({
          ...material,
          extra_info: payloadInfo,
        })
      }
    } catch (err: any) {
      alert('Lỗi phân tích bài giảng bằng AI: ' + err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const playableUrl = getPlayableAudioUrl(material.file_url)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 space-y-6">
      {/* ======================================================== */}
      {/* 1. TRÌNH PHÁT BẢN GHI ÂM ĐẦY ĐỦ (AUDIO PLAYER BAR)       */}
      {/* ======================================================== */}
      <div className="rounded-3xl border border-sky-200 dark:border-sky-800/60 bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/30 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900 p-5 sm:p-6 shadow-xl space-y-5">
        
        {/* Header trình phát */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-black text-[10px] uppercase tracking-wider">
                  Bản Ghi Âm Lời Giảng
                </span>
                {isPlaying && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Đang phát</span>
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 leading-snug">
                {material.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={material.file_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 transition"
              title="Tải bản ghi âm gốc về máy"
            >
              <Download className="h-3.5 w-3.5 text-sky-600" />
              <span>Tải file ghi âm</span>
            </a>
            <a
              href={material.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-800 transition"
              title="Mở trong tab mới"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Thanh tua thời gian & thanh trượt */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-700 accent-sky-600 cursor-pointer transition"
          />
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Bảng nút điều khiển âm thanh */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Nút Play / Pause & Tua 10s */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
                }
              }}
              className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1"
              title="Lùi lại 10 giây"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[10px]">-10s</span>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="h-12 w-12 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 hover:scale-105 transition"
              title={isPlaying ? 'Tạm dừng' : 'Phát bản ghi âm'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10)
                }
              }}
              className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1"
              title="Tua tới 10 giây"
            >
              <RotateCcw className="h-3.5 w-3.5 scale-x-[-1]" />
              <span className="text-[10px]">+10s</span>
            </button>
          </div>

          {/* Chọn tốc độ phát */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-700/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2">Tốc độ:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => changeRate(rate)}
                className={`px-2 py-1 rounded-xl text-xs font-bold transition ${
                  playbackRate === rate
                    ? 'bg-sky-600 text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Âm lượng */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
              title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-rose-500" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 accent-sky-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Audio Element ẩn */}
        <audio
          ref={audioRef}
          src={playableUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            console.warn('Lỗi tải stream audio:', playableUrl)
            setAudioError(true)
          }}
        />

        {/* Cảnh báo nếu stream bị chặn */}
        {audioError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                File ghi âm lưu trên Drive cần quyền chia sẻ công khai hoặc tải về máy để nghe chất lượng cao nhất.
              </span>
            </div>
            <a
              href={material.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-xl bg-amber-200 dark:bg-amber-800 font-bold text-amber-900 dark:text-amber-100 text-[11px] whitespace-nowrap"
            >
              Mở link gốc
            </a>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. KHUNG PHÂN TÍCH & BÓC TÁCH LỜI GIẢNG (GEMINI 3.8 FLASH) */}
      {/* ======================================================== */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-xl overflow-hidden flex flex-col">
        
        {/* Header bảng kiến thức */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/90">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Tổng Hợp Lời Giảng & Kiến Thức Buổi Học
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px]">
                  AI: {usedModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tự động tìm và ghi lại trọn vẹn toàn bộ những gì thầy cô đã giảng giải trên lớp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {analysisText && (
              <button
                type="button"
                onClick={handleCopyNotes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                title="Sao chép toàn bộ nội dung"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Sao chép lời giảng</span>
                  </>
                )}
              </button>
            )}

            {/* Nút phân tích / phân tích lại: CHỈ ADMIN MỚI SỬ DỤNG ĐƯỢC */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleAnalyzeWithGemini}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                title={analysisText ? 'Phân tích lại bài giảng bằng AI' : 'Bắt đầu phân tích lời giảng bằng AI'}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang phân tích lời giảng...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>{analysisText ? 'Phân tích lại' : 'Phân tích lời giảng AI'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Nội dung lời giảng & kiến thức */}
        <div className="p-6 sm:p-8 flex-1">
          {isAnalyzing ? (
            <div className="py-16 text-center space-y-4">
              <div className="relative mx-auto h-12 w-12 text-sky-600">
                <Loader2 className="h-12 w-12 animate-spin" />
                <Mic className="h-5 w-5 absolute inset-0 m-auto text-sky-700 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                  AI `gemini-3.8-flash` đang lắng nghe và bóc tách lời giảng của thầy cô...
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hệ thống đang trích xuất các luận điểm, tổng hợp công thức LaTeX và các dặn dò thi cử quan trọng nhất của buổi học.
                </p>
              </div>
            </div>
          ) : analysisText ? (
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs prose-li:leading-relaxed prose-strong:text-slate-900 dark:prose-strong:text-white">
              <ReactMarkdown>{analysisText}</ReactMarkdown>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center border border-sky-100 dark:border-sky-800">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h5 className="text-sm font-black text-slate-800 dark:text-slate-200">
                  Chưa có bản phân tích lời giảng cho File ghi âm này
                </h5>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {isAdmin
                    ? 'Bạn có thể nhấn nút bên dưới để AI gemini-3.8-flash tự động bóc tách toàn bộ bài giảng của thầy cô ngay lập tức.'
                    : 'Vui lòng chờ Giảng viên hoặc Quản trị viên khởi chạy phân tích lời giảng cho buổi học này.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleAnalyzeWithGemini}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md hover:scale-102 transition cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Phân Tích Lời Giảng AI (Gemini 3.8 Flash)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
