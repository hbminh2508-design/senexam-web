// Google Text-To-Speech (TTS) Engine for SenRead
// Hỗ trợ đồng thời 2 chế độ:
// 1. Google Cloud Voice Trực Tuyến (Online Google TTS qua /api/read/tts) - Chuẩn Google 100% trên mọi thiết bị và hệ điều hành (không phụ thuộc vào voice cài sẵn trên Windows/Mac/Linux)
// 2. Browser Web Speech API (Giọng Google Tiếng Việt / Google US English cục bộ của trình duyệt nếu có)

export interface SpeechVoiceOption {
  id: string
  name: string
  lang: 'vi' | 'en'
  isGoogle: boolean
  isOnline: boolean
  voice?: SpeechSynthesisVoice
}

export function splitTextIntoSentences(rawText: string): string[] {
  if (!rawText) return []

  // Bỏ qua các thẻ minh họa [ILLUSTRATION: ...] khi đọc
  const cleaned = rawText.replace(/\[ILLUSTRATION:[^\]]*\]/gi, '')

  // Tách theo dấu chấm, chấm than, chấm hỏi hoặc xuống dòng
  const rawParts = cleaned.split(/(?<=[.?!…\n])\s+/)
  const results: string[] = []

  for (const part of rawParts) {
    const trimmed = part.trim()
    if (trimmed.length > 0) {
      if (trimmed.length > 180) {
        // Tách nhỏ hơn theo dấu phẩy, chấm phẩy, hai chấm hoặc gạch ngang để đọc ngắt nghỉ tự nhiên
        const subParts = trimmed.split(/(?<=[,;:—])\s+/)
        for (const sub of subParts) {
          const sTrim = sub.trim()
          if (sTrim.length > 0) {
            if (sTrim.length > 180) {
              // Cắt theo từ nếu câu không có dấu
              const words = sTrim.split(/\s+/)
              let chunk = ''
              for (const w of words) {
                if ((chunk + ' ' + w).length > 150) {
                  if (chunk.trim()) results.push(chunk.trim())
                  chunk = w
                } else {
                  chunk += (chunk ? ' ' : '') + w
                }
              }
              if (chunk.trim()) results.push(chunk.trim())
            } else {
              results.push(sTrim)
            }
          }
        }
      } else {
        results.push(trimmed)
      }
    }
  }

  return results
}

export class GoogleTtsEngine {
  private sentences: string[] = []
  private currentIndex: number = 0
  private lang: 'vi' | 'en' = 'vi'
  private rate: number = 1.0
  private pitch: number = 1.0
  private isPlaying: boolean = false
  private isPaused: boolean = false

  // Selected Voice: either online ID ('google-online-vi' / 'google-online-en') or browser voice name
  private selectedVoiceId: string = 'google-online-vi'
  private selectedBrowserVoice: SpeechSynthesisVoice | null = null

  // Audio element for online Google TTS streaming
  private currentAudio: HTMLAudioElement | null = null

  // Utterance for browser SpeechSynthesis
  private currentUtterance: SpeechSynthesisUtterance | null = null

  // Callbacks
  private onSentenceChange: ((index: number, sentence: string) => void) | null = null
  private onFinished: (() => void) | null = null
  private onVoicesLoadedCallback: ((voices: SpeechVoiceOption[]) => void) | null = null

  constructor() {
    this.initBrowserVoices()
  }

  private initBrowserVoices() {
    if (typeof window === 'undefined') return

    const notify = () => {
      if (this.onVoicesLoadedCallback) {
        this.onVoicesLoadedCallback(this.getAvailableVoices(this.lang))
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', notify)
      window.speechSynthesis.onvoiceschanged = notify

      // Thử gọi nhiều lần khi trình duyệt tải dữ liệu voice ngầm
      setTimeout(notify, 100)
      setTimeout(notify, 400)
      setTimeout(notify, 1200)
    }
  }

  public setOnVoicesLoaded(cb: (voices: SpeechVoiceOption[]) => void) {
    this.onVoicesLoadedCallback = cb
    cb(this.getAvailableVoices(this.lang))
  }

  // Danh sách các giọng khả dụng cho ngôn ngữ hiện tại
  public getAvailableVoices(targetLang?: 'vi' | 'en'): SpeechVoiceOption[] {
    const lang = targetLang || this.lang
    const results: SpeechVoiceOption[] = []

    // 1. Luôn có giọng Google Trực Tuyến chất lượng cao
    if (lang === 'vi') {
      results.push({
        id: 'google-online-vi',
        name: '🌟 Google Tiếng Việt (Trực Tuyến - Chuẩn Nhất)',
        lang: 'vi',
        isGoogle: true,
        isOnline: true,
      })
    } else {
      results.push({
        id: 'google-online-en',
        name: '🌟 Google English (Online - Natural)',
        lang: 'en',
        isGoogle: true,
        isOnline: true,
      })
    }

    // 2. Thêm các giọng có sẵn từ trình duyệt nếu hỗ trợ Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const all = window.speechSynthesis.getVoices()

      const isMatchLang = (v: SpeechSynthesisVoice, l: 'vi' | 'en') => {
        const vLang = v.lang.toLowerCase().replace(/_/g, '-')
        const vName = v.name.toLowerCase()
        if (l === 'vi') {
          return (
            vLang.startsWith('vi') ||
            vLang === 'vie' ||
            vName.includes('vietnam') ||
            vName.includes('việt nam') ||
            vName.includes('tiếng việt') ||
            vName.includes('vietnamese') ||
            vName.includes('hoaimy') ||
            vName.includes('namminh') ||
            vName.includes('an - vietnamese')
          )
        }
        return (
          vLang.startsWith('en') ||
          vName.includes('english') ||
          vName.includes('united states') ||
          vName.includes('united kingdom') ||
          vName.includes('us') ||
          vName.includes('uk')
        )
      }

      const browserMatches = all
        .filter((v) => isMatchLang(v, lang))
        .map((v) => {
          const isG = v.name.toLowerCase().includes('google')
          let displayName = v.name
          if (isG) displayName = `🌟 [Google] ${v.name}`
          else if (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('neural')) {
            displayName = `✨ [Natural] ${v.name}`
          }

          return {
            id: v.name,
            name: displayName,
            lang: lang,
            isGoogle: isG,
            isOnline: false,
            voice: v,
          }
        })
        .sort((a, b) => {
          if (a.isGoogle && !b.isGoogle) return -1
          if (!a.isGoogle && b.isGoogle) return 1
          return a.name.localeCompare(b.name)
        })

      results.push(...browserMatches)
    }

    return results
  }

  public getSelectedVoiceId(): string {
    return this.selectedVoiceId
  }

  // Đổi ngôn ngữ đọc (vi hoặc en)
  public setLanguage(newLang: 'vi' | 'en') {
    if (this.lang === newLang && this.selectedVoiceId.startsWith(`google-online-${newLang}`)) {
      return
    }

    this.lang = newLang

    // Tự động gán giọng mặc định Google Online cho ngôn ngữ đó
    if (newLang === 'vi') {
      this.selectedVoiceId = 'google-online-vi'
      this.selectedBrowserVoice = null
    } else {
      this.selectedVoiceId = 'google-online-en'
      this.selectedBrowserVoice = null
    }

    // Nếu đang phát, đọc lại câu hiện tại bằng ngôn ngữ và giọng mới
    if (this.isPlaying && !this.isPaused) {
      this.playSentenceAt(this.currentIndex)
    }
  }

  // Đổi giọng đọc cụ thể theo voiceId
  public setSelectedVoice(voiceId: string) {
    this.selectedVoiceId = voiceId

    if (voiceId === 'google-online-vi') {
      this.lang = 'vi'
      this.selectedBrowserVoice = null
    } else if (voiceId === 'google-online-en') {
      this.lang = 'en'
      this.selectedBrowserVoice = null
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const all = window.speechSynthesis.getVoices()
      const found = all.find((v) => v.name === voiceId)
      if (found) {
        this.selectedBrowserVoice = found
        if (found.lang.toLowerCase().startsWith('en')) {
          this.lang = 'en'
        } else if (found.lang.toLowerCase().startsWith('vi')) {
          this.lang = 'vi'
        }
      }
    }

    if (this.isPlaying && !this.isPaused) {
      this.playSentenceAt(this.currentIndex)
    }
  }

  public setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.5, newRate))
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.rate
    }
    if (this.isPlaying && !this.isPaused && this.selectedBrowserVoice) {
      this.playSentenceAt(this.currentIndex)
    }
  }

  public setPitch(newPitch: number) {
    this.pitch = Math.max(0.5, Math.min(2.0, newPitch))
  }

  public start(
    sentences: string[],
    startIndex: number = 0,
    lang: 'vi' | 'en' = 'vi',
    onSentenceChange?: (index: number, sentence: string) => void,
    onFinished?: () => void
  ) {
    this.stop()
    this.sentences = sentences
    this.currentIndex = Math.max(0, Math.min(startIndex, sentences.length - 1))
    this.onSentenceChange = onSentenceChange || null
    this.onFinished = onFinished || null
    this.isPlaying = true
    this.isPaused = false

    if (this.lang !== lang) {
      this.setLanguage(lang)
    }

    if (this.sentences.length > 0) {
      this.playSentenceAt(this.currentIndex)
    } else if (this.onFinished) {
      this.onFinished()
    }
  }

  private playSentenceAt(index: number) {
    if (index < 0 || index >= this.sentences.length) {
      this.stop()
      if (this.onFinished) this.onFinished()
      return
    }

    this.currentIndex = index
    const sentence = this.sentences[index]

    if (this.onSentenceChange) {
      this.onSentenceChange(index, sentence)
    }

    // Dọn dẹp phiên âm trước đó
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    // Kiểm tra chế độ phát: Google Online Stream hay Browser Voice
    const isOnline = this.selectedVoiceId.startsWith('google-online') || !this.selectedBrowserVoice

    if (isOnline) {
      this.playWithOnlineAudio(sentence)
    } else {
      this.playWithWebSpeech(sentence)
    }
  }

  // Chế độ 1: Phát âm bằng Google Cloud TTS Online
  private playWithOnlineAudio(sentence: string) {
    const audioUrl = `/api/read/tts?text=${encodeURIComponent(sentence)}&lang=${this.lang}`
    const audio = new Audio(audioUrl)
    audio.playbackRate = this.rate
    this.currentAudio = audio

    audio.onended = () => {
      if (this.isPlaying && !this.isPaused) {
        if (this.currentIndex + 1 < this.sentences.length) {
          this.playSentenceAt(this.currentIndex + 1)
        } else {
          this.isPlaying = false
          if (this.onFinished) this.onFinished()
        }
      }
    }

    audio.onerror = (e) => {
      console.warn('Google Online TTS stream warning, attempting fallback:', e)
      // Nếu mạng có vấn đề, fallback sang Web Speech API
      this.playWithWebSpeech(sentence)
    }

    audio.play().catch((err) => {
      console.warn('Audio play error:', err)
      // Nếu bị chặn autoplay hoặc mạng lỗi, thử qua Web Speech
      this.playWithWebSpeech(sentence)
    })
  }

  // Chế độ 2: Phát âm bằng Web Speech API
  private playWithWebSpeech(sentence: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()

    const utter = new SpeechSynthesisUtterance(sentence)
    utter.rate = this.rate
    utter.pitch = this.pitch
    utter.lang = this.lang === 'vi' ? 'vi-VN' : 'en-US'

    if (this.selectedBrowserVoice) {
      utter.voice = this.selectedBrowserVoice
      utter.lang = this.selectedBrowserVoice.lang || utter.lang
    }

    utter.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        if (this.currentIndex + 1 < this.sentences.length) {
          this.playSentenceAt(this.currentIndex + 1)
        } else {
          this.isPlaying = false
          if (this.onFinished) this.onFinished()
        }
      }
    }

    utter.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return
      console.warn('WebSpeech error:', e)
      if (this.isPlaying && !this.isPaused && this.currentIndex + 1 < this.sentences.length) {
        this.playSentenceAt(this.currentIndex + 1)
      }
    }

    this.currentUtterance = utter
    window.speechSynthesis.speak(utter)
  }

  public pause() {
    if (!this.isPlaying || this.isPaused) return
    this.isPaused = true

    if (this.currentAudio) {
      this.currentAudio.pause()
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause()
    }
  }

  public resume() {
    if (!this.isPlaying || !this.isPaused) return
    this.isPaused = false

    if (this.currentAudio) {
      this.currentAudio.play().catch(() => {})
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume()
    }
  }

  public stop() {
    this.isPlaying = false
    this.isPaused = false

    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  public nextSentence() {
    if (this.currentIndex + 1 < this.sentences.length) {
      this.playSentenceAt(this.currentIndex + 1)
    }
  }

  public prevSentence() {
    if (this.currentIndex > 0) {
      this.playSentenceAt(this.currentIndex - 1)
    }
  }

  public jumpToSentence(index: number) {
    if (index >= 0 && index < this.sentences.length) {
      this.playSentenceAt(index)
    }
  }

  public getCurrentIndex(): number {
    return this.currentIndex
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }

  public getIsPaused(): boolean {
    return this.isPaused
  }

  public getLanguage(): 'vi' | 'en' {
    return this.lang
  }
}
