import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerErr) throw callerErr
    const callerRole = callerProfile?.role
    if (callerRole !== 'admin' && callerRole !== 'collab') {
      return NextResponse.json({ error: 'Chỉ Quản trị viên (Admin) hoặc Cộng tác viên mới có quyền cấp tài khoản' }, { status: 403 })
    }

    const body = await request.json()
    const {
      email,
      password,
      fullName,
      role = 'student',
      phone = '',
      className = '',
      school = '',
      province = '',
      planTier = 'free',
      vipDays = 30,
      senCash = 0,
    } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Địa chỉ email không hợp lệ' }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải chứa ít nhất 6 ký tự' }, { status: 400 })
    }

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập họ và tên người dùng' }, { status: 400 })
    }

    const sanitizedEmail = email.trim().toLowerCase()

    // 1. Tạo tài khoản trong Auth qua Supabase Service Role (Tự động kích hoạt email_confirm)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone_number: phone?.trim() || '',
        phone: phone?.trim() || '',
        class_name: className?.trim() || '',
        school: school?.trim() || '',
        province: province?.trim() || '',
      },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Email này đã tồn tại trong hệ thống.' }, { status: 409 })
      }
      throw authError
    }

    const newUserId = authData.user.id

    // 2. Tính toán hạn mức VIP nếu có cấp gói
    let vipExpiresAt: string | null = null
    const validTiers = ['premium', 'premium_plus', 'sen_one', 'sen_one_lite']
    if (validTiers.includes(planTier) && Number(vipDays) > 0) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + Number(vipDays))
      vipExpiresAt = expDate.toISOString()
    }

    // 3. Cập nhật hồ sơ người dùng trong bảng profiles
    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: sanitizedEmail,
      full_name: fullName.trim(),
      role: ['student', 'teacher', 'collab', 'admin'].includes(role) ? role : 'student',
      phone_number: phone?.trim() || '',
      phone: phone?.trim() || '',
      class_name: className?.trim() || '',
      school: school?.trim() || '',
      province: province?.trim() || '',
      plan_tier: planTier,
      vip_expires_at: vipExpiresAt,
      created_at: new Date().toISOString(),
    }

    if (Number(senCash) > 0) {
      profilePayload.sencash_balance = Number(senCash)
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profilePayload)
    if (profileError) {
      console.warn('Lỗi cập nhật profile khi cấp tài khoản:', profileError)
    }

    // 4. Ghi log hành động cấp tài khoản của Admin
    try {
      await supabaseAdmin.from('admin_grants_log').insert({
        admin_id: caller.id,
        target_user_id: newUserId,
        kind: 'provision_account',
        amount: Number(vipDays) || 0,
        note: `Cấp tài khoản mới [${sanitizedEmail}] - Vai trò: ${role}, Gói: ${planTier}`,
      })
    } catch (logErr) {
      console.warn('Lỗi ghi admin_grants_log:', logErr)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: sanitizedEmail,
        fullName: fullName.trim(),
        role: profilePayload.role,
        planTier: profilePayload.plan_tier,
      },
    })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/provision-user:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi cấp tài khoản' },
      { status: 500 }
    )
  }
}
