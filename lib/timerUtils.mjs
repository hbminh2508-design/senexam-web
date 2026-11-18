/**
 * Hàm định dạng thời gian dùng chung cho các phòng thi SenExam (.mjs)
 */
export function formatTime(seconds, format = 'mm:ss') {
  const safeSec = Math.max(0, Math.floor(seconds || 0))
  const hrs = Math.floor(safeSec / 3600)
  const mins = Math.floor((safeSec % 3600) / 60)
  const secs = safeSec % 60

  const padZero = (n) => (n < 10 ? `0${n}` : `${n}`)

  if (format === 'hsa_words') {
    if (hrs > 0) return `${hrs} giờ ${padZero(mins)} phút ${padZero(secs)} giây`
    return `${mins} phút ${padZero(secs)} giây`
  }

  if (format === 'hh:mm:ss' || hrs > 0) {
    return `${padZero(hrs)}:${padZero(mins)}:${padZero(secs)}`
  }

  return `${padZero(mins)}:${padZero(secs)}`
}
