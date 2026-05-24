type ResponsePayload = {
  ok: boolean
  data?: any
  error?: string
}

const readResponsePayload = async (response: Response): Promise<ResponsePayload> => {
  const contentType = response.headers.get('content-type') || ''
  const rawText = await response.text()

  if (!rawText && response.ok) {
    return { ok: true, data: {} }
  }

  if (contentType.includes('application/json')) {
    try {
      return { ok: true, data: JSON.parse(rawText) }
    } catch (error) {
      return { ok: false, error: rawText || 'Phản hồi JSON không hợp lệ.' }
    }
  }

  return { ok: false, error: rawText || `Lỗi kết nối server (${response.status})` }
}

export const initGoogleDriveUpload = async (fileName: string, mimeType: string) => {
  const response = await fetch('/api/upload-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, mimeType }),
  })

  const payload = await readResponsePayload(response)
  if (!payload.ok || !response.ok) {
    throw new Error((payload as ResponsePayload).error || 'Không thể kết nối Google Drive.')
  }

  const uploadUrl = payload.data?.uploadUrl
  if (!uploadUrl) {
    throw new Error('Google không trả về URL tải lên.')
  }

  return uploadUrl as string
}

export const uploadFileToGoogleDrive = async (uploadUrl: string, file: File, fallbackTitle = file.name) => {
  const CHUNK_SIZE = 5 * 1024 * 1024
  let offset = 0
  let lastPayload: any = null

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
    const start = offset
    const end = Math.min(offset + CHUNK_SIZE, file.size) - 1

    let res: Response
    try {
      res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${file.size}`,
        },
        body: chunk,
      })
    } catch (err: any) {
      throw new Error(`Load failed khi tải ${fallbackTitle} lên Google Drive. (${err?.message || 'network error'})`)
    }

    if (res.status === 308) {
      offset = end + 1
      continue
    }

    if (res.status < 200 || res.status >= 300) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Lỗi khi tải file trực tiếp lên Google Drive (${res.status}).`)
    }

    const text = await res.text().catch(() => '')
    try {
      const payload = text ? JSON.parse(text) : {}
      if (!payload?.id) {
        throw new Error(`Không nhận được mã file từ Google Drive cho ${fallbackTitle}.`)
      }
      lastPayload = payload
      return lastPayload
    } catch (error: any) {
      throw new Error(text || `Phản hồi Google Drive không hợp lệ cho ${fallbackTitle}.`)
    }
  }

  throw new Error(`Không thể hoàn tất tải ${fallbackTitle} lên Google Drive.`)
}