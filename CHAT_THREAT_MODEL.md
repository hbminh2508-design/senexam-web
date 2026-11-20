# SEN CHAT THREAT MODEL (STRIDE)
**Hệ Thống Trò Chuyện Đầu Cuối (E2EE) Bảo Mật Cao Cấp - SenExam Platform**
*Phiên bản: 2.2.0 | Tài liệu Phân tích Mối đe dọa An ninh Toàn diện*

---

## 1. Giới thiệu & Phạm vi (Scope)

Tài liệu này mô hình hóa mối đe dọa an ninh cho hệ thống **Sen Chat** theo khung phương pháp luận **STRIDE** (do Microsoft phát triển và được OWASP khuyến nghị). Sen Chat được thiết kế theo kiến trúc **Zero-Knowledge**, **End-to-End Encryption (E2EE)** với Signal Protocol cho chat 1-1, MLS (RFC 9420) cho chat nhóm, mã hóa phân đoạn AES-256-GCM cho tệp đính kèm, và WebRTC Insertable Streams cho thoại/video.

### Phạm vi phân tích:
1. **Client Endpoints:** Web Browser (Desktop/Mobile), Android Capacitor Native App (`app/m/chat`).
2. **Kênh truyền thông & Relay:** HTTPS/WSS, WebRTC DTLS-SRTP, Supabase Realtime WebSocket, Google Drive API.
3. **Cơ sở dữ liệu & Máy chủ lưu trữ:** Supabase PostgreSQL (RLS), Edge Middleware, Google Cloud Storage / Google Drive.

---

## 2. Mô hình hóa Mối đe dọa theo STRIDE

| Ký hiệu | Mối đe dọa | Mô tả ngắn | Trạng thái phòng thủ trong Sen Chat |
| :---: | :--- | :--- | :--- |
| **S** | **Spoofing** (Giả mạo) | Mạo danh người dùng hoặc thiết bị hợp pháp | **ĐÃ CHẶN** (Khóa định danh Ed25519/Curve25519, X3DH, Safety Numbers, MLS TreeKEM) |
| **T** | **Tampering** (Xáo trộn) | Sửa đổi ciphertext hoặc gói tin trên đường truyền | **ĐÃ CHẶN** (Mã hóa xác thực AEAD AES-256-GCM, HMAC-SHA256, Hash Ratchet) |
| **R** | **Repudiation** (Chối bỏ) | Phủ nhận đã gửi hoặc nhận thông điệp | **ĐÃ XỬ LÝ THEO CHUẨN SIGNAL** (Plausible Deniability sau phiên, Cam kết AEAD trong phiên) |
| **I** | **Information Disclosure** (Lộ tin) | Máy chủ trung gian hoặc tin tặc đọc nội dung tin nhắn | **ĐÃ CHẶN** (Zero-Knowledge E2EE, Forward Secrecy, Post-Compromise Security) |
| **D** | **Denial of Service** (Từ chối DV) | Làm nghẽn đường truyền, cạn kiệt tài nguyên lưu trữ | **ĐÃ CHẶN** (Rate Limiting 3 lớp, giới hạn kích thước tệp VIP, giới hạn thành viên nhóm) |
| **E** | **Elevation of Privilege** (Leo thang) | Vượt quyền truy cập phòng chat, can thiệp vai trò admin | **ĐÃ CHẶN** (RLS 11 bảng, RPC atomic checks, phân quyền vai trò admin/owner) |

---

### Chi tiết các biện pháp phòng vệ theo STRIDE

### 2.1. Spoofing (Giả mạo danh tính)
- **Mối đe dọa:** Kẻ tấn công trên mạng giả mạo danh tính của người gửi tin nhắn, hoặc máy chủ trung gian mạo danh người nhận để thu thập tin nhắn.
- **Biện pháp đã triển khai:**
  1. **Khóa danh tính bất biến (Identity Keys):** Mỗi thiết bị khởi tạo một cặp khóa Curve25519/Ed25519 duy nhất tại client. Khóa công khai được ký số và chỉ định danh thông qua chữ ký số X3DH.
  2. **Số an toàn (Safety Numbers / Fingerprints):** Tạo mã băm trực quan (Visual Hash) 12 khối số từ khóa danh tính của hai bên. Người dùng có thể đối soát chéo ngoài băng (out-of-band qua QR code hoặc gặp trực tiếp) để phát hiện tấn công Man-In-The-Middle (MITM).
  3. **MLS Member Credentials:** Trong nhóm chat MLS, mỗi thành viên phải nộp KeyPackage chứa chứng chỉ thông tin xác thực đã được ký bởi Identity Key của thiết bị.

### 2.2. Tampering (Can thiệp & Sửa đổi dữ liệu)
- **Mối đe dọa:** Kẻ tấn công hoặc proxy trung gian thay đổi ciphertext, tráo đổi gói tin media, hoặc phát lại (replay attack) gói tin cũ.
- **Biện pháp đã triển khai:**
  1. **Mã hóa xác thực AEAD (AES-256-GCM):** Mọi tin nhắn văn bản, tệp âm thanh, và phân đoạn tệp đều đi kèm thẻ xác thực tính toàn vẹn (Authentication Tag 128-bit). Bất kỳ sự thay đổi dù chỉ 1 bit đều khiến giải mã thất bại ngay tại client.
  2. **Chống Replay bằng Triple-Key Defense:** Mỗi tin nhắn gắn liền với `ratchet_counter`, `nonce` 12-byte ngẫu nhiên và `idempotency_key` duy nhất có ràng buộc UNIQUE trên cơ sở dữ liệu (`uq_chat_message_idempotency`).
  3. **SHA-256 Chunk Integrity:** Mỗi chunk 4MB của tệp tin tải lên Google Drive đều có hash độc lập; tệp hoàn chỉnh được kiểm tra mã băm gốc trước khi ghép tệp tại client.

### 2.3. Repudiation (Chối bỏ trách nhiệm)
- **Mối đe dọa:** Người dùng phủ nhận việc gửi một tin nhắn độc hại, hoặc ngược lại, người nhận bị vu khống đã nói một điều gì đó.
- **Giải pháp & Thiết kế chuẩn Mật mã học Signal:**
  1. **Plausible Deniability (Tính phủ nhận hợp lý):** Tuân thủ triết lý của Signal Protocol, khóa MAC phiên trao đổi được cấu thành từ các phép nhân ECDH đối xứng. Sau khi phiên kết thúc, bất kỳ ai có chìa khóa phiên đều có thể tạo một ciphertext hợp lệ về mặt toán học. Điều này bảo vệ người gửi khỏi việc bị sử dụng ciphertext làm bằng chứng mã hóa không thể chối cãi trước tòa án độc đoán (chống giám sát cưỡng bức).
  2. **Cam kết tức thời trong phiên:** Trong quá trình phiên trò chuyện diễn ra, cả hai bên đều xác thực tin nhắn tức thời thông qua Ratchet State và Ratchet Chain Keys.

### 2.4. Information Disclosure (Tiết lộ thông tin)
- **Mối đe dọa:** Máy chủ cơ sở dữ liệu Supabase, Google Drive, hoặc hạ tầng truyền thông bị cơ quan quản lý tịch thu hoặc hacker chiếm quyền root và cố gắng trích xuất tin nhắn học sinh/giáo viên.
- **Biện pháp đã triển khai:**
  1. **Zero-Knowledge Server:** Toàn bộ bảng `chat_messages` và `chat_attachments` chỉ chứa ciphertext Base64 và vector khởi tạo ngẫu nhiên. Máy chủ không bao giờ sở hữu Master Key hay Ephemeral Key.
  2. **Bảo mật chuyển tiếp (Forward Secrecy - FS):** Double Ratchet (1-1) và MLS TreeKEM (Nhóm) liên tục xoay khóa đối xứng sau mỗi tin nhắn và mỗi epoch. Nếu khóa hiện tại bị rò rỉ, toàn bộ tin nhắn trong quá khứ vẫn an toàn 100%.
  3. **Bảo mật sau xâm phạm (Post-Compromise Security - PCS):** Chỉ cần một lượt xoay khóa mới (MLS Commit hoặc DH Ratchet step), kẻ tấn công bị mất quyền giải mã các tin nhắn tương lai.
  4. **Chính sách không ghi nhật ký (Zero Log Policy):** Tuyệt đối không bao giờ ghi plaintext tin nhắn hoặc private keys vào console, server logs hay bảng kiểm toán `chat_audit_events`. Toàn bộ dữ liệu kiểm toán được khử độc tự động (`sanitizeChatAuditPayload`).

### 2.5. Denial of Service (Từ chối dịch vụ)
- **Mối đe dọa:** Botnet gửi hàng triệu tin nhắn rác, spam tệp dung lượng khủng làm đầy bộ nhớ hệ thống, hoặc spam tạo nhóm MLS làm quá tải cây khóa TreeKEM.
- **Biện pháp đã triển khai:**
  1. **Rate Limiting 3 Tầng:**
     - Tầng Edge Middleware: Giới hạn 35 yêu cầu/phút trên các route nhạy cảm (`/api/chat/attachments/upload`, `/api/chat/stt`, `/api/chat/device-management`).
     - Tầng Anti-Enumeration: Tối đa 5 lượt tra cứu bạn bè qua email hash/phút.
     - Tầng Ứng dụng & Người dùng: Bộ nhớ trượt (Sliding Window) giới hạn 20 uploads/phút và 10 STT/phút cho từng user ID.
  2. **Kiểm soát kích thước tệp nghiêm ngặt:** Phân bậc hạn mức tệp theo gói VIP (`validateChatFileSize`): Free (10MB), Pro (50MB), Premium (100MB). Chặn ngay từ client và xác thực lại ở server trước khi nhận stream.
  3. **Giới hạn quy mô nhóm MLS:** Tối đa 200 thành viên mỗi phòng hội thoại để đảm bảo độ trễ cập nhật TreeKEM dưới 50ms.

### 2.6. Elevation of Privilege (Leo thang đặc quyền)
- **Mối đe dọa:** Thành viên bình thường tự phong làm Admin nhóm, mời người lạ vào nhóm kín mà không có quyền, hoặc người dùng A đọc tin nhắn của phòng chat B.
- **Biện pháp đã triển khai:**
  1. **Row Level Security (RLS) 100%:** Toàn bộ 11 bảng `chat_*` đều kích hoạt RLS. Chỉ thành viên có mặt trong `chat_members` của cuộc trò chuyện mới có thể SELECT tin nhắn.
  2. **Kiểm tra vai trò nguyên tử bằng RPC PostgreSQL:** Các thao tác nhạy cảm (thêm thành viên, xoay khóa, giải tán nhóm) được kiểm tra trực tiếp trong hàm RPC với quyền `owner` hoặc `admin`.

---

## 3. Rủi ro còn lại (Residual Risks) & Phạm vi E2EE KHÔNG bảo vệ được

Mật mã học đầu cuối (E2EE) bảo vệ tối đa dữ liệu trên đường truyền và tại máy chủ trung gian. Tuy nhiên, nó **không thể** phá vỡ các định luật vật lý và an ninh tại thiết bị đầu cuối.

### 3.1. Thiết bị đầu cuối bị nhiễm mã độc (Compromised Endpoint)
- **Rủi ro:** Nếu thiết bị của người dùng bị root/jailbreak, cài phần mềm gián điệp, keylogger, trojan truy cập từ xa (RAT) hoặc dính mã độc ở mức hệ điều hành, kẻ tấn công có thể đọc nội dung bộ nhớ RAM ngay khi văn bản vừa được người dùng gõ hoặc vừa được giải mã hiển thị lên màn hình.
- **Khuyến cáo người dùng:** Cài đặt cập nhật bảo mật hệ điều hành thường xuyên, không cài app từ nguồn lạ (APK lậu), không root/jailbreak máy.

### 3.2. Rò rỉ Metadata (Metadata Leakage)
- **Rủi ro:** E2EE mã hóa nội dung tin nhắn và tệp, nhưng máy chủ chuyển tiếp mạng và nhà cung cấp dịch vụ mạng (ISP) vẫn quan sát được:
  - Thời điểm gửi và nhận gói tin (Timestamp).
  - Tần suất nhắn tin giữa hai tài khoản (Communication graph).
  - Kích thước tương đối của tệp đính kèm (File size metadata).
  - Địa chỉ IP công khai của thiết bị kết nối.
- **Phạm vi bảo vệ:** Metadata có thể được hạn chế bằng VPN, nhưng việc che giấu 100% đồ thị kết nối yêu cầu mạng nặc danh phức tạp như Tor / Mixnet (gây độ trễ cao, không phù hợp cho chat thời gian thực).

### 3.3. Chụp màn hình bằng thiết bị vật lý bên ngoài (Physical Camera / Shoulder Surfing)
- **Rủi ro:** Ứng dụng Android đã kích hoạt `FLAG_SECURE` để ngăn chụp màn hình trong máy và ngăn quay video màn hình. Tuy nhiên, nếu một người đứng cạnh dùng điện thoại thứ hai hoặc camera giám sát chĩa thẳng vào màn hình, phần mềm không thể can thiệp được.

### 3.4. Tấn công phi kỹ thuật (Social Engineering / Phishing)
- **Rủi ro:** Người dùng bị lừa chia sẻ tài khoản đăng nhập hoặc bị thao túng tâm lý tự nguyện copy paste nội dung tin nhắn gửi cho kẻ xấu.

### 3.5. Mất khóa sao lưu khi quên mật khẩu (Zero-Knowledge Trade-off)
- **Rủi ro:** Sen Chat tuân thủ nguyên tắc Zero-Knowledge: nhà phát triển không giữ bản sao chìa khóa giải mã. Nếu người dùng quên mật khẩu bảo vệ bản sao lưu và mất toàn bộ thiết bị đã đăng ký, dữ liệu lịch sử cũ sẽ mất vĩnh viễn và không có bất kỳ ai trên thế giới (kể cả quản trị viên hệ thống) có thể khôi phục được.

---

## 4. Tóm tắt Đánh giá Rủi ro Tổng thể

```
[Mạng Internet & Tin tặc MITM] ----------> BỊ CHẶN 100% (AES-256-GCM + Double Ratchet)
[Máy chủ Supabase & Google Drive] ------> BỊ CHẶN 100% (Zero-Knowledge, chỉ thấy Ciphertext)
[Nhân viên vận hành SenExam] ------------> BỊ CHẶN 100% (Không giữ Private Key, Zero Logs)
[Thiết bị người dùng dính RAT/Root] ------> RỦI RO CÒN LẠI (Phụ thuộc an ninh OS máy khách)
[Chụp ảnh màn hình bằng Camera ngoài] ---> RỦI RO CÒN LẠI (Rào cản vật lý)
```

Sen Chat 2.2.0 đạt mức độ bảo vệ an ninh tương đương các ứng dụng nhắn tin bảo mật hàng đầu thế giới (Signal, WhatsApp) cho nền tảng giáo dục học đường SenExam.
