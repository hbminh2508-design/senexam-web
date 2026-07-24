import { supabase } from '@/lib/supabaseClient'
import pkg from '@/package.json'

export type ReleaseChannel = 'stable' | 'beta'

export type SystemRelease = {
  id: number
  // Kênh Chính thức — mọi người dùng đều thấy khi stable_published = true
  stable_version: string
  stable_changelog: string
  stable_published: boolean
  // Kênh Beta — chỉ người dùng đã tham gia Beta (profiles.is_beta_tester) mới thấy
  beta_version: string
  beta_changelog: string
  beta_published: boolean
  updated_by: string | null
  updated_at: string
}

export type ReleaseLogAction = 'set_version' | 'enable_test' | 'disable_test' | 'publish_stable' | 'publish_beta'

export const CURRENT_APP_VERSION = pkg.version as string
const ACK_VERSION_KEY = 'senexam_ack_version'

export async function fetchSystemRelease(): Promise<SystemRelease | null> {
  const { data, error } = await supabase.from('system_release').select('*').eq('id', 1).single()
  if (error) return null
  return data as SystemRelease
}

export async function logReleaseAction(action: ReleaseLogAction, version?: string, note?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('release_log').insert({
    actor_id: user?.id ?? null,
    action,
    version: version ?? null,
    note: note ?? null,
  })
}

// So sánh 2 chuỗi semver dạng "x.y.z" — trả về true nếu `latest` mới hơn `current`
export function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split('.').map(n => parseInt(n, 10) || 0)
  const l = latest.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const a = l[i] ?? 0
    const b = c[i] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

// Trình duyệt SPA không tự "đổi mã nguồn" chỉ bằng 1 nút bấm — bản build thật vẫn qua
// git push/deploy như bình thường. Để tránh banner "Có bản cập nhật" lặp lại vô hạn khi
// build thật chưa kịp lên (hoặc trong môi trường dev), ta ghi nhớ phiên bản người dùng đã
// bấm "Cập nhật ngay" gần nhất — nếu trùng bản đang công bố thì coi như đã cập nhật.
export function getAckedVersion(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACK_VERSION_KEY)
}

export function ackVersion(version: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACK_VERSION_KEY, version)
}
