'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
} from 'lucide-react'

type TabKey = 'vip' | 'wallet' | 'quota' | 'giftcode' | 'exclusive'

export default function MobilePayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get('tab') as TabKey) || 'vip'

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [senCashBalance, setSenCashBalance] = useState<number>(0)
  const [userProfile, setUserProfile] = useState<any>(null)

  // VIP State
  const [selectedVipGroup, setSelectedVipGroup] = useState<'vip' | 'premium' | 'lite'>('vip')
  const [selectedDuration, setSelectedDuration] = useState<'month' | 'year' | 'lifetime'>('year')

  // Wallet State
  const [topupAmount, setTopupAmount] = useState<number>(50000)

  // GiftCode State
  const [giftCode, setGiftCode] = useState('')
  const [giftStatus, setGiftStatus] = useState<string | null>(null)

  // Payment Modal State
  const [qrModal, setQrModal] = useState<{
    title: string
    amount: number
    content: string
    qrUrl: string
  } | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
          if (prof) {
            setUserProfile(prof)
            setSenCashBalance(prof.sencash_balance || prof.sen_cash || 0)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadUser()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Khởi tạo thanh toán VietQR
  const handleOpenPayment = async (title: string, amount: number, memoPrefix: string) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || 'GUEST'
      const orderCode = `SEN${Date.now().toString().slice(-6)}`
      const memo = `${memoPrefix} ${orderCode}`
      // VietQR chuẩn MB Bank SenExam
      const qrUrl = `https://img.vietqr.io/image/MB-0348749830-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=SENEXAM`

      setQrModal({
        title,
        amount,
        content: memo,
        qrUrl,
      })
    } catch (err) {
      console.error(err)
      alert('Không thể tạo mã thanh toán, vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyGiftCode = async () => {
    if (!giftCode.trim()) return
    setLoading(true)
    setGiftStatus(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setGiftStatus('Vui lòng đăng nhập để đổi GiftCode.')
        return
      }
      const res = await fetch('/api/giftcode/redeem', {
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
      } else {
        setGiftStatus(data.error || 'Mã GiftCode không hợp lệ hoặc đã hết lượt.')
      }
    } catch {
      setGiftStatus('Lỗi kết nối máy chủ khi đổi mã quà tặng.')
    } finally {
      setLoading(false)
    }
  }

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

      {/* 2. 5 TABS ĐIỀU HƯỚNG CỬA HÀNG */}
      <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 overflow-x-auto scrollbar-none">
        {[
          { key: 'vip', label: 'Gói VIP', icon: Crown },
          { key: 'wallet', label: 'Ví Sen', icon: Wallet },
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
                  ? 'bg-violet-600 text-white shadow-xs'
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
      {/* TAB 1: CÁC GÓI HỘI VIÊN VIP                                */}
      {/* ========================================================= */}
      {activeTab === 'vip' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Banner VIP Mobile */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-pink-600 text-white shadow-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <Crown className="h-4 w-4" /> Đặc Quyền Hội Viên Sen VIP
            </div>
            <p className="text-xs text-amber-100 leading-relaxed">
              Mở khóa toàn bộ đề thi khảo thí chuẩn Canvas, tải tài liệu không giới hạn và nhận lời giải thích KaTeX chuyên sâu.
            </p>
          </div>

          {/* Chọn loại gói VIP */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl text-center">
            {[
              { key: 'vip', label: 'Sen VIP', sub: 'Khuyên dùng' },
              { key: 'premium', label: 'Premium', sub: 'Chuyên sâu' },
              { key: 'lite', label: 'Sen Lite', sub: 'Tiết kiệm' },
            ].map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setSelectedVipGroup(g.key as any)}
                className={`py-2 rounded-xl text-xs font-black transition ${
                  selectedVipGroup === g.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                <div>{g.label}</div>
                <div className="text-[9px] font-normal opacity-70">{g.sub}</div>
              </button>
            ))}
          </div>

          {/* Danh sách các kỳ hạn */}
          <div className="space-y-2.5">
            {[
              {
                key: 'month',
                title: 'Gói 1 Tháng',
                price: selectedVipGroup === 'premium' ? '89.000đ' : selectedVipGroup === 'vip' ? '59.000đ' : '29.000đ',
                rawPrice: selectedVipGroup === 'premium' ? 89000 : selectedVipGroup === 'vip' ? 59000 : 29000,
                desc: 'Luyện thi cơ bản trong 30 ngày.',
              },
              {
                key: 'year',
                title: 'Gói 1 Năm (Khuyên Dùng)',
                price: selectedVipGroup === 'premium' ? '299.000đ' : selectedVipGroup === 'vip' ? '199.000đ' : '99.000đ',
                rawPrice: selectedVipGroup === 'premium' ? 299000 : selectedVipGroup === 'vip' ? 199000 : 99000,
                badge: 'TIẾT KIỆM 70%',
                desc: 'Đồng hành trọn vẹn cả năm học, giải chi tiết và SenAI.',
              },
              {
                key: 'lifetime',
                title: 'Hội Viên Vĩnh Viễn',
                price: selectedVipGroup === 'premium' ? '699.000đ' : selectedVipGroup === 'vip' ? '499.000đ' : '249.000đ',
                rawPrice: selectedVipGroup === 'premium' ? 699000 : selectedVipGroup === 'vip' ? 499000 : 249000,
                badge: 'TRỌN ĐỜI',
                desc: 'Mở khóa toàn bộ đặc quyền hiện tại và mọi bản nâng cấp tương lai.',
              },
            ].map((p) => {
              const isSelected = selectedDuration === p.key
              return (
                <div
                  key={p.key}
                  onClick={() => setSelectedDuration(p.key as any)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-xs'
                      : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {p.title}
                        </h4>
                        {p.badge && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-amber-500">{p.price}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Nút Thanh Toán */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              const currentPrice =
                selectedDuration === 'lifetime'
                  ? (selectedVipGroup === 'premium' ? 699000 : selectedVipGroup === 'vip' ? 499000 : 249000)
                  : selectedDuration === 'year'
                  ? (selectedVipGroup === 'premium' ? 299000 : selectedVipGroup === 'vip' ? 199000 : 99000)
                  : (selectedVipGroup === 'premium' ? 89000 : selectedVipGroup === 'vip' ? 59000 : 29000)

              handleOpenPayment(
                `Gói ${selectedVipGroup.toUpperCase()} (${selectedDuration})`,
                currentPrice,
                `VIP_${selectedVipGroup.toUpperCase()}`
              )
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white font-black text-xs shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            <span>THANH TOÁN QUA VIETQR TỰ ĐỘNG</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: VÍ SEN (SENCASH & NẠP TIỀN)                        */}
      {/* ========================================================= */}
      {activeTab === 'wallet' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Card Số Dư Ví */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">Số Dư Ví SenCash</span>
              <Coins className="h-5 w-5 text-amber-300" />
            </div>
            <div className="text-3xl font-black">
              {senCashBalance.toLocaleString('vi-VN')} <span className="text-sm font-bold opacity-80">SC</span>
            </div>
            <p className="text-[11px] text-violet-200">
              Quy đổi: 500 VND = 1 SC. Dùng để mở khóa đề thi lẻ, mua tài liệu VIP và đổi quà.
            </p>
          </div>

          {/* Chọn Mốc Nạp Tiền */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase text-slate-500">Mốc Nạp Tiền Nhanh</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { vnd: 10000, sc: 20 },
                { vnd: 20000, sc: 40 },
                { vnd: 50000, sc: 100, popular: true },
                { vnd: 100000, sc: 200 },
                { vnd: 200000, sc: 400 },
                { vnd: 500000, sc: 1000 },
              ].map((item) => {
                const isSelected = topupAmount === item.vnd
                return (
                  <button
                    key={item.vnd}
                    type="button"
                    onClick={() => setTopupAmount(item.vnd)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-violet-600 bg-violet-600/10 ring-2 ring-violet-500/40 shadow-xs'
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
                    <span className="text-[10px] text-amber-500 font-bold block mt-0.5">
                      +{item.sc} SC
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Nút Tạo QR Nạp Ví */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              handleOpenPayment(
                `Nạp Ví Sen ${topupAmount.toLocaleString('vi-VN')}đ`,
                topupAmount,
                'SENCASH'
              )
            }}
            className="w-full py-3.5 rounded-2xl bg-violet-600 text-white font-black text-xs shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            <span>NẠP VÍ QUA VIETQR ({topupAmount.toLocaleString('vi-VN')}đ)</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: GÓI SENAI STUDIO & SENGRAPH                       */}
      {/* ========================================================= */}
      {activeTab === 'quota' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <Sparkles className="h-4 w-4" /> Gói Hạn Mức SenAI Studio 2.0
            </div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Trợ lý giải bài thi KaTeX từng bước, nhận diện công thức toán học từ hình ảnh và phân tích đồ thị hàm số SenGraph.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              {
                code: 'plus',
                name: 'Gói SenAI Plus',
                price: '39.000đ/tháng',
                rawPrice: 39000,
                desc: '50 lượt hỏi bài/ngày + 1 lượt phân tích đồ thị SenGraph/ngày.',
              },
              {
                code: 'ultra',
                name: 'Gói SenAI Ultra',
                price: '99.000đ/tháng',
                rawPrice: 99000,
                desc: '200 lượt hỏi bài/ngày + 5 lượt phân tích đồ thị SenGraph/ngày, phản hồi siêu tốc.',
              },
              {
                code: 'max',
                name: 'Gói SenAI Max Không Giới Hạn',
                price: '199.000đ/tháng',
                rawPrice: 199000,
                desc: '500 lượt hỏi bài/ngày + 15 lượt phân tích đồ thị, xử lý bài vận dụng cao cực đại.',
              },
            ].map((p) => (
              <div
                key={p.code}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{p.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-violet-600 block">{p.price}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenPayment(p.name, p.rawPrice, `AI_${p.code.toUpperCase()}`)}
                    className="mt-1 px-3 py-1 rounded-xl bg-violet-600 text-white text-[10px] font-black active:scale-95 transition"
                  >
                    Đăng ký
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
              placeholder="VÍ DỤ: SENEXAM2026, VIPTEST..."
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
              disabled={loading || !giftCode.trim()}
              onClick={handleApplyGiftCode}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-black text-xs shadow-md active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>KÍCH HOẠT QUÀ TẶNG</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: DEAL ĐỘC QUYỀN                                      */}
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
            {[
              {
                id: 'deal_1',
                title: 'Tuyển Tập 100 Đề Toán Trọng Điểm 2026',
                price: '49.000đ',
                rawPrice: 49000,
                desc: 'Kèm theo lời giải KaTeX và mã đề Canvas trực tuyến.',
              },
              {
                id: 'deal_2',
                title: 'Bộ Tài Liệu Ôn Thi HSA / TSA Độc Quyền',
                price: '79.000đ',
                rawPrice: 79000,
                desc: 'Phần tư duy định lượng & định tính mới nhất.',
              },
            ].map((deal) => (
              <div
                key={deal.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{deal.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{deal.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-rose-500 block">{deal.price}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenPayment(deal.title, deal.rawPrice, 'DEAL')}
                    className="mt-1 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-black active:scale-95 transition"
                  >
                    Mua ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL THANH TOÁN VIETQR TỰ ĐỘNG                           */}
      {/* ========================================================= */}
      {qrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl border border-black/10 dark:border-white/10 relative">
            <button
              type="button"
              onClick={() => setQrModal(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-black/5 dark:bg-white/5 text-slate-400 hover:text-black dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase text-violet-600 dark:text-violet-400">
                Quét Mã VietQR
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
                <span className="text-slate-400">Nội dung:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-violet-600">
                  <span>{qrModal.content}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(qrModal.content)}
                    className="p-1 rounded text-slate-400 hover:text-black"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-center text-slate-400 leading-tight">
              Hệ thống tự động kích hoạt ngay sau 1-3 phút khi nhận được chuyển khoản.
            </p>

            <button
              type="button"
              onClick={() => setQrModal(null)}
              className="w-full py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
