import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import dns from 'dns'

try {
  dns.setDefaultResultOrder('ipv4first')
} catch {}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nphryrldlfiuvpuqjovr.supabase.co'

// Khởi tạo trễ (lazy) — SUPABASE_SERVICE_ROLE_KEY có thể chưa được cấu hình lúc build,
// tạo client ngay ở top-level sẽ làm `next build` thất bại khi thu thập page data.
let _admin: SupabaseClient<Database> | null = null

// Client dùng riêng trong Route Handler (server-side) — bỏ qua RLS bằng service role key.
// KHÔNG bao giờ import file này vào code chạy ở trình duyệt.
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_admin) return _admin
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Supabase admin requires SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }
  _admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

let _anon: SupabaseClient<Database> | null = null
function getAnonClient(): SupabaseClient<Database> {
  if (_anon) return _anon
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('Supabase requires NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
  }
  _anon = createClient<Database>(supabaseUrl, anonKey)
  return _anon
}

// Xác thực người dùng từ access token gửi qua header Authorization: Bearer <token>,
// hoặc query param ?token= (dùng cho các thẻ <a>/<iframe> không gắn được header, vd tải tài liệu VIP).
export async function getUserFromRequest(request: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : null
  const queryToken = new URL(request.url).searchParams.get('token')
  let token = bearerToken || queryToken

  // Fallback: Kiểm tra cookie xác thực nếu không có header Authorization (hỗ trợ Safari / cookie session / chunked cookies)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    if (cookieHeader) {
      const cookieMap: Record<string, string> = {}
      cookieHeader.split(';').forEach((part) => {
        const [k, ...v] = part.trim().split('=')
        if (k) cookieMap[k] = v.join('=')
      })

      // 1. Kiểm tra trực tiếp sb-access-token
      if (cookieMap['sb-access-token']) {
        token = decodeURIComponent(cookieMap['sb-access-token'])
      } else {
        // 2. Tìm các cookie dạng sb-*-auth-token hoặc sb-*-auth-token.0, .1 (chunked)
        const authCookieKeys = Object.keys(cookieMap).filter((k) =>
          /^sb-[a-zA-Z0-9_-]+-auth-token(\.\d+)?$/.test(k)
        )

        if (authCookieKeys.length > 0) {
          authCookieKeys.sort((a, b) => {
            const numA = a.includes('.') ? parseInt(a.split('.').pop() || '0', 10) : 0
            const numB = b.includes('.') ? parseInt(b.split('.').pop() || '0', 10) : 0
            return numA - numB
          })

          const rawJoined = authCookieKeys.map((k) => cookieMap[k]).join('')
          try {
            let decoded = decodeURIComponent(rawJoined)
            if (decoded.startsWith('base64-')) {
              decoded = Buffer.from(decoded.slice(7), 'base64').toString('utf-8')
            }
            if (decoded.startsWith('[') || decoded.startsWith('{')) {
              const parsed = JSON.parse(decoded)
              token = Array.isArray(parsed) ? parsed[0] : (parsed?.access_token || parsed?.token || null)
            } else {
              token = decoded
            }
          } catch {}
        }
      }
    }
  }

  if (!token) return null

  try {
    const { data, error } = await getAnonClient().auth.getUser(token)
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email }
  } catch {
    return null
  }
}

// Xác thực + xác minh caller có role 'admin' hoặc 'collab' từ CSDL hoặc có ADMIN_SECRET hợp lệ
// Tuyệt đối không hardcode email cá nhân để chống leo thang đặc quyền
export async function requireAdmin(request: Request): Promise<{ id: string; email?: string } | null> {
  // 1. Kiểm tra header bí mật ADMIN_SECRET cho các tác vụ server nội bộ
  const adminSecretHeader = request.headers.get('x-admin-secret')
  const envAdminSecret = process.env.ADMIN_SECRET
  if (
    adminSecretHeader &&
    envAdminSecret &&
    envAdminSecret.length >= 16 &&
    adminSecretHeader === envAdminSecret
  ) {
    return { id: 'system_admin', email: 'system@senexam.internal' }
  }

  // 2. Kiểm tra token Bearer của người dùng đăng nhập
  const user = await getUserFromRequest(request)
  if (!user) return null

  // 3. Tra cứu role thật sự từ CSDL bảng profiles (chỉ tin cậy role 'admin' hoặc 'collab')
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile ? (profile as any).role : undefined

  if (role === 'admin' || role === 'collab') {
    return user
  }

  return null
}
