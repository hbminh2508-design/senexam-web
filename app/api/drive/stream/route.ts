import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { VIP_DAILY_DOWNLOAD_LIMIT } from '@/lib/vipMembership'
import { SENCASH_COST_PER_VIP_DOWNLOAD } from '@/lib/senCash'

export const dynamic = 'force-dynamic'

// Tài liệu đánh dấu is_vip_only chỉ cho thành viên VIP tải, tối đa VIP_DAILY_DOWNLOAD_LIMIT lượt/ngày.
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
    .select('vip_expires_at')
    .eq('id', user.id)
    .maybeSingle()

  const isVip = !!profile?.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now()
  if (!isVip) return new NextResponse('Tài liệu này chỉ dành cho thành viên VIP', { status: 403 })

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // Chỉ đếm các lượt tải "free" — lượt đã trả bằng SenCash không tính vào hạn mức ngày
  const { count } = await supabaseAdmin
    .from('vip_document_downloads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('paid_with_sencash', false)
    .gte('downloaded_at', startOfToday.toISOString())

  if ((count || 0) < VIP_DAILY_DOWNLOAD_LIMIT) {
    await supabaseAdmin.from('vip_document_downloads').insert({ user_id: user.id, document_id: documentId })
    return null
  }

  // Hết lượt free trong ngày — thử trừ SenCash để mua thêm lượt tải
  const { error: rpcError } = await supabaseAdmin.rpc('adjust_sencash_balance', {
    p_user_id: user.id,
    p_delta: -SENCASH_COST_PER_VIP_DOWNLOAD,
    p_reason: 'vip_download_spend',
    p_reference: documentId,
  })

  if (rpcError) {
    return new NextResponse(
      `Bạn đã dùng hết ${VIP_DAILY_DOWNLOAD_LIMIT} lượt tải VIP miễn phí hôm nay và không đủ SenCash (cần ${SENCASH_COST_PER_VIP_DOWNLOAD} SenCash). Nạp thêm tại /vip.`,
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

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const download = url.searchParams.get('download') === '1'
    const documentId = url.searchParams.get('documentId')

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
      `${download ? 'attachment' : 'inline'}; filename="senexam_file_${fileId}.${ext}"`
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