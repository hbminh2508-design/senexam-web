/**
 * Sen Chat Google Drive Service
 * 
 * Quản lý lưu trữ tệp ảnh đã mã hóa E2EE trên Google Drive API.
 * Tuân thủ nghiêm ngặt các nguyên tắc bảo mật của Sen Chat:
 * 1. File đặt ở folder riêng (SEN_CHAT_DRIVE_FOLDER_ID hoặc fallback GOOGLE_DRIVE_FOLDER_ID).
 * 2. Không bao giờ chia sẻ công khai, không cấp link "anyone with the link".
 * 3. Credential/Refresh token chỉ nằm trên server (biến môi trường), không bao giờ gửi xuống client.
 * 4. Xử lý lỗi và tự động thử lại (retry) với exponential backoff khi Drive từ chối hoặc hết hạn token.
 * 5. Cảnh báo khi dung lượng Google Drive đạt trên 85%.
 * 6. Xóa vĩnh viễn file trên Drive khi tin nhắn bị thu hồi, hết hạn tự hủy hoặc tài khoản bị xóa.
 */

import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'

// Khởi tạo OAuth2 Client bảo mật trên server
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Thiếu cấu hình Google OAuth trong biến môi trường (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)')
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  )

  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

export function getDriveClient(): drive_v3.Drive {
  const oauth2Client = getOAuth2Client()
  return google.drive({ version: 'v3', auth: oauth2Client })
}

/**
 * Thư mục chuyên biệt của Sen Chat trên Drive
 */
export function getSenChatDriveFolderId(): string {
  return (
    process.env.SEN_CHAT_DRIVE_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    ''
  )
}

/**
 * Thực thi gọi Drive API với cơ chế tự động thử lại (Retry) và Exponential Backoff
 */
export async function withDriveRetry<T>(
  operation: (drive: drive_v3.Drive) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0
  let delayMs = 1000

  while (attempt < maxRetries) {
    try {
      const drive = getDriveClient()
      return await operation(drive)
    } catch (error: any) {
      attempt++
      const status = error?.status || error?.code || error?.response?.status
      const isRetryable =
        status === 429 || // Too Many Requests / Quota rate limit
        status === 500 || // Backend Error
        status === 502 ||
        status === 503 || // Service Unavailable
        error?.message?.includes('invalid_grant') ||
        error?.message?.includes('Token expired')

      if (attempt >= maxRetries || !isRetryable) {
        console.error(`[SEN_CHAT_DRIVE] Thao tác thất bại sau ${attempt} lần thử:`, error?.message || error)
        throw error
      }

      console.warn(`[SEN_CHAT_DRIVE] Lỗi tạm thời (${status || error?.message}), thử lại lần ${attempt}/${maxRetries} sau ${delayMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
      delayMs *= 2
    }
  }

  throw new Error('Drive operation exceeded max retries')
}

/**
 * Kiểm tra hạn mức dung lượng Google Drive và ghi log cảnh báo khi dung lượng sắp đầy (>= 85%)
 */
export async function checkDriveStorageQuota(): Promise<{
  usageBytes: number
  limitBytes: number
  usagePercent: number
  isNearFull: boolean
}> {
  try {
    const res = await withDriveRetry(async (drive) => {
      return await drive.about.get({
        fields: 'storageQuota',
      })
    })

    const quota = res.data.storageQuota
    const usage = parseInt(quota?.usage || '0', 10)
    const limit = parseInt(quota?.limit || '0', 10)

    const usagePercent = limit > 0 ? (usage / limit) * 100 : 0
    const isNearFull = usagePercent >= 85

    if (isNearFull) {
      console.warn(
        `⚠️ [SEN_CHAT_DRIVE_STORAGE_WARNING] CẢNH BÁO: Dung lượng Google Drive của Sen Chat sắp đầy! Đã dùng ${usagePercent.toFixed(
          1
        )}% (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / ${(limit / 1024 / 1024 / 1024).toFixed(2)}GB). Cần mở rộng quota hoặc dọn dẹp file cũ.`
      )
    }

    return {
      usageBytes: usage,
      limitBytes: limit,
      usagePercent,
      isNearFull,
    }
  } catch (err: any) {
    console.error('[SEN_CHAT_DRIVE] Không thể kiểm tra storage quota:', err?.message || err)
    return {
      usageBytes: 0,
      limitBytes: 0,
      usagePercent: 0,
      isNearFull: false,
    }
  }
}

/**
 * Upload tệp ảnh đã mã hóa E2EE lên Google Drive.
 * File chỉ chứa blob mã hóa nhị phân, không công khai, không link chia sẻ.
 */
export async function uploadEncryptedImageToDrive(params: {
  buffer: Buffer
  fileName?: string
  mimeType?: string
}): Promise<{ fileId: string; sizeBytes: number }> {
  // Kiểm tra cảnh báo quota trước khi upload
  checkDriveStorageQuota().catch(() => {})

  const folderId = getSenChatDriveFolderId()
  const safeName = params.fileName || `senchat-enc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.bin`

  const fileMetadata: drive_v3.Schema$File = {
    name: safeName,
    parents: folderId ? [folderId] : undefined,
    description: 'Sen Chat E2EE Encrypted Blob (Private Attachment)',
  }

  const media = {
    mimeType: 'application/octet-stream', // Luôn lưu dạng binary blob mã hóa
    body: Readable.from(params.buffer),
  }

  const result = await withDriveRetry(async (drive) => {
    const res = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, size, name',
    })
    return res.data
  })

  if (!result.id) {
    throw new Error('Google Drive không trả về fileId sau khi tải lên')
  }

  return {
    fileId: result.id,
    sizeBytes: params.buffer.length,
  }
}

/**
 * Lấy luồng tải tệp từ Google Drive phục vụ người dùng hợp lệ
 * Trả về Web ReadableStream chuẩn tương thích trực tiếp với NextResponse trong Next.js App Router,
 * hoặc fallback đọc buffer an toàn.
 */
export async function getDriveFileStream(
  fileId: string,
  rangeHeader?: string | null
): Promise<{
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream | Buffer
  contentType: string
  contentLength?: string | null
  contentRange?: string | null
  status: number
}> {
  return await withDriveRetry(async () => {
    const oauth2Client = getOAuth2Client()
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error('Không thể lấy Access Token từ Google OAuth')

    const fetchHeaders: HeadersInit = {
      Authorization: `Bearer ${token}`,
    }
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders })

    if (!driveResponse.ok) {
      const err: any = new Error(`Google Drive API trả về lỗi: ${driveResponse.status} ${driveResponse.statusText}`)
      err.status = driveResponse.status
      throw err
    }

    const bodyStream = driveResponse.body
    if (!bodyStream) {
      // Fallback đọc buffer an toàn, không để stream bị hỏng hay treo
      const arrayBuffer = await driveResponse.arrayBuffer()
      return {
        stream: Buffer.from(arrayBuffer),
        contentType: driveResponse.headers.get('content-type') || 'application/octet-stream',
        contentLength: String(arrayBuffer.byteLength),
        contentRange: driveResponse.headers.get('content-range'),
        status: driveResponse.status,
      }
    }

    return {
      stream: bodyStream as ReadableStream<Uint8Array>,
      contentType: driveResponse.headers.get('content-type') || 'application/octet-stream',
      contentLength: driveResponse.headers.get('content-length'),
      contentRange: driveResponse.headers.get('content-range'),
      status: driveResponse.status,
    }
  })
}

/**
 * Xóa vĩnh viễn tệp trên Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return false

  return await withDriveRetry(async (drive) => {
    try {
      await drive.files.delete({ fileId })
      return true
    } catch (err: any) {
      // Nếu file đã bị xóa trước đó (404), coi như thành công
      if (err?.status === 404 || err?.code === 404) {
        return true
      }
      throw err
    }
  })
}

/**
 * Xóa danh sách nhiều file Drive trong một lượt (batch)
 */
export async function deleteDriveFilesBatch(fileIds: string[]): Promise<{ deleted: number; errors: number }> {
  let deleted = 0
  let errors = 0

  for (const fileId of fileIds) {
    if (!fileId) continue
    try {
      const ok = await deleteDriveFile(fileId)
      if (ok) deleted++
    } catch (err) {
      errors++
      console.error(`[SEN_CHAT_DRIVE] Lỗi xóa file ${fileId}:`, err)
    }
  }

  return { deleted, errors }
}
