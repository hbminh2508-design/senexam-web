type ResponsePayload = {
  ok: boolean
  data?: any
  error?: string
}

const uploadFileViaApi = async (file: File, title: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)

  const response = await fetch('/api/upload-exam', {
    method: 'POST',
    body: formData,
  })

  const payload = await readResponsePayload(response)
  if (!payload.ok || !response.ok) {
    throw new Error((payload as ResponsePayload).error || 'Không thể tải file qua API nội bộ.')
  }

  const driveFileId = payload.data?.driveFileId
  if (!driveFileId) {
    throw new Error('API nội bộ không trả về mã file.')
  }

  return { id: driveFileId }
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
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Range': `bytes 0-${Math.max(file.size - 1, 0)}/${file.size}`,
      },
      body: file,
    })

    const payload = await readResponsePayload(response)
    if (!payload.ok || !response.ok) {
      throw new Error((payload as ResponsePayload).error || 'Lỗi khi tải file trực tiếp lên Google Drive.')
    }

    const fileId = payload.data?.id
    if (!fileId) {
      throw new Error('Không nhận được mã file từ Google Drive.')
    }

    return payload.data
  } catch (error) {
    return uploadFileViaApi(file, fallbackTitle)
  }
}