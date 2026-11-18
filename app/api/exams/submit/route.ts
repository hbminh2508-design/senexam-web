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

// Bảng chuẩn hóa vị trí dấu thanh tiếng Việt (kiểu gõ cũ vs mới: hoà -> hòa, thuỷ -> thủy)
const VN_TONE_MAP: Record<string, string> = {
  'oà': 'òa', 'oá': 'óa', 'oả': 'ỏa', 'oã': 'õa', 'oạ': 'ọa',
  'oè': 'òe', 'oé': 'óe', 'oẻ': 'ỏe', 'oẽ': 'õe', 'oẹ': 'ọe',
  'uỳ': 'ùy', 'uý': 'úy', 'uỷ': 'ủy', 'uỹ': 'ũy', 'uỵ': 'ụy',
}

/**
 * Chuẩn hóa chuỗi đáp án (hỗ trợ Tiếng Việt có dấu NFC, đồng nhất vị trí dấu thanh, loại bỏ khoảng trắng thừa/zero-width, đổi dấu phẩy sang chấm)
 */
export function normalizeAnswerString(str: any): string {
  if (str === null || str === undefined) return ''
  let s = String(str)
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // Khử zero-width space, non-breaking space
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')

  for (const [k, v] of Object.entries(VN_TONE_MAP)) {
    s = s.replaceAll(k, v)
  }
  return s
}

export async function POST(request: Request) {
  try {
    cleanOldLocks()

    // 0. Xác thực Origin / Chống CSRF cho route nộp bài
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (
          originHost !== host &&
          !originHost.endsWith('senexam.me') &&
          !originHost.includes('localhost') &&
          !originHost.includes('127.0.0.1')
        ) {
          return NextResponse.json(
            { error: 'Từ chối yêu cầu từ nguồn không xác thực (CSRF Blocked)' },
            { status: 403 }
          )
        }
      } catch {}
    }

    const body = await request.json().catch(() => ({}))
    const {
      examId,
      userId,
      answers = {},
      tabSwitches = 0,
      blurCount = 0,
      timeSpent = 0,
      startedAt,
      idempotencyKey,
    } = body

    if (!examId) {
      return NextResponse.json({ error: 'Thiếu thông tin examId' }, { status: 400 })
    }

    // 1. Xác thực người dùng (từ token Bearer hoặc từ session, với fallback profile check)
    const userFromToken = await getUserFromRequest(request)
    const effectiveUserId = userFromToken?.id || userId

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Chưa đăng nhập hoặc không xác định được thí sinh' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Kiểm tra tính hợp lệ của thí sinh nếu token đã hết hạn trong ca thi kéo dài
    if (!userFromToken) {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', effectiveUserId)
        .maybeSingle()
      if (!userProfile) {
        return NextResponse.json({ error: 'Thí sinh không hợp lệ hoặc tài khoản đã bị khóa' }, { status: 401 })
      }
    }

    // 2. Khóa chống nộp bài hai lần (Idempotency Guard)
    const lockKey = idempotencyKey || `${effectiveUserId}_${examId}`
    const existingLock = submissionLocks.get(lockKey)
    if (existingLock && Date.now() - existingLock.timestamp < 10000) {
      return NextResponse.json({
        ...existingLock.result,
        message: 'Bài thi đã được ghi nhận thành công (chặn nộp trùng lặp do kết nối kép).',
        isDuplicatePrevented: true,
      })
    }

    // 3. Tải đề thi gốc từ Supabase (Server-side Truth)
    const { data: exam, error: examErr } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('id', examId)
      .maybeSingle()

    if (examErr || !exam) {
      return NextResponse.json({ error: 'Không tìm thấy đề thi trên máy chủ' }, { status: 404 })
    }

    // Kiểm tra số lần nộp bài (max_attempts) & Xử lý nộp trùng Idempotent
    if (exam.max_attempts && exam.max_attempts > 0) {
      const { data: existingSub } = await supabaseAdmin
        .from('submissions')
        .select('id, score, correct_count, total_questions, created_at')
        .eq('exam_id', examId)
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingSub) {
        // Nếu đề thi chỉ cho phép làm 1 lần (max_attempts = 1), trả về kết quả cũ một cách idempotent
        if (exam.max_attempts === 1) {
          const idempotentResult = {
            success: true,
            submissionId: existingSub.id,
            score: existingSub.score,
            correctCount: existingSub.correct_count,
            totalQuestions: existingSub.total_questions,
            submittedAt: existingSub.created_at,
            message: 'Bài thi của bạn đã được ghi nhận thành công trước đó.',
            isDuplicatePrevented: true,
          }
          submissionLocks.set(lockKey, { timestamp: Date.now(), result: idempotentResult })
          return NextResponse.json(idempotentResult)
        }

        // Nếu cho phép nhiều lần nhưng đã đạt ngưỡng
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
    }

    // 4. Chấm điểm hoàn toàn trên Server
    let calculatedScore = 0
    let earnedPoints = 0
    let totalPoints = 0
    let correctCount = 0
    let totalQuestions = 0
    const detailedScores: Record<string, number> = {}

    // Hỗ trợ cả 2 định dạng: mảng sections trực tiếp hoặc object chứa sections
    const examStructure = (exam.exam_structure as any) || {}
    const sections: any[] = Array.isArray(exam.exam_structure)
      ? exam.exam_structure
      : Array.isArray(examStructure.sections)
      ? examStructure.sections
      : []

    if (sections.length > 0) {
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
            const u = String(userAns || '').normalize('NFC').trim().toUpperCase()
            const c = String(corrItem || '').normalize('NFC').trim().toUpperCase()
            if (u && c && u === c) {
              qEarned = pointsPerQ
              correctCount++
            }
          } else if (qType === 'true_false') {
            const uObj = (typeof userAns === 'object' && userAns) ? userAns : {}
            const cObj = (typeof corrItem === 'object' && corrItem) ? corrItem : {}
            let matchedSubs = 0
            ;['a', 'b', 'c', 'd'].forEach((sub) => {
              const uVal = String(uObj[sub] || '').normalize('NFC').toUpperCase()
              const cVal = String(cObj[sub] || '').normalize('NFC').toUpperCase()
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
            const u = normalizeAnswerString(userAns)
            const c = normalizeAnswerString(corrItem)
            if (u && c && u === c) {
              qEarned = pointsPerQ
              correctCount++
            }
          }

          earnedPoints += qEarned
          detailedScores[key] = Math.round(qEarned * 100) / 100
        }
      })

      calculatedScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 10 : 0
      calculatedScore = Math.round(calculatedScore * 100) / 100
    } else {
      const { data: dbQuestions } = await supabaseAdmin
        .from('questions')
        .select('id, correct_answer')
        .eq('exam_id', examId)

      const qList = dbQuestions || []
      totalQuestions = qList.length
      totalPoints = 10
      const ptsPerQ = totalQuestions > 0 ? 10 / totalQuestions : 0

      qList.forEach((q, idx) => {
        const u = String(answers[q.id] ?? answers[idx] ?? '').normalize('NFC').trim().toUpperCase()
        const c = String(q.correct_answer || '').normalize('NFC').trim().toUpperCase()
        if (u && c && u === c) {
          earnedPoints += ptsPerQ
          correctCount++
          detailedScores[q.id] = ptsPerQ
        }
      })
      calculatedScore = Math.round(earnedPoints * 100) / 100
    }

    // 5. Xác thực thời gian làm bài (Server-authoritative Timing)
    const examDurationMinutes = Number(exam.duration) || 60
    const examDurationSeconds = examDurationMinutes * 60
    const graceSeconds = 300 // 5 phút dung sai mạng và nộp bài

    let sanitizedTimeSpent = Math.max(0, Number(timeSpent) || 0)
    let isDisqualified = false
    let disqualificationReason: string | null = null

    if (startedAt) {
      const serverElapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      if (serverElapsed > 0) {
        // Lấy thời gian thực tính toán trên máy chủ
        sanitizedTimeSpent = Math.min(serverElapsed, examDurationSeconds + graceSeconds)
        // Nếu thí sinh nộp quá thời gian quy định + 5 phút dung sai
        if (serverElapsed > examDurationSeconds + graceSeconds) {
          isDisqualified = true
          disqualificationReason = 'SUBMISSION_OVERDUE'
        }
      }
    } else {
      // Giới hạn thời gian client gửi lên không vượt quá thời gian đề + dung sai
      sanitizedTimeSpent = Math.min(sanitizedTimeSpent, examDurationSeconds + graceSeconds)
    }

    // 6. Ghi vào bảng submissions qua Supabase Admin
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
      tab_switches: Math.max(0, Number(tabSwitches) || 0),
      blur_count: Math.max(0, Number(blurCount) || 0),
      time_spent: sanitizedTimeSpent,
      is_graded: true,
      is_disqualified: isDisqualified,
      disqualification_reason: disqualificationReason,
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
