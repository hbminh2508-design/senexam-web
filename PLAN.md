# KẾ HOẠCH KIỂM TOÁN VÀ NÂNG CẤP HỆ THỐNG SENEXAM
**Phiên bản mục tiêu:** `2.0.2194023.10599.01`  
**Nhánh kiểm toán:** `audit/2.0.2194023.10599.01`  
**Vai trò:** Kỹ sư trưởng kiêm Chuyên gia Bảo mật Hệ thống  
**Ngày thực hiện:** 18/11/2026  

---

## 1. KHẢO SÁT HIỆN TRẠNG (GIAI ĐOẠN 0)

### 1.1. Công nghệ & Kiến trúc (Tech Stack)
- **Framework:** Next.js 16.3.5 (App Router, Turbopack, React 19.3.0, React DOM 19.3.0).
- **Styling:** Tailwind CSS 4.3.3, Lucide React, KaTeX/rehype/remark.
- **Mobile runtime:** Capacitor 8.5.2 (Android).
- **Database & Backend Services:** 
  - Supabase (`@supabase/supabase-js` v2.116.0) cho Auth, Postgres, Storage, Realtime.
  - Kết nối Postgres bổ trợ (`pg` v8.23.1) trong `lib/db.ts`.
  - Gemini AI (`@google/genai` v2.23.0, `@google/generative-ai` v0.24.1).
- **Trạng thái Git:**
  - Nhánh hiện tại: `audit/2.0.2194023.10599.01`.
  - Không có file uncommitted tại thời điểm bắt đầu.

### 1.2. Các phân hệ chức năng đã hoàn thành
1. **Thi trực tuyến & Phòng thi (Exam Rooms):**
   - Hỗ trợ các phòng thi: HSA, THPTQG, VNU TEST, University (Portal UET), Chuyên biệt SEB (Safe Exam Browser).
   - Cơ chế Fullscreen, phát hiện rời màn hình, chống gian lận, camera AI (Tensorflow / COCO-SSD).
   - Đồng bộ kết quả và lịch sử thi vào Supabase.
2. **Quản trị thi & Ngân hàng đề:**
   - Upload đề thi (PDF, hình ảnh, LaTeX), OCR đề thi thông minh qua Gemini AI, trích xuất KaTeX.
   - Thư viện đề thi, trộn đề ngẫu nhiên, phân phối mã đề.
3. **Quản lý học tập & Tài chính lớp học (Nộp Quỹ Lớp / FEPN):**
   - Quản lý quỹ, đóng tiền, quét hóa đơn bằng OCR, VietQR, xác thực giao dịch, ghi nhật ký chi tiêu.
4. **Bầu cử trực tuyến (Bầu cử lớp K71P-ME2):**
   - Bầu cử ban cán sự / BCH theo thể lệ quy định.
   - Lưu cache trình duyệt tránh nộp lại, mã hóa xác thực sinh viên.
5. **Giao diện mới (iOS 27 Liquid Glass / Giao diện mới):**
   - Trang `/giaodienmoi` với giao diện kính lỏng, không rung lắc, tối ưu hóa hiển thị.

---

## 2. NHỮNG ĐIỂM THIẾU SÓT & BẤT CẬP ĐÃ XÁC ĐỊNH

1. **Thiếu chuẩn hóa biến môi trường (`.env`):**
   - Chưa có file `.env.example` mẫu.
   - `.gitignore` chỉ loại trừ `.env` và `.env*.local`, chưa bao quát toàn bộ pattern `.env*` khiến nguy cơ commit lọt biến môi trường cao.
2. **Thiếu bộ test tự động:**
   - `package.json` chưa có cấu hình script `test`.
   - Chưa có unit test / regression test kiểm tra các hàm nghiệp vụ trọng yếu (tính điểm, chống nộp đúp, phân quyền admin, tạo VietQR, TOTP/OTP).
3. **Type Supabase viết tay:**
   - Chưa có file type tập trung `database.types.ts` đồng bộ định dạng bảng dữ liệu.
4. **Xử lý lỗi & Giám sát:**
   - Nhiều API route nuốt lỗi (empty `catch {}`), ghi log thiếu ngữ cảnh hoặc in chi tiết kỹ thuật ra response.
   - Chưa có script kiểm tra kết nối Supabase độc lập cho kỹ sư/quản trị viên chạy kiểm tra nhanh.

---

## 3. CÁC PHÁT HIỆN ĐÁNG NGỜ & LỖ HỔNG BẢO MẬT (SUSPICIOUS FINDINGS)

### [CRITICAL-01] Khóa Service Role Bí mật bị mã hóa Base64 và nhúng cứng trong mã nguồn
- **Vị trí:** `lib/supabaseAdmin.ts` (dòng 9), `lib/supabaseClient.ts` (dòng 4-8).
- **Mô tả:** Khóa bí mật `sb_secret_...` và publishable key `sb_publishable_...` được base64 encode thành `DEFAULT_KEY` và `DEFAULT_ANON`. Nếu biến môi trường không được đặt, ứng dụng sử dụng khóa này. Khóa này có quyền bypass toàn bộ Row Level Security (RLS).
- **Hành động:** Loại bỏ hoàn toàn chuỗi fallback khỏi mã nguồn; yêu cầu nạp qua biến môi trường; đưa khuyến cáo xoay khóa (rotate key) vào `AUDIT_REPORT.md`.

### [CRITICAL-02] Cửa sau xác thực Admin theo ngày (Date-based Admin Auth Bypass)
- **Vị trí:** `app/api/admin/ensure-admin-account/route.ts` (dòng 21-38).
- **Mô tả:** Cho phép tạo hoặc reset mật khẩu tài khoản quản trị bằng chuỗi đoán được theo ngày: `admin-d/m/y` (ví dụ `admin-18/11/2026`). Bất kỳ ai cũng có thể chiếm đoạt tài khoản Admin tối cao!
- **Hành động:** Xóa bỏ hoàn toàn định dạng theo ngày. Bắt buộc xác thực bằng `ADMIN_SECRET` ngẫu nhiên có độ dài tối thiểu 32 ký tự hoặc Bearer token admin hiện hành.

### [CRITICAL-03] Mật khẩu Cơ sở dữ liệu Postgres cục bộ bị nhúng cứng
- **Vị trí:** `lib/db.ts` (dòng 5), `scripts/migrate-to-azure.js` (dòng 11).
- **Mô tả:** Chuỗi kết nối Postgres `postgresql://senexam_admin:SenExam%402026%21Azure@localhost:5432/senexam_db` bị hardcode trong source.
- **Hành động:** Loại bỏ fallback mật khẩu cứng, chỉ chấp nhận qua `process.env.DATABASE_URL`.

### [HIGH-01] Rò rỉ đáp án trắc nghiệm về phía Client khi làm bài thi
- **Vị trí:** Các API và luồng lấy câu hỏi thi (`app/api/upload-exam/route.ts`, `app/api/seb/folder-exams/route.ts`, các store client).
- **Mô tả:** Nếu câu hỏi được trả về chứa `correctAnswer` hoặc `explanation` trước khi học sinh nộp bài, học sinh có thể dùng DevTools/Network tab để xem trước đáp án.
- **Hành động:** Lọc bỏ trường `correctAnswer`, `answer`, `explanation` ở server-side trước khi truyền đề thi cho thí sinh; chỉ trả về khi đã nộp bài hoặc qua API chấm điểm riêng biệt.

### [HIGH-02] Nguy cơ nộp bài hai lần (Double Submission / Race Condition)
- **Vị trí:** Luồng nộp bài và ghi nhận kết quả thi.
- **Mô tả:** Khi kết nối chập chờn, học sinh bấm nộp nhiều lần hoặc gửi request đồng thời có thể gây ghi nhận nhiều bản ghi submission, sai lệch điểm và thống kê.
- **Hành động:** Áp dụng Idempotency key hoặc cơ chế khóa trạng thái (optimistic locking / unique constraint theo `exam_id` + `user_id` + `attempt`).

---

## 4. KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT (ACTION PLAN)

### Nhóm Commit 1: Cấu hình biến môi trường & Bảo mật khóa Supabase (Giai đoạn 1)
- [ ] Cập nhật `.gitignore` loại trừ triệt để `.env*` và cho phép ngoại lệ duy nhất `.env.example`.
- [ ] Tạo `.env.example` chuẩn hóa, không chứa giá trị nhạy cảm.
- [ ] Dọn sạch toàn bộ hardcoded key, fallback base64 trong `lib/supabaseAdmin.ts`, `lib/supabaseClient.ts`, `lib/db.ts`.
- [ ] Viết script chẩn đoán kết nối Supabase `scripts/check-supabase.mjs`.
- [ ] Commit 1: `fix(security): sanitize supabase credentials, enforce env isolation and add health check script`

### Nhóm Commit 2: Vá lỗ hổng Xác thực Admin & Cửa sau bảo mật (Giai đoạn 3)
- [ ] Khắc phục triệt để backdoor đoán mật khẩu theo ngày trong `app/api/admin/ensure-admin-account/route.ts`.
- [ ] Kiểm tra và bảo vệ tất cả endpoint trong `app/api/admin/*` đảm bảo phải qua `requireAdmin(request)`.
- [ ] Xóa bỏ hardcoded connection string trong `lib/db.ts` và các file liên quan.
- [ ] Commit 2: `fix(auth): eliminate date-based admin backdoor and harden admin route permissions`

### Nhóm Commit 3: Bảo vệ Đề thi & Phòng thi (Giai đoạn 2 & 3)
- [ ] Đảm bảo cơ chế stripping đáp án đúng trước khi gửi câu hỏi tới phòng thi của học sinh.
- [ ] Xử lý chống nộp bài hai lần (Double Submit Guard) trong luồng thi.
- [ ] Đồng bộ hóa cơ chế lưu bài thi offline / cache chống mất dữ liệu khi mất mạng đột ngột.
- [ ] Commit 3: `fix(exams): mask exam answers from client payloads and add double-submission prevention`

### Nhóm Commit 4: Bộ kiểm thử tự động & Logging chuẩn hóa (Giai đoạn 5)
- [ ] Bổ sung script `npm test` sử dụng `node --test` của Node 22 native.
- [ ] Viết unit tests kiểm tra:
  - Tính năng bảo mật (chặn backdoor admin, từ chối không có token, chặn rò rỉ đáp án).
  - Nghiệp vụ thi (tính điểm, tính thời gian làm bài).
  - Chống nộp bài hai lần.
  - Chức năng quỹ lớp & bầu cử.
- [ ] Thiết lập hệ thống log có cấu trúc chuẩn, không ghi dữ liệu nhạy cảm.
- [ ] Commit 4: `test: add comprehensive automated test suite and structured error logger`

### Nhóm Commit 5: Cập nhật phiên bản lên `2.0.2194023.10599.01` & Tài liệu kiểm toán
- [ ] Cập nhật file `VERSION` chứa `2.0.2194023.10599.01`.
- [ ] Giữ `package.json` ở dạng 3 phần hợp lệ semver (`2.0.2194023`).
- [ ] Cập nhật hằng số trong code (`lib/systemRelease.ts`, footer, mobile config, about dialog).
- [ ] Viết `AUDIT_REPORT.md` chi tiết kèm khuyến nghị xoay khóa.
- [ ] Viết `CHANGELOG.md` cho bản phát hành `2.0.2194023.10599.01`.
- [ ] Kiểm tra bản build cuối cùng: `npm run build` và chạy toàn bộ test.
- [ ] Commit 5: `chore(release): bump version to 2.0.2194023.10599.01, generate audit report and changelog`
