import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

interface QrLoginRecord {
  id: string
  qr_token: string
  short_code: string
  status: 'pending' | 'approved' | 'expired'
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

const memoryQrStore = new Map<string, QrLoginRecord>()

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
      // Sinh mã 6 chữ số ngẫu nhiên dạng XXX-XXX
      const shortCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = nowMs + 3 * 60 * 1000 // Hết hạn sau 3 phút
      const nowIso = new Date().toISOString()

      const record: QrLoginRecord = {
        id: `qr-${Date.now()}`,
        qr_token: qrToken,
        short_code: shortCode,
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
          request_device_info: record.request_device_info,
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
      })

      // Link QR server image an toàn, không phụ thuộc package ngoài
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
        qrPayload
      )}`

      return NextResponse.json({
        success: true,
        token: qrToken,
        shortCode,
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

      if (record.expires_at <= nowMs) {
        record.status = 'expired'
        return NextResponse.json({ status: 'expired' })
      }

      if (record.status === 'approved') {
        return NextResponse.json({
          status: 'approved',
          authTokenHash: record.auth_token_hash,
          email: record.user_email,
        })
      }

      return NextResponse.json({
        status: 'pending',
        remainingSeconds: Math.max(0, Math.ceil((record.expires_at - nowMs) / 1000)),
      })
    }

    // 3. MÁY B LẤY THÔNG TIN THIẾT BỊ MÁY A TRƯỚC KHI DUYỆT (GET INFO)
    if (action === 'get_info') {
      const key = (tokenOrCode || token || code || '').trim()
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
            status: data.status,
            request_device_info: data.request_device_info,
            expires_at: new Date(data.expires_at).getTime(),
            created_at: data.created_at,
          }
        }
      } catch (e) {}

      if (!record) {
        return NextResponse.json({ error: 'Mã QR hoặc mã xác nhận không tồn tại hoặc đã hết hạn.' }, { status: 404 })
      }

      if (record.expires_at <= nowMs || record.status === 'expired') {
        return NextResponse.json({ error: 'Mã QR đã hết hạn (chỉ có hiệu lực trong 3 phút).' }, { status: 400 })
      }

      if (record.status === 'approved') {
        return NextResponse.json({ error: 'Mã QR này đã được phê duyệt trước đó.' }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        token: record.qr_token,
        shortCode: record.short_code,
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

      if (record.status === 'approved') {
        return NextResponse.json({ error: 'Mã QR này đã được đăng nhập rồi.' }, { status: 400 })
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
            auth_token_hash: authTokenHash,
          })
          .eq('qr_token', record.qr_token)
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: '🎉 Phê duyệt đăng nhập thành công!',
        targetDevice: record.request_device_info,
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi qr-login route:', err)
    return NextResponse.json({ error: err.message || 'Lỗi xử lý đăng nhập QR' }, { status: 500 })
  }
}
