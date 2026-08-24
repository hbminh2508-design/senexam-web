'use client'

import { useEffect, useState, useRef } from 'react'
import {
  BookOpen, Clock, Trophy, User, ChevronRight, ShieldCheck, AlertCircle,
  LayoutGrid, Sun, Moon, KeyRound, Target, Bell, Sparkles, Lock, ArrowRight,
  FileText, Crown, Coins, Settings, ExternalLink,
  FlaskConical, Music2, FolderOpen, Calculator,
  Flame, ChevronDown
} from 'lucide-react'
import { AnnouncementRenderer } from './Announcement'
import { getGlassThemeVars } from '@/app/components/modernTheme'
import CrossfadeIcon from '@/app/components/CrossfadeIcon'
import VipAdBanner from '@/app/components/VipAdBanner'
import type { HomeProps } from './types'

export default function GlassHome({
  router, userRole, formData, isDark, toggleTheme, unreadCount,
  setShowNotifications, setShowProfile, showFeatureMenu, setShowFeatureMenu,
  FEATURES, activeAnnouncement, studentHistoryList, setShowCodeModal,
  overlayActive, themeColor, density, animationsEnabled, isBetaTester,
  isVip, isPremium, senCashBalance,
}: HomeProps) {
  const [serverTime, setServerTime] = useState<string>('')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // Đồng hồ giờ online thời gian thực của Server (UTC+7 / Giờ Việt Nam)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const timeStr = now.toLocaleTimeString('vi-VN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      setServerTime(timeStr)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Đóng dropdown tài khoản khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }
    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAccountDropdown])

  const bestScore = studentHistoryList.length > 0
    ? Math.max(...studentHistoryList.map(s => s.score || 0))
    : null

  const isCompact = density === 'compact'
  const isAdminOrCollab = userRole === 'admin' || userRole === 'collab'

  return (
    <div
      className="min-h-screen font-sans pb-20 relative selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:text-indigo-100"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={{
        ...getGlassThemeVars(themeColor, isDark),
        background: 'var(--bg)',
        color: 'var(--text)',
      } as React.CSSProperties}
    >
      {/* 🌟 Hiệu ứng hào quang nền (Aurora Lighting Mesh) cho giao diện kính */}
      <div className="glass-aurora-orb-1" />
      <div className="glass-aurora-orb-2" />
      <div className="glass-aurora-orb-3" />

      {/* ========================================================= */}
      {/* 🌟 TOP BAR BO TRÒN NỔI (FLOATING ROUNDED GLASS TOPBAR) */}
      {/* ========================================================= */}
      <div className="sticky top-3 z-40 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <header className="glass-floating-bar rounded-full h-16 px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shadow-xl transition-all duration-300">
          
          {/* BÊN TRÁI: Logo SenExam.ME + Giờ Online của Server */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-2.5 cursor-pointer group select-none"
              onClick={() => router.push('/dashboard')}
              title="SenExam.ME - Trang chủ"
            >
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-400 to-emerald-400 p-[1.5px] shadow-sm group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-[16px] tracking-tight bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 dark:from-indigo-400 dark:via-sky-300 dark:to-emerald-400 bg-clip-text text-transparent">
                    SenExam<span className="text-[13px] opacity-85 font-extrabold text-indigo-500 dark:text-sky-400">.ME</span>
                  </span>
                  {isPremium ? (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                      PRO
                    </span>
                  ) : isBetaTester ? (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 tracking-wider">
                      BETA
                    </span>
                  ) : null}
                </div>

                {/* Giờ Server Online thời gian thực */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-tight font-mono">
                    {serverTime || '--:--:--'} <span className="hidden md:inline text-[9px] opacity-75 font-sans">• VN Server</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ở GIỮA: Thanh tiếp cận nhanh các tính năng (Quick Access Pills) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
            <button
              onClick={() => router.push('/exams')}
              className="px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <Target className="w-3.5 h-3.5 text-indigo-500" /> Vào thi
            </button>
            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-500" /> Nhập Code
            </button>
            <button
              onClick={() => router.push('/senai-studio')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 transition-all flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> SenAI Studio
            </button>
            <button
              onClick={() => router.push(isBetaTester ? '/lib-new' : '/library')}
              className="px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-500" /> Thư viện
            </button>
            <button
              onClick={() => router.push('/focus')}
              className="px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <Music2 className="w-3.5 h-3.5 text-pink-500" /> Focus Chill
            </button>
            <button
              onClick={() => setShowFeatureMenu(v => !v)}
              className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition-all flex items-center gap-1"
              title="Tất cả tính năng"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Access Menu trên màn hình nhỏ */}
          <div className="flex-1 lg:hidden max-w-[200px] sm:max-w-xs relative">
            <button
              onClick={() => setShowFeatureMenu(v => !v)}
              className="w-full flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-black/[0.04] dark:border-white/[0.06]"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate flex-1 text-left">Tính năng</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* BÊN PHẢI: Thông báo, Sáng/Tối, Cài đặt, Tài khoản (Gom Admin & Nâng cao) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* VIP Quick Badge */}
            <button
              onClick={() => router.push('/vip')}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold transition-transform active:scale-95 shadow-sm"
              style={
                isVip
                  ? { background: 'linear-gradient(135deg, #F59E0B, #EA580C)', color: '#fff' }
                  : { background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.25)' }
              }
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{isVip ? 'VIP' : 'Nâng VIP'}</span>
            </button>

            {/* SenCash */}
            <button
              onClick={() => router.push('/vi-sen')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors border border-black/[0.04] dark:border-white/[0.06]"
              title="Ví SenCash"
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>{senCashBalance}</span>
            </button>

            {/* Chuông thông báo */}
            <button
              onClick={() => setShowNotifications(true)}
              className="p-2 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors relative"
              title="Thông báo"
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {/* Sáng / Tối */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors active:scale-90"
              title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <CrossfadeIcon
                show={isDark}
                className="w-4 h-4 text-amber-500"
                first={<Sun className="w-4 h-4 text-amber-500" />}
                second={<Moon className="w-4 h-4 text-indigo-400" />}
              />
            </button>

            {/* Nút Cài đặt Nhanh */}
            <button
              onClick={() => setShowProfile(true)}
              className="p-2 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-slate-600 dark:text-slate-300"
              title="Cài đặt hệ thống"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Nút Tài khoản Dropdown (Gom cài đặt nâng cao và Admin) */}
            <div className="relative ml-1" ref={accountMenuRef}>
              <button
                onClick={() => setShowAccountDropdown(v => !v)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-500 text-white font-black text-sm flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all relative ring-2 ring-white/50 dark:ring-white/10"
                title="Tài khoản cá nhân"
              >
                {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </button>

              {/* Account Dropdown Menu */}
              {showAccountDropdown && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-72 glass-refract-card rounded-3xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 border border-white/60 dark:border-white/15">
                  {/* User Header */}
                  <div className="p-3 bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent rounded-2xl mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                        {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                          {formData.fullName || 'Thí sinh SenExam'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                          {formData.school || formData.province || 'Học viên'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-amber-500" /> {senCashBalance} SenCash
                      </span>
                      {isVip ? (
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5" /> VIP Member
                        </span>
                      ) : (
                        <button
                          onClick={() => { setShowAccountDropdown(false); router.push('/vip') }}
                          className="font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Nâng cấp
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mục Admin (Nếu là admin hoặc collab) */}
                  {isAdminOrCollab && (
                    <div className="mb-2">
                      <button
                        onClick={() => { setShowAccountDropdown(false); router.push('/admin') }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="flex-1 text-left">Bảng Điều Khiển Quản Trị</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    </div>
                  )}

                  {/* Menu Options */}
                  <div className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <button
                      onClick={() => { setShowAccountDropdown(false); setShowProfile(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span className="flex-1">Cài đặt hệ thống & Giao diện</span>
                    </button>

                    <button
                      onClick={() => { setShowAccountDropdown(false); setShowProfile(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span className="flex-1">Đổi mật khẩu & Bảo mật</span>
                    </button>

                    <button
                      onClick={() => { setShowAccountDropdown(false); router.push('/vip') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span className="flex-1">Quyền lợi thành viên VIP</span>
                    </button>

                    <button
                      onClick={() => { setShowAccountDropdown(false); router.push('/vi-sen') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="flex-1">Ví SenCash & Lịch sử</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Popover Tất cả tính năng (Feature Menu Modal/Drawer) */}
      {showFeatureMenu && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowFeatureMenu(false)} />
          <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[100] animate-in zoom-in-95 duration-200">
            <div className="glass-refract-card rounded-[2.5rem] p-6 shadow-2xl border border-white/80 dark:border-white/15 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Tất Cả Tính Năng</h3>
                    <p className="text-xs text-slate-500 font-medium">Hệ sinh thái học tập và thi cử trực tuyến SenExam</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFeatureMenu(false)}
                  className="w-8 h-8 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] flex items-center justify-center transition-colors text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FEATURES.map(f => {
                  const Icon = f.icon
                  return (
                    <button
                      key={f.key}
                      onClick={() => { f.onSelect(); setShowFeatureMenu(false) }}
                      className="glass-specular-edge flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/60 dark:border-white/10 transition-all text-left group hover:scale-[1.02]"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-sky-500/10 to-purple-500/15 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1">
                          {f.label}
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                          {f.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 🌟 NỘI DUNG CHÍNH (MAIN DASHBOARD) */}
      {/* ========================================================= */}
      <main
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-opacity duration-200 relative z-10 ${
          isCompact ? 'py-5 space-y-6' : 'py-8 space-y-8'
        } ${overlayActive ? 'opacity-30 pointer-events-none select-none' : ''}`}
      >
        {/* Thông báo Announcement do Admin phát */}
        {activeAnnouncement && (
          <div className="glass-refract-card rounded-3xl p-5 flex items-start gap-4 border-amber-500/30 bg-amber-500/[0.06]">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <AnnouncementRenderer text={activeAnnouncement} />
            </div>
          </div>
        )}

        {/* HERO SECTION: Mục tiêu & Thống kê cá nhân hoá với hiệu ứng kính khúc xạ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cột chính: Luyện thi mục tiêu */}
          <div className="lg:col-span-2 glass-refract-card rounded-[2.5rem] p-7 sm:p-9 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            {/* Lớp phản quang khúc xạ góc trên */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-gradient-to-br from-indigo-500/30 to-sky-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-tr from-emerald-500/20 to-teal-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-400/15 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider mb-4">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                Mục Tiêu Năm Học 2026
              </div>

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
                Chinh phục{' '}
                <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 dark:from-indigo-400 dark:via-sky-300 dark:to-emerald-400 bg-clip-text text-transparent">
                  {formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'Kỳ Thi Sắp Tới'}
                </span>
              </h2>

              <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl font-medium">
                Không gian luyện đề thông minh với công nghệ AI hỗ trợ giải thích chi tiết, bám sát ma trận đề thi mới nhất và chấm điểm chuẩn quy chế.
              </p>

              {/* Thông tin môn mục tiêu */}
              {formData.targetSubjects && formData.targetSubjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {formData.targetSubjects.map(sub => (
                    <span key={sub} className="px-2.5 py-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-xs font-bold text-slate-700 dark:text-slate-300 border border-black/[0.04] dark:border-white/[0.06]">
                      ✓ {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3.5 mt-8 relative z-10">
              <button
                onClick={() => router.push('/exams')}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"
              >
                <Target className="w-4.5 h-4.5" /> Bắt đầu làm bài
              </button>

              <button
                onClick={() => setShowCodeModal(true)}
                className="px-5 py-3.5 rounded-2xl bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] text-slate-800 dark:text-white font-black text-sm flex items-center gap-2 border border-white/80 dark:border-white/10 shadow-sm active:scale-95 transition-all"
              >
                <KeyRound className="w-4.5 h-4.5 text-indigo-500" /> Nhập Code Đề Ẩn
              </button>

              <button
                onClick={() => router.push('/senai-studio')}
                className="px-5 py-3.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-black text-sm flex items-center gap-2 border border-indigo-500/25 active:scale-95 transition-all"
              >
                <Sparkles className="w-4.5 h-4.5 text-indigo-500" /> SenAI Studio
              </button>
            </div>
          </div>

          {/* Cột phụ: Thống kê Điểm cao nhất & Số đề đã làm */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
            {/* Card Điểm cao nhất */}
            <div className="glass-refract-card rounded-[2.2rem] p-6 relative overflow-hidden flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Kỷ lục
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm cao nhất đạt được</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  {bestScore !== null ? bestScore : '--'}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 10 điểm</span>
              </div>
            </div>

            {/* Card Số đề đã giải */}
            <div className="glass-refract-card rounded-[2.2rem] p-6 relative overflow-hidden flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  Tiến độ
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Số đề thi đã hoàn thành</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  {studentHistoryList.length}
                </span>
                <span className="text-xs font-bold text-slate-400">bài nộp</span>
              </div>
            </div>
          </div>
        </div>

        {/* LƯỚI TÍNH NĂNG NỔI BẬT VỚI HÌNH MINH HỌA SỐNG ĐỘNG (VIVID FEATURE ILLUSTRATIONS) */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Tính Năng Trọng Tâm
            </h3>
            <button
              onClick={() => setShowFeatureMenu(true)}
              className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Xem tất cả ({FEATURES.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Card 1: Vào thi ngay */}
            <div
              onClick={() => router.push('/exams')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Target className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  HOT
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                Kho Đề Thi Chuẩn Mới
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Đầy đủ cấu trúc THPTQG, ĐGNL HSA, TSA, SPT 2026 kèm đáp án và lời giải AI.
              </p>
            </div>

            {/* Card 2: SenAI Studio (Beta) */}
            <div
              onClick={() => router.push('/senai-studio')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden border-indigo-500/30 bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.05]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Sparkles className="w-7 h-7 animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                  BETA V2.0
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                SenAI Studio
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Gia sư AI thế hệ mới: hỗ trợ Deep Think giải toán, phân tích đề và lưu phiên chat thông minh.
              </p>
            </div>

            {/* Card 3: Thư Viện Số */}
            <div
              onClick={() => router.push(isBetaTester ? '/lib-new' : '/library')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  TÀI LIỆU
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                Thư Viện Số Lưu Trữ
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Kho chuyên đề, sách giáo khoa điện tử và tài liệu ôn thi chia sẻ miễn phí.
              </p>
            </div>

            {/* Card 4: Phòng Tập Trung Lo-Fi */}
            <div
              onClick={() => router.push('/focus')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Music2 className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-300">
                  POMODORO
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors flex items-center gap-1.5">
                Phòng Tập Trung Chill
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Đồng hồ bấm giờ Pomodoro kết hợp âm nhạc Lo-Fi không quảng cáo để tăng năng suất.
              </p>
            </div>

            {/* Card 5: Phòng Thí Nghiệm Ảo */}
            <div
              onClick={() => router.push('/phongthinghiem')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <FlaskConical className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  3D LAB
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex items-center gap-1.5">
                Phòng Thí Nghiệm Ảo
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Mô phỏng hiện tượng Vật lý & Hóa học trực quan với sự hướng dẫn của SenAI.
              </p>
            </div>

            {/* Card 6: Tính Điểm Đại Học */}
            <div
              onClick={() => router.push('/tinhdiem')}
              className="glass-refract-card glass-specular-edge rounded-[2rem] p-6 cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Calculator className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-300">
                  QUY CHUẨN
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors flex items-center gap-1.5">
                Tính Điểm Xét Tuyển ĐH
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Quy đổi tổ hợp môn thang 30 điểm và tính điểm cộng ưu tiên chuẩn theo Bộ GD&ĐT.
              </p>
            </div>

          </div>
        </div>

        {/* Banner VIP Quảng cáo */}
        <VipAdBanner />

        {/* BẢNG LỊCH SỬ BÀI THI GẦN ĐÂY */}
        <div className="glass-refract-card rounded-[2.5rem] p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Lịch Sử Bài Làm Gần Đây
            </h3>
            {studentHistoryList.length > 0 && (
              <span className="text-xs font-bold text-slate-500">
                Tổng cộng {studentHistoryList.length} lượt thi
              </span>
            )}
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-14 rounded-3xl border-2 border-dashed border-black/[0.08] dark:border-white/[0.08]">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-bold text-slate-500">Chưa ghi nhận hoạt động thi nào.</p>
                <p className="text-xs text-slate-400 mt-1">Hãy bắt đầu giải một đề thi để theo dõi kết quả tại đây.</p>
              </div>
            ) : (
              studentHistoryList.map(sub => (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/40 dark:bg-white/[0.02] hover:bg-white/80 dark:hover:bg-white/[0.06] border border-white/60 dark:border-white/10 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {sub.exams?.exam_type || 'ĐỀ THI'}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {sub.exams?.title || 'Đề thi không xác định'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span>{new Date(sub.created_at).toLocaleString('vi-VN')}</span>
                      <span>•</span>
                      <span>Thời gian nộp: {sub.time_spent ? `${Math.floor(sub.time_spent / 60)} phút` : 'Hoàn thành'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                        {sub.score !== undefined && sub.score !== null ? `${sub.score}` : '--'}
                        <span className="text-xs text-slate-400 font-bold"> / 10</span>
                      </div>
                    </div>

                    {sub.exams?.allow_review !== false && (
                      <button
                        onClick={() => router.push(`/exams/${sub.exam_id}/review?submissionId=${sub.id}`)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-extrabold transition-colors flex items-center gap-1"
                      >
                        Xem lại <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
