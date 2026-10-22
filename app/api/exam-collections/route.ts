import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import {
  getExamCollectionsAsync,
  saveExamCollectionAsync,
  deleteExamCollectionAsync,
  ExamCollection,
} from '@/lib/examCollectionStore'

export const dynamic = 'force-dynamic'

async function checkIsAdmin(request: Request, body?: any): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()

    // 1. Thử lấy từ Bearer token
    let userId: string | null = null
    let userEmail: string | null = null

    try {
      const tokenUser = await getUserFromRequest(request)
      if (tokenUser) {
        userId = tokenUser.id
        userEmail = tokenUser.email || null
      }
    } catch {
      // Bỏ qua lỗi token, fallback sang param
    }

    // 2. Fallback lấy từ body hoặc query nếu có
    if (!userId && body?.userId) userId = String(body.userId)
    if (!userEmail && body?.userEmail) userEmail = String(body.userEmail)

    try {
      const url = new URL(request.url)
      if (!userId && url.searchParams.get('userId')) userId = url.searchParams.get('userId')
      if (!userEmail && url.searchParams.get('userEmail')) userEmail = url.searchParams.get('userEmail')
    } catch {}

    if (!userId && !userEmail) return false

    // 3. Kiểm tra email đặc quyền siêu quản trị
    const isSuperAdminEmail =
      userEmail?.toLowerCase() === 'hoangbinhminh2508@gmail.com' ||
      userEmail?.toLowerCase() === 'admin@senexam.me'
    if (isSuperAdminEmail) return true

    // 4. Kiểm tra trong bảng profiles của Supabase
    if (userId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, email')
        .eq('id', userId)
        .maybeSingle()

      if (
        profile?.role === 'admin' ||
        profile?.role === 'collab' ||
        profile?.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com' ||
        profile?.email?.toLowerCase() === 'admin@senexam.me'
      ) {
        return true
      }
    }

    if (userEmail) {
      const { data: profileByEmail } = await admin
        .from('profiles')
        .select('role, email')
        .eq('email', userEmail)
        .maybeSingle()

      if (
        profileByEmail?.role === 'admin' ||
        profileByEmail?.role === 'collab'
      ) {
        return true
      }
    }

    return false
  } catch (err) {
    console.warn('Lỗi checkIsAdmin exam-collections:', err)
    return false
  }
}

// GET: Lấy danh sách toàn bộ các tuyển tập đề (online Supabase + fallback cục bộ)
export async function GET() {
  try {
    const collections = await getExamCollectionsAsync()
    return NextResponse.json({ success: true, collections })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi đọc tuyển tập đề' }, { status: 500 })
  }
}

// POST: Admin đóng gói hoặc cập nhật tuyển tập đề (lưu lên Supabase online)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const isAdmin = await checkIsAdmin(request, body)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới có quyền đóng gói tuyển tập đề' }, { status: 403 })
    }

    const { id, subject, title, description, exam_ids } = body

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập tên môn học cho tuyển tập' }, { status: 400 })
    }

    if (!Array.isArray(exam_ids) || exam_ids.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất 1 đề thi để đóng gói' }, { status: 400 })
    }

    const collections = await getExamCollectionsAsync()
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

    const updatedList = await saveExamCollectionAsync(updatedItem)

    return NextResponse.json({ success: true, collection: updatedItem, collections: updatedList })
  } catch (error: any) {
    console.error('Lỗi POST /api/exam-collections:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi lưu tuyển tập đề' }, { status: 500 })
  }
}

// DELETE: Admin giải tán / xoá tuyển tập đề (đồng bộ xoá trên Supabase online)
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

    const updatedList = await deleteExamCollectionAsync(id)

    return NextResponse.json({ success: true, collections: updatedList })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi xoá tuyển tập đề' }, { status: 500 })
  }
}
