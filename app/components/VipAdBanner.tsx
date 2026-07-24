'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Crown, X, Ban, FolderLock, Headset, Sparkles } from 'lucide-react'

const DISMISS_KEY = 'senexam_vip_ad_dismissed_at'
const REAPPEAR_AFTER_MS = 60 * 1000
const MIN_DISPLAY_SECONDS = 5

const PERKS = [
  { icon: Ban, text: 'Học không bị quảng cáo làm phiền' },
  { icon: FolderLock, text: 'Mở khoá kho tài liệu độc quyền' },
  { icon: Headset, text: 'Được ưu tiên hỗ trợ' },
  { icon: Sparkles, text: 'Dùng gói SenAI xịn hơn' },
]

// Banner quảng bá VIP — chỉ hiện cho người dùng chưa VIP. Khi đóng, banner ẩn đi và chỉ tự
// hiện lại ở lần tải trang (reload) tiếp theo SAU KHI đã qua 1 phút kể từ lúc đóng — đóng rồi
// reload ngay trong vòng 1 phút vẫn tiếp tục ẩn.
// Tự fetch trạng thái VIP nên có thể thả vào bất kỳ trang nào mà không cần truyền prop.
export default function VipAdBanner({ compact }: { compact?: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  // Theo quy định quảng cáo tại Việt Nam: phải hiển thị tối thiểu 5 giây trước khi cho phép tắt
  const [secondsLeft, setSecondsLeft] = useState(MIN_DISPLAY_SECONDS)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
      if (dismissedAt && Date.now() - dismissedAt < REAPPEAR_AFTER_MS) return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('vip_expires_at').eq('id', user.id).maybeSingle().then(({ data }) => {
        const isVip = !!data?.vip_expires_at && new Date(data.vip_expires_at).getTime() > Date.now()
        if (!isVip) setVisible(true)
      })
    })
  }, [])

  useEffect(() => {
    if (!visible || secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [visible, secondsLeft])

  const handleDismiss = () => {
    if (secondsLeft > 0) return
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <button
        onClick={handleDismiss}
        disabled={secondsLeft > 0}
        aria-label={secondsLeft > 0 ? `Đóng quảng cáo sau ${secondsLeft} giây` : 'Đóng quảng cáo'}
        title={secondsLeft > 0 ? `Có thể tắt sau ${secondsLeft}s` : 'Đóng quảng cáo'}
        className={`absolute top-3 right-3 flex items-center gap-1.5 h-9 min-w-[36px] px-2.5 rounded-full font-black text-sm transition-colors ${
          secondsLeft > 0 ? 'bg-black/25 text-white/90 cursor-not-allowed' : 'bg-white/25 hover:bg-white/40 text-white cursor-pointer'
        }`}
      >
        {secondsLeft > 0 ? secondsLeft : <X className="w-5 h-5" strokeWidth={3} />}
      </button>

      <div className={`flex ${compact ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-center gap-4'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base sm:text-lg flex items-center gap-2">
            <Crown className="w-5 h-5 shrink-0" /> Đăng ký VIP ngay hôm nay — mở khoá đặc quyền tối ưu nhất!
          </p>
          <div className={`mt-2.5 grid ${compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'} gap-x-4 gap-y-1.5`}>
            {PERKS.map(p => (
              <span key={p.text} className="flex items-center gap-1.5 text-xs font-semibold text-amber-50">
                <p.icon className="w-3.5 h-3.5 shrink-0" /> {p.text}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => router.push('/vip')}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-white text-amber-600 font-black text-sm shadow-md hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
        >
          Đăng ký ngay — chỉ từ 3.000đ
        </button>
      </div>
    </div>
  )
}
