'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Home, Zap, BookOpen, History, User, MessageCircle } from 'lucide-react'

export default function MobileNav() {
  const pathname = usePathname() || ''
  const params = useSearchParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const gesture = useRef<{ id: number; x: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
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
  const itemClass = 'relative z-10 flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-200'
  const activeIndex = standardNavItems.findIndex((item) => item.active)
  const openChat = () => window.dispatchEvent(new Event('open-sen-chat-from-nav'))
  const position = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return Math.min(5, Math.max(0, ((event.clientX - bounds.left - 4) / (bounds.width - 8)) * 6 - 0.5))
  }
  return createPortal(
    <nav data-sen-mobile-nav aria-label="Điều hướng di động" className="fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[456px] touch-pan-y select-none rounded-full border border-white/75 bg-white/65 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 dark:border-white/20 dark:bg-slate-900/70"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return
        suppressClick.current = false
        gesture.current = { id: event.pointerId, x: event.clientX, dragging: false }
      }}
      onPointerMove={(event) => {
        const current = gesture.current
        if (!current || current.id !== event.pointerId) return
        if (!current.dragging && Math.abs(event.clientX - current.x) >= 8) {
          current.dragging = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        if (current.dragging) setDragPosition(position(event))
      }}
      onPointerUp={(event) => {
        const current = gesture.current
        if (!current || current.id !== event.pointerId) return
        gesture.current = null
        setDragPosition(null)
        if (!current.dragging) return
        suppressClick.current = true
        const target = standardNavItems[Math.round(position(event))]
        if (target) router.push(target.href)
        else openChat()
      }}
      onPointerCancel={() => { gesture.current = null; setDragPosition(null) }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        if (event.detail) { event.preventDefault(); event.stopPropagation() }
      }}>
      {(activeIndex >= 0 || dragPosition !== null) && <span aria-hidden="true"
        className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/6)] rounded-full border border-white/70 bg-sky-100/80 shadow-[inset_0_1px_4px_#fff] dark:border-white/25 dark:bg-sky-500/30 dark:shadow-none ${dragPosition === null ? 'motion-safe:transition-transform motion-safe:duration-300' : ''}`}
        style={{ transform: `translateX(${(dragPosition ?? activeIndex) * 100}%) scale(${dragPosition === null ? 1 : 1.07})` }} />}
      {standardNavItems.map(({ label, href, icon: Icon, active }, index) => (
        <Link key={label} href={href} aria-current={active ? 'page' : undefined}
          className={itemClass + ((dragPosition === null ? active : Math.round(dragPosition) === index) ? ' !font-black !text-sky-900 dark:!text-sky-100' : '')}>
          <Icon size={17} aria-hidden="true" />{label}
        </Link>
      ))}
      <button type="button" className={itemClass + ' !text-sky-800 dark:!text-sky-200' + (dragPosition !== null && Math.round(dragPosition) === 5 ? ' !font-black' : '')}
        onClick={openChat}>
        <MessageCircle size={17} aria-hidden="true" />Sen Chat
      </button>
    </nav>, document.body,
  )
}
