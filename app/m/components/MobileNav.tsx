'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Home,
  FileText,
  BookOpen,
  History,
  User,
  Zap,
} from 'lucide-react'

export default function MobileNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams?.get('tab')

  // Không hiển thị thanh điều hướng đáy khi đang trong phòng thi làm bài
  const isInsideExam = Boolean(pathname?.includes('/m/exams/'))
  if (isInsideExam) return null

  const isHome = pathname === '/m' || pathname === '/m/'
  const isExams =
    (pathname === '/m/sen-ground' && (currentTab === 'exams' || !currentTab)) ||
    pathname?.startsWith('/m/exams')
  const isLibrary = pathname === '/m/sen-ground' && currentTab === 'library'
  const isHistory = pathname === '/m/sen-ground' && currentTab === 'history'
  const isProfile = pathname === '/m/profile' || pathname === '/m/pay'

  const navItems = [
    {
      label: 'Trang chủ',
      href: '/m',
      icon: Home,
      active: isHome,
    },
    {
      label: 'Kho đề',
      href: '/m/sen-ground?tab=exams',
      icon: Zap,
      active: isExams,
    },
    {
      label: 'Thư viện',
      href: '/m/sen-ground?tab=library',
      icon: BookOpen,
      active: isLibrary,
    },
    {
      label: 'Lịch sử',
      href: '/m/sen-ground?tab=history',
      icon: History,
      active: isHistory,
    },
    {
      label: 'Cá nhân',
      href: '/m/profile',
      icon: User,
      active: isProfile,
    },
  ]

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-2 py-1 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.4)] select-none"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-violet-600 dark:text-violet-400 font-black'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-600/15 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shadow-xs'
                    : ''
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
