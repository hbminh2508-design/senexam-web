'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'
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
  Coins,
  BadgeCheck,
  Phone,
  MapPin,
  Target,
  Volume2,
  VolumeX,
  Zap,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wallet,
  KeyRound,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

export default function MobileProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')
  const [grade, setGrade] = useState('12')
  const [targetScore, setTargetScore] = useState('27')

  // Preferences & Toggles
  const [isDark, setIsDark] = useState(false)
  const [isEcoMode, setIsEcoMode] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Save states
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/m/login?returnUrl=/m/profile')
          return
        }
        setUser(user)
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

          if (p) {
            setProfile(p)
            setFullName(p.full_name || user.user_metadata?.full_name || '')
            setPhoneNumber(p.phone_number || '')
            setSchool(p.school || '')
            setProvince(p.province || '')
            setGrade(p.grade || '12')
            setTargetScore(p.target_score || '27')
          }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()

    // Kiểm tra theme & preferences
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    setIsDark(dark)
    setIsEcoMode(localStorage.getItem('eco_mode') === 'true')
    setSoundEnabled(localStorage.getItem('sound_enabled') !== 'false')
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

  const handleToggleEco = () => {
    const next = !isEcoMode
    setIsEcoMode(next)
    localStorage.setItem('eco_mode', String(next))
    document.documentElement.setAttribute('data-eco-mode', String(next))
  }

  const handleToggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('sound_enabled', String(next))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    setSaveMsg(null)

    try {
      const updates = {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        school: school.trim(),
        province: province.trim(),
        grade: grade,
        target_score: targetScore,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) throw error

      setSaveMsg({ type: 'success', text: 'Cập nhật hồ sơ thành công!' })
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Lỗi lưu thông tin!' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSignOut = async () => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) return
    await supabase.auth.signOut()
    router.replace('/new-idp?returnUrl=/m')
  }

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        title="Hồ Sơ & Thiết Lập Cá Nhân"
        subtitle={`Đang tải thông tin sĩ tử, trạng thái VIP & cấu hình hệ thống (v${MOBILE_VERSION})...`}
      />
    )
  }

  const senCash = profile?.sencash_balance || profile?.sen_cash || 0
  const isVip = Boolean(profile?.is_vip || profile?.role === 'admin')

  return (
    <div className="flex-1 w-full p-4 space-y-4 animate-in fade-in pb-16">
      {/* 🌟 BANNER ĐẶC BIỆT: KỶ NIỆM 1 NĂM SINH NHẬT SENEXAM (2025 - 2026) */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-purple-500/15 border border-amber-500/30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎂</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Kỷ Niệm 1 Năm SenExam
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px]">
                1st Year
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Cảm ơn bạn đã đồng hành cùng SenExam trong 365 ngày ôn luyện!
            </p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
      </div>

      {/* 1. PROFILE HEADER CARD */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-xl shadow-md border border-white/20 shrink-0">
            {(fullName || user?.email || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-black truncate">
                {fullName || user?.user_metadata?.full_name || 'Học Viên SenExam'}
              </h2>
              {isVip && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase flex items-center gap-0.5 shadow-xs">
                  <Crown className="h-2.5 w-2.5" /> VIP
                </span>
              )}
            </div>
            <p className="text-xs text-sky-200 truncate mt-0.5">{user?.email || 'Chưa đăng nhập'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/15 text-xs text-sky-100">
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-amber-300" />
            <span>Ví Cash Mobile: <strong>{(senCash * 5).toLocaleString('vi-VN')} SCm</strong></span>
          </div>
          <Link
            href="/m/pay?tab=wallet"
            className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-[10px] font-bold active:scale-95 transition"
          >
            Nạp Cash Mobile
          </Link>
        </div>
      </div>

      {/* 2. THÔNG TIN HỘI VIÊN & ĐẶC QUYỀN VIP */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                {isVip ? 'Hội Viên Sen VIP' : 'Tài Khoản Tiêu Chuẩn'}
              </h4>
              <span className="text-[10px] text-slate-400">
                {isVip ? 'Mở khóa toàn bộ đề thi & tài liệu VIP' : 'Nâng cấp để truy cập trọn bộ đề thi Canvas'}
              </span>
            </div>
          </div>
          <Link
            href="/m/pay"
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-xs active:scale-95 transition"
          >
            {isVip ? 'Gia hạn' : 'Nâng VIP'}
          </Link>
        </div>
      </div>

      {/* 3. FORM CẬP NHẬT THÔNG TIN HỒ SƠ NHƯ BẢN PC */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
            <User className="h-4 w-4 text-sky-600" /> Hồ Sơ Thí Sinh
          </h3>
          <span className="text-[10px] text-slate-400">Đồng bộ như PC</span>
        </div>

        {saveMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              saveMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
            }`}
          >
            {saveMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{saveMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">Họ và tên</label>
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs outline-none focus:border-sky-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Khối lớp</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 text-xs font-bold outline-none"
              >
                <option value="10">Lớp 10</option>
                <option value="11">Lớp 11</option>
                <option value="12">Lớp 12</option>
                <option value="graduated">Đã tốt nghiệp</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">Điểm mục tiêu</label>
              <input
                type="text"
                placeholder="VD: 27 điểm"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                className="w-full h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs outline-none font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">Trường THPT / Đại Học</label>
            <input
              type="text"
              placeholder="VD: THPT Chuyên Hà Nội - Amsterdam"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">Tỉnh / Thành phố</label>
            <input
              type="text"
              placeholder="VD: Hà Nội, TP. Hồ Chí Minh..."
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile || !user}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs shadow-md active:scale-98 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{savingProfile ? 'Đang lưu hồ sơ...' : 'LƯU CẬP NHẬT HỒ SƠ'}</span>
          </button>
        </form>
      </div>

      {/* 4. CÀI ĐẶT HỆ THỐNG & GIAO DIỆN CHUẨN PC */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 divide-y divide-black/5 dark:divide-white/5 shadow-xs overflow-hidden">
        {/* Dark Mode */}
        <button
          type="button"
          onClick={handleToggleDark}
          className="w-full flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Giao Diện {isDark ? 'Chế độ Tối (Dark)' : 'Chế độ Sáng (Light)'}
              </span>
              <span className="text-[10px] text-slate-400">Tự động thích ứng ban đêm</span>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-600">{isDark ? 'Bật' : 'Tắt'}</span>
        </button>

        {/* Eco Mode (Tiết kiệm pin cho mobile) */}
        <button
          type="button"
          onClick={handleToggleEco}
          className="w-full flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Chế Độ Tiết Kiệm Pin (Eco Mode)
              </span>
              <span className="text-[10px] text-slate-400">Giảm bớt hoạt ảnh nền để máy chạy êm và mát hơn</span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600">{isEcoMode ? 'Bật' : 'Tắt'}</span>
        </button>

        {/* Âm thanh phản hồi */}
        <button
          type="button"
          onClick={handleToggleSound}
          className="w-full flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Âm Thanh Nộp Bài & Thông Báo
              </span>
              <span className="text-[10px] text-slate-400">Phản hồi âm thanh khi hoàn thành thao tác</span>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-600">{soundEnabled ? 'Bật' : 'Tắt'}</span>
        </button>

        {/* Đổi mật khẩu qua Sen IDP */}
        <Link
          href="/new-change-password"
          className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Đổi Mật Khẩu (SenExam IDP)
              </span>
              <span className="text-[10px] text-slate-400">Cập nhật thông tin bảo mật tài khoản</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      </div>

      {/* 5. LIÊN KẾT NHANH TÍNH NĂNG TỪ BẢN PC TỐI ƯU MOBILE */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-2.5 shadow-xs">
        <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Tiện Ích Tài Khoản
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Link
            href="/m/sen-ground?tab=history"
            className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-bold transition"
          >
            <History className="h-4 w-4 text-emerald-500" />
            <span>Lịch sử bài thi</span>
          </Link>
          <Link
            href="/m/pay?tab=quota"
            className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-bold transition"
          >
            <Sparkles className="h-4 w-4 text-pink-500" />
            <span>Hạn mức SenAI</span>
          </Link>
          <Link
            href="/m/pay?tab=giftcode"
            className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-bold transition"
          >
            <BadgeCheck className="h-4 w-4 text-amber-500" />
            <span>Đổi GiftCode</span>
          </Link>
          <Link
            href="/m/pay?tab=wallet"
            className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-bold transition"
          >
            <Wallet className="h-4 w-4 text-sky-500" />
            <span>Cash Mobile</span>
          </Link>
        </div>
      </div>

      {/* 5. THÔNG TIN PHIÊN BẢN & MÃ PHIÊN BẢN MOBILE */}
      <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <span className="font-bold text-slate-700 dark:text-slate-300">Phiên bản Mobile chuẩn</span>
        </div>
        <span className="font-mono font-bold text-[11px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md">
          {MOBILE_VERSION}
        </span>
      </div>

      {/* 6. NÚT ĐĂNG XUẤT */}
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
          href="/m/login?returnUrl=/m"
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
        >
          <Lock className="h-4 w-4" /> Đăng nhập SenExam Mobile
        </Link>
      )}
    </div>
  )
}
