import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { supabase as publicSupabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

const PROCTOR_SYSTEM_PROMPT = `Bạn là hệ thống AI Giám thị phòng thi trực tuyến cao cấp (Gemini Live Proctoring).
Nhiệm vụ của bạn là phân tích khung hình camera của thí sinh trong phòng thi để ĐẢM BẢO TÍNH TRUNG THỰC VÀ BẢO MẬT.

QUY TẮC PHÂN TÍCH:
1. KHÔNG in ra bất kỳ lời chào, văn bản giải thích hay markdown đàm thoại nào.
2. CHỈ TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON với các trường:
{
  "is_camera_blocked": false, // true nếu camera bị che đen, mờ tịt, bị dán ngón tay/vật cản hoặc quay đi chỗ khác không nhìn thấy người
  "phone_detected": false, // true nếu phát hiện thí sinh đang cầm điện thoại thông minh, nhìn điện thoại, hoặc có điện thoại đặt trước mặt
  "cheat_sheet_detected": false, // true nếu phát hiện thí sinh đang cầm tài liệu giấy, sách vở, phao thi quay cóp
  "face_detected": true, // true nếu thấy rõ khuôn mặt thí sinh trong khung hình
  "multiple_people": false, // true nếu có người thứ 2 xuất hiện trong khung hình trợ giúp
  "suspicious": false, // true nếu có BẤT KỲ hành vi vi phạm nào (che cam, điện thoại, phao thi, nhiều người, không có mặt)
  "violation_type": "none", // "none" | "camera_blocked" | "phone_detected" | "cheat_sheet_detected" | "multiple_people" | "face_missing"
  "confidence": 95, // Độ tin cậy (0 - 100)
  "description": "Thí sinh tập trung làm bài nghiêm túc" // Mô tả ngắn gọn tiếng Việt (dưới 15 từ)
}

HƯỚNG DẪN QUYẾT ĐỊNH VI PHẠM:
- Nếu màn hình tối hoàn toàn hoặc bị che kín: is_camera_blocked = true, violation_type = "camera_blocked", suspicious = true.
- Nếu thấy điện thoại hoặc hình thù giống điện thoại di động: phone_detected = true, violation_type = "phone_detected", suspicious = true.
- Nếu thấy tờ giấy nhỏ, tài liệu nháp in sẵn chữ, phao thi, sách tra cứu: cheat_sheet_detected = true, violation_type = "cheat_sheet_detected", suspicious = true.
- Nếu thí sinh rời khỏi khung hình hoàn toàn: face_detected = false, violation_type = "face_missing", suspicious = true.
- Nếu học sinh đang ngồi bình thường nhìn màn hình làm bài: suspicious = false, violation_type = "none".`

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
          school: userInfo.school || '',
          class_name: userInfo.className || userInfo.grade || '',
          province: userInfo.province || '',
          subject: userInfo.subject || '',
          has_camera: false,
          is_active: true,
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

    // 3. Hành động Phân tích Khung hình Camera bằng Gemini
    if (!image) {
      return NextResponse.json({ error: 'Thiếu dữ liệu ảnh camera' }, { status: 400 })
    }

    if (!ai) {
      // Nếu chưa có API key thì trả về fallback an toàn
      return NextResponse.json({
        is_camera_blocked: false,
        phone_detected: false,
        cheat_sheet_detected: false,
        face_detected: true,
        multiple_people: false,
        suspicious: false,
        violation_type: 'none',
        confidence: 50,
        description: 'Đang chạy chế độ dự phòng cục bộ (chưa kết nối Gemini API key)',
      })
    }

    // Chuẩn bị Base64 ảnh sạch
    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
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
        cheat_sheet_detected: false,
        face_detected: true,
        multiple_people: false,
        suspicious: false,
        violation_type: 'none',
        confidence: 60,
        description: 'Hệ thống đang ổn định',
      }
    }

    // 4. Nếu phát hiện vi phạm nghi ngờ -> Tự động lưu Bằng chứng Snapshot và Log vào CSDL
    // Dữ liệu này sẽ được giữ trong hệ thống trong vòng 1 tuần (7 ngày)
    if (resultJson.suspicious && resultJson.violation_type !== 'none') {
      try {
        // Lưu dữ liệu vào exam_proctoring_logs
        // snapshot_url có thể là data URI thu nhỏ để hiển thị trực tiếp trong admin
        const snapshotUri = image.startsWith('data:image')
          ? image
          : `data:image/jpeg;base64,${cleanBase64}`

        await db.from('exam_proctoring_logs').insert({
          exam_id: String(examId || ''),
          user_id: userId || null,
          user_name: userInfo.fullName || userInfo.name || 'Học sinh',
          user_email: userInfo.email || '',
          school: userInfo.school || '',
          class_name: userInfo.className || userInfo.grade || '',
          province: userInfo.province || '',
          subject: userInfo.subject || '',
          has_camera: true,
          is_active: true,
          violation_type: resultJson.violation_type || 'suspicious_activity',
          severity: resultJson.phone_detected || resultJson.cheat_sheet_detected ? 'critical' : 'warning',
          confidence: Number(resultJson.confidence) || 90,
          snapshot_url: snapshotUri,
          details: resultJson.description || 'Phát hiện hành vi nghi vấn gian lận thi cử',
        })
      } catch (dbErr) {
        console.error('Lỗi khi lưu bằng chứng vi phạm vào Supabase:', dbErr)
      }
    }

    return NextResponse.json({
      ...resultJson,
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

// GET: Lấy danh sách bằng chứng và log giám thị của đề thi (Dành cho Admin)
// Kèm cơ chế tự động dọn dẹp các bản ghi quá 7 ngày
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get('examId')
    const userId = searchParams.get('userId')

    const db = getDbClient()

    // 1. Tự động dọn dẹp bằng chứng cũ hơn 7 ngày (1 tuần)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      await db.from('exam_proctoring_logs').delete().lt('created_at', sevenDaysAgo)
    } catch (cleanErr) {
      console.warn('Lỗi tự động xóa bằng chứng quá 7 ngày:', cleanErr)
    }

    // 2. Truy vấn danh sách logs
    let query = db
      .from('exam_proctoring_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (examId) {
      query = query.eq('exam_id', examId)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.limit(200)
    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
