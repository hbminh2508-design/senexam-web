import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const STORAGE_DIR = process.env.LIBRARY_STORAGE_DIR || path.join(process.cwd(), 'storage', 'library')

async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Cần đăng nhập để tải lên tài liệu' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || 'student'
    const canManage = role === 'admin' || role === 'teacher' || role === 'collab'
    if (!canManage) {
      return NextResponse.json({ error: 'Bạn không có quyền tải lên tài liệu vào thư viện' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string || file?.name || 'Tài liệu không tên').trim()
    const folderId = (formData.get('folderId') as string) || null
    const allowDownload = formData.get('allowDownload') !== 'false'
    const isVipOnly = formData.get('isVipOnly') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Vui lòng chọn tệp để tải lên' }, { status: 400 })
    }

    await ensureDir(STORAGE_DIR)

    const docId = crypto.randomUUID()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storedFileName = `${docId}-${sanitizedName}`
    const fullFilePath = path.join(STORAGE_DIR, storedFileName)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(fullFilePath, buffer)

    const metadata = {
      storage: 'azure',
      filename: storedFileName,
      originalName: file.name,
      mimeType: file.type || 'application/pdf',
      size: file.size,
      allowDownload,
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('library_documents')
      .insert({
        id: docId,
        title,
        folder_id: folderId,
        created_by: user.id,
        drive_file_id: `azure:${storedFileName}`,
        description: JSON.stringify(metadata),
        is_vip_only: isVipOnly,
      })
      .select('*')
      .single()

    if (insertError) {
      try {
        await fs.unlink(fullFilePath)
      } catch {}
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      document: inserted,
    })
  } catch (err: any) {
    console.error('Lỗi upload Azure library:', err)
    return NextResponse.json({ error: err?.message || 'Lỗi xử lý tải lên' }, { status: 500 })
  }
}
