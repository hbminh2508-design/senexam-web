import { NextResponse } from 'next/server'
import { getAllFunds, createFund, type FundStudent, isValidAdminDailyPassword } from '@/lib/nopQuyLopStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const funds = await getAllFunds()
    const now = Date.now()
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

    const summary = funds.map((f) => {
      const isPastDueDate = f.dueDate ? new Date(f.dueDate).getTime() < now : false
      const isOverdueOneWeek = f.dueDate ? now - new Date(f.dueDate).getTime() > ONE_WEEK_MS : false
      const totalStudents = f.students.length
      const paidStudents = f.students.filter((s) => s.paid).length
      const unpaidStudents = totalStudents - paidStudents
      const overdueOneWeekStudents = f.students.filter((s) => !s.paid && isOverdueOneWeek).length
      const totalCollected = paidStudents * f.amountPerPerson
      const targetAmount = totalStudents * f.amountPerPerson
      const initialBalance = f.initialBalance || 0
      const totalExpenses = (f.expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0)
      const currentBalance = initialBalance + totalCollected - totalExpenses

      return {
        id: f.id,
        title: f.title,
        className: f.className || 'ME2',
        isTestFund: Boolean(f.isTestFund || f.id === 'quy-test-hoang-binh-minh' || f.id.includes('test')),
        amountPerPerson: f.amountPerPerson,
        dueDate: f.dueDate,
        bankName: f.bankName,
        bankAccount: f.bankAccount,
        accountName: f.accountName,
        description: f.description,
        totalStudents,
        paidStudents,
        unpaidStudents,
        overdueOneWeekStudents,
        totalCollected,
        targetAmount,
        initialBalance,
        totalExpenses,
        currentBalance,
        progressPercent: targetAmount > 0 ? Math.round((totalCollected / targetAmount) * 100) : 0,
        isPastDueDate,
        isOverdueOneWeek,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      }
    })

    return NextResponse.json({ funds: summary })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi lấy danh sách quỹ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      className,
      amountPerPerson,
      dueDate,
      bankName,
      bankAccount,
      accountName,
      description,
      adminPasscode,
      adminUsername,
      adminPassword,
      students,
      initialBalance,
    } = body

    // 1. Kiểm tra tài khoản & mật khẩu admin theo ngày
    const adminUser = (adminUsername || request.headers.get('x-admin-username') || '').trim()
    const adminPass = (adminPassword || request.headers.get('x-admin-password') || '').trim()

    if (adminUser !== 'admin' || !isValidAdminDailyPassword(adminPass)) {
      return NextResponse.json(
        {
          error: 'Bảo mật: Yêu cầu đăng nhập tài khoản admin và mật khẩu ngày dạng admin-DD/MM/YYYY (VD: admin-19/10/2026)',
        },
        { status: 401 }
      )
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Tên quỹ không được để trống' }, { status: 400 })
    }

    if (!amountPerPerson || Number(amountPerPerson) <= 0) {
      return NextResponse.json({ error: 'Số tiền mỗi người phải lớn hơn 0' }, { status: 400 })
    }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Danh sách sinh viên lớp không được để trống' }, { status: 400 })
    }

    // Tạo ID thân thiện từ title + timestamp
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 25)
    const fundId = `${slug}-${Date.now().toString(36)}`

    const formattedStudents: FundStudent[] = students.map((s: any, idx: number) => ({
      id: String(s.id || idx + 1),
      name: String(s.name || '').trim(),
      mssv: s.mssv ? String(s.mssv).trim() : undefined,
      paid: false,
    }))

    const newFund = await createFund({
      id: fundId,
      title: title.trim(),
      className: className?.trim() || 'ME2',
      amountPerPerson: Number(amountPerPerson),
      dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      bankName: bankName?.trim() || 'VietABank',
      bankAccount: bankAccount?.trim() || '00222085',
      accountName: accountName?.trim() || 'TRAN DUY KHUONG',
      description: description?.trim() || '',
      adminPasscode: adminPasscode?.trim() || '123456',
      initialBalance: Number(initialBalance) || 0,
      students: formattedStudents,
    })

    return NextResponse.json({ success: true, fund: newFund })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi tạo quỹ lớp' }, { status: 500 })
  }
}
