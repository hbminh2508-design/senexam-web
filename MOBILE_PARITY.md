# MA TRẬN ĐỒNG BỘ TÍNH NĂNG PC & MOBILE (MOBILE PARITY MATRIX)

**Thời điểm cập nhật:** 18/11/2026 (Hoàn tất Giai đoạn P2 & P3)  
**Môi trường:** PC Web, Mobile Web (Smartphone Browser) & Android App (Capacitor Webview `me.senexam.app`)  
**Quy ước trạng thái:**  
- 🟢 **Hoạt động:** Tính năng hoạt động đầy đủ, mượt mà và tương thích tốt.  
- 🔴 **Hỏng:** Tính năng có hiển thị nhưng phát sinh lỗi logic, lỗi luồng tiền tệ hoặc lỗi giao diện không dùng được.  
- 🟡 **Thiếu:** Tính năng PC có nhưng trên Mobile chưa được xây dựng hoặc bị thiếu trang con.  
- ⚪ **Chỉ PC theo thiết kế:** Tính năng phức tạp (soạn thảo LaTeX, phần mềm desktop SEB, dashboard quản trị 80 bảng CSDL) chỉ dành riêng cho máy tính.

---

## 1. Ma trận so sánh tính năng toàn diện (PC vs Mobile Web vs Android Capacitor)

| Nhóm tính năng / Tuyến đường (Route) | Bản PC | Mobile Web | Android App (Capacitor) | Chi tiết kỹ thuật & Đánh giá hiện trạng |
| :--- | :---: | :---: | :---: | :--- |
| **Trang chủ & Điều hướng chính** (`/` ➔ `/m`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | `middleware.ts` tự động phát hiện thiết bị di động để chuyển hướng sang `/m`. Có Header, Banner, Quick Actions, Safe-area top notch. |
| **Phòng thi HSA (ĐHQGHN)** (`/new-exams/[id]`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | **Đã sửa P3:** Giữ đúng 3 phần độc lập chuẩn HSA (50 câu/phần). Bổ sung ngăn kéo bảng 50 câu dạng bottom sheet trên mobile và thanh tab chuyển đổi "Đoạn trích / Làm câu hỏi" cho Phần 2 Ngữ văn mà không làm biến dạng tỷ lệ. |
| **Phòng thi TSA (ĐHBK Hà Nội)** | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | PC: Chuẩn giao diện ĐHBK HN. Mobile: Đang dùng skin chung của phòng khảo thí di động. |
| **Phòng thi VNU TEST (ĐHQGHN)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | 1 phần duy nhất, thời gian linh hoạt, màn hình chào mừng kích hoạt Fullscreen. Mobile hoạt động hoàn hảo. |
| **Phòng thi THPTQG & UET Portal** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Điều hướng mượt mà trên mobile, hỗ trợ cả đề PDF và đề KaTeX. |
| **Phòng thi SEB (Safe Exam Browser)** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Kỳ thi yêu cầu cài đặt phần mềm Safe Exam Browser trên Windows/macOS có mã hash bảo mật. Không áp dụng cho di động theo đặc tả. |
| **Cửa hàng & Mua sắm** (`/new-pay` ➔ `/m/pay`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | **Đã sửa P2:** Mobile tách hoàn toàn sang ví SCm (1 SCm = 100đ; 1 SC = 5 SCm). Sổ cái `mobile_sencash_transactions`, khóa dòng atomic `adjust_scm_balance`, bảng giá SCm độc lập, triệt tiêu 100% rò rỉ SC. |
| **Mua gói VIP qua VietQR** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Tích hợp VietQR SePay, polling tự động cập nhật trạng thái đơn hàng thời gian thực. |
| **Kho đề tập trung (Sen Ground - Exams)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Lọc môn, tìm kiếm đề, xem thông số đề thi, bắt đầu làm bài. |
| **Soạn đề KaTeX & OCR đề thi** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Tính năng gõ mã KaTeX phức tạp, biên soạn câu hỏi trắc nghiệm màn hình lớn; không khả thi khi thao tác trên điện thoại. |
| **Thư viện tài liệu đề thi & Tải PDF** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | **Đã sửa P3:** Sử dụng `openSafeDownload` (`lib/capacitorBridge.ts`), tự động ủy quyền mở DownloadManager/Trình duyệt ngoài trên Android Capacitor WebView. |
| **Lịch sử làm bài & Thống kê kết quả** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Danh sách bài nộp, điểm số, ngày giờ nộp, thống kê KPI hiển thị tốt trên `/m/sen-ground?tab=history`. |
| **Xem lại chi tiết bài thi (Exam Review)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | **Đã bổ sung P3:** Đã tạo trang chuyên biệt `/m/submissions/[id]` hỗ trợ xem lại từng câu hỏi, công thức KaTeX, hình vẽ TikZ, đối chiếu đáp án học sinh vs đáp án đúng (xanh/đỏ), lời giải chi tiết, và bộ lọc "Tất cả / Câu sai / Câu đúng". |
| **Trợ lý SenAI Studio** (`/new-senai-studio`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Mobile tích hợp modal SenAI Chat Assistant ngay trên thanh điều hướng đáy `MobileNav.tsx`, hỗ trợ chat trực tiếp với Gemini 2.0. |
| **Bản đồ tri thức SenGraph 3D** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Đồ thị 3D Three.js tiêu tốn nhiều GPU và RAM, gây nóng máy và tụt pin trên smartphone. |
| **Hệ thống Bầu cử & Bỏ phiếu** (`/baucu`) | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | Chưa có trang `/m/baucu` riêng (chưa cấp bách cho thí sinh). |
| **Hệ thống Nộp Quỹ Lớp** (`/nopquylop`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Giao diện responsive chạy tốt trên mobile web; quét mã QR đóng tiền và xem sao kê minh bạch. |
| **Hồ sơ cá nhân & Đổi mật khẩu** (`/m/profile`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Chỉnh sửa thông tin, trường học, điểm mục tiêu. Đã loại bỏ chuỗi SC của PC. |
| **Trang Quản trị Hệ thống (Admin Dashboard)** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Trang quản trị vận hành với 80 bảng CSDL, duyệt đơn, xuất file Excel dung lượng lớn chỉ thiết kế cho PC. |
| **Ứng dụng Thở Tĩnh Tâm (Breathe-U)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Giao diện chuẩn mobile-first, hoạt động hoàn hảo trên cả 3 nền tảng. |
| **Sen Chat (Mã Hóa E2EE & MLS)** (`/chat` ➔ `/m/chat`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | **Đã hoàn thiện P7:** Giao diện tối ưu một cột trên điện thoại, chuyển đổi 3 màn hình mượt mà (danh sách $\leftrightarrow$ khung chat $\leftrightarrow$ thông tin phòng), safe-area insets, vùng chạm $\ge 44\text{px}$, bàn phím ảo (visualViewport) không che ô nhập. Nút Back phần cứng theo ngữ cảnh (thoát hội thoại/modal về danh sách $\to$ bấm 2 lần trong 2s để thoát). Tải tệp `openSafeDownload`, Android FLAG_SECURE chống chụp màn hình/task switcher, khóa app bằng PIN/sinh trắc học, lưu khóa riêng E2EE bằng Android Keystore, thông báo đẩy không lộ nội dung tin nhắn, hàng đợi ngoại tuyến với idempotency_key. |

---

## 2. Các điểm kỹ thuật Android Capacitor đã xử lý triệt để ở P3

1. **Nút Back phần cứng (`CapacitorManager.tsx` & `lib/capacitorBridge.ts`):**
   - *Khi đang làm bài thi:* Chặn thoát, mở modal cảnh báo: *"Bạn có chắc muốn thoát? Bài thi sẽ được nộp tự động"*.
   - *Khi ở trang chủ (`/m`):* Bấm 1 lần hiện Toast: *"Nhấn một lần nữa trong 2 giây để thoát ứng dụng"*; bấm lần 2 trong vòng 2000ms thì mới gọi `App.exitApp()`.
   - *Khi ở các màn hình khác:* Tự động gọi `router.back()` quay lại trang trước.
2. **Bàn phím ảo không che khuất trường nhập liệu:**
   - Kích hoạt `setupVirtualKeyboardHelper` tự động cuộn `target.scrollIntoView({ behavior: 'smooth', block: 'center' })` khi `focusin` vào ô nhập liệu hoặc câu hỏi điền từ.
3. **Tải tài liệu trong WebView Android:**
   - Giải pháp `resolveSafeDownload` chuyển đổi thành `_system` intent trên native Android để kích hoạt trình quản lý tải file của hệ điều hành.
4. **Vùng an toàn (Safe Area Insets):**
   - Đã cấu hình `pt-[env(safe-area-inset-top,0px)]` và `pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]` trên khung layout `app/m/layout.tsx`.
5. **Khôi phục bài thi khi mất mạng:**
   - Đã lưu cả tiến độ đáp án `m_exam_ans_${examId}` lẫn chỉ số câu hỏi đang làm `m_exam_idx_${examId}` vào `localStorage`. Khi mất mạng và vào lại, học sinh quay lại đúng câu đang làm dở.
   - Thêm modal thông báo mất mạng với nút "Thử nộp lại" an toàn không xóa bài làm.

---

## 3. Các điểm kỹ thuật Android Capacitor & Mobile Web hoàn thiện ở P7 (Sen Chat)

1. **Giao diện 1 cột tối ưu cho điện thoại & bàn phím ảo (Visual Viewport):**
   - Tuyến đường `/m/chat` thuần mobile-first, chuyển đổi 3 màn hình mượt mà: Danh sách hội thoại $\leftrightarrow$ Khung chat chi tiết $\leftrightarrow$ Thông tin phòng & cài đặt.
   - Vùng chạm tương tác đạt chuẩn tối thiểu $\ge 44\text{px}$ (`min-h-[44px] min-w-[44px]`), tối ưu ngón cái cầm 1 tay.
   - Lắng nghe `window.visualViewport` để đẩy thanh nhập liệu lên phía trên bàn phím ảo khi mở, không che khuất ô soạn tin và nội dung tin nhắn.
2. **Nút Back phần cứng Android theo ngữ cảnh (`CapacitorManager.tsx` & `lib/capacitorBridge.ts`):**
   - *Khi đang mở modal hoặc phòng chat:* Bấm Back đóng modal hoặc thoát khỏi phòng chat để quay về danh sách hội thoại (`close_chat_conversation`).
   - *Khi đang ở danh sách hội thoại (`/m/chat`):* Tự động áp dụng quy tắc 2 giây của `/m` (bấm 1 lần hiện toast nhắc nhở, bấm lần 2 trong 2 giây mới gọi `App.exitApp()`).
3. **Tải tệp tin an toàn qua `openSafeDownload`:**
   - Toàn bộ ảnh, video, tệp đính kèm mã hóa chunk và bản sao lưu dữ liệu Sen Chat đều được tải qua `openSafeDownload`, ủy quyền tự động sang `_system` intent trên Android WebView để hệ điều hành tải bằng DownloadManager.
4. **Android FLAG_SECURE (Chống chụp màn hình & Preview đa nhiệm):**
   - Module `lib/senChatMobileSecurity.ts` tích hợp gọi native Capacitor plugin hoặc CSS overlay chống chụp màn hình, chống rò rỉ nội dung tin nhắn ra danh sách ứng dụng gần đây (Recent Apps / Task Switcher), có công tắc bật/tắt trực tiếp trong cài đặt.
5. **Khóa ứng dụng bằng PIN & Sinh trắc học (Biometric / PIN App Lock):**
   - Cho phép người dùng đặt mã PIN 4-6 số và kích hoạt vân tay / Face ID. Tự động khóa ứng dụng khi khởi động hoặc quay lại từ nền, giao diện bàn phím số cảm ứng mượt mà.
6. **Lưu trữ khóa riêng E2EE bằng Android Keystore:**
   - Cặp khóa nhận dạng Signal Protocol và Prekeys được lưu trữ bằng plugin Android Keystore / Secure Storage cấp phần cứng, không lưu thô trong trình duyệt.
7. **Thông báo đẩy chuẩn Zero-Knowledge E2EE:**
   - Tiêu đề và nội dung thông báo đẩy TUYỆT ĐỐI không chứa bất kỳ văn bản tin nhắn, nội dung giải mã hay ciphertext nào. Chỉ thông báo dạng *"Bạn có tin nhắn mới từ..."* hoặc *"Bạn có tin nhắn mới trong nhóm..."*.
8. **Hàng đợi gửi lại khi mất mạng (Offline Queue) với Idempotency Key:**
   - Khi mất mạng, tin nhắn được đưa vào hàng đợi `lib/senChatOfflineQueue.ts` kèm `idempotency_key` duy nhất. Khi mạng phục hồi, hàng đợi tự động xả (drain) theo thứ tự thời gian FIFO và máy chủ/người nhận loại bỏ trùng lặp triệt để.
9. **Tuân thủ quy chuẩn thương hiệu:**
   - Tuyệt đối không xuất hiện chữ "SC" hay "SenCash" trong toàn bộ mã nguồn và giao diện `app/m/`. Mobile sử dụng độc quyền hệ thống SCm.
