'use client'

import type React from 'react'

interface CrossfadeIconProps {
  show: boolean
  first: React.ReactNode
  second: React.ReactNode
  className?: string
}

/**
 * Crossfades + rotates between two icons (e.g. Sun/Moon on a theme toggle)
 * instead of swapping them instantly. `show` picks `first`; anything else
 * renders `second`. Respects prefers-reduced-motion.
 */
export default function CrossfadeIcon({ show, first, second, className = 'w-5 h-5' }: CrossfadeIconProps) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <span className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out motion-reduce:transition-none ${show ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}>
        {first}
      </span>
      <span className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out motion-reduce:transition-none ${show ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`}>
        {second}
      </span>
      {/* Giữ layout box theo kích thước icon vì cả hai lớp trên đều absolute */}
      <span className="invisible">{first}</span>
    </span>
  )
}
