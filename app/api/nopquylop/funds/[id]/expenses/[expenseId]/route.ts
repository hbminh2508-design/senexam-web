import { NextResponse } from 'next/server'
import { deleteExpenseFromFund, getFundById, isValidAdminDailyPassword } from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: fundId, expenseId } = await params
    const body = await request.json().catch(() => ({}))
    const { adminUsername, adminPassword } = body

    const fund = await getFundById(fundId)
    const username = String(adminUsername || '').trim().toLowerCase()
    const password = String(adminPassword || '').trim()
    const isAdmin = username === 'admin' && isValidAdminDailyPassword(password)
    const isTreasurer = ['thuquy', 'thủ quỹ', 'treasurer'].includes(username) && Boolean(fund?.adminPasscode) && password === fund?.adminPasscode

    if (!isAdmin && !isTreasurer) {
      return NextResponse.json(
        { error: 'Chỉ Admin hoặc Thủ quỹ mới được xóa bill.' },
        { status: 401 }
      )
    }

    const expense = fund?.expenses?.find((item) => item.id === expenseId)

    const res = await deleteExpenseFromFund(fundId, expenseId)
    if (!res.success) {
      return NextResponse.json({ error: 'Không thể xóa khoản chi này' }, { status: 500 })
    }

    if (expense?.billImageUrl) {
      try {
        const marker = '/storage/v1/object/public/nopquylop-bills/'
        const markerIndex = expense.billImageUrl.indexOf(marker)
        if (markerIndex >= 0) {
          const path = decodeURIComponent(expense.billImageUrl.slice(markerIndex + marker.length))
          await getSupabaseAdmin().storage.from('nopquylop-bills').remove([path])
        }
      } catch (storageError) {
        console.warn('Không thể xóa ảnh bill trên Supabase Storage:', storageError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa khoản chi thành công và hoàn lại số dư quỹ!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi xử lý xóa khoản chi' }, { status: 500 })
  }
}
