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
