import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'
import { extendVipExpiry } from '@/lib/vipMembership'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })

    const body = await request.json()
    const { action, userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Phân quyền vai trò người dùng (role)
    if (action === 'update_role') {
      const { role } = body
      const validRoles = ['student', 'teacher', 'collab', 'admin']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 })
      }

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (updateErr) throw updateErr

      // Ghi log quản trị
      await supabaseAdmin.from('admin_grants_log').insert({
        admin_id: admin.id,
        target_user_id: userId,
        kind: 'role_change',
        amount: 0,
        note: `Đổi vai trò thành ${role}`,
      }).catch(() => {})

      return NextResponse.json({ success: true, message: `Đã cập nhật vai trò thành công: ${role}` })
    }

    // 2. Chỉnh sửa số dư SenCash (cộng hoặc trừ)
    if (action === 'set_sencash' || action === 'adjust_sencash') {
      const { amount, delta, note } = body
      let newBalance: number | null = null

      if (action === 'set_sencash') {
        const val = parseInt(amount, 10)
        if (!Number.isFinite(val) || val < 0) {
          return NextResponse.json({ error: 'Số dư SenCash không hợp lệ' }, { status: 400 })
        }
        newBalance = val
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({ sencash_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (updateErr) throw updateErr
      } else {
        const d = parseInt(delta, 10)
        if (!Number.isFinite(d)) {
          return NextResponse.json({ error: 'Mức thay đổi SenCash không hợp lệ' }, { status: 400 })
        }
        const { data: profile } = await supabaseAdmin.from('profiles').select('sencash_balance').eq('id', userId).maybeSingle()
        const current = Number(profile?.sencash_balance) || 0
        newBalance = Math.max(0, current + d)
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({ sencash_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (updateErr) throw updateErr
      }

      await supabaseAdmin.from('admin_grants_log').insert({
        admin_id: admin.id,
        target_user_id: userId,
        kind: 'sencash_set',
        amount: newBalance,
        note: note || `Cập nhật số dư SenCash thành ${newBalance}`,
      }).catch(() => {})

      return NextResponse.json({ success: true, balance: newBalance })
    }

    // 3. Cấp hoặc thu hồi gói Sen VIP / Hạn mức
    if (action === 'update_plan') {
      const { planTier, days, removeVip } = body
      if (removeVip) {
        await supabaseAdmin
          .from('profiles')
          .update({ plan_tier: 'free', vip_expires_at: null, updated_at: new Date().toISOString() })
          .eq('id', userId)
        return NextResponse.json({ success: true, message: 'Đã thu hồi gói VIP thành công' })
      }

      const daysNum = parseInt(days, 10) || 30
      const tier = planTier || 'premium'
      const newExpiresAt = extendVipExpiry(null, daysNum)

      await supabaseAdmin
        .from('profiles')
        .update({ plan_tier: tier, vip_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
        .eq('id', userId)

      await supabaseAdmin.from('admin_grants_log').insert({
        admin_id: admin.id,
        target_user_id: userId,
        kind: 'vip_update',
        amount: daysNum,
        note: `Cấp gói ${tier} (${daysNum} ngày)`,
      }).catch(() => {})

      return NextResponse.json({ success: true, vipExpiresAt: newExpiresAt })
    }

    // 4. Đặt lại mật khẩu trực tiếp cho học sinh (không cần gửi email xác nhận)
    if (action === 'reset_password') {
      const { newPassword } = body
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 })
      }

      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      })

      if (resetErr) throw resetErr

      return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu tài khoản thành công!' })
    }

    // 5. Khóa hoặc Mở khóa tài khoản người dùng
    if (action === 'toggle_ban') {
      const { isBanned, banReason } = body
      // Đặt ban duration hoặc metadata
      const banDuration = isBanned ? '876000h' : 'none' // 100 năm hoặc gỡ khóa
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
        user_metadata: { is_banned: !!isBanned, ban_reason: banReason || null },
      })

      if (banErr) throw banErr

      await supabaseAdmin
        .from('profiles')
        .update({ is_banned: !!isBanned, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .catch(() => {})

      return NextResponse.json({
        success: true,
        message: isBanned ? 'Đã khóa tài khoản thành công' : 'Đã mở khóa tài khoản thành công',
      })
    }

    // 6. Xóa vĩnh viễn tài khoản người dùng
    if (action === 'delete_user') {
      // Xóa trong Auth
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (delAuthErr) throw delAuthErr

      // Xóa trong profiles và bảng liên quan
      await supabaseAdmin.from('profiles').delete().eq('id', userId).catch(() => {})

      return NextResponse.json({ success: true, message: 'Đã xóa vĩnh viễn tài khoản người dùng' })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/users/action:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý yêu cầu quản trị viên' },
      { status: 500 }
    )
  }
}
