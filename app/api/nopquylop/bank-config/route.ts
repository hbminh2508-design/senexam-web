import { NextResponse } from 'next/server'
import { getNopQuyBankConfig, VIETNAM_BANKS } from '@/lib/vietQrHelper'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getNopQuyBankConfig()

  return NextResponse.json({
    bankBin: config.bankBin,
    bankName: config.bankName,
    accountNo: config.accountNo,
    accountName: config.accountName,
    banks: VIETNAM_BANKS,
  })
}
