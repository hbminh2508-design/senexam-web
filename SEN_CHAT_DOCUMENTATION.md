# TÀI LIỆU HỆ THỐNG VÀ KIẾN TRÚC SEN CHAT (BẢN LƯU TRỮ PHỤC HỒI)

> **Ghi chú bảo lưu**: Sen Chat (`chat.senexam.me`) tạm thời được ẩn khỏi routing chính và thanh điều hướng để ưu tiên SenGraph (`sengraph.senexam.me`). Tài liệu này ghi chép đầy đủ toàn bộ kiến trúc, cơ chế hoạt động, luồng dữ liệu và thiết kế giao diện để đội ngũ phát triển có thể tiếp tục triển khai mà không bị thất thoát bất kỳ chi tiết nào.

---

## 1. Định Vị & Triết Lý Thiết Kế Sen Chat

- **Tên dịch vụ**: Sen Chat (trước đây có tên mã liên quan đến mô hình chat bảo mật).
- **Subdomain dự kiến**: `chat.senexam.me` (hỗ trợ rewrite ngầm từ `middleware.ts`).
- **Phong cách thị giác (Design Language)**:
  - Đồng bộ tone màu nhận diện với hệ sinh thái **TSV FEPN** (Emerald/Teal: `#10B981`, `#059669`, `#047857`, Cyan `#06B6D4`, Navy `#0F172A`).
  - **Floating Sidebar** nổi với bo góc mềm mại (`rounded-2xl` / `rounded-3xl`), tạo cảm giác ứng dụng desktop/mobile hiện đại.
  - **Hiệu ứng Liquid Glass (Kính lỏng)**: `backdrop-blur-xl`, viền sáng vi mô `border-white/20`, đổ bóng sâu nhiều lớp `shadow-2xl`.
  - Logo Sen Chat riêng biệt: Biểu tượng bông sen kết hợp bong bóng hội thoại và sóng âm.

---

## 2. Cơ Chế Lưu Trữ & Đồng Bộ Dữ Liệu

### 2.1. Kiến trúc Local-First (Dữ liệu cục bộ)
- Toàn bộ tin nhắn, lịch sử trò chuyện, tệp đính kèm và cấu hình cá nhân được ưu tiên ghi nhận và lưu trữ trực tiếp trên thiết bị người dùng (IndexedDB / LocalStorage / OPFS).
- Người dùng có toàn quyền kiểm soát tin nhắn cục bộ trên máy của mình.

### 2.2. Cơ chế Đồng bộ Tạm thời & Tự hủy (Zero-Knowledge Ephemeral Relay)
- **Quy trình chuyển giao giữa các thiết bị**:
  1. Khi người dùng đăng nhập trên Thiết bị B, thiết bị yêu cầu gói sao lưu đồng bộ từ Thiết bị A.
  2. Dữ liệu tin nhắn được mã hóa E2E bằng khóa phiên người dùng và đẩy lên server tạm thời dưới dạng gói chunk nhị phân.
  3. Khi Thiết bị B tải về và giải mã thành công vào cơ sở dữ liệu local của Thiết bị B:
  4. **Server lập tức xóa vĩnh viễn gói trung chuyển khỏi cơ sở dữ liệu/bộ nhớ đệm**, đảm bảo không tồn đọng tin nhắn người dùng trên máy chủ, tránh quá tải ổ cứng và loại bỏ hoàn toàn nguy cơ rò rỉ dữ liệu máy chủ.

### 2.3. Xác thực & Danh tính Người dùng
- Đồng bộ cơ chế tài khoản thông qua **Supabase Auth** của SenExam:
  - Hỗ trợ đăng nhập qua **Google / Gmail** (`linkWithGoogle`).
  - Hỗ trợ xác minh qua **Số điện thoại** (SMS OTP) hoặc Email OTP.
  - Dữ liệu người dùng (Họ tên, ảnh đại diện, trường, lớp) được tự động trích xuất từ bảng `profiles` và `students` của SenExam.

---

## 3. Danh Mục Tính Năng Đã Thiết Kế & Chuẩn Bị Sẵn

1. **Nhắn tin Thời gian thực**:
   - Trò chuyện 1-1 và trò chuyện nhóm học tập.
   - Hỗ trợ gửi văn bản, biểu cảm emoji, hình ảnh, tài liệu học tập, ghi âm thoại (Voice message).
2. **Đặt tên thân thuộc (Biệt danh / Nickname)**:
   - Giống trải nghiệm thân thiện của Messenger: Người dùng có thể đặt biệt danh riêng cho từng người bạn trong danh bạ mà không làm thay đổi tên gốc của họ.
3. **Chặn người dùng (Block User)**:
   - Danh sách chặn cục bộ và đồng bộ: Khi chặn, đối phương không thể gửi tin nhắn, gọi thoại hay làm phiền.
4. **Thay đổi hình nền cuộc trò chuyện (Chat Wallpapers)**:
   - Cho phép chọn các preset màu Gradient, hình nền Liquid Glass hoặc tự tải lên ảnh nền cá nhân cho từng phòng chat riêng lẻ.
5. **Chế độ Gọi thường (Voice Call) & Gọi Video (Video Call)**:
   - Giao diện cuộc gọi hiện đại với hiệu ứng làm mờ hậu cảnh, hiển thị thời lượng cuộc gọi, nút tắt/bật mic, chuyển đổi camera, chia sẻ màn hình học nhóm.
   - Tích hợp chuẩn giao thức WebRTC (Mesh P2P hoặc qua SFU server).

---

## 4. Vị Trí Tệp Mã Nguồn Đang Lưu Giữ

Mặc dù giao diện và routing tạm thời được ẩn để nhường chỗ cho SenGraph, toàn bộ cấu trúc mã nguồn vẫn nguyên vẹn trong dự án:

| Đường dẫn tệp | Mục đích |
|---|---|
| `app/chat/page.tsx` | Trang chính của Sen Chat với đầy đủ giao diện Floating Sidebar, Liquid Glass, hộp chat, danh bạ, cài đặt |
| `public/sen-chat-logo.jpg` | Asset logo Sen Chat chính thức được tạo mới |
| `middleware.ts` | Khối `isChatSubdomain` (đã được ghi chú tạm đóng, có thể bật lại bất kỳ lúc nào) |
| `SEN_CHAT_DOCUMENTATION.md` | Tài liệu phục hồi kiến trúc này |

---

## 5. Hướng Dẫn Kích Hoạt Lại Sen Chat Khi Sẵn Sàng

Khi cần kích hoạt lại Sen Chat, chỉ cần thực hiện 2 bước đơn giản:

1. **Mở lại định tuyến trong `middleware.ts`**:
   Bật lại khối kiểm tra `isChatSubdomain`:
   ```ts
   const isChatSubdomain =
     hostname.startsWith('chat.senexam.') ||
     hostname.startsWith('chat.')

   if (isChatSubdomain) {
     if (pathname === '/' || pathname === '/dashboard') {
       url.pathname = '/chat'
       return applySecurityHeaders(NextResponse.rewrite(url))
     }
     if (pathname.startsWith('/chat')) {
       return applySecurityHeaders(NextResponse.next())
     }
   }
   ```
2. **Thêm lại lối tắt trong `app/new-dashboard/page.tsx`**:
   Bổ sung thẻ `Sen Chat` vào danh sách `actions` với URL `https://chat.senexam.me`.
