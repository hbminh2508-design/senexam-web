import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getEffectivePlanTier, DOWNLOAD_LIMIT_BY_TIER } from '@/lib/vipMembership'
import { getEffectiveSenaiTier, SENAI_ULTRA_DAILY_DOWNLOAD_BONUS } from '@/lib/senaiTiers'
import { SENCASH_COST_PER_VIP_DOWNLOAD } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

// Tài liệu đánh dấu is_vip_only chỉ cho thành viên có gói trả phí đang active tải, hạn mức
// miễn phí/ngày tuỳ theo gói (xem DOWNLOAD_LIMIT_BY_TIER — Lite không có lượt free).
// Trả về null nếu được phép, hoặc NextResponse lỗi nếu bị chặn.
async function checkVipDownloadGate(request: NextRequest, documentId: string | null): Promise<NextResponse | null> {
  if (!documentId) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data: doc } = await supabaseAdmin
    .from('library_documents')
    .select('id, is_vip_only')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc?.is_vip_only) return null

  const user = await getUserFromRequest(request)
  if (!user) return new NextResponse('Cần đăng nhập để tải tài liệu VIP', { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('vip_expires_at, plan_tier, senai_tier, senai_tier_expires_at, senai_tier_permanent')
    .eq('id', user.id)
    .maybeSingle()

  const planTier = getEffectivePlanTier(profile)
  // SenAI Ultra tự mở khoá quyền tải tài liệu VIP kể cả khi chưa mua gói membership nào
  const isSenaiUltra = getEffectiveSenaiTier(profile) === 'ultra'
  if (!planTier && !isSenaiUltra) return new NextResponse('Tài liệu này chỉ dành cho thành viên VIP hoặc SenAI Ultra', { status: 403 })

  // Gói Lite không có hạn mức tải miễn phí (0/ngày); SenAI Ultra tặng thẳng 50 lượt/ngày, lấy max
  // với hạn mức theo gói membership (không cộng dồn hai nguồn)
  const dailyFreeLimit = Math.max(planTier ? DOWNLOAD_LIMIT_BY_TIER[planTier] : 0, isSenaiUltra ? SENAI_ULTRA_DAILY_DOWNLOAD_BONUS : 0)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // Chỉ đếm các lượt tải "free" — lượt đã trả bằng SenCash không tính vào hạn mức ngày
  const { count } = await supabaseAdmin
    .from('vip_document_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('paid_with_sencash', false)
    .gte('downloaded_at', startOfToday.toISOString())

  if ((count || 0) < dailyFreeLimit) {
    await supabaseAdmin.from('vip_document_downloads').insert({ user_id: user.id, document_id: documentId })
    return null
  }

  // Hết lượt free trong ngày (hoặc gói không có lượt free) — thử trừ SenCash để mua thêm lượt tải
  const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
    p_user_id: user.id,
    p_delta: -SENCASH_COST_PER_VIP_DOWNLOAD,
    p_reason: 'vip_download_spend',
    p_reference: documentId,
  })

  if (rpcError) {
    const freeLimitMsg = dailyFreeLimit > 0 ? `Bạn đã dùng hết ${dailyFreeLimit} lượt tải VIP miễn phí hôm nay và không` : 'Gói của bạn không có lượt tải VIP miễn phí và không'
    return new NextResponse(
      `${freeLimitMsg} đủ SenCash (cần ${SENCASH_COST_PER_VIP_DOWNLOAD} SenCash). Nạp thêm tại /vip.`,
      { status: 402 }
    )
  }

  await supabaseAdmin.from('vip_document_downloads').insert({ user_id: user.id, document_id: documentId, paid_with_sencash: true })
  return null
}

// Cấu hình OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

const sanitizeDownloadName = (value: string | null, fallback: string) => {
  const normalized = (value || fallback).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const safe = normalized.replace(/[^a-zA-Z0-9._ -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
  return `senexam-${safe || fallback}`
}

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const download = url.searchParams.get('download') === '1'
    const documentId = url.searchParams.get('documentId')
    const requestedFileName = url.searchParams.get('fileName')

    if (!fileId) return new NextResponse('Thiếu fileId', { status: 400 })

    const gateError = await checkVipDownloadGate(request, documentId)
    if (gateError) return gateError

    // 1. Lấy Access Token bảo mật
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error('Không lấy được Access Token từ Google')

    // 2. Bắt lệnh "Range" từ VLC / Trình duyệt để xử lý tua/cắt đoạn
    const rangeHeader = request.headers.get('range')
    const fetchHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}`
    }
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader
    }

    // 3. Dùng Native fetch() tạo đường ống trực tiếp
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders })

    if (!driveResponse.ok) {
      throw new Error(`Drive API Error: ${driveResponse.status}`)
    }

    // 4. 🌟 FIX LỖI PDF Ở ĐÂY: KHÔNG COPY TOÀN BỘ HEADER CỦA GOOGLE NỮA
    // Tạo Headers mới tinh, sạch sẽ để trình duyệt không bị nhầm lẫn
    const responseHeaders = new Headers()
    
    // Header cốt lõi cho VLC và Video
    responseHeaders.set('Accept-Ranges', 'bytes') 
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Cache-Control', 'no-store, max-age=0') // Ép không lưu cache lỗi

    // Phục hồi Content-Type chính xác
    const contentType = driveResponse.headers.get('content-type') || 'application/pdf'
    responseHeaders.set('Content-Type', contentType)

    // Lọc và giữ lại độ dài byte (Bắt buộc phải có để đọc được PDF)
    const contentLength = driveResponse.headers.get('content-length')
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    const contentRange = driveResponse.headers.get('content-range')
    if (contentRange) responseHeaders.set('Content-Range', contentRange)

    // Nội suy đuôi file
    let ext = 'pdf'
    if (contentType.includes('mp4')) ext = 'mp4'
    else if (contentType.includes('matroska')) ext = 'mkv'
    else if (contentType.includes('webm')) ext = 'webm'
    else if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('jpeg')) ext = 'jpg'
    else if (contentType.includes('audio')) ext = 'mp3'

    responseHeaders.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${sanitizeDownloadName(requestedFileName, `${fileId}.${ext}`)}"`
    )

    // 5. Trả thẳng luồng Web Stream cho Client
    return new NextResponse(driveResponse.body, {
      status: driveResponse.status,
      statusText: driveResponse.statusText,
      headers: responseHeaders
    })

  } catch (error) {
    console.error('Lỗi Stream xuyên thấu:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Lỗi hệ thống', { status: 500 })
  }
}