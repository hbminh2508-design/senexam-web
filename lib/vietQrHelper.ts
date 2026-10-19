// Quản lý ngân hàng & tạo mã VietQR chuẩn Napas 247

export interface BankInfo {
  code: string
  name: string
  shortName: string
  bin: string
}

export const VIETNAM_BANKS: BankInfo[] = [
  { code: 'VAB', shortName: 'VietABank', name: 'Ngân hàng TMCP Việt Á', bin: '970427' },
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
  { code: 'NAB', shortName: 'NamABank', name: 'Nam Á', bin: '970428' },
  { code: 'BAB', shortName: 'BacABank', name: 'Bắc Á', bin: '970409' },
  { code: 'BVB', shortName: 'BaoVietBank', name: 'Bảo Việt', bin: '970438' },
  { code: 'PVB', shortName: 'PVcomBank', name: 'Đại Chúng Việt Nam', bin: '970412' },
  { code: 'SGB', shortName: 'SaigonBank', name: 'Sài Gòn Công Thương', bin: '970400' },
  { code: 'TIMO', shortName: 'Timo', name: 'Timo by Ban Viet', bin: '963388' },
  { code: 'KLB', shortName: 'Kienlongbank', name: 'Kiên Long', bin: '970452' },
  { code: 'BVBank', shortName: 'BVBank', name: 'Bản Việt', bin: '970454' },
  { code: 'CAKE', shortName: 'Cake', name: 'Cake by VPBank', bin: '546034' },
]

/**
 * Phân giải tên hoặc mã ngân hàng thành mã BIN số VietQR
 */
export function resolveBankBin(input?: string): string {
  if (!input) return '970427' // Mặc định VietABank

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

  return found ? found.bin : '970427'
}

/**
 * Lấy cấu hình tài khoản nộp quỹ lớp
 * Mặc định: VAB - 00222085 (TRAN DUY KHUONG)
 * Người dùng có toàn quyền chọn ngân hàng khác khi tạo quỹ
 */
export function getNopQuyBankConfig(fund?: {
  bankName?: string
  bankAccount?: string
  accountName?: string
}) {
  const accountNo =
    fund?.bankAccount?.trim() ||
    process.env.NOPQUYLOP_ACCOUNT_NO?.trim() ||
    '00222085'

  const accountName =
    fund?.accountName?.trim() ||
    process.env.NOPQUYLOP_ACCOUNT_NAME?.trim() ||
    'TRAN DUY KHUONG'

  const rawBank =
    fund?.bankName?.trim() ||
    process.env.NOPQUYLOP_BANK_NAME?.trim() ||
    'VietABank'

  const bankBin = resolveBankBin(
    fund?.bankName || process.env.NOPQUYLOP_BANK_BIN || process.env.NOPQUYLOP_BANK_NAME || '970427'
  )

  return {
    accountNo,
    accountName: accountName.toUpperCase(),
    bankName: rawBank.toUpperCase(),
    bankBin,
  }
}
