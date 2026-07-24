import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const orderId = request.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Thiếu orderId' }, { status: 400 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data: order, error } = await supabaseAdmin.from('vip_orders').select('*').eq('id', orderId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order || order.user_id !== user.id) return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 })

  // Tự đánh dấu hết hạn nếu quá 15 phút mà chưa thanh toán, để UI không chờ vô thời hạn
  if (order.status === 'pending' && new Date(order.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('vip_orders').update({ status: 'expired' }).eq('id', order.id)
    order.status = 'expired'
  }

  return NextResponse.json({ order })
}
