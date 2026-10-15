import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const MAX_BATCH_SIZE = 150

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
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên (Admin) hoặc Cộng tác viên mới có quyền cấp tài khoản hàng loạt' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      prefix = 'student',
      startNum = 1,
      endNum = 10,
      padLength = 4,
      domain = '@senexam.edu.vn',
      passwordMode = 'common',
      commonPassword = '',
      namePattern = 'Học sinh [num]',
      role = 'student',
      className = '',
      school = '',
      province = '',
      planTier = 'free',
      vipDays = 30,
      senCash = 0,
    } = body

    const start = Math.max(0, parseInt(String(startNum), 10) || 0)
    const end = Math.max(start, parseInt(String(endNum), 10) || start)
    const totalCount = end - start + 1

    if (totalCount <= 0) {
      return NextResponse.json({ error: 'Dải số bắt đầu và kết thúc không hợp lệ' }, { status: 400 })
    }

    if (totalCount > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Số lượng tài khoản mỗi lượt cấp tối đa là ${MAX_BATCH_SIZE} tài khoản (bạn đang yêu cầu ${totalCount})` },
        { status: 400 }
      )
    }

    // Xử lý domain suffix
    let cleanDomain = (domain || '').trim()
    if (cleanDomain && !cleanDomain.startsWith('@')) {
      cleanDomain = '@' + cleanDomain
    }
    if (!cleanDomain) {
      cleanDomain = '@senexam.edu.vn'
    }

    // VIP Expiration
    let vipExpiresAt: string | null = null
    const validTiers = ['premium', 'premium_plus', 'sen_one', 'sen_one_lite']
    if (validTiers.includes(planTier) && Number(vipDays) > 0) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + Number(vipDays))
      vipExpiresAt = expDate.toISOString()
    }

    const pad = Math.min(6, Math.max(0, parseInt(String(padLength), 10) || 0))
    const results: Array<{
      email: string
      password: string
      fullName: string
      id?: string
      success: boolean
      error?: string
    }> = []

    for (let current = start; current <= end; current++) {
      const numStr = pad > 0 ? String(current).padStart(pad, '0') : String(current)
      const userPrefix = (prefix || '').trim()
      const userEmail = `${userPrefix}${numStr}${cleanDomain}`.toLowerCase()
      const userFullName = (namePattern || 'Học sinh [num]').replace(/\[num\]/g, numStr).trim()

      let userPassword = ''
      if (passwordMode === 'pattern') {
        userPassword = `Sen@${numStr}${String(new Date().getFullYear())}`
      } else if (passwordMode === 'random') {
        userPassword = `Sen#${Math.random().toString(36).substring(2, 8)}${numStr}`
      } else {
        userPassword = commonPassword?.trim() || `SenExam@${numStr}`
      }

      if (userPassword.length < 6) {
        userPassword = `SenExam@${numStr}`
      }

      try {
        // Tạo tài khoản Auth qua Service Role
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: userPassword,
          email_confirm: true,
          user_metadata: {
            full_name: userFullName,
            class_name: className?.trim() || '',
            school: school?.trim() || '',
            province: province?.trim() || '',
            provisioned_by: caller.id,
          },
        })

        if (authErr) {
          if (authErr.message.includes('already registered')) {
            results.push({
              email: userEmail,
              password: userPassword,
              fullName: userFullName,
              success: false,
              error: 'Email đã tồn tại',
            })
            continue
          }
          throw authErr
        }

        const newId = authData.user.id

        // Tạo hồ sơ trong profiles
        const profilePayload: Record<string, any> = {
          id: newId,
          email: userEmail,
          full_name: userFullName,
          role: ['student', 'teacher', 'collab', 'admin'].includes(role) ? role : 'student',
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

        await supabaseAdmin.from('profiles').upsert(profilePayload)

        results.push({
          email: userEmail,
          password: userPassword,
          fullName: userFullName,
          id: newId,
          success: true,
        })
      } catch (err: any) {
        results.push({
          email: userEmail,
          password: userPassword,
          fullName: userFullName,
          success: false,
          error: err instanceof Error ? err.message : 'Lỗi tạo tài khoản',
        })
      }
    }

    const createdCount = results.filter((r) => r.success).length
    const failedCount = results.length - createdCount

    // Ghi log vào admin_grants_log
    try {
      await supabaseAdmin.from('admin_grants_log').insert({
        admin_id: caller.id,
        kind: 'batch_provision_accounts',
        amount: createdCount,
        note: `Cấp hàng loạt [${prefix}${start} - ${end}${cleanDomain}]: ${createdCount} thành công, ${failedCount} lỗi. Gói: ${planTier}`,
      })
    } catch (logErr) {
      console.warn('Lỗi ghi admin_grants_log cho batch:', logErr)
    }

    return NextResponse.json({
      success: true,
      totalRequested: totalCount,
      createdCount,
      failedCount,
      users: results,
    })
  } catch (err: any) {
    console.error('Lỗi API /api/admin/provision-users-batch:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi máy chủ khi cấp tài khoản hàng loạt' },
      { status: 500 }
    )
  }
}
