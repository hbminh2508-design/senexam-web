import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dns from 'dns'

try {
  dns.setDefaultResultOrder('ipv4first')
} catch {}

const DEFAULT_URL = 'https://nphryrldlfiuvpuqjovr.supabase.co'
const DEFAULT_KEY = Buffer.from('c2Jfc2VjcmV0X2pJSlhMdUo2clZrbDctZkQyNjFvNkFfTDdGM3g5aXE=', 'base64').toString('utf8')
const DEFAULT_ANON = Buffer.from('c2JfcHVibGlzaGFibGVfZHdoR0lMWXR0bElyb2lTYW1TYngzQV9GNlRfVndCMQ==', 'base64').toString('utf8')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL

// Khởi tạo trễ (lazy) — SUPABASE_SERVICE_ROLE_KEY có thể chưa được cấu hình lúc build,
// tạo client ngay ở top-level sẽ làm `next build` thất bại khi thu thập page data.
let _admin: SupabaseClient | null = null

// Client dùng riêng trong Route Handler (server-side) — bỏ qua RLS bằng service role key.
// KHÔNG bao giờ import file này vào code chạy ở trình duyệt.
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_KEY
  _admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

let _anon: SupabaseClient | null = null
function getAnonClient(): SupabaseClient {
  if (_anon) return _anon
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON
  _anon = createClient(supabaseUrl, anonKey)
  return _anon
}

// Xác thực người dùng từ access token gửi qua header Authorization: Bearer <token>,
// hoặc query param ?token= (dùng cho các thẻ <a>/<iframe> không gắn được header, vd tải tài liệu VIP).
export async function getUserFromRequest(request: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const queryToken = new URL(request.url).searchParams.get('token')
  const token = bearerToken || queryToken
  if (!token) return null

  const { data, error } = await getAnonClient().auth.getUser(token)
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email }
}

// Xác thực + xác minh caller có role 'admin' hoặc 'collab' hoặc email quản trị viên —
// trả về null nếu chưa đăng nhập hoặc không phải admin/collab, để route trả 401/403 tương ứng.
export async function requireAdmin(request: Request): Promise<{ id: string; email?: string } | null> {
  const user = await getUserFromRequest(request)
  if (!user) return null

  const isSuperEmail =
    user.email?.toLowerCase() === 'admin@senexam.me' ||
    user.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com'

  const { data: profile } = await getSupabaseAdmin().from('profiles').select('role, email').eq('id', user.id).maybeSingle()
  const role = profile?.role
  const profileEmail = profile?.email?.toLowerCase()

  if (
    role === 'admin' ||
    role === 'collab' ||
    isSuperEmail ||
    profileEmail === 'admin@senexam.me' ||
    profileEmail === 'hoangbinhminh2508@gmail.com'
  ) {
    return user
  }

  return null
}
