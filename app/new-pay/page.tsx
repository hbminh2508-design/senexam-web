'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import {
  VND_PER_SENCASH,
  MIN_TOPUP_VND,
  vndToSenCash,
  senCashToVnd,
  isValidTopupAmount,
  fetchSenCashBalance,
  fetchMyTransactions,
  type SenCashTransaction,
  type SenCashTopupOrder,
} from '@/lib/senCash'
import {
  VIP_PLANS,
  PREMIUM_PLANS,
  PREMIUM_PLUS_PLANS,
  SEN_ONE_PLANS,
  SEN_ONE_LITE_PLANS,
  LITE_PLANS,
  getPlanByGroup,
  isVipActive,
  getEffectivePlanTier,
  getTotalSenaiDailyLimit,
  type PlanGroup,
  type VipOrder,
} from '@/lib/vipMembership'
import {
  SENAI_PLANS,
  SENAI_TIER_DAILY_LIMIT,
  SENAI_TIER_LABEL,
  SENGRAPH_AI_DAILY_LIMIT,
  getEffectiveSenaiTier,
  type SenAiTierCode,
  type SenAiPlan,
} from '@/lib/senaiTiers'
import { canAccessSenMaxPlan } from '@/lib/roadmapSchedule'
import {
  canAccessExclusiveStore,
  MONTHLY_FLASH_SALE_DISCOUNT_PERCENT,
  MONTHLY_FLASH_SALE_QUOTA,
  applyDiscount,
} from '@/lib/exclusiveStore'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Coins,
  CreditCard,
  Crown,
  Wallet,
  Sparkles,
  Zap,
  Gem,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Flame,
  Star,
  Rocket,
  Lock,
  MessageCircle,
  Box,
  RefreshCw,
  Tag,
  ShoppingBag,
  ExternalLink,
  History,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newpay-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newpay-body' })

type TabKey = 'wallet' | 'vip' | 'quota' | 'exclusive' | 'giftcode'
type PlanOption = { code: string; name: string; priceVnd: number; durationDays: number }

const TOPUP_PRESETS = [
  { vnd: 10_000, sc: 20, popular: false },
  { vnd: 20_000, sc: 40, popular: false },
  { vnd: 50_000, sc: 100, popular: true },
  { vnd: 100_000, sc: 200, popular: false },
  { vnd: 200_000, sc: 400, popular: false },
  { vnd: 500_000, sc: 1_000, popular: false },
]

const VIP_GROUP_META: Record<
  'vip' | 'premium' | 'premium_plus' | 'lite',
  { label: string; icon: typeof Crown; badge: string; color: string; plans: PlanOption[] }
> = {
  vip: {
    label: 'Sen VIP',
    icon: Crown,
    badge: 'Phổ biến nhất',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    plans: VIP_PLANS,
  },
  premium: {
    label: 'Premium',
    icon: Gem,
    badge: 'Đẳng cấp',
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    plans: PREMIUM_PLANS,
  },
  premium_plus: {
    label: 'VIP Premium+',
    icon: Sparkles,
    badge: 'Vượt Trội Hơn Beta',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    plans: PREMIUM_PLUS_PLANS,
  },
  lite: {
    label: 'Lite',
    icon: Zap,
    badge: 'Tiết kiệm',
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    plans: LITE_PLANS,
  },
}

const VIP_PERKS: Record<'vip' | 'premium' | 'premium_plus' | 'lite', string[]> = {
  vip: [
    'Học tập liền mạch, không quảng cáo trên toàn hệ thống',
    'Tải tài liệu và đề thi VIP ôn tập: 5 lượt tải miễn phí mỗi ngày',
    'Tặng thêm +50 lượt hỏi bài giải đề thông minh mỗi ngày',
    'Tặng kèm tài khoản SenAI Lite khi mua theo tháng hoặc năm',
    'Giảm giá 10% khi nâng cấp thêm các gói hỏi bài nâng cao',
  ],
  premium: [
    'Đầy đủ mọi quyền lợi cao cấp của hạng VIP',
    'Huy hiệu và biểu tượng Premium mạ vàng nổi bật trên Dashboard',
    'Tặng gói hỏi bài nâng cao Plus / Ultra (lên đến 250 câu hỏi/ngày)',
    'Giảm giá 15% không giới hạn trong Cửa hàng Sen',
    'Hỗ trợ giải đáp ưu tiên 24/7 từ đội ngũ học thuật SenExam',
  ],
  premium_plus: [
    'Bao gồm mọi quyền lợi cao cấp nhất của VIP và Premium',
    'Trải nghiệm trước toàn bộ các tính năng và giao diện học tập mới nhất',
    'Mở khóa công nghệ khảo thí và học tập thế hệ mới SenExam 2.0 Core',
    'Tải đề thi & tài liệu ôn tập tốc độ cao: 15 lượt tải mỗi ngày',
    'Tặng thêm +100 lượt hỏi bài giải đề thông minh mỗi ngày',
    'Huy hiệu VIP Premium+ Vàng Ánh Kim phát sáng độc quyền trên Dashboard',
  ],
  lite: [
    'Mở khoá xem kho tài liệu ôn thi và đề thi tuyển chọn',
    'Giảm thiểu tối đa quảng cáo xuất hiện khi làm bài',
    'Mức giá học sinh siêu tiết kiệm — chỉ từ 1.000đ/ngày',
  ],
}

// Nội dung giải thích gói hỏi bài đơn giản, gần gũi với học sinh (tránh thuật ngữ AI phức tạp)
const SENAI_SIMPLE_DETAILS: Record<
  string,
  { shortDesc: string; highlights: string[]; suitableFor: string }
> = {
  free: {
    shortDesc: 'Gói trải nghiệm học tập miễn phí hàng ngày',
    highlights: [
      '10 lượt hỏi bài giải đáp mỗi ngày',
      'Giải thích đáp án câu hỏi trắc nghiệm cơ bản',
      'Hỗ trợ các môn Toán, Lý, Hóa, Sinh, Anh, Văn',
    ],
    suitableFor: 'Học sinh ôn tập nhẹ nhàng, hỏi nhanh đáp án',
  },
  lite: {
    shortDesc: 'Gói hỗ trợ làm bài tập về nhà mỗi ngày',
    highlights: [
      '20 lượt hỏi bài giải đáp chi tiết mỗi ngày',
      'Hướng dẫn phương pháp làm bài từng bước rõ ràng',
      'Tóm tắt công thức và kiến thức trọng tâm bài học',
    ],
    suitableFor: 'Học sinh làm bài tập về nhà và củng cố kiến thức',
  },
  plus: {
    shortDesc: 'Gói ôn thi chuyên sâu & phân tích đồ thị',
    highlights: [
      '50 lượt hỏi bài giải đề mỗi ngày',
      '1 lượt phân tích đồ thị hàm số & hình học không gian mỗi ngày',
      'Giải thích chuyên sâu các câu vận dụng cao',
      'Hỗ trợ phiên bản bản quyền Vĩnh Viễn',
    ],
    suitableFor: 'Học sinh ôn thi học kỳ, thi vào 10 và thi tốt nghiệp THPT',
  },
  ultra: {
    shortDesc: 'Gói luyện thi cấp tốc cường độ cao',
    highlights: [
      '200 lượt hỏi bài giải đề mỗi ngày',
      '5 lượt phân tích đồ thị hàm số & hình học mỗi ngày',
      'Tốc độ trả lời ưu tiên tức thì không phải xếp hàng chờ',
      'Mở khóa công cụ phân tích đề thi thông minh',
    ],
    suitableFor: 'Học sinh đang trong giai đoạn luyện đề nước rút, thi HSA/TSA',
  },
  max: {
    shortDesc: 'Gói toàn diện cao cấp nhất — Không giới hạn câu hỏi',
    highlights: [
      '500 lượt hỏi bài giải đề mỗi ngày',
      '15 lượt phân tích đồ thị & hình học không gian mỗi ngày',
      'Phân tích chi tiết mọi dạng bài hóc búa nhất',
      'Ưu tiên kết nối máy chủ tốc độ cao nhất',
    ],
    suitableFor: 'Học sinh chuyên ôn luyện khối A/B/D, đội tuyển học sinh giỏi',
  },
}

// Danh sách các ưu đãi độc quyền hấp dẫn mới được bổ sung
const EXCLUSIVE_CUSTOM_DEALS = [
  {
    id: 'combo_starter',
    title: 'Combo Tân Thủ 2-in-1',
    badge: 'Tiết kiệm 45%',
    tag: 'Dành Cho Học Sinh Mới',
    desc: 'Trọn gói 1 tháng Hội viên VIP không quảng cáo + 1 tháng SenAI Plus (50 câu/ngày).',
    originalPrice: 178,
    discountedPrice: 119,
    planCode: 'plus_monthly',
    color: 'from-amber-500 to-orange-500',
    perks: ['VIP không quảng cáo 30 ngày', '50 câu hỏi giải bài mỗi ngày', '1 lần phân tích hình học/ngày'],
  },
  {
    id: 'combo_exam_cram',
    title: 'Chiến Binh Luyện Đề Nước Rút (3 Tháng)',
    badge: 'Siêu Ưu Đãi',
    tag: 'HSA / TSA / THPTQG',
    desc: '3 tháng Hội viên Premium + 3 tháng SenAI Ultra (200 câu/ngày) + 100 lượt tải đề thi độc quyền.',
    originalPrice: 799,
    discountedPrice: 499,
    planCode: 'ultra_quarterly',
    color: 'from-purple-600 to-pink-600',
    perks: ['200 câu hỏi giải bài mỗi ngày', '5 lần phân tích đồ thị/ngày', 'Huy hiệu Premium mạ vàng'],
  },
  {
    id: 'plus_perm_deal',
    title: 'Bản Quyền Vĩnh Viễn SenAI Plus',
    badge: 'Giảm 20%',
    tag: 'Không Hạn Sử Dụng',
    desc: 'Sở hữu trọn đời 50 lượt giải đề và hướng dẫn phương pháp làm bài mỗi ngày, không bao giờ hết hạn.',
    originalPrice: 2999,
    discountedPrice: 2399,
    planCode: 'plus_permanent',
    color: 'from-pink-500 to-rose-600',
    perks: ['Bản quyền trọn đời tài khoản', '50 câu hỏi giải đề mỗi ngày', 'Cập nhật miễn phí mãi mãi'],
  },
]

function PayContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isBetaTester, setIsBetaTester] = useState(false)

  // Tab State
  const initialTab = (searchParams?.get('tab') as TabKey) || 'vip'
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['wallet', 'vip', 'quota', 'exclusive', 'giftcode'].includes(initialTab) ? initialTab : 'vip'
  )

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // 1. SenCash States
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<SenCashTransaction[]>([])
  const [selectedVnd, setSelectedVnd] = useState<number>(50_000)
  const [customVnd, setCustomVnd] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [creatingTopup, setCreatingTopup] = useState(false)

  // 2. VIP States
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<PlanGroup | null>(null)
  const [activeVipGroup, setActiveVipGroup] = useState<'vip' | 'premium' | 'premium_plus' | 'lite'>('vip')
  const [selectedVipPlan, setSelectedVipPlan] = useState<PlanOption>(VIP_PLANS[2])
  const [senOneCode, setSenOneCode] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [senOneLiteCode, setSenOneLiteCode] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [creatingVipOrder, setCreatingVipOrder] = useState(false)
  const [redeemingVipPlan, setRedeemingVipPlan] = useState<string | null>(null)
  const [activePayingVipPlan, setActivePayingVipPlan] = useState<PlanOption | null>(null)

  // 3. Quota & SenAI States
  const [todayQuestionsCount, setTodayQuestionsCount] = useState(0)
  const [todaySenGraphAiCount, setTodaySenGraphAiCount] = useState(0)
  const [refreshingQuota, setRefreshingQuota] = useState(false)
  const [buyingSenAiCode, setBuyingSenAiCode] = useState<string | null>(null)

  // 4. Giftcode State
  const [giftCodeInput, setGiftCodeInput] = useState('')
  const [redeemingGiftCode, setRedeemingGiftCode] = useState(false)
  const [giftRedemptions, setGiftRedemptions] = useState<any[]>([])

  // 5. Exclusive Store Flash Sale State
  const [buyingExclusiveCode, setBuyingExclusiveCode] = useState<string | null>(null)

  // Unified QR Payment Modal State
  const [qrModal, setQrModal] = useState<{
    kind: 'sencash' | 'vip'
    order: (SenCashTopupOrder | VipOrder) & { [key: string]: any }
    qrUrl: string
  } | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Load User Data & Balances
  const reloadUserData = async (uid: string) => {
    try {
      const bal = await fetchSenCashBalance(uid)
      setBalance(bal)

      const txs = await fetchMyTransactions(uid)
      setTransactions(txs)

      const { data: prof } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, is_beta_tester, sencash_balance, senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier'
        )
        .eq('id', uid)
        .single()

      if (prof) {
        setProfile(prof)
        setVipExpiresAt(prof.vip_expires_at || null)
        setCurrentTier(getEffectivePlanTier(prof))
        const isBeta = prof.is_beta_tester === true || localStorage.getItem('senexam_beta_tester') === '1'
        setIsBetaTester(isBeta)
      }

      // Lấy lịch sử đổi giftcode
      const { data: codesHistory } = await supabase
        .from('gift_code_redemptions')
        .select('*, gift_codes(*)')
        .eq('user_id', uid)
        .order('redeemed_at', { ascending: false })
      setGiftRedemptions(codesHistory || [])
    } catch (err) {
      console.warn('Error reloading user data in new-pay:', err)
    }
  }

  // Load Quota Data
  const fetchQuotaData = async (uid: string, isManual = false) => {
    if (isManual) setRefreshingQuota(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      try {
        const res = await fetch('/api/senai/quota', { headers, cache: 'no-store' })
        if (res.ok) {
          const qData = await res.json()
          setTodayQuestionsCount(qData.used ?? 0)
          if (qData.graphUsed !== undefined) {
            setTodaySenGraphAiCount(qData.graphUsed)
          }
        }
      } catch (err) {
        console.warn('Quota API fallback:', err)
      }

      try {
        const gRes = await fetch('/api/sengraph/ai', { headers, cache: 'no-store' })
        if (gRes.ok) {
          const gData = await gRes.json()
          setTodaySenGraphAiCount(gData.usedToday ?? gData.usedCount ?? 0)
        }
      } catch (err) {
        console.warn('SenGraph quota error:', err)
      }
    } finally {
      if (isManual) {
        setTimeout(() => setRefreshingQuota(false), 500)
      }
    }
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        router.replace('/new-idp')
        return
      }

      setUserId(user.id)
      await ensureStudentProfile(user.id)
      await reloadUserData(user.id)
      await fetchQuotaData(user.id, false)
      setLoading(false)
    }

    init()

    return () => {
      stopPolling()
    }
  }, [router])

  // Sync tab with URL if user clicks or direct links
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    setErrorMsg('')
    setSuccessMsg('')
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }

  const toggleDarkMode = () => {
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Polling for SenCash Top-up Order
  const pollTopupOrderStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sencash/topup-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) return

        if (json.order?.status === 'paid') {
          setQrModal((prev) => (prev ? { ...prev, order: json.order } : null))
          stopPolling()
          if (userId) reloadUserData(userId)
        } else if (json.order?.status === 'expired' || json.order?.status === 'cancelled') {
          setQrModal((prev) => (prev ? { ...prev, order: json.order } : null))
          stopPolling()
        }
      } catch (err) {
        console.error('Error polling topup status:', err)
      }
    }, 2500)
  }

  // Create Top-up Order (VietQR)
  const handleCreateTopupOrder = async () => {
    setErrorMsg('')
    const amount = isCustom ? parseInt(customVnd, 10) : selectedVnd
    if (!amount || amount < MIN_TOPUP_VND) {
      setErrorMsg(`Số tiền nạp tối thiểu là ${MIN_TOPUP_VND.toLocaleString('vi-VN')} VNĐ`)
      return
    }

    setCreatingTopup(true)
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-idp')
        return
      }

      const res = await fetch('/api/sencash/create-topup-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amountVnd: amount,
          returnUrl: `${window.location.origin}/new-pay?tab=wallet`,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không tạo được mã thanh toán')
        return
      }

      setQrModal({ kind: 'sencash', order: json.order, qrUrl: json.qrUrl })
      pollTopupOrderStatus(json.order.id, token)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối khi tạo mã thanh toán')
    } finally {
      setCreatingTopup(false)
    }
  }

  // Polling for VIP Order
  const pollVipOrderStatus = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/vip/order-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) return

        if (json.order?.status === 'paid') {
          setQrModal((prev) => (prev ? { ...prev, order: json.order } : null))
          stopPolling()
          if (userId) reloadUserData(userId)
        } else if (json.order?.status === 'expired' || json.order?.status === 'cancelled') {
          setQrModal((prev) => (prev ? { ...prev, order: json.order } : null))
          stopPolling()
        }
      } catch (err) {
        console.error('Error polling vip status:', err)
      }
    }, 2500)
  }

  // Create VIP Order (VietQR)
  const handleBuyVip = async (group: PlanGroup, plan: PlanOption) => {
    setCreatingVipOrder(true)
    setErrorMsg('')
    setActivePayingVipPlan(plan)
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-idp')
        return
      }

      const res = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planGroup: group, planCode: plan.code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không thể tạo đơn hàng VIP')
        return
      }

      setQrModal({ kind: 'vip', order: json.order, qrUrl: json.qrUrl })
      pollVipOrderStatus(json.order.id, token)
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra khi tạo mã QR')
    } finally {
      setCreatingVipOrder(false)
    }
  }

  // Redeem VIP with SenCash
  const handleRedeemVipWithSenCash = async (group: PlanGroup, plan: PlanOption) => {
    setRedeemingVipPlan(plan.code)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-idp')
        return
      }

      const res = await fetch('/api/vip/redeem-sencash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: plan.code, planGroup: group }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không đổi được gói VIP bằng SenCash')
        return
      }

      setSuccessMsg(`Đã đổi thành công ${vndToSenCash(plan.priceVnd)} SenCash lấy gói ${plan.name}!`)
      if (userId) reloadUserData(userId)
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi trừ số dư SenCash')
    } finally {
      setRedeemingVipPlan(null)
    }
  }

  // Buy SenAI Tier with SenCash
  const handleBuySenAiTier = async (plan: SenAiPlan) => {
    setBuyingSenAiCode(plan.code)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-idp')
        return
      }

      const res = await fetch('/api/senai/purchase-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: plan.code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không thể kích hoạt gói câu hỏi')
        return
      }

      setSuccessMsg(`Chúc mừng bạn đã kích hoạt thành công gói ${plan.label}!`)
      if (userId) {
        await reloadUserData(userId)
        await fetchQuotaData(userId, true)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi kích hoạt gói')
    } finally {
      setBuyingSenAiCode(null)
    }
  }

  // Redeem Giftcode
  const handleRedeemGiftCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = giftCodeInput.trim().toUpperCase()
    if (!clean || clean.length < 4) {
      setErrorMsg('Vui lòng nhập đúng mã quà tặng hợp lệ.')
      return
    }

    setRedeemingGiftCode(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const token = await getToken()
      const res = await fetch('/api/gift-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: clean }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Mã quà tặng không hợp lệ hoặc đã hết hạn.')
      }

      setSuccessMsg(`🎉 Đổi mã thành công: ${data.reward || 'Bạn đã nhận quà từ mã thành công!'}`)
      setGiftCodeInput('')
      if (userId) await reloadUserData(userId)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kích hoạt mã quà tặng.')
    } finally {
      setRedeemingGiftCode(false)
    }
  }

  // Buy Custom Exclusive Deal
  const handleBuyExclusiveDeal = async (deal: (typeof EXCLUSIVE_CUSTOM_DEALS)[number]) => {
    setBuyingExclusiveCode(deal.id)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const token = await getToken()
      if (!token) {
        router.replace('/new-idp')
        return
      }

      // Check balance
      if (balance < deal.discountedPrice) {
        setErrorMsg(`Số dư SenCash không đủ. Bạn cần ${deal.discountedPrice} SC (Hiện có ${balance} SC).`)
        return
      }

      // Call purchase tier
      const res = await fetch('/api/senai/purchase-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planCode: deal.planCode }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Không thể kích hoạt ưu đãi độc quyền này')
        return
      }

      setSuccessMsg(`🎉 Săn thành công ưu đãi "${deal.title}"! Đã kích hoạt đặc quyền vào tài khoản.`)
      if (userId) {
        await reloadUserData(userId)
        await fetchQuotaData(userId, true)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi khi mua ưu đãi độc quyền')
    } finally {
      setBuyingExclusiveCode(null)
    }
  }

  // Effective tiers & stats
  const effectiveSenaiTier: SenAiTierCode = useMemo(() => {
    return getEffectiveSenaiTier(profile)
  }, [profile])

  const planTier = useMemo(() => getEffectivePlanTier(profile), [profile])

  const senaiTierLabel = SENAI_TIER_LABEL[effectiveSenaiTier] || 'SenAI'
  const dailyQuestionLimit = useMemo(() => {
    return getTotalSenaiDailyLimit(SENAI_TIER_DAILY_LIMIT[effectiveSenaiTier] || 10, planTier)
  }, [effectiveSenaiTier, planTier])
  const dailyGraphAiLimit = (SENGRAPH_AI_DAILY_LIMIT[effectiveSenaiTier] || 0) + (planTier === 'sen_one' ? 15 : 0)

  const remainingQuestions = Math.max(0, dailyQuestionLimit - todayQuestionsCount)
  const remainingGraphQuestions = Math.max(0, dailyGraphAiLimit - todaySenGraphAiCount)

  const currentlyActiveVip = isVipActive({ vip_expires_at: vipExpiresAt })
  const vipMeta = VIP_GROUP_META[activeVipGroup]
  const currentSenOnePlan = SEN_ONE_PLANS.find((p) => p.code === senOneCode) || SEN_ONE_PLANS[0]
  const currentSenOneLitePlan = SEN_ONE_LITE_PLANS.find((p) => p.code === senOneLiteCode) || SEN_ONE_LITE_PLANS[0]

  const isMaxAccessible = canAccessSenMaxPlan(isBetaTester)
  const themeVars = getModernThemeVars('indigo', isDark)

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="font-bold text-sm">Đang tải Cửa hàng Sen...</span>
        </div>
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 pb-20`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.08), transparent 35%), radial-gradient(circle at 90% 15%, rgba(139, 92, 246, 0.12), transparent 30%), var(--bg)'
          : 'radial-gradient(circle at 10% 10%, rgba(254, 243, 199, 0.6), transparent 35%), radial-gradient(circle at 90% 15%, rgba(237, 233, 254, 0.5), transparent 30%), var(--bg)',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* TOP BAR / NAVIGATION */}
        <div className="flex items-center justify-between">
          <Link
            href="/new-dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm transition hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại Dashboard
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleTabChange('giftcode')}
              className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-sm transition hover:scale-105 ${
                activeTab === 'giftcode'
                  ? 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Gift className="h-4 w-4 text-amber-500" />
              <span className="hidden sm:inline">Mã quà tặng</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('exclusive')}
              className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition hover:scale-105 ${
                activeTab === 'exclusive'
                  ? 'border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-400'
                  : 'border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400'
              }`}
            >
              <Gem className="h-4 w-4 text-purple-500" />
              <span className="hidden sm:inline">Ưu Đãi Độc Quyền</span>
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        {/* HERO SECTION: TỔNG QUAN TÀI KHOẢN & SỐ DƯ */}
        <div className="relative overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-xl backdrop-blur-2xl">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow-sm">
                  <Coins className="h-3.5 w-3.5" /> Cửa Hàng Sen
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {currentlyActiveVip ? `Hạng ${currentTier?.toUpperCase()}` : 'Hội viên tiêu chuẩn'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400">
                  {senaiTierLabel}
                </span>
              </div>

              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-newpay-heading)' }}
              >
                Cửa Hàng Sen & Quản Lý Dịch Vụ
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl font-medium leading-relaxed">
                Quản lý số dư Ví SenCash, kích hoạt gói Hội viên VIP không quảng cáo, săn ưu đãi độc quyền và nhập mã
                quà tặng tất cả tại một nơi.
              </p>
            </div>

            {/* Quick Balances Summary Grid */}
            <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Ví SenCash */}
              <div
                onClick={() => handleTabChange('wallet')}
                className="cursor-pointer rounded-2xl border border-amber-500/25 bg-amber-500/10 dark:bg-amber-500/15 p-4 hover:border-amber-500 transition shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Ví SenCash
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-200" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  {balance.toLocaleString('vi-VN')} SC
                </p>
                <p className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80">
                  ≈ {(balance * VND_PER_SENCASH).toLocaleString('vi-VN')}đ • Nạp tiền
                </p>
              </div>

              {/* Card 2: Hạng VIP */}
              <div
                onClick={() => handleTabChange('vip')}
                className="cursor-pointer rounded-2xl border border-purple-500/25 bg-purple-500/10 dark:bg-purple-500/15 p-4 hover:border-purple-500 transition shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Hội Viên VIP
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <p className="mt-1 text-lg font-black text-purple-900 dark:text-purple-200" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  {currentlyActiveVip ? 'Đang Hoạt Động' : 'Chưa kích hoạt'}
                </p>
                <p className="text-[11px] font-semibold text-purple-700/80 dark:text-purple-300/80">
                  {currentlyActiveVip && vipExpiresAt
                    ? `Hết hạn ${new Date(vipExpiresAt).toLocaleDateString('vi-VN')}`
                    : 'Nâng cấp ngay'}
                </p>
              </div>

              {/* Card 3: Lượt hỏi bài */}
              <div
                onClick={() => handleTabChange('quota')}
                className="cursor-pointer rounded-2xl border border-pink-500/25 bg-pink-500/10 dark:bg-pink-500/15 p-4 hover:border-pink-500 transition shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-700 dark:text-pink-300 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> Lượt Hỏi Bài
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-pink-500" />
                </div>
                <p className="mt-1 text-2xl font-black text-pink-900 dark:text-pink-200" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  {remainingQuestions}
                  <span className="text-xs font-normal text-pink-700/80 dark:text-pink-300/80">/{dailyQuestionLimit}</span>
                </p>
                <p className="text-[11px] font-semibold text-pink-700/80 dark:text-pink-300/80">
                  Còn lại hôm nay • Chi tiết
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK MESSAGES */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-xs font-bold text-rose-400 hover:text-rose-600">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-xs font-bold text-emerald-400 hover:text-emerald-600">
              ✕
            </button>
          </div>
        )}

        {/* UNIFIED TABS SELECTOR (5 TABS) */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('vip')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'vip'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-slate-900 shadow-md scale-101'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Crown className="h-4 w-4 text-amber-500" />
            <span>Hội Viên VIP</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('quota')}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'quota'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-slate-900 shadow-md scale-101'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageCircle className="h-4 w-4 text-pink-500" />
            <span>Gói Hỏi Bài & Quota</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('wallet')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'wallet'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-slate-900 shadow-md scale-101'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wallet className="h-4 w-4 text-emerald-500" />
            <span>Ví Sen & Nạp Tiền</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('exclusive')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'exclusive'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-slate-900 shadow-md scale-101'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Gem className="h-4 w-4 text-purple-500" />
            <span>Ưu Đãi Độc Quyền</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('giftcode')}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'giftcode'
                ? 'bg-[#111827] text-white dark:bg-white dark:text-slate-900 shadow-md scale-101'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Gift className="h-4 w-4 text-amber-500" />
            <span>Nhập Gift Code</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: HỘI VIÊN VIP */}
        {/* ============================================================== */}
        {activeTab === 'vip' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Combo Sen One & Sen One Lite Highlights */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Sen One Card */}
              <div className="relative overflow-hidden rounded-[32px] border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-white/90 dark:to-slate-900/90 p-6 sm:p-7 shadow-xl backdrop-blur-xl flex flex-col justify-between">
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-purple-600 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-white" /> Trọn Gói Hoàn Hảo Nhất
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                        Sen One All-in-One
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">Tất cả đặc quyền cao cấp nhất trong một gói</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/10">
                    {(['monthly', 'quarterly', 'yearly'] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setSenOneCode(cycle)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                          senOneCode === cycle
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {cycle === 'monthly' ? '1 Tháng' : cycle === 'quarterly' ? '3 Tháng' : '1 Năm (+1T Miễn Phí)'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-3xl font-black text-amber-600 dark:text-amber-400" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {currentSenOnePlan.priceVnd.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ≈ {vndToSenCash(currentSenOnePlan.priceVnd)} SenCash
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-black/10 dark:border-white/10">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Hội viên VIP Premium+:</strong> Học không quảng cáo, tải tài liệu không giới hạn cuối tuần.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>500 lượt hỏi bài giải đề/ngày:</strong> Gói Sen Max cao cấp nhất giải quyết mọi bài tập.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>15 lượt phân tích đồ thị/ngày:</strong> Hỗ trợ giải toán hình học không gian và đồ thị hàm số.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2 pt-4 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleBuyVip('sen_one', currentSenOnePlan)}
                    disabled={creatingVipOrder}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-3 text-xs font-black uppercase tracking-wider shadow transition hover:opacity-90 disabled:opacity-50"
                  >
                    {creatingVipOrder && activePayingVipPlan?.code === currentSenOnePlan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Quét VietQR Kích Hoạt
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRedeemVipWithSenCash('sen_one', currentSenOnePlan)}
                    disabled={
                      redeemingVipPlan === currentSenOnePlan.code ||
                      balance < vndToSenCash(currentSenOnePlan.priceVnd)
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-3 px-4 text-xs font-bold transition hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    {redeemingVipPlan === currentSenOnePlan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Coins className="h-4 w-4 text-amber-500" />
                    )}
                    Đổi bằng SenCash
                  </button>
                </div>
              </div>

              {/* Sen One Lite Card */}
              <div className="relative overflow-hidden rounded-[32px] border border-sky-500/30 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-7 shadow-lg backdrop-blur-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
                      <Zap className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-black" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                        Sen One Lite
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">Gói combo tiết kiệm tiện ích cho học sinh</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/10">
                    {(['monthly', 'quarterly', 'yearly'] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setSenOneLiteCode(cycle)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                          senOneLiteCode === cycle
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {cycle === 'monthly' ? '1 Tháng' : cycle === 'quarterly' ? '3 Tháng' : '1 Năm (+10 Ngày)'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-3xl font-black text-sky-600 dark:text-sky-400" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {currentSenOneLitePlan.priceVnd.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ≈ {vndToSenCash(currentSenOneLitePlan.priceVnd)} SenCash
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-black/10 dark:border-white/10">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Hội viên VIP cơ bản:</strong> Trọn vẹn không banner quảng cáo gây mất tập trung.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Tặng kèm gói SenAI Plus:</strong> 50 câu hỏi giải đề mỗi ngày + 1 lần phân tích hình học.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>10 lượt tải đề thi VIP/tháng:</strong> Đầy đủ tài liệu và file đề PDF chất lượng cao.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2 pt-4 border-t border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleBuyVip('sen_one_lite', currentSenOneLitePlan)}
                    disabled={creatingVipOrder}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-3 text-xs font-black uppercase tracking-wider shadow transition hover:opacity-90 disabled:opacity-50"
                  >
                    {creatingVipOrder && activePayingVipPlan?.code === currentSenOneLitePlan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Quét VietQR Kích Hoạt
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRedeemVipWithSenCash('sen_one_lite', currentSenOneLitePlan)}
                    disabled={
                      redeemingVipPlan === currentSenOneLitePlan.code ||
                      balance < vndToSenCash(currentSenOneLitePlan.priceVnd)
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 py-3 px-4 text-xs font-bold transition hover:bg-sky-500/20 disabled:opacity-40"
                  >
                    {redeemingVipPlan === currentSenOneLitePlan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Coins className="h-4 w-4 text-sky-500" />
                    )}
                    Đổi bằng SenCash
                  </button>
                </div>
              </div>
            </div>

            {/* Traditional VIP Plans Selector */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  Bảng Giá Các Gói Hội Viên
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Chọn gói thành viên phù hợp với nhu cầu học tập của bạn theo tuần, tháng hoặc năm.
                </p>
              </div>

              {/* VIP Group Selector Sub-tabs */}
              <div className="flex flex-wrap gap-2">
                {(['vip', 'premium', 'premium_plus', 'lite'] as const).map((groupKey) => {
                  const meta = VIP_GROUP_META[groupKey]
                  const Icon = meta.icon
                  const active = activeVipGroup === groupKey
                  return (
                    <button
                      key={groupKey}
                      type="button"
                      onClick={() => {
                        setActiveVipGroup(groupKey)
                        const plans = VIP_GROUP_META[groupKey].plans
                        setSelectedVipPlan(plans[Math.min(2, plans.length - 1)])
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-black/5'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{meta.label}</span>
                      <span className="text-[10px] opacity-75 font-bold">({meta.badge})</span>
                    </button>
                  )
                })}
              </div>

              {/* Group Perks Description */}
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4">
                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Đặc quyền gói {vipMeta.label}:
                </p>
                <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {VIP_PERKS[activeVipGroup].map((perk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pricing Cards Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vipMeta.plans.map((plan) => {
                  const scNeeded = vndToSenCash(plan.priceVnd)
                  const canRedeem = balance >= scNeeded
                  const isSelected = selectedVipPlan.code === plan.code

                  return (
                    <div
                      key={plan.code}
                      className={`relative overflow-hidden rounded-[26px] border p-5 transition-all backdrop-blur-xl flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-lg scale-101'
                          : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {plan.durationDays >= 365
                              ? 'Gói 1 Năm'
                              : plan.durationDays >= 30
                              ? `Gói ${Math.round(plan.durationDays / 30)} Tháng`
                              : `Gói ${plan.durationDays} Ngày`}
                          </span>
                          <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold">
                            {scNeeded} SC
                          </span>
                        </div>

                        <h3 className="mt-2 text-xl font-black" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                          {plan.name}
                        </h3>

                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                            {plan.priceVnd.toLocaleString('vi-VN')}
                          </span>
                          <span className="text-xs font-bold text-slate-500">VNĐ</span>
                        </div>
                      </div>

                      <div className="mt-6 space-y-2 pt-4 border-t border-black/10 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVipPlan(plan)
                            handleBuyVip(activeVipGroup, plan)
                          }}
                          disabled={creatingVipOrder}
                          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 py-2.5 text-xs font-black uppercase tracking-wider shadow transition hover:opacity-90 disabled:opacity-50"
                        >
                          {creatingVipOrder && activePayingVipPlan?.code === plan.code ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Quét VietQR <ChevronRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRedeemVipWithSenCash(activeVipGroup, plan)}
                          disabled={redeemingVipPlan === plan.code || !canRedeem}
                          className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-2 text-xs font-bold transition hover:bg-amber-500/20 disabled:opacity-40"
                        >
                          {redeemingVipPlan === plan.code ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Coins className="h-3.5 w-3.5 text-amber-500" />
                              {canRedeem
                                ? `Đổi bằng ${scNeeded} SenCash`
                                : `Cần ${scNeeded} SC (Thiếu ${scNeeded - balance})`}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: GÓI HỎI BÀI & HẠN MỨC (SENAI) */}
        {/* ============================================================== */}
        {activeTab === 'quota' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Quota Overview Cards */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                    Hạn Mức Hỏi Bài Hôm Nay
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Hạn mức được làm mới tự động vào 00:00 mỗi ngày để hỗ trợ việc học tập đều đặn.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => userId && fetchQuotaData(userId, true)}
                  disabled={refreshingQuota}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs font-bold hover:bg-black/10 transition self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-pink-500 ${refreshingQuota ? 'animate-spin' : ''}`} />
                  <span>{refreshingQuota ? 'Đang cập nhật...' : 'Làm mới hạn mức'}</span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Thẻ 1: Lượt hỏi giải bài */}
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                      <MessageCircle className="h-4 w-4" /> Lượt Hỏi Bài Học Tập
                    </span>
                    <span>
                      {todayQuestionsCount} / {dailyQuestionLimit} câu
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {remainingQuestions}
                    </strong>
                    <span className="text-xs font-semibold text-slate-500">lượt còn lại hôm nay</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, (todayQuestionsCount / dailyQuestionLimit) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Thẻ 2: Lượt phân tích hình ảnh & đồ thị */}
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <Box className="h-4 w-4" /> Phân Tích Đồ Thị & Hình Học
                    </span>
                    <span>
                      {todaySenGraphAiCount} / {dailyGraphAiLimit} lần
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-3xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {remainingGraphQuestions}
                    </strong>
                    <span className="text-xs font-semibold text-slate-500">lượt còn lại hôm nay</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                      style={{
                        width: dailyGraphAiLimit === 0 ? '0%' : `${Math.min(100, (todaySenGraphAiCount / dailyGraphAiLimit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Thẻ 3: Gói cước đang sở hữu */}
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Crown className="h-4 w-4" /> Gói Đang Dùng
                    </span>
                    <span className="capitalize font-black text-amber-500">{senaiTierLabel}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <strong className="text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {profile?.senai_tier_permanent
                        ? 'Bản Quyền Vĩnh Viễn'
                        : profile?.senai_tier_expires_at
                        ? `Hết hạn ${new Date(profile.senai_tier_expires_at).toLocaleDateString('vi-VN')}`
                        : 'Gói Miễn Phí (Cơ Bản)'}
                    </strong>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {effectiveSenaiTier === 'max'
                      ? 'Gói Sen Max cao cấp nhất — 500 câu/ngày & 15 lần phân tích đồ thị.'
                      : effectiveSenaiTier === 'ultra'
                      ? 'Gói SenAI Ultra — 200 câu/ngày & 5 lần phân tích đồ thị.'
                      : effectiveSenaiTier === 'plus'
                      ? 'Gói SenAI Plus — 50 câu/ngày & 1 lần phân tích đồ thị.'
                      : 'Nâng cấp lên Plus hoặc Ultra để mở khóa thêm lượt giải bài và phân tích đồ thị toán.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Danh Sách Gói Hỏi Bài & Nâng Cấp */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  Các Gói Nâng Cấp Lượt Hỏi Bài Học Tập
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Đổi trực tiếp bằng SenCash trong ví mà không cần chuyển khoản lại.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Gói 1: Lite */}
                <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition">
                  <div className="space-y-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-700 dark:text-slate-300">
                      Học sinh cơ bản
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Lite</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">29</span>
                      <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{SENAI_SIMPLE_DETAILS.lite.shortDesc}</p>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                      {SENAI_SIMPLE_DETAILS.lite.highlights.map((h, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const plan = SENAI_PLANS.find((p) => p.code === 'lite_monthly')
                      if (plan) handleBuySenAiTier(plan)
                    }}
                    disabled={buyingSenAiCode === 'lite_monthly' || balance < 29}
                    className="w-full text-center py-2.5 rounded-xl border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-xs font-black uppercase tracking-wider hover:bg-black/10 transition disabled:opacity-40"
                  >
                    {buyingSenAiCode === 'lite_monthly' ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : balance < 29 ? (
                      'Cần 29 SC'
                    ) : (
                      'Kích Hoạt (29 SC)'
                    )}
                  </button>
                </div>

                {/* Gói 2: Plus */}
                <div className="rounded-[26px] border border-pink-500/30 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Phổ biến nhất
                  </div>
                  <div className="space-y-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:text-pink-400">
                      Ôn thi chuyên sâu
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Plus</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">100</span>
                      <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{SENAI_SIMPLE_DETAILS.plus.shortDesc}</p>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                      {SENAI_SIMPLE_DETAILS.plus.highlights.map((h, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const plan = SENAI_PLANS.find((p) => p.code === 'plus_monthly')
                        if (plan) handleBuySenAiTier(plan)
                      }}
                      disabled={buyingSenAiCode === 'plus_monthly' || balance < 100}
                      className="w-full text-center py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black uppercase tracking-wider transition shadow-sm disabled:opacity-40"
                    >
                      {buyingSenAiCode === 'plus_monthly' ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : balance < 100 ? (
                        'Cần 100 SC (1 Tháng)'
                      ) : (
                        'Gói 1 Tháng (100 SC)'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const plan = SENAI_PLANS.find((p) => p.code === 'plus_permanent')
                        if (plan) handleBuySenAiTier(plan)
                      }}
                      disabled={buyingSenAiCode === 'plus_permanent' || balance < 2_999}
                      className="w-full text-center py-2 rounded-xl border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[11px] font-bold hover:bg-pink-500/10 transition disabled:opacity-40"
                    >
                      Bản Vĩnh Viễn (2.999 SC)
                    </button>
                  </div>
                </div>

                {/* Gói 3: Ultra */}
                <div className="rounded-[26px] border border-purple-500/30 bg-white/80 dark:bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition">
                  <div className="space-y-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      Luyện đề cấp tốc
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">SenAI Ultra</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">159</span>
                      <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{SENAI_SIMPLE_DETAILS.ultra.shortDesc}</p>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                      {SENAI_SIMPLE_DETAILS.ultra.highlights.map((h, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const plan = SENAI_PLANS.find((p) => p.code === 'ultra_monthly')
                      if (plan) handleBuySenAiTier(plan)
                    }}
                    disabled={buyingSenAiCode === 'ultra_monthly' || balance < 159}
                    className="w-full text-center py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition shadow-sm disabled:opacity-40"
                  >
                    {buyingSenAiCode === 'ultra_monthly' ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : balance < 159 ? (
                      'Cần 159 SC'
                    ) : (
                      'Kích Hoạt (159 SC)'
                    )}
                  </button>
                </div>

                {/* Gói 4: Sen Max */}
                <div className="rounded-[26px] border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-white/80 to-purple-500/10 dark:from-amber-500/20 dark:via-slate-900/80 dark:to-purple-900/20 p-5 flex flex-col justify-between space-y-4 hover:shadow-2xl transition relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-rose-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Cao cấp nhất
                  </div>

                  <div className="space-y-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Toàn diện tối đa
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      Sen Max <Sparkles className="h-5 w-5 text-amber-500" />
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400">318</span>
                      <span className="text-xs font-bold text-slate-500">SC / tháng</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{SENAI_SIMPLE_DETAILS.max.shortDesc}</p>
                    <ul className="text-xs text-slate-700 dark:text-slate-200 space-y-2 pt-2 border-t border-amber-500/20 font-medium">
                      {SENAI_SIMPLE_DETAILS.max.highlights.map((h, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    {isMaxAccessible ? (
                      <button
                        type="button"
                        onClick={() => {
                          const plan = SENAI_PLANS.find((p) => p.code === 'max_monthly')
                          if (plan) handleBuySenAiTier(plan)
                        }}
                        disabled={buyingSenAiCode === 'max_monthly' || balance < 318}
                        className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {buyingSenAiCode === 'max_monthly' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Crown className="h-4 w-4" /> Kích Hoạt Sen Max (318 SC)
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="w-full text-center py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                        Đang thử nghiệm qua Kênh Beta
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: VÍ SENCASH & NẠP TIỀN */}
        {/* ============================================================== */}
        {activeTab === 'wallet' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Wallet Overview & Perks */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-7 shadow-sm backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Số Dư Khả Dụng</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4" /> An toàn & Bảo mật
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-amber-600 dark:text-amber-400" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      {balance.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">SenCash</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">
                    Tương đương ≈ {(balance * VND_PER_SENCASH).toLocaleString('vi-VN')} VNĐ
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10 text-xs text-slate-500 space-y-1">
                  <p>💡 Tỉ lệ quy đổi cố định: <strong>500đ = 1 SenCash</strong>.</p>
                  <p>✨ Số dư SenCash không có hạn sử dụng, được lưu trữ vĩnh viễn trong tài khoản.</p>
                </div>
              </div>

              {/* SenCash Utility Highlights */}
              <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-7 shadow-sm backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                    <Sparkles className="h-4 w-4 text-amber-500" /> Bạn có thể dùng SenCash để làm gì?
                  </h3>
                  <ul className="mt-3 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Đổi gói Hội viên VIP:</strong> Trừ thẳng số dư ví để kích hoạt tài khoản không quảng cáo.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Nâng cấp lượt hỏi bài:</strong> Mua thêm câu hỏi giải đề ôn thi theo tháng hoặc vĩnh viễn.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Săn ưu đãi độc quyền:</strong> Giảm giá đặc biệt trong Cửa Hàng Độc Quyền.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleTabChange('giftcode')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Gift className="h-3.5 w-3.5 text-amber-500" /> Nhập mã Giftcode quà tặng →
                  </button>
                </div>
              </div>
            </div>

            {/* Top-up Form Section */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
              <div className="border-b border-black/10 dark:border-white/10 pb-4">
                <h2 className="text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  Nạp Tiền Vào Ví SenCash
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Chọn mệnh giá hoặc nhập số tiền để tạo mã quét ngân hàng tự động (VietQR/SePay).
                </p>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {TOPUP_PRESETS.map((item) => {
                  const active = !isCustom && selectedVnd === item.vnd
                  return (
                    <button
                      key={item.vnd}
                      type="button"
                      onClick={() => {
                        setIsCustom(false)
                        setSelectedVnd(item.vnd)
                      }}
                      className={`relative rounded-2xl border p-3.5 text-center transition-all ${
                        active
                          ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 shadow-sm scale-105'
                          : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {item.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                          Phổ biến
                        </span>
                      )}
                      <p className="text-sm font-black" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                        {item.vnd.toLocaleString('vi-VN')}đ
                      </p>
                      <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                        +{item.sc} SC
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Custom Input */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Hoặc nhập số tiền khác:</span>
                <div className="relative flex-1 w-full max-w-xs">
                  <input
                    type="number"
                    step={MIN_TOPUP_VND}
                    min={MIN_TOPUP_VND}
                    placeholder="VD: 30000"
                    value={customVnd}
                    onChange={(e) => {
                      setCustomVnd(e.target.value)
                      setIsCustom(true)
                    }}
                    className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-3 pr-10 text-xs font-bold outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    VNĐ
                  </span>
                </div>
                {isCustom && customVnd && parseInt(customVnd, 10) >= MIN_TOPUP_VND && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    = +{vndToSenCash(parseInt(customVnd, 10))} SenCash
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCreateTopupOrder}
                  disabled={creatingTopup}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:opacity-90 disabled:opacity-50"
                >
                  {creatingTopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Tạo mã quét VietQR
                </button>
              </div>
            </div>

            {/* Transaction History */}
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl">
              <h2 className="text-xl font-black mb-4" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                Lịch Sử Biến Động Số Dư
              </h2>

              {transactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-8 text-center text-xs text-slate-500">
                  Chưa có giao dịch SenCash nào trong tài khoản của bạn.
                </div>
              ) : (
                <div className="divide-y divide-black/10 dark:divide-white/10">
                  {transactions.map((tx) => {
                    const isPositive = tx.delta > 0
                    return (
                      <div key={tx.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                              isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {tx.reason === 'topup'
                                ? 'Nạp tiền qua VietQR'
                                : tx.reason === 'vip_redeem'
                                ? 'Đổi gói Hội viên VIP'
                                : tx.reason === 'senai_tier_purchase'
                                ? 'Kích hoạt gói hỏi bài SenAI'
                                : tx.reason === 'vip_download_spend'
                                ? 'Tải tài liệu ôn tập'
                                : tx.reason === 'admin_gift'
                                ? 'Quà tặng từ hệ thống'
                                : tx.reason === 'gift_code'
                                ? 'Nhập mã Giftcode'
                                : 'Sử dụng dịch vụ'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(tx.created_at).toLocaleString('vi-VN')} {tx.reference ? `• ${tx.reference}` : ''}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-black ${
                            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                          style={{ fontFamily: 'var(--font-newpay-heading)' }}
                        >
                          {isPositive ? `+${tx.delta}` : tx.delta} SC
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CỬA HÀNG ĐỘC QUYỀN (EXCLUSIVE DEALS) */}
        {/* ============================================================== */}
        {activeTab === 'exclusive' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-3 py-0.5 text-[11px] font-black text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                      <Gem className="inline h-3.5 w-3.5 mr-1 text-purple-500" /> Cửa Hàng Độc Quyền
                    </span>
                    <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                      Ưu Đãi Đặc Biệt Cho Học Sinh
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                    Combo Siêu Tiết Kiệm & Ưu Đãi Độc Quyền
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Các gói combo giảm sốc được tối ưu chi phí dành riêng cho thành viên SenExam.
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Số dư hiện tại:</span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-sm">
                    {balance.toLocaleString('vi-VN')} SC
                  </span>
                </div>
              </div>

              {/* Grid 3 gói ưu đãi mới */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {EXCLUSIVE_CUSTOM_DEALS.map((deal) => {
                  const isBuying = buyingExclusiveCode === deal.id
                  const canAfford = balance >= deal.discountedPrice

                  return (
                    <div
                      key={deal.id}
                      className="relative overflow-hidden rounded-[28px] border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-6 flex flex-col justify-between space-y-4 hover:shadow-xl transition"
                    >
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                        {deal.badge}
                      </div>

                      <div className="space-y-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          {deal.tag}
                        </span>

                        <h3 className="text-lg font-black text-slate-900 dark:text-white">{deal.title}</h3>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                          {deal.desc}
                        </p>

                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                            {deal.discountedPrice} SC
                          </span>
                          <span className="text-xs font-bold text-slate-400 line-through">
                            {deal.originalPrice} SC
                          </span>
                        </div>

                        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                          {deal.perks.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBuyExclusiveDeal(deal)}
                        disabled={isBuying || !canAfford}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-40"
                      >
                        {isBuying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="h-4 w-4" />
                            {canAfford ? `Kích Hoạt Ngay (${deal.discountedPrice} SC)` : `Cần ${deal.discountedPrice} SC`}
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: NHẬP MÃ QUÀ TẶNG (GIFT CODE) */}
        {/* ============================================================== */}
        {activeTab === 'giftcode' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 sm:p-8 shadow-sm backdrop-blur-xl space-y-6">
              <div className="border-b border-black/10 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                      Kích Hoạt Mã Quà Tặng (Giftcode)
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                      Nhập mã quà tặng từ sự kiện, livestream hoặc thầy cô để nhận ngay SenCash, ngày VIP hoặc gói câu hỏi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form nhập Giftcode */}
              <form onSubmit={handleRedeemGiftCode} className="max-w-xl space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Mã quà tặng của bạn:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="VD: SENEXAM-VIP-2026"
                      value={giftCodeInput}
                      onChange={(e) => setGiftCodeInput(e.target.value.toUpperCase())}
                      className="h-12 flex-1 rounded-2xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 px-4 font-mono font-bold text-sm tracking-widest outline-none focus:border-amber-500 dark:focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={redeemingGiftCode || !giftCodeInput.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition hover:opacity-90 disabled:opacity-40"
                    >
                      {redeemingGiftCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      Đổi Mã
                    </button>
                  </div>
                </div>
              </form>

              {/* Lịch sử đổi mã */}
              <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                <h3 className="text-base font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  <History className="h-4 w-4 text-slate-500" /> Các mã quà tặng bạn đã nhận
                </h3>

                {giftRedemptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-6 text-center text-xs text-slate-500">
                    Bạn chưa kích hoạt mã quà tặng nào gần đây.
                  </div>
                ) : (
                  <div className="divide-y divide-black/10 dark:divide-white/10 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden">
                    {giftRedemptions.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div>
                            <p className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.code || item.gift_codes?.code || 'MÃ QUÀ TẶNG'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(item.redeemed_at).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {item.reward || 'Đã nhận thành công'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* UNIFIED VIETQR PAYMENT MODAL */}
      {/* ============================================================== */}
      {qrModal && qrModal.qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            {qrModal.order.status === 'paid' ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                  {qrModal.kind === 'sencash' ? 'Nạp Tiền Thành Công!' : 'Kích Hoạt Gói Thành Công!'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {qrModal.kind === 'sencash'
                    ? `Bạn đã được cộng +${qrModal.order.sencash_amount} SenCash vào ví thành công.`
                    : 'Tài khoản của bạn đã được nâng cấp thành công gói thành viên và kích hoạt toàn bộ quyền lợi.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    stopPolling()
                    setQrModal(null)
                    if (userId) reloadUserData(userId)
                  }}
                  className="mt-4 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 text-xs font-bold shadow transition hover:opacity-90"
                >
                  Xác nhận & Đóng
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                  <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-newpay-heading)' }}>
                    {qrModal.kind === 'sencash' ? 'Quét mã VietQR để nạp' : 'Quét mã VietQR để kích hoạt'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      stopPolling()
                      setQrModal(null)
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    ✕ Đóng
                  </button>
                </div>

                <div className="flex justify-center p-2 bg-white rounded-2xl border border-black/10">
                  <img src={qrModal.qrUrl} alt="Mã VietQR" className="w-56 h-56 object-contain" />
                </div>

                <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-3 space-y-2 text-xs">
                  {qrModal.kind === 'vip' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gói nâng cấp:</span>
                      <strong className="font-bold">
                        {activePayingVipPlan?.name ||
                          getPlanByGroup(qrModal.order.plan_group || activeVipGroup, qrModal.order.plan_code)?.name ||
                          'Gói Thành Viên'}
                      </strong>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-500">Số tiền:</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-black">
                      {(qrModal.order.amount_vnd || qrModal.order.amount || 0).toLocaleString('vi-VN')} VNĐ
                    </strong>
                  </div>

                  {qrModal.kind === 'sencash' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">SenCash nhận được:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                        +{qrModal.order.sencash_amount} SC
                      </strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                    <span className="text-slate-500">Nội dung CK:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(qrModal.order.order_code)}
                      className="inline-flex items-center gap-1 font-mono font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {qrModal.order.order_code}{' '}
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span>Hệ thống đang tự động kiểm tra thanh toán...</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default function NewPayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-[#FDF6EC] dark:bg-[#080C14] text-[#2B2B2B] dark:text-slate-100">
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 px-6 py-4 shadow-xl backdrop-blur-xl">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="font-bold text-sm">Đang tải Cửa hàng Sen...</span>
          </div>
        </div>
      }
    >
      <PayContent />
    </Suspense>
  )
}
