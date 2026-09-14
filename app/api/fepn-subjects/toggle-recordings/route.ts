import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function isInternalAppRequest(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const referer = request.headers.get('referer')
  const origin = request.headers.get('origin')
  const secFetchSite = request.headers.get('sec-fetch-site')

  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true
  if (host && ((origin && origin.includes(host)) || (referer && referer.includes(host)))) return true
  if (referer && (referer.includes('senexam.me') || referer.includes('vercel.app') || referer.includes('localhost'))) return true
  if (origin && (origin.includes('senexam.me') || origin.includes('vercel.app') || origin.includes('localhost'))) return true
  if (process.env.NODE_ENV !== 'production') return true
  return false
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    const isInternal = isInternalAppRequest(request)

    const admin = getSupabaseAdmin()
    let isUserAdmin = false

    if (user?.id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .maybeSingle()

      if (
        profile?.role === 'admin' ||
        profile?.role === 'collab' ||
        profile?.email?.toLowerCase() === 'hoangbinhminh2508@gmail.com'
      ) {
        isUserAdmin = true
      }
    }

    // Nếu request từ nội bộ trình duyệt có thông tin admin
    const body = await request.json().catch(() => ({}))
    const { subjectId, enabled, userEmail, userRole } = body

    if (
      userRole === 'admin' ||
      userRole === 'collab' ||
      userEmail?.toLowerCase() === 'hoangbinhminh2508@gmail.com'
    ) {
      if (isInternal) {
        isUserAdmin = true
      }
    }

    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Truy cập bị từ chối. Chỉ Quản trị viên (Admin) mới có quyền Bật / Tắt tính năng File Ghi Âm!' },
        { status: 403 }
      )
    }

    if (!subjectId) {
      return NextResponse.json({ error: 'Thiếu subjectId' }, { status: 400 })
    }

    const nextStatus = Boolean(enabled)

    // Lấy thông tin môn học hiện tại
    const { data: currentSub } = await admin
      .from('fepn_subjects')
      .select('id, description')
      .eq('id', subjectId)
      .maybeSingle()

    let descClean = (currentSub?.description || '').replace(/\[ENABLE_RECORDINGS\]/g, '').trim()
    if (nextStatus) {
      descClean = descClean ? `${descClean} [ENABLE_RECORDINGS]` : '[ENABLE_RECORDINGS]'
    }

    // Cập nhật cả cột enable_recordings và thẻ [ENABLE_RECORDINGS] trong description để tương thích 100%
    let updateResult = await admin
      .from('fepn_subjects')
      .update({
        enable_recordings: nextStatus,
        description: descClean,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subjectId)
      .select('*')
      .maybeSingle()

    // Nếu DB chưa có cột enable_recordings, update qua description
    if (updateResult.error) {
      updateResult = await admin
        .from('fepn_subjects')
        .update({
          description: descClean,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subjectId)
        .select('*')
        .maybeSingle()
    }

    return NextResponse.json({
      success: true,
      enabled: nextStatus,
      subject: updateResult.data || null,
      message: `Đã ${nextStatus ? 'BẬT' : 'TẮT'} tab File Ghi Âm cho môn học thành công!`,
    })
  } catch (error: any) {
    console.error('Lỗi khi bật/tắt ghi âm môn học:', error)
    return NextResponse.json(
      { error: error?.message || 'Lỗi server khi cập nhật trạng thái ghi âm' },
      { status: 500 }
    )
  }
}
