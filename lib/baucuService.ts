import fs from 'fs/promises'
import path from 'path'
import { supabase } from '@/lib/supabaseClient'

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
    title: 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K71-P-ME2',
    positions: DEFAULT_POSITIONS,
    candidates: [],
    votes: [],
    isRegistrationOpen: true,
    isVotingOpen: true,
    round: 1,
    updatedAt: new Date().toISOString(),
  }
}

// Đọc dữ liệu từ Supabase hoặc file JSON local (Hybrid Sync)
export async function getElectionData(): Promise<ElectionData> {
  let fileData: ElectionData | null = null
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, 'utf-8')
    fileData = JSON.parse(raw)
  } catch {
    fileData = createInitialData()
  }

  // Thử đồng bộ từ Supabase nếu bảng đã tạo
  try {
    const [settingsRes, candidatesRes, votesRes] = await Promise.all([
      supabase.from('fepn_election_settings').select('*').eq('id', 'k71p_me2').maybeSingle(),
      supabase.from('fepn_election_candidates').select('*').eq('election_id', 'k71p_me2'),
      supabase.from('fepn_election_votes').select('*').eq('election_id', 'k71p_me2'),
    ])

    if (!settingsRes.error && settingsRes.data) {
      const s = settingsRes.data
      const remoteCandidates: Candidate[] = (candidatesRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        studentId: c.student_id,
        phone: c.phone || '',
        email: c.email || '',
        positionIds: c.position_ids || [],
        slogan: c.slogan || '',
        bio: c.bio || '',
        avatar: c.avatar || '',
        registeredAt: c.created_at || new Date().toISOString(),
      }))

      const remoteVotes: Vote[] = (votesRes.data || []).map((v: any) => ({
        id: v.id,
        voterName: v.voter_name,
        voterStudentId: v.voter_student_id,
        selections: v.selections || {},
        votedAt: v.created_at || new Date().toISOString(),
      }))

      const syncedData: ElectionData = {
        unit: s.unit || 'K71-P-ME2',
        academicYear: s.academic_year || '2026-2027',
        title: s.title || 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K71-P-ME2',
        positions: Array.isArray(s.positions) && s.positions.length > 0 ? s.positions : DEFAULT_POSITIONS,
        candidates: remoteCandidates,
        votes: remoteVotes,
        isRegistrationOpen: s.is_registration_open ?? true,
        isVotingOpen: s.is_voting_open ?? true,
        round: s.round || 1,
        updatedAt: s.updated_at || new Date().toISOString(),
      }

      // Lưu lại cache file JSON để offline/fallback luôn có dữ liệu mới
      await saveElectionData(syncedData, false)
      return syncedData
    }
  } catch (err) {
    // Supabase chưa cấu hình bảng hoặc offline -> Dùng fileData
  }

  if (!fileData) fileData = createInitialData()
  if (!fileData.positions || fileData.positions.length === 0) {
    fileData.positions = DEFAULT_POSITIONS
  }
  return fileData
}

// Lưu dữ liệu vào file JSON và đồng bộ Supabase nếu có thể
export async function saveElectionData(data: ElectionData, syncToSupabase: boolean = true): Promise<void> {
  data.updatedAt = new Date().toISOString()
  try {
    await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true })
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving election data to file:', err)
  }

  if (syncToSupabase) {
    try {
      await supabase.from('fepn_election_settings').upsert({
        id: 'k71p_me2',
        unit: data.unit,
        academic_year: data.academicYear,
        title: data.title,
        is_registration_open: data.isRegistrationOpen,
        is_voting_open: data.isVotingOpen,
        round: data.round || 1,
        positions: data.positions,
        updated_at: data.updatedAt,
      })
    } catch {}
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

  const existingIdx = data.candidates.findIndex(
    (c) => c.studentId.trim().toUpperCase() === cleanMssv
  )

  const candidateId = existingIdx !== -1 ? data.candidates[existingIdx].id : `c_${Date.now()}_${cleanMssv}`
  const registeredAt = existingIdx !== -1 ? data.candidates[existingIdx].registeredAt : new Date().toISOString()

  const candidateObj: Candidate = {
    id: candidateId,
    name: cleanName,
    studentId: cleanMssv,
    phone: payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    positionIds: payload.positionIds,
    bio: payload.bio?.trim() || '',
    slogan: payload.slogan?.trim() || '',
    registeredAt,
  }

  if (existingIdx !== -1) {
    data.candidates[existingIdx] = candidateObj
  } else {
    data.candidates.push(candidateObj)
  }

  await saveElectionData(data)

  // Đồng bộ sang bảng fepn_election_candidates của Supabase
  try {
    await supabase.from('fepn_election_candidates').upsert({
      id: candidateObj.id,
      election_id: 'k71p_me2',
      name: candidateObj.name,
      student_id: candidateObj.studentId,
      phone: candidateObj.phone,
      email: candidateObj.email,
      position_ids: candidateObj.positionIds,
      slogan: candidateObj.slogan,
      bio: candidateObj.bio,
      created_at: candidateObj.registeredAt,
    })
  } catch (err) {
    console.warn('Lưu Supabase candidates fallback:', err)
  }

  return {
    success: true,
    message: existingIdx !== -1 ? 'Cập nhật thông tin ứng cử thành công!' : 'Đăng ký ứng cử thành công!',
    candidate: candidateObj,
  }
}

// Xóa ứng viên
export async function deleteCandidate(candidateId: string): Promise<boolean> {
  const data = await getElectionData()
  data.candidates = data.candidates.filter((c) => c.id !== candidateId)
  await saveElectionData(data)

  try {
    await supabase.from('fepn_election_candidates').delete().eq('id', candidateId)
  } catch {}

  return true
}

// Kiểm tra cử tri đã bỏ phiếu chưa
export async function hasStudentVoted(studentId: string): Promise<boolean> {
  const cleanMssv = (studentId || '').trim().toUpperCase()
  if (!cleanMssv) return false

  // Thử kiểm tra trên Supabase trước
  try {
    const { data: voteRow } = await supabase
      .from('fepn_election_votes')
      .select('id')
      .eq('election_id', 'k71p_me2')
      .eq('voter_student_id', cleanMssv)
      .maybeSingle()

    if (voteRow) return true
  } catch {}

  // Fallback kiểm tra file local
  const data = await getElectionData()
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
  const alreadyVoted = await hasStudentVoted(cleanMssv)
  if (alreadyVoted) {
    return {
      success: false,
      message: `MSSV ${cleanMssv} đã gửi phiếu bầu trước đó rồi. Mỗi thành viên chỉ được bỏ phiếu 1 lần duy nhất theo Điều 2 Thể lệ!`,
    }
  }

  // Kiểm tra giới hạn số lượng lựa chọn cho từng chức vụ theo Điều 2
  for (const pos of data.positions) {
    const candidatesForPos = data.candidates.filter((c) => c.positionIds.includes(pos.id))
    const selectedForPos = payload.selections[pos.id] || []

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

  const voteId = `vote_${Date.now()}_${cleanMssv}`
  const votedAt = new Date().toISOString()

  const newVote: Vote = {
    id: voteId,
    voterName: cleanName,
    voterStudentId: cleanMssv,
    selections: payload.selections,
    votedAt,
  }

  // Lưu Supabase bảng fepn_election_votes (Kích hoạt Realtime tới Trang 3 ngay lập tức!)
  try {
    const { error: insErr } = await supabase.from('fepn_election_votes').insert({
      id: voteId,
      election_id: 'k71p_me2',
      voter_name: cleanName,
      voter_student_id: cleanMssv,
      selections: payload.selections,
      created_at: votedAt,
    })

    if (insErr && insErr.code === '23505') {
      // Mã lỗi trùng khóa UNIQUE (election_id, voter_student_id)
      return {
        success: false,
        message: `MSSV ${cleanMssv} đã có phiếu bầu được ghi nhận trong cơ sở dữ liệu!`,
      }
    }
  } catch (err) {
    console.warn('Lưu Supabase vote fallback:', err)
  }

  data.votes.push(newVote)
  await saveElectionData(data, false)

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
  totalVotesCastForPosition: number
  candidates: {
    candidate: Candidate
    voteCount: number
    percentage: number
    isElected: boolean
    isTied: boolean
  }[]
  hasTie: boolean
  tiedCandidates: Candidate[]
}

export interface ElectionSummary {
  unit: string
  academicYear: string
  title: string
  totalVoters: number
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  round: number
  updatedAt: string
  results: PositionResult[]
}

export function computeResults(data: ElectionData): ElectionSummary {
  const totalVoters = data.votes.length

  const results: PositionResult[] = data.positions.map((pos) => {
    const candidatesForPos = data.candidates.filter((c) => c.positionIds.includes(pos.id))

    let maxAllowed = 1
    if (candidatesForPos.length >= 5) {
      maxAllowed = 3
    } else if (pos.quota > 1) {
      maxAllowed = pos.quota
    }

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

    const quota = pos.quota
    let hasTie = false
    const tiedCandidates: Candidate[] = []

    if (candidateResults.length > 0 && totalVoters > 0) {
      if (quota === 1) {
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
        const cutoffVote = candidateResults[quota - 1]?.voteCount ?? 0
        if (cutoffVote > 0) {
          const atCutoff = candidateResults.filter((r) => r.voteCount === cutoffVote)
          const strictlyAboveCutoff = candidateResults.filter((r) => r.voteCount > cutoffVote)

          if (strictlyAboveCutoff.length + atCutoff.length > quota) {
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
  await saveElectionData(data, true)
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
  await saveElectionData(data, true)

  try {
    await supabase.from('fepn_election_votes').delete().eq('election_id', 'k71p_me2')
    if (!keepCandidates) {
      await supabase.from('fepn_election_candidates').delete().eq('election_id', 'k71p_me2')
    }
  } catch {}
}

// Xóa 1 phiếu bầu cụ thể (cho Admin xử lý phiếu gian lận theo Điều 5)
export async function deleteSingleVote(voteId: string): Promise<boolean> {
  const data = await getElectionData()
  data.votes = data.votes.filter((v) => v.id !== voteId)
  await saveElectionData(data, false)

  try {
    await supabase.from('fepn_election_votes').delete().eq('id', voteId)
  } catch {}

  return true
}
