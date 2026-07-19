import { supabase } from '@/lib/supabaseClient'
import pkg from '@/package.json'

export type SystemRelease = {
  id: number
  latest_version: string
  changelog: string
  is_published: boolean
  updated_by: string | null
  updated_at: string
}

export type ReleaseLogAction = 'set_version' | 'enable_test' | 'disable_test' | 'publish'

export const CURRENT_APP_VERSION = pkg.version as string

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
