import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Cấu trúc ca học và email nhắc nhở
export interface ScheduleReminderPayload {
  studentEmail: string
  studentName?: string
  subjectName: string
  subjectCode?: string
  shiftName: string
  startTime: string
  endTime: string
  classroom: string
  lecturers?: string[]
  sessionType?: string
  notes?: string
}

// Lưu trữ tạm để chống gửi trùng trong ngày (Idempotency in-memory)
// key: `reminded_${studentEmail}_${subjectId}_${sessionId}_${startTime}_${YYYY-MM-DD}`
const sentRemindersToday = new Set<string>()

// Làm sạch danh sách gửi trùng sau mỗi 24 giờ
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    sentRemindersToday.clear()
  }, 24 * 60 * 60 * 1000)
}

/**
 * Tính toán thời gian thực theo Giờ Việt Nam (UTC+7 / Asia/Ho_Chi_Minh)
 * Đảm bảo độc lập với múi giờ của server chạy Next.js (thường là UTC)
 */
function getVietnamTime(): {
  dayOfWeek: number
  hours: number
  minutes: number
  totalMinutes: number
  todayStr: string
} {
  const now = new Date()
  const vnFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })

  const parts = vnFormatter.formatToParts(now)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  const hours = parseInt(partMap.hour, 10) || 0
  const minutes = parseInt(partMap.minute, 10) || 0
  const weekday = partMap.weekday // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'

  // Quy chuẩn FEPN: 2 = Thứ Hai, 3 = Thứ Ba, ..., 7 = Thứ Bảy, 8 = Chủ Nhật
  const dayMap: Record<string, number> = {
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
    Sat: 7,
    Sun: 8,
  }
  const dayOfWeek = dayMap[weekday] || 2
  const totalMinutes = hours * 60 + minutes
  const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`

  return { dayOfWeek, hours, minutes, totalMinutes, todayStr }
}

/**
 * Kiểm tra xem hệ thống đã cấu hình kênh gửi email nào
 */
function getEmailProviderInfo(): {
  configured: boolean
  provider: 'smtp' | 'resend' | 'brevo' | 'none'
  details: string
} {
  const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER
  const smtpPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS

  if (smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp',
      details: `Gmail / SMTP (${smtpUser})`,
    }
  }

  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: 'resend',
      details: `Resend API (${process.env.RESEND_FROM_EMAIL || 'schedule@tsv.fepn.senexam.me'})`,
    }
  }

  if (process.env.BREVO_API_KEY) {
    return {
      configured: true,
      provider: 'brevo',
      details: `Brevo API (${process.env.BREVO_SENDER_EMAIL || 'schedule@senexam.me'})`,
    }
  }

  return {
    configured: false,
    provider: 'none',
    details: 'Chưa cấu hình (Thiếu GMAIL_USER + GMAIL_PASS hoặc RESEND_API_KEY)',
  }
}

/**
 * Tạo nội dung HTML email nhắc nhở chuyên nghiệp cho sinh viên FEPN
 */
function generateReminderHtml(data: ScheduleReminderPayload): string {
  const lecturersText =
    data.lecturers && data.lecturers.length > 0
      ? data.lecturers.join(', ')
      : 'Giảng viên phụ trách Khoa VLKT'

  const typeLabel = data.sessionType || 'Buổi học chính thức'

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nhắc Nhở Lịch Học FEPN</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .badge-fepn { display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0 0; font-size: 13px; opacity: 0.95; }
    .content { padding: 28px 24px; }
    .alert-box { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 14px 16px; border-radius: 12px; margin-bottom: 24px; font-size: 13px; color: #0369a1; font-weight: 600; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; margin-bottom: 20px; }
    .course-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 6px 0; }
    .course-code { font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; }
    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
    .info-item { background: #ffffff; padding: 12px 14px; border-radius: 12px; border: 1px solid #edf2f7; }
    .info-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .info-value { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0; }
    .info-highlight { color: #dc2626; font-family: monospace; font-size: 14px; }
    .room-badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 800; font-size: 13px; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0; }
    .btn-action { display: block; text-align: center; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff !important; text-decoration: none; padding: 14px 24px; border-radius: 16px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); margin-top: 24px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge-fepn">Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano</div>
      <h1>⏰ Sắp Đến Giờ Vào Lớp (Còn ~30 Phút)</h1>
      <p>Thông báo tự động từ Thời Khóa Biểu FEPN Schedule</p>
    </div>

    <div class="content">
      <div class="alert-box">
        💡 Ca học của bạn sẽ bắt đầu vào lúc <strong>${data.startTime}</strong> hôm nay. Hãy chuẩn bị bài vở và đồ dùng để vào lớp đúng giờ nhé!
      </div>

      <div class="card">
        <div class="course-code">${data.subjectCode || 'HỌC PHẦN FEPN'} • ${typeLabel}</div>
        <h2 class="course-title">${data.subjectName}</h2>

        <div class="grid-info">
          <div class="info-item">
            <div class="info-label">⏰ Thời gian học</div>
            <p class="info-value info-highlight">${data.startTime} - ${data.endTime}</p>
            <span style="font-size: 11px; color: #64748b; font-weight: 600;">${data.shiftName}</span>
          </div>

          <div class="info-item">
            <div class="info-label">📍 Phòng học</div>
            <div class="room-badge">${data.classroom || 'Theo thông báo của giảng viên'}</div>
          </div>

          <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">👨‍🏫 Giảng viên phụ trách</div>
            <p class="info-value">${lecturersText}</p>
          </div>

          ${
            data.notes
              ? `
          <div class="info-item" style="grid-column: span 2; background: #fffbeb; border-color: #fef3c7;">
            <div class="info-label" style="color: #b45309;">📝 Ghi chú buổi học</div>
            <p class="info-value" style="color: #92400e; font-weight: 600;">${data.notes}</p>
          </div>
          `
              : ''
          }
        </div>
      </div>

      <a href="https://tsv.fepn.senexam.me/fepn-schedule" class="btn-action" target="_blank">
        Mở Thời Khóa Biểu FEPN Để Xem Chi Tiết
      </a>
    </div>

    <div class="footer">
      <p>Email này được gửi tự động theo cài đặt nhắc nhở 30 phút trên tài khoản của bạn tại <strong>FEPN Schedule</strong>.<br>
      Khoa Vật Lý Kỹ Thuật & Công Nghệ Nano — Trường Đại học Công nghệ, ĐHQGHN.<br>
      Nếu bạn không muốn nhận email nhắc nhở, hãy vào mục Cài đặt trong trang FEPN Schedule để tắt.</p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Gửi 1 email đơn lẻ hỗ trợ đa kênh: Gmail/SMTP, Resend API, Brevo API
 */
async function sendSingleEmail(
  item: ScheduleReminderPayload
): Promise<{ email: string; success: boolean; error?: string; provider?: string }> {
  try {
    const html = generateReminderHtml(item)
    const subject = `[FEPN Nhắc Lịch Học] ${item.subjectName} lúc ${item.startTime} (${item.classroom})`

    // ----------------------------------------------------
    // KÊNH 1: GMAIL / SMTP (Khuyên dùng, miễn phí, không cần cấu hình domain)
    // ----------------------------------------------------
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
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        })

        const fromAddress = process.env.SMTP_FROM || `FEPN Schedule <${smtpUser}>`
        await transporter.sendMail({
          from: fromAddress,
          to: item.studentEmail,
          subject,
          html,
        })

        return { email: item.studentEmail, success: true, provider: `SMTP (${smtpUser})` }
      } catch (smtpErr: any) {
        console.warn(`[FEPN Reminder] Lỗi gửi qua SMTP (${smtpUser}):`, smtpErr.message)
        // Nếu không có kênh dự phòng nào khác, báo lỗi cụ thể
        if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY) {
          return {
            email: item.studentEmail,
            success: false,
            error: `Lỗi kết nối SMTP (${smtpUser}): ${smtpErr.message}`,
          }
        }
      }
    }

    // ----------------------------------------------------
    // KÊNH 2: RESEND API
    // ----------------------------------------------------
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      const fromEmail =
        process.env.RESEND_FROM_EMAIL || 'FEPN Schedule <schedule@tsv.fepn.senexam.me>'
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: item.studentEmail,
          subject,
          html,
        }),
      })

      if (res.ok) {
        return { email: item.studentEmail, success: true, provider: `Resend (${fromEmail})` }
      }

      const errText = await res.text()

      // Nếu gửi từ địa chỉ khác bị lỗi (ví dụ domain senexam.me chưa verify), tự động fallback sang domain đã verify schedule@tsv.fepn.senexam.me
      if (fromEmail !== 'FEPN Schedule <schedule@tsv.fepn.senexam.me>') {
        const fallbackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FEPN Schedule <schedule@tsv.fepn.senexam.me>',
            to: item.studentEmail,
            subject,
            html,
          }),
        })

        if (fallbackRes.ok) {
          return { email: item.studentEmail, success: true, provider: 'Resend (tsv.fepn verified domain)' }
        }
      }

      console.warn(`[FEPN Reminder] Lỗi gửi mail qua Resend:`, errText)
      let readableError = errText
      try {
        const parsed = JSON.parse(errText)
        if (parsed.message) {
          readableError = parsed.message
        }
      } catch (e) {}

      return { email: item.studentEmail, success: false, error: `Resend: ${readableError}` }
    }

    // ----------------------------------------------------
    // KÊNH 3: BREVO (SENDINBLUE) API
    // ----------------------------------------------------
    const brevoApiKey = process.env.BREVO_API_KEY
    if (brevoApiKey) {
      const brevoSender = process.env.BREVO_SENDER_EMAIL || 'schedule@senexam.me'
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'FEPN Schedule', email: brevoSender },
          to: [{ email: item.studentEmail, name: item.studentName || 'Sinh viên FEPN' }],
          subject,
          htmlContent: html,
        }),
      })

      if (res.ok) {
        return { email: item.studentEmail, success: true, provider: 'Brevo' }
      }

      const errText = await res.text()
      return { email: item.studentEmail, success: false, error: `Brevo API: ${errText}` }
    }

    // ----------------------------------------------------
    // KÊNH 4: CHƯA CẤU HÌNH BẤT KỲ DỊCH VỤ EMAIL NÀO
    // ----------------------------------------------------
    console.warn(`[FEPN Reminder] Chưa cấu hình GMAIL_USER/PASS hoặc RESEND_API_KEY khi gửi tới ${item.studentEmail}`)
    return {
      email: item.studentEmail,
      success: false,
      error:
        'Hệ thống máy chủ chưa được cấu hình biến môi trường gửi email. Vui lòng cấu hình GMAIL_USER + GMAIL_PASS (Mật khẩu ứng dụng Gmail) hoặc RESEND_API_KEY trên Vercel/Hosting.',
    }
  } catch (err: any) {
    console.error(`[FEPN Reminder] Ngoại lệ gửi mail:`, err)
    return { email: item.studentEmail, success: false, error: err.message || 'Lỗi không xác định khi gửi mail' }
  }
}

/**
 * Thuật toán gửi hàng loạt có kiểm soát tải (Batching 5 mail/lần + Delay 600ms)
 * Đảm bảo gửi 30-50 email cùng lúc không bao giờ bị nghẽn socket hoặc 429 Too Many Requests
 */
async function sendControlledBatch(items: ScheduleReminderPayload[]) {
  const BATCH_SIZE = 5
  const DELAY_MS = 600
  const results: Array<{ email: string; success: boolean; error?: string; provider?: string }> = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE)
    const chunkResults = await Promise.all(chunk.map((item) => sendSingleEmail(item)))
    results.push(...chunkResults)

    // Nếu vẫn còn đợt tiếp theo, chờ 600ms trước khi gửi tiếp
    if (i + BATCH_SIZE < items.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
  }

  return results
}

/**
 * Quét toàn bộ môn học trong Supabase và tự động gửi email nhắc nhở trước 30 phút
 * Được kích hoạt bởi Vercel Cron hoặc POST /api/fepn-schedule/send-reminders
 */
async function scanAndDispatchReminders() {
  try {
    const vnTime = getVietnamTime()
    console.log(
      `[FEPN Schedule Scanner] Đang quét lịch học lúc ${vnTime.hours}:${vnTime.minutes < 10 ? '0' : ''}${vnTime.minutes} (Thứ ${vnTime.dayOfWeek}) - ${vnTime.todayStr}`
    )

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (e: any) {
      return {
        success: false,
        error: `Supabase Admin chưa sẵn sàng: ${e.message}`,
      }
    }

    // Lấy toàn bộ môn học có bật notify_email
    const { data: subjects, error } = await supabaseAdmin
      .from('fepn_schedule_subjects')
      .select('*')
      .neq('notify_email', false)

    if (error) {
      return { success: false, error: error.message }
    }

    if (!subjects || subjects.length === 0) {
      return {
        success: true,
        message: 'Không có môn học nào bật thông báo email.',
        scannedCount: 0,
        queuedCount: 0,
      }
    }

    const queueToSend: ScheduleReminderPayload[] = []

    for (const sub of subjects) {
      const email = sub.student_email
      if (!email || !email.includes('@')) continue

      const sessions = Array.isArray(sub.sessions) ? sub.sessions : []
      for (const sess of sessions) {
        if (sess.day_of_week === vnTime.dayOfWeek) {
          const [h, m] = (sess.start_time || '').split(':').map(Number)
          if (isNaN(h)) continue
          const startMinutes = h * 60 + (m || 0)
          const diff = startMinutes - vnTime.totalMinutes

          // Cửa sổ gửi nhắc nhở: trước giờ học từ 20 đến 35 phút (chuẩn ~30 phút)
          if (diff >= 20 && diff <= 35) {
            const dedupeKey = `reminded_${email}_${sub.id}_${sess.id || sess.start_time}_${vnTime.todayStr}`
            if (!sentRemindersToday.has(dedupeKey)) {
              sentRemindersToday.add(dedupeKey)
              queueToSend.push({
                studentEmail: email,
                subjectName: sub.name,
                subjectCode: sub.code,
                shiftName: sess.shift_name || 'Ca học chính khóa',
                startTime: sess.start_time,
                endTime: sess.end_time,
                classroom: sess.classroom || sub.default_classroom || 'Theo thông báo giảng viên',
                lecturers: sub.lecturers,
                sessionType:
                  sess.type === 'practice'
                    ? 'Thực hành / Thí nghiệm'
                    : sess.type === 'exercise'
                    ? 'Bài tập / Thảo luận'
                    : sess.type === 'exam'
                    ? 'Kiểm tra / Thi giữa kỳ'
                    : 'Lý thuyết chính khóa',
                notes: sess.notes,
              })
            }
          }
        }
      }
    }

    if (queueToSend.length === 0) {
      return {
        success: true,
        message: `Đã quét ${subjects.length} môn học. Không có ca học nào bắt đầu trong 20-35 phút tới cần nhắc nhở.`,
        scannedSubjects: subjects.length,
        queuedCount: 0,
        vietnamTime: `${vnTime.hours}:${vnTime.minutes < 10 ? '0' : ''}${vnTime.minutes} (Thứ ${vnTime.dayOfWeek})`,
      }
    }

    const results = await sendControlledBatch(queueToSend)
    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    return {
      success: true,
      message: `Đã gửi thông báo nhắc nhở cho ${queueToSend.length} ca học (Thành công: ${successCount}, Thất bại: ${failCount}).`,
      scannedSubjects: subjects.length,
      queuedCount: queueToSend.length,
      successCount,
      failCount,
      results,
    }
  } catch (err: any) {
    console.error('[FEPN Schedule Scanner Error]:', err)
    return { success: false, error: err.message || 'Lỗi quét và gửi nhắc nhở lịch học' }
  }
}

/**
 * GET /api/fepn-schedule/send-reminders
 * Hỗ trợ 2 mục đích:
 * 1. ?status=1: Kiểm tra trạng thái máy chủ gửi email và chẩn đoán biến môi trường
 * 2. Vercel Cron: Tự động chạy quét lịch học định kỳ mỗi 5 phút
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const isStatusCheck = searchParams.get('status') === '1'

  const providerInfo = getEmailProviderInfo()
  const vnTime = getVietnamTime()

  if (isStatusCheck) {
    return NextResponse.json({
      status: 'online',
      provider: providerInfo.provider,
      configured: providerInfo.configured,
      details: providerInfo.details,
      vietnamTime: `${vnTime.hours}:${vnTime.minutes < 10 ? '0' : ''}${vnTime.minutes} (Thứ ${vnTime.dayOfWeek}), ${vnTime.todayStr}`,
      envInstructions: !providerInfo.configured
        ? 'Để gửi email thực sự về hộp thư sinh viên, hãy thêm biến môi trường trên Vercel: GMAIL_USER + GMAIL_PASS (Khuyên dùng: Dùng mật khẩu ứng dụng Gmail) hoặc RESEND_API_KEY.'
        : undefined,
    })
  }

  // Tự động quét và gửi nhắc nhở (dành cho Vercel Cron)
  const scanResult = await scanAndDispatchReminders()
  return NextResponse.json({
    service: 'FEPN Schedule Reminder Cron',
    provider: providerInfo.provider,
    configured: providerInfo.configured,
    ...scanResult,
  })
}

/**
 * POST /api/fepn-schedule/send-reminders
 * Hỗ trợ 3 chế độ:
 * 1. action: 'test' -> Sinh viên bấm gửi thử nghiệm email từ giao diện
 * 2. action: 'batch' -> Bộ kích hoạt tự động phía client khi phát hiện ca học sắp đến
 * 3. action: 'scan' | 'cron' -> Quét toàn bộ CSDL và gửi hàng loạt
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, items, testItem } = body

    // ========================================================
    // CHẾ ĐỘ 1: GỬI THỬ NGHIỆM TỪ GIAO DIỆN
    // ========================================================
    if (action === 'test' && testItem) {
      const email = testItem.studentEmail
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Địa chỉ email sinh viên không hợp lệ' }, { status: 400 })
      }

      const result = await sendSingleEmail(testItem)
      return NextResponse.json(
        {
          success: result.success,
          provider: result.provider,
          message: result.success
            ? `Đã gửi thành công email nhắc nhở thử nghiệm đến ${email} qua ${result.provider || 'Dịch vụ Email'}. Hãy kiểm tra Hộp thư đến (hoặc thư mục Spam/Quảng cáo)!`
            : `Gửi mail thất bại: ${result.error}`,
          result,
        },
        { status: result.success ? 200 : 400 }
      )
    }

    // ========================================================
    // CHẾ ĐỘ 2: QUÉT TOÀN BỘ CSDL SUPABASE (SCAN / CRON)
    // ========================================================
    if (action === 'scan' || action === 'cron') {
      const scanResult = await scanAndDispatchReminders()
      return NextResponse.json(scanResult)
    }

    // ========================================================
    // CHẾ ĐỘ 3: GỬI THEO DANH SÁCH (BATCH DISPATCH TỪ CLIENT)
    // ========================================================
    if (Array.isArray(items) && items.length > 0) {
      const vnTime = getVietnamTime()
      const queueToSend: ScheduleReminderPayload[] = []

      for (const item of items) {
        if (!item.studentEmail || !item.studentEmail.includes('@')) continue
        const dedupeKey = `reminded_${item.studentEmail}_${item.subjectName}_${item.startTime}_${vnTime.todayStr}`
        if (!sentRemindersToday.has(dedupeKey)) {
          sentRemindersToday.add(dedupeKey)
          queueToSend.push(item)
        }
      }

      if (queueToSend.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Tất cả các ca học trong danh sách đều đã được gửi nhắc nhở hôm nay.',
          sentCount: 0,
        })
      }

      const results = await sendControlledBatch(queueToSend)
      const successCount = results.filter((r) => r.success).length
      const failCount = results.length - successCount

      return NextResponse.json({
        success: true,
        message: `Đã xử lý gửi ${queueToSend.length} email nhắc nhở (Thành công: ${successCount}, Thất bại: ${failCount}).`,
        totalProcessed: queueToSend.length,
        successCount,
        failCount,
        results,
      })
    }

    return NextResponse.json(
      { error: 'Yêu cầu không hợp lệ. Vui lòng cung cấp testItem hoặc items danh sách.' },
      { status: 400 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Lỗi xử lý gửi thông báo lịch học' }, { status: 500 })
  }
}
