import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getExamCollections, saveExamCollections, ExamCollection } from '@/lib/examCollectionStore'

export const dynamic = 'force-dynamic'

async function checkIsAdmin(request: Request): Promise<boolean> {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return false
    const admin = getSupabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()

    const metaRole = (user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase().trim()
    return (
      profile?.role === 'admin' ||
      profile?.role === 'collab' ||
      metaRole === 'admin' ||
      metaRole === 'collab' ||
      profile?.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com' ||
      user.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com'
    )
  } catch {
    return false
  }
}

// GET: Lấy danh sách toàn bộ các tuyển tập đề
export async function GET() {
  try {
    const collections = getExamCollections()
    return NextResponse.json({ success: true, collections })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi đọc tuyển tập đề' }, { status: 500 })
  }
}

// POST: Admin đóng gói hoặc cập nhật tuyển tập đề
export async function POST(request: Request) {
  try {
    const isAdmin = await checkIsAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới có quyền đóng gói tuyển tập đề' }, { status: 403 })
    }

    const body = await request.json()
    const { id, subject, title, description, exam_ids } = body

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập tên môn học cho tuyển tập' }, { status: 400 })
    }

    if (!Array.isArray(exam_ids) || exam_ids.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất 1 đề thi để đóng gói' }, { status: 400 })
    }

    const collections = getExamCollections()
    const cleanSubject = subject.trim()
    const cleanTitle = (title && title.trim()) || `Tuyển tập đề ${cleanSubject}`
    const collectionId = id || `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const existingIndex = collections.findIndex((c) => c.id === collectionId)

    const updatedItem: ExamCollection = {
      id: collectionId,
      subject: cleanSubject,
      title: cleanTitle,
      description: description?.trim() || `Tổng hợp các đề thi chất lượng môn ${cleanSubject}`,
      exam_ids: Array.from(new Set(exam_ids)),
      created_at: existingIndex >= 0 ? collections[existingIndex].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      collections[existingIndex] = updatedItem
    } else {
      collections.unshift(updatedItem)
    }

    saveExamCollections(collections)

    return NextResponse.json({ success: true, collection: updatedItem, collections })
  } catch (error: any) {
    console.error('Lỗi POST /api/exam-collections:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi lưu tuyển tập đề' }, { status: 500 })
  }
}

// DELETE: Admin giải tán / xoá tuyển tập đề (đề thi sẽ trở lại danh sách gốc)
export async function DELETE(request: Request) {
  try {
    const isAdmin = await checkIsAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới có quyền xoá tuyển tập đề' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã tuyển tập đề cần xoá' }, { status: 400 })
    }

    let collections = getExamCollections()
    collections = collections.filter((c) => c.id !== id)
    saveExamCollections(collections)

    return NextResponse.json({ success: true, collections })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi xoá tuyển tập đề' }, { status: 500 })
  }
}
