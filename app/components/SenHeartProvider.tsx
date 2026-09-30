'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { senHeart } from '@/lib/senheart'

/**
 * Sen Heart 1.0 - Global Silent Provider
 * Được nhúng ngầm tại RootLayout, quản lý toàn bộ quá trình chuyển trang,
 * tự động ngắt các luồng chạy ngầm của trang cũ và định kỳ dọn dẹp cache cho người dùng.
 * Hoàn toàn tàng hình, không tạo DOM và không ảnh hưởng đến trải nghiệm người dùng.
 */
export default function SenHeartProvider() {
  const pathname = usePathname()
  const prevPathnameRef = useRef<string>(pathname)

  useEffect(() => {
    // 1. Khởi động hạt nhân Sen Heart 1.0
    senHeart.init()

    // 2. Thiết lập chu kỳ định kỳ tự động giảm thiểu cache (10 phút / lần)
    const cacheInterval = setInterval(() => {
      senHeart.trimCache()
    }, 10 * 60 * 1000)

    return () => {
      clearInterval(cacheInterval)
    }
  }, [])

  // Theo dõi sự kiện chuyển trang để ngắt luồng trang cũ
  useEffect(() => {
    const prev = prevPathnameRef.current
    if (prev !== pathname) {
      senHeart.transitionRoute(prev, pathname)
      prevPathnameRef.current = pathname
    }
  }, [pathname])

  return null
}
