import React from 'react'

interface SebLogoProps {
  className?: string
  size?: number
  showText?: boolean
  textColor?: string
}

export default function SebLogo({
  className = '',
  size = 40,
  showText = true,
  textColor = 'text-slate-900 dark:text-white',
}: SebLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Biểu tượng chữ S bảo mật cách điệu hình khiên */}
      <div
        className="relative flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 shadow-md shadow-sky-500/20"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[62%] h-[62%]"
        >
          {/* Viền khiên bảo mật SEB */}
          <path
            d="M50 10 L82 24 V52 C82 72 68 87 50 93 C32 87 18 72 18 52 V24 L50 10Z"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />
          {/* Chữ S công nghệ cao */}
          <path
            d="M66 33 C62 27 54 26 47 27 C38 28.5 32 35 34 43 C35.5 50 43 53 52 55 C64 57.5 70 63 68 71 C66 80 56 84 46 83 C36 82 29 76 27 70"
            stroke="white"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Điểm sáng bảo mật nhỏ */}
          <circle cx="70" cy="28" r="3.5" fill="#38bdf8" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1">
            <span className={`text-lg font-black tracking-tight font-heading ${textColor}`}>
              SEN EXAM CANVAS
            </span>
            <span className="rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider">
              CANVAS
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5">
            Sen Exam Canvas Platform
          </span>
        </div>
      )}
    </div>
  )
}
