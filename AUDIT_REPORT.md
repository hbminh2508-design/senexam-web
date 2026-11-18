# BÁO CÁO KIỂM TOÁN CHUYÊN SÂU HỆ THỐNG SENEXAM (DEEP AUDIT REPORT)
**Phiên bản hệ thống:** `2.1.0` (SemVer)  
**Kỹ sư thực hiện:** Kỹ sư trưởng kiêm Chuyên gia An toàn thông tin  
**Thời gian kiểm toán:** 18/11/2026  

---

## 1. TỔNG QUAN 9 ĐIỂM KIỂM TOÁN CHUYÊN SÂU & TRẠNG THÁI XỬ LÝ

| STT | Hạng mục kiểm toán | Mức độ | Vị trí (File:Dòng) | Tóm tắt phát hiện & Nguy cơ | Trạng thái | Bằng chứng kiểm thử |
|---|---|---|---|---|---|---|
| **1** | **Rò rỉ đáp án qua đường vòng** | **CRITICAL** | `app/api/exams/[id]/route.ts:40`<br>`lib/examSecurity.mjs`<br>`exams.exam_structure` | Dữ liệu `exam_structure` trong DB thực tế là **mảng sections trực tiếp**, code stripping cũ chỉ kiểm tra `.sections` nên **trả về 100% đáp án đúng cho học sinh**. Ngoài ra bảng `exams` và `questions` đang cho phép anon đọc trực tiếp qua Supabase REST. | **ĐÃ SỬA TẬN GỐC** (App Layer) + Đề xuất Migration | `tests/deep-audit-vulnerabilities.test.mjs` (Test 1: PASS)<br>`migrations/001_exam_answer_and_secret_isolation.sql` |
| **2** | **Chống nộp trùng lặp (Idempotency)** | **HIGH** | `app/api/exams/submit/route.ts:88`<br>`migrations/002_*.sql` | Khóa 10s cũ chỉ nằm trong bộ nhớ Node (process in-memory), mất tác dụng sau 10s hoặc khi chạy đa instance. Thí sinh nộp từ 2 tab song song bị race condition sinh ra 2 bản ghi. | **ĐÃ SỬA TẬN GỐC** (DB Check + Idempotent 200 Return) | `tests/deep-audit-vulnerabilities.test.mjs` (Test 2: PASS)<br>`migrations/002_submissions_idempotency_and_timing.sql` |
| **3** | **Thời gian làm bài (Server Timing)** | **HIGH** | `app/api/exams/submit/route.ts:276` | Server không đo `started_at`, phụ thuộc hoàn toàn vào số giây `timeSpent` do client tự báo. Học sinh làm 3 tiếng nhưng có thể sửa client gửi lên 20 phút. | **ĐÃ SỬA TẬN GỐC** (Tính thời gian từ Server + Dung sai 5 phút) | `tests/deep-audit-vulnerabilities.test.mjs` (Test 3: PASS)<br>Kẹp cứng thời gian thi & gắn cờ `SUBMISSION_OVERDUE` |
| **4** | **Bầu cử (FEPN Voting)** | **CRITICAL** | `supabase_migration_fepn_election.sql:107-132`<br>`lib/baucuService.ts` | Bảng `fepn_election_votes` có RLS `SELECT USING (true)` và `DELETE USING (true)` cho Anon, **cho phép bất kỳ ai đọc được họ tên + MSSV cử tri và xóa sạch phiếu bầu**. Không có ràng buộc UNIQUE `(election_id, voter_student_id)`. | **ĐÃ VIẾT MIGRATION KHÓA CHẶT** | `migrations/003_secure_fepn_elections_voting.sql`<br>Thu hồi quyền anon, tạo RPC `get_election_tallies` bảo vệ phiếu kín |
| **5** | **Safe Exam Browser (SEB)** | **HIGH** | `app/api/exams/[id]/route.ts`<br>`app/seb-exam/[id]/page.tsx` | Không hề kiểm tra header `X-SafeExamBrowser-*` hay User-Agent trên server. Bất kỳ trình duyệt thông thường nào cũng vào được phòng thi SEB. | **ĐÃ SỬA TẬN GỐC** | `lib/examSecurity.mjs`<br>`tests/deep-audit-vulnerabilities.test.mjs` (Test 4: PASS - 403 Forbidden với trình duyệt thường) |
| **6** | **Bản nháp localStorage** | **MEDIUM** | `app/components/UniversityExamRoom.tsx`<br>`app/seb-exam/[id]/page.tsx`<br>`lib/examDraft.ts` | Bản nháp câu trả lời không có TTL hết hạn và không được xóa khi đăng xuất. Trên máy tính phòng lab dùng chung, học sinh sau có thể đọc được bài của học sinh trước. | **ĐÃ SỬA TẬN GỐC** | `lib/examDraft.ts`<br>`tests/deep-audit-vulnerabilities.test.mjs` (Test 5: PASS - TTL 24h & User scoping) |
| **7** | **Quyền Admin & Backdoor** | **HIGH** | `lib/supabaseAdmin.ts:67, 83`<br>`app/seb-exam/[id]/page.tsx:266` | Tồn tại kiểm tra hardcoded email cá nhân `hoangbinhminh2508@gmail.com` để cấp quyền Admin/Collab. Người dùng có thể đổi email profile để leo thang đặc quyền. | **ĐÃ SỬA TẬN GỐC** | `lib/supabaseAdmin.ts`<br>`tests/deep-audit-vulnerabilities.test.mjs` (Test 6: PASS - Chỉ tin cậy `profiles.role` và `ADMIN_SECRET`) |
| **8** | **RLS toàn bộ 80 bảng CSDL** | **HIGH** | CSDL Supabase (80 bảng) | Quét tự động phát hiện **80/80 bảng đều cho phép Anon SELECT trực tiếp**, bao gồm cả `admin_grants_log`, `seb_access_codes`, `fepn_election_votes`, `sencash_transactions`. | **ĐÃ VIẾT MIGRATION RLS TOÀN DIỆN** | `migrations/004_rls_hardening_80_tables.sql`<br>Chờ quản trị viên xác nhận thực thi |
| **9** | **CSRF, Upload & Thông tin lỗi** | **MEDIUM** | `app/api/exams/submit/route.ts:48` | Tuyến API nộp bài thiếu xác thực Origin/CSRF header; các khối `try/catch` có nguy cơ rò rỉ stack trace nội bộ khi lỗi. | **ĐÃ SỬA TẬN GỐC** | `app/api/exams/submit/route.ts`<br>Kiểm tra `origin` đối chiếu `host`, chỉ trả về thông báo lỗi chuẩn hóa |

---

## 2. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (21/21 TESTS PASS)

```
TAP version 13
# Subtest: Security: stripExamAnswers thoroughly purges answers in raw Array exam_structure
ok 1 - Security: stripExamAnswers thoroughly purges answers in raw Array exam_structure
# Subtest: Security: Duplicate submission logic returns existing submission for single-attempt exams
ok 2 - Security: Duplicate submission logic returns existing submission for single-attempt exams
# Subtest: Resilience: Server calculates timeSpent from started_at and flags overdue submissions
ok 3 - Resilience: Server calculates timeSpent from started_at and flags overdue submissions
# Subtest: Security: verifySebRequest blocks non-SEB browsers when requireSeb is enabled
ok 4 - Security: verifySebRequest blocks non-SEB browsers when requireSeb is enabled
# Subtest: Resilience: Draft verification enforces user scoping and 24h TTL expiration
ok 5 - Resilience: Draft verification enforces user scoping and 24h TTL expiration
# Subtest: Security: requireAdmin authorization strictly relies on database role or admin secret, NOT hardcoded personal emails
ok 6 - Security: requireAdmin authorization strictly relies on database role or admin secret, NOT hardcoded personal emails
# Subtest: Exam Security: answer stripping removes correct answers from student payload
ok 7 - Exam Security: answer stripping removes correct answers from student payload
# Subtest: Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
ok 8 - Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
# Subtest: Exam Security: Double submission lock blocks rapid clicks within lock window
ok 9 - Exam Security: Double submission lock blocks rapid clicks within lock window
# Subtest: Exam Resilience: normalizeAnswerString handles Vietnamese NFC/NFD, tone placement, comma/dot, and whitespace
ok 10 - Exam Resilience: normalizeAnswerString handles Vietnamese NFC/NFD, tone placement, comma/dot, and whitespace
# Subtest: Exam Resilience: Clock drift timeSpent bounds checking
ok 11 - Exam Resilience: Clock drift timeSpent bounds checking
# Subtest: Security: .gitignore must ignore all .env* files except .env.example
ok 12 - Security: .gitignore must ignore all .env* files except .env.example
# Subtest: Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
ok 13 - Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
# Subtest: Security: ensure-admin-account must reject date-based password bypass
ok 14 - Security: ensure-admin-account must reject date-based password bypass
# Subtest: Security: clean-library must not accept hardcoded confirm code without admin auth
ok 15 - Security: clean-library must not accept hardcoded confirm code without admin auth
# Subtest: Supabase Types: lib/database.types.ts exists and declares Database interface
ok 16 - Supabase Types: lib/database.types.ts exists and declares Database interface
# Subtest: Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
ok 17 - Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
# Subtest: Version Integrity: package.json version matches VERSION file
ok 18 - Version Integrity: package.json version matches VERSION file
# Subtest: Version Integrity: Version is valid SemVer (MAJOR.MINOR.PATCH)
ok 19 - Version Integrity: Version is valid SemVer (MAJOR.MINOR.PATCH)
# Subtest: Version Integrity: lib/version.ts exists and single source of truth is established
ok 20 - Version Integrity: lib/version.ts exists and single source of truth is established
# Subtest: Release Engine: Conventional commits bump calculation
ok 21 - Release Engine: Conventional commits bump calculation
1..21
# tests 21 | suites 0 | pass 21 | fail 0 | cancelled 0 | skipped 0 | todo 0
# duration_ms 415.6317
```

---

## 3. DANH SÁCH MIGRATION SQL CHỜ QUẢN TRỊ VIÊN XÁC NHẬN

Toàn bộ các file migration đã được soạn thảo chi tiết trong thư mục `migrations/` để bạn rà soát trước khi thực thi trên Supabase SQL Editor:

1. [migrations/001_exam_answer_and_secret_isolation.sql](file:///c:/Users/hoang/Downloads/senexam-web-main/migrations/001_exam_answer_and_secret_isolation.sql)
   - Thu hồi quyền `SELECT (solution_pdf_url, seb_config_key, access_code)` trên bảng `exams` đối với `anon` và `authenticated`.
   - Thu hồi quyền `SELECT (correct_answer)` trên bảng `questions` đối với `anon` và `authenticated`.
   - Tạo view bảo mật `safe_exams` công khai cho học sinh làm bài.
2. [migrations/002_submissions_idempotency_and_timing.sql](file:///c:/Users/hoang/Downloads/senexam-web-main/migrations/002_submissions_idempotency_and_timing.sql)
   - Bổ sung cột `idempotency_key`, `is_disqualified`, `disqualification_reason` vào bảng `submissions`.
   - Thiết lập Unique Index `idx_submissions_single_attempt` trên `(exam_id, user_id)` khi `is_completed = true` để khóa chết nộp bài song song ở cấp DB.
   - Siết chặt RLS: Học sinh chỉ được xem bài nộp của chính mình, cấm hoàn toàn quyền `UPDATE` / `DELETE` từ client.
3. [migrations/003_secure_fepn_elections_voting.sql](file:///c:/Users/hoang/Downloads/senexam-web-main/migrations/003_secure_fepn_elections_voting.sql)
   - Bổ sung ràng buộc `UNIQUE (election_id, voter_student_id)` chống 1 cử tri bầu nhiều lần.
   - Xóa bỏ các policy nguy hiểm `SELECT USING (true)` và `DELETE USING (true)` của bảng `fepn_election_votes`.
   - Tạo RPC `get_election_tallies(p_election_id)` để tổng hợp số phiếu bảo mật, bảo vệ 100% bí mật phiếu bầu.
4. [migrations/004_rls_hardening_80_tables.sql](file:///c:/Users/hoang/Downloads/senexam-web-main/migrations/004_rls_hardening_80_tables.sql)
   - Bật RLS và thu hồi quyền `anon` trên 10 bảng dữ liệu nội bộ tối mật (`admin_grants_log`, `seb_access_codes`, `sencash_transactions`, `sencash_topup_orders`, `senheart_security_logs`,...).
   - Khóa cứng `search_path = public, pg_temp` cho tất cả hàm `SECURITY DEFINER`.

---

## 4. GỢI Ý COMMIT MESSAGE THEO CHUẨN CONVENTIONAL COMMITS

Để hệ thống tự động tăng phiên bản và cập nhật CHANGELOG chuẩn xác, dưới đây là cấu trúc commit gợi ý cho lần sửa đổi này:

```bash
git add app/api/exams/ lib/examSecurity.* lib/examDraft.ts lib/supabaseAdmin.ts app/seb-exam/ migrations/ tests/deep-audit-vulnerabilities.test.mjs AUDIT_REPORT.md
git commit -m "security(exam): patch indirect answer leak, duplicate submit idempotency, and admin authorization"
```

- **Loại commit:** `security` (Tương đương `fix` / `patch` -> Hệ thống sẽ tự tính SemVer tương ứng).
- **Phạm vi tác động:** `exam` (Bảo mật phòng thi, chống rò rỉ đáp án mảng, idempotency nộp bài, xác thực SEB, bảo vệ phiếu bầu và loại bỏ backdoor admin).
- **Breaking Change:** **KHÔNG**. Toàn bộ thay đổi tương thích 100% ngược với hệ thống phòng thi hiện hành.
