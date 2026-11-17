import { NextResponse } from 'next/server'
import { getSupabaseAdmin, requireAdmin } from '@/lib/supabaseAdmin'

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

    // NẾU LÀ HỌC SINH / THÍ SINH LÀM BÀI:
    // Tuyệt đối loại bỏ toàn bộ đáp án đúng và lời giải khỏi payload gửi về client
    const safeExam = { ...exam }

    // Xóa link file giải chi tiết
    delete (safeExam as any).solution_pdf_url

    // Khử đáp án trong cấu trúc phân phần
    if (safeExam.exam_structure && typeof safeExam.exam_structure === 'object') {
      const clonedStructure = JSON.parse(JSON.stringify(safeExam.exam_structure))

      if (Array.isArray(clonedStructure.sections)) {
        clonedStructure.sections.forEach((sec: any) => {
          delete sec.correctAnswers
          delete sec.correctMap
          if (Array.isArray(sec.questions)) {
            sec.questions.forEach((q: any) => {
              delete q.correctAnswer
              delete q.explanation
              delete q.solution
              // Với câu hỏi dạng Đúng/Sai (true_false), xóa isCorrect trong từng ý con
              if (Array.isArray(q.subQuestions)) {
                q.subQuestions.forEach((sub: any) => {
                  delete sub.isCorrect
                })
              }
            })
          }
        })
      }

      if (Array.isArray(clonedStructure.questions)) {
        clonedStructure.questions.forEach((q: any) => {
          delete q.correctAnswer
          delete q.explanation
          delete q.solution
          if (Array.isArray(q.subQuestions)) {
            q.subQuestions.forEach((sub: any) => {
              delete sub.isCorrect
            })
          }
        })
      }

      safeExam.exam_structure = clonedStructure
    }

    return NextResponse.json({ success: true, exam: safeExam })
  } catch (err: any) {
    console.error('Lỗi GET /api/exams/[id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi tải đề thi' },
      { status: 500 }
    )
  }
}
