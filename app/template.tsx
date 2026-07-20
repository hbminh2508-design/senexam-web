'use client'

/**
 * Re-mounts on every top-level route change (see Next.js `template.js`
 * convention), so each page gets a brief, consistent enter animation instead
 * of popping in instantly. Kept subtle on purpose — a fade + tiny rise, same
 * timing already used across the app's own `animate-in` usages — and
 * `motion-reduce` turns it off for users who asked for less motion.
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
      {children}
    </div>
  )
}
