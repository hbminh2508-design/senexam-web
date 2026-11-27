'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Home, Zap, BookOpen, History, User, MessageCircle } from 'lucide-react'

export default function MobileNav() {
  const pathname = usePathname() || ''
  const params = useSearchParams()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || ['/chat', '/m/chat'].includes(pathname) || /\/(?:m\/)?exams\//.test(pathname)) return null
  const isHome = ['/', '/m', '/m/'].includes(pathname)
  const isGround = ['/m/sen-ground', '/sen-ground'].includes(pathname)
  const tab = params.get('tab') || (params.has('library') ? 'library' : params.has('history') ? 'history' : 'exams')
  const isExams = isGround && tab === 'exams'
  const isLibrary = isGround && tab === 'library'
  const isHistory = isGround && tab === 'history'
  const isProfile = ['/m/profile', '/profile'].includes(pathname)
  const standardNavItems = [
    { label: 'Trang chủ', href: '/m', icon: Home, active: isHome },
    { label: 'Kho đề', href: '/m/sen-ground?tab=exams', icon: Zap, active: isExams },
    { label: 'Thư viện', href: '/m/sen-ground?tab=library', icon: BookOpen, active: isLibrary },
    { label: 'Lịch sử', href: '/m/sen-ground?tab=history', icon: History, active: isHistory },
    { label: 'Cá nhân', href: '/m/profile', icon: User, active: isProfile },
  ]
  const itemClass = 'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[10px] font-semibold leading-tight text-slate-600 dark:text-slate-300'
  return createPortal(
    <nav data-sen-mobile-nav aria-label="Điều hướng di động" className="fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[456px] rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      {standardNavItems.map(({ label, href, icon: Icon, active }) => (
        <Link key={label} href={href} aria-current={active ? 'page' : undefined}
          className={itemClass + (active ? ' bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' : '')}>
          <Icon size={17} aria-hidden="true" />{label}
        </Link>
      ))}
      <button type="button" className={itemClass + ' bg-sky-700 text-white dark:text-white'}
        onClick={() => window.dispatchEvent(new Event('open-sen-chat-from-nav'))}>
        <MessageCircle size={17} aria-hidden="true" />Sen Chat
      </button>
    </nav>, document.body,
  )
}
