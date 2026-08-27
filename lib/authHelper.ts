import { supabase } from '@/lib/supabaseClient'

/**
 * Đăng nhập / Đăng ký bằng Google OAuth
 * @param nextPath Đường dẫn redirect sau khi đăng nhập thành công (mặc định: /dashboard)
 */
export async function signInWithGoogle(nextPath: string = '/dashboard') {
  if (typeof window === 'undefined') return

  const origin = window.location.origin
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    console.error('Error signing in with Google:', error)
    throw error
  }

  return data
}

/**
 * Liên kết tài khoản hiện tại với Google
 * @param nextPath Đường dẫn redirect sau khi liên kết (mặc định: trang hiện tại)
 */
export async function linkWithGoogle(nextPath?: string) {
  if (typeof window === 'undefined') return

  const origin = window.location.origin
  const target = nextPath || window.location.pathname || '/dashboard'
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(target)}`

  // Supabase v2 linkIdentity
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error('Error linking Google identity:', error)
    throw error
  }

  return data
}
