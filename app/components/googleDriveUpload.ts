import { supabase } from '@/lib/supabaseClient'

type ResponsePayload = {
  ok: boolean
  data?: any
  error?: string
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` }
    }
  } catch (e) {
    // Session token retrieval error - fallback
  }
  return {}
}

const uploadFileViaApi = async (file: File, title: string) => {
  const authHeaders = await getAuthHeaders()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)

  const response = await fetch('/api/upload-exam', {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  })

  const payload = await readResponsePayload(response)
  if (!payload.ok || !response.ok) {
    throw new Error((payload as ResponsePayload).error || (payload as any).data?.error || 'Không thể tải file qua API nội bộ.')
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
      const parsed = JSON.parse(rawText)
      if (!response.ok) {
        return {
          ok: false,
          error: parsed.error || parsed.message || `Lỗi từ server (${response.status})`,
          data: parsed,
        }
      }
      return { ok: true, data: parsed }
    } catch (error) {
      return { ok: false, error: rawText || 'Phản hồi JSON không hợp lệ.' }
    }
  }

  return { ok: response.ok, error: response.ok ? undefined : (rawText || `Lỗi kết nối server (${response.status})`) }
}

export const initGoogleDriveUpload = async (fileName: string, mimeType: string) => {
  // Lấy Access Token từ server (server chỉ trả token, không truyền file)
  const authHeaders = await getAuthHeaders()
  const tokenResp = await fetch('/api/get-drive-token', {
    headers: {
      ...authHeaders,
    },
  })
  const tokenPayload = await readResponsePayload(tokenResp)
  if (!tokenPayload.ok || !tokenPayload.data?.accessToken) {
    throw new Error(tokenPayload.error || tokenPayload.data?.error || 'Không thể lấy access token từ server')
  }
  const accessToken = tokenPayload.data.accessToken

  const folderId = tokenPayload.data.folderId || process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || ''
  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  }

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
    },
    body: JSON.stringify(metadata)
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Lỗi khởi tạo Google Drive: ${txt}`)
  }

  const uploadUrl = res.headers.get('Location')
  if (!uploadUrl) throw new Error('Google không trả về URL tải lên.')

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
      throw new Error((payload as ResponsePayload).error || (payload as any).data?.error || 'Lỗi khi tải file trực tiếp lên Google Drive.')
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