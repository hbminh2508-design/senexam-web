'use client'

import { useEffect, useState } from 'react'

export const ECO_MODE_CHANGED_EVENT = 'senexam-eco-mode-changed'

export function isEcoModeActive(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('senexam_eco_mode') === '1'
}

export function setEcoModeActive(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem('senexam_eco_mode', enabled ? '1' : '0')
  if (enabled) {
    document.documentElement.setAttribute('data-eco-mode', 'true')
  } else {
    document.documentElement.removeAttribute('data-eco-mode')
  }
  window.dispatchEvent(new CustomEvent(ECO_MODE_CHANGED_EVENT, { detail: { enabled } }))
}

export default function MobileBatteryManager() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [isCharging, setIsCharging] = useState<boolean | null>(null)

  useEffect(() => {
    // 1. Áp dụng cờ Eco Mode từ localStorage ngay khi mount
    const savedEco = localStorage.getItem('senexam_eco_mode') === '1'
    if (savedEco) {
      document.documentElement.setAttribute('data-eco-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-eco-mode')
    }

    // 2. Lắng nghe sự kiện thay đổi Eco Mode
    const handleEcoChange = (e: any) => {
      const active = e.detail?.enabled ?? (localStorage.getItem('senexam_eco_mode') === '1')
      if (active) {
        document.documentElement.setAttribute('data-eco-mode', 'true')
      } else {
        document.documentElement.removeAttribute('data-eco-mode')
      }
    }
    window.addEventListener(ECO_MODE_CHANGED_EVENT, handleEcoChange)

    // 3. Quản lý trạng thái tab ngầm (Page Visibility API) để tránh nóng máy hao pin
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tạm dừng hoạt ảnh và hiệu ứng khi người dùng chuyển sang app khác
        document.documentElement.setAttribute('data-app-hidden', 'true')
      } else {
        document.documentElement.removeAttribute('data-app-hidden')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 4. Kiểm tra pin qua Battery Status API (hỗ trợ Chrome Android / Samsung Internet)
    let batteryObj: any = null
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        batteryObj = battery
        const updateBatteryInfo = () => {
          setBatteryLevel(Math.round(battery.level * 100))
          setIsCharging(battery.charging)

          // Tự động bật chế độ tiết kiệm pin nếu pin < 20% và không cắm sạc (chỉ nếu user chưa thiết lập rõ ràng)
          if (battery.level <= 0.2 && !battery.charging && localStorage.getItem('senexam_eco_mode') === null) {
            setEcoModeActive(true)
          }
        }

        updateBatteryInfo()
        battery.addEventListener('levelchange', updateBatteryInfo)
        battery.addEventListener('chargingchange', updateBatteryInfo)
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener(ECO_MODE_CHANGED_EVENT, handleEcoChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', () => {})
          batteryObj.removeEventListener('chargingchange', () => {})
        } catch {}
      }
    }
  }, [])

  return null
}
