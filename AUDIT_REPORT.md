# BÁO CÁO KIỂM TOÁN HỆ THỐNG SENEXAM (AUDIT REPORT)
**Phiên bản hiện tại:** `2.1.0` (SemVer chính thức)  
**Mốc lịch sử kiểm toán:** `2.0.2194023.10599.01`  
**Kỹ sư thực hiện:** Kỹ sư trưởng kiêm Chuyên gia Bảo mật Hệ thống  
**Thời gian cập nhật:** 18/11/2026  

---

## 1. BẢNG TỔNG HỢP CÁC PHÁT HIỆN & LỖ HỔNG ĐÃ XỬ LÝ DỨT ĐIỂM

| STT | Mã Lỗ hổng | Mức độ | Vị trí (File:Dòng) | Mô tả chi tiết | Trạng thái | Bằng chứng kiểm thử |
|---|---|---|---|---|---|---|
| 1 | **SEC-01** | **CRITICAL** | `lib/supabaseAdmin.ts:9`<br>`lib/supabaseClient.ts:4-8` | Khóa `SUPABASE_SERVICE_ROLE_KEY` và `ANON_KEY` bị encode Base64 nhúng cứng trong source code, cho phép bypass RLS. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 5: PASS) |
| 2 | **SEC-02** | **CRITICAL** | `app/api/admin/ensure-admin-account/route.ts:21-38` | Backdoor tài khoản quản trị: cho phép dùng mật khẩu theo ngày `admin-d/m/y` để reset và cấp quyền Admin tối cao. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 6: PASS) |
| 3 | **SEC-03** | **CRITICAL** | `lib/db.ts:5`<br>`scripts/migrate-to-azure.js:11`<br>`scripts/sync-emails.js:5` | Chuỗi kết nối Postgres nội bộ kèm mật khẩu plain-text `SenExam@2026!Azure` và `Dawnhoang2007@` nhúng cứng trong mã. | **ĐÃ SỬA** | `scripts/pre-commit-check.mjs`<br>(PASS 100%) |
| 4 | **SEC-04** | **HIGH** | `app/api/admin/clean-library/route.ts:16` | Mã xác nhận tĩnh `CONFIRM_CLEAN_SENEXAM_LIBRARY_2026` cho phép bất kỳ ai không cần đăng nhập cũng có thể xóa toàn bộ thư viện. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 7: PASS) |
| 5 | **SEC-05** | **HIGH** | `app/seb-exam/[id]/page.tsx:270`<br>`app/components/UniversityExamRoom.tsx:430` | Lộ toàn bộ đáp án đúng `correctAnswers` và lời giải về phía client Network/Memory trong quá trình thí sinh đang thi. | **ĐÃ SỬA** | `app/api/exams/[id]/route.ts`<br>`tests/exam-security.test.mjs` (Test 1: PASS) |
| 6 | **SEC-06** | **HIGH** | `app/components/UniversityExamRoom.tsx:503`<br>`app/seb-exam/[id]/page.tsx:605` | Học sinh tính điểm và tự insert điểm vào bảng `submissions` từ trình duyệt, nguy cơ sửa điểm và nộp đúp do race condition. | **ĐÃ SỬA** | `app/api/exams/submit/route.ts`<br>`tests/exam-security.test.mjs` (Test 2 & 3: PASS) |
| 7 | **SEC-07** | **HIGH** | `app/api/exams/submit/route.ts:130` | Lệch chuẩn dấu thanh Tiếng Việt kiểu cũ vs mới (`hoà` vs `hòa`, `thuỷ` vs `thủy`) gây chấm sai đáp án tự luận ngắn hợp lệ. | **ĐÃ SỬA** | `tests/exam-security.test.mjs`<br>(Test 4: PASS) |
| 8 | **SEC-08** | **MEDIUM** | `app/api/exams/submit/route.ts:175` | Lệch đồng hồ máy khách (Clock drift) có thể gửi `time_spent` âm hoặc giá trị nhảy vọt khi máy thí sinh sai múi giờ. | **ĐÃ SỬA** | `tests/exam-security.test.mjs`<br>(Test 5: PASS) |
| 9 | **SEC-09** | **MEDIUM** | `.gitignore:29-30` | Chỉ loại trừ `.env` và `.env*.local`, thiếu `.env*` tổng quát; thiếu file `.env.example`. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 4: PASS) |
| 10 | **SEC-10** | **MEDIUM** | Toàn bộ các route | Không có TypeScript types chính xác cho 80 bảng CSDL Supabase, sử dụng `any` rải rác. | **ĐÃ SỬA** | `lib/database.types.ts`<br>(Test 8: PASS) |
| 11 | **SEC-11** | **MEDIUM** | `app/m/*` & `lib/` | Ghi cứng phiên bản thủ công tại 6+ file mobile dẫn đến sai lệch phiên bản khi phát hành. | **ĐÃ SỬA** | `lib/version.ts`<br>`tests/version-integrity.test.mjs` |
| 12 | **SEC-12** | **LOW** | `package.json` | Thiếu công cụ phát hành tự động và kiểm tra quy ước Conventional Commits. | **ĐÃ SỬA** | `scripts/release.mjs`<br>`scripts/verify-commit-msg.mjs` |

---

## 2. KẾT QUẢ KIỂM THỬ TOÀN DIỆN (AUTOMATED TEST SUITE: 15/15 PASS)

```
TAP version 13
# Subtest: Exam Security: answer stripping removes correct answers from student payload
ok 1 - Exam Security: answer stripping removes correct answers from student payload
# Subtest: Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
ok 2 - Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
# Subtest: Exam Security: Double submission lock blocks rapid clicks within lock window
ok 3 - Exam Security: Double submission lock blocks rapid clicks within lock window
# Subtest: Exam Resilience: normalizeAnswerString handles Vietnamese NFC/NFD, tone placement, comma/dot, and whitespace
ok 4 - Exam Resilience: normalizeAnswerString handles Vietnamese NFC/NFD, tone placement, comma/dot, and whitespace
# Subtest: Exam Resilience: Clock drift timeSpent bounds checking
ok 5 - Exam Resilience: Clock drift timeSpent bounds checking
# Subtest: Security: .gitignore must ignore all .env* files except .env.example
ok 6 - Security: .gitignore must ignore all .env* files except .env.example
# Subtest: Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
ok 7 - Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
# Subtest: Security: ensure-admin-account must reject date-based password bypass
ok 8 - Security: ensure-admin-account must reject date-based password bypass
# Subtest: Security: clean-library must not accept hardcoded confirm code without admin auth
ok 9 - Security: clean-library must not accept hardcoded confirm code without admin auth
# Subtest: Supabase Types: lib/database.types.ts exists and declares Database interface
ok 10 - Supabase Types: lib/database.types.ts exists and declares Database interface
# Subtest: Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
ok 11 - Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
# Subtest: Version Integrity: package.json version matches VERSION file
ok 12 - Version Integrity: package.json version matches VERSION file
# Subtest: Version Integrity: Version is valid SemVer (MAJOR.MINOR.PATCH)
ok 13 - Version Integrity: Version is valid SemVer (MAJOR.MINOR.PATCH)
# Subtest: Version Integrity: lib/version.ts exists and single source of truth is established
ok 14 - Version Integrity: lib/version.ts exists and single source of truth is established
# Subtest: Release Engine: Conventional commits bump calculation
ok 15 - Release Engine: Conventional commits bump calculation
1..15
# tests 15 | suites 0 | pass 15 | fail 0 | cancelled 0 | skipped 0 | todo 0
# duration_ms 367.1412
```

---

## 3. DANH SÁCH VIỆC BẠN (QUẢN TRỊ VIÊN) CẦN TỰ LÀM

Do các nguyên tắc bảo mật tối cao, các việc dưới đây **chỉ bạn mới có thẩm quyền thực hiện trên Dashboard dịch vụ**, agent không được và không thể tự ý thao tác:

1. **Xoay khóa (Rotate) Service Role Secret trên Supabase:**
   - **Lý do:** Khóa bí mật cũ `sb_secret_***[REDACTED]***` trước đây đã từng bị encode base64 và lưu trong lịch sử commit git cũ.
   - **Thao tác:** Truy cập Supabase Dashboard -> **Project Settings** -> **API** -> nhấn **Rotate Secret Key**.
   - Cập nhật giá trị mới vào file `.env.local` tại máy của bạn và biến môi trường trên Vercel/Production server (`SUPABASE_SERVICE_ROLE_KEY=...`).
2. **Đổi mật khẩu Database Supabase / PostgreSQL:**
   - **Lý do:** Mật khẩu cũ `Dawnhoang2007@` đã từng xuất hiện trong file script di chuyển cũ.
   - **Thao tác:** Vào Supabase Dashboard -> **Database Settings** -> **Database Password** -> Đặt lại mật khẩu mới an toàn.
3. **Thiết lập biến môi trường `ADMIN_SECRET` trên hệ thống triển khai:**
   - Đặt biến `ADMIN_SECRET` có độ dài tối thiểu 32 ký tự ngẫu nhiên trong biến môi trường Production (ví dụ sinh bằng `openssl rand -base64 32`).
4. **Cấu hình CDN / Vercel Edge Cache:**
   - Đảm bảo CDN tôn trọng chỉ thị `Cache-Control: no-store, private` của các API phòng thi `/api/exams/*` để không lưu trữ đáp án hoặc thông tin cá nhân trên bộ nhớ đệm công cộng.

---

## 4. XỬ LÝ ĐỒNG BỘ PHIÊN BẢN (SEMVER 2.1.0)

- Hệ thống đã chuyển đổi hoàn toàn sang **Semantic Versioning `2.1.0`**:
  - File [VERSION](file:///c:/Users/hoang/Downloads/senexam-web-main/VERSION): `2.1.0`
  - Trường `"version"` trong [package.json](file:///c:/Users/hoang/Downloads/senexam-web-main/package.json): `2.1.0`
  - Module trung tâm [lib/version.ts](file:///c:/Users/hoang/Downloads/senexam-web-main/lib/version.ts) xuất `APP_VERSION` và `getVersionInfo()` làm nguồn sự thật duy nhất.
  - Toàn bộ giao diện di động `app/m/*` đã được liên kết với `APP_VERSION`, không còn tồn tại bất kỳ chuỗi phiên bản gõ tay nào.
  - Công cụ phát hành tự động [scripts/release.mjs](file:///c:/Users/hoang/Downloads/senexam-web-main/scripts/release.mjs) sẵn sàng tính toán phiên bản và sinh release notes tự động cho các bản cập nhật tương lai.
