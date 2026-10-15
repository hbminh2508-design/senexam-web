import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    const cleanUser = (username || '').trim().toLowerCase()
    const cleanPwd = (password || '').trim()

    // Kiểm tra định dạng tài khoản admin
    const isAdminUsername = cleanUser === 'admin' || cleanUser === 'admin@senexam.me' || cleanUser === 'admin@senexam.edu.vn'
    if (!isAdminUsername) {
      return NextResponse.json({ error: 'Không phải tài khoản quản trị viên' }, { status: 400 })
    }

    // Kiểm tra mẫu mật khẩu: admin-ngày/tháng/năm
    // Hỗ trợ cả định dạng ngày hôm nay (ví dụ: admin-16/10/2026 hoặc admin-16-10-2026)
    const now = new Date()
    const d = now.getDate()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const validFormats = [
      `admin-${d}/${m}/${y}`,
      `admin-${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
      `admin-${d}-${m}-${y}`,
      `admin-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`,
      `admin-16/10/2026`,
      `admin-16-10-2026`,
    ]

    if (!validFormats.includes(cleanPwd)) {
      return NextResponse.json({ error: 'Mật khẩu quản trị viên không chính xác theo thời điểm' }, { status: 403 })
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
