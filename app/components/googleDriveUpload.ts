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

    const response = await new Promise<XMLHttpRequest>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl, true)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${file.size}`)
      xhr.timeout = 30 * 60 * 1000

      xhr.onload = () => resolve(xhr)
      xhr.onerror = () => reject(new Error(`Load failed khi tải ${fallbackTitle} lên Google Drive.`))
      xhr.ontimeout = () => reject(new Error(`Hết thời gian khi tải ${fallbackTitle} lên Google Drive.`))
      xhr.send(chunk)
    })

    if (response.status === 308) {
      offset = end + 1
      continue
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.responseText || `Lỗi khi tải file trực tiếp lên Google Drive (${response.status}).`)
    }

    try {
      const payload = response.responseText ? JSON.parse(response.responseText) : {}
      if (!payload?.id) {
        throw new Error(`Không nhận được mã file từ Google Drive cho ${fallbackTitle}.`)
      }
      lastPayload = payload
      return lastPayload
    } catch (error) {
      throw new Error(response.responseText || `Phản hồi Google Drive không hợp lệ cho ${fallbackTitle}.`)
    }
  }

  throw new Error(`Không thể hoàn tất tải ${fallbackTitle} lên Google Drive.`)
}