import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Không có quyền thực hiện thao tác này' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const confirmCode = body.confirmCode

    // Bắt buộc cả quyền Quản trị viên VÀ mã xác thực phòng ngừa thao tác nhầm
    if (confirmCode !== 'CONFIRM_CLEAN_SENEXAM_LIBRARY_2026') {
      return NextResponse.json(
        { error: 'Mã xác nhận bảo mật thao tác dọn thư viện không chính xác' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Quét sạch bảng library_documents (Tài liệu thư viện cũ)
    const { count: docCount, error: docError } = await supabaseAdmin
      .from('library_documents')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (docError) {
      console.error('Lỗi xóa library_documents:', docError)
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    // 2. Quét sạch bảng library_folders (Cây thư mục cũ)
    const { count: folderCount, error: folderError } = await supabaseAdmin
      .from('library_folders')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (folderError) {
      console.error('Lỗi xóa library_folders:', folderError)
      return NextResponse.json({ error: folderError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp sạch toàn bộ thư viện: xóa ${docCount || 0} tài liệu và ${folderCount || 0} thư mục cũ.`,
      deletedDocuments: docCount || 0,
      deletedFolders: folderCount || 0,
    })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/clean-library:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi dọn thư viện' },
      { status: 500 }
    )
  }
}
