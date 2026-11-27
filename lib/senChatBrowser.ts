'use client'

import { supabase } from '@/lib/supabaseClient'
import { getChatNotificationSettings } from '@/lib/senChatStorage'

export async function chatRequest<T>(path: string, body?: object, method = 'POST'): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Hãy đăng nhập để sử dụng Sen Chat.')
  const response = await fetch(`/api/chat/${path}`, {
    method: body ? method : 'GET',
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Không thể kết nối Sen Chat. Hãy thử lại.')
  return result
}

let audio: AudioContext | undefined

export function unlockChatAudio() {
  try {
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) return
    audio ??= new Audio()
    if (audio.state === 'suspended') void audio.resume().catch(() => {})
  } catch {}
}

export function playChatSound(kind: 'message' | 'call') {
  const settings = getChatNotificationSettings()
  if (!audio || audio.state !== 'running' || !(kind === 'message' ? settings.messageSound : settings.callSound)) return
  const start = audio.currentTime
  const notes = kind === 'message' ? [740, 988] : [523, 659, 784]
  notes.forEach((frequency, index) => {
    const offset = start + index * (kind === 'message' ? 0.075 : 0.15)
    const oscillator = audio!.createOscillator()
    const gain = audio!.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.001, offset)
    gain.gain.exponentialRampToValueAtTime(0.12, offset + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.22)
    oscillator.connect(gain).connect(audio!.destination)
    oscillator.start(offset)
    oscillator.stop(offset + 0.23)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  })
}

export async function configureChatPush(userId: string, enabled: boolean) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Thiết bị chưa hỗ trợ thông báo web. Trên iPhone và iPad, hãy thêm Sen Chat vào Màn hình chính.')
  }
  if (enabled && await Notification.requestPermission() !== 'granted') {
    throw new Error('Bạn có thể cấp quyền thông báo trong cài đặt trang của trình duyệt.')
  }
  const registration = await navigator.serviceWorker.register('/sen-chat-sw.js', { updateViaCache: 'none' })
  const active = registration.active ? registration : await navigator.serviceWorker.ready
  let subscription = await active.pushManager.getSubscription()
  if (!enabled) {
    if (subscription) {
      await chatRequest('notifications', { endpoint: subscription.endpoint }, 'DELETE')
      await subscription.unsubscribe()
    }
    localStorage.removeItem(`sen-chat-push:${userId}`)
    return
  }
  const { publicKey } = await chatRequest<{ publicKey: string }>('notifications')
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (value) => value.charCodeAt(0))
  subscription ??= await active.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await chatRequest('notifications', { action: 'subscribe', subscription: subscription.toJSON() })
  active.active?.postMessage({ type: 'sen-chat-user', user: userId })
  localStorage.setItem(`sen-chat-push:${userId}`, '1')
}
