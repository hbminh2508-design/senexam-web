import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

interface QrLoginRecord {
  id: string
  qr_token: string
  short_code: string
  verify_digit: string // Mã bảo mật kiểm chứng 2 số (chống phishing)
  status: 'pending' | 'awaiting_code' | 'approved' | 'expired' | 'rejected' | 'used'
  request_device_info: {
    browser: string
    os: string
    ip: string
    deviceType: string
    requestedAt: string
  }
  approved_by_user_id?: string
  user_email?: string
  auth_token_hash?: string
  completion_code?: string // Mã 6 số bảo mật 2 chiều (Challenge-Response)
  expires_at: number
  created_at: string
}

// In-memory store cho QR sessions
const memoryQrStore = new Map<string, QrLoginRecord>()

// In-memory rate limiting chống brute-force / dò mã 6 số
interface IpRateLimit {
  failedAttempts: number
  lockoutUntil: number
}
const ipRateLimitStore = new Map<string, IpRateLimit>()

function sanitizeKey(val: any): string {
  if (!val || typeof val !== 'string') return ''
  return val.replace(/[\s-]/g, '').trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, token, code, tokenOrCode, userId, userEmail, completionCode } = body

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    const nowMs = Date.now()

    // 1. TẠO MÃ QR ĐĂNG NHẬP MỚI (CREATE - Máy A)
    if (action === 'create') {
      const devInfo = body.deviceInfo || {}
      const browser = body.browser || devInfo.browser || 'Trình duyệt Web'
      const os = body.os || devInfo.os || 'Thiết bị'
      const deviceType = body.deviceType || devInfo.deviceType || 'desktop'

      const qrToken = `qr_${crypto.randomBytes(24).toString('hex')}`
      // Sinh mã 6 chữ số ngẫu nhiên dạng XXXXXX
      const shortCode = Math.floor(100000 + Math.random() * 900000).toString()
      // Sinh mã bảo mật kiểm chứng 2 số (Verification Digit) chống phishing từ xa
      const verifyDigit = Math.floor(10 + Math.random() * 90).toString()
      const expiresAt = nowMs + 3 * 60 * 1000 // Hết hạn sau 3 phút
      const nowIso = new Date().toISOString()

      const record: QrLoginRecord = {
        id: `qr-${Date.now()}`,
        qr_token: qrToken,
        short_code: shortCode,
        verify_digit: verifyDigit,
        status: 'pending',
        request_device_info: {
          browser,
          os,
          ip,
          deviceType,
          requestedAt: nowIso,
        },
        expires_at: expiresAt,
        created_at: nowIso,
      }

      memoryQrStore.set(qrToken, record)
      memoryQrStore.set(shortCode, record)

      // Cố lưu vào DB Supabase nếu đã có bảng fepn_qr_logins
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin.from('fepn_qr_logins').insert({
          qr_token: qrToken,
          short_code: shortCode,
          status: 'pending',
          request_device_info: {
            ...record.request_device_info,
            verify_digit: verifyDigit,
          },
          expires_at: new Date(expiresAt).toISOString(),
          created_at: nowIso,
        })
      } catch (e) {
        // Fallback in-memory
      }

      // Dữ liệu nhúng vào mã QR
      const qrPayload = JSON.stringify({
        app: 'fepn',
        type: 'qr_login',
        token: qrToken,
        code: shortCode,
        v: verifyDigit,
      })

      // Link QR server image an toàn
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
        qrPayload
      )}`

      return NextResponse.json({
        success: true,
        token: qrToken,
        shortCode,
        verifyDigit,
        expiresAt,
        expiresInSeconds: 180,
        qrImageUrl,
      })
    }

    // 2. MÁY A POLLING KIỂM TRA TRẠNG THÁI (CHECK)
    if (action === 'check') {
      const cleanToken = sanitizeKey(token)
      if (!cleanToken) {
        return NextResponse.json({ error: 'Thiếu mã QR token' }, { status: 400 })
      }

      let record = memoryQrStore.get(cleanToken)

      // Tra cứu Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_qr_logins')
          .select('*')
          .eq('qr_token', cleanToken)
          .maybeSingle()
        if (data) {
          record = {
            id: data.id,
            qr_token: data.qr_token,
            short_code: data.short_code,
            verify_digit: data.request_device_info?.verify_digit || record?.verify_digit || '',
            status: data.status,
            request_device_info: data.request_device_info,
            approved_by_user_id: data.approved_by_user_id,
            user_email: data.user_email || record?.user_email,
            auth_token_hash: data.auth_token_hash,
            completion_code: data.completion_code || record?.completion_code,
            expires_at: new Date(data.expires_at).getTime(),
            created_at: data.created_at,
          }
        }
      } catch (e) {}

      if (!record) {
        return NextResponse.json({ status: 'not_found' })
      }

      if (record.status === 'rejected') {
        memoryQrStore.delete(cleanToken)
        return NextResponse.json({ status: 'rejected', message: 'Yêu cầu đăng nhập đã bị từ chối bởi chủ tài khoản.' })
      }

      if (record.status === 'used') {
        return NextResponse.json({ status: 'used', message: 'Mã xác thực đã được sử dụng.' })
      }

      if (record.expires_at <= nowMs || record.status === 'expired') {
        record.status = 'expired'
        return NextResponse.json({ status: 'expired' })
      }

      // TRƯỜNG HỢP MÁY B ĐÃ DUYỆT VÀ CHỜ MÁY A NHẬP MÃ 6 SỐ XÁC THỰC
      if (record.status === 'awaiting_code') {
        return NextResponse.json({
          status: 'awaiting_code',
          deviceName: record.request_device_info?.browser
            ? `${record.request_device_info.browser} (${record.request_device_info.os})`
            : 'Thiết bị của bạn',
          remainingSeconds: Math.max(0, Math.ceil((record.expires_at - nowMs) / 1000)),
        })
      }

      // Trường hợp phê duyệt trực tiếp không qua mã 2 chiều (hoặc fallback cũ)
      if (record.status === 'approved') {
        const authTokenHash = record.auth_token_hash
        const approvedEmail = record.user_email

        record.status = 'used'
        record.auth_token_hash = undefined
        memoryQrStore.delete(record.qr_token)
        memoryQrStore.delete(record.short_code)

        try {
          const supabaseAdmin = getSupabaseAdmin()
          await supabaseAdmin
            .from('fepn_qr_logins')
            .update({ status: 'used', auth_token_hash: null })
            .eq('qr_token', cleanToken)
        } catch (e) {}

        return NextResponse.json({
          status: 'approved',
          authTokenHash,
          email: approvedEmail,
        })
      }

      return NextResponse.json({
        status: 'pending',
        remainingSeconds: Math.max(0, Math.ceil((record.expires_at - nowMs) / 1000)),
      })
    }

    // 3. MÁY B LẤY THÔNG TIN THIẾT BỊ MÁY A TRƯỚC KHI DUYỆT (GET INFO)
    if (action === 'get_info') {
      // Kiểm tra Rate Limit chống Brute-force / Dò mã 6 số
      const ipLimit = ipRateLimitStore.get(ip)
      if (ipLimit && ipLimit.lockoutUntil > nowMs) {
        const waitSec = Math.ceil((ipLimit.lockoutUntil - nowMs) / 1000)
        return NextResponse.json(
          {
            error: `Phát hiện nhiều lần nhập sai mã xác thực. Để đảm bảo an toàn, hệ thống tạm khóa tra cứu từ IP của bạn trong ${waitSec} giây.`,
          },
          { status: 429 }
        )
      }

      let rawKey = (tokenOrCode || token || code || '').trim()
      if (!rawKey) {
        return NextResponse.json({ error: 'Vui lòng nhập mã xác nhận 6 số' }, { status: 400 })
      }

      // Hỗ trợ nếu input là chuỗi JSON từ QR
      if (rawKey.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawKey)
          rawKey = parsed.token || parsed.code || rawKey
        } catch {}
      }

      const key = sanitizeKey(rawKey)
      if (!key) {
        return NextResponse.json({ error: 'Mã xác thực không hợp lệ' }, { status: 400 })
      }

      let record = memoryQrStore.get(key)

      try {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '')
        if (safeKey) {
          const supabaseAdmin = getSupabaseAdmin()
          const { data } = await supabaseAdmin
            .from('fepn_qr_logins')
            .select('*')
            .or(`qr_token.eq.${safeKey},short_code.eq.${safeKey}`)
            .maybeSingle()
          if (data) {
            record = {
              id: data.id,
              qr_token: data.qr_token,
              short_code: data.short_code,
              verify_digit: data.request_device_info?.verify_digit || record?.verify_digit || '',
              status: data.status,
              request_device_info: data.request_device_info,
              completion_code: data.completion_code || record?.completion_code,
              user_email: data.user_email || record?.user_email,
              expires_at: new Date(data.expires_at).getTime(),
              created_at: data.created_at,
            }
          }
        }
      } catch (e) {}

      if (!record) {
        const limit = ipRateLimitStore.get(ip) || { failedAttempts: 0, lockoutUntil: 0 }
        limit.failedAttempts += 1
        if (limit.failedAttempts >= 5) {
          limit.lockoutUntil = nowMs + 15 * 60 * 1000 // Khóa 15 phút nếu đoán sai 5 lần
        }
        ipRateLimitStore.set(ip, limit)
        const remainingTries = 5 - limit.failedAttempts

        return NextResponse.json(
          {
            error: `Mã xác thực không tồn tại hoặc đã hết hạn.${
              remainingTries > 0 ? ` Bạn còn ${remainingTries} lần thử trước khi bị tạm khóa.` : ''
            }`,
          },
          { status: 404 }
        )
      }

      // Xóa bộ đếm sai nếu tra cứu thành công
      ipRateLimitStore.delete(ip)

      if (record.expires_at <= nowMs || record.status === 'expired' || record.status === 'used') {
        return NextResponse.json({ error: 'Mã QR đã hết hạn hoặc đã được sử dụng trước đó (mỗi mã chỉ dùng 1 lần).' }, { status: 400 })
      }

      if (record.status === 'rejected') {
        return NextResponse.json({ error: 'Mã đăng nhập này đã bị từ chối truy cập.' }, { status: 400 })
      }

      if (record.status === 'awaiting_code' || record.status === 'approved') {
        return NextResponse.json({ error: 'Mã QR này đã được phê duyệt đăng nhập rồi.' }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        token: record.qr_token,
        shortCode: record.short_code,
        verifyDigit: record.verify_digit,
        deviceInfo: record.request_device_info,
        expiresInSeconds: Math.max(0, Math.ceil((record.expires_at - nowMs) / 1000)),
      })
    }

    // 4. MÁY B PHÊ DUYỆT ĐĂNG NHẬP (APPROVE) -> SINH MÃ BẢO MẬT 6 SỐ HOÀN TẤT
    if (action === 'approve') {
      const rawKey = (tokenOrCode || token || code || '').trim()
      const key = sanitizeKey(rawKey)
      if (!key || !userId || !userEmail) {
        return NextResponse.json({ error: 'Thiếu thông tin xác thực phê duyệt (mã hoặc thông tin tài khoản)' }, { status: 400 })
      }

      let record = memoryQrStore.get(key)

      try {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '')
        if (safeKey) {
          const supabaseAdmin = getSupabaseAdmin()
          const { data } = await supabaseAdmin
            .from('fepn_qr_logins')
            .select('*')
            .or(`qr_token.eq.${safeKey},short_code.eq.${safeKey}`)
            .maybeSingle()
          if (data) {
            record = {
              id: data.id,
              qr_token: data.qr_token,
              short_code: data.short_code,
              verify_digit: data.request_device_info?.verify_digit || record?.verify_digit || '',
              status: data.status,
              request_device_info: data.request_device_info,
              expires_at: new Date(data.expires_at).getTime(),
              created_at: data.created_at,
            }
          }
        }
      } catch (e) {}

      if (!record || record.expires_at <= nowMs) {
        return NextResponse.json({ error: 'Mã QR đã hết hạn hoặc không tồn tại.' }, { status: 400 })
      }

      if (record.status === 'used') {
        return NextResponse.json({ error: 'Mã QR này đã được sử dụng rồi (mỗi mã chỉ dùng 1 lần duy nhất).' }, { status: 400 })
      }

      if (record.status === 'rejected') {
        return NextResponse.json({ error: 'Yêu cầu đăng nhập này đã bị từ chối.' }, { status: 400 })
      }

      // SINH MÃ XÁC THỰC 6 SỐ TRẢ VỀ CHO MÁY B (CHALLENGE-RESPONSE)
      // Máy A bắt buộc phải nhập số này thì mới hoàn tất đăng nhập!
      const completionCode = Math.floor(100000 + Math.random() * 900000).toString()

      // Tạo Magiclink token hash cho user qua Supabase Admin SDK
      let authTokenHash = ''
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
        })
        if (linkErr) throw linkErr
        authTokenHash = linkData?.properties?.hashed_token || ''
      } catch (genErr: any) {
        console.warn('Lỗi sinh link đăng nhập QR:', genErr?.message)
        // Fallback tạo token bảo mật
        authTokenHash = crypto.randomBytes(32).toString('hex')
      }

      // Đổi trạng thái sang awaiting_code (Đang chờ Máy A nhập mã xác thực)
      record.status = 'awaiting_code'
      record.approved_by_user_id = userId
      record.user_email = userEmail
      record.auth_token_hash = authTokenHash
      record.completion_code = completionCode

      memoryQrStore.set(record.qr_token, record)
      memoryQrStore.set(record.short_code, record)

      // Cập nhật database Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_qr_logins')
          .update({
            status: 'awaiting_code',
            approved_by_user_id: userId,
            user_email: userEmail,
            auth_token_hash: authTokenHash,
            completion_code: completionCode,
          })
          .eq('qr_token', record.qr_token)
      } catch (e) {}

      return NextResponse.json({
        success: true,
        completionCode, // Mã 6 số để hiển thị trên màn hình Máy B
        targetDevice: record.request_device_info,
        message: 'Đã chấp thuận yêu cầu đăng nhập. Vui lòng nhập mã 6 số trên màn hình thiết bị bạn muốn đăng nhập.',
      })
    }

    // 5. MÁY A NHẬP MÃ 6 SỐ ĐỂ HOÀN TẤT ĐĂNG NHẬP (COMPLETE_LOGIN)
    if (action === 'complete_login') {
      const cleanToken = sanitizeKey(token)
      const cleanCode = sanitizeKey(completionCode || code)

      if (!cleanToken || !cleanCode) {
        return NextResponse.json({ error: 'Vui lòng nhập đầy đủ mã xác thực 6 số' }, { status: 400 })
      }

      let record = memoryQrStore.get(cleanToken)

      // Tra cứu Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_qr_logins')
          .select('*')
          .eq('qr_token', cleanToken)
          .maybeSingle()
        if (data) {
          record = {
            id: data.id,
            qr_token: data.qr_token,
            short_code: data.short_code,
            verify_digit: data.request_device_info?.verify_digit || record?.verify_digit || '',
            status: data.status,
            request_device_info: data.request_device_info,
            approved_by_user_id: data.approved_by_user_id,
            user_email: data.user_email || record?.user_email,
            auth_token_hash: data.auth_token_hash,
            completion_code: data.completion_code || record?.completion_code,
            expires_at: new Date(data.expires_at).getTime(),
            created_at: data.created_at,
          }
        }
      } catch (e) {}

      if (!record || record.expires_at <= nowMs) {
        return NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng làm mới mã QR.' }, { status: 400 })
      }

      if (record.status === 'used') {
        return NextResponse.json({ error: 'Phiên đăng nhập này đã được sử dụng rồi.' }, { status: 400 })
      }

      if (record.status !== 'awaiting_code') {
        return NextResponse.json(
          { error: 'Yêu cầu đăng nhập chưa được thiết bị kia phê duyệt hoặc đã bị hủy bỏ.' },
          { status: 400 }
        )
      }

      // KIỂM TRA MÃ 6 SỐ KHỚP VỚI MÃ MÁY B HIỂN THỊ
      if (!record.completion_code || record.completion_code !== cleanCode) {
        return NextResponse.json(
          { error: 'Mã số xác nhận không chính xác. Vui lòng kiểm tra lại 6 số trên màn hình thiết bị của bạn!' },
          { status: 400 }
        )
      }

      // Khớp mã thành công! Trả về authTokenHash & đánh dấu đã sử dụng (Single-Use)
      const authTokenHash = record.auth_token_hash
      const approvedEmail = record.user_email
      const approvedUserId = record.approved_by_user_id

      record.status = 'used'
      record.auth_token_hash = undefined
      record.completion_code = undefined
      memoryQrStore.delete(record.qr_token)
      memoryQrStore.delete(record.short_code)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_qr_logins')
          .update({ status: 'used', auth_token_hash: null, completion_code: null })
          .eq('qr_token', cleanToken)
      } catch (e) {}

      // Tự động ghi phiên thiết bị vào fepn_user_sessions
      try {
        if (approvedUserId && approvedEmail) {
          const supabaseAdmin = getSupabaseAdmin()
          const targetDev = record.request_device_info
          await supabaseAdmin.from('fepn_user_sessions').insert({
            user_id: approvedUserId,
            email: approvedEmail,
            device_id: `qr_dev_${Date.now()}`,
            device_name: `${targetDev?.browser || 'Trình duyệt'} trên ${targetDev?.os || 'Thiết bị'} (Đăng nhập bằng mã QR 2 chiều)`,
            browser: targetDev?.browser,
            os: targetDev?.os,
            ip_address: targetDev?.ip,
            device_type: targetDev?.deviceType || 'desktop',
            is_active: true,
            logged_in_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
          })
        }
      } catch (sessErr) {}

      return NextResponse.json({
        success: true,
        status: 'approved',
        authTokenHash,
        email: approvedEmail,
        message: 'Xác thực thành công!',
      })
    }

    // 6. MÁY B TỪ CHỐI ĐĂNG NHẬP (REJECT)
    if (action === 'reject') {
      const rawKey = (tokenOrCode || token || code || '').trim()
      const key = sanitizeKey(rawKey)
      let record = memoryQrStore.get(key)
      if (record) {
        record.status = 'rejected'
        record.auth_token_hash = undefined
        record.completion_code = undefined
        memoryQrStore.set(record.qr_token, record)
        memoryQrStore.set(record.short_code, record)
      }
      try {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '')
        if (safeKey) {
          const supabaseAdmin = getSupabaseAdmin()
          await supabaseAdmin
            .from('fepn_qr_logins')
            .update({ status: 'rejected', auth_token_hash: null, completion_code: null })
            .or(`qr_token.eq.${safeKey},short_code.eq.${safeKey}`)
        }
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'Đã từ chối và hủy bỏ yêu cầu đăng nhập này an toàn.',
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi qr-login route:', err)
    return NextResponse.json({ error: err.message || 'Lỗi xử lý đăng nhập QR' }, { status: 500 })
  }
}
