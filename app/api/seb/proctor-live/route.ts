import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { supabase as publicSupabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

const PROCTOR_SYSTEM_PROMPT = `Bạn là hệ thống AI Giám thị phòng thi trực tuyến cao cấp (Gemini Live Proctoring Engine).
Nhiệm vụ: Phân tích khung hình camera của thí sinh để PHÁT HIỆN GIAN LẬN, ĐẶC BIỆT LÀ HÀNH VI SỬ DỤNG ĐIỆN THOẠI THÔNG MINH TRONG GIỜ THI.

PHÂN BIỆT RÕ RÀNG VỚI MÁY TÍNH CẦM TAY CASIO / VINACAL / MÁY TÍNH KHOA HỌC (DỤNG CỤ HỌC TẬP HỢP LỆ):
- Máy tính cầm tay Casio (như FX-570, FX-580VNX, Vinacal...) có đặc điểm: thân máy bằng nhựa dày, có nhiều phím bấm vật lý bằng cao su/nhựa, màn hình LCD nhỏ đơn sắc ở nửa trên, nắp trượt nhựa ở lưng máy, KHÔNG CÓ CỤM CAMERA SAU BẰNG KÍNH, KHÔNG PHẢI MÀN HÌNH CẢM ỨNG LỚN.
- ĐÂY LÀ DỤNG CỤ HỌC TẬP ĐƯỢC PHÉP 100% TRONG PHÒNG THI!
- NẾU PHÁT HIỆN THÍ SINH CẦM/SỬ DỤNG MÁY TÍNH CẦM TAY CASIO / VINACAL HOẶC DỤNG CỤ HỌC TẬP: TUYỆT ĐỐI KHÔNG BÁO LỖI, KHÔNG PHÁT CẢNH BÁO, ĐẶT:
  "phone_detected": false,
  "rear_camera_detected": false,
  "suspicious": false,
  "violation_type": "none",
  "severity": "info",
  "description": "Sử dụng máy tính cầm tay hợp lệ"

QUY TẮC PHÁT HIỆN ĐIỆN THOẠI THÔNG MINH (SMARTPHONE):
- Nhận diện chính xác điện thoại thông minh: màn hình cảm ứng kính toàn phần phẳng, mặt lưng có cụm ống kính camera kính lồi/tròn (camera bump / camera island, ống kính kép/ba mắt tròn), viền kim loại/kính phẳng, không có hàng phím số cao su vật lý.
- Động tác cầm giơ điện thoại ngang mặt hoặc hướng ống kính camera sau về màn hình/webcam.
- Khi phát hiện điện thoại thông minh:
  "phone_detected": true,
  "rear_camera_detected": true,
  "suspicious": true,
  "violation_type": "phone_detected",
  "severity": "warning",
  "confidence": 95,
  "description": "Cảnh báo: Phát hiện thí sinh sử dụng điện thoại di động"

CÁC VI PHẠM KHÁC:
- Camera bị che mờ, đen xì, lấy tay hoặc vật thể che ống kính: is_camera_blocked = true, suspicious = true, violation_type = "camera_blocked"
- Tài liệu giấy, sách, phao thi: cheat_sheet_detected = true, suspicious = true, violation_type = "cheat_sheet_detected"
- Có người thứ 2 xuất hiện: multiple_people = true, suspicious = true, violation_type = "multiple_people"
- Không thấy mặt thí sinh (quay đi chỗ khác): face_detected = false, suspicious = true, violation_type = "face_missing"
- Nếu bình thường không có vi phạm: suspicious = false, phone_detected = false, violation_type = "none", severity = "info", description = "Làm bài nghiêm túc"

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (CHỈ TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON, KHÔNG BỌC VĂN BẢN KHÁC):
{
  "is_camera_blocked": false,
  "phone_detected": false,
  "rear_camera_detected": false,
  "cheat_sheet_detected": false,
  "face_detected": true,
  "multiple_people": false,
  "suspicious": false,
  "violation_type": "none",
  "severity": "info",
  "confidence": 95,
  "description": "Làm bài nghiêm túc"
}`

function extractJson(raw: string): any {
  if (!raw) return null
  let cleaned = raw.trim()
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim()
  } else {
    const braceMatch = cleaned.match(/({[\s\S]*})/)
    if (braceMatch) {
      cleaned = braceMatch[1].trim()
    }
  }
  try {
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Không thể parse JSON từ Gemini Proctoring:', cleaned)
    return null
  }
}

// Lấy client Supabase với quyền ghi log an toàn
function getDbClient() {
  try {
    return getSupabaseAdmin()
  } catch (e) {
    return publicSupabase
  }
}

// POST: Xử lý frame camera hoặc báo cáo trạng thái không có camera
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    const {
      action = 'analyze_frame',
      image,
      examId,
      userId,
      userInfo = {},
    } = body

    const db = getDbClient()

    // 1. Hành động Báo cáo Thí sinh Không có Camera
    if (action === 'report_no_camera') {
      try {
        await db.from('exam_proctoring_logs').insert({
          exam_id: String(examId || ''),
          user_id: userId || null,
          user_name: userInfo.fullName || userInfo.name || 'Học sinh',
          user_email: userInfo.email || '',
          user_phone: userInfo.phone || userInfo.phoneNumber || '',
          school: userInfo.school || '',
          class_name: userInfo.className || userInfo.grade || '',
          province: userInfo.province || '',
          subject: userInfo.subject || '',
          has_camera: false,
          is_active: true,
          is_disqualified: false,
          violation_type: 'no_camera',
          severity: 'info',
          confidence: 100,
          details: 'Thí sinh vào thi nhưng thiết bị không có camera hoặc từ chối cấp quyền camera',
        })
      } catch (logErr) {
        console.warn('Lỗi ghi log no_camera vào Supabase:', logErr)
      }

      return NextResponse.json({
        success: true,
        hasCamera: false,
        message: 'Đã báo về hệ thống quản trị: Thí sinh thi không có camera.',
      })
    }

    // 2. Hành động Nhịp tim (Heartbeat) xác nhận thí sinh vẫn đang làm bài
    if (action === 'heartbeat') {
      return NextResponse.json({
        success: true,
        isActive: true,
        timestamp: Date.now(),
      })
    }

    // 3. Hành động Phân tích Khung hình Camera bằng Gemini 3.8 Live
    if (!image) {
      return NextResponse.json({ error: 'Thiếu dữ liệu ảnh camera' }, { status: 400 })
    }

    if (!ai) {
      // Nếu chưa có API key thì trả về trạng thái cảnh báo để client hiển thị
      return NextResponse.json({
        is_camera_blocked: false,
        phone_detected: false,
        rear_camera_detected: false,
        cheat_sheet_detected: false,
        face_detected: true,
        multiple_people: false,
        suspicious: false,
        violation_type: 'none',
        severity: 'warning',
        confidence: 0,
        has_api_error: true,
        error: 'CHƯA_CẤU_HÌNH_API_KEY',
        description: 'Chưa cấu hình GEMINI_API_KEY trên Server',
        is_disqualified: false,
      })
    }

    // Chuẩn bị Base64 ảnh sạch
    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image

    // Động cơ xử lý phân tích camera thông thường: sử dụng chuẩn 'gemini-3.5-flash-lite'
    // Lưu ý: Tuyệt đối không dùng 'gemini-2.5-flash' vì đã lỗi thời và ngừng hỗ trợ
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
    ]

    let resultJson: any = null
    let modelUsed = ''

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
                {
                  text: PROCTOR_SYSTEM_PROMPT,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })

        const text = response.text || ''
        const parsed = extractJson(text)
        if (parsed && typeof parsed === 'object') {
          resultJson = parsed
          modelUsed = modelName
          break
        }
      } catch (err: any) {
        console.warn(`Thử model ${modelName} cho proctoring thất bại:`, err?.message || err)
      }
    }

    // Nếu các model cloud gặp sự cố hoặc vượt quota
    if (!resultJson) {
      resultJson = {
        is_camera_blocked: false,
        phone_detected: false,
        rear_camera_detected: false,
        cheat_sheet_detected: false,
        face_detected: true,
        multiple_people: false,
        suspicious: false,
        violation_type: 'none',
        severity: 'info',
        confidence: 0,
        has_api_error: true,
        description: 'Đang kết nối lại mạng Gemini AI...',
      }
    }

    const isPhoneViolation = Boolean(resultJson.phone_detected || resultJson.rear_camera_detected)
    const isSuspicious = Boolean(resultJson.suspicious && resultJson.violation_type !== 'none')

    // 4. NGUYÊN TẮC LƯU ẢNH BẰNG CHỨNG:
    // "nếu không phát hiện thì không cần lưu ảnh, còn có vi phạm mới lưu ảnh"
    if (isSuspicious || isPhoneViolation) {
      try {
        const snapshotUri = image.startsWith('data:image')
          ? image
          : `data:image/jpeg;base64,${cleanBase64}`

        await db.from('exam_proctoring_logs').insert({
          exam_id: String(examId || ''),
          user_id: userId || null,
          user_name: userInfo.fullName || userInfo.name || 'Học sinh',
          user_email: userInfo.email || '',
          user_phone: userInfo.phone || userInfo.phoneNumber || '',
          school: userInfo.school || '',
          class_name: userInfo.className || userInfo.grade || '',
          province: userInfo.province || '',
          subject: userInfo.subject || '',
          has_camera: true,
          is_active: true,
          is_disqualified: false,
          violation_type: isPhoneViolation ? 'phone_detected' : (resultJson.violation_type || 'suspicious_activity'),
          severity: isPhoneViolation ? 'warning' : (resultJson.severity || 'warning'),
          confidence: Number(resultJson.confidence) || 95,
          snapshot_url: snapshotUri,
          details: isPhoneViolation
            ? 'Cảnh báo: Phát hiện hình ảnh điện thoại (camera sau) - Đã lưu ảnh bằng chứng cho Quản trị viên'
            : (resultJson.description || 'Phát hiện hành vi nghi vấn gian lận thi cử'),
        })
      } catch (dbErr) {
        console.error('Lỗi khi lưu bằng chứng vi phạm vào Supabase:', dbErr)
      }
    }

    return NextResponse.json({
      ...resultJson,
      is_disqualified: false,
      modelUsed,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Lỗi API proctoring live:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi xử lý giám thị camera' },
      { status: 500 }
    )
  }
}
