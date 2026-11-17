import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Bộ đệm chống nộp bài hai lần (Idempotency / Double-submit lock)
const submissionLocks = new Map<string, { timestamp: number; result: any }>()

// Dọn dẹp lock cũ sau 60 giây
function cleanOldLocks() {
  const now = Date.now()
  for (const [key, lock] of submissionLocks.entries()) {
    if (now - lock.timestamp > 60000) {
      submissionLocks.delete(key)
    }
  }
}

export async function POST(request: Request) {
  try {
    cleanOldLocks()

    const body = await request.json().catch(() => ({}))
    const {
      examId,
      userId,
      answers = {},
      tabSwitches = 0,
      blurCount = 0,
      timeSpent = 0,
      idempotencyKey,
    } = body

    if (!examId) {
      return NextResponse.json({ error: 'Thiếu thông tin examId' }, { status: 400 })
    }

    // Xác thực người dùng (từ token Bearer hoặc từ session)
    const userFromToken = await getUserFromRequest(request)
    const effectiveUserId = userFromToken?.id || userId

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc không xác định được thí sinh' }, { status: 401 })
    }

    // Khóa chống nộp bài hai lần: theo idempotencyKey hoặc theo user+exam trong vòng 10 giây
    const lockKey = idempotencyKey || `${effectiveUserId}_${examId}`
    const existingLock = submissionLocks.get(lockKey)
    if (existingLock && Date.now() - existingLock.timestamp < 10000) {
      return NextResponse.json({
        ...existingLock.result,
        message: 'Bài thi đã được ghi nhận thành công (chặn nộp trùng lặp).',
        isDuplicatePrevented: true,
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Tải đề thi gốc từ Supabase để lấy đáp án chuẩn từ máy chủ (Server-side Truth)
    const { data: exam, error: examErr } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('id', examId)
      .maybeSingle()

    if (examErr || !exam) {
      return NextResponse.json({ error: 'Không tìm thấy đề thi trên máy chủ' }, { status: 404 })
    }

    // Kiểm tra số lần nộp bài (max_attempts)
    if (exam.max_attempts && exam.max_attempts > 0) {
      const { count: attemptCount } = await supabaseAdmin
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('exam_id', examId)
        .eq('user_id', effectiveUserId)

      if (attemptCount && attemptCount >= exam.max_attempts) {
        return NextResponse.json(
          { error: `Bạn đã đạt số lần làm bài tối đa cho phép (${exam.max_attempts} lần).` },
          { status: 403 }
        )
      }
    }

    // 2. Chấm điểm hoàn toàn trên Server (Chống sửa điểm và rò rỉ đáp án)
    let calculatedScore = 0
    let earnedPoints = 0
    let totalPoints = 0
    let correctCount = 0
    let totalQuestions = 0
    const detailedScores: Record<string, number> = {}

    const examStructure = (exam.exam_structure as any) || {}
    const sections: any[] = Array.isArray(examStructure.sections) ? examStructure.sections : []

    if (sections.length > 0) {
      // Cấu trúc phân phần chuẩn (SEB / HSA / TSA / University)
      sections.forEach((section: any) => {
        const qCount = parseInt(section.questionCount) || (Array.isArray(section.questions) ? section.questions.length : 0)
        totalQuestions += qCount
        const correctMap = section.correctAnswers || {}

        let secPoints = Number(section.totalPoints ?? section.sectionTotalPoints)
        if (!secPoints || isNaN(secPoints)) {
          if (exam.exam_type === 'HSA') secPoints = qCount || 50
          else if (exam.exam_type === 'TSA') secPoints = Math.round(100 / (sections.length || 1))
          else secPoints = 10
        }
        totalPoints += secPoints
        const pointsPerQ = qCount > 0 ? secPoints / qCount : 0

        for (let i = 0; i < qCount; i++) {
          const key = `${section.id}-${i}`
          const userAns = answers[key] ?? answers[String(i)]
          const corrItem = section.questions?.[i]?.correctAnswer ?? correctMap[i] ?? correctMap[String(i)]

          let qEarned = 0
          const qType = section.questions?.[i]?.type || section.type || 'single_choice'

          if (qType === 'single_choice' || qType === 'multiple_choice') {
            const u = String(userAns || '').trim().toUpperCase()
            const c = String(corrItem || '').trim().toUpperCase()
            if (u && c && u === c) {
              qEarned = pointsPerQ
              correctCount++
            }
          } else if (qType === 'true_false') {
            const uObj = (typeof userAns === 'object' && userAns) ? userAns : {}
            const cObj = (typeof corrItem === 'object' && corrItem) ? corrItem : {}
            let matchedSubs = 0
            ;['a', 'b', 'c', 'd'].forEach((sub) => {
              const uVal = String(uObj[sub] || '').toUpperCase()
              const cVal = String(cObj[sub] || '').toUpperCase()
              const isUTrue = uVal === 'Đ' || uVal === 'T' || uVal === 'TRUE' || uVal === '1'
              const isUFalse = uVal === 'S' || uVal === 'F' || uVal === 'FALSE' || uVal === '0'
              const isCTrue = cVal === 'Đ' || cVal === 'T' || cVal === 'TRUE' || cVal === '1'
              const isCFalse = cVal === 'S' || cVal === 'F' || cVal === 'FALSE' || cVal === '0'
              if ((isUTrue && isCTrue) || (isUFalse && isCFalse)) matchedSubs++
            })
            // Quy chuẩn Bộ GD&ĐT: 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%
            if (matchedSubs === 4) { qEarned = pointsPerQ * 1.0; correctCount++ }
            else if (matchedSubs === 3) qEarned = pointsPerQ * 0.5
            else if (matchedSubs === 2) qEarned = pointsPerQ * 0.25
            else if (matchedSubs === 1) qEarned = pointsPerQ * 0.1
          } else if (qType === 'short_answer') {
            const u = String(userAns || '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
            const c = String(corrItem || '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
            if (u && c && u === c) {
              qEarned = pointsPerQ
              correctCount++
            }
          }

          earnedPoints += qEarned
          detailedScores[key] = Math.round(qEarned * 100) / 100
        }
      })

      // Quy đổi điểm theo thang 10 hoặc thang bài thi
      calculatedScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 10 : 0
      calculatedScore = Math.round(calculatedScore * 100) / 100
    } else {
      // Đề thi phẳng hoặc câu hỏi từ bảng questions
      const { data: dbQuestions } = await supabaseAdmin
        .from('questions')
        .select('id, correct_answer')
        .eq('exam_id', examId)

      const qList = dbQuestions || []
      totalQuestions = qList.length
      totalPoints = 10
      const ptsPerQ = totalQuestions > 0 ? 10 / totalQuestions : 0

      qList.forEach((q, idx) => {
        const u = String(answers[q.id] ?? answers[idx] ?? '').trim().toUpperCase()
        const c = String(q.correct_answer || '').trim().toUpperCase()
        if (u && c && u === c) {
          earnedPoints += ptsPerQ
          correctCount++
          detailedScores[q.id] = ptsPerQ
        }
      })
      calculatedScore = Math.round(earnedPoints * 100) / 100
    }

    // 3. Ghi vào bảng submissions qua Supabase Admin
    const submissionPayload = {
      exam_id: examId,
      user_id: effectiveUserId,
      score: calculatedScore,
      earned_points: earnedPoints,
      total_points: totalPoints,
      correct_count: correctCount,
      total_questions: totalQuestions,
      answers: answers,
      detailed_scores: detailedScores,
      tab_switches: tabSwitches,
      blur_count: blurCount,
      time_spent: timeSpent,
      is_graded: true,
      submitted_at: new Date().toISOString(),
    }

    const { data: newSub, error: subErr } = await supabaseAdmin
      .from('submissions')
      .insert(submissionPayload as any)
      .select('id, score, created_at')
      .single()

    if (subErr) {
      console.error('Lỗi khi insert submission vào Supabase:', subErr)
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    const responseData = {
      success: true,
      submissionId: newSub?.id,
      score: calculatedScore,
      correctCount,
      totalQuestions,
      submittedAt: newSub?.created_at,
    }

    // Lưu lock chống double-submit
    submissionLocks.set(lockKey, { timestamp: Date.now(), result: responseData })

    return NextResponse.json(responseData)
  } catch (err: any) {
    console.error('Lỗi API /api/exams/submit:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi chấm và nộp bài' },
      { status: 500 }
    )
  }
}
