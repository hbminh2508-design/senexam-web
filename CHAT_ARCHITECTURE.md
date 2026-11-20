# SEN CHAT SYSTEM ARCHITECTURE
**Kiến Trúc Kỹ Thuật Hệ Thống Trò Chuyện Đầu Cuối (E2EE) - SenExam Platform**
*Phiên bản: 2.2.0 | Tài liệu Kiến trúc Toàn diện từ Phase 1 đến Phase 7*

---

## 1. Tổng quan Hệ thống (System Overview)

**Sen Chat** là hệ thống trò chuyện thời gian thực bảo mật cao cấp được tích hợp trực tiếp vào nền tảng học tập trực tuyến **SenExam** (`chat.senexam.me`, `senexam.me/chat`, và ứng dụng Android Capacitor `app/m/chat`).

Hệ thống tuân thủ các nguyên tắc thiết kế bất khả xâm phạm:
- **Zero-Knowledge Architecture:** Máy chủ cơ sở dữ liệu, nhà cung cấp điện toán đám mây và quản trị viên không thể giải mã nội dung tin nhắn, tệp tin hay tệp âm thanh của người dùng.
- **Mật mã học chuẩn công nghiệp:** Triển khai Signal Protocol (1-1) và IETF MLS RFC 9420 (Nhóm), WebRTC Insertable Streams (Cuộc gọi), và Chunked AES-256-GCM (Tệp đính kèm).
- **Đồng bộ đa nền tảng (Parity 100%):** Hỗ trợ đầy đủ trên Web Desktop, Mobile Web (`m.senexam.me`), và ứng dụng Android Native đóng gói qua Capacitor.

```
+-------------------------------------------------------------------------+
|                           SEN CHAT CLIENT                               |
|  +--------------------+  +--------------------+  +-------------------+  |
|  | Web Desktop (Next) |  | Mobile Web (Next)  |  | Android Capacitor |  |
|  +--------------------+  +--------------------+  +-------------------+  |
|          |                         |                        |           |
|          +-------------------------+------------------------+           |
|                                    |                                    |
|          +--------------------------------------------------+           |
|          |             CRYPTOGRAPHIC ENGINE CORE            |           |
|          |  * Signal Protocol (X3DH + Double Ratchet)       |           |
|          |  * MLS RFC 9420 (TreeKEM Group Ratchet)          |           |
|          |  * Chunked AES-256-GCM Streaming Cipher          |           |
|          |  * WebRTC Insertable Streams (FrameCrypto)       |           |
|          |  * Local Whisper WASM STT & Audio Opus           |           |
|          +--------------------------------------------------+           |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        NETWORK & CLOUD SERVICES                         |
|  +---------------------+  +--------------------+  +------------------+  |
|  | Supabase Realtime   |  | Supabase Database  |  | Google Drive API |  |
|  | (WebSocket Relay)   |  | (RLS Ciphertext)   |  | (Encrypted Blob) |  |
|  +---------------------+  +--------------------+  +------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Phase 1: Mật mã học Signal 1-1 (Signal Protocol Engine)

Module triển khai tại `lib/senChatSignalProtocol.ts` / `lib/senChatSignalProtocol.mjs`.

### 2.1. Quản lý Khóa & Khởi tạo phiên X3DH (Extended Triple Diffie-Hellman)
Mỗi thiết bị người dùng duy trì một bộ khóa mật mã học:
1. **Identity Key ($IK$):** Cặp khóa Curve25519 dài hạn, đại diện cho danh tính thiết bị.
2. **Signed PreKey ($SPK$):** Cặp khóa Curve25519 trung hạn, đi kèm chữ ký số xác thực bởi Identity Key.
3. **One-Time PreKeys ($OPK$):** Tập hợp 50-100 cặp khóa sử dụng một lần để bảo vệ phiên khỏi tấn công phát lại ngay cả khi đối tác ngoại tuyến.

Khi Người dùng A khởi tạo cuộc trò chuyện với Người dùng B:
- A tải gói khóa của B (Identity Key, Signed PreKey, OPK) từ máy chủ.
- A thực hiện 4 phép nhân Diffie-Hellman:
  $$DH_1 = ECDH(IK_A, SPK_B)$$
  $$DH_2 = ECDH(EK_A, IK_B)$$
  $$DH_3 = ECDH(EK_A, SPK_B)$$
  $$DH_4 = ECDH(EK_A, OPK_B)$$
- Tính toán Master Key thông qua HKDF-SHA256:
  $$SK = HKDF(DH_1 \parallel DH_2 \parallel DH_3 \parallel DH_4)$$

### 2.2. Thuật toán Double Ratchet (Cóc nhảy đôi)
Sau khi thiết lập $SK$, phiên trò chuyện chuyển sang cơ chế Double Ratchet kết hợp giữa:
1. **KDF Chain Ratchet (Cóc nhảy đối xứng):** Cứ mỗi tin nhắn được gửi hoặc nhận, chuỗi KDF bước tới một bước, sinh ra Message Key độc lập và xóa ngay khóa cũ khỏi RAM. Đạt được **Forward Secrecy (Bảo mật chuyển tiếp)**.
2. **DH Ratchet (Cóc nhảy bất đối xứng):** Mỗi khi nhận được phản hồi từ đối tác chứa Ephemeral Key mới, một vòng trao đổi DH mới được thực hiện. Đạt được **Post-Compromise Security (Bảo mật sau xâm phạm)**.

### 2.3. Mã xác thực Số an toàn (Safety Numbers)
Hai bên có thể đối chiếu 12 khối số ngẫu nhiên được sinh ra từ hàm băm SHA-512 trên cặp Identity Keys để đảm bảo không có kẻ nghe lén đứng giữa (MITM).

---

## 3. Phase 2: Trò chuyện Nhóm MLS (RFC 9420 TreeKEM)

Module triển khai tại `lib/senChatMlsProtocol.ts` / `lib/senChatMlsProtocol.mjs`.

### 3.1. Cấu trúc Cây nhị phân cân bằng (TreeKEM Left-Balanced Binary Tree)
Khác với Signal Sender Keys (yêu cầu gửi $N-1$ bản tin khi xoay khóa), Sen Chat ứng dụng **MLS RFC 9420** sử dụng cấu trúc cây nhị phân TreeKEM:
- Mỗi thành viên đại diện cho một lá (Leaf node).
- Các nút cha (Parent nodes) chứa các cặp khóa trung gian được dẫn xuất bằng KDF.
- Gốc cây (Root node) sinh ra bí mật nhóm (Epoch Secret).

### 3.2. Vòng đời Epoch & Thay đổi thành viên
1. **Tạo nhóm:** Quản trị viên khởi tạo cây nhị phân với 1 lá, sinh `Epoch 0`.
2. **Thêm thành viên (Add Member):** Quản trị viên tải `KeyPackage` công khai của thành viên mới, gán vào một lá trống, tạo gói tin `Welcome` mã hóa trực tiếp cho người mới và gửi bản tin `Commit` tới nhóm. Cây nâng lên `Epoch E + 1`.
3. **Xóa thành viên (Remove Member):** Khi một thành viên rời nhóm hoặc bị loại, nhánh chứa lá đó bị vô hiệu hóa; thành viên thực hiện thao tác commit sẽ cập nhật một đường dẫn mới (Direct Path Update) để loại trừ thành viên bị xóa khỏi việc biết bí mật Epoch tiếp theo.
4. **Xoay khóa định kỳ (Update Key):** Thành viên tự động xoay khóa sau mỗi 100 tin nhắn hoặc 7 ngày để đảm bảo Post-Compromise Security.

---

## 4. Phase 3: Quản lý & Chia sẻ Tệp Đính Kèm Phân Đoạn (Chunked AES-256-GCM)

Module triển khai tại `lib/senChatChunkCrypto.ts` / `lib/senChatDriveService.ts`.

### 4.1. Mã hóa Luồng Phân Đoạn (Client-Side Chunked Encryption)
- Tệp tin được đọc dưới dạng `ReadableStream` và chia thành các phân đoạn tiêu chuẩn (4MB mỗi chunk).
- Mỗi phân đoạn được mã hóa độc lập bằng **AES-256-GCM** với IV ngẫu nhiên 12-byte và Authentication Tag 16-byte:
  $$C_i, T_i = \text{AES-GCM-Encrypt}(K_{file}, IV_i, \text{Chunk}_i)$$
- Khóa tệp $K_{file}$ là khóa ngẫu nhiên 256-bit được sinh mới cho mỗi tệp, sau đó $K_{file}$ được mã hóa E2EE qua Signal/MLS và gửi tới người nhận trong tin nhắn loại `AttachmentDescriptor`.

### 4.2. Lưu trữ Zero-Knowledge trên Google Drive API
- Các phân đoạn mã hóa được tải trực tiếp lên thư mục Google Drive chuyên dụng của hệ thống qua Resumable Upload API.
- Google Drive chỉ lưu trữ các khối byte nhị phân ngẫu nhiên, không thể đọc được nội dung tệp hay xem ảnh gốc.
- Hạn mức tệp phân bậc theo gói VIP: Free (10MB), Pro (50MB), Premium (100MB).

---

## 5. Phase 4: Tin nhắn Thoại & Nhận diện Giọng nói STT (Voice & Whisper)

Module triển khai tại `lib/senChatVoiceSTT.ts` / `lib/senChatVoiceSTT.mjs`.

### 5.1. Thu âm & Mã hóa Âm thanh
- Âm thanh được ghi lại qua `MediaRecorder` ở định dạng Opus/WebM độ trễ thấp và chất lượng cao.
- Dữ liệu âm thanh được mã hóa hoàn toàn ở client trước khi phát tán qua kênh E2EE.

### 5.2. Công nghệ Chuyển giọng nói thành văn bản (STT) Bảo vệ Quyền riêng tư
Hệ thống áp dụng mô hình 2 lớp:
1. **Ưu tiên On-Device Whisper (WASM/WebGPU):** Chạy mô hình Whisper Tiny/Base trực tiếp trong trình duyệt qua WebAssembly/ONNX Runtime. Giọng nói không bao giờ rời khỏi thiết bị.
2. **Server Fallback STT (Chỉ dành cho máy yếu):**
   - Chỉ kích hoạt khi người dùng bấm đồng ý rõ ràng (`consent === true`).
   - Âm thanh được gửi qua kênh HTTPS bảo mật tới route `/api/chat/stt`.
   - Máy chủ xử lý trong bộ nhớ RAM tạm thời và **xóa sạch ngay lập tức** sau khi trả về văn bản (Zero Persistence).

---

## 6. Phase 5: Cuộc gọi Thoại & Video WebRTC E2EE (WebRTC FrameCrypto)

Triển khai tại `app/chat/` và `app/m/chat/`.

### 6.1. Báo hiệu (Signaling Relay)
- Tận dụng hạ tầng Supabase Realtime WebSocket để trao đổi SDP Offer, SDP Answer và ICE Candidates.
- Toàn bộ gói tin báo hiệu chứa thông tin phòng họp được định danh bảo mật.

### 6.2. Mã hóa Khung hình WebRTC (Insertable Streams)
- Ngoài mã hóa tầng truyền tải chuẩn **DTLS-SRTP**, hệ thống tích hợp API **WebRTC Insertable Streams** (hoặc WebRTC Encoded Transform).
- Mỗi khung hình video và khung âm thanh RTP trước khi được gửi vào mạng đều được mã hóa thêm một lớp AES-GCM với khóa phiên gọi được thỏa thuận trước giữa hai đầu cuối.

---

## 7. Phase 6: Trợ lý SenAI & Bot Bảo mật trong Phòng Trò Chuyện

Module triển khai tại `lib/senChatAi.ts` / `lib/senChatAi.mjs` / `app/api/chat/senai/route.ts`.

### 7.1. Ranh giới Quyền riêng tư E2EE (Privacy Boundary)
- Sen Chat tuyệt đối **không tự động gửi tin nhắn người dùng cho AI**.
- Chỉ khi tin nhắn bắt đầu hoặc chứa cú pháp `@Sen` hoặc `@SenAI`, client mới hiển thị nhãn xác nhận và gửi câu hỏi đã trích xuất tới API SenAI.

### 7.2. Phòng vệ Chống Prompt Injection
- Dữ liệu người dùng được đóng gói nghiêm ngặt thành `DATA BLOCK` thuần túy với dấu phân cách chống vượt quyền:
  ```
  [USER_QUERY_DATA_BOUNDARY_START]
  ${sanitizedQuery}
  [USER_QUERY_DATA_BOUNDARY_END]
  ```
- System Prompt cố định trên server yêu cầu AI chỉ trả lời câu hỏi học tập, từ chối thực hiện chỉ thị thay đổi hành vi hệ thống.

### 7.3. Bảo toàn Công thức Toán học KaTeX & TikZ
- Bộ lọc đầu ra sanitize mã độc hại XSS nhưng bảo tồn 100% cú pháp `$...$`, `$$...$$`, và các khối hình học TikZ `\begin{tikzpicture}...\end{tikzpicture}`.

---

## 8. Phase 7: Mobile Native Parity & An ninh Android (Capacitor)

Module triển khai tại `lib/senChatMobileSecurity.mjs` / `lib/senChatOfflineQueue.mjs` / `lib/capacitorBridge.mjs`.

### 8.1. Bảo vệ Phần cứng Android Keystore
- Master Identity Private Key trên thiết bị Android được lưu trữ trong Android Keystore và truy xuất qua bộ nhớ an toàn (TEE/StrongBox), ngăn chặn việc trích xuất khóa qua USB Debugging hoặc ADB Backup.

### 8.2. Chống Chụp Màn hình bằng FLAG_SECURE
- Kích hoạt thuộc tính cửa sổ `FLAG_SECURE` trên Android WebView.
- Màn hình bị làm đen khi chụp ảnh màn hình, quay video màn hình hoặc hiển thị trong danh sách chuyển đổi ứng dụng đa nhiệm (App Switcher).

### 8.3. Khóa Ứng dụng bằng PIN & Sinh trắc học (App Lock)
- Khóa tự động sau thời gian chờ (1 phút, 5 phút, 15 phút).
- Xác thực bằng vân tay/khuôn mặt (Biometrics) hoặc mã PIN 4-6 số được băm bằng SHA-256 kết hợp Salt ngẫu nhiên.

### 8.4. Hàng đợi Ngoại tuyến (Offline Queue) với Idempotency Key
- Khi mất mạng, tin nhắn được lưu trữ trong IndexedDB/LocalStorage.
- Khi có mạng trở lại, hàng đợi tự động tháo cạn (auto-drain) theo thứ tự FIFO.
- Mỗi tin nhắn gắn kèm `idempotency_key` duy nhất để triệt tiêu mọi khả năng gửi trùng lặp.

### 8.5. Thông báo Đẩy E2EE Im lặng (Silent E2EE Push Notifications)
- Payload thông báo đẩy gửi qua FCM/APNs **tuyệt đối không chứa nội dung tin nhắn**.
- Chỉ chứa tín hiệu đánh thức `type: "new_e2ee_message"`. Ứng dụng client nền tự giải mã và hiển thị thông báo nội bộ.

---

## 9. Phase 8: Rà soát An ninh, RLS & Cơ chế Xóa Tài khoản Triệt để

Module triển khai tại `lib/senChatAccountCleanup.ts` / `lib/senChatAudit.ts` / `middleware.ts`.

### 9.1. Phủ kín Row Level Security (RLS) trên 11 Bảng
1. `chat_devices` - Quản lý thiết bị đã đăng ký.
2. `chat_prekeys` - Prekeys cho X3DH.
3. `chat_friendships` - Quan hệ kết nối và chặn liên lạc.
4. `chat_conversations` - Phòng trò chuyện trực tiếp và nhóm.
5. `chat_members` - Danh sách thành viên và vai trò phòng chat.
6. `chat_messages` - Ciphertext tin nhắn E2EE.
7. `chat_attachments` - Siêu dữ liệu tệp đính kèm mã hóa.
8. `chat_audit_events` - Nhật ký kiểm toán an ninh đã khử độc.
9. `chat_reports` - Báo cáo vi phạm an toàn cộng đồng.
10. `chat_mls_key_packages` - Gói khóa KeyPackage cho MLS RFC 9420.
11. `chat_mls_commits` - Lịch sử xoay khóa và Welcome packet của MLS.

### 9.2. Cơ chế Xóa Dữ liệu Triệt để theo Chuẩn GDPR (Cascading Erasure)
Khi tài khoản bị xóa (qua Quản trị viên hoặc chức năng tự xóa của người dùng):
1. **Dọn sạch tệp Google Drive:** Gọi `deleteDriveFilesBatch` xóa vĩnh viễn mọi file đính kèm do người dùng tải lên khỏi Drive.
2. **Dọn sạch Supabase Storage:** Xóa toàn bộ file trong bucket `chat_attachments`.
3. **Cascading Delete toàn bộ bảng dữ liệu:** Xóa vĩnh viễn tin nhắn, thiết bị, prekeys, keypackages, thành viên nhóm, quan hệ bạn bè và hồ sơ liên quan.

### 9.3. Tiêu chuẩn Header An ninh & Chống DDoS
- Kích hoạt CSP nghiêm ngặt: `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- Edge In-Memory Rate Limiting: 35 req/phút cho các route nhạy cảm, chống quét Email Enumeration (5 req/phút).
- Zero Plaintext Log: Không bao giờ xuất khóa riêng hay nội dung tin nhắn ra log hệ thống.
