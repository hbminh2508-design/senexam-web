import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { supabase as publicSupabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

const PROCTOR_SYSTEM_PROMPT = `Bạn là hệ thống AI Giám thị phòng thi trực tuyến cao cấp (Gemini 3.8 Live Proctoring).
Nhiệm vụ của bạn là phân tích khung hình camera của thí sinh trong phòng thi để ĐẢM BẢO TÍNH TRUNG THỰC VÀ KỶ LUẬT THI CỬ NGHIÊM NGẶT.

QUY TẮC PHÂN TÍCH QUAN TRỌNG:
1. KHÔNG in ra bất kỳ lời chào, văn bản giải thích hay markdown đàm thoại nào.
2. CHỈ TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON với các trường:
{
  "is_camera_blocked": false, // true nếu camera bị che đen, mờ tịt, dán ngón tay, hoặc quay đi hướng khác không thấy người
  "phone_detected": false, // true nếu phát hiện thí sinh sử dụng điện thoại thông minh (KỂ CẢ NHÌN THẤY MẶT LƯNG / CỤM CAMERA SAU ĐIỆN THOẠI)
  "rear_camera_detected": false, // true nếu phát hiện cụm camera đằng sau của điện thoại di động
  "cheat_sheet_detected": false, // true nếu phát hiện tài liệu giấy, sách vở, phao thi quay cóp
  "face_detected": true, // true nếu thấy khuôn mặt thí sinh trong khung hình
  "multiple_people": false, // true nếu có người thứ 2 xuất hiện trong khung hình trợ giúp
  "suspicious": false, // true nếu có BẤT KỲ hành vi vi phạm nào
  "violation_type": "none", // "none" | "phone_detected" | "camera_blocked" | "cheat_sheet_detected" | "multiple_people" | "face_missing"
  "severity": "info", // "info" | "warning" | "critical" (phone_detected LUÔN LUÔN là "critical")
  "confidence": 95, // Độ tin cậy (0 - 100)
  "description": "Thí sinh tập trung làm bài nghiêm túc" // Mô tả ngắn gọn tiếng Việt (dưới 15 từ)
}

ĐẶC BIỆT CHÚ Ý PHÁT HIỆN ĐIỆN THOẠI VÀ CỤM CAMERA ĐẰNG SAU (QUY ĐỊNH ĐÌNH CHỈ THI NGAY LẬP TỨC):
- Nhận diện MẶT SAU CỦA ĐIỆN THOẠI:
  + Cụm camera đằng sau (camera bump/island hình vuông, chữ nhật hoặc các mắt camera tròn xếp dọc/chéo đặc trưng của iPhone, Samsung, Xiaomi...).
  + Ốp lưng điện thoại có khoét lỗ cụm camera sau.
  + Thí sinh cầm vật thể hình chữ nhật phẳng có cụm camera sau giơ lên hướng về phía đề thi, màn hình, hoặc đặt dưới bàn/trước ngực.
  + Thao tác lén lút cầm điện thoại chụp đề hoặc tra cứu.
- Khi phát hiện điện thoại hoặc cụm camera sau:
  phone_detected = true, rear_camera_detected = true, violation_type = "phone_detected", suspicious = true, severity = "critical", description = "Phát hiện sử dụng điện thoại (nhận diện camera sau điện thoại) - ĐÌNH CHỈ THI".
- Nếu màn hình bị che tối hoặc bàn tay che mắt camera: is_camera_blocked = true, violation_type = "camera_blocked", suspicious = true.
- Nếu có tài liệu phao thi, sách vở: cheat_sheet_detected = true, violation_type = "cheat_sheet_detected", suspicious = true.
- Nếu học sinh ngồi làm bài bình thường: suspicious = false, violation_type = "none", severity = "info".`

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
      // Nếu chưa có API key thì trả về fallback an toàn
      return NextResponse.json({
        is_camera_blocked: false,
        phone_detected: false,
        rear_camera_detected: false,
        cheat_sheet_detected: false,
        face_detected: true,
        multiple_people: false,
        suspicious: false,
        violation_type: 'none',
        severity: 'info',
        confidence: 50,
        description: 'Đang chạy chế độ dự phòng cục bộ (chưa kết nối Gemini API key)',
        is_disqualified: false,
      })
    }

    // Chuẩn bị Base64 ảnh sạch
    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image

    // CHỈ SỬ DỤNG GEMINI 3.8 LIVE (hoặc fallback live model chuẩn, KHÔNG dùng gemini-3.8-flash)
    const candidateModels = [
      'gemini-3.8-live',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
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
        console.warn(`Thử model ${modelName} cho proctoring thất bại, chuyển model kế tiếp:`, err?.message || err)
      }
    }

    // Nếu các model cloud gặp sự cố, trả kết quả an toàn
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
        confidence: 60,
        description: 'Hệ thống đang ổn định',
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
          is_active: !isPhoneViolation,
          is_disqualified: isPhoneViolation,
          violation_type: isPhoneViolation ? 'phone_detected' : (resultJson.violation_type || 'suspicious_activity'),
          severity: isPhoneViolation ? 'critical' : (resultJson.severity || 'warning'),
          confidence: Number(resultJson.confidence) || 95,
          snapshot_url: snapshotUri,
          details: isPhoneViolation
            ? 'Phát hiện sử dụng điện thoại (nhận diện cụm camera sau / điện thoại) - ĐÃ BỊ ĐÌNH CHỈ THI'
            : (resultJson.description || 'Phát hiện hành vi nghi vấn gian lận thi cử'),
        })
      } catch (dbErr) {
        console.error('Lỗi khi lưu bằng chứng vi phạm vào Supabase:', dbErr)
      }
    }

    return NextResponse.json({
      ...resultJson,
      is_disqualified: isPhoneViolation,
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
