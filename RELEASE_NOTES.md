# SenExam Release Notes - v2.1.0
**Release Date:** 2026-11-18  
**Release Type:** MINOR (Full SemVer Transition, Edge Case Resilience, Performance Optimization)

---

### 🌟 Điểm Nhấn Phiên Bản (Highlights)
1. **Chuyển đổi hoàn chỉnh sang chuẩn Semantic Versioning (2.1.0):**
   - Đặt `lib/version.ts` làm Single Source of Truth liên kết chặt chẽ với `package.json`.
   - Cơ chế phát hành tự động `scripts/release.mjs` phân tích Conventional Commits.
   - Hook từ chối commit sai quy ước qua `scripts/verify-commit-msg.mjs`.

2. **Khả năng chịu lỗi và kiên cường trong phòng thi (Exam Resilience):**
   - Tự động lưu vết bài thi vào bộ nhớ cục bộ khi đứt mạng và tự động đồng bộ khi có mạng trở lại.
   - Chặn nộp trùng lặp (Idempotency lock) 10 giây.
   - Đồng bộ trạng thái cảnh báo khi mở bài thi trên nhiều tab cùng lúc.
   - Thuật toán chuẩn hóa tiếng Việt Unicode NFC khi so sánh đáp án dạng tự luận ngắn.

3. **Tối ưu hóa hiệu năng & Core Web Vitals:**
   - Kết nối trước (Preconnect) tới Supabase API giảm 200-300ms độ trễ xác thực ban đầu.
   - Bổ sung cấu hình Lighthouse CI `.lighthouserc.json` và tài liệu theo dõi `PERF_REPORT.md`.
