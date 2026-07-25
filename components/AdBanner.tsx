'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getEffectivePlanTier } from '@/lib/vipMembership'

const DISMISS_KEY = 'senexam_ad_dismissed_until'

// Mốc "một ngày mới" — nửa đêm theo giờ máy người dùng, không phải +24h từ lúc đóng, để khớp đúng
// nghĩa "hiển thị lại sau một ngày mới" thay vì "sau đúng 24 tiếng".
function startOfNextLocalDay(): number {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}

type AdVisibility = 'loading' | 'hidden' | 'free' | 'lite'

// Quảng cáo AdSense thật (khác VipAdBanner — banner tự quảng bá mua VIP). Ẩn hẳn với thành viên
// VIP/Premium (đặc quyền "không quảng cáo"). Gói Lite vẫn thấy quảng cáo nhưng có nút đóng, đóng
// rồi thì chỉ hiện lại vào một ngày mới. Người dùng chưa mua gói nào thấy quảng cáo bình thường,
// không có nút đóng.
export default function AdBanner({ dataAdSlot }: { dataAdSlot: string }) {
  const [visibility, setVisibility] = useState<AdVisibility>('loading')

  useEffect(() => {
    let cancelled = false

    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setVisibility('free'); return }

      const { data: profile } = await supabase.from('profiles').select('vip_expires_at, plan_tier').eq('id', user.id).maybeSingle()
      const tier = getEffectivePlanTier(profile)
      if (cancelled) return

      if (tier === 'vip' || tier === 'premium') { setVisibility('hidden'); return }
      if (tier === 'lite') {
        const hiddenUntil = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
        setVisibility(hiddenUntil && Date.now() < hiddenUntil ? 'hidden' : 'lite')
        return
      }
      setVisibility('free')
    }

    resolve()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (visibility !== 'free' && visibility !== 'lite') return
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdSense error:", err);
    }
  }, [visibility]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(startOfNextLocalDay()))
    setVisibility('hidden')
  }

  if (visibility === 'loading' || visibility === 'hidden') return null

  return (
    <div className="relative w-full flex justify-center my-4 overflow-hidden rounded-2xl bg-slate-100/50 dark:bg-[#1A1A1A]/50 border border-slate-200 dark:border-white/5 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
      {visibility === 'lite' && (
        <button
          onClick={handleDismiss}
          aria-label="Đóng quảng cáo, hiện lại vào ngày mai"
          title="Đóng quảng cáo — hiện lại vào ngày mai"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-7774417042006604"
        data-ad-slot={dataAdSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  )
}
