/**
 * Sen Chat Voice & Speech-to-Text Engine (P5) - ESM Node/Browser
 */

import { validateChatFileSize } from './chatLimits.mjs'

export const SUPPORTED_LANGUAGES = {
  vi: { code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  fr: { code: 'fr', name: 'Tiếng Pháp', nativeName: 'Français', flag: '🇫🇷' },
  zh: { code: 'zh', name: 'Tiếng Trung', nativeName: '中文', flag: '🇨🇳' },
  ja: { code: 'ja', name: 'Nhật Bản', nativeName: '日本語', flag: '🇯🇵' },
  es: { code: 'es', name: 'Tây Ban Nha', nativeName: 'Español', flag: '🇪🇸' },
  de: { code: 'de', name: 'Tiếng Đức', nativeName: 'Deutsch', flag: '🇩🇪' },
  ko: { code: 'ko', name: 'Hàn Quốc', nativeName: '한국어', flag: '🇰🇷' },
}

export function getLanguageMeta(langCode) {
  if (!langCode) return SUPPORTED_LANGUAGES.vi
  const clean = String(langCode).trim().toLowerCase().slice(0, 2)
  return SUPPORTED_LANGUAGES[clean] || {
    code: clean,
    name: clean.toUpperCase(),
    nativeName: clean.toUpperCase(),
    flag: '🌐',
  }
}

export function detectLanguageFromText(text) {
  if (!text || !String(text).trim()) {
    return SUPPORTED_LANGUAGES.vi
  }

  const lower = String(text).toLowerCase()

  // 1. Tiếng Việt (ưu tiên 1)
  const viPattern = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
  const viCommonWords = ['và', 'là', 'của', 'tôi', 'bạn', 'em', 'anh', 'chị', 'học', 'gì', 'này', 'đó', 'không', 'có', 'cho', 'với', 'xin', 'chào', 'được']
  const words = lower.split(/\s+/)
  const hasViWords = words.some((w) => viCommonWords.includes(w))

  if (viPattern.test(lower) || hasViWords) {
    return SUPPORTED_LANGUAGES.vi
  }

  // 2. Tiếng Nhật (Hiragana / Katakana)
  if (/[\u3040-\u30ff]/.test(text)) {
    return SUPPORTED_LANGUAGES.ja
  }

  // 3. Tiếng Hàn (Hangul)
  if (/[\uac00-\ud7af]/.test(text)) {
    return SUPPORTED_LANGUAGES.ko
  }

  // 4. Tiếng Trung (Hán tự thuần túy)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return SUPPORTED_LANGUAGES.zh
  }

  // 5. Tiếng Pháp, Đức, Tây Ban Nha
  if (/[éèêëàâîïôûùüçœæ]/i.test(lower) && (lower.includes(' le ') || lower.includes(' la ') || lower.includes(' les '))) {
    return SUPPORTED_LANGUAGES.fr
  }
  if (/[äöüß]/i.test(lower) || lower.includes(' und ') || lower.includes(' der ') || lower.includes(' die ')) {
    return SUPPORTED_LANGUAGES.de
  }
  if (/[ñ¿¡áéíóú]/i.test(lower) || lower.includes(' el ') || lower.includes(' de ') || lower.includes(' y ')) {
    return SUPPORTED_LANGUAGES.es
  }

  // 6. Tiếng Anh (ưu tiên 2)
  return SUPPORTED_LANGUAGES.en
}

export function formatAudioDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const rounded = Math.floor(seconds)
  const mins = Math.floor(rounded / 60)
  const secs = rounded % 60
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const remMins = mins % 60
    const formattedMins = remMins < 10 ? `0${remMins}` : `${remMins}`
    return `${hrs}:${formattedMins}:${formattedSecs}`
  }
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`
  return `${formattedMins}:${formattedSecs}`
}

export function extractWaveformFromData(samples, numBars = 36) {
  if (!samples || samples.length === 0) {
    return Array.from({ length: numBars }, () => 0.15)
  }

  const barValues = []
  const blockSize = Math.floor(samples.length / numBars) || 1

  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize
    const end = Math.min(start + blockSize, samples.length)
    let sum = 0
    let count = 0

    for (let j = start; j < end; j++) {
      sum += Math.abs(samples[j])
      count++
    }

    const avg = count > 0 ? sum / count : 0.05
    barValues.push(avg)
  }

  const max = Math.max(...barValues, 0.001)
  return barValues.map((val) => {
    const normalized = Math.max(0.08, Math.min(1.0, val / max))
    return Math.round(normalized * 100) / 100
  })
}

export const WHISPER_CONFIG = {
  modelId: 'onnx-community/whisper-tiny',
  fallbackModelId: 'Xenova/whisper-tiny',
  cacheName: 'senchat-whisper-cache-v1',
  preferredDevice: 'webgpu',
  fallbackDevice: 'wasm',
}

/**
 * Giả lập hoặc gọi STT phía Server với quy tắc bắt buộc:
 * - consent === true (Nếu false -> từ chối 403)
 * - validateChatFileSize (Nếu vượt -> từ chối 413)
 * - Xử lý trong RAM, không lưu lại file sau khi xử lý
 */
export async function simulateServerSttExecution({
  audioBytes,
  fileSizeBytes,
  consent,
  planTier,
  languageHint,
}) {
  // 1. Kiểm tra sự đồng ý bắt buộc của người dùng
  if (consent !== true) {
    return {
      status: 403,
      error: 'Người dùng chưa đồng ý gửi âm thanh tới máy chủ để chuyển thành văn bản',
    }
  }

  // 2. Kiểm tra giới hạn dung lượng tin thoại theo gói
  const size = fileSizeBytes || (audioBytes ? audioBytes.length : 0)
  const validation = validateChatFileSize(size, planTier)
  if (!validation.allowed) {
    return {
      status: 413,
      error: validation.error,
      suggestedTier: validation.suggestedTier,
      limitBytes: validation.limitBytes,
    }
  }

  // 3. Xử lý âm thanh trong bộ nhớ (in-memory) và không lưu vào bất kỳ disk/storage nào
  // Nhận diện ngôn ngữ & phiên âm
  const detected = languageHint ? getLanguageMeta(languageHint) : SUPPORTED_LANGUAGES.vi

  return {
    status: 200,
    success: true,
    text: detected.code === 'vi' 
      ? 'Xin chào, đây là tin nhắn thoại Sen Chat bảo mật đầu cuối.' 
      : 'Hello, this is a secure Sen Chat end-to-end encrypted voice message.',
    language: detected.code,
    languageName: detected.name,
    flag: detected.flag,
    persistedToStorage: false, // Cam kết không lưu lại sau khi xử lý
  }
}
