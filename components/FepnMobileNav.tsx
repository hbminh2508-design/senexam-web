'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  Calendar,
  Calculator,
  BookOpen,
  Gift,
  ShieldCheck,
  LogOut,
  LayoutGrid,
  X,
} from 'lucide-react'

export interface FepnDrawerAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

export interface FepnMobileNavProps {
  activePage?: 'dashboard' | 'schedule' | 'gpa' | 'recap' | 'gift' | 'admin' | 'subject'
  leftButton?: {
    label?: string
    href?: string
    icon?: React.ReactNode
    onClick?: () => void
  }
  centerButton: {
    label: string
    icon: React.ReactNode
    onClick?: () => void
    href?: string
    title?: string
  }
  customDrawerActions?: FepnDrawerAction[]
  extraDrawerItems?: React.ReactNode
  user?: any
  userEmail?: string
  isAdmin?: boolean
  onLogout?: () => void
}

export default function FepnMobileNav({
  activePage,
  leftButton,
  centerButton,
  customDrawerActions,
  extraDrawerItems,
  user,
  userEmail,
  isAdmin = false,
  onLogout,
}: FepnMobileNavProps) {
  const [showDrawer, setShowDrawer] = useState(false)

  const defaultLeft = {
    label: 'Dashboard',
    href: '/fepn-dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  }

  const left = leftButton || defaultLeft
  const displayEmail = userEmail || user?.email

  return (
    <>
      {/* 1. FIXED BOTTOM NAVIGATION BAR (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-6 py-2 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-between max-w-md mx-auto relative">
          {/* NÚT TRÁI (Mặc định: Quay về Dashboard) */}
          {left.href ? (
            <Link
              href={left.href}
              className={`flex flex-col items-center justify-center gap-1 transition flex-1 py-1 ${
                activePage === 'dashboard'
                  ? 'text-sky-600 dark:text-sky-400 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 font-bold'
              }`}
            >
              {left.icon}
              <span className="text-[11px] leading-tight">{left.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={left.onClick}
              className="flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition flex-1 py-1 font-bold"
            >
              {left.icon}
              <span className="text-[11px] leading-tight">{left.label}</span>
            </button>
          )}

          {/* NÚT GIỮA (To nhất, nổi bật dạng Floating Action Button) */}
          <div className="relative flex-1 flex flex-col items-center justify-center">
            {centerButton.href ? (
              <Link
                href={centerButton.href}
                className="-top-5 absolute flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/40 hover:scale-105 active:scale-95 transition border-4 border-slate-50 dark:border-slate-950 shrink-0"
                title={centerButton.title || centerButton.label}
              >
                {centerButton.icon}
              </Link>
            ) : (
              <button
                type="button"
                onClick={centerButton.onClick}
                className="-top-5 absolute flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/40 hover:scale-105 active:scale-95 transition border-4 border-slate-50 dark:border-slate-950 shrink-0"
                title={centerButton.title || centerButton.label}
              >
                {centerButton.icon}
              </button>
            )}
            <span className="text-[11px] font-black text-sky-600 dark:text-sky-400 pt-8 truncate max-w-[100px] text-center">
              {centerButton.label}
            </span>
          </div>

          {/* NÚT PHẢI (Tất cả tính năng - LayoutGrid 4 chấm) */}
          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition flex-1 py-1 font-bold"
            title="Mở tất cả tính năng FEPN"
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[11px] leading-tight">Tính năng</span>
          </button>
        </div>
      </nav>

      {/* 2. DRAWER BOTTOM-SHEET MODAL (md:hidden) */}
      {showDrawer && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
          onClick={() => setShowDrawer(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl border-t border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-sky-500/20 bg-white p-0.5 shadow-sm">
                  <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-fepn-heading, inherit)' }}>
                    Tất cả tính năng
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Tài liệu FEPN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-slate-500 hover:bg-black/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Các nút hành động riêng của trang nếu có */}
            {((customDrawerActions && customDrawerActions.length > 0) || extraDrawerItems) && (
              <div className="space-y-2 pb-3 border-b border-black/10 dark:border-white/10">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Thao tác trang hiện tại
                </p>
                {customDrawerActions && customDrawerActions.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {customDrawerActions.map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setShowDrawer(false)
                          action.onClick()
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-sky-500/10 hover:border-sky-500/30 text-left transition"
                      >
                        {action.icon}
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {extraDrawerItems && (
                  <div className="grid grid-cols-2 gap-2">
                    {extraDrawerItems}
                  </div>
                )}
              </div>
            )}

            {/* Hệ sinh thái tính năng FEPN */}
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                Hệ sinh thái FEPN
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Môn học & Tài liệu */}
                <Link
                  href="/fepn-dashboard"
                  onClick={() => setShowDrawer(false)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                    activePage === 'dashboard'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-sky-500/10 hover:border-sky-500/30'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 mb-1.5 group-hover:scale-105 transition">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">Kho Học Liệu</span>
                  <span className="text-[10px] text-slate-400 font-medium">Slide, đề thi & bài tập</span>
                </Link>

                {/* 2. Lịch học & Thời khóa biểu */}
                <Link
                  href="/fepn-schedule"
                  onClick={() => setShowDrawer(false)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                    activePage === 'schedule'
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-sky-500/10 hover:border-sky-500/30'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 mb-1.5 group-hover:scale-105 transition">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">Lịch Học</span>
                  <span className="text-[10px] text-slate-400 font-medium">Thời khóa biểu tuần</span>
                </Link>

                {/* 3. GPA & CPA Calculator */}
                <Link
                  href="/fepn-gpa"
                  onClick={() => setShowDrawer(false)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                    activePage === 'gpa'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-1.5 group-hover:scale-105 transition">
                    <Calculator className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">Tính Điểm GPA</span>
                  <span className="text-[10px] text-slate-400 font-medium">GPA & CPA tích lũy</span>
                </Link>

                {/* 4. Kỷ yếu Recap */}
                <Link
                  href="/fepn-recap"
                  onClick={() => setShowDrawer(false)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                    activePage === 'recap'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mb-1.5 group-hover:scale-105 transition">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">Kỷ Yếu Recap</span>
                  <span className="text-[10px] text-slate-400 font-medium">Hoạt động Khoa FEPN</span>
                </Link>

                {/* 5. Đổi quà FEPN */}
                <Link
                  href="/fepn-gift"
                  onClick={() => setShowDrawer(false)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                    activePage === 'gift'
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/15'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/20 text-pink-600 dark:text-pink-400 mb-1.5 group-hover:scale-105 transition">
                    <Gift className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-pink-700 dark:text-pink-300">Đổi Quà FEPN</span>
                  <span className="text-[10px] text-slate-400 font-medium">Vòng quay & quà tặng</span>
                </Link>

                {/* 6. Admin Portal (chỉ hiện khi là Admin) */}
                {isAdmin && (
                  <Link
                    href="/fepn-admin"
                    onClick={() => setShowDrawer(false)}
                    className={`flex flex-col items-start p-3 rounded-2xl border transition group ${
                      activePage === 'admin'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15'
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-1.5 group-hover:scale-105 transition">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300">Quản Trị Admin</span>
                    <span className="text-[10px] text-slate-400 font-medium">Deep Vault & CSDL</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Thông tin tài khoản & Nút đăng xuất */}
            {(displayEmail || onLogout) && (
              <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                {displayEmail ? (
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                      {displayEmail}
                    </p>
                    <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase">
                      {isAdmin ? 'Quản Trị Viên' : 'Sinh Viên VNU'}
                    </span>
                  </div>
                ) : <div />}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDrawer(false)
                      onLogout()
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold text-xs transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
