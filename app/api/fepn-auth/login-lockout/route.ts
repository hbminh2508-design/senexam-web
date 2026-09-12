import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Bộ nhớ cache tạm trong bộ nhớ phòng trường hợp bảng database chưa chạy migration
const memoryLockoutStore = new Map<
  string,
  {
    failedCount: number
    lockLevel: number
    lockedUntil: number | null
    isPermanent: boolean
  }
>()

const LOCKOUT_TIERS: Record<number, number> = {
  1: 60, // 5 lần sai -> 1 phút (60s)
  2: 180, // 10 lần sai -> 3 phút (180s)
  3: 300, // 15 lần sai -> 5 phút (300s)
  4: 600, // 20 lần sai -> 10 phút (600s)
  5: 3600, // 25 lần sai -> 1 tiếng (3600s)
  6: 10800, // 30 lần sai -> 3 tiếng (10800s)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email hoặc MSSV không hợp lệ' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const nowMs = Date.now()

    // 1. KIỂM TRA TRẠNG THÁI KHÓA (CHECK)
    if (action === 'check') {
      let state = memoryLockoutStore.get(cleanEmail)

      // Cố gắng tra cứu từ Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data, error } = await supabaseAdmin
          .from('fepn_login_lockouts')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle()

        if (!error && data) {
          state = {
            failedCount: data.failed_count || 0,
            lockLevel: data.lock_level || 0,
            lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : null,
            isPermanent: Boolean(data.is_permanent_locked),
          }
          memoryLockoutStore.set(cleanEmail, state)
        }
      } catch (dbErr) {
        // Sử dụng memory store nếu bảng chưa được tạo
      }

      if (!state) {
        return NextResponse.json({
          isLocked: false,
          isPermanent: false,
          remainingSeconds: 0,
          failedCount: 0,
          lockLevel: 0,
        })
      }

      if (state.isPermanent) {
        return NextResponse.json({
          isLocked: true,
          isPermanent: true,
          remainingSeconds: 0,
          failedCount: state.failedCount,
          lockLevel: state.lockLevel,
          contactEmail: 'minhhb@senexam.me',
          message: 'Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng liên hệ với minhhb@senexam.me để được hỗ trợ mở khóa.',
        })
      }

      if (state.lockedUntil && state.lockedUntil > nowMs) {
        const remainingSeconds = Math.ceil((state.lockedUntil - nowMs) / 1000)
        return NextResponse.json({
          isLocked: true,
          isPermanent: false,
          remainingSeconds,
          failedCount: state.failedCount,
          lockLevel: state.lockLevel,
        })
      }

      // Đã hết thời gian khóa
      return NextResponse.json({
        isLocked: false,
        isPermanent: false,
        remainingSeconds: 0,
        failedCount: state.failedCount,
        lockLevel: state.lockLevel,
      })
    }

    // 2. GHI NHẬN LẦN NHẬP SAI (RECORD FAIL)
    if (action === 'record_fail') {
      let current = memoryLockoutStore.get(cleanEmail) || {
        failedCount: 0,
        lockLevel: 0,
        lockedUntil: null,
        isPermanent: false,
      }

      // Cố tra cứu db
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_login_lockouts')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle()
        if (data) {
          current = {
            failedCount: data.failed_count || 0,
            lockLevel: data.lock_level || 0,
            lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : null,
            isPermanent: Boolean(data.is_permanent_locked),
          }
        }
      } catch (e) {}

      if (current.isPermanent) {
        return NextResponse.json({
          isLocked: true,
          isPermanent: true,
          remainingSeconds: 0,
          failedCount: current.failedCount,
          lockLevel: current.lockLevel,
          contactEmail: 'minhhb@senexam.me',
        })
      }

      const newFailedCount = current.failedCount + 1
      let newLockLevel = current.lockLevel
      let newLockedUntil: number | null = null
      let isPermanent = false
      let lockDuration = 0

      // Cứ mỗi 5 lần sai -> tăng 1 bậc khóa
      if (newFailedCount % 5 === 0) {
        newLockLevel = Math.min(newLockLevel + 1, 7)

        if (newLockLevel >= 7 || newFailedCount > 30) {
          isPermanent = true
        } else {
          lockDuration = LOCKOUT_TIERS[newLockLevel] || 60
          newLockedUntil = nowMs + lockDuration * 1000
        }
      }

      const updatedState = {
        failedCount: newFailedCount,
        lockLevel: newLockLevel,
        lockedUntil: newLockedUntil,
        isPermanent,
      }
      memoryLockoutStore.set(cleanEmail, updatedState)

      // Lưu vào Supabase Database
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin.from('fepn_login_lockouts').upsert(
          {
            email: cleanEmail,
            failed_count: newFailedCount,
            lock_level: newLockLevel,
            locked_until: newLockedUntil ? new Date(newLockedUntil).toISOString() : null,
            is_permanent_locked: isPermanent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
      } catch (err) {
        console.warn('Cập nhật fepn_login_lockouts qua supabaseAdmin:', err)
      }

      const remainingAttemptsBeforeLock = 5 - (newFailedCount % 5 === 0 ? 5 : newFailedCount % 5)

      return NextResponse.json({
        success: true,
        failedCount: newFailedCount,
        lockLevel: newLockLevel,
        isLocked: isPermanent || (newLockedUntil !== null && newLockedUntil > nowMs),
        isPermanent,
        remainingSeconds: lockDuration,
        remainingAttemptsBeforeLock: isPermanent ? 0 : remainingAttemptsBeforeLock,
        contactEmail: isPermanent ? 'minhhb@senexam.me' : undefined,
      })
    }

    // 3. RESET KHI ĐĂNG NHẬP THÀNH CÔNG (RESET)
    if (action === 'reset') {
      memoryLockoutStore.delete(cleanEmail)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin.from('fepn_login_lockouts').upsert(
          {
            email: cleanEmail,
            failed_count: 0,
            lock_level: 0,
            locked_until: null,
            is_permanent_locked: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
      } catch (err) {
        console.warn('Reset fepn_login_lockouts qua supabaseAdmin:', err)
      }

      return NextResponse.json({ success: true, reset: true })
    }

    return NextResponse.json({ error: 'Hành động không được hỗ trợ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi login-lockout route:', err)
    return NextResponse.json({ error: err.message || 'Lỗi xử lý khóa tài khoản' }, { status: 500 })
  }
}
