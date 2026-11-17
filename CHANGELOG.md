# CHANGELOG - SenExam Platform

All notable changes to this project will be documented in this file.

## [2.0.2194023.10599.01] - 2026-11-18

### 🛡️ Bảo Mật & Xác Thực (Security & Auth Hardening)
- **Vá lỗ hổng Critical [CRITICAL-01]:** Loại bỏ hoàn toàn các chuỗi Base64 nhúng cứng chứa khóa bí mật Service Role (`sb_secret_...`) và Publishable Key (`sb_publishable_...`) trong `lib/supabaseAdmin.ts` và `lib/supabaseClient.ts`.
- **Vá lỗ hổng Critical [CRITICAL-02]:** Xóa bỏ triệt để cửa sau xác thực Admin theo ngày (`admin-d/m/y`) trong `app/api/admin/ensure-admin-account/route.ts`. Bắt buộc phải có `ADMIN_SECRET` tối thiểu 16 ký tự hoặc phiên quản trị viên đã đăng nhập.
- **Vá lỗ hổng Critical [CRITICAL-03]:** Loại bỏ hoàn toàn mật khẩu PostgreSQL nội bộ hardcoded trong `lib/db.ts`, `scripts/migrate-to-azure.js`, và `scripts/sync-emails.js`.
- **Vá lỗ hổng High [HIGH-01]:** Loại bỏ lỗ hổng mã xác nhận cứng `CONFIRM_CLEAN_SENEXAM_LIBRARY_2026` trong `app/api/admin/clean-library/route.ts`; bắt buộc phải có phân quyền `requireAdmin`.
- **Chuẩn hóa biến môi trường:** Cập nhật `.gitignore` loại trừ triệt để `.env*` (ngoại lệ `.env.example`). Tạo `.env.example` chuẩn hóa tên biến.

### 📝 Hệ Thống Khảo Thí & Phòng Thi (Exams & Exam Rooms)
- **Che giấu đáp án đúng (Answer Stripping):** Tạo API `/api/exams/[id]` tự động lọc bỏ toàn bộ `correctAnswers`, `correctAnswer`, `solution_pdf_url`, `explanation` trước khi trả dữ liệu đề thi về máy thí sinh.
- **Chấm điểm độc quyền tại Server (Server-side Grading):** Tạo API `/api/exams/submit` thực hiện chấm điểm theo barem chính thức của Bộ GD&ĐT (Trắc nghiệm ABCD, Đúng/Sai tỷ lệ 10%-25%-50%-100%, Trả lời ngắn chuẩn hóa số).
- **Chống nộp bài hai lần (Double-submission Lock):** Áp dụng cơ chế khóa Idempotency 10 giây ngăn chặn race condition khi học sinh bấm nộp bài liên tục hoặc mạng chập chờn.
- **Khôi phục bản nháp offline:** Hỗ trợ lưu nháp vào `localStorage` và tự động gửi lên server khi khôi phục mạng.

### 🧪 Kiểm Thử & Kiểm Soát Chất Lượng (Quality & Automation)
- **Tích hợp bộ kiểm thử tự động:** Thêm script `npm test` sử dụng Node 22 test runner bản địa, bao gồm 9 bài kiểm tra bảo mật, chấm điểm thi và kết nối Supabase.
- **Tập trung hóa công cụ chẩn đoán Supabase:** Viết `scripts/check-supabase.mjs` kiểm tra độ trễ và tính sẵn sàng của Anon Client, Admin Client và Auth Gateway.
- **Bộ ghi log có cấu trúc:** Bổ sung `lib/logger.ts` hỗ trợ tự động che giấu (redact) các trường nhạy cảm (`password`, `token`, `secret`, `authorization`, `cookie`).
- **Pre-commit Scan:** Thêm `scripts/pre-commit-check.mjs` tự động quét các mẫu chuỗi nhạy cảm trước khi commit.
