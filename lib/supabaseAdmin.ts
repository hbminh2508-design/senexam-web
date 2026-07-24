import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Khởi tạo trễ (lazy) — SUPABASE_SERVICE_ROLE_KEY có thể chưa được cấu hình lúc build,
// tạo client ngay ở top-level sẽ làm `next build` thất bại khi thu thập page data.
let _admin: SupabaseClient | null = null

// Client dùng riêng trong Route Handler (server-side) — bỏ qua RLS bằng service role key.
// KHÔNG bao giờ import file này vào code chạy ở trình duyệt.
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY trong biến môi trường')
  _admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _admin
}

let _anon: SupabaseClient | null = null
function getAnonClient(): SupabaseClient {
  if (_anon) return _anon
  _anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  return _anon
}

// Xác thực người dùng từ access token gửi qua header Authorization: Bearer <token>,
// hoặc query param ?token= (dùng cho các thẻ <a>/<iframe> không gắn được header, vd tải tài liệu VIP).
export async function getUserFromRequest(request: Request): Promise<{ id: string } | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const queryToken = new URL(request.url).searchParams.get('token')
  const token = bearerToken || queryToken
  if (!token) return null

  const { data, error } = await getAnonClient().auth.getUser(token)
  if (error || !data?.user) return null
  return { id: data.user.id }
}
