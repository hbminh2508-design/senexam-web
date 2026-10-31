import { NextResponse } from 'next/server'
import {
  getElectionData,
  registerCandidate,
  submitVote,
  hasStudentVoted,
  computeResults,
  updateElectionState,
  resetVotes,
  deleteCandidate,
} from '@/lib/baucuService'

export const dynamic = 'force-dynamic'

// GET /api/baucu
// Lấy toàn bộ trạng thái bầu cử và kết quả tổng hợp
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const checkStudentId = searchParams.get('check_mssv')

    const data = await getElectionData()
    const summary = computeResults(data)

    let hasVoted = false
    if (checkStudentId) {
      hasVoted = await hasStudentVoted(checkStudentId)
    }

    return NextResponse.json({
      success: true,
      data: {
        unit: data.unit,
        academicYear: data.academicYear,
        title: data.title,
        positions: data.positions,
        candidates: data.candidates,
        totalVotes: data.votes.length,
        isRegistrationOpen: data.isRegistrationOpen,
        isVotingOpen: data.isVotingOpen,
        round: data.round || 1,
        hasVoted,
        summary,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/baucu:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Lỗi khi tải dữ liệu bầu cử' },
      { status: 500 }
    )
  }
}

// POST /api/baucu
// Xử lý đăng ký ứng cử, bỏ phiếu và quản trị
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body?.action

    // 1. Đăng ký ứng cử viên
    if (action === 'register_candidate') {
      const res = await registerCandidate({
        name: body.name,
        studentId: body.studentId,
        phone: body.phone,
        email: body.email,
        positionIds: body.positionIds,
        bio: body.bio,
        slogan: body.slogan,
      })
      return NextResponse.json(res)
    }

    // 2. Bỏ phiếu bầu cử
    if (action === 'vote') {
      const res = await submitVote({
        voterName: body.voterName,
        voterStudentId: body.voterStudentId,
        selections: body.selections || {},
      })
      return NextResponse.json(res)
    }

    // 3. Kiểm tra xem MSSV đã bỏ phiếu chưa
    if (action === 'check_voter') {
      const studentId = body?.studentId || ''
      const hasVoted = await hasStudentVoted(studentId)
      return NextResponse.json({ success: true, hasVoted })
    }

    // 4. Quản trị: Đổi trạng thái mở/đóng đăng ký
    if (action === 'toggle_registration') {
      const data = await getElectionData()
      const updated = await updateElectionState({ isRegistrationOpen: !data.isRegistrationOpen })
      return NextResponse.json({
        success: true,
        isRegistrationOpen: updated.isRegistrationOpen,
        message: updated.isRegistrationOpen ? 'Đã mở đăng ký ứng cử' : 'Đã đóng đăng ký ứng cử',
      })
    }

    // 5. Quản trị: Đổi trạng thái mở/đóng bỏ phiếu
    if (action === 'toggle_voting') {
      const data = await getElectionData()
      const updated = await updateElectionState({ isVotingOpen: !data.isVotingOpen })
      return NextResponse.json({
        success: true,
        isVotingOpen: updated.isVotingOpen,
        message: updated.isVotingOpen ? 'Đã mở hòm phiếu bầu cử' : 'Đã đóng hòm phiếu bầu cử',
      })
    }

    // 6. Quản trị: Xóa ứng viên
    if (action === 'delete_candidate') {
      const candidateId = body?.candidateId
      if (!candidateId) {
        return NextResponse.json({ success: false, message: 'Thiếu candidateId' }, { status: 400 })
      }
      await deleteCandidate(candidateId)
      return NextResponse.json({ success: true, message: 'Đã xóa ứng viên' })
    }

    // 7. Quản trị: Reset phiếu bầu (chuẩn bị bầu vòng 2 hoặc làm mới)
    if (action === 'reset_votes') {
      const keepCandidates = body?.keepCandidates !== false
      await resetVotes(keepCandidates)
      return NextResponse.json({
        success: true,
        message: keepCandidates ? 'Đã làm mới hòm phiếu (giữ lại ứng viên)!' : 'Đã xóa toàn bộ phiếu và ứng viên!',
      })
    }

    return NextResponse.json({ success: false, message: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in POST /api/baucu:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Có lỗi xảy ra khi xử lý yêu cầu' },
      { status: 500 }
    )
  }
}
