# CHANGELOG - SenExam Platform

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.2.0] - 2026-11-20

### 🚀 Tính Năng Mới (Features)
- ccc7bcc feat(chat): implement P7 Mobile web and Android Capacitor for Sen Chat
- 1d1f192 feat(chat): implement P6 SenAI (@Sen) chat integration with E2EE disclosure, quota & KaTeX/TikZ
- 005083e feat(chat): implement P5 voice messages and speech-to-text with on-device Whisper & server fallback
- d431701 feat(chat): implement P4 chunked e2ee file attachments with google drive integration
- 9804236 feat(chat): implement P3 MLS RFC 9420 email group chat with key rotation and role RLS
- e9520fe feat(chat): implement P2 3-column UI, friend request flow, disappearing messages and security headers
- 54d6e3c feat(chat): implement P1 E2EE Signal protocol architecture, schema migrations and RLS
- eb4638c feat(ui): optimize mobile non-exam usability touch targets contrast and empty states
- 2788205 feat(mobile): complete p3 parity with review page, hsa mobile drawer, capacitor back button and safe download
- c5a1c0e feat(mobile): separate scm wallet from pc sencash with ledger and isolation guards
- a970e5a feat(db): automate and execute all supabase migrations with tracking table

### 🐛 Sửa Lỗi & Bảo Mật (Fixes & Security)
- 9d1d178 fix(chat): patch PIN length verification, browser Buffer crash, offline queue auto-drain, and safe-area insets
- de6a1f7 fix(chat): patch E2EE zero-context leak, input retention, realtime SenAI routing, and prompt injection tag escaping
- 8579245 fix(chat): wire Bearer auth for STT & voice attachments, unnest message bubble, and improve Gemini STT parser
- ffebdb5 fix(chat): close ternary expression in chat input bar for clean build
- 7fb408c fix(chat): stream chunked e2ee crypto, drive stream retry, and account deletion cleanup
- 406149b fix(chat): wire MLS RPC auth dispatch, Bearer token headers, and cryptographic group commits
- f25243b fix(dashboard): bind web version display to APP_VERSION and add migration runner
- 8430c4a security(exam): patch indirect answer leak, duplicate submit idempotency, and admin authorization

### ⚡ Tối Ưu Hiệu Năng (Performance)
- d51cdef perf(exam-rooms): isolate countdown timer re-renders and headless engine architecture

## [2.1.0] - 2026-11-18

### 🚀 Tự Động Hóa Phiên Bản (Automated SemVer Engine)
- **Chuẩn hóa SemVer:** Chuyển đổi chính thức sang chuẩn Semantic Versioning (`MAJOR.MINOR.PATCH`). Bản `2.0.2194023.10599.01` được ghi nhận là mốc lịch sử; bản chuẩn kế tiếp là `2.1.0`.
- **Nguồn sự thật duy nhất (Single Source of Truth):** Thiết lập `lib/version.ts` xuất bản quyền phiên bản từ `package.json`. Loại bỏ hoàn toàn việc gõ tay phiên bản ở các tệp tin giao diện di động `app/m/*`.
- **Động cơ phát hành tự động:** Viết `scripts/release.mjs` phân tích Conventional Commits (`feat`, `fix`, `perf`, `security`, `breaking change`) để tự động nâng phiên bản, sinh `RELEASE_NOTES.md` và gắn git tag.
- **Commitlint & Git Hook:** Bổ sung `scripts/verify-commit-msg.mjs` và hook `.git/hooks/commit-msg` để từ chối commit sai quy ước.

### 🛡️ Nâng Cao Độ Bền Hệ Thống Khảo Thí (Resilience & Edge Cases)
- **Xử lý mất mạng giữa chừng:** Cơ chế lưu nháp ngoại tuyến (Offline Draft Protection) tự động giữ bài thi trong `localStorage` và đồng bộ qua API ngay khi kết nối mạng phục hồi (`online` event).
- **Phát hiện đa tab đồng thời:** Cảnh báo và đồng bộ trạng thái khi thí sinh mở cùng một đề thi trên hai tab hoặc cửa sổ khác nhau.
- **Chống sai lệch đồng hồ máy khách (Clock Drift Guard):** Tính toán thời gian làm bài độc lập với đồng hồ hệ điều hành của thí sinh, ngăn chặn hiện tượng chỉnh lùi giờ để gian lận.
- **Chuẩn hóa chuỗi Tiếng Việt (Unicode NFC Normalization):** Tự động chuẩn hóa dấu thanh, khoảng trắng thừa và ký tự đặc biệt khi chấm điểm các câu hỏi trả lời ngắn.

### ⚡ Tối Ưu Hiệu Năng & Trải Nghiệm (Performance & Core Web Vitals)
- **Tối ưu hóa tài nguyên:** Thiết lập preconnect tới Supabase API, font-display `swap`, nén Brotli/Gzip, loại bỏ CSS/JS chặn render.
- **Tối ưu Accessibility & SEO:** Khai báo chuẩn `lang="vi"`, bổ sung metadata OpenGraph, Twitter Card, robot tags và hỗ trợ điều hướng bàn phím.
- **Lighthouse CI & Performance Budget:** Cấu hình `.lighthouserc.json` và tài liệu theo dõi `PERF_REPORT.md`.

---

## [2.0.2194023.10599.01] - 2026-11-18 (Mốc Lịch Sử Kiểm Toán Toàn Diện)

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
