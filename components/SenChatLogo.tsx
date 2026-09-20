'use client'

import React from 'react'

interface SenChatLogoProps {
  className?: string
  size?: number
  showText?: boolean
  useImage?: boolean
}

export default function SenChatLogo({
  className = '',
  size = 40,
  showText = false,
  useImage = true,
}: SenChatLogoProps) {
  if (useImage) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div
          className="relative overflow-hidden rounded-2xl shadow-lg border border-white/60 bg-slate-900 flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105"
          style={{ width: size, height: size }}
        >
          <img
            src="/sen-chat-logo.jpg"
            alt="Sen Chat Logo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-white/20 pointer-events-none" />
        </div>
        {showText && (
          <div className="flex flex-col">
            <span className="font-black text-slate-900 dark:text-white tracking-tight leading-tight text-base sm:text-lg font-sans">
              Sen <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">Chat</span>
            </span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
              Liquid Glass Edition
            </span>
          </div>
        )}
      </div>
    )
  }

  // Vector SVG Fallback
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md transition-transform hover:scale-105 duration-300"
      >
        <defs>
          <linearGradient id="senGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="glassGloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Nền bo góc tròn liquid */}
        <rect width="100" height="100" rx="28" fill="#070B14" />
        <rect width="100" height="100" rx="28" fill="url(#senGradient)" fillOpacity="0.2" />
        <rect width="98" height="98" x="1" y="1" rx="27" stroke="url(#glassGloss)" strokeWidth="2" fill="none" />

        {/* Cánh hoa sen cách điệu bong bóng chat */}
        <path
          d="M50 20C55 35 70 45 78 60C82 67 77 78 68 80C58 82 52 75 50 72C48 75 42 82 32 80C23 78 18 67 22 60C30 45 45 35 50 20Z"
          fill="url(#senGradient)"
          fillOpacity="0.85"
        />

        {/* Cánh sen trung tâm phát sáng */}
        <path
          d="M50 32C53 42 62 50 67 62C69 67 66 73 60 74C54 75 51 71 50 69C49 71 46 75 40 74C34 73 31 67 33 62C38 50 47 42 50 32Z"
          fill="#38bdf8"
          fillOpacity="0.9"
        />

        {/* Đuôi bong bóng chat */}
        <path
          d="M68 76C75 80 82 86 85 88C83 83 82 78 80 73"
          stroke="#38bdf8"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="font-black text-slate-900 tracking-tight leading-tight text-base sm:text-lg">
            Sen <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Chat</span>
          </span>
          <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider">
            FEPN Network
          </span>
        </div>
      )}
    </div>
  )
}
