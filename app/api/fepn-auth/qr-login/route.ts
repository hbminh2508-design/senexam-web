import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

interface QrLoginRecord {
  id: string
  qr_token: string
  short_code: string
  verify_digit: string // Mã bảo mật kiểm chứng 2 số (chống phishing)
  status: 'pending' | 'approved' | 'expired' | 'rejected' | 'used'
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, token, code, tokenOrCode, userId, userEmail, deviceName, browser, os, deviceType } = body

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    const nowMs = Date.now()

    // 1. TẠO MÃ QR ĐĂNG NHẬP MỚI (CREATE - Máy A)
    if (action === 'create') {
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
          browser: browser || 'Trình duyệt Web',
          os: os || 'Hệ điều hành',
          ip,
          deviceType: deviceType || 'desktop',
          requestedAt: nowIso,
        },
        expires_at: expiresAt,
        created_at: nowIso,
      }

      memoryQrStore.set(qrToken, record)
      memoryQrStore.set(shortCode, record)

      // Cố lưu vào DB Supabase
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
      } catch (e) {}

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
      if (!token) {
        return NextResponse.json({ error: 'Thiếu mã QR token' }, { status: 400 })
      }

      let record = memoryQrStore.get(token)

      // Tra cứu Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_qr_logins')
          .select('*')
          .eq('qr_token', token)
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
            auth_token_hash: data.auth_token_hash,
            expires_at: new Date(data.expires_at).getTime(),
            created_at: data.created_at,
          }
        }
      } catch (e) {}

      if (!record) {
        return NextResponse.json({ status: 'not_found' })
      }

      if (record.status === 'rejected') {
        memoryQrStore.delete(token)
        return NextResponse.json({ status: 'rejected', message: 'Yêu cầu đăng nhập đã bị từ chối bởi chủ tài khoản.' })
      }

      if (record.status === 'used') {
        return NextResponse.json({ status: 'used', message: 'Mã xác thực đã được sử dụng.' })
      }

      if (record.expires_at <= nowMs || record.status === 'expired') {
        record.status = 'expired'
        return NextResponse.json({ status: 'expired' })
      }

      if (record.status === 'approved') {
        const authTokenHash = record.auth_token_hash
        const approvedEmail = record.user_email

        // TIÊU CHUẨN SINGLE-USE BẢO MẬT CAO:
        // Hủy ngay lập tức mã token hash sau khi Máy A lấy thành công, chống replay attack
        record.status = 'used'
        record.auth_token_hash = undefined
        memoryQrStore.delete(record.qr_token)
        memoryQrStore.delete(record.short_code)

        try {
          const supabaseAdmin = getSupabaseAdmin()
          await supabaseAdmin
            .from('fepn_qr_logins')
            .update({ status: 'used', auth_token_hash: null })
            .eq('qr_token', token)
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

      const key = (tokenOrCode || token || code || '').trim()
      if (!key) {
        return NextResponse.json({ error: 'Vui lòng nhập mã xác nhận 6 số' }, { status: 400 })
      }

      let record = memoryQrStore.get(key)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_qr_logins')
          .select('*')
          .or(`qr_token.eq.${key},short_code.eq.${key}`)
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

      // Xóa bộ đếm sai nếu nhập đúng
      ipRateLimitStore.delete(ip)

      if (record.expires_at <= nowMs || record.status === 'expired' || record.status === 'used') {
        return NextResponse.json({ error: 'Mã QR đã hết hạn hoặc đã được sử dụng trước đó (mỗi mã chỉ dùng 1 lần).' }, { status: 400 })
      }

      if (record.status === 'rejected') {
        return NextResponse.json({ error: 'Mã đăng nhập này đã bị từ chối truy cập.' }, { status: 400 })
      }

      if (record.status === 'approved') {
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

    // 4. MÁY B PHÊ DUYỆT ĐĂNG NHẬP (APPROVE)
    if (action === 'approve') {
      const key = (tokenOrCode || token || code || '').trim()
      if (!key || !userId || !userEmail) {
        return NextResponse.json({ error: 'Thiếu thông tin xác thực phê duyệt' }, { status: 400 })
      }

      let record = memoryQrStore.get(key)

      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin
          .from('fepn_qr_logins')
          .select('*')
          .or(`qr_token.eq.${key},short_code.eq.${key}`)
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
      } catch (e) {}

      if (!record || record.expires_at <= nowMs) {
        return NextResponse.json({ error: 'Mã QR đã hết hạn hoặc không hợp lệ.' }, { status: 400 })
      }

      if (record.status === 'approved' || record.status === 'used') {
        return NextResponse.json({ error: 'Mã QR này đã được sử dụng rồi (mỗi mã chỉ dùng 1 lần duy nhất).' }, { status: 400 })
      }

      if (record.status === 'rejected') {
        return NextResponse.json({ error: 'Yêu cầu đăng nhập này đã bị từ chối.' }, { status: 400 })
      }

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

      record.status = 'approved'
      record.approved_by_user_id = userId
      record.user_email = userEmail
      record.auth_token_hash = authTokenHash

      memoryQrStore.set(record.qr_token, record)
      memoryQrStore.set(record.short_code, record)

      // Cập nhật database Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_qr_logins')
          .update({
            status: 'approved',
            approved_by_user_id: userId,
            user_email: userEmail,
            auth_token_hash: authTokenHash,
          })
          .eq('qr_token', record.qr_token)
      } catch (e) {}

      // Tự động ghi phiên thiết bị được cấp quyền vào bảng session log
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const targetDev = record.request_device_info
        await supabaseAdmin.from('fepn_user_sessions').insert({
          user_id: userId,
          email: userEmail,
          device_id: `qr_dev_${Date.now()}`,
          device_name: `${targetDev?.browser || 'Trình duyệt'} trên ${targetDev?.os || 'Thiết bị'} (Đăng nhập qua mã QR)`,
          browser: targetDev?.browser,
          os: targetDev?.os,
          ip_address: targetDev?.ip,
          device_type: targetDev?.deviceType || 'desktop',
          is_active: true,
          logged_in_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        })
      } catch (sessErr) {}

      return NextResponse.json({
        success: true,
        message: '🎉 Phê duyệt đăng nhập thành công!',
        targetDevice: record.request_device_info,
      })
    }

    // 5. MÁY B TỪ CHỐI ĐĂNG NHẬP (REJECT)
    if (action === 'reject') {
      const key = (tokenOrCode || token || code || '').trim()
      let record = memoryQrStore.get(key)
      if (record) {
        record.status = 'rejected'
        record.auth_token_hash = undefined
        memoryQrStore.set(record.qr_token, record)
        memoryQrStore.set(record.short_code, record)
      }
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('fepn_qr_logins')
          .update({ status: 'rejected', auth_token_hash: null })
          .or(`qr_token.eq.${key},short_code.eq.${key}`)
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
