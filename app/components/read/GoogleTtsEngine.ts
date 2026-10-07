// Google Text-To-Speech (TTS) Engine for SenRead
// Hỗ trợ giọng đọc Google Tiếng Việt (vi-VN) và Google US/UK English (en-US)
// Hỗ trợ chia câu chính xác, nhảy câu, điều khiển tốc độ và đồng bộ Highlight Canvas

export interface SpeechVoiceOption {
  voice: SpeechSynthesisVoice
  name: string
  lang: string
  isGoogle: boolean
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
      // Nếu câu quá dài (> 250 ký tự), tách thêm theo dấu phẩy hoặc chấm phẩy để Web Speech không bị ngắt quãng
      if (trimmed.length > 250) {
        const subParts = trimmed.split(/(?<=[,;])\s+/)
        for (const sub of subParts) {
          const sTrim = sub.trim()
          if (sTrim.length > 0) results.push(sTrim)
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
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private onSentenceChange: ((index: number, sentence: string) => void) | null = null
  private onFinished: (() => void) | null = null
  private preferredVoice: SpeechSynthesisVoice | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Pre-load voices
      window.speechSynthesis.onvoiceschanged = () => {
        this.getAvailableVoices()
      }
    }
  }

  public getAvailableVoices(lang?: 'vi' | 'en'): SpeechVoiceOption[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    const all = window.speechSynthesis.getVoices()
    const targetLangPrefix = lang === 'en' ? 'en' : lang === 'vi' ? 'vi' : null

    const filtered = all
      .filter((v) => {
        if (!targetLangPrefix) return true
        return v.lang.toLowerCase().startsWith(targetLangPrefix)
      })
      .map((v) => ({
        voice: v,
        name: v.name,
        lang: v.lang,
        isGoogle: v.name.toLowerCase().includes('google'),
      }))

    // Ưu tiên giọng Google lên đầu danh sách
    return filtered.sort((a, b) => (b.isGoogle ? 1 : 0) - (a.isGoogle ? 1 : 0))
  }

  public setPreferredVoice(voice: SpeechSynthesisVoice | null) {
    this.preferredVoice = voice
  }

  public setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.5, newRate))
    // Nếu đang đọc, phát lại câu hiện tại với tốc độ mới
    if (this.isPlaying && !this.isPaused) {
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
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng chuyển văn bản thành giọng nói (Web Speech API).')
      return
    }

    this.stop()
    this.sentences = sentences
    this.currentIndex = Math.max(0, Math.min(startIndex, sentences.length - 1))
    this.lang = lang
    this.onSentenceChange = onSentenceChange || null
    this.onFinished = onFinished || null
    this.isPlaying = true
    this.isPaused = false

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

    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(sentence)
    utter.rate = this.rate
    utter.pitch = this.pitch
    utter.lang = this.lang === 'vi' ? 'vi-VN' : 'en-US'

    // Chọn voice tốt nhất (ưu tiên preferredVoice, sau đó là Google Voice, sau đó là fallback)
    if (this.preferredVoice && this.preferredVoice.lang.toLowerCase().startsWith(this.lang)) {
      utter.voice = this.preferredVoice
    } else {
      const candidates = this.getAvailableVoices(this.lang)
      if (candidates.length > 0) {
        utter.voice = candidates[0].voice
      }
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
      // Bỏ qua lỗi ngắt do cancel()
      if (e.error === 'interrupted' || e.error === 'canceled') return
      console.warn('TTS playback error:', e)
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
    window.speechSynthesis.pause()
  }

  public resume() {
    if (!this.isPlaying || !this.isPaused) return
    this.isPaused = false
    window.speechSynthesis.resume()
  }

  public stop() {
    this.isPlaying = false
    this.isPaused = false
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
}
