'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Rocket,
  CheckCircle2,
  Sparkles,
  Box,
  ShieldCheck,
  Crown,
  ChevronRight,
  Calendar,
  Layers,
} from 'lucide-react'
import {
  ROADMAP_ITEMS_2027,
  ROADMAP_DATES,
  isRoadmapDateReached,
  type RoadmapQuarter,
} from '@/lib/roadmapSchedule'

interface RoadmapTimelineProps {
  isBetaTester?: boolean
  initialQuarter?: RoadmapQuarter
}

interface MilestoneData {
  quarter: RoadmapQuarter
  dateText: string
  title: string
  subtitle: string
  icon: any
  tagColor: string
  linePercent: number // 0% -> 50% -> 100% on the straight line
  items: {
    name: string
    desc: string
    badge?: string
    href?: string
  }[]
}

const MILESTONES: MilestoneData[] = [
  {
    quarter: 'Q1_2027',
    dateText: '30/01/2027',
    title: 'Q1/2027 — SenGraph & Sen Chat',
    subtitle: 'Mở màn hệ sinh thái công nghệ học tập thế hệ mới',
    icon: Box,
    tagColor: 'from-pink-500 to-rose-500',
    linePercent: 0,
    items: [
      {
        name: 'SenGraph (2D & 3D)',
        desc: 'Vẽ đồ thị hàm số 2D và không gian 3D tương tác cao cấp, tích hợp Sen AI Toán học hỗ trợ giải bài và phân tích ảnh đề thi.',
        badge: 'Đồ thị',
        href: 'https://sengraph.senexam.me',
      },
      {
        name: 'Bong bóng chat Sen Chat',
        desc: 'Trợ lý trò chuyện nhanh góc màn hình, tự động lưu trữ và đồng bộ toàn bộ phiên hội thoại về SenAI Studio.',
        badge: 'Tự lưu Studio',
      },
      {
        name: 'Quản Lý Quota SenAI',
        desc: 'Bảng theo dõi hạn mức câu hỏi ngày, thống kê số lượt đã dùng và so sánh minh bạch các gói cước tại /new-senai.',
        badge: 'Quota',
        href: '/new-senai',
      },
    ],
  },
  {
    quarter: 'Q2_2027',
    dateText: '19/05/2027',
    title: 'Q2/2027 — Sen Exam Canvas & Dashboard',
    subtitle: 'Bảo mật khảo thí 100% và tái cơ cấu giao diện tinh gọn',
    icon: ShieldCheck,
    tagColor: 'from-purple-500 to-indigo-500',
    linePercent: 50,
    items: [
      {
        name: 'Sen Exam Canvas',
        desc: 'Môi trường khảo thí trực tuyến bảo mật cao chống gian lận 100%, tích hợp khóa màn hình và chống chuyển tab chuẩn quốc tế.',
        badge: 'Canvas',
        href: 'https://seb.thicu.tailieufepn.senexam.me',
      },
      {
        name: 'Dashboard chia theo nhóm công năng',
        desc: 'Tái tổ chức toàn bộ nút tính năng thành các phân hệ ngang gọn gàng, hạn chế icon lớn, dễ dàng tìm kiếm không bị rối mắt.',
        badge: 'Gọn gàng',
      },
      {
        name: 'Đặc quyền thành viên Beta',
        desc: 'Thành viên Kênh Beta được tiếp cận và trải nghiệm trực tiếp giao diện phân nhóm công năng ngay từ hôm nay trên Dashboard.',
        badge: 'Beta Mở Sớm',
      },
    ],
  },
  {
    quarter: 'Q4_2027',
    dateText: '05/12/2027',
    title: 'Q4/2027 — Gói Sen Max & SenGraph 2.0',
    subtitle: 'Đỉnh cao công nghệ AI và thế hệ đồ thị tương tác tiếp theo',
    icon: Crown,
    tagColor: 'from-amber-500 to-rose-500',
    linePercent: 100,
    items: [
      {
        name: 'Ra mắt gói Sen Max',
        desc: 'Bản cao cấp nhất trong hệ sinh thái SenAI: 500 câu hỏi/ngày, giá 318 SenCash/tháng (gấp đôi Ultra), tặng 15 lượt hỏi chuyên sâu trong SenAI Graph.',
        badge: '500 câu/ngày',
      },
      {
        name: 'Giới thiệu bản cập nhật SenGraph 2.0',
        desc: 'Thế hệ thứ hai của ứng dụng đồ thị với phân tích hình học động và giải tích chuyên sâu (tính năng chi tiết sẽ được công bố sau).',
        badge: 'SenGraph 2.0',
      },
      {
        name: 'Ưu tiên trải nghiệm đỉnh cao',
        desc: 'Người dùng Sen Max được ưu tiên băng thông phản hồi AI siêu tốc và truy cập sớm các công cụ thí nghiệm ảo mới nhất.',
        badge: 'Exclusive',
      },
    ],
  },
]

export default function RoadmapTimeline({ isBetaTester = false, initialQuarter = 'Q1_2027' }: RoadmapTimelineProps) {
  const [activeQuarter, setActiveQuarter] = useState<RoadmapQuarter>(initialQuarter)

  const activeMilestone = MILESTONES.find((m) => m.quarter === activeQuarter) || MILESTONES[0]

  return (
    <div className="space-y-6">
      {/* KHỐI TRỤC ĐƯỜNG THẲNG TIMELINE (STRAIGHT LINE TRACK) */}
      <div className="relative py-4 px-2 sm:px-6">
        {/* Đường thẳng cơ sở (Background straight line) */}
        <div className="absolute top-1/2 left-8 right-8 sm:left-14 sm:right-14 -translate-y-1/2 h-1.5 rounded-full bg-black/10 dark:bg-white/10" />

        {/* Đoạn đường thẳng tiến trình có màu phát sáng (Progress active line) */}
        <div
          className="absolute top-1/2 left-8 sm:left-14 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 transition-all duration-500 shadow-[0_0_12px_rgba(236,72,153,0.5)]"
          style={{
            width: `calc(${activeMilestone.linePercent}% * (100% - 4rem) / 100)`,
          }}
        />

        {/* 3 Mốc Tròn Nằm Dọc Theo Đường Thẳng */}
        <div className="relative z-10 flex items-center justify-between">
          {MILESTONES.map((ms, idx) => {
            const Icon = ms.icon
            const isSelected = activeQuarter === ms.quarter
            const isReleased = isRoadmapDateReached(ms.quarter)

            return (
              <button
                key={ms.quarter}
                type="button"
                onClick={() => setActiveQuarter(ms.quarter)}
                onMouseEnter={() => setActiveQuarter(ms.quarter)}
                className="group flex flex-col items-center focus:outline-none transition-transform hover:scale-105"
              >
                {/* Nút tròn mốc trên đường thẳng */}
                <div
                  className={`relative flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-2xl border-2 transition-all duration-300 shadow-md ${
                    isSelected
                      ? `border-white bg-gradient-to-tr ${ms.tagColor} text-white scale-110 shadow-[0_0_20px_rgba(236,72,153,0.6)]`
                      : isReleased
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-black/15 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {isSelected && (
                    <span className="absolute -inset-1 rounded-2xl bg-pink-400/30 animate-ping pointer-events-none" />
                  )}
                </div>

                {/* Nhãn mốc phía dưới đường thẳng */}
                <div className="mt-2.5 text-center">
                  <span
                    className={`block text-[11px] sm:text-xs font-black uppercase tracking-wider transition ${
                      isSelected
                        ? 'text-pink-600 dark:text-pink-400 font-extrabold scale-105'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {ms.quarter.replace('_', ' ')}
                  </span>
                  <span className="block text-[10px] text-slate-400 font-bold">
                    {ms.dateText}
                  </span>
                  <span
                    className={`mt-1 inline-block text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                      isReleased
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : isBetaTester
                        ? 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
                        : 'bg-black/5 dark:bg-white/10 text-slate-400'
                    }`}
                  >
                    {isReleased ? 'Đã phát hành' : isBetaTester ? 'Beta mở sẵn' : 'Tự động mở'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* CHI TIẾT ĐẦY ĐỦ CỦA MỐC ĐANG DI CHUYỂN TỚI ("di chuyển vào mới đầy đủ lộ trình") */}
      <div className="rounded-[28px] border-2 border-pink-500/20 bg-gradient-to-b from-white/90 to-black/[0.02] dark:from-slate-900/90 dark:to-white/[0.02] p-5 sm:p-7 shadow-lg backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Chi Tiết Mốc */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr ${activeMilestone.tagColor} text-white shadow-md font-black`}>
              <activeMilestone.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {activeMilestone.title}
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {activeMilestone.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-black px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
              📅 Ngày phát hành: {activeMilestone.dateText}
            </span>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
              {isRoadmapDateReached(activeMilestone.quarter)
                ? '✅ Đã kích hoạt chính thức'
                : isBetaTester
                ? '⚡ Đang mở trong Kênh Beta'
                : '🔒 Tự động kích hoạt đúng ngày'}
            </span>
          </div>
        </div>

        {/* Danh Sách Tính Năng Chi Tiết Trong Mốc */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeMilestone.items.map((it, i) => {
            const hasLink = !!it.href
            const Wrapper = hasLink ? (it.href?.startsWith('http') ? 'a' : Link) : 'div'
            const extra = hasLink && it.href?.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}

            return (
              <Wrapper
                key={i}
                href={it.href as any}
                className={`rounded-2xl border border-black/8 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 p-4 space-y-2 flex flex-col justify-between transition-all ${
                  hasLink ? 'hover:shadow-md hover:border-pink-500/30 hover:scale-[1.01] cursor-pointer' : ''
                }`}
                {...extra}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />
                      {it.name}
                    </span>
                    {it.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        {it.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed font-medium">
                    {it.desc}
                  </p>
                </div>

                {hasLink && (
                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-pink-600 dark:text-pink-400">
                    <span>Khám phá tính năng</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </Wrapper>
            )
          })}
        </div>
      </div>
    </div>
  )
}
