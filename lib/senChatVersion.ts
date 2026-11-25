/**
 * Sen Chat Versioning & Changelog
 * Quản lý phiên bản và nhật ký cập nhật chính thức của Sen Chat.
 * Quy ước: Phiên bản chỉ sửa lỗi ghi tiêu đề "Bắt lại những con bò đang bay trên các vì sao".
 */

export const SEN_CHAT_CURRENT_VERSION = '1.0.4'

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
    version: '1.0.4',
    releaseDate: '25/11/2026',
    title: 'Đồng bộ nhóm đa thiết bị, nâng cấp Sen Chat & tối ưu SenExam',
    isLatest: true,
    isBugFixOnly: false,
    changes: [
      'Sửa triệt để lỗi đồng bộ nhóm & hội thoại giữa các thiết bị (tự động đồng bộ từ Supabase và peer-to-peer relay)',
      'Thêm tính năng Trả lời trích dẫn tin nhắn (Reply / Quote) và Biểu cảm nhanh (Emoji Reactions)',
      'Hỗ trợ Ghim cuộc trò chuyện (Pin/Unpin), Đánh dấu chưa đọc và Lưu nháp tin nhắn đang soạn theo từng hội thoại',
      'Tối ưu và sửa lỗi SenExam: lưu nháp tức thì (debounce 300ms + beforeunload), ổn định bộ đếm tab/thời gian và bảo mật token nộp bài',
    ],
  },
  {
    version: '1.0.3',
    releaseDate: '24/11/2026',
    title: 'Bắt lại những con bò đang bay trên các vì sao',
    isLatest: false,
    isBugFixOnly: true,
    changes: [
      'Bắt lại những con bò đang bay trên các vì sao',
      'Bổ sung nút \'Đồng bộ dữ liệu ngay\' tự động phát hiện thiết bị chưa đồng bộ, đặt ngay phía trên mục SenAI Studio',
      'Tích hợp tính năng kích hoạt đồng bộ dữ liệu tức thì trong Cài đặt Sen Chat',
      'Tự động quét và đối soát dữ liệu tin nhắn, trạng thái và tệp giữa toàn bộ thiết bị đang đăng nhập',
      'Cải thiện độ ổn định và hiệu năng kết nối đa thiết bị thời gian thực',
    ],
  },
  {
    version: '1.0.2',
    releaseDate: '24/11/2026',
    title: 'Bắt lại những con bò đang bay trên các vì sao',
    isLatest: false,
    isBugFixOnly: true,
    changes: [
      'Bắt lại những con bò đang bay trên các vì sao',
      'Khắc phục lỗi lệch khung hiển thị của bảng kiểm tra chuẩn an toàn thiết bị và thanh banner',
      'Sửa triệt để lỗi tải tệp Supabase và lỗi giải mã ảnh từ Google Drive',
      'Bổ sung tính năng đồng bộ đa thiết bị, biến các thiết bị thành máy chủ trung gian chuyển tệp về server chính và phân chia luồng tin nhắn chuẩn nhất',
      'Tự động đồng bộ cài đặt tính năng cá nhân hóa giữa các thiết bị cùng tài khoản theo thời gian thực',
      'Tối ưu độ tương phản và giao diện thẻ tệp đính kèm trong bong bóng tin nhắn',
    ],
  },
  {
    version: '1.0.1',
    releaseDate: '23/11/2026',
    title: 'Bắt lại những con bò đang bay trên các vì sao',
    isLatest: false,
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
