import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function base32ToBuffer(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = base32.toUpperCase().replace(/=+$/, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i])
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

function verifyTotp(secret: string, token: string, window = 1): boolean {
  try {
    const key = base32ToBuffer(secret)
    const epoch = Math.floor(Date.now() / 1000 / 30)
    for (let error = -window; error <= window; error++) {
      const counter = epoch + error
      const buf = Buffer.alloc(8)
      buf.writeBigInt64BE(BigInt(counter))
      const hmac = crypto.createHmac('sha1', key).update(buf).digest()
      const offset = hmac[hmac.length - 1] & 0x0f
      const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0')
      if (code === token.trim()) return true
    }
  } catch {}
  return false
}

// Bộ nhớ đệm OTP xác thực đổi mật khẩu (10 phút)
declare global {
  // eslint-disable-next-line no-var
  var __senPasswordOtpStore:
    | Record<
        string,
        {
          code: string
          expiresAt: number
          email: string
          lastSentAt: number
        }
      >
    | undefined
}

if (!global.__senPasswordOtpStore) {
  global.__senPasswordOtpStore = {}
}

const otpStore = global.__senPasswordOtpStore

function cleanExpiredOtp() {
  const now = Date.now()
  Object.keys(otpStore).forEach((key) => {
    if (otpStore[key] && otpStore[key].expiresAt < now) {
      delete otpStore[key]
    }
  })
}

function generatePasswordResetOtpEmailHtml(email: string, otpCode: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Thực Đổi Mật Khẩu SenExam 2.0</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .container { max-width: 560px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #f97316 0%, #ef4444 50%, #6366f1 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-flex; width: 48px; height: 48px; background: #0f172a; border-radius: 14px; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #ffffff; margin-bottom: 12px; }
    .title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .subtitle { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .body-content { padding: 32px 28px; }
    .salutation { font-size: 14px; margin-bottom: 16px; font-weight: 600; }
    .desc { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-card { background: #f1f5f9; border-radius: 18px; padding: 22px; text-align: center; border: 2px dashed #cbd5e1; margin-bottom: 24px; }
    .otp-label { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
    .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; font-family: monospace; }
    .otp-timer { font-size: 12px; color: #64748b; margin-top: 8px; }
    .security-note { background: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; border-radius: 8px; font-size: 12px; color: #9a3412; line-height: 1.5; margin-bottom: 24px; }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">S</div>
      <h1 class="title">SenExam Security</h1>
      <p class="subtitle">Xác thực đổi mật khẩu bảo mật • Chuẩn an toàn 2026</p>
    </div>
    <div class="body-content">
      <div class="salutation">Xin chào <strong>${email}</strong>,</div>
      <p class="desc">
        Hệ thống nhận được yêu cầu đổi mật khẩu cho tài khoản SenExam của bạn. Vui lòng nhập mã xác thực OTP 6 chữ số dưới đây vào màn hình đổi mật khẩu để xác nhận và hoàn tất:
      </p>
      <div class="otp-card">
        <div class="otp-label">MÃ XÁC THỰC BẢO MẬT (OTP)</div>
        <div class="otp-code">${otpCode}</div>
        <div class="otp-timer">⏱️ Mã có hiệu lực trong vòng <strong>10 phút</strong></div>
      </div>
      <div class="security-note">
        <strong>⚠️ Lưu ý an toàn:</strong> Khi bạn hoàn tất đổi mật khẩu, toàn bộ thiết bị cũ đã từng đăng nhập sẽ bị tự động đăng xuất để bảo vệ quyền riêng tư. Không chia sẻ mã này cho bất kỳ ai. Nếu bạn không gửi yêu cầu này, vui lòng liên hệ ngay <strong>minhhb.cv@gmail.com</strong>.
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} SenExam Platform. Mọi quyền được bảo lưu.
    </div>
  </div>
</body>
</html>
  `
}

async function sendEmailOtp(toEmail: string, otpCode: string): Promise<{ success: boolean; provider: string; error?: string }> {
  const subject = `[SenExam] Mã xác nhận đổi mật khẩu (${otpCode}) cho tài khoản ${toEmail}`
  const html = generatePasswordResetOtpEmailHtml(toEmail, otpCode)

  // 1. Gửi qua Resend API nếu có key
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const senderCandidates = [
        process.env.RESEND_FROM_EMAIL,
        'SenExam Security <security@senexam.edu.vn>',
        'SenExam <onboarding@resend.dev>',
      ].filter(Boolean) as string[]

      for (const from of senderCandidates) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: toEmail,
            subject,
            html,
          }),
        })

        if (res.ok) {
          return { success: true, provider: `Resend (${from})` }
        }
      }
    } catch (err: any) {
      console.warn('[Password OTP] Lỗi kết nối Resend API:', err.message)
    }
  }

  // 2. Kênh SMTP / Gmail nếu có cấu hình
  const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER
  const smtpPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
  const smtpHost = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined)
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })

      const fromAddress = process.env.SMTP_FROM || `SenExam Security <${smtpUser}>`
      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        html,
      })

      return { success: true, provider: 'SMTP' }
    } catch (smtpErr: any) {
      console.warn('[Password OTP] Lỗi gửi qua SMTP:', smtpErr.message)
    }
  }

  // 3. Fallback dev mode / console log
  console.log(`\n======================================================`)
  console.log(`[SenExam Security] MÃ XÁC THỰC OTP ĐỔI MẬT KHẨU:`)
  console.log(`Tài khoản: ${toEmail}`)
  console.log(`MÃ OTP: ${otpCode}`)
  console.log(`======================================================\n`)

  return { success: true, provider: 'Console / Dev Preview' }
}

export async function GET(request: Request) {
  try {
    const caller = await getUserFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()

    let targetUserId = caller?.id
    let targetEmail = ''

    if (!targetUserId) {
      const url = new URL(request.url)
      const emailParam = url.searchParams.get('email')?.trim().toLowerCase()
      if (!emailParam) {
        return NextResponse.json({ error: 'Chưa đăng nhập hoặc thiếu địa chỉ email' }, { status: 401 })
      }

      // 1. Tra cứu qua bảng profiles
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, email, password_change_count')
        .ilike('email', emailParam)
        .maybeSingle()

      if (prof?.id) {
        targetUserId = prof.id
        targetEmail = prof.email || emailParam
      } else {
        // 2. Tra cứu qua admin auth listUsers
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === emailParam)
        if (found) {
          targetUserId = found.id
          targetEmail = found.email || emailParam
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { error: 'Không tìm thấy tài khoản với email này trên hệ thống', notFound: true },
          { status: 404 }
        )
      }
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })
    }

    const user = userData.user
    targetEmail = user.email || targetEmail
    const userMetadata = user.user_metadata || {}
    const appMetadata = user.app_metadata || {}

    // 1. Kiểm tra tài khoản có phải "Tài khoản được cấp" (provisioned)
    let isProvisioned = Boolean(
      userMetadata.provisioned_by ||
      userMetadata.is_provisioned ||
      appMetadata.is_provisioned
    )

    if (!isProvisioned) {
      try {
        const { data: grants } = await supabaseAdmin
          .from('admin_grants_log')
          .select('id')
          .eq('target_user_id', user.id)
          .in('kind', ['provision_account', 'batch_provision_accounts'])
          .limit(1)
        if (grants && grants.length > 0) {
          isProvisioned = true
        }
      } catch (err) {
        // ignore
      }
    }

    // 2. Số lần đổi mật khẩu
    let passwordChangeCount = Number(userMetadata.password_change_count || 0)
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('password_change_count')
        .eq('id', user.id)
        .maybeSingle()
      if (prof && typeof prof.password_change_count === 'number') {
        passwordChangeCount = Math.max(passwordChangeCount, prof.password_change_count)
      }
    } catch (err) {
      // ignore
    }

    // 3. Kiểm tra người dùng đã kích hoạt Sen 2FA (TOTP)
    const factors = user.factors || []
    const has2FA = factors.some((f: any) => f.factor_type === 'totp' && f.status === 'verified')

    // Quy tắc:
    // - Tài khoản được cấp:
    //   + Lần 1: Không cần xác minh
    //   + Lần 2 trở đi: Khóa và yêu cầu liên hệ qua email minhhb.cv@gmail.com
    const canChangeDirectly = isProvisioned && passwordChangeCount === 0
    const isLocked = isProvisioned && passwordChangeCount >= 1

    return NextResponse.json({
      success: true,
      email: targetEmail,
      isProvisioned,
      passwordChangeCount,
      canChangeDirectly,
      isLocked,
      has2FA,
    })
  } catch (err: any) {
    console.error('Lỗi API /api/auth/password-change GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi kiểm tra trạng thái bảo mật' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      action,
      email: rawEmail,
      newPassword,
      confirmPassword,
      verificationMethod,
      otpCode,
    } = body

    const caller = await getUserFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()

    let targetUserId = caller?.id
    let targetEmail = ''

    if (!targetUserId) {
      const emailInput = (rawEmail || '').trim().toLowerCase()
      if (!emailInput) {
        return NextResponse.json({ error: 'Vui lòng cung cấp địa chỉ email tài khoản' }, { status: 400 })
      }

      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .ilike('email', emailInput)
        .maybeSingle()

      if (prof?.id) {
        targetUserId = prof.id
        targetEmail = prof.email || emailInput
      } else {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === emailInput)
        if (found) {
          targetUserId = found.id
          targetEmail = found.email || emailInput
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { error: 'Không tìm thấy tài khoản với email này trên hệ thống', notFound: true },
          { status: 404 }
        )
      }
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })
    }

    const user = userData.user
    const email = user.email || targetEmail
    if (!email) {
      return NextResponse.json({ error: 'Tài khoản chưa có địa chỉ email' }, { status: 400 })
    }

    cleanExpiredOtp()

    // -------------------------------------------------------------
    // HÀNH ĐỘNG 1: GỬI MÃ OTP QUA EMAIL
    // -------------------------------------------------------------
    if (action === 'send_email_otp') {
      const existing = otpStore[targetUserId]
      const now = Date.now()

      // Giới hạn tần suất 60s
      if (existing && now - existing.lastSentAt < 60000) {
        const remaining = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000)
        return NextResponse.json(
          { error: `Vui lòng đợi ${remaining} giây trước khi yêu cầu gửi lại mã OTP mới.` },
          { status: 429 }
        )
      }

      // Tạo mã OTP ngẫu nhiên 6 chữ số
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      otpStore[targetUserId] = {
        code,
        email,
        expiresAt: now + 10 * 60 * 1000, // 10 phút
        lastSentAt: now,
      }

      await sendEmailOtp(email, code)
      return NextResponse.json({
        success: true,
        message: `Mã OTP đã được gửi đến email ${email}. Vui lòng kiểm tra hộp thư.`,
        previewOtp: process.env.NODE_ENV === 'development' ? code : undefined,
      })
    }

    // -------------------------------------------------------------
    // HÀNH ĐỘNG 2: XÁC THỰC VÀ CẬP NHẬT MẬT KHẨU MỚI
    // -------------------------------------------------------------
    if (action === 'verify_and_update') {
      if (!newPassword || typeof newPassword !== 'string') {
        return NextResponse.json({ error: 'Vui lòng nhập mật khẩu mới' }, { status: 400 })
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: 'Xác nhận mật khẩu không khớp' }, { status: 400 })
      }

      // Kiểm tra tiêu chí bảo mật mật khẩu
      const hasMinLength = newPassword.length >= 8
      const hasUpperCase = /[A-Z]/.test(newPassword)
      const hasLowerCase = /[a-z]/.test(newPassword)
      const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumberOrSpecial) {
        return NextResponse.json(
          { error: 'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số/ký tự đặc biệt.' },
          { status: 400 }
        )
      }

      // Kiểm tra quy tắc tài khoản được cấp
      const userMetadata = user.user_metadata || {}
      const appMetadata = user.app_metadata || {}
      let isProvisioned = Boolean(
        userMetadata.provisioned_by ||
        userMetadata.is_provisioned ||
        appMetadata.is_provisioned
      )

      if (!isProvisioned) {
        try {
          const { data: grants } = await supabaseAdmin
            .from('admin_grants_log')
            .select('id')
            .eq('target_user_id', user.id)
            .in('kind', ['provision_account', 'batch_provision_accounts'])
            .limit(1)
          if (grants && grants.length > 0) {
            isProvisioned = true
          }
        } catch (err) {}
      }

      let passwordChangeCount = Number(userMetadata.password_change_count || 0)
      try {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('password_change_count')
          .eq('id', user.id)
          .maybeSingle()
        if (prof && typeof prof.password_change_count === 'number') {
          passwordChangeCount = Math.max(passwordChangeCount, prof.password_change_count)
        }
      } catch (err) {}

      // Quy tắc kiểm duyệt bảo mật:
      if (isProvisioned) {
        if (passwordChangeCount >= 1) {
          return NextResponse.json(
            {
              error: 'Tài khoản được cấp chỉ được đổi mật khẩu lần 1 trực tiếp. Kể từ lần 2, vui lòng liên hệ quản trị viên qua email: minhhb.cv@gmail.com',
              isLocked: true,
            },
            { status: 403 }
          )
        }
        // passwordChangeCount === 0: Cho phép đổi mật khẩu lần 1 trực tiếp mà không cần OTP/2FA
      } else {
        // Tài khoản thông thường: Bắt buộc xác minh qua TOTP hoặc Email OTP
        if (verificationMethod === 'totp') {
          const cleanTotp = (otpCode || '').trim().replace(/[^0-9]/g, '')
          if (cleanTotp.length !== 6) {
            return NextResponse.json({ error: 'Mã xác thực Sen 2FA (TOTP) phải gồm 6 chữ số' }, { status: 400 })
          }

          // Kiểm tra xem user có factor totp không
          const factors = user.factors || []
          const verifiedTotp = factors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified')
          if (!verifiedTotp) {
            return NextResponse.json({ error: 'Tài khoản chưa thiết lập mã xác thực 2FA. Vui lòng chọn nhận mã qua Email.' }, { status: 400 })
          }

          let totpVerified = false
          try {
            const { data: factorRecord } = await supabaseAdmin
              .schema('auth')
              .from('mfa_factors')
              .select('secret')
              .eq('id', verifiedTotp.id)
              .maybeSingle()

            if (factorRecord?.secret) {
              totpVerified = verifyTotp(factorRecord.secret, cleanTotp)
            }
          } catch (e) {
            console.warn('Lỗi kiểm tra TOTP secret từ database:', e)
          }

          // Fallback: nếu người dùng nhập mã email OTP vào ô này
          if (!totpVerified) {
            const record = otpStore[targetUserId]
            if (record && record.code === cleanTotp && Date.now() <= record.expiresAt) {
              delete otpStore[targetUserId]
              totpVerified = true
            }
          }

          if (!totpVerified) {
            return NextResponse.json(
              { error: 'Mã xác thực TOTP không chính xác hoặc đã hết hạn. Bạn có thể bấm xác minh qua Email OTP bên dưới.' },
              { status: 400 }
            )
          }
        } else if (verificationMethod === 'email_otp') {
          const cleanCode = (otpCode || '').trim()
          const record = otpStore[targetUserId]

          if (!record) {
            return NextResponse.json(
              { error: 'Chưa có mã OTP nào được gửi hoặc mã đã hết hạn. Vui lòng bấm "Gửi mã OTP".' },
              { status: 400 }
            )
          }

          if (Date.now() > record.expiresAt) {
            delete otpStore[targetUserId]
            return NextResponse.json({ error: 'Mã OTP đã hết hiệu lực (quá 10 phút). Vui lòng gửi lại mã mới.' }, { status: 400 })
          }

          if (record.code !== cleanCode) {
            return NextResponse.json({ error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' }, { status: 400 })
          }

          // Xóa OTP sau khi sử dụng thành công
          delete otpStore[targetUserId]
        }
      }

      // Cập nhật mật khẩu mới qua Service Role
      const nextCount = passwordChangeCount + 1
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
        user_metadata: {
          ...userMetadata,
          password_change_count: nextCount,
          last_password_change_at: new Date().toISOString(),
        },
      })

      if (updateError) {
        throw updateError
      }

      // Cập nhật bảng profiles nếu có
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ password_change_count: nextCount })
          .eq('id', targetUserId)
      } catch (err) {
        // ignore
      }

      // HỦY PHIÊN TOÀN BỘ CÁC THIẾT BỊ CŨ:
      try {
        await supabaseAdmin
          .from('fepn_user_sessions')
          .update({ is_active: false })
          .eq('user_id', targetUserId)
      } catch (sessionErr) {
        console.warn('Lỗi thu hồi phiên thiết bị cũ:', sessionErr)
      }

      return NextResponse.json({
        success: true,
        message: 'Đổi mật khẩu thành công! Tất cả thiết bị cũ đã được đăng xuất an toàn. Vui lòng đăng nhập lại.',
        requireRelogin: true,
        passwordChangeCount: nextCount,
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Lỗi API /api/auth/password-change POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi đổi mật khẩu' },
      { status: 500 }
    )
  }
}
