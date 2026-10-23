'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  User,
  Crown,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Settings,
  ChevronRight,
  Monitor,
  Sparkles,
  School,
  GraduationCap,
  History,
  Lock,
} from 'lucide-react'

export default function MobileProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isDark, setIsDark] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
          if (p) setProfile(p)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadUser()

    // Dark mode check
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const handleToggleDark = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const handleSignOut = async () => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) return
    await supabase.auth.signOut()
    router.replace('/m/login')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 w-full p-4 space-y-4 animate-in fade-in">
      {/* 1. PROFILE HEADER CARD */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-xl shadow-md border border-white/20">
            {(user?.user_metadata?.full_name || user?.email || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black truncate">
                {user?.user_metadata?.full_name || 'Học Viên SenExam'}
              </h2>
              {profile?.is_vip && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                  VIP
                </span>
              )}
            </div>
            <p className="text-xs text-violet-200 truncate">{user?.email || 'Chưa đăng nhập'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/15 text-xs text-violet-100">
          <span>Lớp: {profile?.grade || '12'}</span>
          <span>Trường: {profile?.school || 'THPT'}</span>
        </div>
      </div>

      {/* 2. CÁC PHÍM TẮT TÀI KHOẢN */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 divide-y divide-black/5 dark:divide-white/5 shadow-xs">
        <Link
          href="/m/pay"
          className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Crown className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Gói Hội Viên VIP & Nạp Ví Sen
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>

        <Link
          href="/m/sen-ground?tab=history"
          className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <History className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Lịch Sử Làm Bài & Điểm Số
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>

        <button
          type="button"
          onClick={handleToggleDark}
          className="w-full flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Giao Diện: {isDark ? 'Chế độ Tối' : 'Chế độ Sáng'}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-bold">{isDark ? 'Bật' : 'Tắt'}</span>
        </button>

        <a
          href="https://senexam.me?desktop=true"
          className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Monitor className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Chuyển sang bản Web Desktop (senexam.me)
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </a>
      </div>

      {/* 3. NÚT ĐĂNG XUẤT */}
      {user ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất tài khoản
        </button>
      ) : (
        <Link
          href="/m/login"
          className="w-full py-3 rounded-2xl bg-violet-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
        >
          <Lock className="h-4 w-4" /> Đăng nhập tài khoản
        </Link>
      )}
    </div>
  )
}
