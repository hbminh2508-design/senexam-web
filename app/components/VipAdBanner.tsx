'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Crown, X, Ban, FolderLock, Headset, Sparkles } from 'lucide-react'

const DISMISS_KEY = 'senexam_vip_ad_dismissed_session'

const PERKS = [
  { icon: Ban, text: 'Học không bị quảng cáo làm phiền' },
  { icon: FolderLock, text: 'Mở khoá kho tài liệu độc quyền' },
  { icon: Headset, text: 'Được ưu tiên hỗ trợ' },
  { icon: Sparkles, text: 'Dùng gói SenAI xịn hơn' },
]

// Banner quảng bá VIP — chỉ hiện cho người dùng chưa VIP, tự ẩn nếu đã đăng ký hoặc đã đóng trong phiên này.
// Tự fetch trạng thái VIP nên có thể thả vào bất kỳ trang nào mà không cần truyền prop.
export default function VipAdBanner({ compact }: { compact?: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY)) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('vip_expires_at').eq('id', user.id).maybeSingle().then(({ data }) => {
        const isVip = !!data?.vip_expires_at && new Date(data.vip_expires_at).getTime() > Date.now()
        if (!isVip) setVisible(true)
      })
    })
  }, [])

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <button onClick={handleDismiss} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors">
        <X className="w-4 h-4" />
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
