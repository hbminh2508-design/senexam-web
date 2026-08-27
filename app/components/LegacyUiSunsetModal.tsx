'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Sparkles,
  ArrowRight,
  X,
  AlertTriangle,
  Heart,
  Clock,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Rocket,
  Loader2,
} from 'lucide-react'

// Mốc thời gian dừng hoạt động giao diện cũ: 31/08/2026 00:00:00 GMT+7 (1788118800000 ms)
const SUNSET_TIMESTAMP = new Date('2026-08-31T00:00:00+07:00').getTime()

export default function LegacyUiSunsetModal() {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)

  // Map các trang cũ sang trang mới tương ứng
  const getNewEquivalentPath = (path: string) => {
    if (path.startsWith('/exams')) return '/new-exams'
    if (path.startsWith('/history')) return '/new-history'
    if (path.startsWith('/library')) return '/new-library'
    if (path.startsWith('/forum') || path.startsWith('/mes')) return '/new-media'
    if (path.startsWith('/vip')) return '/new-vip'
    if (path.startsWith('/admin')) return '/new-admin'
    if (path.startsWith('/phongthinghiem')) return '/new-labs'
    if (path.startsWith('/tinhdiemthi')) return '/new-mark-calculate'
    if (path.startsWith('/focus')) return '/new-focus'
    if (path.startsWith('/senvideo')) return '/new-video'
    if (path.startsWith('/codes')) return '/new-codes'
    return '/new-dashboard'
  }

  useEffect(() => {
    setMounted(true)
    const now = Date.now()
    const expired = now >= SUNSET_TIMESTAMP
    setIsExpired(expired)

    const checkMigrationStatus = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (user) {
        setUserId(user.id)

        // Kiểm tra xem user đã xác nhận chuyển qua New Dashboard chưa
        const localPref = localStorage.getItem('sen_prefer_new_ui')
        if (localPref === 'true') {
          // Tự động chuyển hướng ngay sang New Dashboard
          const newPath = getNewEquivalentPath(pathname)
          router.replace(newPath)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('migrated_to_new_ui')
          .eq('id', user.id)
          .single()

        if (profile?.migrated_to_new_ui) {
          localStorage.setItem('sen_prefer_new_ui', 'true')
          const newPath = getNewEquivalentPath(pathname)
          router.replace(newPath)
          return
        }
      }

      // Nếu đã quá hạn 31/08/2026 -> BẮT BUỘC hiện toàn màn hình
      if (expired) {
        setIsOpen(true)
        return
      }

      // Nếu chưa quá hạn -> kiểm tra xem phiên này đã tắt modal chưa
      const dismissed = sessionStorage.getItem('sen_sunset_notice_dismissed')
      if (!dismissed) {
        setIsOpen(true)
      }
    }

    checkMigrationStatus()
  }, [pathname, router])

  // XÁC NHẬN CHUYỂN SANG NEW DASHBOARD
  const handleConfirmMigration = async () => {
    setIsMigrating(true)
    localStorage.setItem('sen_prefer_new_ui', 'true')

    if (userId) {
      try {
        // Cập nhật trạng thái trong bảng profiles
        await supabase
          .from('profiles')
          .update({
            migrated_to_new_ui: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        // Lưu log vào bảng ui_migration_opt_ins
        await supabase.from('ui_migration_opt_ins').insert({
          user_id: userId,
          migrated_at: new Date().toISOString(),
          source_path: pathname,
        })
      } catch (e) {
        console.error('Error saving migration status:', e)
      }
    }

    const targetUrl = getNewEquivalentPath(pathname)
    router.replace(targetUrl)
  }

  const handleDismiss = () => {
    if (isExpired) return // Sau 31/08/2026 không cho phép tắt
    sessionStorage.setItem('sen_sunset_notice_dismissed', 'true')
    setIsOpen(false)
  }

  if (!mounted || !isOpen) return null

  // GIAO DIỆN SAU 31/08/2026: KHÓA FULL SCREEN TOÀN BỘ MÀN HÌNH
  if (isExpired) {
    return (
      <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 bg-[#080C14] text-white animate-in fade-in">
        <div className="w-full max-w-xl text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shadow-2xl">
            <Lock className="h-10 w-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <span className="rounded-full bg-rose-500/10 text-rose-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-rose-500/20">
              Thông Báo Ngừng Hoạt Động
            </span>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">
              Giao Diện Cũ Đã Chính Thức Ngừng Hoạt Động
            </h1>
            <p className="text-xs text-rose-300 font-bold">
              (Thời hạn kết thúc: 31/08/2026)
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-xs text-slate-300 space-y-3 text-left leading-relaxed backdrop-blur-xl">
            <p className="font-semibold text-white">
              ❤️ Cảm ơn bạn đã tin tưởng và đồng hành cùng phiên bản SenExam trước đây!
            </p>
            <p>
              Toàn bộ dữ liệu bài làm, kết quả thi thử, điểm số và số dư SenCash của bạn đã được chuyển giao hoàn hảo sang hệ sinh thái <strong>SenExam 2.0 (New Dashboard)</strong> với tốc độ vượt trội, tích hợp model AI suy luận sâu <strong>Gemini 3.7</strong> và giao diện Liquid Glassmorphism hiện đại.
            </p>
          </div>

          <button
            type="button"
            onClick={handleConfirmMigration}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-4 text-sm font-black uppercase tracking-wider shadow-2xl transition hover:scale-105 active:scale-95"
          >
            {isMigrating ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 animate-spin" /> Đang chuyển sang New Dashboard...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Rocket className="h-5 w-5" /> Chuyển Sang SenExam 2.0 (New Dashboard) Ngay →
              </span>
            )}
          </button>
        </div>
      </div>
    )
  }

  // GIAO DIỆN TRƯỚC 31/08/2026: MODAL THÔNG BÁO CÓ NÚT XÁC NHẬN HOẶC ĐỂ SAU
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5 text-[#1A1A1A] dark:text-slate-100">
        
        {/* Close Button (Chỉ khả dụng trước 31/08/2026) */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 transition"
          title="Để sau"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase border border-amber-500/20">
              Thông Báo Chuyển Đổi Hệ Thống
            </span>
            <h2 className="mt-1 text-lg sm:text-xl font-black leading-tight">
              Giao Diện Cũ Sẽ Dừng Hoạt Động Vào Ngày 31/08/2026
            </h2>
          </div>
        </div>

        {/* Lời cảm ơn & Nội dung thông báo */}
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 text-xs space-y-2.5 leading-relaxed text-[#4B5563] dark:text-slate-300">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-rose-500 fill-current shrink-0" />
            Lời cảm ơn từ Ban Quản Trị SenExam gửi đến bạn:
          </p>
          <p>
            Đội ngũ SenExam xin gửi lời cảm ơn chân thành nhất đến bạn vì đã đồng hành cùng giao diện cũ trong suốt thời gian qua. Nhằm tối ưu trải nghiệm học tập và chuẩn bị tốt nhất cho các kỳ thi 2026, toàn bộ hệ thống sẽ chuyển sang giao diện <strong>New Dashboard 2.0</strong>.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Tốc độ tải siêu tốc 60FPS
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Đồng bộ dữ liệu bài thi 100%
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleConfirmMigration}
            disabled={isMigrating}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-3.5 text-xs font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
          >
            {isMigrating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang chuyển đổi giao diện...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Xác Nhận Chuyển Sang New Dashboard Ngay
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full text-center py-2 text-xs font-bold text-[#6B7280] dark:text-slate-400 hover:underline"
          >
            Để sau / Tiếp tục dùng giao diện cũ (Đến 31/08/2026)
          </button>
        </div>
      </div>
    </div>
  )
}
