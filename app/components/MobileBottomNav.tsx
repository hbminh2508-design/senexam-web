'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FileText,
  Compass,
  BookOpen,
  Sparkles,
  X,
  Search,
  ArrowRight,
  ShieldCheck,
  Box,
  Video,
  MessageSquare,
  Calendar,
  Gauge,
  TrendingUp,
  GraduationCap,
  FlaskConical,
  Gem,
  Brain,
  Crown,
  Gift,
  School,
  Settings,
  BadgeCheck,
  FileCheck,
} from 'lucide-react'

type FeatureItem = {
  key: string
  title: string
  desc: string
  href: string
  tone: string
  badge?: string
  icon: any
  category: 'study' | 'math_exam' | 'senai' | 'community'
}

const ALL_FEATURES: FeatureItem[] = [
  // 1. Học tập & Luyện thi
  {
    key: 'exams',
    title: 'Kho đề thi mới',
    desc: 'Ngân hàng đề thi bám sát ma trận 2026, làm bài trực tuyến.',
    href: '/new-exams',
    tone: 'from-amber-400 to-rose-500',
    badge: 'Mới',
    icon: FileText,
    category: 'study',
  },
  {
    key: 'history',
    title: 'Lịch sử bài thi',
    desc: 'Tra cứu bảng điểm, xem lại lời giải chi tiết và tải đề thi PDF.',
    href: '/new-history',
    tone: 'from-emerald-400 to-teal-600',
    badge: 'Hồ sơ',
    icon: BadgeCheck,
    category: 'study',
  },
  {
    key: 'submissions',
    title: 'Quản lý bài thi',
    desc: 'Tra cứu, đối chiếu đáp án chi tiết các bài thi đã nộp.',
    href: '/new-submissions',
    tone: 'from-indigo-500 to-pink-500',
    badge: 'Mới',
    icon: FileCheck,
    category: 'study',
  },
  {
    key: 'library',
    title: 'Thư viện thông minh',
    desc: 'Kho tài liệu chuyên sâu theo môn và mục tiêu thi cử.',
    href: '/new-library',
    tone: 'from-emerald-400 to-green-700',
    icon: BookOpen,
    category: 'study',
  },
  {
    key: 'senvideo',
    title: 'Sen Video',
    desc: 'Video bài giảng ngắn gọn, sinh động giúp nắm trọng tâm.',
    href: '/new-video',
    tone: 'from-pink-400 to-rose-600',
    badge: 'Mới',
    icon: Video,
    category: 'study',
  },
  {
    key: 'focus',
    title: 'Chế độ Focus',
    desc: 'Không gian học yên tĩnh, đếm giờ Pomodoro tăng hiệu suất.',
    href: '/new-focus',
    tone: 'from-amber-400 to-orange-600',
    icon: Gauge,
    category: 'study',
  },
  {
    key: 'student',
    title: 'Lớp Học Của Tôi',
    desc: 'Tham gia lớp học bằng mã mời, xem kỳ thi và bảng điểm lớp.',
    href: '/new-student',
    tone: 'from-cyan-400 to-blue-600',
    badge: 'Lớp học',
    icon: GraduationCap,
    category: 'study',
  },

  // 2. Toán học & Khảo thí
  {
    key: 'sengraph',
    title: 'SenGraph (2D & 3D)',
    desc: 'Vẽ đồ thị 2D và không gian 3D tương tác, Sen AI Toán học.',
    href: 'https://sengraph.senexam.me',
    tone: 'from-cyan-400 to-indigo-600',
    badge: '2D & 3D',
    icon: Box,
    category: 'math_exam',
  },
  {
    key: 'seb',
    title: 'Sen Exam Canvas',
    desc: 'Khảo thí bảo mật cao chống gian lận 100% chuẩn Canvas.',
    href: 'https://seb.thicu.tailieufepn.senexam.me',
    tone: 'from-sky-400 to-blue-700',
    badge: 'Canvas',
    icon: ShieldCheck,
    category: 'math_exam',
  },
  {
    key: 'phongthinghiem',
    title: 'Phòng thí nghiệm ảo',
    desc: 'Trực quan hoá định luật Lý - Hoá - Sinh qua mô phỏng tương tác.',
    href: '/new-labs',
    tone: 'from-purple-400 to-violet-700',
    icon: FlaskConical,
    category: 'math_exam',
  },
  {
    key: 'tinhdiem',
    title: 'Tính điểm thi',
    desc: 'Công cụ tính điểm tốt nghiệp THPT, TSA và HSA chính xác.',
    href: '/new-mark-calculate',
    tone: 'from-emerald-400 to-green-600',
    icon: TrendingUp,
    category: 'math_exam',
  },

  // 3. SenAI & Quota
  {
    key: 'senai_studio',
    title: 'SenAI Studio',
    desc: 'Xưởng AI cá nhân hoá tạo đề, chấm bài và giải thích.',
    href: '/new-senai-studio',
    tone: 'from-cyan-400 to-teal-500',
    badge: 'AI 2.0',
    icon: Sparkles,
    category: 'senai',
  },
  {
    key: 'senai_quota',
    title: 'Quản Lý Quota SenAI',
    desc: 'Theo dõi hạn mức câu hỏi ngày, gói SenAI và quyền lợi Sen Max.',
    href: '/new-senai',
    tone: 'from-pink-500 to-indigo-600',
    badge: 'Quota',
    icon: Brain,
    category: 'senai',
  },
  {
    key: 'exclusive_store',
    title: 'Cửa Hàng Độc Quyền',
    desc: 'Flash Sale giảm 30% nâng cấp SenAI Plus/Ultra cho VIP & SenCash.',
    href: '/new-exclusive-store',
    tone: 'from-pink-500 to-purple-600',
    badge: 'Hot Deal',
    icon: Gem,
    category: 'senai',
  },
  {
    key: 'vip',
    title: 'Nâng Cấp Sen VIP',
    desc: 'Mở khoá đặc quyền không giới hạn tải đề và hỏi AI.',
    href: '/new-vip',
    tone: 'from-amber-400 to-amber-700',
    badge: 'VIP',
    icon: Crown,
    category: 'senai',
  },

  // 4. Cộng đồng & Tiện ích
  {
    key: 'media',
    title: 'Sen Media 2.0',
    desc: 'Cộng đồng sĩ tử, diễn đàn hỏi đáp và phòng chat thảo luận.',
    href: '/new-media',
    tone: 'from-indigo-400 to-sky-500',
    badge: 'Media',
    icon: MessageSquare,
    category: 'community',
  },
  {
    key: 'schedule',
    title: 'Lịch Học & Lịch Thi',
    desc: 'Quản lý thời khóa biểu, lịch thi thử, nhắc nhở thông minh.',
    href: '/new-schedule',
    tone: 'from-cyan-400 to-blue-500',
    badge: 'Mới',
    icon: Calendar,
    category: 'community',
  },
  {
    key: 'beta',
    title: 'Kênh Thử Nghiệm Beta',
    desc: 'Trải nghiệm sớm các tính năng tương lai 2027 và lộ trình roadmap.',
    href: '/new-beta',
    tone: 'from-pink-500 to-indigo-600',
    badge: 'Beta',
    icon: Sparkles,
    category: 'community',
  },
  {
    key: 'codes',
    title: 'Đổi Mã Quà Tặng',
    desc: 'Nhập giftcode để nhận SenCash, ngày VIP hoặc gói SenAI.',
    href: '/new-codes',
    tone: 'from-emerald-400 to-teal-700',
    icon: Gift,
    category: 'community',
  },
  {
    key: 'teacher',
    title: 'Cổng Giáo Viên',
    desc: 'Quản lý lớp học, phân quyền đề thi và theo dõi học sinh.',
    href: '/new-teacher',
    tone: 'from-blue-400 to-indigo-700',
    icon: School,
    category: 'community',
  },
  {
    key: 'admin',
    title: 'Quản Trị Hệ Thống',
    desc: 'Bảng điều khiển quản trị viên và cấu hình toàn trang.',
    href: '/new-admin',
    tone: 'from-red-500 to-rose-700',
    badge: 'Admin',
    icon: Settings,
    category: 'community',
  },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const [showAllFeatures, setShowAllFeatures] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Không hiển thị trên trang thi bảo mật SEB
  if (pathname?.startsWith('/seb-exam')) {
    return null
  }

  const isHomeActive = pathname === '/' || pathname === '/new-dashboard' || pathname === '/dashboard'
  const isExamsActive = pathname?.startsWith('/new-exams')
  const isLibraryActive = pathname?.startsWith('/new-library')

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ALL_FEATURES
    return ALL_FEATURES.filter(
      (f) => f.title.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)
    )
  }, [searchQuery])

  useEffect(() => {
    const handler = () => setShowAllFeatures(true)
    window.addEventListener('open-all-features', handler)
    return () => window.removeEventListener('open-all-features', handler)
  }, [])

  const handleToggleSenChat = () => {
    window.dispatchEvent(new CustomEvent('toggle-sen-chat'))
  }

  return (
    <>
      {/* THANH BOTTOM NAV DẠNG FLOATING PILL BO TRÒN GÓC THẨM MỸ (CHỈ HIỂN THỊ TRÊN MOBILE) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed inset-x-3.5 z-40 max-w-md mx-auto rounded-full bg-white/92 dark:bg-slate-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 px-3 py-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.6)] select-none safe-area-bottom"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
      >
        <div className="flex items-center justify-between gap-1 w-full">
          {/* 1. Trang chủ */}
          <Link
            href="/new-dashboard"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-full transition ${
              isHomeActive
                ? 'text-pink-600 dark:text-pink-400 font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Home className="h-5 w-5 shrink-0 aspect-square" />
            <span className="text-[10px] mt-0.5 tracking-tight">Trang chủ</span>
          </Link>

          {/* 2. Đề thi */}
          <Link
            href="/new-exams"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-full transition ${
              isExamsActive
                ? 'text-pink-600 dark:text-pink-400 font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="h-5 w-5 shrink-0 aspect-square" />
            <span className="text-[10px] mt-0.5 tracking-tight">Kho đề</span>
          </Link>

          {/* 3. Nút trung tâm: Xem tất cả tính năng của web */}
          <button
            type="button"
            onClick={() => setShowAllFeatures(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 rounded-full text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 shrink-0 aspect-square">
              <Compass className="h-4 w-4 shrink-0 aspect-square" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight">Tính năng</span>
          </button>

          {/* 4. Thư viện */}
          <Link
            href="/new-library"
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-full transition ${
              isLibraryActive
                ? 'text-pink-600 dark:text-pink-400 font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-5 w-5 shrink-0 aspect-square" />
            <span className="text-[10px] mt-0.5 tracking-tight">Thư viện</span>
          </Link>

          {/* 5. Nút SenAI ở cuối bên phải: Thiết kế dạng HÌNH TRÒN ĐỘC ĐÁO */}
          <button
            type="button"
            onClick={handleToggleSenChat}
            aria-label="Mở SenAI Chat"
            title="Mở SenAI Chat"
            className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white shadow-md shadow-pink-500/35 hover:scale-105 active:scale-90 transition border border-white/25 ml-0.5"
          >
            <Sparkles className="h-5 w-5 text-amber-300 animate-pulse shrink-0 aspect-square" />
          </button>
        </div>
      </nav>

      {/* DRAWER / BOTTOM SHEET: XEM TẤT CẢ TÍNH NĂNG CỦA WEB TRÊN MOBILE */}
      {showAllFeatures && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-h-[85vh] rounded-t-[32px] border-t border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            {/* Thanh kéo nhỏ (Handle bar) */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
            </div>

            {/* Header Drawer */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="h-5 w-5 text-pink-500 shrink-0 aspect-square" />
                  Tất Cả Tính Năng SenExam
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {ALL_FEATURES.length} công cụ & phòng học trực tuyến
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAllFeatures(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-black/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Thanh tìm kiếm nhanh - không autoFocus để tránh nhảy khung hình / zoom trên mobile */}
            <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-800/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm đề thi, đồ thị, phòng lab, AI..."
                  className="w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-900 dark:text-white pl-9 pr-8 py-2.5 text-[16px] sm:text-xs font-semibold outline-none focus:border-pink-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Danh sách tính năng theo từng phân hệ cuộn mượt mà */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-28">
              {[
                { key: 'study', title: 'Học tập & Luyện thi', icon: '📚', color: 'text-emerald-500' },
                { key: 'math_exam', title: 'Toán học & Khảo thí', icon: '📐', color: 'text-sky-500' },
                { key: 'senai', title: 'SenAI & Quota', icon: '🤖', color: 'text-purple-500' },
                { key: 'community', title: 'Cộng đồng & Tiện ích', icon: '🌐', color: 'text-rose-500' },
              ].map((category) => {
                const items = filteredFeatures.filter((f) => f.category === category.key)
                if (items.length === 0) return null

                return (
                  <div key={category.key} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-base">{category.icon}</span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {category.title}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 ml-auto">
                        {items.length}
                      </span>
                    </div>

                    <div className="grid gap-2">
                      {items.map((item) => {
                        const Icon = item.icon
                        const isExternal = item.href.startsWith('http')
                        const Wrapper = isExternal ? 'a' : Link
                        const extraProps = isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}

                        return (
                          <Wrapper
                            key={item.key}
                            href={item.href}
                            onClick={() => setShowAllFeatures(false)}
                            className="group flex items-center justify-between p-3 rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-slate-800/90 active:bg-black/5 dark:active:bg-white/10 transition shadow-xs overflow-hidden"
                            {...extraProps}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                              <div className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                <Icon className="h-5 w-5 shrink-0 aspect-square" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {item.title}
                                  </h5>
                                  {item.badge && (
                                    <span className="rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-black uppercase shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition" />
                          </Wrapper>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {filteredFeatures.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-400 font-bold">
                  Không tìm thấy tính năng nào phù hợp với từ khóa "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
