// Google Text-To-Speech (TTS) Engine for SenRead
// Hỗ trợ giọng đọc Google Tiếng Việt (vi-VN) và Google US/UK English (en-US)
// Hỗ trợ chọn giọng chính xác, tự động phát hiện giọng Google và đồng bộ Canvas

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
  private onVoicesLoadedCallback: ((voices: SpeechVoiceOption[]) => void) | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Chrome/Edge/Safari tải danh sách voice bất đồng bộ
      const load = () => {
        const list = this.getAvailableVoices(this.lang)
        if (this.onVoicesLoadedCallback) {
          this.onVoicesLoadedCallback(list)
        }
      }

      window.speechSynthesis.onvoiceschanged = load
      setTimeout(load, 250)
    }
  }

  public setOnVoicesLoaded(cb: (voices: SpeechVoiceOption[]) => void) {
    this.onVoicesLoadedCallback = cb
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      cb(this.getAvailableVoices(this.lang))
    }
  }

  // Lọc và xếp hạng danh sách giọng đọc theo ngôn ngữ (Ưu tiên Google Voices lên hàng đầu)
  public getAvailableVoices(lang?: 'vi' | 'en'): SpeechVoiceOption[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    const all = window.speechSynthesis.getVoices()
    const target = lang || this.lang

    const isMatchLang = (v: SpeechSynthesisVoice, l: 'vi' | 'en') => {
      const vLang = v.lang.toLowerCase()
      const vName = v.name.toLowerCase()
      if (l === 'vi') {
        return (
          vLang.startsWith('vi') ||
          vLang.includes('vi-vn') ||
          vLang.includes('vi_vn') ||
          vName.includes('vietnam') ||
          vName.includes('tiếng việt')
        )
      }
      return (
        vLang.startsWith('en') ||
        vName.includes('english') ||
        vName.includes('united states') ||
        vName.includes('united kingdom')
      )
    }

    const filtered = all
      .filter((v) => isMatchLang(v, target))
      .map((v) => ({
        voice: v,
        name: v.name,
        lang: v.lang,
        isGoogle: v.name.toLowerCase().includes('google'),
      }))

    // Sắp xếp: Giọng Google lên đầu -> Sau đó đến Natural/Online -> Sau đó theo tên
    return filtered.sort((a, b) => {
      if (a.isGoogle && !b.isGoogle) return -1
      if (!a.isGoogle && b.isGoogle) return 1
      const aNat = a.name.toLowerCase().includes('natural') || a.name.toLowerCase().includes('neural')
      const bNat = b.name.toLowerCase().includes('natural') || b.name.toLowerCase().includes('neural')
      if (aNat && !bNat) return -1
      if (!aNat && bNat) return 1
      return a.name.localeCompare(b.name)
    })
  }

  // Tìm giọng tốt nhất cho ngôn ngữ
  public getBestVoiceFor(lang: 'vi' | 'en'): SpeechSynthesisVoice | null {
    const list = this.getAvailableVoices(lang)
    if (list.length > 0) return list[0].voice
    return null
  }

  public setLanguage(newLang: 'vi' | 'en') {
    this.lang = newLang
    // Tự động tìm giọng phù hợp nhất cho ngôn ngữ mới
    const best = this.getBestVoiceFor(newLang)
    if (best) {
      this.preferredVoice = best
    }
    // Nếu đang phát, đọc lại câu hiện tại bằng ngôn ngữ & giọng mới
    if (this.isPlaying && !this.isPaused) {
      this.playSentenceAt(this.currentIndex)
    }
  }

  public setPreferredVoiceByName(voiceName: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const all = window.speechSynthesis.getVoices()
    const found = all.find((v) => v.name === voiceName)
    if (found) {
      this.preferredVoice = found
      if (this.isPlaying && !this.isPaused) {
        this.playSentenceAt(this.currentIndex)
      }
    }
  }

  public setPreferredVoice(voice: SpeechSynthesisVoice | null) {
    this.preferredVoice = voice
    if (this.isPlaying && !this.isPaused) {
      this.playSentenceAt(this.currentIndex)
    }
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    if (this.preferredVoice) return this.preferredVoice
    return this.getBestVoiceFor(this.lang)
  }

  public setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.5, newRate))
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

    // Đảm bảo có voice đúng ngôn ngữ
    if (!this.preferredVoice || !this.preferredVoice.lang.toLowerCase().startsWith(this.lang)) {
      this.preferredVoice = this.getBestVoiceFor(lang)
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

    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(sentence)
    utter.rate = this.rate
    utter.pitch = this.pitch
    utter.lang = this.lang === 'vi' ? 'vi-VN' : 'en-US'

    // Gán giọng đọc phù hợp
    let voiceToUse = this.preferredVoice
    if (!voiceToUse || !voiceToUse.lang.toLowerCase().startsWith(this.lang)) {
      voiceToUse = this.getBestVoiceFor(this.lang)
    }

    if (voiceToUse) {
      utter.voice = voiceToUse
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
      console.warn('TTS error on sentence:', e)
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

  public getLanguage(): 'vi' | 'en' {
    return this.lang
  }
}
