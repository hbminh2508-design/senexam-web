import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const serverSecret = process.env.ADMIN_SECRET
    if (!serverSecret || serverSecret.length < 16) {
      return NextResponse.json(
        { error: 'ADMIN_SECRET chưa được cấu hình an toàn trên máy chủ (yêu cầu tối thiểu 16 ký tự)' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { username, password, adminSecret } = body

    const authHeader = request.headers.get('x-admin-secret') || ''
    const providedSecret = (adminSecret || authHeader).trim()

    // Kiểm tra quyền: Bắt buộc khớp ADMIN_SECRET hoặc đã đăng nhập phiên Admin hợp lệ
    const authenticatedAdmin = await requireAdmin(request)
    const isSecretAuthorized = providedSecret === serverSecret

    if (!authenticatedAdmin && !isSecretAuthorized) {
      return NextResponse.json(
        { error: 'Từ chối truy cập: Khóa quản trị bí mật không chính xác hoặc chưa xác thực' },
        { status: 401 }
      )
    }

    const cleanUser = (username || '').trim().toLowerCase()
    const cleanPwd = (password || '').trim()

    // Kiểm tra định dạng tài khoản admin
    const isAdminUsername =
      cleanUser === 'admin' ||
      cleanUser === 'admin@senexam.me' ||
      cleanUser === 'admin@senexam.edu.vn'

    if (!isAdminUsername) {
      return NextResponse.json({ error: 'Không phải tài khoản quản trị viên hợp lệ' }, { status: 400 })
    }

    if (!cleanPwd || cleanPwd.length < 12) {
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên mới phải có độ dài tối thiểu 12 ký tự để đảm bảo an toàn' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const adminEmail = 'admin@senexam.me'

    // 1. Kiểm tra tài khoản đã tồn tại trong Auth chưa
    let adminUserId: string | null = null
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 })
    const existingAdmin = listData?.users?.find((u) => u.email?.toLowerCase() === adminEmail)

    if (existingAdmin) {
      adminUserId = existingAdmin.id
      // Đồng bộ mật khẩu mới nhất
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        password: cleanPwd,
        email_confirm: true,
        user_metadata: {
          full_name: 'SenExam System Administrator',
          role: 'admin',
        },
      })
    } else {
      // Tạo mới tài khoản admin
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: cleanPwd,
        email_confirm: true,
        user_metadata: {
          full_name: 'SenExam System Administrator',
          role: 'admin',
        },
      })
      if (createErr) throw createErr
      adminUserId = createData.user.id
    }

    // 2. Đảm bảo vai trò admin trong bảng profiles
    if (adminUserId) {
      await supabaseAdmin.from('profiles').upsert({
        id: adminUserId,
        email: adminEmail,
        full_name: 'SenExam System Administrator',
        role: 'admin',
        plan_tier: 'sen_one',
        sencash_balance: 999999,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Tài khoản admin đã được khởi tạo và đồng bộ thành công',
      email: adminEmail,
    })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/ensure-admin-account:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi đảm bảo tài khoản admin' },
      { status: 500 }
    )
  }
}
