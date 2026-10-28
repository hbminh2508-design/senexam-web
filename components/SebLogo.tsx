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
      {/* Biểu tượng logo bảo mật SEB (Hoa sen bảo vệ) */}
      <img
        src="/seb-logo.png"
        alt="SEB Canvas Logo"
        className="shrink-0 object-contain drop-shadow-md select-none"
        style={{ width: size, height: size }}
        loading="eager"
      />

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
