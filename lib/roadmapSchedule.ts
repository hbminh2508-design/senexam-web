/**
 * Lộ trình phát hành Roadmap Beta & Bản chính thức 2027 của SenExam
 *
 * Mốc thời gian tự động mở khóa chính thức:
 * - Q1/2027: 30/01/2027 (SenGraph, Sen Chat Bubble tự lưu SenAI Studio, Quản lý Quota SenAI /new-senai)
 * - Q2/2027: 19/05/2027 (Sen Exam Canvas, Sắp xếp nút Dashboard theo nhóm công năng)
 * - Q4/2027: 05/12/2027 (Gói Sen Max 500 câu/ngày, Giới thiệu SenGraph 2.0)
 *
 * Lưu ý quan trọng:
 * - Thành viên Beta (is_beta_tester = true) được trải nghiệm sớm NGAY LẬP TỨC.
 * - Bản chính thức tự động hiển thị vào đúng ngày quy định mà không cần can thiệp thủ công.
 */

export const ROADMAP_DATES = {
  Q1_2027: '2027-01-30T00:00:00+07:00',
  Q2_2027: '2027-05-19T00:00:00+07:00',
  Q4_2027: '2027-12-05T00:00:00+07:00',
} as const

export type RoadmapQuarter = 'Q1_2027' | 'Q2_2027' | 'Q4_2027'

export interface RoadmapItem {
  id: string
  title: string
  description: string
  quarter: RoadmapQuarter
  releaseDateText: string
  badgeText: string
  highlight?: boolean
}

export const ROADMAP_ITEMS_2027: RoadmapItem[] = [
  // Giai đoạn Q1
  {
    id: 'sengraph',
    quarter: 'Q1_2027',
    releaseDateText: '30/01/2027',
    badgeText: 'Q1/2027',
    title: 'SenGraph — Đồ thị & Hình học 2D/3D',
    description: 'Vẽ đồ thị hàm số 2D và mô hình không gian 3D tương tác cao cấp, tích hợp Sen AI Toán học hỗ trợ giải bài và phân tích hình ảnh đề thi.',
    highlight: true,
  },
  {
    id: 'senchat_bubble',
    quarter: 'Q1_2027',
    releaseDateText: '30/01/2027',
    badgeText: 'Q1/2027',
    title: 'Bong Bóng Chat Sen Chat Nổi',
    description: 'Trợ lý Sen Chat tiện lợi luôn sẵn sàng ở góc màn hình, tự động đồng bộ và lưu trữ toàn bộ phiên hội thoại về SenAI Studio.',
    highlight: true,
  },
  {
    id: 'new_senai_quota',
    quarter: 'Q1_2027',
    releaseDateText: '30/01/2027',
    badgeText: 'Q1/2027',
    title: 'Trang Quản Lý Quota SenAI (/new-senai)',
    description: 'Bảng điều khiển theo dõi hạn mức câu hỏi ngày, thống kê số lượt đã dùng và so sánh minh bạch tất cả các gói cước SenAI.',
  },

  // Giai đoạn Q2
  {
    id: 'canvas',
    quarter: 'Q2_2027',
    releaseDateText: '19/05/2027',
    badgeText: 'Q2/2027',
    title: 'Sen Exam Canvas',
    description: 'Môi trường khảo thí trực tuyến bảo mật cao chống gian lận 100%, tích hợp khoá màn hình chuẩn quốc tế.',
  },
  {
    id: 'dashboard_categories',
    quarter: 'Q2_2027',
    releaseDateText: '19/05/2027',
    badgeText: 'Q2/2027',
    title: 'Dashboard Sắp Xếp Theo Nhóm Công Năng',
    description: 'Tái cơ cấu toàn bộ các nút tính năng Dashboard thành 4 nhóm công năng (Học tập, Toán & Khảo thí, SenAI & Quota, Cộng đồng & Tiện ích) giúp giao diện tinh gọn, không bị rối mắt.',
    highlight: true,
  },

  // Giai đoạn Q4
  {
    id: 'sen_max',
    quarter: 'Q4_2027',
    releaseDateText: '05/12/2027',
    badgeText: 'Q4/2027',
    title: 'Ra Mắt Gói Sen Max (Bản Cao Cấp Nhất)',
    description: 'Gói đăng ký đỉnh cao trong hệ sinh thái SenAI: 500 câu hỏi/ngày, giá 318 SenCash/tháng (gấp đôi Ultra), tặng 15 lượt hỏi chuyên sâu trong SenAI Graph mỗi ngày.',
    highlight: true,
  },
  {
    id: 'sengraph_2',
    quarter: 'Q4_2027',
    releaseDateText: '05/12/2027',
    badgeText: 'Q4/2027',
    title: 'Giới Thiệu Bản Cập Nhật SenGraph 2.0',
    description: 'Bản cập nhật lớn thế hệ thứ hai của SenGraph với các công cụ hình học động và giải tích chuyên sâu (tính năng chi tiết sẽ được công bố sau).',
  },
]

/**
 * Kiểm tra xem một thời điểm theo mốc Roadmap đã đến hạn phát hành chính thức hay chưa.
 */
export function isRoadmapDateReached(quarter: RoadmapQuarter): boolean {
  const targetTime = new Date(ROADMAP_DATES[quarter]).getTime()
  return Date.now() >= targetTime
}

/**
 * Kiểm tra quyền tiếp cận tính năng:
 * - Thành viên Beta luôn luôn được truy cập (isBetaTester = true).
 * - Người dùng thông thường tự động được truy cập khi đã qua mốc ngày phát hành.
 */
export function canAccessRoadmapFeature(quarter: RoadmapQuarter, isBetaTester?: boolean | null): boolean {
  if (isBetaTester) return true
  return isRoadmapDateReached(quarter)
}

/**
 * Kiểm tra quyền xem giao diện Dashboard phân nhóm theo công năng:
 * Thành viên Beta có quyền xem ngay; bản chính thức tự động áp dụng từ ngày 19/05/2027.
 */
export function canAccessCategorizedDashboard(isBetaTester?: boolean | null): boolean {
  return canAccessRoadmapFeature('Q2_2027', isBetaTester)
}

/**
 * Kiểm tra trạng thái kích hoạt của gói Sen Max:
 * Thành viên Beta có quyền trải nghiệm ngay; bản chính thức tự động mở từ ngày 05/12/2027.
 */
export function canAccessSenMaxPlan(isBetaTester?: boolean | null): boolean {
  return canAccessRoadmapFeature('Q4_2027', isBetaTester)
}
