'use client'

import React from 'react'

interface SenGraphLogoProps {
  className?: string
  size?: number
  showText?: boolean
  useImage?: boolean
}

export default function SenGraphLogo({
  className = '',
  size = 40,
  showText = false,
  useImage = true,
}: SenGraphLogoProps) {
  if (useImage) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105"
          style={{ width: size, height: size }}
        >
          <img
            src="/sengraph-logo.jpg"
            alt="SenGraph Logo"
            className="w-full h-full object-contain p-0.5"
          />
        </div>
        {showText && (
          <div className="flex flex-col">
            <span className="font-black text-slate-900 tracking-tight leading-tight text-base sm:text-lg font-sans">
              Sen<span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">Graph</span>
            </span>
            <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider">
              2D & 3D Mathematical Engine
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
        className="shrink-0 drop-shadow-sm transition-transform hover:scale-105 duration-300"
      >
        <rect width="100" height="100" rx="24" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />

        {/* Cánh hoa sen cách điệu phẳng */}
        <path
          d="M50 22C56 36 72 45 78 58C73 66 62 68 50 64C38 68 27 66 22 58C28 45 44 36 50 22Z"
          fill="#38bdf8"
          fillOpacity="0.8"
        />
        <path
          d="M50 32C53 42 62 50 67 60C60 66 54 65 50 62C46 65 40 66 33 60C38 50 47 42 50 32Z"
          fill="#0284c7"
        />

        {/* Hệ trục tọa độ vuông góc */}
        <line x1="16" y1="52" x2="84" y2="52" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="80,48 84,52 80,56" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />

        <line x1="50" y1="84" x2="50" y2="16" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="46,20 50,16 54,20" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />

        {/* Vạch chia tọa độ */}
        <line x1="33" y1="49" x2="33" y2="55" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
        <line x1="67" y1="49" x2="67" y2="55" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
        <line x1="47" y1="36" x2="53" y2="36" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
        <line x1="47" y1="68" x2="53" y2="68" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />

        {/* Đường cong đồ thị hình sóng sin vươn lên */}
        <path
          d="M20 62 Q 35 24 50 52 T 80 42"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="font-black text-slate-900 tracking-tight leading-tight text-base sm:text-lg">
            Sen<span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Graph</span>
          </span>
          <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider">
            2D & 3D Graphing
          </span>
        </div>
      )}
    </div>
  )
}
