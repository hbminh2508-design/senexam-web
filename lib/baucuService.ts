import fs from 'fs/promises'
import path from 'path'

export interface Position {
  id: string
  title: string
  category: 'bcs' | 'doan' | 'hoi'
  categoryName: string
  quota: number // Số lượng trúng cử
  description: string
}

export interface Candidate {
  id: string
  name: string
  studentId: string // MSSV
  phone?: string
  email?: string
  positionIds: string[] // Có thể ứng cử nhiều chức vụ
  bio?: string // Giới thiệu bản thân
  slogan?: string // Lời hứa tranh cử / Chương trình hành động
  avatar?: string
  registeredAt: string
}

export interface Vote {
  id: string
  voterName: string
  voterStudentId: string // MSSV người bỏ phiếu
  selections: Record<string, string[]> // { [positionId]: [candidateId1, candidateId2] }
  votedAt: string
}

export interface ElectionData {
  unit: string // "K71-P-ME2"
  academicYear: string // "2026-2027"
  title: string
  positions: Position[]
  candidates: Candidate[]
  votes: Vote[]
  isRegistrationOpen: boolean // Cho phép nộp đơn tranh cử
  isVotingOpen: boolean // Cho phép cử tri bỏ phiếu
  round: number // Vòng 1, Vòng 2 (khi hòa phiếu)
  updatedAt: string
}

// 8 Chức vụ chuẩn xác theo yêu cầu người dùng và ảnh Ban chấp hành lâm thời K71-P-ME2
export const DEFAULT_POSITIONS: Position[] = [
  // Ban Cán sự lớp
  {
    id: 'lop_truong',
    title: 'Lớp trưởng',
    category: 'bcs',
    categoryName: 'Ban Cán Sự Lớp',
    quota: 1,
    description: 'Chỉ đạo toàn diện hoạt động của lớp, đại diện liên lạc với Cố vấn học tập và Khoa FEPN.',
  },
  {
    id: 'lop_pho',
    title: 'Lớp phó',
    category: 'bcs',
    categoryName: 'Ban Cán Sự Lớp',
    quota: 2,
    description: 'Phụ trách học tập, đời sống, phong trào và hỗ trợ Lớp trưởng điều hành lớp.',
  },
  // Ban Chấp hành Chi Đoàn lâm thời
  {
    id: 'bi_thu',
    title: 'Bí thư Chi đoàn',
    category: 'doan',
    categoryName: 'Ban Chấp Hành Chi Đoàn',
    quota: 1,
    description: 'Lãnh đạo công tác Đoàn, tư tưởng chính trị, phong trào thanh niên và giới thiệu Đoàn viên ưu tú.',
  },
  {
    id: 'pho_bi_thu',
    title: 'Phó Bí thư Chi đoàn',
    category: 'doan',
    categoryName: 'Ban Chấp Hành Chi Đoàn',
    quota: 1,
    description: 'Hỗ trợ Bí thư Chi đoàn, phụ trách tổ chức sinh hoạt Đoàn định kỳ và các cuộc thi thanh niên.',
  },
  {
    id: 'uv_chi_doan',
    title: 'Ủy viên BCH Chi đoàn',
    category: 'doan',
    categoryName: 'Ban Chấp Hành Chi Đoàn',
    quota: 1,
    description: 'Phụ trách công tác kiểm tra, phong trào tình nguyện và các hoạt động xung kích của Chi đoàn.',
  },
  // Ban Chấp hành Chi Hội Sinh viên lâm thời
  {
    id: 'chi_hoi_truong',
    title: 'Chi Hội Trưởng',
    category: 'hoi',
    categoryName: 'Ban Chấp Hành Chi Hội Sinh Viên',
    quota: 1,
    description: 'Chỉ đạo phong trào Hội Sinh viên, phong trào "Sinh viên 5 tốt" và các hoạt động thể thao - văn nghệ.',
  },
  {
    id: 'chi_hoi_pho',
    title: 'Chi Hội Phó',
    category: 'hoi',
    categoryName: 'Ban Chấp Hành Chi Hội Sinh Viên',
    quota: 1,
    description: 'Đồng hành cùng Chi Hội trưởng triển khai hoạt động hỗ trợ học tập, sinh viên nghiên cứu khoa học.',
  },
  {
    id: 'uv_chi_hoi',
    title: 'Ủy viên BCH Chi hội',
    category: 'hoi',
    categoryName: 'Ban Chấp Hành Chi Hội Sinh Viên',
    quota: 1,
    description: 'Phụ trách công tác hội viên, truyền thông sự kiện và quản lý phong trào Hội.',
  },
]

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'baucu_k71p_me2.json')

// Khởi tạo dữ liệu mặc định
function createInitialData(): ElectionData {
  return {
    unit: 'K71-P-ME2',
    academicYear: '2026-2027',
    title: 'BẦU CỬ BAN CÁN SỰ & BAN CHẤP HÀNH LÂM THỜI K71-P-ME2',
    positions: DEFAULT_POSITIONS,
    candidates: [],
    votes: [],
    isRegistrationOpen: true,
    isVotingOpen: true,
    round: 1,
    updatedAt: new Date().toISOString(),
  }
}

// Đọc dữ liệu từ file JSON
export async function getElectionData(): Promise<ElectionData> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, 'utf-8')
    const parsed: ElectionData = JSON.parse(raw)
    // Đảm bảo luôn đủ các chức vụ chuẩn
    if (!parsed.positions || parsed.positions.length === 0) {
      parsed.positions = DEFAULT_POSITIONS
    }
    return parsed
  } catch (error) {
    const initial = createInitialData()
    await saveElectionData(initial)
    return initial
  }
}

// Lưu dữ liệu vào file JSON
export async function saveElectionData(data: ElectionData): Promise<void> {
  data.updatedAt = new Date().toISOString()
  try {
    await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true })
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving election data to file:', err)
  }
}

// Đăng ký ứng cử viên mới
export async function registerCandidate(payload: {
  name: string
  studentId: string
  phone?: string
  email?: string
  positionIds: string[]
  bio?: string
  slogan?: string
}): Promise<{ success: boolean; message: string; candidate?: Candidate }> {
  const data = await getElectionData()

  if (!data.isRegistrationOpen) {
    return { success: false, message: 'Hệ thống hiện đã đóng tiếp nhận hồ sơ ứng cử.' }
  }

  const cleanName = (payload.name || '').trim()
  const cleanMssv = (payload.studentId || '').trim().toUpperCase()

  if (!cleanName || !cleanMssv) {
    return { success: false, message: 'Vui lòng điền đầy đủ Họ và tên cùng Mã số sinh viên (MSSV).' }
  }

  if (!payload.positionIds || payload.positionIds.length === 0) {
    return { success: false, message: 'Vui lòng chọn ít nhất một chức vụ mà bạn muốn ứng cử.' }
  }

  // Kiểm tra xem MSSV này đã đăng ký trước đó chưa
  const existingIdx = data.candidates.findIndex(
    (c) => c.studentId.trim().toUpperCase() === cleanMssv
  )

  const candidateObj: Candidate = {
    id: existingIdx !== -1 ? data.candidates[existingIdx].id : `c_${Date.now()}_${cleanMssv}`,
    name: cleanName,
    studentId: cleanMssv,
    phone: payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    positionIds: payload.positionIds,
    bio: payload.bio?.trim() || '',
    slogan: payload.slogan?.trim() || '',
    registeredAt: existingIdx !== -1 ? data.candidates[existingIdx].registeredAt : new Date().toISOString(),
  }

  if (existingIdx !== -1) {
    // Cập nhật thông tin ứng cử
    data.candidates[existingIdx] = candidateObj
  } else {
    data.candidates.push(candidateObj)
  }

  await saveElectionData(data)
  return {
    success: true,
    message: existingIdx !== -1 ? 'Cập nhật thông tin ứng cử thành công!' : 'Đăng ký ứng cử thành công!',
    candidate: candidateObj,
  }
}

// Xóa ứng viên (dành cho người điều hành)
export async function deleteCandidate(candidateId: string): Promise<boolean> {
  const data = await getElectionData()
  data.candidates = data.candidates.filter((c) => c.id !== candidateId)
  await saveElectionData(data)
  return true
}

// Kiểm tra cử tri đã bỏ phiếu chưa
export async function hasStudentVoted(studentId: string): Promise<boolean> {
  const data = await getElectionData()
  const cleanMssv = (studentId || '').trim().toUpperCase()
  return data.votes.some((v) => v.voterStudentId.trim().toUpperCase() === cleanMssv)
}

// Gửi phiếu bầu cử theo đúng Thể lệ Điều 2
export async function submitVote(payload: {
  voterName: string
  voterStudentId: string
  selections: Record<string, string[]> // { [positionId]: [candidateId...] }
}): Promise<{ success: boolean; message: string }> {
  const data = await getElectionData()

  if (!data.isVotingOpen) {
    return { success: false, message: 'Hòm phiếu biểu quyết hiện đang đóng hoặc chưa bắt đầu.' }
  }

  const cleanName = (payload.voterName || '').trim()
  const cleanMssv = (payload.voterStudentId || '').trim().toUpperCase()

  if (!cleanName || !cleanMssv) {
    return { success: false, message: 'Vui lòng nhập Họ tên và MSSV để xác minh trước khi bỏ phiếu.' }
  }

  // Điều 2. Khoản 1: Mỗi thành viên trong lớp chỉ được gửi phiếu bầu 1 lần duy nhất
  const alreadyVoted = data.votes.some((v) => v.voterStudentId.trim().toUpperCase() === cleanMssv)
  if (alreadyVoted) {
    return {
      success: false,
      message: `MSSV ${cleanMssv} đã gửi phiếu bầu trước đó rồi. Mỗi thành viên chỉ được bỏ phiếu 1 lần duy nhất theo Điều 2 Thể lệ!`,
    }
  }

  // Kiểm tra giới hạn số lượng lựa chọn cho từng chức vụ theo Điều 2
  for (const pos of data.positions) {
    // Danh sách ứng viên cho chức vụ này
    const candidatesForPos = data.candidates.filter((c) => c.positionIds.includes(pos.id))
    const selectedForPos = payload.selections[pos.id] || []

    // Quy định thể lệ:
    // Chức vụ có từ 5 người ứng cử trở lên: chọn tối đa 3 ứng viên khác nhau
    // Chức vụ có dưới 5 người ứng cử: chọn tối đa 1 ứng viên (riêng Lớp phó có quota=2 thì chọn tối đa 2)
    let maxAllowed = 1
    if (candidatesForPos.length >= 5) {
      maxAllowed = 3
    } else if (pos.quota > 1) {
      maxAllowed = pos.quota
    }

    if (selectedForPos.length > maxAllowed) {
      return {
        success: false,
        message: `Tại chức vụ "${pos.title}", bạn đã chọn ${selectedForPos.length} ứng viên. Theo Thể lệ bạn chỉ được chọn tối đa ${maxAllowed} ứng viên!`,
      }
    }
  }

  // Ghi nhận phiếu bầu
  const newVote: Vote = {
    id: `vote_${Date.now()}_${cleanMssv}`,
    voterName: cleanName,
    voterStudentId: cleanMssv,
    selections: payload.selections,
    votedAt: new Date().toISOString(),
  }

  data.votes.push(newVote)
  await saveElectionData(data)

  return {
    success: true,
    message: 'Bỏ phiếu thành công! Phiếu bầu của bạn đã được hệ thống ghi nhận hợp lệ.',
  }
}

// Tính toán kết quả bầu cử tổng hợp theo Điều 3
export interface PositionResult {
  position: Position
  candidatesCount: number
  maxAllowedVotesPerPerson: number
  totalVotesCastForPosition: number // Tổng số lượt chọn
  candidates: {
    candidate: Candidate
    voteCount: number
    percentage: number // % trên tổng số cử tri đã bỏ phiếu
    isElected: boolean // Trúng cử
    isTied: boolean // Bằng phiếu ở vị trí trúng cử cần bầu lại
  }[]
  hasTie: boolean // Có hòa phiếu ở vị trí dẫn đầu
  tiedCandidates: Candidate[]
}

export interface ElectionSummary {
  unit: string
  academicYear: string
  title: string
  totalVoters: number // Tổng số người đã bỏ phiếu
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  round: number
  updatedAt: string
  results: PositionResult[]
}

export function computeResults(data: ElectionData): ElectionSummary {
  const totalVoters = data.votes.length

  const results: PositionResult[] = data.positions.map((pos) => {
    // Lấy các ứng viên của vị trí này
    const candidatesForPos = data.candidates.filter((c) => c.positionIds.includes(pos.id))

    // Giới hạn lựa chọn theo Điều 2
    let maxAllowed = 1
    if (candidatesForPos.length >= 5) {
      maxAllowed = 3
    } else if (pos.quota > 1) {
      maxAllowed = pos.quota
    }

    // Đếm phiếu cho từng ứng viên
    const tally: Record<string, number> = {}
    candidatesForPos.forEach((c) => {
      tally[c.id] = 0
    })

    let totalVotesCast = 0
    data.votes.forEach((v) => {
      const picks = v.selections[pos.id] || []
      picks.forEach((cId) => {
        if (tally[cId] !== undefined) {
          tally[cId]++
          totalVotesCast++
        }
      })
    })

    // Sắp xếp giảm dần theo số phiếu
    const candidateResults = candidatesForPos
      .map((c) => {
        const count = tally[c.id] || 0
        const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 1000) / 10 : 0
        return {
          candidate: c,
          voteCount: count,
          percentage,
          isElected: false,
          isTied: false,
        }
      })
      .sort((a, b) => b.voteCount - a.voteCount)

    // Xác định trúng cử theo Điều 3
    // Khoản 1: Ứng viên có số phiếu bầu cao nhất sẽ trúng cử
    // Khoản 2: Nếu có từ 2 ứng viên trở lên bằng phiếu ở vị trí cao nhất (hoặc ở vị trí tranh chấp quota) -> hòa phiếu
    const quota = pos.quota
    let hasTie = false
    const tiedCandidates: Candidate[] = []

    if (candidateResults.length > 0 && totalVoters > 0) {
      if (quota === 1) {
        // Chỉ cần xét top 1
        const topVote = candidateResults[0].voteCount
        if (topVote > 0) {
          const topTied = candidateResults.filter((r) => r.voteCount === topVote)
          if (topTied.length > 1) {
            hasTie = true
            topTied.forEach((r) => {
              r.isTied = true
              tiedCandidates.push(r.candidate)
            })
          } else {
            candidateResults[0].isElected = true
          }
        }
      } else {
        // Ví dụ Lớp phó quota = 2
        // Cần lấy 2 người điểm cao nhất
        const cutoffVote = candidateResults[quota - 1]?.voteCount ?? 0
        if (cutoffVote > 0) {
          // Kiểm tra xem tại vị trí cutoff có bao nhiêu người bằng phiếu
          const atCutoff = candidateResults.filter((r) => r.voteCount === cutoffVote)
          const strictlyAboveCutoff = candidateResults.filter((r) => r.voteCount > cutoffVote)

          if (strictlyAboveCutoff.length + atCutoff.length > quota) {
            // Có tranh chấp tại vị trí cuối cùng
            hasTie = true
            strictlyAboveCutoff.forEach((r) => {
              r.isElected = true
            })
            atCutoff.forEach((r) => {
              r.isTied = true
              tiedCandidates.push(r.candidate)
            })
          } else {
            for (let i = 0; i < Math.min(quota, candidateResults.length); i++) {
              if (candidateResults[i].voteCount > 0) {
                candidateResults[i].isElected = true
              }
            }
          }
        } else {
          // Những người có vote > 0 vẫn trúng cử
          candidateResults.forEach((r, idx) => {
            if (idx < quota && r.voteCount > 0) r.isElected = true
          })
        }
      }
    }

    return {
      position: pos,
      candidatesCount: candidatesForPos.length,
      maxAllowedVotesPerPerson: maxAllowed,
      totalVotesCastForPosition: totalVotesCast,
      candidates: candidateResults,
      hasTie,
      tiedCandidates,
    }
  })

  return {
    unit: data.unit,
    academicYear: data.academicYear,
    title: data.title,
    totalVoters,
    isRegistrationOpen: data.isRegistrationOpen,
    isVotingOpen: data.isVotingOpen,
    round: data.round || 1,
    updatedAt: data.updatedAt,
    results,
  }
}

// Cập nhật trạng thái bầu cử
export async function updateElectionState(updates: Partial<ElectionData>): Promise<ElectionData> {
  const data = await getElectionData()
  Object.assign(data, updates)
  await saveElectionData(data)
  return data
}

// Reset bầu cử (xóa phiếu bầu để bầu vòng 2 hoặc làm lại)
export async function resetVotes(keepCandidates: boolean = true): Promise<void> {
  const data = await getElectionData()
  data.votes = []
  if (!keepCandidates) {
    data.candidates = []
  }
  data.round = (data.round || 1) + 1
  await saveElectionData(data)
}
