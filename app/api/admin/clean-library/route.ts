import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    const body = await request.json().catch(() => ({}))
    const confirmCode = body.confirmCode

    const supabaseAdmin = getSupabaseAdmin()

    // Cho phép nếu là Admin đăng nhập HOẶC gửi mã xác nhận bảo mật
    let isAuthorized = false
    if (confirmCode === 'CONFIRM_CLEAN_SENEXAM_LIBRARY_2026') {
      isAuthorized = true
    } else if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role === 'admin') {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Không có quyền thực hiện thao tác này' }, { status: 403 })
    }

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

    // 🔒 TUYỆT ĐỐI KHÔNG ĐỤNG ĐẾN: fepn_subjects, fepn_materials, exams, profiles

    return NextResponse.json({
      success: true,
      message: 'Đã quét sạch toàn bộ dữ liệu thư viện cũ thành công! TSV.FEPN được giữ nguyên 100%.',
      deletedDocuments: docCount || 0,
      deletedFolders: folderCount || 0,
    })
  } catch (err: any) {
    console.error('Lỗi clean library:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý hệ thống' }, { status: 500 })
  }
}
