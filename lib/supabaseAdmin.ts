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
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const queryToken = new URL(request.url).searchParams.get('token')
  let token = bearerToken || queryToken

  // Fallback: Kiểm tra cookie xác thực nếu không có header Authorization (hỗ trợ Safari / cookie session)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    const match = cookieHeader.match(/sb-[a-zA-Z0-9_-]+-auth-token=([^;]+)/) ||
                  cookieHeader.match(/sb-access-token=([^;]+)/)
    if (match) {
      try {
        const raw = decodeURIComponent(match[match.length - 1])
        if (raw.startsWith('[') || raw.startsWith('{')) {
          const parsed = JSON.parse(raw)
          token = Array.isArray(parsed) ? parsed[0] : (parsed?.access_token || parsed?.token || null)
        } else {
          token = raw
        }
      } catch {}
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
