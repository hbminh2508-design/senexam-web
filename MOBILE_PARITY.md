# MA TRẬN ĐỒNG BỘ TÍNH NĂNG PC & MOBILE (MOBILE PARITY MATRIX)

**Thời điểm khảo sát:** 18/11/2026  
**Môi trường:** PC Web, Mobile Web (Smartphone Browser) & Android App (Capacitor Webview `me.senexam.app`)  
**Quy ước trạng thái:**  
- 🟢 **Hoạt động:** Tính năng hoạt động đầy đủ, mượt mà và tương thích tốt.  
- 🔴 **Hỏng:** Tính năng có hiển thị nhưng phát sinh lỗi logic, lỗi luồng tiền tệ hoặc lỗi giao diện không dùng được.  
- 🟡 **Thiếu:** Tính năng PC có nhưng trên Mobile chưa được xây dựng hoặc bị thiếu trang con.  
- ⚪ **Chỉ PC theo thiết kế:** Tính năng phức tạp (soạn thảo LaTeX, phần mềm chuyên dụng desktop SEB, dashboard quản trị 80 bảng CSDL) chỉ dành riêng cho máy tính.

---

## 1. Ma trận so sánh tính năng toàn diện (PC vs Mobile Web vs Android Capacitor)

| Nhóm tính năng / Tuyến đường (Route) | Bản PC | Mobile Web | Android App (Capacitor) | Chi tiết kỹ thuật & Đánh giá hiện trạng |
| :--- | :---: | :---: | :---: | :--- |
| **Trang chủ & Điều hướng chính** (`/` ➔ `/m`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | `middleware.ts` tự động phát hiện thiết bị di động để chuyển hướng sang `/m`. Có Header, Banner, Quick Actions. |
| **Phòng thi HSA (ĐHQGHN)** (`/new-exams/[id]`) | 🟢 Hoạt động | 🔴 Hỏng | 🔴 Hỏng | PC: Đúng 3 phần độc lập, 50 câu/phần, đếm ngược tự động chuyển phần. Mobile: Ép vào giao diện 1 phần chung, mất cấu trúc 3 phần chuẩn HSA. |
| **Phòng thi TSA (ĐHBK Hà Nội)** | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | PC: Chuẩn giao diện ĐHBK HN. Mobile: Chưa có skin giao diện TSA riêng biệt. |
| **Phòng thi VNU TEST (ĐHQGHN)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | 1 phần duy nhất, thời gian linh hoạt, màn hình chào mừng kích hoạt Fullscreen. Mobile đã hoạt động. |
| **Phòng thi THPTQG & UET Portal** | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | PC: Giao diện UET Portal phân tách rõ ràng. Mobile: Chưa có giao diện tối ưu riêng cho 2 phòng này. |
| **Phòng thi SEB (Safe Exam Browser)** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Kỳ thi yêu cầu cài đặt phần mềm Safe Exam Browser trên Windows/macOS có mã hash bảo mật. Không áp dụng cho trình duyệt di động. |
| **Cửa hàng & Mua sắm** (`/new-pay` ➔ `/m/pay`) | 🟢 Hoạt động | 🔴 Hỏng | 🔴 Hỏng | **Lỗi tiền tệ:** Mobile đang hiển thị và tiêu trực tiếp SC của PC trong các tab SenAI, Deal Hot; nạp SCm nhưng sinh đơn nạp SC của PC. |
| **Mua gói VIP qua VietQR** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Tích hợp VietQR SePay, polling tự động cập nhật trạng thái đơn hàng thời gian thực. |
| **Kho đề tập trung (Sen Ground - Exams)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Lọc môn, tìm kiếm đề, xem thông số đề thi, bắt đầu làm bài. |
| **Soạn đề KaTeX & OCR đề thi** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Tính năng gõ mã KaTeX phức tạp, biên soạn câu hỏi trắc nghiệm màn hình lớn; không khả thi khi thao tác trên điện thoại. |
| **Thư viện tài liệu đề thi & Tải PDF** | 🟢 Hoạt động | 🟢 Hoạt động | 🔴 Hỏng một phần | Xem tài liệu mượt mà. Riêng trên Android Webview, nút tải file PDF bị chặn nếu chưa cấu hình quyền lưu trữ native (DownloadManager). |
| **Lịch sử làm bài & Thống kê kết quả** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Danh sách bài nộp, điểm số, ngày giờ nộp hiển thị tốt trên `/m/sen-ground?tab=history`. |
| **Xem lại chi tiết bài thi (Exam Review)** | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | PC có trang xem lại từng câu hỏi kèm lời giải KaTeX (`/exams/.../review`). Mobile hiện chưa có trang review chi tiết riêng cho `/m`. |
| **Trợ lý SenAI Studio** (`/new-senai-studio`) | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | Chat hỏi bài AI hoạt động tốt trên PC. Mobile hiện chưa có trang chuyên biệt `/m/senai-studio`, đang phải mở trang web PC responsive. |
| **Bản đồ tri thức SenGraph 3D** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Đồ thị 3D Three.js tiêu tốn nhiều GPU và RAM, gây nóng máy và tụt pin trên smartphone. |
| **Hệ thống Bầu cử & Bỏ phiếu** (`/baucu`) | 🟢 Hoạt động | 🟡 Thiếu | 🟡 Thiếu | Chưa có trang `/m/baucu` riêng; cử tri truy cập bị chuyển hướng về `/m` hoặc giao diện PC bị vỡ tỷ lệ. |
| **Hệ thống Nộp Quỹ Lớp** (`/nopquylop`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Giao diện responsive chạy tốt trên mobile web; quét mã QR đóng tiền và xem sao kê minh bạch. |
| **Hồ sơ cá nhân & Đổi mật khẩu** (`/m/profile`) | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Chỉnh sửa thông tin, trường học, điểm mục tiêu. (Cần gỡ bỏ chuỗi hiển thị số dư SC của PC). |
| **Trang Quản trị Hệ thống (Admin Dashboard)** | 🟢 Hoạt động | ⚪ Chỉ PC | ⚪ Chỉ PC | Trang quản trị vận hành với 80 bảng CSDL, duyệt đơn, xuất file Excel dung lượng lớn chỉ thiết kế cho PC. |
| **Ứng dụng Thở Tĩnh Tâm (Breathe-U)** | 🟢 Hoạt động | 🟢 Hoạt động | 🟢 Hoạt động | Giao diện chuẩn mobile-first, hoạt động hoàn hảo trên cả 3 nền tảng. |

---

## 2. Bóc tách chi tiết các tính năng "Gộp / Combined" trong hệ thống

Nhằm tránh hiểu nhầm, dưới đây là định nghĩa và thành phần chính xác của từng tính năng gộp:

### 2.1. Hợp nhất Cửa Hàng Sen (`Consolidated Store`)
- **Tệp nguồn PC:** [app/new-pay/page.tsx](file:///c:/Users/hoang/Downloads/senexam-web-main/app/new-pay/page.tsx)
- **Tệp nguồn Mobile:** [app/m/pay/page.tsx](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/pay/page.tsx)
- **Nội dung gộp:** Trước đây hệ thống có 5 trang bán lẻ rải rác (`/vip`, `/sencash`, `/senai`, `/codes`, `/exclusive-store`). Bản cập nhật đã gộp thành 1 cổng thanh toán duy nhất với 5 Tab:
  1. *Tab Gói VIP:* Bảng giá các gói hội viên (VIP, Premium, Premium Plus, Sen One, Sen One Lite, Lite).
  2. *Tab Ví:* Quản lý nạp tiền và theo dõi số dư ví.
  3. *Tab SenAI:* Bảng giá nâng cấp hạn mức hỏi bài Trợ lý AI (Basic, Pro, Master, VIP, Unlimited).
  4. *Tab Mã Quà (GiftCode):* Nhập mã nhận quà/khuyến mãi.
  5. *Tab Deal Hot (Exclusive):* Các vật phẩm ưu đãi giới hạn thời gian.

### 2.2. Hợp nhất Sen Ground (`Consolidated Sen Ground`)
- **Tệp nguồn PC:** [app/new-sen-ground/page.tsx](file:///c:/Users/hoang/Downloads/senexam-web-main/app/new-sen-ground/page.tsx)
- **Tệp nguồn Mobile:** [app/m/sen-ground/page.tsx](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/sen-ground/page.tsx)
- **Nội dung gộp:** Gộp 4 phân hệ khảo thí và quản lý đề thi thành 1 trang duy nhất:
  1. *Tab Kho Đề:* Tập trung toàn bộ đề thi chính thức, khảo thí thử, đề thi các trường.
  2. *Tab Soạn Đề:* Soạn đề trắc nghiệm chuẩn KaTeX, OCR từ ảnh, tạo đề SEB (chỉ bật trên PC).
  3. *Tab Tuyển Tập:* Gom nhiều đề thi lại theo từng môn học.
  4. *Tab Thư Viện:* Kho tài liệu PDF, chuyên đề ôn thi.
  5. *Tab Lịch Sử:* Bảng điểm, tiến độ và các bài thi đã hoàn thành của thí sinh.

### 2.3. Tuyển tập đề thi gộp theo môn (`Exam Collections`)
- **Tệp nguồn:** [lib/examCollectionStore.ts](file:///c:/Users/hoang/Downloads/senexam-web-main/lib/examCollectionStore.ts)
- **Nội dung gộp:** Cho phép giáo viên/quản trị viên gom nhiều mã đề (`exam_ids`) vào 1 gói tuyển tập chuyên đề (VD: "Bộ 10 đề then chốt Toán 2026"). Khi học sinh vào tuyển tập, hệ thống điều hướng thi lần lượt từng đề mà không cần quay lại tìm kiếm.

### 2.4. Đề thi gộp 1 phần (VNU TEST)
- **Tệp nguồn:** [app/components/VnuTestExamRoom.tsx](file:///c:/Users/hoang/Downloads/senexam-web-main/app/components/VnuTestExamRoom.tsx)
- **Nội dung gộp:** Khác với đề thi HSA bị chia cứng làm 3 phần độc lập (mỗi phần 50 câu, không thể quay lại phần trước), đề thi VNU TEST gộp toàn bộ câu hỏi thành **1 phần duy nhất**, thí sinh có thể tự do điều hướng và làm bài từ đầu đến cuối trong thời gian tự chọn.

---

## 3. Khảo sát chuyên sâu Capacitor Android (`me.senexam.app`)

1. **Cấu hình Capacitor hiện tại:**
   - [capacitor.config.ts](file:///c:/Users/hoang/Downloads/senexam-web-main/capacitor.config.ts):
     - `appId`: `me.senexam.app`
     - `appName`: `SenExam`
     - `server.url`: `https://www.senexam.me` (Chế độ Server URL Webview).
2. **Các điểm tồn đọng cần xử lý trên Android ở P3:**
   - *Nút Back vật lý:* Khi thí sinh bấm nút Back cứng của điện thoại Android trong phòng thi, Webview mặc định điều hướng ngược lại làm mất trạng thái bài thi. Cần listener `App.addListener('backButton', ...)` để chặn và hiện thông báo xác nhận.
   - *Tải tệp PDF trong Webview:* Android Webview không tự động kích hoạt Download Manager khi bấm thẻ `<a>` có thuộc tính `download`. Cần hỗ trợ mở URL qua trình duyệt mặc định hoặc Plugin Filesystem.
   - *Bàn phím ảo che mất trường nhập liệu:* Khi nhập câu hỏi điền số, bàn phím Android che khuất nút Nộp bài.
   - *Safe Area (Tai thỏ / Camera nốt ruồi):* Cần xử lý CSS `env(safe-area-inset-top)` để Header không bị chèn vào camera.

---

## 4. Kế hoạch đề xuất cho Giai đoạn P2 (Tách tiền tệ SC khỏi Mobile)

1. **Giao diện Mobile (`/m/pay`):**
   - Loại bỏ hoàn toàn nhãn `SC`, thay thế 100% bằng `SCm` (Cash Mobile).
   - Bảng giá gói SenAI trên Mobile sẽ hiển thị theo SCm (Ví dụ: 145 SCm thay vì 29 SC).
   - Nạp tiền trên Mobile gọi endpoint chuyên biệt `/api/scm/create-topup-order` hoặc cờ `wallet: 'mobile'`, ghi nhận trực tiếp vào `scm_balance`.
2. **Server-side Security:**
   - Endpoint trừ tiền mobile sẽ kiểm tra nghiêm ngặt `scm_balance` thông qua RPC `adjust_scm_balance` (đã có trong `supabase/mobile_sync.sql`), khóa dòng `SELECT FOR UPDATE` để chống race condition.
   - Máy chủ từ chối trừ `sencash_balance` nếu yêu cầu xuất phát từ ngữ cảnh client Mobile.
3. **Tính an toàn tuyệt đối:**
   - Toàn bộ 29 người dùng hiện tại đều có số dư SCm = 0. Do đó việc triển khai ở P2 không có bất kỳ rủi ro nào về mất mát số dư cũ của người dùng.
