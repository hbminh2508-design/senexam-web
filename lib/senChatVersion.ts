/**
 * Sen Chat Versioning & Changelog
 * Quản lý phiên bản và nhật ký cập nhật chính thức của Sen Chat.
 * Quy ước: Phiên bản chỉ sửa lỗi ghi tiêu đề "Bắt lại những con bò đang bay trên các vì sao".
 */

export const SEN_CHAT_CURRENT_VERSION = '1.0.1'

export interface SenChatChangelogEntry {
  version: string
  releaseDate: string
  title: string
  isLatest?: boolean
  isBugFixOnly?: boolean
  changes: string[]
}

export const SEN_CHAT_CHANGELOG: SenChatChangelogEntry[] = [
  {
    version: '1.0.1',
    releaseDate: '23/11/2026',
    title: 'Bắt lại những con bò đang bay trên các vì sao',
    isLatest: true,
    isBugFixOnly: true,
    changes: [
      'Bắt lại những con bò đang bay trên các vì sao',
      'Lưu trữ tin nhắn bền vững trong Local Storage (chỉ xóa khi đăng xuất tài khoản)',
      'Giữ nguyên danh sách người trò chuyện theo đúng thứ tự thời gian khi xóa dữ liệu tin nhắn',
      'Tắt tính năng che mờ màn hình theo yêu cầu người dùng',
      'Di chuyển thanh E2EE Chuẩn Thiết Bị tinh gọn, không che khuất ảnh đại diện',
      'Tích hợp hộp thoại thông tin phiên bản và nhật ký cập nhật trực tiếp khi nhấn Logo Sen Chat',
    ],
  },
  {
    version: '1.0.0',
    releaseDate: '21/11/2026',
    title: 'Bản phát hành chính thức Sen Chat E2EE & MLS',
    isLatest: false,
    isBugFixOnly: false,
    changes: [
      'Bản phát hành chính thức Sen Chat E2EE & MLS',
      'Mã hóa đầu-cuối Signal Protocol (Double Ratchet) cho hội thoại riêng tư 1-1',
      'Mã hóa nhóm chuẩn IETF MLS (RFC 9420) bảo mật đa thiết bị',
      'Hỗ trợ đàm thoại âm thanh và video WebRTC ngang hàng (Peer-to-Peer)',
      'Lưu trữ tệp đính kèm phân tán và mã hóa AES-256-GCM',
      'Tích hợp trợ lý học tập SenAI hỗ trợ giải bài tập và công thức toán học KaTeX',
    ],
  },
]
