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
  bio?: string
  slogan?: string
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
  id: string // "k70p_me2", "k71p_me2", ...
  unit: string // "K70P-ME2", "K71-P-ME2", ...
  academicYear: string // "2026-2027"
  title: string
  positions: Position[]
  candidates: Candidate[]
  votes: Vote[]
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  round: number
  updatedAt: string
}

export interface ElectionClassInfo {
  id: string
  unit: string
  academicYear: string
  title: string
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  round: number
  totalCandidates: number
  totalVotes: number
  updatedAt: string
}

// 8 Chức vụ chuẩn mực của FEPN
export const DEFAULT_POSITIONS: Position[] = [
  // I. Ban Cán Sự Lớp
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
  // II. Ban Chấp Hành Chi Đoàn Lâm Thời
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
  // III. Ban Chấp Hành Chi Hội Sinh Viên Lâm Thời
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

// Chuẩn hóa tên lớp thành slug id (ví dụ: "K70P-ME2" -> "k70p_me2")
export function normalizeClassId(unit: string): string {
  if (!unit) return 'k70p_me2'
  const normalized = unit
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'k70p_me2'
}

const DATA_DIR = path.join(process.cwd(), 'data')
const CLASSES_INDEX_PATH = path.join(DATA_DIR, 'baucu_classes.json')

function getClassFilePath(classId: string): string {
  return path.join(DATA_DIR, `baucu_${normalizeClassId(classId)}.json`)
}

// Khởi tạo bản ghi mặc định cho lớp
export function createInitialElectionData(unitName: string = 'K70P-ME2', academicYear: string = '2026-2027'): ElectionData {
  const cleanUnit = unitName.trim().toUpperCase()
  const classId = normalizeClassId(cleanUnit)
  return {
    id: classId,
    unit: cleanUnit,
    academicYear: academicYear.trim() || '2026-2027',
    title: `BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ ${cleanUnit}`.normalize('NFC'),
    positions: DEFAULT_POSITIONS,
    candidates: [],
    votes: [],
    isRegistrationOpen: true,
    isVotingOpen: true,
    round: 1,
    updatedAt: new Date().toISOString(),
  }
}

// Lấy danh sách tất cả các lớp bầu cử hiện có
export async function getAllClasses(): Promise<ElectionClassInfo[]> {
  const classesMap = new Map<string, ElectionClassInfo>()

  // 1. Thử lấy từ Supabase fepn_election_settings
  try {
    const { data: remoteSettings, error } = await supabase
      .from('fepn_election_settings')
      .select('id, unit, academic_year, title, is_registration_open, is_voting_open, round, updated_at')
      .order('updated_at', { ascending: false })

    if (!error && Array.isArray(remoteSettings) && remoteSettings.length > 0) {
      for (const s of remoteSettings) {
        classesMap.set(s.id, {
          id: s.id,
          unit: s.unit || s.id.toUpperCase(),
          academicYear: s.academic_year || '2026-2027',
          title: s.title || `BẦU CỬ LỚP ${s.unit}`,
          isRegistrationOpen: s.is_registration_open ?? true,
          isVotingOpen: s.is_voting_open ?? true,
          round: s.round || 1,
          totalCandidates: 0,
          totalVotes: 0,
          updatedAt: s.updated_at || new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    // Supabase offline / fallback
  }

  // 2. Đọc file index baucu_classes.json local
  try {
    const raw = await fs.readFile(CLASSES_INDEX_PATH, 'utf-8')
    const localClasses: ElectionClassInfo[] = JSON.parse(raw)
    for (const c of localClasses) {
      if (!classesMap.has(c.id)) {
        classesMap.set(c.id, c)
      } else {
        // Cập nhật thông tin nếu có
        const existing = classesMap.get(c.id)!
        classesMap.set(c.id, { ...existing, unit: c.unit || existing.unit })
      }
    }
  } catch {
    // Chưa có file index
  }

  // 3. Đảm bảo luôn có lớp mặc định K70P-ME2 và K71-P-ME2 nếu hệ thống trống
  if (!classesMap.has('k70p_me2')) {
    classesMap.set('k70p_me2', {
      id: 'k70p_me2',
      unit: 'K70P-ME2',
      academicYear: '2026-2027',
      title: 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K70P-ME2'.normalize('NFC'),
      isRegistrationOpen: true,
      isVotingOpen: true,
      round: 1,
      totalCandidates: 0,
      totalVotes: 0,
      updatedAt: new Date().toISOString(),
    })
  }

  if (!classesMap.has('k71p_me2')) {
    classesMap.set('k71p_me2', {
      id: 'k71p_me2',
      unit: 'K71-P-ME2',
      academicYear: '2026-2027',
      title: 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K71-P-ME2'.normalize('NFC'),
      isRegistrationOpen: true,
      isVotingOpen: true,
      round: 1,
      totalCandidates: 0,
      totalVotes: 0,
      updatedAt: new Date().toISOString(),
    })
  }

  const list = Array.from(classesMap.values())

  // Cập nhật số lượng ứng viên và cử tri thực tế cho từng lớp
  for (const c of list) {
    try {
      const classData = await getElectionData(c.id)
      c.totalCandidates = classData.candidates.length
      c.totalVotes = classData.votes.length
      c.isRegistrationOpen = classData.isRegistrationOpen
      c.isVotingOpen = classData.isVotingOpen
      c.round = classData.round
    } catch {}
  }

  // Lưu lại cache local
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(CLASSES_INDEX_PATH, JSON.stringify(list, null, 2), 'utf-8')
  } catch {}

  return list
}

// Tạo thêm bầu cử cho lớp mới (gọi từ baucu/admin)
export async function createClassElection(payload: {
  unit: string
  academicYear?: string
  title?: string
}): Promise<ElectionData> {
  const cleanUnit = (payload.unit || '').trim().toUpperCase()
  if (!cleanUnit) {
    throw new Error('Vui lòng nhập tên lớp cần tạo bầu cử.')
  }

  const classId = normalizeClassId(cleanUnit)
  const academicYear = (payload.academicYear || '2026-2027').trim()
  const title = (payload.title || `BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ ${cleanUnit}`).trim().normalize('NFC')

  // Kiểm tra xem đã có dữ liệu chưa
  let data: ElectionData
  try {
    data = await getElectionData(classId)
    data.unit = cleanUnit
    data.academicYear = academicYear
    data.title = title
  } catch {
    data = {
      id: classId,
      unit: cleanUnit,
      academicYear,
      title,
      positions: DEFAULT_POSITIONS,
      candidates: [],
      votes: [],
      isRegistrationOpen: true,
      isVotingOpen: true,
      round: 1,
      updatedAt: new Date().toISOString(),
    }
  }

  // Lưu local và đồng bộ Supabase
  await saveElectionData(data, true)

  // Cập nhật index classes
  const classes = await getAllClasses()
  const foundIdx = classes.findIndex((c) => c.id === classId)
  const classItem: ElectionClassInfo = {
    id: classId,
    unit: cleanUnit,
    academicYear,
    title,
    isRegistrationOpen: data.isRegistrationOpen,
    isVotingOpen: data.isVotingOpen,
    round: data.round,
    totalCandidates: data.candidates.length,
    totalVotes: data.votes.length,
    updatedAt: data.updatedAt,
  }

  if (foundIdx >= 0) {
    classes[foundIdx] = classItem
  } else {
    classes.unshift(classItem)
  }

  try {
    await fs.writeFile(CLASSES_INDEX_PATH, JSON.stringify(classes, null, 2), 'utf-8')
  } catch {}

  return data
}

// Lấy dữ liệu bầu cử của một lớp cụ thể
export async function getElectionData(classIdParam?: string): Promise<ElectionData> {
  const classId = normalizeClassId(classIdParam || 'k70p_me2')
  const filePath = getClassFilePath(classId)

  let localData: ElectionData | null = null

  // 1. Thử đọc từ local JSON
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    localData = JSON.parse(raw)
  } catch {
    // Nếu chưa có file riêng, thử đọc file cũ baucu_k71p_me2.json nếu là k71p_me2
    if (classId === 'k71p_me2') {
      try {
        const legacyRaw = await fs.readFile(path.join(DATA_DIR, 'baucu_k71p_me2.json'), 'utf-8')
        localData = JSON.parse(legacyRaw)
      } catch {}
    }
  }

  // 2. Thử đồng bộ từ Supabase cho lớp này
  try {
    const [settingsRes, candidatesRes, votesRes] = await Promise.all([
      supabase.from('fepn_election_settings').select('*').eq('id', classId).maybeSingle(),
      supabase.from('fepn_election_candidates').select('*').eq('election_id', classId),
      supabase.from('fepn_election_votes').select('*').eq('election_id', classId),
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

      const unitName = s.unit || (classId === 'k70p_me2' ? 'K70P-ME2' : classId.toUpperCase())
      const syncedData: ElectionData = {
        id: classId,
        unit: unitName,
        academicYear: s.academic_year || '2026-2027',
        title: s.title || `BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ ${unitName}`.normalize('NFC'),
        positions: Array.isArray(s.positions) && s.positions.length > 0 ? s.positions : DEFAULT_POSITIONS,
        candidates: remoteCandidates,
        votes: remoteVotes,
        isRegistrationOpen: s.is_registration_open ?? true,
        isVotingOpen: s.is_voting_open ?? true,
        round: s.round || 1,
        updatedAt: s.updated_at || new Date().toISOString(),
      }

      await saveElectionData(syncedData, false)
      return syncedData
    }
  } catch (err) {
    // Supabase chưa cấu hình bảng hoặc offline -> Dùng localData
  }

  if (!localData) {
    const defaultUnit = classId === 'k70p_me2' ? 'K70P-ME2' : classId === 'k71p_me2' ? 'K71-P-ME2' : classId.toUpperCase()
    localData = createInitialElectionData(defaultUnit)
  }

  localData.id = classId
  if (!localData.positions || localData.positions.length === 0) {
    localData.positions = DEFAULT_POSITIONS
  }

  return localData
}

// Lưu dữ liệu vào file JSON và đồng bộ Supabase
export async function saveElectionData(data: ElectionData, syncToSupabase: boolean = true): Promise<void> {
  const classId = normalizeClassId(data.id || data.unit)
  data.id = classId
  data.updatedAt = new Date().toISOString()
  const filePath = getClassFilePath(classId)

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Lỗi khi lưu dữ liệu lớp ${classId} vào file:`, err)
  }

  if (syncToSupabase) {
    try {
      await supabase.from('fepn_election_settings').upsert({
        id: classId,
        unit: data.unit,
        academic_year: data.academicYear,
        title: data.title,
        is_registration_open: data.isRegistrationOpen,
        is_voting_open: data.isVotingOpen,
        round: data.round || 1,
        positions: data.positions,
        updated_at: data.updatedAt,
      })
    } catch (e) {
      console.warn(`Lỗi sync Supabase settings cho ${classId}:`, e)
    }
  }
}

// Đăng ký ứng cử viên cho lớp
export async function registerCandidate(
  classIdParam: string,
  payload: {
    name: string
    studentId: string
    phone?: string
    email?: string
    positionIds: string[]
    bio?: string
    slogan?: string
  }
): Promise<{ success: boolean; message: string; candidate?: Candidate }> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)

  if (!data.isRegistrationOpen) {
    return { success: false, message: `Hệ thống hiện đã đóng tiếp nhận hồ sơ ứng cử lớp ${data.unit}.` }
  }

  const cleanName = (payload.name || '').trim().normalize('NFC')
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

  const candidateId = existingIdx !== -1 ? data.candidates[existingIdx].id : `c_${classId}_${Date.now()}_${cleanMssv}`
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

  await saveElectionData(data, false)

  // Đồng bộ Supabase
  try {
    await supabase.from('fepn_election_candidates').upsert({
      id: candidateObj.id,
      election_id: classId,
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
    console.warn('Lưu Supabase candidate fallback:', err)
  }

  return {
    success: true,
    message: existingIdx !== -1 ? 'Cập nhật thông tin ứng cử thành công!' : 'Đăng ký ứng cử thành công!',
    candidate: candidateObj,
  }
}

// Xóa ứng viên
export async function deleteCandidate(classIdParam: string, candidateId: string): Promise<boolean> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)
  data.candidates = data.candidates.filter((c) => c.id !== candidateId)
  await saveElectionData(data, false)

  try {
    await supabase.from('fepn_election_candidates').delete().eq('id', candidateId)
  } catch {}

  return true
}

// Kiểm tra xem MSSV đã bỏ phiếu cho lớp này chưa
export async function hasStudentVoted(classIdParam: string, studentId: string): Promise<boolean> {
  const classId = normalizeClassId(classIdParam)
  const cleanMssv = (studentId || '').trim().toUpperCase()
  if (!cleanMssv) return false

  // 1. Thử kiểm tra trên Supabase
  try {
    const { data: voteRow } = await supabase
      .from('fepn_election_votes')
      .select('id')
      .eq('election_id', classId)
      .eq('voter_student_id', cleanMssv)
      .maybeSingle()

    if (voteRow) return true
  } catch {}

  // 2. Fallback kiểm tra file local
  const data = await getElectionData(classId)
  return data.votes.some((v) => v.voterStudentId.trim().toUpperCase() === cleanMssv)
}

// Bỏ phiếu cho lớp
export async function submitVote(
  classIdParam: string,
  payload: {
    voterName: string
    voterStudentId: string
    selections: Record<string, string[]>
  }
): Promise<{ success: boolean; message: string; voteId?: string }> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)

  if (!data.isVotingOpen) {
    return { success: false, message: `Hòm phiếu của lớp ${data.unit} hiện đang đóng hoặc chưa bắt đầu.` }
  }

  const cleanName = (payload.voterName || '').trim().normalize('NFC')
  const cleanMssv = (payload.voterStudentId || '').trim().toUpperCase()

  if (!cleanName || !cleanMssv) {
    return { success: false, message: 'Vui lòng nhập Họ tên và MSSV để xác minh trước khi bỏ phiếu.' }
  }

  // Điều 2 Khoản 1: Mỗi thành viên trong lớp chỉ được gửi phiếu bầu 1 lần duy nhất
  const alreadyVoted = await hasStudentVoted(classId, cleanMssv)
  if (alreadyVoted) {
    return {
      success: false,
      message: `MSSV ${cleanMssv} đã gửi phiếu bầu cho lớp ${data.unit} trước đó rồi. Mỗi thành viên chỉ được bỏ phiếu 1 lần duy nhất theo Điều 2 Thể lệ!`,
    }
  }

  // Kiểm tra giới hạn số lựa chọn theo Điều 2
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

  const voteId = `vote_${classId}_${Date.now()}_${cleanMssv}`
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
      election_id: classId,
      voter_name: cleanName,
      voter_student_id: cleanMssv,
      selections: payload.selections,
      created_at: votedAt,
    })

    if (insErr && insErr.code === '23505') {
      return {
        success: false,
        message: `MSSV ${cleanMssv} đã có phiếu bầu được ghi nhận trong cơ sở dữ liệu lớp ${data.unit}!`,
      }
    }
  } catch (err) {
    console.warn('Lưu Supabase vote fallback:', err)
  }

  data.votes.push(newVote)
  await saveElectionData(data, false)

  return {
    success: true,
    message: `Bỏ phiếu thành công! Phiếu bầu của bạn cho lớp ${data.unit} đã được hệ thống ghi nhận hợp lệ.`,
    voteId,
  }
}

// Xóa 1 phiếu bầu gian lận
export async function deleteSingleVote(classIdParam: string, voteId: string): Promise<boolean> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)
  data.votes = data.votes.filter((v) => v.id !== voteId)
  await saveElectionData(data, false)

  try {
    await supabase.from('fepn_election_votes').delete().eq('id', voteId)
  } catch {}

  return true
}

// Reset phiếu để bầu vòng 2 hoặc làm lại
export async function resetVotes(classIdParam: string, keepCandidates: boolean = true): Promise<void> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)
  data.votes = []
  if (!keepCandidates) {
    data.candidates = []
  }
  data.round = (data.round || 1) + 1
  await saveElectionData(data, true)

  try {
    await supabase.from('fepn_election_votes').delete().eq('election_id', classId)
    if (!keepCandidates) {
      await supabase.from('fepn_election_candidates').delete().eq('election_id', classId)
    }
  } catch {}
}

// Cập nhật trạng thái bầu cử của lớp
export async function updateElectionState(classIdParam: string, updates: Partial<ElectionData>): Promise<ElectionData> {
  const classId = normalizeClassId(classIdParam)
  const data = await getElectionData(classId)
  Object.assign(data, updates)
  await saveElectionData(data, true)
  return data
}

// Xóa cả phiên bầu cử của một lớp
export async function deleteClassElection(classIdParam: string): Promise<boolean> {
  const classId = normalizeClassId(classIdParam)
  const filePath = getClassFilePath(classId)

  try {
    await fs.unlink(filePath)
  } catch {}

  try {
    await supabase.from('fepn_election_settings').delete().eq('id', classId)
  } catch {}

  // Cập nhật index classes
  try {
    const raw = await fs.readFile(CLASSES_INDEX_PATH, 'utf-8')
    const list: ElectionClassInfo[] = JSON.parse(raw)
    const filtered = list.filter((c) => c.id !== classId)
    await fs.writeFile(CLASSES_INDEX_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
  } catch {}

  return true
}

// Tính toán kết quả tổng hợp cho lớp
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
  id: string
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
    id: data.id,
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
