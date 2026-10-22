import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'
import { getExamCollectionsAsync } from '@/lib/examCollectionStore'

export const dynamic = 'force-dynamic'

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// POST: Trộn đề từ tuyển tập theo tùy chọn của thí sinh
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    const admin = getSupabaseAdmin()

    const body = await request.json()
    const {
      collection_id,
      include_choice = true,
      include_true_false = true,
      include_short_answer = true,
      question_count,
      custom_duration,
      custom_title,
    } = body

    if (!collection_id) {
      return NextResponse.json({ error: 'Thiếu mã tuyển tập đề' }, { status: 400 })
    }

    const collections = await getExamCollectionsAsync()
    const collection = collections.find((c) => c.id === collection_id)
    if (!collection) {
      return NextResponse.json({ error: 'Không tìm thấy tuyển tập đề' }, { status: 404 })
    }

    if (!collection.exam_ids || collection.exam_ids.length === 0) {
      return NextResponse.json({ error: 'Tuyển tập này chưa có đề thi nào' }, { status: 400 })
    }

    // 1. Tải toàn bộ đề thi trong tuyển tập
    const { data: exams, error: exErr } = await admin
      .from('exams')
      .select('*')
      .in('id', collection.exam_ids)

    if (exErr || !exams || exams.length === 0) {
      return NextResponse.json({ error: 'Không thể tải đề thi thuộc tuyển tập' }, { status: 500 })
    }

    // 2. Tính tổng thời gian các đề được chọn cộng lại + 30 phút
    const sumDuration = exams.reduce((acc, ex) => acc + (Number(ex.duration) || 50), 0)
    const maxAllowedDuration = sumDuration + 30

    let chosenDuration = Number(custom_duration) || 50
    if (chosenDuration > maxAllowedDuration) {
      chosenDuration = maxAllowedDuration
    }
    if (chosenDuration < 5) {
      chosenDuration = 5
    }

    // 3. Gom và phân loại toàn bộ câu hỏi từ các đề
    interface ExtractedQuestion {
      type: 'choice' | 'true_false' | 'short_answer'
      qData: any
      sourceExamTitle: string
      rawType: string
    }

    const poolChoice: ExtractedQuestion[] = []
    const poolTrueFalse: ExtractedQuestion[] = []
    const poolShortAnswer: ExtractedQuestion[] = []

    for (const ex of exams) {
      let struct = ex.exam_structure
      if (typeof struct === 'string') {
        try {
          struct = JSON.parse(struct)
        } catch {
          struct = []
        }
      }
      if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray(struct.sections)) {
        struct = struct.sections
      }

      if (!Array.isArray(struct)) continue

      struct.forEach((section: any, sIdx: number) => {
        const questions = Array.isArray(section?.questions) ? section.questions : []
        questions.forEach((q: any, qIdx: number) => {
          let qType = String(q?.type || section?.type || 'single_choice').toLowerCase().trim()

          // Kiểm tra xem câu này thuộc dạng nào
          if (qType === 'true_false') {
            poolTrueFalse.push({
              type: 'true_false',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          } else if (qType === 'short_answer') {
            poolShortAnswer.push({
              type: 'short_answer',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          } else {
            // Trắc nghiệm (single_choice, multiple_choice hoặc mặc định)
            poolChoice.push({
              type: 'choice',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          }
        })
      })
    }

    // 4. Lọc kho câu hỏi theo các dạng thí sinh đã chọn
    const allowedPool: ExtractedQuestion[] = []
    if (include_choice) allowedPool.push(...poolChoice)
    if (include_true_false) allowedPool.push(...poolTrueFalse)
    if (include_short_answer) allowedPool.push(...poolShortAnswer)

    const totalAvailable = allowedPool.length
    if (totalAvailable === 0) {
      return NextResponse.json(
        { error: 'Không có câu hỏi nào phù hợp với các dạng câu đã chọn' },
        { status: 400 }
      )
    }

    // Số câu hỏi tối đa bằng tổng số câu của các phần đã tick chọn
    let targetCount = Number(question_count) || Math.min(40, totalAvailable)
    if (targetCount > totalAvailable) {
      targetCount = totalAvailable
    }
    if (targetCount < 1) {
      targetCount = 1
    }

    // 5. Trộn ngẫu nhiên câu hỏi (Shuffle)
    const shuffledPool = shuffleArray(allowedPool).slice(0, targetCount)

    // Phân bổ lại câu hỏi vào 3 phần chuẩn hóa nếu có
    const selectedChoice = shuffledPool.filter((q) => q.type === 'choice').map((q) => q.qData)
    const selectedTF = shuffledPool.filter((q) => q.type === 'true_false').map((q) => q.qData)
    const selectedSA = shuffledPool.filter((q) => q.type === 'short_answer').map((q) => q.qData)

    const sections: any[] = []

    if (selectedChoice.length > 0) {
      sections.push({
        id: 'sec-choice',
        name: 'PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn',
        title: 'PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn',
        description: 'Thí sinh trả lời từ câu hỏi này theo dạng trắc nghiệm 4 lựa chọn.',
        type: 'single_choice',
        format: 'katex',
        is_katex: true,
        questionCount: selectedChoice.length,
        questions: selectedChoice,
      })
    }

    if (selectedTF.length > 0) {
      sections.push({
        id: 'sec-tf',
        name: 'PHẦN II: Câu trắc nghiệm đúng sai',
        title: 'PHẦN II: Câu trắc nghiệm đúng sai',
        description: 'Thí sinh chọn Đúng hoặc Sai cho mỗi ý a), b), c), d).',
        type: 'true_false',
        format: 'katex',
        is_katex: true,
        questionCount: selectedTF.length,
        questions: selectedTF,
      })
    }

    if (selectedSA.length > 0) {
      sections.push({
        id: 'sec-sa',
        name: 'PHẦN III: Câu trắc nghiệm trả lời ngắn',
        title: 'PHẦN III: Câu trắc nghiệm trả lời ngắn',
        description: 'Thí sinh điền câu trả lời ngắn vào ô tương ứng.',
        type: 'short_answer',
        format: 'katex',
        is_katex: true,
        questionCount: selectedSA.length,
        questions: selectedSA,
      })
    }

    const defaultTitle = `[Trộn đề] Tuyển tập ${collection.subject} (${new Date().toLocaleDateString('vi-VN')})`
    const examTitle = custom_title?.trim() || defaultTitle

    // 6. Lưu đề thi đã trộn vào CSDL
    const newExamPayload: any = {
      title: examTitle,
      exam_type: 'THPTQG',
      subject: collection.subject,
      duration: chosenDuration,
      format: 'katex',
      exam_structure: sections,
      is_hidden: true, // Ẩn khỏi bảng chung, chỉ thí sinh truy cập bài làm
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
    }

    const { data: newExam, error: insertErr } = await admin
      .from('exams')
      .insert(newExamPayload)
      .select('id')
      .single()

    if (insertErr || !newExam) {
      console.error('Lỗi insert đề trộn:', insertErr)
      return NextResponse.json(
        { error: insertErr?.message || 'Không thể tạo đề trộn' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      examId: newExam.id,
      totalQuestions: targetCount,
      duration: chosenDuration,
    })
  } catch (error: any) {
    console.error('Lỗi POST /api/exam-collections/mix:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi trộn đề' }, { status: 500 })
  }
}
