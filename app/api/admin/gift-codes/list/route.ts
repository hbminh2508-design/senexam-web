import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('gift_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data || [] })
}
