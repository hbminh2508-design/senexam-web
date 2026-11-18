import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'
import { stripExamAnswers, verifySebRequest } from '@/lib/examSecurity'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await props.params

    if (!examId) {
      return NextResponse.json({ error: 'Thiếu ID đề thi' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: exam, error } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('id', examId)
      .maybeSingle()

    if (error || !exam) {
      return NextResponse.json({ error: 'Không tìm thấy đề thi hoặc đề thi đã bị gỡ' }, { status: 404 })
    }

    // Kiểm tra quyền: nếu là Admin / Collab thì được xem đề kèm đáp án để chỉnh sửa
    const admin = await requireAdmin(request)
    if (admin) {
      return NextResponse.json({ success: true, exam })
    }

    // NẾU LÀ ĐỀ THI YÊU CẦU SEB: Xác thực headers trình duyệt SEB
    const sebCheck = verifySebRequest(request.headers, exam.require_seb)
    if (!sebCheck.allowed) {
      return NextResponse.json({ error: sebCheck.error }, { status: 403 })
    }

    // NẾU LÀ HỌC SINH / THÍ SINH LÀM BÀI:
    // Tuyệt đối loại bỏ toàn bộ đáp án đúng, lời giải, seb_config_key, access_code
    const safeExam = stripExamAnswers(exam)

    return NextResponse.json({ success: true, exam: safeExam })
  } catch (err: any) {
    console.error('Lỗi GET /api/exams/[id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi tải đề thi' },
      { status: 500 }
    )
  }
}
