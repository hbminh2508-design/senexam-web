import { NextResponse } from 'next/server'
import {
  getAllClasses,
  createClassElection,
  getElectionData,
  registerCandidate,
  submitVote,
  hasStudentVoted,
  computeResults,
  updateElectionState,
  resetVotes,
  deleteCandidate,
  deleteSingleVote,
  deleteClassElection,
} from '@/lib/baucuService'

export const dynamic = 'force-dynamic'

// GET /api/baucu
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // 1. Lấy danh sách tất cả các lớp bầu cử
    if (action === 'classes') {
      const classes = await getAllClasses()
      return NextResponse.json({ success: true, data: classes })
    }

    // 2. Lấy dữ liệu chi tiết của 1 lớp
    const classIdParam = searchParams.get('class') || searchParams.get('lop') || 'k70p_me2'
    const checkStudentId = searchParams.get('check_mssv')
    const isAdmin = searchParams.get('admin') === 'true'

    const data = await getElectionData(classIdParam)
    const summary = computeResults(data)

    let hasVoted = false
    if (checkStudentId) {
      hasVoted = await hasStudentVoted(data.id, checkStudentId)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
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
        // Chỉ gửi danh sách chi tiết phiếu cho admin
        votes: isAdmin ? data.votes : undefined,
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
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body?.action
    const classId = body?.classId || body?.class || body?.lop || 'k70p_me2'

    // 1. Tạo thêm bầu cử lớp mới
    if (action === 'create_class') {
      const unit = body?.unit
      if (!unit || !unit.trim()) {
        return NextResponse.json({ success: false, message: 'Vui lòng nhập tên lớp cần tạo.' }, { status: 400 })
      }
      const newClassData = await createClassElection({
        unit: unit.trim(),
        academicYear: body?.academicYear,
        title: body?.title,
      })
      return NextResponse.json({
        success: true,
        message: `Đã khởi tạo thành công phiên bầu cử cho lớp ${newClassData.unit}!`,
        data: newClassData,
      })
    }

    // 2. Xóa lớp bầu cử
    if (action === 'delete_class') {
      const targetId = body?.classId
      if (!targetId) {
        return NextResponse.json({ success: false, message: 'Thiếu classId' }, { status: 400 })
      }
      await deleteClassElection(targetId)
      return NextResponse.json({ success: true, message: 'Đã xóa phiên bầu cử của lớp.' })
    }

    // 3. Đăng ký ứng cử viên cho lớp
    if (action === 'register_candidate') {
      const res = await registerCandidate(classId, {
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

    // 4. Bỏ phiếu bầu cử cho lớp
    if (action === 'vote') {
      const res = await submitVote(classId, {
        voterName: body.voterName,
        voterStudentId: body.voterStudentId,
        selections: body.selections || {},
      })
      return NextResponse.json(res)
    }

    // 5. Kiểm tra MSSV đã bỏ phiếu cho lớp chưa
    if (action === 'check_voter') {
      const studentId = body?.studentId || ''
      const hasVoted = await hasStudentVoted(classId, studentId)
      return NextResponse.json({ success: true, hasVoted })
    }

    // 6. Quản trị: Đổi trạng thái mở/đóng đăng ký
    if (action === 'toggle_registration') {
      const data = await getElectionData(classId)
      const updated = await updateElectionState(classId, { isRegistrationOpen: !data.isRegistrationOpen })
      return NextResponse.json({
        success: true,
        isRegistrationOpen: updated.isRegistrationOpen,
        message: updated.isRegistrationOpen
          ? `Đã mở tiếp nhận ứng cử lớp ${updated.unit}`
          : `Đã đóng tiếp nhận ứng cử lớp ${updated.unit}`,
      })
    }

    // 7. Quản trị: Đổi trạng thái mở/đóng bỏ phiếu
    if (action === 'toggle_voting') {
      const data = await getElectionData(classId)
      const updated = await updateElectionState(classId, { isVotingOpen: !data.isVotingOpen })
      return NextResponse.json({
        success: true,
        isVotingOpen: updated.isVotingOpen,
        message: updated.isVotingOpen
          ? `Đã mở hòm phiếu bầu cử lớp ${updated.unit}`
          : `Đã đóng hòm phiếu bầu cử lớp ${updated.unit}`,
      })
    }

    // 8. Quản trị: Xóa ứng viên
    if (action === 'delete_candidate') {
      const candidateId = body?.candidateId
      if (!candidateId) {
        return NextResponse.json({ success: false, message: 'Thiếu candidateId' }, { status: 400 })
      }
      await deleteCandidate(classId, candidateId)
      return NextResponse.json({ success: true, message: 'Đã xóa ứng viên khỏi danh sách.' })
    }

    // 9. Quản trị: Xóa 1 phiếu bầu gian lận
    if (action === 'delete_vote') {
      const voteId = body?.voteId
      if (!voteId) {
        return NextResponse.json({ success: false, message: 'Thiếu voteId' }, { status: 400 })
      }
      await deleteSingleVote(classId, voteId)
      return NextResponse.json({ success: true, message: 'Đã hủy phiếu bầu gian lận thành công.' })
    }

    // 10. Quản trị: Reset phiếu bầu (chuẩn bị bầu vòng 2 hoặc làm mới)
    if (action === 'reset_votes') {
      const keepCandidates = body?.keepCandidates !== false
      await resetVotes(classId, keepCandidates)
      return NextResponse.json({
        success: true,
        message: keepCandidates
          ? 'Đã làm mới hòm phiếu (giữ nguyên danh sách ứng viên)!'
          : 'Đã xóa toàn bộ phiếu và danh sách ứng viên!',
      })
    }

    // 11. Quản trị: Cập nhật cấu hình chung
    if (action === 'update_settings') {
      const updates: any = {}
      if (typeof body.isRegistrationOpen === 'boolean') updates.isRegistrationOpen = body.isRegistrationOpen
      if (typeof body.isVotingOpen === 'boolean') updates.isVotingOpen = body.isVotingOpen
      if (typeof body.round === 'number') updates.round = body.round
      if (body.title) updates.title = body.title
      if (body.unit) updates.unit = body.unit
      if (body.academicYear) updates.academicYear = body.academicYear
      const updated = await updateElectionState(classId, updates)
      return NextResponse.json({ success: true, data: updated, message: 'Cập nhật cài đặt thành công!' })
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
