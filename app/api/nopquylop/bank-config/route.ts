import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const bankBin = process.env.VIETQR_BANK_BIN || '970422'
  const accountNo = process.env.VIETQR_ACCOUNT_NO || '0988776655'
  const accountName = process.env.VIETQR_ACCOUNT_NAME || 'BUI HOANG BINH MINH'

  return NextResponse.json({
    bankBin,
    bankName: 'MBBANK',
    accountNo,
    accountName,
  })
}
