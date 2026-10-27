import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://nphryrldlfiuvpuqjovr.supabase.co'
const DEFAULT_ANON =
  typeof Buffer !== 'undefined'
    ? Buffer.from('c2JfcHVibGlzaGFibGVfZHdoR0lMWXR0bElyb2lTYW1TYngzQV9GNlRfVndCMQ==', 'base64').toString('utf8')
    : atob('c2JfcHVibGlzaGFibGVfZHdoR0lMWXR0bElyb2lTYW1TYngzQV9GNlRfVndCMQ==')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase-js tự động thử refresh phiên đăng nhập ở nền. Nếu refresh token đã lưu
// trong localStorage bị thu hồi/hết hạn (đổi project, xóa user, phiên cũ từ máy khác...),
// thao tác đó ném ra AuthApiError "Refresh Token Not Found" như một unhandled rejection
// mỗi lần tải trang. Dọn phiên cục bộ ngay khi gặp lỗi này để nó không lặp lại.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const message = (event?.reason?.message as string) || ''
    if (message.includes('Refresh Token Not Found') || message.includes('Invalid Refresh Token')) {
      event.preventDefault()
      supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    }
  })
}