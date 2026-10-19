// Quản lý ngân hàng & tạo mã VietQR chuẩn Napas 247

export interface BankInfo {
  code: string
  name: string
  shortName: string
  bin: string
}

export const VIETNAM_BANKS: BankInfo[] = [
  { code: 'MB', shortName: 'MBBank', name: 'Ngân hàng Quân Đội', bin: '970422' },
  { code: 'VCB', shortName: 'Vietcombank', name: 'Ngoại thương Việt Nam', bin: '970436' },
  { code: 'CTG', shortName: 'VietinBank', name: 'Công thương Việt Nam', bin: '970415' },
  { code: 'BIDV', shortName: 'BIDV', name: 'Đầu tư và Phát triển VN', bin: '970418' },
  { code: 'TCB', shortName: 'Techcombank', name: 'Kỹ thương Việt Nam', bin: '970407' },
  { code: 'ACB', shortName: 'ACB', name: 'Á Châu', bin: '970416' },
  { code: 'VPB', shortName: 'VPBank', name: 'Việt Nam Thịnh Vượng', bin: '970432' },
  { code: 'TPB', shortName: 'TPBank', name: 'Tiên Phong', bin: '970423' },
  { code: 'STB', shortName: 'Sacombank', name: 'Sài Gòn Thương Tín', bin: '970403' },
  { code: 'HDB', shortName: 'HDBank', name: 'Phát triển TP.HCM', bin: '970437' },
  { code: 'VBA', shortName: 'Agribank', name: 'Nông nghiệp & Phát triển Nông thôn', bin: '970405' },
  { code: 'OCB', shortName: 'OCB', name: 'Phương Đông', bin: '970448' },
  { code: 'VIB', shortName: 'VIB', name: 'Quốc Tế Việt Nam', bin: '970441' },
  { code: 'MSB', shortName: 'MSB', name: 'Hàng Hải Việt Nam', bin: '970426' },
  { code: 'SHB', shortName: 'SHB', name: 'Sài Gòn - Hà Nội', bin: '970443' },
  { code: 'SSB', shortName: 'SeABank', name: 'Đông Nam Á', bin: '970440' },
  { code: 'LPB', shortName: 'LPBank', name: 'Lộc Phát Việt Nam', bin: '970449' },
  { code: 'TIMO', shortName: 'Timo', name: 'Timo by Ban Viet', bin: '963388' },
  { code: 'KLB', shortName: 'Kienlongbank', name: 'Kiên Long', bin: '970452' },
  { code: 'BVB', shortName: 'BVBank', name: 'Bản Việt', bin: '970454' },
  { code: 'CAKE', shortName: 'Cake', name: 'Cake by VPBank', bin: '546034' },
  { code: 'VIETCAP', shortName: 'VietCapital', name: 'VietCapitalBank', bin: '970454' },
]

/**
 * Phân giải tên hoặc mã ngân hàng thành mã BIN số VietQR
 */
export function resolveBankBin(input?: string): string {
  if (!input) return '970422' // Default MBBank

  const trimmed = input.trim()
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed
  }

  const normalized = trimmed.toUpperCase().replace(/\s+/g, '')
  const found = VIETNAM_BANKS.find(
    (b) =>
      b.code.toUpperCase() === normalized ||
      b.shortName.toUpperCase().replace(/\s+/g, '') === normalized ||
      b.bin === normalized ||
      normalized.includes(b.code.toUpperCase()) ||
      normalized.includes(b.shortName.toUpperCase().replace(/\s+/g, ''))
  )

  return found ? found.bin : '970422'
}

/**
 * Lấy cấu hình tài khoản nộp quỹ lớp
 * Ưu tiên:
 * 1. Tài khoản được điền trong đợt thu quỹ cụ thể (fund.bankAccount, fund.accountName, fund.bankName)
 * 2. Biến môi trường riêng của NopQuyLop (NOPQUYLOP_ACCOUNT_NO, NOPQUYLOP_ACCOUNT_NAME, NOPQUYLOP_BANK_BIN, NOPQUYLOP_BANK_NAME)
 * 3. Fallback mặc định
 * 
 * Lưu ý: Tách biệt hoàn toàn, KHÔNG dùng đè VIETQR_ACCOUNT_NO của SenExam.
 */
export function getNopQuyBankConfig(fund?: {
  bankName?: string
  bankAccount?: string
  accountName?: string
}) {
  const accountNo =
    fund?.bankAccount?.trim() ||
    process.env.NOPQUYLOP_ACCOUNT_NO?.trim() ||
    process.env.VIETQR_ACCOUNT_NO ||
    '0988776655'

  const accountName =
    fund?.accountName?.trim() ||
    process.env.NOPQUYLOP_ACCOUNT_NAME?.trim() ||
    process.env.VIETQR_ACCOUNT_NAME ||
    'THU QUY LOP ME2'

  const rawBank =
    fund?.bankName?.trim() ||
    process.env.NOPQUYLOP_BANK_NAME?.trim() ||
    process.env.NOPQUYLOP_BANK_BIN?.trim() ||
    'MBBANK'

  const bankBin = resolveBankBin(
    fund?.bankName || process.env.NOPQUYLOP_BANK_BIN || process.env.NOPQUYLOP_BANK_NAME || '970422'
  )

  return {
    accountNo,
    accountName: accountName.toUpperCase(),
    bankName: rawBank.toUpperCase(),
    bankBin,
  }
}
