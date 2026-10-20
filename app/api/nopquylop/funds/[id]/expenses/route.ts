import { NextResponse } from 'next/server'
import {
  getFundById,
  addExpenseToFund,
  isValidAdminDailyPassword,
  isAuthorizedAdminOrTreasurer,
} from '@/lib/nopQuyLopStore'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const BILL_BUCKET = 'nopquylop-bills'
const MAX_BILL_BYTES = 8 * 1024 * 1024

function isTreasurerUsername(username: string): boolean {
  return ['thuquy', 'thủ quỹ', 'treasurer'].includes(username.toLowerCase())
}

async function uploadBillImage(fundId: string, rawImage: string): Promise<string | undefined> {
  if (!rawImage) return undefined

  const match = rawImage.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i)
  if (!match) return rawImage

  const mimeType = match[1].toLowerCase()
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > MAX_BILL_BYTES) {
    throw new Error('Ảnh bill không được vượt quá 8MB')
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { error: bucketError } = await supabaseAdmin.storage.createBucket(BILL_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_BILL_BYTES}`,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
    console.warn('Storage bucket note:', bucketError.message)
  }

  const extension = mimeType.split('/')[1].replace('jpeg', 'jpg')
  const path = `${fundId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BILL_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false })
  if (uploadError) throw uploadError

  return supabaseAdmin.storage.from(BILL_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }
    return NextResponse.json({ expenses: fund.expenses || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi tải danh sách chi tiêu' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      amount,
      spentAt,
      spentBy,
      receiptImage,
      billImageUrl,
      note,
      adminUsername,
      adminPassword,
      adminPasscode,
    } = body

    const fund = await getFundById(id)
    if (!fund) {
      return NextResponse.json({ error: 'Không tìm thấy quỹ lớp này' }, { status: 404 })
    }

    const username = String(adminUsername || '').trim().toLowerCase()
    const password = String(adminPassword || adminPasscode || '').trim()
    const isAuth =
      isAuthorizedAdminOrTreasurer(fund, {
        adminUsername,
        adminPassword: password,
        adminPasscode: password,
      }) ||
      (username === 'admin' && isValidAdminDailyPassword(password)) ||
      (isTreasurerUsername(username) &&
        Boolean(fund.adminPasscode) &&
        password === fund.adminPasscode)

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Bạn cần nhập mã bảo mật Thủ Quỹ hoặc mật khẩu Admin để thêm hóa đơn vào quỹ!' },
        { status: 401 }
      )
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Tên mục chi không được để trống' }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền chi tiêu phải lớn hơn 0' }, { status: 400 })
    }

    const rawImg = receiptImage || billImageUrl || undefined
    let finalImageUrl: string | undefined = rawImg
    if (rawImg && rawImg.startsWith('data:')) {
      try {
        finalImageUrl = await uploadBillImage(id, rawImg)
      } catch (uploadErr: any) {
        console.warn('Lỗi upload bucket, fallback base64:', uploadErr?.message)
        finalImageUrl = rawImg
      }
    }

    const res = await addExpenseToFund(id, {
      title: title.trim(),
      amount: numAmount,
      spentAt: spentAt || new Date().toISOString().split('T')[0],
      spentBy: spentBy?.trim() || 'Thủ quỹ',
      billImageUrl: finalImageUrl,
      receiptImage: finalImageUrl,
      note: note?.trim() || undefined,
    })

    if (!res.success) {
      return NextResponse.json({ error: 'Không thể thêm khoản chi vào quỹ' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      expense: res.expense,
      fund: res.fund,
      message: 'Đã thêm khoản chi thành công và trừ vào quỹ lớp!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi máy chủ khi thêm khoản chi' }, { status: 500 })
  }
}
