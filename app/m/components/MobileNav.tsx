'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  Home,
  Zap,
  BookOpen,
  History,
  Crown,
  Wallet,
  Sparkles,
  Gift,
  Search,
  RotateCcw,
  User,
  Layers,
} from 'lucide-react'

export default function MobileNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentTab = searchParams?.get('tab')

  // Không hiển thị thanh điều hướng đáy khi đang trong phòng thi làm bài để tránh che khuất đề
  const isInsideExam = Boolean(pathname?.includes('/m/exams/'))
  if (isInsideExam) return null

  const isHome = pathname === '/m' || pathname === '/m/'
  const isSenGround = pathname === '/m/sen-ground'
  const isPay = pathname === '/m/pay'

  // Phân loại ngữ cảnh hoạt động (Contextual State)
  const isExams = isSenGround && (currentTab === 'exams' || !currentTab)
  const isLibrary = isSenGround && currentTab === 'library'
  const isHistory = isSenGround && currentTab === 'history'

  // =========================================================================
  // NGỮ CẢNH 1: ĐANG Ở CỬA HÀNG VIP & VÍ SEN (/m/pay) -> THANH BAR CHUYÊN BIỆT
  // =========================================================================
  if (isPay) {
    const payNavItems = [
      { label: 'Gói VIP', tab: 'vip', icon: Crown },
      { label: 'Ví Sen', tab: 'wallet', icon: Wallet },
      { label: 'SenAI', tab: 'quota', icon: Sparkles },
      { label: 'Mã Quà', tab: 'giftcode', icon: Gift },
      { label: 'Trang Chủ', href: '/m', icon: Home },
    ]

    return (
      <nav
        aria-label="Cửa Hàng Mobile Bottom Navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-2 py-1 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.4)] select-none"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
      >
        <div className="max-w-md mx-auto flex items-center justify-around">
          {payNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.tab ? (currentTab === item.tab || (!currentTab && item.tab === 'vip')) : false

            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <Icon className="h-5 w-5 stroke-[1.8]" />
                  </div>
                  <span className="text-[10px] mt-0.5 font-semibold">{item.label}</span>
                </Link>
              )
            }

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => router.replace(`/m/pay?tab=${item.tab}`)}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-amber-500 font-black'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                    isActive ? 'bg-amber-500/15 text-amber-500 shadow-xs' : ''
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    )
  }

  // =========================================================================
  // NGỮ CẢNH 2: THANH BOTTOM BAR TIÊU CHUẨN ĐỘNG (HOMEPAGE & SEN GROUND)
  // =========================================================================
  const standardNavItems = [
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
      label: 'Cửa hàng VIP',
      href: '/m/pay',
      icon: Crown,
      active: isPay,
    },
  ]

  return (
    <nav
      aria-label="Mobile Dynamic Bottom Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-2 py-1 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.4)] select-none"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {standardNavItems.map((item) => {
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
