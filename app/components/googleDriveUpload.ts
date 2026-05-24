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
  return await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('Content-Range', `bytes 0-${Math.max(file.size - 1, 0)}/${file.size}`)
    xhr.timeout = 30 * 60 * 1000

    xhr.onload = () => {
      const responseText = xhr.responseText || ''
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(responseText || `Lỗi khi tải file trực tiếp lên Google Drive (${xhr.status}).`))
        return
      }

      try {
        const payload = responseText ? JSON.parse(responseText) : {}
        const fileId = payload?.id
        if (!fileId) {
          reject(new Error(`Không nhận được mã file từ Google Drive cho ${fallbackTitle}.`))
          return
        }
        resolve(payload)
      } catch (error) {
        reject(new Error(responseText || `Phản hồi Google Drive không hợp lệ cho ${fallbackTitle}.`))
      }
    }

    xhr.onerror = () => {
      reject(new Error(`Load failed khi tải ${fallbackTitle} lên Google Drive.`))
    }

    xhr.ontimeout = () => {
      reject(new Error(`Hết thời gian khi tải ${fallbackTitle} lên Google Drive.`))
    }

    xhr.send(file)
  })
}