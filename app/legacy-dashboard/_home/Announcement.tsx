'use client'

import { useEffect, useState } from 'react'

export const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const target = new Date(targetDate).getTime()

  if (isNaN(target)) {
    return <span className="text-red-500 font-bold">[Lỗi định dạng ngày]</span>
  }

  const diff = target - now

  if (diff <= 0) {
    return (
      <span className="inline-block bg-slate-200 dark:bg-[#2A2A2A] text-slate-500 font-black px-4 py-1.5 rounded-full shadow-inner mx-1 text-sm">
        ⏳ Sự kiện đã diễn ra
      </span>
    )
  }

  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const m = Math.floor((diff / 1000 / 60) % 60)
  const s = Math.floor((diff / 1000) % 60)

  return (
    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-black px-4 py-1.5 rounded-full shadow-[0_4px_15px_rgba(239,68,68,0.4)] mx-1 text-sm animate-pulse whitespace-nowrap">
      ⏳ {d} Ngày {h} Giờ {m} Phút {s} Giây
    </span>
  )
}

export const AnnouncementRenderer = ({ text }: { text: string }) => {
  const renderLine = (line: string, idx: number) => {
    let isH1 = false, isH2 = false, isH3 = false, isCenter = false
    let content = line.trim()

    const centerMatch = content.match(/{Center:\s*(.*)}/i)
    if (centerMatch) {
      isCenter = true
      content = content.replace(/{Center:\s*(.*)}/i, '$1').trim()
    }

    if (content.startsWith('###(H1)')) {
      isH1 = true
      content = content.replace('###(H1)', '').trim()
    } else if (content.startsWith('##(H2)')) {
      isH2 = true
      content = content.replace('##(H2)', '').trim()
    } else if (content.startsWith('#(H3)')) {
      isH3 = true
      content = content.replace('#(H3)', '').trim()
    }

    const parseTags = (str: string) => {
      const regex = /{(time_|Quoc_Khanh|Bold|Underline):\s*([^}]+)}/gi
      const parts = []
      let lastIndex = 0
      let match

      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
          parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex, match.index)}</span>)
        }

        const tag = match[1].toLowerCase()
        const val = match[2]

        if (tag === 'time_') {
          parts.push(<CountdownTimer key={`time-${match.index}`} targetDate={val} />)
        } else if (tag === 'quoc_khanh') {
          parts.push(
            <span key={`qk-${match.index}`} className="text-yellow-300 font-black px-4 py-1.5 inline-flex items-center gap-2 mx-1 bg-red-600 rounded-full shadow-md uppercase tracking-wider">
              🇻🇳 🚜 314 {val} 🚩 🇻🇳
            </span>
          )
        } else if (tag === 'bold') {
          parts.push(
            <strong key={`b-${match.index}`} className="uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-wide">
              {val}
            </strong>
          )
        } else if (tag === 'underline') {
          parts.push(
            <u key={`u-${match.index}`} className="underline-offset-4 decoration-2 decoration-indigo-500">
              {val}
            </u>
          )
        }

        lastIndex = regex.lastIndex
      }

      if (lastIndex < str.length) {
        parts.push(<span key={`text-${lastIndex}`}>{str.substring(lastIndex)}</span>)
      }

      return parts
    }

    let baseClass = isH1 ? "text-3xl md:text-4xl font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight my-4 drop-shadow-md text-center w-full" :
                      isH2 ? "text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 my-3 text-center w-full" :
                      isH3 ? "text-xl font-bold text-slate-700 dark:text-slate-300 my-2" :
                      "text-base font-medium text-slate-700 dark:text-slate-300 my-1.5 leading-relaxed"

    if (isCenter) {
      baseClass += " flex justify-center items-center flex-wrap gap-2 text-center w-full"
    }

    return <div key={idx} className={baseClass}>{parseTags(content)}</div>
  }

  return <div className="w-full space-y-1">{text.split('\n').map((line, idx) => renderLine(line, idx))}</div>
}
