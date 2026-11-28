/**
 * Sen Chat Versioning & Changelog
 * Quản lý phiên bản và nhật ký cập nhật chính thức của Sen Chat.
 * Quy ước: Phiên bản chỉ sửa lỗi ghi tiêu đề "Bắt lại những con bò đang bay trên các vì sao".
 */

export const SEN_CHAT_CURRENT_VERSION = '1.2.1'

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
    version: '1.2.1',
    releaseDate: '28/11/2026',
    title: 'SenAI 2 và cập nhật trải nghiệm Sen Chat',
    isLatest: true,
    changes: [
      'SenAI 2 có Rose (Low), Tulip (Medium), Orchid (High) và kiến thức đã xác nhận về SenExam.',
      'Dán ảnh, chọn ảnh, PDF và tệp văn bản để hỏi SenAI trong Studio hoặc bong bóng hợp nhất.',
      'Tách lịch sử theo tài khoản, thêm danh sách bạn bè trên mobile và sửa lỗi khởi tạo chat.',
      'Chọn ảnh nhóm từ máy, đồng bộ lượt thả cảm xúc và hiển thị thời lượng cuộc gọi.',
      'Cải thiện nét bút bảng trắng và xem toàn bộ các trang PDF.',
    ],
  },
  {
    version: '1.2.0',
    releaseDate: '28/11/2026',
    title: 'Bảng trắng, lưu trữ và quản lý nhóm',
    isLatest: false,
    changes: [
      'Vẽ liên tục, di chuyển bảng trắng bằng hai ngón, lưu PDF và mở bảng hoặc màn hình chia sẻ toàn màn hình.',
      'Lưu tin nhắn và tệp đính kèm không có thời hạn mặc định, với nút lưu tệp ngay trong hội thoại.',
      'Đổi tên hoặc ảnh nhóm trong phần Cài đặt; quản lý thành viên trong ngăn thông tin.',
      'Chuyển quyền, xóa nhóm và xử lý rời nhóm trên máy chủ.',
      'Chia sẻ liên kết tham gia nhóm và quản lý yêu cầu trong phòng chờ tùy chọn.',
    ],
  },
  {
    version: '1.1.1',
    releaseDate: '28/11/2026',
    title: 'Trải nghiệm Sen Chat trên di động',
    isLatest: false,
    changes: [
      'Tìm bạn bè chưa có hội thoại và mở tin nhắn trực tiếp từ danh sách.',
      'Thanh điều hướng di động có vùng chọn trượt theo thao tác kéo.',
      'Phản chiếu bản xem trước camera trước và giữ tỷ lệ video khi gọi.',
      'Sửa lỗi mở đề thi và đồng nhất danh mục, giá ưu đãi trên điện thoại.',
    ],
  },
  {
    version: '1.1.0',
    releaseDate: '26/11/2026',
    title: 'Communication & Stability Update',
    isLatest: false,
    isBugFixOnly: false,
    changes: [
      'Thiết kế lại toàn diện giao diện cuộc gọi âm thanh, video 1-1 và cuộc gọi nhóm (Dynamic Grid Layout tối đa 4×4, Speaker/Gallery View, PiP, Fullscreen, chia sẻ màn hình & tự khôi phục camera)',
      'Hỗ trợ nâng cấp từ cuộc gọi âm thanh sang video ngay trong phiên gọi hiện tại, chọn thiết bị Mic/Loa/Camera, ICE Restart & STUN/TURN fallback',
      'Nâng cấp kiến trúc WebRTC SFU cho cuộc gọi nhóm quy mô 20–200 người với Selective Video Subscription & Active Speaker Detection',
      'Cập nhật bảng quyền lợi thống nhất cho các gói (Free, Lite 5, VIP 20, Premium 50, Premium+ 100, One Lite 30, One 200) kèm kiểm tra hạn mức thành viên và thời lượng gọi (1h / 5h / Không giới hạn) trên Backend & Supabase RPC',
      'Cho phép mọi thành viên hợp lệ trong nhóm (bao gồm Free trong nhóm trả phí) khởi tạo và tham gia cuộc gọi nhóm; người khởi tạo rời đi không làm ngắt cuộc gọi chung',
      'Đồng bộ toàn diện Design Tokens Ocean Blue (blue-600, sky-500) cho Light/Dark Mode, safe-area và hai tên miền chat.senexam.me ↔ senexam.me/chat',
      'Tối ưu Delta Sync, hợp nhất Reaction thêm/xóa theo timestamp, và ổn định SenAI trên model gemini-3.5-flash-lite (Circuit Breaker, Retry có giới hạn, Token Budget)',
    ],
  },
  {
    version: '1.0.4',
    releaseDate: '25/11/2026',
    title: 'Đồng bộ nhóm đa thiết bị, nâng cấp Sen Chat & tối ưu SenExam',
    isLatest: false,
    isBugFixOnly: false,
    changes: [
      'Sửa triệt để lỗi đồng bộ nhóm & hội thoại giữa các thiết bị (tự động đồng bộ từ Supabase và peer-to-peer relay)',
      'Sửa triệt để lỗi chưa rời được khỏi nhóm chat (hỗ trợ tự động chuyển quyền chủ nhóm nếu cần & đồng bộ xóa nhóm đa thiết bị)',
      'Bổ sung giao diện menu chuột phải riêng (Custom Context Menu) tối ưu cho Sen Chat và hỗ trợ chạm/nhấn giữ thả biểu cảm, xóa tin nhắn trên iPhone, iPad',
      'Nâng cấp đồng bộ ngầm liên tục giữa các thiết bị trong im lặng, không hiện bảng thông báo gây gián đoạn',
      'Làm mới UI/UX với tông màu xanh nước biển đồng bộ logo Sen Chat và tối ưu độ mượt toàn diện',
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
