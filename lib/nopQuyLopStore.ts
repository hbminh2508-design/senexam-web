import fs from 'fs'
import path from 'path'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export interface FundStudent {
  id: string
  name: string
  mssv?: string
  paid: boolean
  paidAt?: string
  paymentCode?: string
  note?: string
}

export interface ClassFund {
  id: string
  title: string
  className: string
  amountPerPerson: number
  dueDate: string // YYYY-MM-DD or ISO
  bankName: string
  bankAccount: string
  accountName: string
  description?: string
  adminPasscode?: string
  students: FundStudent[]
  createdAt: string
  updatedAt: string
}

const LOCAL_DATA_PATH = path.join(process.cwd(), 'data', 'nopquylop-funds.json')

// Đọc từ file JSON cục bộ
function readLocalFunds(): ClassFund[] {
  try {
    if (!fs.existsSync(LOCAL_DATA_PATH)) {
      // Dữ liệu mẫu ban đầu cho lớp ME2 nếu chưa có quỹ nào
      const initialData: ClassFund[] = [
        {
          id: 'me2-hk2-2026',
          title: 'Quỹ Lớp Học Kỳ 2 (2025 - 2026)',
          className: 'ME2',
          amountPerPerson: 100000,
          dueDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Đặt quá hạn > 7 ngày để test tính năng cảnh báo đỏ
          bankName: 'MBBANK',
          bankAccount: '0988776655',
          accountName: 'BUI HOANG BINH MINH',
          description: 'Thu tiền quỹ phục vụ photo tài liệu, sinh hoạt ngoại khóa và quỹ thực hành xưởng ME2.',
          adminPasscode: 'me2@2026',
          students: [
            { id: '1', name: 'Nguyễn Văn An', mssv: '20221001', paid: true, paidAt: new Date(Date.now() - 10 * 86400000).toISOString(), paymentCode: 'ME2-AN-1001' },
            { id: '2', name: 'Trần Thị Bích', mssv: '20221002', paid: true, paidAt: new Date(Date.now() - 8 * 86400000).toISOString(), paymentCode: 'ME2-BICH-1002' },
            { id: '3', name: 'Lê Hoàng Cường', mssv: '20221003', paid: false },
            { id: '4', name: 'Phạm Minh Đức', mssv: '20221004', paid: false },
            { id: '5', name: 'Hoàng Quốc Hưng', mssv: '20221005', paid: false },
            { id: '6', name: 'Vũ Thùy Linh', mssv: '20221006', paid: true, paidAt: new Date(Date.now() - 5 * 86400000).toISOString(), paymentCode: 'ME2-LINH-1006' },
            { id: '7', name: 'Đặng Tuấn Nam', mssv: '20221007', paid: false },
            { id: '8', name: 'Bùi Thị Phương', mssv: '20221008', paid: false },
          ],
          createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(initialData, null, 2), 'utf-8')
      return initialData
    }
    const raw = fs.readFileSync(LOCAL_DATA_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('Error reading local funds JSON:', err)
    return []
  }
}

function writeLocalFunds(funds: ClassFund[]): void {
  try {
    const dir = path.dirname(LOCAL_DATA_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(funds, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error writing local funds JSON:', err)
  }
}

// 1. Lấy danh sách tất cả các quỹ
export async function getAllFunds(): Promise<ClassFund[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('class_funds')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        title: d.title,
        className: d.class_name || 'ME2',
        amountPerPerson: Number(d.amount_per_person) || 0,
        dueDate: d.due_date,
        bankName: d.bank_name,
        bankAccount: d.bank_account,
        accountName: d.account_name,
        description: d.description,
        adminPasscode: d.admin_passcode,
        students: Array.isArray(d.students) ? d.students : [],
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }))
    }
  } catch {
    // Fallback to local file
  }
  return readLocalFunds()
}

// 2. Lấy thông tin 1 quỹ theo ID
export async function getFundById(id: string): Promise<ClassFund | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('class_funds')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!error && data) {
      return {
        id: data.id,
        title: data.title,
        className: data.class_name || 'ME2',
        amountPerPerson: Number(data.amount_per_person) || 0,
        dueDate: data.due_date,
        bankName: data.bank_name,
        bankAccount: data.bank_account,
        accountName: data.account_name,
        description: data.description,
        adminPasscode: data.admin_passcode,
        students: Array.isArray(data.students) ? data.students : [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    }
  } catch {
    // Fallback to local
  }

  const local = readLocalFunds()
  return local.find((f) => f.id === id) || null
}

// 3. Tạo quỹ mới
export async function createFund(fundData: Omit<ClassFund, 'createdAt' | 'updatedAt'>): Promise<ClassFund> {
  const newFund: ClassFund = {
    ...fundData,
    className: fundData.className || 'ME2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Lưu Supabase
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('class_funds').insert({
      id: newFund.id,
      title: newFund.title,
      class_name: newFund.className,
      amount_per_person: newFund.amountPerPerson,
      due_date: newFund.dueDate,
      bank_name: newFund.bankName,
      bank_account: newFund.bankAccount,
      account_name: newFund.accountName,
      description: newFund.description,
      admin_passcode: newFund.adminPasscode,
      students: newFund.students,
      created_at: newFund.createdAt,
      updated_at: newFund.updatedAt,
    })
  } catch {
    // Fallback
  }

  // Luôn đồng bộ vào file JSON
  const local = readLocalFunds()
  const existingIdx = local.findIndex((f) => f.id === newFund.id)
  if (existingIdx >= 0) {
    local[existingIdx] = newFund
  } else {
    local.unshift(newFund)
  }
  writeLocalFunds(local)

  return newFund
}

// 4. Cập nhật trạng thái nộp tiền của sinh viên
export async function updateStudentPayment(
  fundId: string,
  studentIdOrMssv: string,
  paid: boolean,
  paymentCode?: string
): Promise<{ success: boolean; student?: FundStudent; fund?: ClassFund }> {
  const fund = await getFundById(fundId)
  if (!fund) return { success: false }

  const student = fund.students.find(
    (s) => s.id === studentIdOrMssv || s.mssv === studentIdOrMssv
  )
  if (!student) return { success: false }

  student.paid = paid
  student.paidAt = paid ? new Date().toISOString() : undefined
  if (paymentCode) student.paymentCode = paymentCode
  fund.updatedAt = new Date().toISOString()

  // Cập nhật Supabase
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin
      .from('class_funds')
      .update({
        students: fund.students,
        updated_at: fund.updatedAt,
      })
      .eq('id', fundId)
  } catch {
    // Fallback
  }

  // Cập nhật file JSON
  const local = readLocalFunds()
  const idx = local.findIndex((f) => f.id === fundId)
  if (idx >= 0) {
    local[idx] = fund
    writeLocalFunds(local)
  }

  return { success: true, student, fund }
}

// Chuẩn hóa tên tiếng Việt để so khớp không phân biệt hoa thường và dấu
export function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}
