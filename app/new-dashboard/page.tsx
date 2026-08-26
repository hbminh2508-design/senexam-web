'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Baloo_2, Nunito } from 'next/font/google'
import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Compass,
  FlaskConical,
  Gauge,
  Loader2,
  Lock,
  MessageCircle,
  PlaySquare,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { getModernThemeVars } from '@/app/components/modernTheme'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newdash-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newdash-body' })

type QuickAction = {
  key: string
  title: string
  description: string
  href: string
  tone: string
  icon: ComponentType<{ className?: string }>
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'exam-room',
    title: 'Phong thi thu',
    description: 'Vao thi ngay voi bo de moi va score thong minh.',
    href: '/exams',
    tone: 'from-[#FFD166] via-[#F9A03F] to-[#EF476F]',
    icon: Rocket,
  },
  {
    key: 'senai',
    title: 'SenAI studio',
    description: 'Mo workshop AI de tao de, cham bai va phan tich.',
    href: '/senai-studio',
    tone: 'from-[#3DA9FC] via-[#00C2A8] to-[#5EEAD4]',
    icon: Sparkles,
  },
  {
    key: 'library',
    title: 'Thu vien thong minh',
    description: 'Tai lieu duoc sap xep theo mon va muc tieu thi.',
    href: '/library',
    tone: 'from-[#95D5B2] via-[#52B788] to-[#2D6A4F]',
    icon: BookOpen,
  },
  {
    key: 'messages',
    title: 'Sen Messages',
    description: 'Kenh trao doi nhanh, gon va chuyen sau.',
    href: '/mes',
    tone: 'from-[#A5B4FC] via-[#60A5FA] to-[#38BDF8]',
    icon: MessageCircle,
  },
  {
    key: 'focus',
    title: 'Focus mode',
    description: 'Kich hoat che do hoc khong nhieu xao nhang.',
    href: '/focus',
    tone: 'from-[#F9C74F] via-[#F9844A] to-[#F3722C]',
    icon: Gauge,
  },
  {
    key: 'quizzle',
    title: 'Quizzle zone',
    description: 'Tao mini-quiz, on tap nhanh theo ngay.',
    href: '/quizzle',
    tone: 'from-[#F4A261] via-[#E76F51] to-[#E63946]',
    icon: PlaySquare,
  },
]

const clampPercent = (value: number) => {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

export default function NewDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isBetaTester, setIsBetaTester] = useState(false)
  const [fullName, setFullName] = useState('Ban')
  const [themeColor, setThemeColor] = useState('terracotta')
  const [query, setQuery] = useState('')
  const [streakDays, setStreakDays] = useState(0)
  const [submissionCount, setSubmissionCount] = useState(0)
  const [activeAnnouncements, setActiveAnnouncements] = useState(0)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [bootTs] = useState<number>(() => Date.now())

  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let disposed = false

    const init = async () => {
      const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
      if (dark) document.documentElement.classList.add('dark')
      if (!disposed) setIsDark(dark)

      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/login')
        return
      }

      await ensureStudentProfile(user.id)

      const nowIso = new Date().toISOString()
      const [profileRes, submissionsRes, announcementsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_beta_tester, full_name, theme_color, vip_expires_at, target_exams')
          .eq('id', user.id)
          .single(),
        supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .or(`start_time.is.null,start_time.lte.${nowIso}`)
          .or(`end_time.is.null,end_time.gte.${nowIso}`),
      ])

      const profile = profileRes.data
      const beta = !!profile?.is_beta_tester

      if (!disposed) {
        setIsBetaTester(beta)
        setFullName(profile?.full_name?.trim() || 'Ban')
        setThemeColor(profile?.theme_color || 'terracotta')
        setVipUntil(profile?.vip_expires_at || null)
        setSubmissionCount(submissionsRes.count || 0)
        setActiveAnnouncements(announcementsRes.count || 0)
        const examsLen = Array.isArray(profile?.target_exams) ? profile.target_exams.length : 0
        setStreakDays(Math.max(2, Math.min(28, (submissionsRes.count || 0) + examsLen * 3)))
        setLoading(false)
      }

      QUICK_ACTIONS.forEach((item) => {
        router.prefetch(item.href)
      })
    }

    init()

    return () => {
      disposed = true
    }
  }, [router])

  const filteredActions = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) return QUICK_ACTIONS
    return QUICK_ACTIONS.filter((item) => {
      const hay = `${item.title} ${item.description}`.toLowerCase()
      return hay.includes(normalized)
    })
  }, [deferredQuery])

  const focusScore = useMemo(() => {
    const base = submissionCount * 12 + streakDays * 4
    return clampPercent(base)
  }, [submissionCount, streakDays])

  const vipLabel = useMemo(() => {
    if (!vipUntil) return 'Free plan'
    const expires = new Date(vipUntil)
    if (Number.isNaN(expires.getTime()) || expires.getTime() < bootTs) return 'Free plan'
    return `VIP den ${expires.toLocaleDateString('vi-VN')}`
  }, [bootTs, vipUntil])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Chao buoi sang'
    if (hour < 18) return 'Chao buoi chieu'
    return 'Chao buoi toi'
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] text-[#2B2B2B]">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-semibold">Dang khoi tao New Dashboard...</span>
        </div>
      </div>
    )
  }

  if (!isBetaTester) {
    return (
      <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_15%_20%,#FFE29A_0%,transparent_35%),radial-gradient(circle_at_85%_15%,#BEE3FF_0%,transparent_30%),#FFF9EF] p-5">
        <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white/85 p-7 shadow-[0_20px_50px_rgba(26,26,26,0.12)] backdrop-blur-xl">
          <div className="mb-5 inline-flex rounded-full bg-[#1F2937] p-3 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className={`${headingFont.className} text-3xl leading-tight text-[#1A1A1A]`}>New Dashboard dang trong chuong trinh Beta</h1>
          <p className="mt-3 text-sm text-[#4B5563]">
            Tai khoan cua ban chua tham gia Beta, nen chua the truy cap giao dien moi.
            Ban co the vao dashboard cu de dang ky kenh thu nghiem.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
            >
              Ve dashboard hien tai <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/tinhnangthunghiem" className="rounded-2xl border border-black/10 bg-white px-5 py-2.5 text-sm font-bold text-[#111827]">
              Xem tinh nang thu nghiem
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A]`}
      style={{
        ...getModernThemeVars(themeColor, isDark),
        background:
          'radial-gradient(circle at 12% 8%, rgba(255, 187, 120, 0.45), transparent 35%), radial-gradient(circle at 88% 12%, rgba(94, 234, 212, 0.34), transparent 28%), radial-gradient(circle at 80% 75%, rgba(129, 140, 248, 0.32), transparent 32%), var(--bg)',
      }}
    >
      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[30px] border border-black/10 bg-white/70 p-6 shadow-[0_20px_45px_rgba(16,24,40,0.14)] backdrop-blur-xl sm:p-7">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#FF8FA3]/50 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-[#7BDFF2]/50 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#DC2626]">beta cockpit</p>
              <h1 className="mt-1 text-balance text-4xl leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>
                {greeting}, {fullName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#374151] sm:text-base" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                Mot dashboard duoc tao moi hoan toan: mau sac vui, chuyen dong nhe, bo cuc trong treo de hoc nhanh ma khong roi mat.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-2xl border border-black/10 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">Nhip hoc</p>
                <p className="mt-1 text-xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{streakDays} ngay</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">Trang thai</p>
                <p className="mt-1 text-xl font-black" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{vipLabel}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-[#FFF5CF]/85 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7C2D12]">Bai da nop</p>
              <div className="mt-2 flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-[#B45309]" />
                <strong className="text-2xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{submissionCount}</strong>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-[#D7F9F1]/90 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#0F766E]">Thong bao</p>
              <div className="mt-2 flex items-center gap-2">
                <Star className="h-5 w-5 text-[#0D9488]" />
                <strong className="text-2xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{activeAnnouncements}</strong>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-[#E4ECFF]/90 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8]">Focus score</p>
              <div className="mt-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#2563EB]" />
                <strong className="text-2xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{focusScore}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2.2fr_1fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/75 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>Playground dieu huong</h2>
                <p className="text-sm text-[#4B5563]" style={{ fontFamily: 'var(--font-newdash-body)' }}>Tim nhanh tinh nang va vao hoc ngay.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Compass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tim: exam, thu vien, AI..."
                  className="h-10 w-full rounded-xl border border-black/10 bg-white/90 pl-9 pr-3 text-sm outline-none transition focus:border-black/30"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredActions.map((item, index) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="newdash-card group relative overflow-hidden rounded-2xl border border-black/10 bg-white/80 p-4"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-xl border border-black/10 bg-white/90 p-2">
                        <Icon className="h-5 w-5 text-[#111827]" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#6B7280] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <h3 className="mt-3 text-lg leading-tight" style={{ fontFamily: 'var(--font-newdash-heading)' }}>{item.title}</h3>
                    <p className="mt-1 text-sm text-[#4B5563]" style={{ fontFamily: 'var(--font-newdash-body)' }}>{item.description}</p>
                  </Link>
                )
              })}
              {filteredActions.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-black/20 bg-white/70 p-5 text-sm text-[#4B5563]">
                  Khong tim thay muc phu hop. Thu tu khoa ngan gon hon.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-xl">
              <h3 className="text-xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>He thong da toi uu</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#374151]" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                <li className="flex items-start gap-2"><RefreshCw className="mt-0.5 h-4 w-4 text-[#0EA5E9]" /> Prefetch san cac route de mo trang nhanh hon.</li>
                <li className="flex items-start gap-2"><Gauge className="mt-0.5 h-4 w-4 text-[#059669]" /> Loc tim kiem bang deferred value de UI khong giat.</li>
                <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-[#F97316]" /> Hieu ung nhe, uu tien doc noi dung truoc.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-5 text-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-200">
                <FlaskConical className="h-4 w-4" /> beta lane
              </p>
              <h3 className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-newdash-heading)' }}>Phong thi nghiem ca nhan</h3>
              <p className="mt-2 text-sm text-slate-300" style={{ fontFamily: 'var(--font-newdash-body)' }}>
                Kich hoat tinh nang moi va gui phan hoi de doi san pham theo cach ban hoc tot nhat.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/tinhnangthunghiem" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900">
                  <Rocket className="h-4 w-4" /> Thu nghiem ngay
                </Link>
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold">
                  <BookOpen className="h-4 w-4" /> Dashboard cu
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <style jsx>{`
        .newdash-card {
          animation: rise-in 420ms ease both;
          will-change: transform;
        }

        .newdash-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 18px 32px rgba(2, 6, 23, 0.12);
        }

        @keyframes rise-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .newdash-card {
            animation: none;
          }

          .newdash-card:hover {
            transform: none;
          }
        }
      `}</style>
    </main>
  )
}