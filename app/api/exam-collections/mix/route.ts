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
      exam_configs, // Tuỳ chọn chi tiết: Array<{ exam_id: string; count: number }>
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

    // Kiểm tra xem có cấu hình chi tiết từng đề không
    const hasDetailedConfigs =
      Array.isArray(exam_configs) &&
      exam_configs.length > 0 &&
      exam_configs.some((c: any) => Number(c.count) > 0)

    // Xác định danh sách ID đề thi cần tải
    let targetExamIds = collection.exam_ids
    if (hasDetailedConfigs) {
      const activeIds = exam_configs
        .filter((c: any) => Number(c.count) > 0)
        .map((c: any) => c.exam_id)
      targetExamIds = targetExamIds.filter((id) => activeIds.includes(id))
    }

    if (targetExamIds.length === 0) {
      return NextResponse.json(
        { error: 'Vui lòng chọn ít nhất 1 đề thi có số câu hỏi lớn hơn 0 để trộn' },
        { status: 400 }
      )
    }

    // 1. Tải toàn bộ đề thi cần dùng
    const { data: exams, error: exErr } = await admin
      .from('exams')
      .select('*')
      .in('id', targetExamIds)

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

    // 3. Helper trích xuất câu hỏi từ đề
    interface ExtractedQuestion {
      type: 'choice' | 'true_false' | 'short_answer'
      qData: any
      sourceExamTitle: string
      rawType: string
    }

    function extractQuestionsFromExam(ex: any): ExtractedQuestion[] {
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

      if (!Array.isArray(struct)) return []

      const result: ExtractedQuestion[] = []
      struct.forEach((section: any) => {
        const questions = Array.isArray(section?.questions) ? section.questions : []
        questions.forEach((q: any) => {
          const qType = String(q?.type || section?.type || 'single_choice').toLowerCase().trim()
          if (qType === 'true_false') {
            result.push({
              type: 'true_false',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          } else if (qType === 'short_answer') {
            result.push({
              type: 'short_answer',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          } else {
            result.push({
              type: 'choice',
              qData: q,
              sourceExamTitle: ex.title,
              rawType: qType,
            })
          }
        })
      })
      return result
    }

    let finalQuestions: ExtractedQuestion[] = []

    if (hasDetailedConfigs) {
      // 4A. LẤY CÂU HỎI THEO TÙY CHỌN CHI TIẾT TỪNG ĐỀ
      for (const cfg of exam_configs) {
        const ex = exams.find((e) => e.id === cfg.exam_id)
        if (!ex) continue

        const count = Number(cfg.count) || 0
        if (count <= 0) continue

        const examQuestions = extractQuestionsFromExam(ex)
        const allowedQuestions = examQuestions.filter((q) => {
          if (q.type === 'choice' && include_choice) return true
          if (q.type === 'true_false' && include_true_false) return true
          if (q.type === 'short_answer' && include_short_answer) return true
          return false
        })

        const sampled = shuffleArray(allowedQuestions).slice(0, count)
        finalQuestions.push(...sampled)
      }

      if (finalQuestions.length === 0) {
        return NextResponse.json(
          { error: 'Không có câu hỏi nào phù hợp với các dạng câu đã chọn từ các đề đã chỉ định' },
          { status: 400 }
        )
      }
    } else {
      // 4B. LẤY CÂU HỎI TỔNG QUÁT TỪ TOÀN BỘ ĐỀ TRONG TUYỂN TẬP
      const allowedPool: ExtractedQuestion[] = []
      for (const ex of exams) {
        const examQuestions = extractQuestionsFromExam(ex)
        const allowedQuestions = examQuestions.filter((q) => {
          if (q.type === 'choice' && include_choice) return true
          if (q.type === 'true_false' && include_true_false) return true
          if (q.type === 'short_answer' && include_short_answer) return true
          return false
        })
        allowedPool.push(...allowedQuestions)
      }

      if (allowedPool.length === 0) {
        return NextResponse.json(
          { error: 'Không có câu hỏi nào phù hợp với các dạng câu đã chọn' },
          { status: 400 }
        )
      }

      let targetCount = Number(question_count) || Math.min(40, allowedPool.length)
      if (targetCount > allowedPool.length) {
        targetCount = allowedPool.length
      }
      if (targetCount < 1) {
        targetCount = 1
      }

      finalQuestions = shuffleArray(allowedPool).slice(0, targetCount)
    }

    // 5. Phân bổ câu hỏi vào 3 phần chuẩn hóa nếu có
    const selectedChoice = finalQuestions.filter((q) => q.type === 'choice').map((q) => q.qData)
    const selectedTF = finalQuestions.filter((q) => q.type === 'true_false').map((q) => q.qData)
    const selectedSA = finalQuestions.filter((q) => q.type === 'short_answer').map((q) => q.qData)

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
      subjects: [collection.subject],
      duration: chosenDuration,
      format: 'katex',
      exam_structure: sections,
      is_hidden: true, // Ẩn khỏi bảng chung, chỉ thí sinh truy cập bài làm
      created_by: user?.id || body?.userId || null,
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
