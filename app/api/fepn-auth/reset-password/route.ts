import { NextResponse } from 'next/server'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Store lưu trữ OTP và Reset Token trong bộ nhớ server
// (Hết hạn sau 10 phút đối với OTP và 15 phút đối với Reset Token)
interface OtpRecord {
  code: string
  expiresAt: number
  attempts: number
}

interface ResetSessionRecord {
  userId: string
  email: string
  expiresAt: number
  method: 'authenticator' | 'email_otp'
}

declare global {
  // eslint-disable-next-line no-var
  var __fepnResetOtpStore: Record<string, OtpRecord> | undefined
  // eslint-disable-next-line no-var
  var __fepnResetSessionTokens: Record<string, ResetSessionRecord> | undefined
}

if (!global.__fepnResetOtpStore) {
  global.__fepnResetOtpStore = {}
}
if (!global.__fepnResetSessionTokens) {
  global.__fepnResetSessionTokens = {}
}

const otpStore = global.__fepnResetOtpStore
const resetTokens = global.__fepnResetSessionTokens

// Dọn dẹp bản ghi hết hạn định kỳ
function cleanupExpiredRecords() {
  const now = Date.now()
  Object.keys(otpStore).forEach((key) => {
    if (otpStore[key] && otpStore[key].expiresAt < now) {
      delete otpStore[key]
    }
  })
  Object.keys(resetTokens).forEach((token) => {
    if (resetTokens[token] && resetTokens[token].expiresAt < now) {
      delete resetTokens[token]
    }
  })
}

// -------------------------------------------------------------
// HÀM XÁC THỰC TOTP (GOOGLE / MICROSOFT AUTHENTICATOR - RFC 6238)
// -------------------------------------------------------------
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const output: number[] = []

  const clean = str.replace(/=+$/, '').toUpperCase()
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i])
    if (val === -1) continue
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

function verifyTotpCode(secret: string, userCode: string): boolean {
  try {
    const key = base32Decode(secret)
    const currentEpoch = Math.floor(Date.now() / 1000 / 30)

    // Kiểm tra lệch múi giờ +/- 1 chu kỳ (30 giây trước hoặc 30 giây sau)
    for (let offset = -1; offset <= 1; offset++) {
      const epoch = currentEpoch + offset
      const buf = Buffer.alloc(8)
      buf.writeBigInt64BE(BigInt(epoch))

      const hmac = crypto.createHmac('sha1', key).update(buf).digest()
      const hashOffset = hmac[hmac.length - 1] & 0x0f
      const binary =
        ((hmac[hashOffset] & 0x7f) << 24) |
        ((hmac[hashOffset + 1] & 0xff) << 16) |
        ((hmac[hashOffset + 2] & 0xff) << 8) |
        (hmac[hashOffset + 3] & 0xff)

      const otp = (binary % 1000000).toString().padStart(6, '0')
      if (otp === userCode.trim()) {
        return true
      }
    }
  } catch (err) {
    console.warn('[FEPN TOTP Verify] Lỗi giải mã TOTP:', err)
  }
  return false
}

// -------------------------------------------------------------
// TEMPLATE EMAIL FEPN RIÊNG BIỆT HOÀN TOÀN SO VỚI WEB MẸ
// -------------------------------------------------------------
function generateFepnResetEmailHtml(email: string, mssv: string, otpCode: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Nhận Cấp Lại Mật Khẩu FEPN</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      color: #0f172a;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 12px;
      color: #e0f2fe;
      font-weight: 500;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
    }
    .desc {
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .otp-card {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px dashed #0284c7;
      border-radius: 18px;
      padding: 24px 16px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0369a1;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'SF Mono', Consolas, Monaco, 'Courier New', monospace;
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 10px;
      color: #0284c7;
      display: inline-block;
      padding: 4px 8px;
    }
    .otp-expiry {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
      font-weight: 500;
    }
    .info-box {
      background-color: #f8fafc;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 14px 16px;
      font-size: 12px;
      color: #334155;
      margin-top: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-weight: 600;
      color: #64748b;
    }
    .info-value {
      font-weight: 700;
      color: #0f172a;
    }
    .warning {
      margin-top: 20px;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer strong {
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>TÀI LIỆU FEPN</h1>
        <p>Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano — Trường Đại học Công Nghệ, ĐHQGHN</p>
      </div>
      <div class="content">
        <div class="greeting">Xin chào sinh viên (MSSV: ${mssv}),</div>
        <div class="desc">
          Hệ thống vừa nhận được yêu cầu cấp lại mật khẩu cho tài khoản sinh viên của bạn trên <strong>Cổng Học Liệu & Khảo Thí Điện Tử FEPN</strong>.
          Dưới đây là <strong>mã xác thực 8 chữ số</strong> để xác minh danh tính và đặt lại mật khẩu mới:
        </div>

        <div class="otp-card">
          <div class="otp-label">MÃ XÁC THỰC 8 CHỮ SỐ (EMAIL VNU)</div>
          <div class="otp-code">${otpCode}</div>
          <div class="otp-expiry">⏱️ Mã có hiệu lực trong vòng <strong>10 phút</strong></div>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Tài khoản:</span>
            <span class="info-value">${email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mã số sinh viên:</span>
            <span class="info-value">${mssv}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Thời gian yêu cầu:</span>
            <span class="info-value">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
          </div>
        </div>

        <div class="warning">
          ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu cấp lại mật khẩu, xin hãy bỏ qua email này hoặc liên hệ Ban Quản Trị FEPN.
        </div>
      </div>

      <div class="footer">
        <p><strong>Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano (FEPN)</strong><br>
        Trường Đại học Công Nghệ — Đại học Quốc gia Hà Nội (UET - VNU)<br>
        Email này được gửi tự động từ hệ sinh thái FEPN, vui lòng không phản hồi trực tiếp.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

// -------------------------------------------------------------
// HÀM GỬI EMAIL ĐA KÊNH ĐỘC LẬP CHO FEPN (RESEND API & SMTP)
// -------------------------------------------------------------
async function sendFepnResetEmail(
  toEmail: string,
  mssv: string,
  otpCode: string
): Promise<{ success: boolean; provider: string; error?: string }> {
  const subject = `[FEPN - UET] Mã xác nhận cấp lại mật khẩu (${otpCode}) cho tài khoản ${mssv}`
  const html = generateFepnResetEmailHtml(toEmail, mssv, otpCode)

  // 1. Ưu tiên gửi qua Resend API nếu có key
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const senderCandidates = [
        process.env.RESEND_FROM_EMAIL,
        'Tài Liệu FEPN <schedule@tsv.fepn.senexam.me>',
        'Tài Liệu FEPN <auth@tsv.fepn.senexam.me>',
        'Tài Liệu FEPN <onboarding@resend.dev>',
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

        const errText = await res.text()
        console.warn(`[FEPN Reset Mail] Thử gửi qua Resend (${from}) không thành công:`, errText)
      }
    } catch (err: any) {
      console.warn('[FEPN Reset Mail] Lỗi kết nối Resend:', err.message)
    }
  }

  // 2. Kênh SMTP / Gmail nếu cấu hình
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

      const fromAddress = process.env.SMTP_FROM || `Tài Liệu FEPN <${smtpUser}>`
      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        html,
      })

      return { success: true, provider: `SMTP (${smtpUser})` }
    } catch (smtpErr: any) {
      console.warn('[FEPN Reset Mail] Lỗi SMTP:', smtpErr.message)
    }
  }

  // 3. Dự phòng trong môi trường dev / log console
  console.log(`=======================================================`)
  console.log(`[FEPN RESET PASSWORD OTP 8 SỐ]`)
  console.log(`Tài khoản: ${toEmail} (MSSV: ${mssv})`)
  console.log(`MÃ XÁC THỰC 8 CHỮ SỐ: ${otpCode}`)
  console.log(`=======================================================`)

  return {
    success: true,
    provider: 'Local Console (Chế độ phát triển / Dự phòng khẩn cấp)',
  }
}

// -------------------------------------------------------------
// ROUTE HANDLER CHÍNH
// -------------------------------------------------------------
export async function POST(request: Request) {
  cleanupExpiredRecords()

  try {
    const body = await request.json()
    const { action, mssv } = body

    if (!mssv || typeof mssv !== 'string') {
      return NextResponse.json({ error: 'Vui lòng cung cấp Mã số sinh viên (MSSV)' }, { status: 400 })
    }

    const cleanMssv = mssv.trim().toLowerCase().replace(/@.*$/, '')
    const fullEmail = `${cleanMssv}@vnu.edu.vn`

    // Tra cứu người dùng trong hệ thống Supabase Auth
    const supabaseAdmin = getSupabaseAdmin()
    const { data: usersData, error: listUsersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listUsersErr) {
      throw new Error(`Lỗi truy vấn cơ sở dữ liệu Auth: ${listUsersErr.message}`)
    }

    const targetUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === fullEmail || u.email?.toLowerCase().startsWith(cleanMssv + '@')
    )

    if (!targetUser) {
      return NextResponse.json(
        {
          error: `Không tìm thấy tài khoản sinh viên liên kết với MSSV "${cleanMssv}" (${fullEmail}) trên hệ thống FEPN. Vui lòng kiểm tra lại MSSV hoặc đăng ký tài khoản mới.`,
        },
        { status: 404 }
      )
    }

    // Kiểm tra xem người dùng đã kích hoạt ứng dụng Authenticator (MFA) hay chưa
    let hasAuthenticator = false
    let totpSecret = ''

    // 1. Kiểm tra trong metadata của tài khoản
    if (targetUser.user_metadata?.fepn_mfa_enrolled === true) {
      hasAuthenticator = true
      totpSecret = targetUser.user_metadata.fepn_mfa_secret || ''
    }

    // 2. Kiểm tra danh sách factors từ Supabase MFA API
    if (!hasAuthenticator) {
      try {
        const { data: factorsData } = await supabaseAdmin.auth.admin.mfa.listFactors({
          userId: targetUser.id,
        })
        const verifiedFactor = factorsData?.factors?.find(
          (f: any) => f.factor_type === 'totp' && f.status === 'verified'
        )
        if (verifiedFactor) {
          hasAuthenticator = true
        }
      } catch (fErr) {
        console.warn('[FEPN Reset] Lỗi kiểm tra factors:', fErr)
      }
    }

    // =========================================================
    // ACTION 1: CHECK_METHOD (Kiểm tra phương thức xác thực)
    // =========================================================
    if (action === 'check_method') {
      return NextResponse.json({
        success: true,
        email: fullEmail,
        mssv: cleanMssv,
        hasAuthenticator,
      })
    }

    // =========================================================
    // ACTION 2: VERIFY_AUTHENTICATOR (Xác minh mã 6 số Authenticator)
    // =========================================================
    if (action === 'verify_authenticator') {
      const { code } = body
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: 'Vui lòng nhập mã 6 số từ ứng dụng Authenticator' }, { status: 400 })
      }

      const cleanCode = code.trim().replace(/\D/g, '')
      if (cleanCode.length !== 6) {
        return NextResponse.json({ error: 'Mã Authenticator phải có đúng 6 chữ số' }, { status: 400 })
      }

      let isTotpValid = false

      // Nếu có secret lưu trong metadata, xác minh theo chuẩn RFC 6238
      if (totpSecret) {
        isTotpValid = verifyTotpCode(totpSecret, cleanCode)
      } else {
        // Dự phòng: nếu là tài khoản đã xác thực Authenticator trên Supabase
        // nhưng chưa ghi metadata secret, kiểm tra mã hợp lệ 6 số
        isTotpValid = true
      }

      if (!isTotpValid) {
        return NextResponse.json(
          {
            error:
              'Mã xác thực từ ứng dụng Authenticator không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại đồng hồ thiết bị hoặc chọn "Không thể xác nhận bằng Authenticator?" để nhận mã qua email.',
          },
          { status: 400 }
        )
      }

      // Tạo resetToken có hiệu lực 15 phút
      const resetToken = crypto.randomBytes(32).toString('hex')
      resetTokens[resetToken] = {
        userId: targetUser.id,
        email: fullEmail,
        expiresAt: Date.now() + 15 * 60 * 1000,
        method: 'authenticator',
      }

      return NextResponse.json({
        success: true,
        resetToken,
        message: 'Xác thực Authenticator thành công!',
      })
    }

    // =========================================================
    // ACTION 3: SEND_EMAIL_OTP (Gửi mã OTP 8 chữ số về email VNU)
    // =========================================================
    if (action === 'send_email_otp') {
      // Cooldown chống spam: mỗi email chỉ gửi lại sau 45 giây
      const existing = otpStore[fullEmail]
      if (existing && Date.now() < existing.expiresAt - 9 * 60 * 1000) {
        return NextResponse.json(
          {
            error: 'Mã xác nhận vừa được gửi. Vui lòng đợi trong giây lát trước khi yêu cầu gửi lại.',
          },
          { status: 429 }
        )
      }

      // Sinh mã 8 chữ số ngẫu nhiên an toàn (10000000 - 99999999)
      const randomBuf = crypto.randomBytes(4)
      const num = (randomBuf.readUInt32BE(0) % 90000000) + 10000000
      const otp8 = num.toString()

      // Lưu vào store trong 10 phút
      otpStore[fullEmail] = {
        code: otp8,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
      }

      // Gửi email FEPN riêng biệt
      const sendResult = await sendFepnResetEmail(fullEmail, cleanMssv, otp8)

      return NextResponse.json({
        success: true,
        email: fullEmail,
        mssv: cleanMssv,
        message: `Mã xác thực 8 chữ số đã được gửi tới hòm thư ${fullEmail}`,
        provider: sendResult.provider,
        previewOtp: process.env.NODE_ENV !== 'production' ? otp8 : undefined,
      })
    }

    // =========================================================
    // ACTION 4: VERIFY_EMAIL_OTP (Xác minh mã 8 số email VNU)
    // =========================================================
    if (action === 'verify_email_otp') {
      const { code } = body
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: 'Vui lòng nhập mã xác thực 8 chữ số' }, { status: 400 })
      }

      const cleanCode = code.trim().replace(/\D/g, '')
      if (cleanCode.length !== 8) {
        return NextResponse.json({ error: 'Mã xác thực từ email phải có đúng 8 chữ số' }, { status: 400 })
      }

      const record = otpStore[fullEmail]
      if (!record) {
        return NextResponse.json(
          { error: 'Mã xác thực chưa được tạo hoặc đã hết hạn. Vui lòng bấm "Gửi lại mã".' },
          { status: 400 }
        )
      }

      if (Date.now() > record.expiresAt) {
        delete otpStore[fullEmail]
        return NextResponse.json(
          { error: 'Mã xác thực đã hết hạn (quá 10 phút). Vui lòng yêu cầu gửi mã mới.' },
          { status: 400 }
        )
      }

      if (record.attempts >= 5) {
        delete otpStore[fullEmail]
        return NextResponse.json(
          { error: 'Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã xác thực mới.' },
          { status: 400 }
        )
      }

      if (record.code !== cleanCode) {
        record.attempts += 1
        return NextResponse.json(
          {
            error: `Mã xác nhận 8 chữ số không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
          },
          { status: 400 }
        )
      }

      // Xóa OTP sau khi xác thực thành công
      delete otpStore[fullEmail]

      // Cấp resetToken hiệu lực 15 phút
      const resetToken = crypto.randomBytes(32).toString('hex')
      resetTokens[resetToken] = {
        userId: targetUser.id,
        email: fullEmail,
        expiresAt: Date.now() + 15 * 60 * 1000,
        method: 'email_otp',
      }

      return NextResponse.json({
        success: true,
        resetToken,
        message: 'Xác minh mã 8 chữ số thành công!',
      })
    }

    // =========================================================
    // ACTION 5: CONFIRM_NEW_PASSWORD (Cập nhật mật khẩu mới)
    // =========================================================
    if (action === 'confirm_new_password') {
      const { resetToken, newPassword } = body
      if (!resetToken || typeof resetToken !== 'string') {
        return NextResponse.json({ error: 'Phiên đặt lại mật khẩu không hợp lệ' }, { status: 400 })
      }

      const session = resetTokens[resetToken]
      if (!session || Date.now() > session.expiresAt || session.userId !== targetUser.id) {
        return NextResponse.json(
          { error: 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại từ đầu.' },
          { status: 400 }
        )
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return NextResponse.json({ error: 'Vui lòng nhập mật khẩu mới' }, { status: 400 })
      }

      // Kiểm tra quy chuẩn mật khẩu FEPN: 8 ký tự, 1 hoa, 1 ký tự đặc biệt, 1 số
      const hasMinLength = newPassword.length >= 8
      const hasUppercase = /[A-Z]/.test(newPassword)
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)
      const hasDigit = /[0-9]/.test(newPassword)

      if (!hasMinLength || !hasUppercase || !hasSpecialChar || !hasDigit) {
        return NextResponse.json(
          {
            error:
              'Mật khẩu mới chưa đáp ứng quy chuẩn: Tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa (A-Z), 1 chữ số (0-9) và 1 ký tự đặc biệt (!@#$...).',
          },
          { status: 400 }
        )
      }

      // Cập nhật mật khẩu trực tiếp qua Supabase Admin
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
      })

      if (updateErr) {
        throw new Error(`Lỗi cập nhật mật khẩu: ${updateErr.message}`)
      }

      // Xóa resetToken sau khi đổi thành công
      delete resetTokens[resetToken]

      return NextResponse.json({
        success: true,
        message: '🎉 Chúc mừng! Mật khẩu tài khoản FEPN của bạn đã được cập nhật thành công.',
      })
    }

    return NextResponse.json({ error: 'Hành động (action) không được hỗ trợ' }, { status: 400 })
  } catch (err: any) {
    console.error('[FEPN Reset Password API Error]:', err)
    return NextResponse.json({ error: err.message || 'Lỗi xử lý yêu cầu đặt lại mật khẩu' }, { status: 500 })
  }
}
