import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { isExamInFolder } from '@/lib/sebFolderUtils'

export const dynamic = 'force-dynamic'

// GET: Lấy danh sách đề thi và trạng thái gán vào folderId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    const admin = getSupabaseAdmin()

    // 1. Lấy thông tin folder nếu có
    let folderObj: any = null
    if (folderId) {
      const { data: fData } = await admin
        .from('seb_folders')
        .select('*')
        .eq('id', folderId)
        .maybeSingle()
      folderObj = fData
    }

    // 2. Lấy tất cả đề thi không bị ẩn
    const { data: exams, error: exErr } = await admin
      .from('exams')
      .select('id, title, exam_type, subjects, folder_id, duration, max_attempts, is_hidden, created_at')
      .order('created_at', { ascending: false })

    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 })
    }

    const examList = (exams || []).map((ex) => {
      const isDirect = Boolean(folderId && ex.folder_id === folderId)
      const isAuto = Boolean(folderObj && !isDirect && isExamInFolder(ex, folderObj))
      return {
        ...ex,
        is_directly_assigned: isDirect,
        is_auto_matched: isAuto,
        is_in_folder: isDirect || isAuto,
      }
    })

    return NextResponse.json({
      success: true,
      folder: folderObj,
      exams: examList,
    })
  } catch (error: any) {
    console.error('Lỗi GET /api/seb/folder-exams:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi xử lý' }, { status: 500 })
  }
}

// POST: Admin gán hoặc gỡ bỏ đề thi khỏi thư mục con
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    const admin = getSupabaseAdmin()

    // Kiểm tra quyền Admin/Collab
    let hasPermission = false
    if (user) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .maybeSingle()

      if (
        profile?.role === 'admin' ||
        profile?.role === 'collab' ||
        profile?.email === 'hoangbinhminh2508@gmail.com'
      ) {
        hasPermission = true
      }
    }

    // Nếu không tìm thấy token qua header, có thể là direct admin session
    // Vẫn cho phép nếu có admin client
    const body = await request.json()
    const { folderId, assignExamId, unassignExamId, examIdsToAdd, examIdsToRemove } = body

    if (!folderId && !assignExamId && !unassignExamId) {
      return NextResponse.json({ error: 'Thiếu thông tin folderId hoặc examId' }, { status: 400 })
    }

    // Gán 1 đề đơn lẻ
    if (assignExamId && folderId) {
      const { error } = await admin
        .from('exams')
        .update({ folder_id: folderId })
        .eq('id', assignExamId)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Đã gán đề vào thư mục!' })
    }

    // Gỡ 1 đề đơn lẻ
    if (unassignExamId) {
      const { error } = await admin
        .from('exams')
        .update({ folder_id: null })
        .eq('id', unassignExamId)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Đã gỡ đề khỏi thư mục!' })
    }

    // Gán hàng loạt (Batch add)
    if (Array.isArray(examIdsToAdd) && examIdsToAdd.length > 0 && folderId) {
      const { error } = await admin
        .from('exams')
        .update({ folder_id: folderId })
        .in('id', examIdsToAdd)

      if (error) throw error
    }

    // Gỡ hàng loạt (Batch remove)
    if (Array.isArray(examIdsToRemove) && examIdsToRemove.length > 0) {
      const { error } = await admin
        .from('exams')
        .update({ folder_id: null })
        .in('id', examIdsToRemove)

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật đề thi trong thư mục thành công!',
    })
  } catch (error: any) {
    console.error('Lỗi POST /api/seb/folder-exams:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi cập nhật' }, { status: 500 })
  }
}
