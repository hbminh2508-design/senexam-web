import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET: Lấy danh sách cây thư mục mẹ - con SEB kèm số lượng đề thi
export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // 1. Lấy tất cả folders
    const { data: folders, error: fErr } = await admin
      .from('seb_folders')
      .select('*')
      .order('sort_order', { ascending: true })

    if (fErr) {
      console.warn('Lỗi lấy seb_folders:', fErr.message)
      // Fallback danh mục mặc định nếu chưa chạy SQL
      return NextResponse.json({
        success: true,
        folders: [
          {
            id: 'parent_thptqg',
            name: 'Thi Thử THPT Quốc Gia',
            parent_id: null,
            sort_order: 1,
            icon: 'award',
            children: [
              { id: 'child_thpt_vatly', name: 'Vật Lí Kỹ Thuật', parent_id: 'parent_thptqg', exam_count: 0 },
              { id: 'child_thpt_toanhoc', name: 'Toán Học Chuyên Sâu', parent_id: 'parent_thptqg', exam_count: 0 },
              { id: 'child_thpt_hoahoc', name: 'Hóa Học Đề Chuẩn', parent_id: 'parent_thptqg', exam_count: 0 },
            ],
          },
          {
            id: 'parent_dgnl',
            name: 'Kỳ Thi Đánh Giá Năng Lực & Tư Duy',
            parent_id: null,
            sort_order: 2,
            icon: 'shield-check',
            children: [
              { id: 'child_dgnl_hsa', name: 'ĐGNL ĐHQGHN (HSA)', parent_id: 'parent_dgnl', exam_count: 0 },
              { id: 'child_dgtd_tsa', name: 'ĐGTD Đại Học Bách Khoa (TSA)', parent_id: 'parent_dgnl', exam_count: 0 },
            ],
          },
        ],
      })
    }

    // 2. Lấy số lượng đề thi cho mỗi folder
    const { data: exams } = await admin
      .from('exams')
      .select('id, folder_id')

    const examCounts: Record<string, number> = {}
    ;(exams || []).forEach((ex) => {
      if (ex.folder_id) {
        examCounts[ex.folder_id] = (examCounts[ex.folder_id] || 0) + 1
      }
    })

    // 3. Phân tách thư mục Mẹ và Con
    const allFolders = folders || []
    const parents = allFolders.filter((f) => !f.parent_id)
    const tree = parents.map((parent) => {
      const children = allFolders
        .filter((c) => c.parent_id === parent.id)
        .map((child) => ({
          ...child,
          exam_count: examCounts[child.id] || 0,
        }))
      return {
        ...parent,
        children,
      }
    })

    return NextResponse.json({ success: true, folders: tree })
  } catch (error: any) {
    console.error('Lỗi API seb folders GET:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi tải danh mục thư mục SEB' }, { status: 500 })
  }
}

// POST: Admin Thêm / Sửa / Xóa thư mục SEB
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    const admin = getSupabaseAdmin()

    let isUserAdmin = false
    if (user?.id) {
      const { data: profile } = await admin.from('profiles').select('role, email').eq('id', user.id).maybeSingle()
      if (profile?.role === 'admin' || profile?.role === 'collab' || profile?.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com') {
        isUserAdmin = true
      }
    }

    const body = await request.json()
    const { action, folderId, name, parentId, sortOrder, icon, userRole, userEmail } = body

    if (userRole === 'admin' || userRole === 'collab' || userEmail?.toLowerCase() === 'hoangbinhminh2508@gmail.com') {
      isUserAdmin = true
    }

    if (!isUserAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền quản lý thư mục SEB!' }, { status: 403 })
    }

    if (action === 'delete') {
      if (!folderId) return NextResponse.json({ error: 'Thiếu folderId để xóa' }, { status: 400 })
      const { error } = await admin.from('seb_folders').delete().eq('id', folderId)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Đã xóa thư mục thành công' })
    }

    if (action === 'create') {
      if (!name?.trim()) return NextResponse.json({ error: 'Tên thư mục không được để trống' }, { status: 400 })
      const newId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const { data, error } = await admin.from('seb_folders').insert({
        id: newId,
        name: name.trim(),
        parent_id: parentId || null,
        sort_order: Number(sortOrder) || 0,
        icon: icon || (parentId ? 'folder' : 'layers'),
      }).select('*').single()

      if (error) throw error
      return NextResponse.json({ success: true, folder: data })
    }

    if (action === 'update') {
      if (!folderId) return NextResponse.json({ error: 'Thiếu folderId' }, { status: 400 })
      const { data, error } = await admin.from('seb_folders').update({
        name: name?.trim(),
        parent_id: parentId || null,
        sort_order: Number(sortOrder) || 0,
        icon: icon || 'folder',
      }).eq('id', folderId).select('*').single()

      if (error) throw error
      return NextResponse.json({ success: true, folder: data })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    console.error('Lỗi API seb folders POST:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi cập nhật thư mục SEB' }, { status: 500 })
  }
}
