'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ModernLoading from '@/app/components/ModernLoading'
import {
  VIP_PLANS,
  PREMIUM_PLANS,
  PREMIUM_PLUS_PLANS,
  SEN_ONE_PLANS,
  SEN_ONE_LITE_PLANS,
  LITE_PLANS,
  type PlanGroup,
  type VipPlan,
} from '@/lib/vipMembership'
import {
  SENAI_PLANS,
  SENAI_TIER_DAILY_LIMIT,
  SENAI_TIER_LABEL,
  getEffectiveSenaiTier,
  type SenAiTierCode,
  type SenAiPlan,
} from '@/lib/senaiTiers'
import { EXCLUSIVE_STORE_ITEMS } from '@/lib/exclusiveStore'
import {
  Crown,
  Zap,
  CheckCircle2,
  QrCode,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Wallet,
  Gift,
  Coins,
  ShieldCheck,
  ExternalLink,
  Loader2,
  X,
  Flame,
  Star,
  Tag,
  Package,
  Gem,
  Award,
  Infinity as InfinityIcon,
  ShoppingBag,
} from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

type TabKey = 'vip' | 'wallet' | 'quota' | 'giftcode' | 'exclusive'

export default function MobilePayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get('tab') as TabKey) || 'vip'

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [senCashBalance, setSenCashBalance] = useState<number>(0)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // VIP State
  const [selectedVipGroup, setSelectedVipGroup] = useState<PlanGroup>('vip')
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('monthly')

  // SenAI Quota State
  const [todayQuestionsCount, setTodayQuestionsCount] = useState<number>(0)
  const [todayGraphCount, setTodayGraphCount] = useState<number>(0)

  // Wallet State
  const [topupAmount, setTopupAmount] = useState<number>(50000)

  // GiftCode State
  const [giftCode, setGiftCode] = useState('')
  const [giftStatus, setGiftStatus] = useState<string | null>(null)

  // Payment Modal State
  const [qrModal, setQrModal] = useState<{
    kind: 'vip' | 'sencash' | 'generic'
    title: string
    amount: number
    orderCode: string
    qrUrl: string
    orderId?: string
    isPaid?: boolean
  } | null>(null)

  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  // Nạp dữ liệu người dùng & quota
  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/m/login?returnUrl=/m/pay')
          return
        }
        setUserId(user.id)
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (prof) {
          setUserProfile(prof)
          setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
        }

          // Lấy hạn mức quota câu hỏi
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            try {
              const qRes = await fetch('/api/senai/quota', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
              if (qRes.ok) {
                const qData = await qRes.json()
                setTodayQuestionsCount(qData.used ?? 0)
              }
            } catch (e) {
              console.warn('Quota load error:', e)
            }
          }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Danh sách các gói VIP theo group đã chọn
  const currentPlanList = React.useMemo(() => {
    if (selectedVipGroup === 'vip') return VIP_PLANS
    if (selectedVipGroup === 'premium') return PREMIUM_PLANS
    if (selectedVipGroup === 'premium_plus') return PREMIUM_PLUS_PLANS
    if (selectedVipGroup === 'sen_one') return SEN_ONE_PLANS
    if (selectedVipGroup === 'sen_one_lite') return SEN_ONE_LITE_PLANS
    return LITE_PLANS
  }, [selectedVipGroup])

  // Tự động chọn gói đầu tiên khi đổi nhóm
  useEffect(() => {
    if (currentPlanList.length > 0 && !currentPlanList.some((p) => p.code === selectedPlanCode)) {
      setSelectedPlanCode(currentPlanList[0].code)
    }
  }, [selectedVipGroup, currentPlanList, selectedPlanCode])

  // Polling trạng thái đơn hàng VIP
  const startPollingVipOrder = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/vip/order-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data?.order?.status === 'paid') {
          stopPolling()
          setQrModal((prev) => (prev ? { ...prev, isPaid: true } : null))
          // Refresh profile
          if (userId) {
            const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
            if (prof) setUserProfile(prof)
          }
        }
      } catch (err) {
        console.error('Lỗi kiểm tra trạng thái đơn VIP:', err)
      }
    }, 2500)
  }

  // Polling trạng thái đơn nạp SenCash
  const startPollingTopupOrder = (orderId: string, token: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sencash/topup-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data?.order?.status === 'paid') {
          stopPolling()
          setQrModal((prev) => (prev ? { ...prev, isPaid: true } : null))
          if (userId) {
            const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
            if (prof) {
              setUserProfile(prof)
              setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
            }
          }
        }
      } catch (err) {
        console.error('Lỗi kiểm tra trạng thái nạp SenCash:', err)
      }
    }, 2500)
  }

  // Mua gói VIP qua VietQR chuẩn PC
  const handleBuyVip = async () => {
    const plan = currentPlanList.find((p) => p.code === selectedPlanCode)
    if (!plan) return

    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/new-idp?returnUrl=/m/pay')
        return
      }

      const res = await fetch('/api/vip/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planGroup: selectedVipGroup,
          planCode: plan.code,
          returnUrl: `${window.location.origin}/m/pay?tab=vip`,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Không thể tạo đơn hàng VIP.')
        return
      }

      setQrModal({
        kind: 'vip',
        title: `Nâng cấp ${plan.name}`,
        amount: data.order?.amount_vnd || plan.priceVnd,
        orderCode: data.order?.order_code || `VIP_${plan.code}`,
        qrUrl: data.qrUrl,
        orderId: data.order?.id,
      })

      if (data.order?.id) {
        startPollingVipOrder(data.order.id, session.access_token)
      }
    } catch (err: any) {
      alert(`Lỗi tạo đơn hàng: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Nạp ví SenCash qua VietQR chuẩn PC
  const handleCreateTopup = async () => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/new-idp?returnUrl=/m/pay?tab=wallet')
        return
      }

      const res = await fetch('/api/sencash/create-topup-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amountVnd: topupAmount,
          returnUrl: `${window.location.origin}/m/pay?tab=wallet`,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Không thể tạo đơn nạp ví SenCash.')
        return
      }

      setQrModal({
        kind: 'sencash',
        title: `Nạp Cash Mobile: +${(topupAmount / 100).toLocaleString('vi-VN')} SCm`,
        amount: data.order?.amount_vnd || topupAmount,
        orderCode: data.order?.order_code || `SCM_${Date.now().toString().slice(-6)}`,
        qrUrl: data.qrUrl,
        orderId: data.order?.id,
      })

      if (data.order?.id) {
        startPollingTopupOrder(data.order.id, session.access_token)
      }
    } catch (err: any) {
      alert(`Lỗi tạo đơn nạp ví: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Mua gói SenAI bằng SenCash
  const handleBuySenAiPlan = async (plan: SenAiPlan) => {
    if (plan.priceSenCash > 0 && senCashBalance < plan.priceSenCash) {
      alert(`Số dư SenCash không đủ (${senCashBalance} SC < ${plan.priceSenCash} SC). Vui lòng nạp thêm SenCash!`)
      setActiveTab('wallet')
      return
    }

    if (!confirm(`Bạn có chắc chắn muốn kích hoạt gói "${plan.label}" với ${plan.priceSenCash} SC?`)) {
      return
    }

    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/new-idp?returnUrl=/m/pay?tab=quota')
        return
      }

      const res = await fetch('/api/senai/purchase-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planCode: plan.code }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Không thể kích hoạt gói SenAI.')
        return
      }

      alert(`Kích hoạt thành công gói ${plan.label}!`)
      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (prof) {
          setUserProfile(prof)
          setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
        }
      }
    } catch (err: any) {
      alert(`Lỗi khi kích hoạt: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Đổi mã quà tặng GiftCode
  const handleApplyGiftCode = async () => {
    if (!giftCode.trim()) return
    setActionLoading(true)
    setGiftStatus(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setGiftStatus('Vui lòng đăng nhập để đổi GiftCode.')
        return
      }
      const res = await fetch('/api/gift-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: giftCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setGiftStatus(`Đổi mã thành công: ${data.message || 'Chúc mừng bạn!'}`)
        setGiftCode('')
        if (userId) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
          if (prof) {
            setUserProfile(prof)
            setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
          }
        }
      } else {
        setGiftStatus(data.error || 'Mã GiftCode không hợp lệ hoặc đã hết lượt.')
      }
    } catch {
      setGiftStatus('Lỗi kết nối máy chủ khi đổi mã quà tặng.')
    } finally {
      setActionLoading(false)
    }
  }

  // Mua ưu đãi độc quyền
  const handleBuyExclusiveDeal = async (item: any) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/new-idp?returnUrl=/m/pay?tab=exclusive')
        return
      }
      const res = await fetch('/api/exclusive-store/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Không thể mở ưu đãi này.')
        return
      }
      alert('Đã mở khóa ưu đãi thành công!')
      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (prof) {
          setUserProfile(prof)
          setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
        }
      }
    } catch (err: any) {
      alert(`Lỗi giao dịch: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Giao diện loading chuẩn hóa theo đúng tên từng tính năng
  if (loading) {
    const loadingMeta =
      activeTab === 'vip'
        ? { title: 'Gói Hội Viên Sen VIP', subtitle: `Đang tải bảng giá và đặc quyền hội viên (v${MOBILE_VERSION})...` }
        : activeTab === 'wallet'
        ? { title: 'Ví Điện Tử SenCash', subtitle: `Đang tải số dư ví & thông tin nạp tiền (v${MOBILE_VERSION})...` }
        : activeTab === 'quota'
        ? { title: 'Hạn Mức Trợ Lý SenAI', subtitle: `Đang đồng bộ các gói câu hỏi SenAI (v${MOBILE_VERSION})...` }
        : activeTab === 'giftcode'
        ? { title: 'Đổi Mã Quà Tặng (GiftCode)', subtitle: `Đang tải cổng kích hoạt quà tặng (v${MOBILE_VERSION})...` }
        : { title: 'Cửa Hàng Độc Quyền', subtitle: `Đang tải các ưu đãi đặc quyền (v${MOBILE_VERSION})...` }

    return <ModernLoading title={loadingMeta.title} subtitle={loadingMeta.subtitle} />
  }

  const effectiveTier = getEffectiveSenaiTier(userProfile)
  const dailyLimit = SENAI_TIER_DAILY_LIMIT[effectiveTier]

  return (
    <div className="flex-1 w-full p-4 space-y-4 animate-in fade-in pb-16">
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-black text-slate-900 dark:text-white">
            Cửa Hàng VIP & Ví Sen
          </h1>
        </div>

        {/* Số dư SenCash */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black">
          <Coins className="h-3.5 w-3.5" />
          <span>{senCashBalance.toLocaleString('vi-VN')} SC</span>
        </div>
      </div>

      {/* 2. 5 TABS ĐIỀU HƯỚNG CỬA HÀNG ĐỒNG BỘ 100% NHƯ PC */}
      <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 overflow-x-auto scrollbar-none">
        {[
          { key: 'vip', label: 'Gói VIP', icon: Crown },
          { key: 'wallet', label: 'Cash Mobile', icon: Wallet },
          { key: 'quota', label: 'SenAI', icon: Sparkles },
          { key: 'giftcode', label: 'Mã Quà', icon: Gift },
          { key: 'exclusive', label: 'Deal Hot', icon: Tag },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex-1 min-w-[65px] py-2 rounded-xl text-[11px] font-black transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CÁC GÓI HỘI VIÊN VIP (ĐỒNG BỘ 100% TỪ PC)         */}
      {/* ========================================================= */}
      {activeTab === 'vip' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Banner VIP Mobile */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-pink-600 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Crown className="h-4 w-4" /> Đặc Quyền Hội Viên Sen VIP
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                1st Year Anniversary
              </span>
            </div>
            <p className="text-xs text-amber-100 leading-relaxed">
              Mở khóa toàn bộ đề thi chuẩn Canvas, tải tài liệu không giới hạn và nhận giải thích KaTeX chuyên sâu.
            </p>
          </div>

          {/* Chọn loại nhóm gói VIP theo bảng chuẩn PC */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'vip', label: 'Sen VIP', badge: 'Phổ biến' },
              { key: 'premium', label: 'Premium', badge: 'Đẳng cấp' },
              { key: 'premium_plus', label: 'Premium+', badge: 'Vượt trội' },
              { key: 'sen_one', label: 'Sen One', badge: 'All-in-One' },
              { key: 'sen_one_lite', label: 'Sen One Lite', badge: 'Mới' },
              { key: 'lite', label: 'Sen Lite', badge: 'Tiết kiệm' },
            ].map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setSelectedVipGroup(g.key as PlanGroup)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  selectedVipGroup === g.key
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/10'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Danh sách các kỳ hạn trong nhóm gói đã chọn */}
          <div className="space-y-2">
            {currentPlanList.map((p) => {
              const isSelected = selectedPlanCode === p.code
              return (
                <div
                  key={p.code}
                  onClick={() => setSelectedPlanCode(p.code)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-xs'
                      : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Thời hạn: {p.durationDays} ngày sử dụng
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-amber-500">
                        {p.priceVnd.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Nút Tạo Đơn & Thanh Toán VietQR Tự Động */}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleBuyVip}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white font-black text-xs shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            <span>THANH TOÁN GÓI QUA VIETQR TỰ ĐỘNG</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: VÍ CASH MOBILE (SCm & NẠP TIỀN QUA VIETQR)          */}
      {/* ========================================================= */}
      {activeTab === 'wallet' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Card Số Dư Ví Cash Mobile */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-200 uppercase tracking-wider">Số Dư Cash Mobile</span>
              <Coins className="h-5 w-5 text-amber-300" />
            </div>
            <div className="text-3xl font-black">
              {((senCashBalance || 0) * 5).toLocaleString('vi-VN')} <span className="text-sm font-bold opacity-80">SCm</span>
            </div>
            <p className="text-[11px] text-sky-100 leading-relaxed">
              Tỉ giá Cash Mobile: 1.000đ = 10 SCm (1 SCm = 100đ). Tương đương {(senCashBalance || 0).toLocaleString('vi-VN')} SC trên hệ sinh thái PC.
            </p>
          </div>

          {/* Chọn Mốc Nạp Tiền chuẩn Mobile */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500">Mốc Nạp Cash Mobile</span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">1.000đ = 10 SCm</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { vnd: 1000, scm: 10 },
                { vnd: 5000, scm: 50 },
                { vnd: 10000, scm: 100 },
                { vnd: 20000, scm: 200 },
                { vnd: 50000, scm: 500, popular: true },
                { vnd: 100000, scm: 1000 },
                { vnd: 200000, scm: 2000 },
              ].map((item) => {
                const isSelected = topupAmount === item.vnd
                return (
                  <button
                    key={item.vnd}
                    type="button"
                    onClick={() => setTopupAmount(item.vnd)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-sky-600 bg-sky-500/10 ring-2 ring-sky-500/40 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {item.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase">
                        HOT
                      </span>
                    )}
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {item.vnd.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-black block mt-0.5">
                      +{item.scm} SCm
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Nút Tạo QR Nạp Ví */}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleCreateTopup}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs shadow-lg active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            <span>NẠP CASH MOBILE QUA VIETQR ({topupAmount.toLocaleString('vi-VN')}đ ➔ +{(topupAmount / 100).toLocaleString('vi-VN')} SCm)</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: HẠN MỨC SENAI (SENAI_PLANS TỪ LIB)                  */}
      {/* ========================================================= */}
      {activeTab === 'quota' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Card Quota hiện tại */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-4 w-4" /> Trợ Lý SenAI 2.0
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 font-bold">
                Hạng: {SENAI_TIER_LABEL[effectiveTier]}
              </span>
            </div>
            <div className="text-sm font-black">
              Hôm nay đã dùng: <span className="text-amber-300 font-mono">{todayQuestionsCount}/{dailyLimit}</span> câu hỏi
            </div>
            <p className="text-[11px] text-indigo-100 leading-relaxed">
              Kích hoạt gói hạn mức để thoải mái hỏi đáp KaTeX, dịch thuật, tóm tắt lý thuyết và giải đề cùng SenAI.
            </p>
          </div>

          {/* Danh mục gói SenAI mua bằng SenCash từ lib/senaiTiers */}
          <div className="space-y-2.5">
            {SENAI_PLANS.map((p) => (
              <div
                key={p.code}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{p.label}</h4>
                  <span className="text-[10px] text-slate-400">
                    {SENAI_TIER_DAILY_LIMIT[p.tier]} câu hỏi/ngày
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-violet-600 dark:text-violet-400 block">
                    {p.priceSenCash === 0 ? 'Miễn phí' : `${p.priceSenCash} SC`}
                  </span>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleBuySenAiPlan(p)}
                    className="mt-1 px-3 py-1 rounded-xl bg-violet-600 text-white text-[10px] font-black active:scale-95 transition"
                  >
                    Kích hoạt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ĐỔI MÃ GIFTCODE                                     */}
      {/* ========================================================= */}
      {activeTab === 'giftcode' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <Gift className="h-4 w-4" /> Kích Hoạt Mã Quà Tặng
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Nhập mã sự kiện hoặc mã quà tặng từ Fanpage SenExam để nhận ngày VIP hoặc SenCash miễn phí.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 space-y-3 shadow-xs">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase block">
              Nhập Mã Quà Tặng
            </label>
            <input
              type="text"
              placeholder="VÍ DỤ: SENEXAM1YEAR, VIPTEST..."
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              className="w-full h-11 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs font-mono font-bold tracking-widest outline-none focus:border-violet-500 uppercase"
            />
            {giftStatus && (
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400">
                {giftStatus}
              </p>
            )}
            <button
              type="button"
              disabled={actionLoading || !giftCode.trim()}
              onClick={handleApplyGiftCode}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-black text-xs shadow-md active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>KÍCH HOẠT QUÀ TẶNG</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: DEAL ĐỘC QUYỀN (EXCLUSIVE STORE TỪ LIB)             */}
      {/* ========================================================= */}
      {activeTab === 'exclusive' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-lg space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <Flame className="h-4 w-4" /> Flash Sale & Ưu Đãi Giới Hạn
            </div>
            <p className="text-xs text-rose-100">
              Các gói tài liệu tuyển tập và huy hiệu thành viên chỉ mở trong thời gian có hạn.
            </p>
          </div>

          <div className="space-y-2.5">
            {EXCLUSIVE_STORE_ITEMS.slice(0, 8).map((deal) => (
              <div
                key={deal.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{deal.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{deal.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-rose-500 block">
                    {deal.priceSenCash} SC
                  </span>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleBuyExclusiveDeal(deal)}
                    className="mt-1 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-black active:scale-95 transition"
                  >
                    Đổi ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL THANH TOÁN VIETQR TỰ ĐỘNG CHUẨN PC VỚI POLLING     */}
      {/* ========================================================= */}
      {qrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl border border-black/10 dark:border-white/10 relative">
            <button
              type="button"
              onClick={() => {
                stopPolling()
                setQrModal(null)
              }}
              className="absolute top-4 right-4 p-1 rounded-full bg-black/5 dark:bg-white/5 text-slate-400 hover:text-black dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {qrModal.isPaid ? (
              <div className="text-center py-6 space-y-3 animate-in zoom-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Thanh Toán Thành Công!
                </h3>
                <p className="text-xs text-slate-500">
                  Hệ thống đã tự động kích hoạt dịch vụ vào tài khoản của bạn.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    stopPolling()
                    setQrModal(null)
                  }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-md active:scale-95"
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-black uppercase text-violet-600 dark:text-violet-400">
                    Quét Mã VietQR Tự Động
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {qrModal.title}
                  </h3>
                </div>

                {/* Ảnh VietQR */}
                <div className="w-56 h-56 mx-auto rounded-2xl bg-white p-2 border border-slate-200 shadow-inner flex items-center justify-center">
                  <img
                    src={qrModal.qrUrl}
                    alt="VietQR Payment"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Thông tin chuyển khoản */}
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Số tiền:</span>
                    <strong className="text-base font-black text-rose-500">
                      {qrModal.amount.toLocaleString('vi-VN')}đ
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nội dung CK:</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-violet-600">
                      <span>{qrModal.orderCode}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(qrModal.orderCode)}
                        className="p-1 rounded text-slate-400 hover:text-black"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-500 font-bold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tự động nhận diện thanh toán...</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopPolling()
                    setQrModal(null)
                  }}
                  className="w-full py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Đóng cửa sổ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* FOOTER MÃ PHIÊN BẢN */}
      <div className="pt-2 text-center text-[10px] text-slate-400 font-mono">
        SenExam VIP Store v{MOBILE_VERSION}
      </div>
    </div>
  )
}
