import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ExamAccessRecord {
  code: string
  userId: string
  userEmail: string
  examId: string
  tokenHash?: string
  actionLink?: string
  deviceId?: string
  createdAt: number
  expiresAt: number
  used: boolean
}

// In-memory store cho mã 6 số (TTL = 30 phút)
const codeStore = new Map<string, ExamAccessRecord>()
const userExamCodeMap = new Map<string, string>()

// Tự động dọn dẹp mã hết hạn định kỳ
function cleanExpiredCodes() {
  const now = Date.now()
  for (const [code, record] of codeStore.entries()) {
    if (record.expiresAt < now || record.used) {
      codeStore.delete(code)
      userExamCodeMap.delete(`${record.userId}_${record.examId}`)
    }
  }
}

export async function POST(request: Request) {
  try {
    cleanExpiredCodes()

    const body = await request.json()
    const { action } = body

    const admin = getSupabaseAdmin()

    // 1. SINH MÃ 6 SỐ VÀO THI
    if (action === 'generate_code') {
      const { userId, userEmail, examId, deviceId } = body

      if (!userId || !examId) {
        return NextResponse.json({ error: 'Thiếu userId hoặc examId' }, { status: 400 })
      }

      // Kiểm tra xem đã có mã còn hiệu lực cho cặp user + exam này chưa
      const mapKey = `${userId}_${examId}`
      const existingCode = userExamCodeMap.get(mapKey)
      if (existingCode) {
        const existingRecord = codeStore.get(existingCode)
        if (existingRecord && !existingRecord.used && existingRecord.expiresAt > Date.now() + 60000) {
          return NextResponse.json({
            success: true,
            code: existingRecord.code,
            expiresAt: existingRecord.expiresAt,
            examId: existingRecord.examId,
            isExisting: true,
          })
        }
      }

      // Sinh mã 6 số mới ngẫu nhiên
      const newCode = Math.floor(100000 + Math.random() * 900000).toString()

      // Tạo Magiclink token hash cho user qua Supabase Admin SDK (nếu có email)
      let tokenHash = ''
      let actionLink = ''
      if (userEmail) {
        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: userEmail,
          })
          tokenHash = linkData?.properties?.hashed_token || ''
          actionLink = linkData?.properties?.action_link || ''
        } catch (linkErr: any) {
          console.warn('Lỗi sinh magiclink cho mã 6 số:', linkErr?.message)
        }
      }

      const expiresAt = Date.now() + 30 * 60 * 1000 // 30 phút

      const record: ExamAccessRecord = {
        code: newCode,
        userId,
        userEmail: userEmail || '',
        examId,
        tokenHash,
        actionLink,
        deviceId,
        createdAt: Date.now(),
        expiresAt,
        used: false,
      }

      codeStore.set(newCode, record)
      userExamCodeMap.set(mapKey, newCode)

      // Lưu vết vào bảng seb_access_codes trong CSDL Supabase (nếu có bảng)
      try {
        await admin.from('seb_access_codes').insert({
          code: newCode,
          user_id: userId,
          user_email: userEmail || null,
          exam_id: examId,
          token_hash: tokenHash || null,
          action_link: actionLink || null,
          device_id: deviceId || null,
          expires_at: new Date(expiresAt).toISOString(),
          used: false,
        })
      } catch (dbErr: any) {
        console.warn('Lưu vết seb_access_codes vào CSDL:', dbErr?.message)
      }

      return NextResponse.json({
        success: true,
        code: newCode,
        expiresAt,
        examId,
      })
    }

    // 2. XÁC THỰC MÃ 6 SỐ ĐỂ ĐĂNG NHẬP (TỪ SEB-LOGIN HOẶC THIẾT BỊ KHÁC)
    if (action === 'verify_and_login') {
      const { code } = body
      const cleanCode = String(code || '').trim().replace(/\s+/g, '')

      if (!cleanCode || cleanCode.length !== 6) {
        return NextResponse.json({ error: 'Mã số không hợp lệ. Vui lòng nhập đúng 6 chữ số!' }, { status: 400 })
      }

      const record = codeStore.get(cleanCode)
      if (!record) {
        // Tra cứu fallback từ CSDL Supabase nếu cache server đã khởi động lại
        try {
          const { data: dbCode } = await admin
            .from('seb_access_codes')
            .select('*')
            .eq('code', cleanCode)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .maybeSingle()

          if (dbCode) {
            await admin
              .from('seb_access_codes')
              .update({ used: true, used_at: new Date().toISOString() })
              .eq('id', dbCode.id)

            return NextResponse.json({
              success: true,
              examId: dbCode.exam_id,
              userId: dbCode.user_id,
              userEmail: dbCode.user_email,
              tokenHash: dbCode.token_hash,
              actionLink: dbCode.action_link,
            })
          }
        } catch (dbSearchErr) {}

        return NextResponse.json({ error: 'Mã dự thi không tồn tại hoặc đã hết hạn!' }, { status: 404 })
      }

      if (record.used) {
        return NextResponse.json({ error: 'Mã dự thi này đã được sử dụng!' }, { status: 400 })
      }

      if (record.expiresAt < Date.now()) {
        codeStore.delete(cleanCode)
        return NextResponse.json({ error: 'Mã dự thi đã hết hạn hiệu lực (quá 30 phút)!' }, { status: 400 })
      }

      // Đánh dấu đã dùng
      record.used = true
      codeStore.delete(cleanCode)
      userExamCodeMap.delete(`${record.userId}_${record.examId}`)

      // Cập nhật CSDL
      try {
        await admin
          .from('seb_access_codes')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('code', cleanCode)
      } catch (e) {}

      return NextResponse.json({
        success: true,
        examId: record.examId,
        userId: record.userId,
        userEmail: record.userEmail,
        tokenHash: record.tokenHash,
        actionLink: record.actionLink,
      })
    }

    // 3. CHẤM DỨT PHIÊN CÁC THIẾT BỊ KHÁC (KHI BẮT ĐẦU VÀO THI)
    if (action === 'enter_exam_and_terminate_others') {
      const { userId, examId, deviceId } = body

      if (!userId) {
        return NextResponse.json({ error: 'Thiếu thông tin userId' }, { status: 400 })
      }

      // Hủy kích hoạt tất cả các phiên thiết bị khác trong fepn_user_sessions
      try {
        if (deviceId) {
          await admin
            .from('fepn_user_sessions')
            .update({ is_active: false })
            .eq('user_id', userId)
            .neq('device_id', deviceId)
        } else {
          await admin
            .from('fepn_user_sessions')
            .update({ is_active: false })
            .eq('user_id', userId)
        }
      } catch (sessErr: any) {
        console.warn('Lỗi thu hồi sessions thiết bị khác:', sessErr?.message)
      }

      // Cập nhật trạng thái chấm dứt phiên trong seb_access_codes và profiles
      try {
        await admin
          .from('seb_access_codes')
          .update({ terminated_other_sessions: true })
          .eq('user_id', userId)
          .eq('exam_id', examId)

        const activeSessionKey = `seb_${Date.now()}`
        await admin
          .from('profiles')
          .update({
            active_seb_session: activeSessionKey,
            last_seb_exam_id: examId,
            last_seb_exam_at: new Date().toISOString(),
          })
          .eq('id', userId)
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'Đã kích hoạt bảo mật phòng thi và chấm dứt tất cả các thiết bị khác!',
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    console.error('Lỗi API /api/seb/exam-access:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi hệ thống' }, { status: 500 })
  }
}
