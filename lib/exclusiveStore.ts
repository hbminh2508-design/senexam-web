import type { PlanTier } from '@/lib/vipMembership'

// Cửa hàng cao cấp (/exclusive-store & /new-pay?tab=exclusive) — chỉ VIP/Premium mới vào được.
// Cung cấp các gói combo, thẻ đặc quyền, huy hiệu mạ vàng danh giá, flash sale và rương quà may mắn.

export const MONTHLY_FLASH_SALE_DISCOUNT_PERCENT: Record<'vip' | 'premium', number> = {
  vip: 10,
  premium: 15,
}

export const MONTHLY_FLASH_SALE_QUOTA: Record<'vip' | 'premium', number> = {
  vip: 1,
  premium: 2,
}

export function getClaimMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function isBlackFridayDate(date: Date = new Date()): boolean {
  if (date.getMonth() !== 10) return false // tháng 11 (0-indexed)
  const nov1Weekday = new Date(date.getFullYear(), 10, 1).getDay()
  const firstThursday = 1 + ((4 - nov1Weekday + 7) % 7) // Thứ Năm = 4
  const fourthThursday = firstThursday + 21
  const blackFridayDate = fourthThursday + 1
  return date.getDate() === blackFridayDate
}

export type BlackFridayDealCode = 'bf_plus_99' | 'bf_ultra_70'

export const BLACK_FRIDAY_DEALS: Record<BlackFridayDealCode, {
  senaiPlanCode: string
  discountPercent: number
  maxClaims: number
  label: string
}> = {
  bf_plus_99: { senaiPlanCode: 'plus_monthly', discountPercent: 99, maxClaims: 5, label: 'SenAI Plus — 1 tháng, giảm 99% (5 suất)' },
  bf_ultra_70: { senaiPlanCode: 'ultra_quarterly', discountPercent: 70, maxClaims: 10, label: 'SenAI Ultra — 3 tháng, giảm 70% (10 suất)' },
}

export function applyDiscount(priceSenCash: number, percent: number): number {
  return Math.max(1, Math.round(priceSenCash * (1 - percent / 100)))
}

// Cho phép tất cả các cấp độ thành viên cao cấp (VIP, Premium, Premium+, Sen One) vào Cửa hàng độc quyền
export function canAccessExclusiveStore(planTier: PlanTier | null): boolean {
  if (!planTier) return false
  return ['vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'].includes(planTier)
}

// =========================================================================
// MẶT HÀNG & DANH MỤC CỬA HÀNG ĐỘC QUYỀN (EXCLUSIVE STORE CATALOG)
// =========================================================================

export type ExclusiveCategoryKey = 'all' | 'flash_sale' | 'combo' | 'pass' | 'badge' | 'mystery'

export interface ExclusiveCategoryMeta {
  key: ExclusiveCategoryKey
  label: string
  icon: string
  badgeText?: string
}

export const EXCLUSIVE_CATEGORIES: ExclusiveCategoryMeta[] = [
  { key: 'all', label: 'Tất Cả Mặt Hàng', icon: 'Sparkles' },
  { key: 'flash_sale', label: 'Flash Sale Giới Hạn', icon: 'Flame', badgeText: 'Hot' },
  { key: 'combo', label: 'Combo Tiết Kiệm', icon: 'Layers', badgeText: '-45%' },
  { key: 'pass', label: 'Thẻ Đặc Quyền VIP', icon: 'Zap' },
  { key: 'badge', label: 'Huy Hiệu & Aura', icon: 'Crown', badgeText: 'Mới' },
  { key: 'mystery', label: 'Rương May Mắn', icon: 'Gift', badgeText: 'Jackpot' },
]

export interface ExclusiveStoreDeal {
  id: string
  title: string
  category: 'flash_sale' | 'combo' | 'pass' | 'badge' | 'mystery'
  badge: string
  tag: string
  desc: string
  originalPrice: number
  discountedPrice: number
  gradient: string
  accentColor: string
  iconName: string
  perks: string[]
  soldPercent: number
  limitedSlots?: number
  // Hành động xử lý sau khi mua thành công
  actionType: 'senai_plan' | 'vip_grant' | 'combo' | 'sen_one' | 'power_pass' | 'badge' | 'mystery_box'
  planCode?: string
  vipGroup?: 'vip' | 'premium' | 'premium_plus' | 'sen_one'
  vipDays?: number
  badgeKey?: string
  mysteryTier?: 'silver' | 'gold'
}

export const EXCLUSIVE_STORE_ITEMS: ExclusiveStoreDeal[] = [
  // --- 1. FLASH SALE & GIỚI HẠN ---
  {
    id: 'flash_vip_loyalty_30d',
    title: 'Thẻ Gia Hạn VIP Tri Ân (30 Ngày)',
    category: 'flash_sale',
    badge: '⚡ GIẢM 44%',
    tag: 'Chỉ 20 suất/tuần',
    desc: 'Ưu đãi gia hạn dành riêng cho thành viên VIP. Duy trì trọn vẹn đặc quyền không quảng cáo, giao diện cao cấp và bảo mật phòng thi.',
    originalPrice: 39,
    discountedPrice: 22,
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    accentColor: 'amber',
    iconName: 'Crown',
    perks: ['Cộng dồn 30 ngày VIP hội viên', 'Không quảng cáo & ưu tiên giao diện', 'Tiết kiệm 44% so với giá nạp thường'],
    soldPercent: 88,
    limitedSlots: 20,
    actionType: 'vip_grant',
    vipGroup: 'vip',
    vipDays: 30,
  },
  {
    id: 'flash_ultra_week',
    title: 'Gói Cấp Tốc SenAI Ultra (7 Ngày)',
    category: 'flash_sale',
    badge: '🔥 HOT TUẦN NÀY',
    tag: 'Luyện Thi Cấp Tốc',
    desc: 'Bứt phá điểm số mùa thi: Mở khóa 200 câu hỏi giải đề/ngày và 5 lần tương tác chuyên sâu SenGraph AI phân tích đồ thị phức tạp.',
    originalPrice: 59,
    discountedPrice: 35,
    gradient: 'from-purple-600 via-pink-600 to-rose-600',
    accentColor: 'purple',
    iconName: 'Flame',
    perks: ['200 câu hỏi giải đề mỗi ngày (7 ngày)', '5 lượt hỏi SenGraph AI phân tích đồ thị', 'Tối ưu tốc độ trả lời thời gian thực'],
    soldPercent: 92,
    limitedSlots: 15,
    actionType: 'senai_plan',
    planCode: 'ultra_monthly', // 7 ngày Ultra cấp tốc
  },
  {
    id: 'flash_sen_max_30d',
    title: 'Đặc Quyền Thượng Hạng Sen Max (30 Ngày)',
    category: 'flash_sale',
    badge: '👑 ĐỈNH CAO AI',
    tag: '500 câu/ngày',
    desc: 'Hạng AI tối thượng cao nhất của SenExam: 500 câu hỏi giải bài mỗi ngày, 15 lần SenGraph AI, xử lý mọi dạng đề Toán - Lý - Hóa chuyên sâu.',
    originalPrice: 318,
    discountedPrice: 199,
    gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    accentColor: 'indigo',
    iconName: 'Sparkles',
    perks: ['500 câu hỏi giải bài mỗi ngày (x2.5 Ultra)', '15 lượt SenGraph AI tương tác đa chiều', 'Huy hiệu thành viên Sen Max danh giá'],
    soldPercent: 79,
    limitedSlots: 10,
    actionType: 'senai_plan',
    planCode: 'max_monthly',
  },

  // --- 2. COMBO TIẾT KIỆM TOÀN DIỆN ---
  {
    id: 'combo_starter',
    title: 'Combo Tân Thủ 2-in-1 (30 Ngày)',
    category: 'combo',
    badge: 'TIẾT KIỆM 45%',
    tag: 'Dành Cho Học Sinh Mới',
    desc: 'Trọn gói 1 tháng Hội viên VIP không quảng cáo + 1 tháng SenAI Plus (50 câu/ngày) trang bị đầy đủ công cụ học tập cho học sinh.',
    originalPrice: 178,
    discountedPrice: 99,
    gradient: 'from-amber-500 to-orange-500',
    accentColor: 'amber',
    iconName: 'Package',
    perks: ['VIP không quảng cáo 30 ngày', '50 câu hỏi giải bài mỗi ngày', '1 lần phân tích hình học & đồ thị/ngày'],
    soldPercent: 95,
    actionType: 'combo',
    planCode: 'plus_monthly',
    vipGroup: 'vip',
    vipDays: 30,
  },
  {
    id: 'combo_exam_cram',
    title: 'Chiến Binh Luyện Đề Nước Rút (3 Tháng)',
    category: 'combo',
    badge: 'SIÊU BÁN CHẠY',
    tag: 'HSA / TSA / THPTQG',
    desc: '3 tháng Hội viên Premium + 3 tháng SenAI Ultra (200 câu/ngày) + Thẻ Tải Đề Thi Vô Cực độc quyền mùa thi tuyển sinh.',
    originalPrice: 799,
    discountedPrice: 449,
    gradient: 'from-purple-600 via-violet-600 to-pink-600',
    accentColor: 'purple',
    iconName: 'Rocket',
    perks: ['3 tháng VIP Premium mạ vàng', '200 câu hỏi SenAI Ultra mỗi ngày', 'Tải kho đề thi tuyển sinh không giới hạn'],
    soldPercent: 89,
    actionType: 'combo',
    planCode: 'ultra_quarterly',
    vipGroup: 'premium',
    vipDays: 90,
  },
  {
    id: 'combo_sen_one_semester',
    title: 'Học Kỳ Toàn Năng Sen One (6 Tháng)',
    category: 'combo',
    badge: '💎 ALL-IN-ONE',
    tag: 'Trọn Gói 180 Ngày',
    desc: 'Hệ sinh thái All-in-One: VIP Premium+ mạ vàng + Sen Max (500 câu/ngày) + 15 SenGraph AI + Tải tài liệu & phòng thí nghiệm không giới hạn.',
    originalPrice: 1314,
    discountedPrice: 749,
    gradient: 'from-blue-600 via-indigo-600 to-purple-600',
    accentColor: 'blue',
    iconName: 'ShieldCheck',
    perks: ['180 ngày VIP Premium+ độc quyền', 'Hạng Sen Max 500 câu hỏi mỗi ngày', 'Mở khóa toàn bộ kho học liệu VIP'],
    soldPercent: 82,
    actionType: 'sen_one',
    vipDays: 180,
  },
  {
    id: 'plus_perm_deal',
    title: 'Bản Quyền Trọn Đời SenAI Plus',
    category: 'combo',
    badge: 'VĨNH VIỄN',
    tag: 'Không Hạn Sử Dụng',
    desc: 'Sở hữu trọn đời 50 lượt giải đề và hướng dẫn phương pháp làm bài mỗi ngày. Mua 1 lần dùng mãi mãi suốt cả các năm học.',
    originalPrice: 2999,
    discountedPrice: 1999,
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    accentColor: 'rose',
    iconName: 'Infinity',
    perks: ['Bản quyền trọn đời tài khoản', '50 câu hỏi giải đề mỗi ngày vĩnh cửu', 'Cập nhật AI các phiên bản tương lai miễn phí'],
    soldPercent: 91,
    actionType: 'senai_plan',
    planCode: 'plus_permanent',
  },

  // --- 3. THẺ ĐẶC QUYỀN VIP (POWER PASSES) ---
  {
    id: 'pass_unlimited_download_30d',
    title: 'Thẻ Tải Đề Thi Vô Cực (30 Ngày)',
    category: 'pass',
    badge: '📥 TẢI KHÔNG GIỚI HẠN',
    tag: 'Kho Tài Liệu VIP',
    desc: 'Xóa bỏ mọi giới hạn tải: Tải hàng nghìn bộ đề thi thử, lời giải chi tiết, file PDF/Word chất lượng cao từ tất cả các trường chuyên cả nước.',
    originalPrice: 79,
    discountedPrice: 45,
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: 'emerald',
    iconName: 'DownloadCloud',
    perks: ['Không giới hạn số lượt tải đề thi', 'Tải file Word có lời giải chi tiết', 'Ưu tiên đường truyền tải tốc độ cao'],
    soldPercent: 86,
    actionType: 'power_pass',
  },
  {
    id: 'pass_night_owl_30d',
    title: 'Thẻ Cú Đêm Cày Cuốc (Night Owl Pass - 30 Ngày)',
    category: 'pass',
    badge: '🌙 DÀNH CHO CÚ ĐÊM',
    tag: 'X2 Quota Đêm',
    desc: 'Dành riêng cho chiến thần học đêm: Tự động nhân đôi (x2) hạn mức câu hỏi giải bài trong khung giờ vàng 22h00 - 06h00 sáng mỗi ngày.',
    originalPrice: 69,
    discountedPrice: 39,
    gradient: 'from-slate-800 via-indigo-950 to-blue-900',
    accentColor: 'indigo',
    iconName: 'Moon',
    perks: ['Gấp đôi lượt hỏi AI từ 22h - 6h sáng', 'Phản hồi đêm không chờ đợi', 'Huy hiệu Cú Đêm Học Tập trên hồ sơ'],
    soldPercent: 74,
    actionType: 'power_pass',
  },
  {
    id: 'pass_fast_lane_ai_30d',
    title: 'Thẻ Đường Truyền AI Thần Tốc (30 Ngày)',
    category: 'pass',
    badge: '⚡ 0.3S PHẢN HỒI',
    tag: 'Dedicated Cluster',
    desc: 'Ưu tiên xử lý cấp 1 trên cụm máy chủ AI riêng biệt. Trả lời ngay tức khắc dưới 0.3 giây, tuyệt đối không bị gián đoạn vào giờ cao điểm.',
    originalPrice: 89,
    discountedPrice: 49,
    gradient: 'from-cyan-500 via-blue-600 to-indigo-600',
    accentColor: 'cyan',
    iconName: 'ZapFast',
    perks: ['Tốc độ sinh lời giải tức thì <0.3s', 'Băng thông riêng biệt không xếp hàng', 'Độ tin cậy 99.9% giờ thi cao điểm'],
    soldPercent: 80,
    actionType: 'power_pass',
  },
  {
    id: 'pass_senai_unlimited_30d',
    title: 'Thẻ Huyền Thoại SenAI Unlimited (30 Ngày)',
    category: 'pass',
    badge: '♾️ VÔ CỰC (ẨN)',
    tag: 'Gói Tối Thượng',
    desc: 'Gói ẩn đặc biệt không bán công khai: Không giới hạn câu hỏi (999.999 câu/ngày), 999 lần SenGraph AI, mở rộng cửa sổ ngữ cảnh cực đại.',
    originalPrice: 599,
    discountedPrice: 349,
    gradient: 'from-fuchsia-600 via-purple-700 to-slate-900',
    accentColor: 'fuchsia',
    iconName: 'Sparkles',
    perks: ['Không giới hạn câu hỏi giải bài mỗi ngày', '999 lượt hỏi SenGraph AI tương tác', 'Mở khóa mọi quyền năng AI ẩn của hệ thống'],
    soldPercent: 96,
    limitedSlots: 5,
    actionType: 'senai_plan',
    planCode: 'unlimited_monthly',
  },

  // --- 4. HUY HIỆU & AURA DANH GIÁ ---
  {
    id: 'badge_gold_sovereign',
    title: 'Huy Hiệu Vương Miện "Đại Gia Học Đường"',
    category: 'badge',
    badge: '👑 HUY HIỆU VÀNG 24K',
    tag: 'Vĩnh Viễn',
    desc: 'Biểu tượng đẳng cấp hoàng gia: Vương miện mạ vàng 24K rực rỡ xuất hiện cạnh tên trên Bảng xếp hạng, Diễn đàn, bài thi SEB và phòng thi.',
    originalPrice: 149,
    discountedPrice: 89,
    gradient: 'from-yellow-400 via-amber-500 to-yellow-600',
    accentColor: 'amber',
    iconName: 'Crown',
    perks: ['Vương miện vàng hoàng kim cạnh tên', 'Hiệu ứng ánh kim lấp lánh khi chat', 'Sở hữu vĩnh viễn không bao giờ mất'],
    soldPercent: 84,
    actionType: 'badge',
    badgeKey: 'gold_sovereign',
  },
  {
    id: 'badge_legendary_scholar',
    title: 'Danh Hiệu & Hào Quang "Học Thần SenExam"',
    category: 'badge',
    badge: '💎 HÀO QUANG CYBERPUNK',
    tag: 'Vĩnh Viễn',
    desc: 'Hào quang tím Neon Cyberpunk bao bọc avatar cùng danh hiệu "Học Thần SenExam" mạ tím quý phái, tăng uy tín tuyệt đối trước bạn bè.',
    originalPrice: 199,
    discountedPrice: 119,
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    accentColor: 'violet',
    iconName: 'Award',
    perks: ['Hào quang tím phát sáng quanh ảnh đại diện', 'Danh hiệu Học Thần hiển thị mọi nơi', 'Quyền ưu tiên bình luận được ghim đầu'],
    soldPercent: 91,
    actionType: 'badge',
    badgeKey: 'legendary_scholar',
  },
  {
    id: 'badge_galaxy_frame',
    title: 'Khung Avatar Tinh Vân Vũ Trụ (Nebula Frame)',
    category: 'badge',
    badge: '🔮 KHUNG ĐỘNG RGB',
    tag: 'Vĩnh Viễn',
    desc: 'Khung chuyển màu ngân hà đa sắc cực chất chạy quanh avatar. Biến hồ sơ cá nhân và bảng thành tích của bạn trở nên nổi bật nhất lớp.',
    originalPrice: 99,
    discountedPrice: 59,
    gradient: 'from-pink-500 via-purple-500 to-cyan-500',
    accentColor: 'pink',
    iconName: 'Palette',
    perks: ['Viền động ngân hà Galaxy chạy mượt mà', 'Tương thích ảnh đại diện SEB và Web', 'Sở hữu trọn đời vĩnh viễn'],
    soldPercent: 77,
    actionType: 'badge',
    badgeKey: 'galaxy_frame',
  },

  // --- 5. RƯƠNG BÁU THẦN BÍ (MYSTERY BOX) ---
  {
    id: 'mystery_silver_chest',
    title: 'Rương Báu Bạc May Mắn (Silver Mystery Chest)',
    category: 'mystery',
    badge: '🎁 HOÀN VỐN 100%',
    tag: 'Giá Rẻ Bất Ngờ',
    desc: 'Mở ngay nhận 1 trong các phần thưởng: 30 ~ 120 SenCash (lời ngay lập tức!), 3-7 ngày VIP hội viên, hoặc Voucher giảm 30% khóa học!',
    originalPrice: 45,
    discountedPrice: 29,
    gradient: 'from-slate-400 via-zinc-500 to-slate-600',
    accentColor: 'slate',
    iconName: 'Gift',
    perks: ['Chắc chắn nhận quà giá trị ≥ 30 SC', 'Tỷ lệ ra SenCash gấp 4 lần giá mở', 'Mở tức thì không giới hạn số lượt'],
    soldPercent: 97,
    actionType: 'mystery_box',
    mysteryTier: 'silver',
  },
  {
    id: 'mystery_golden_chest',
    title: 'Rương Thần Thoại Hoàng Gia (Golden Mega Chest)',
    category: 'mystery',
    badge: '🌟 JACKPOT SIÊU KHỦNG',
    tag: 'Thử Vận May Đỉnh Cao',
    desc: 'Cơ hội trúng độc đắc: 100 ~ 500 SenCash thưởng, 30 Ngày Sen Max (500 câu/ngày), Thẻ VIP Premium+ 1 Tháng, hoặc Huy Hiệu Tinh Hoa!',
    originalPrice: 99,
    discountedPrice: 69,
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    accentColor: 'amber',
    iconName: 'Gem',
    perks: ['Tỷ lệ trúng giải độc đắc cực cao', 'Phần thưởng cộng dồn trực tiếp vào ví', 'Hiệu ứng mở rương hoàng kim rực rỡ'],
    soldPercent: 98,
    actionType: 'mystery_box',
    mysteryTier: 'gold',
  },
]

export function getExclusiveDeal(id: string): ExclusiveStoreDeal | undefined {
  return EXCLUSIVE_STORE_ITEMS.find(item => item.id === id)
}
