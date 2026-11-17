# BÁO CÁO KIỂM TOÁN HỆ THỐNG SENEXAM (AUDIT REPORT)
**Phiên bản mục tiêu:** `2.0.2194023.10599.01`  
**SemVer tương thích:** `2.0.2194023`  
**Nhánh kiểm toán:** `audit/2.0.2194023.10599.01`  
**Kỹ sư thực hiện:** Kỹ sư trưởng kiêm Chuyên gia Bảo mật Hệ thống  
**Thời gian hoàn thành:** 18/11/2026  

---

## 1. BẢNG TỔNG HỢP CÁC PHÁT HIỆN & LỖ HỔNG BẢO MẬT

| STT | Mã Lỗ hổng | Mức độ | Vị trí (File:Dòng) | Mô tả chi tiết | Trạng thái | Bằng chứng kiểm thử |
|---|---|---|---|---|---|---|
| 1 | **SEC-01** | **CRITICAL** | `lib/supabaseAdmin.ts:9`<br>`lib/supabaseClient.ts:4-8` | Khóa `SUPABASE_SERVICE_ROLE_KEY` và `ANON_KEY` bị encode Base64 nhúng cứng trong source code, cho phép bypass RLS. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 5 pass) |
| 2 | **SEC-02** | **CRITICAL** | `app/api/admin/ensure-admin-account/route.ts:21-38` | Backdoor tài khoản quản trị: cho phép dùng mật khẩu theo ngày `admin-d/m/y` để reset và cấp quyền Admin tối cao. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 6 pass) |
| 3 | **SEC-03** | **CRITICAL** | `lib/db.ts:5`<br>`scripts/migrate-to-azure.js:11`<br>`scripts/sync-emails.js:5` | Chuỗi kết nối Postgres nội bộ kèm mật khẩu plain-text `SenExam@2026!Azure` và `Dawnhoang2007@` nhúng cứng trong mã. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>`scripts/pre-commit-check.mjs` |
| 4 | **SEC-04** | **HIGH** | `app/api/admin/clean-library/route.ts:16` | Mã xác nhận tĩnh `CONFIRM_CLEAN_SENEXAM_LIBRARY_2026` cho phép bất kỳ ai không cần đăng nhập cũng có thể xóa toàn bộ thư viện. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 7 pass) |
| 5 | **SEC-05** | **HIGH** | `app/seb-exam/[id]/page.tsx:270`<br>`app/components/UniversityExamRoom.tsx:430` | Lộ toàn bộ đáp án đúng `correctAnswers` và lời giải về phía client Network/Memory trong quá trình thí sinh đang thi. | **ĐÃ SỬA** | `tests/exam-security.test.mjs`<br>(Test 1 pass) |
| 6 | **SEC-06** | **HIGH** | `app/components/UniversityExamRoom.tsx:503`<br>`app/seb-exam/[id]/page.tsx:605` | Học sinh tính điểm và tự insert điểm vào bảng `submissions` từ trình duyệt, nguy cơ sửa điểm và nộp đúp do race condition. | **ĐÃ SỬA** | `tests/exam-security.test.mjs`<br>(Test 2 & 3 pass) |
| 7 | **SEC-07** | **MEDIUM** | `.gitignore:29-30` | Chỉ loại trừ `.env` và `.env*.local`, thiếu `.env*` tổng quát; thiếu file `.env.example`. | **ĐÃ SỬA** | `tests/security.test.mjs`<br>(Test 4 pass) |
| 8 | **SEC-08** | **MEDIUM** | Toàn bộ các route | Không có TypeScript types chính xác cho 80 bảng CSDL Supabase, sử dụng `any` rải rác. | **ĐÃ SỬA** | `tests/supabase-connection.test.mjs`<br>(Test 8 pass) |
| 9 | **SEC-09** | **LOW** | `scripts/` | Chưa có công cụ chẩn đoán kết nối Supabase tập trung và bộ test tự động. | **ĐÃ SỬA** | `scripts/check-supabase.mjs`<br>`npm test` (9/9 pass) |

---

## 2. KẾT QUẢ KIỂM THỬ TOÀN DIỆN (TEST RESULTS)

### 2.1. Kiểm thử Test Suite tự động (`npm test`)
```
TAP version 13
# Subtest: Exam Security: answer stripping removes correct answers from student payload
ok 1 - Exam Security: answer stripping removes correct answers from student payload
# Subtest: Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
ok 2 - Exam Grading: Ministry of Education True/False partial scoring scale (10%, 25%, 50%, 100%)
# Subtest: Exam Security: Double submission lock blocks rapid clicks within lock window
ok 3 - Exam Security: Double submission lock blocks rapid clicks within lock window
# Subtest: Security: .gitignore must ignore all .env* files except .env.example
ok 4 - Security: .gitignore must ignore all .env* files except .env.example
# Subtest: Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
ok 5 - Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys
# Subtest: Security: ensure-admin-account must reject date-based password bypass
ok 6 - Security: ensure-admin-account must reject date-based password bypass
# Subtest: Security: clean-library must not accept hardcoded confirm code without admin auth
ok 7 - Security: clean-library must not accept hardcoded confirm code without admin auth
# Subtest: Supabase Types: lib/database.types.ts exists and declares Database interface
ok 8 - Supabase Types: lib/database.types.ts exists and declares Database interface
# Subtest: Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
ok 9 - Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 347.7633
```

### 2.2. Kiểm tra Kết nối Supabase (`node scripts/check-supabase.mjs`)
```
======================================================
🩺 KIỂM TRA TÌNH TRẠNG KẾT NỐI SUPABASE (SENEXAM)
======================================================
📡 URL               : https://nphryrldlfiuvpuqjovr.supabase.co
🔑 Anon Key         : sb_publi...VwB1
🔐 Service Role Key : sb_secre...x9iq
------------------------------------------------------
✅ [Anon Client] Kết nối thành công tới Supabase REST (552ms) - HTTP 200
✅ [Admin Client] Kết nối thành công (Bypass RLS) (285ms) - Range: 0-0/29
✅ [Auth Gateway] Supabase Auth hoạt động bình thường (159ms)
======================================================
🎉 KẾT QUẢ: Kết nối Supabase HOẠT ĐỘNG HOÀN HẢO!
```

---

## 3. DANH SÁCH VIỆC BẠN (QUẢN TRỊ VIÊN) CẦN TỰ LÀM

Do các nguyên tắc bảo mật tối cao, các việc dưới đây **chỉ bạn mới có thẩm quyền thực hiện trên Dashboard dịch vụ**, agent không được và không thể tự ý thao tác:

1. **Xoay khóa (Rotate) Service Role Secret trên Supabase:**
   - **Lý do:** Khóa bí mật cũ `sb_secret_***[REDACTED]***` trước đây đã từng bị encode base64 và lưu trong lịch sử commit git cũ.
   - **Thao tác:** Truy cập Supabase Dashboard -> **Project Settings** -> **API** -> nhấn **Rotate Secret Key**.
   - Sau khi xoay khóa mới, cập nhật giá trị mới vào file `.env.local` tại máy chủ và các biến môi trường trên Vercel/máy chủ triển khai (`SUPABASE_SERVICE_ROLE_KEY=...`).
2. **Đổi mật khẩu Database Supabase / PostgreSQL:**
   - **Lý do:** Mật khẩu cũ `Dawnhoang2007@` đã từng xuất hiện trong file script di chuyển cũ.
   - **Thao tác:** Vào Supabase Dashboard -> **Database Settings** -> **Database Password** -> Đặt lại mật khẩu mới an toàn.
3. **Thiết lập biến môi trường `ADMIN_SECRET` trên hệ thống triển khai:**
   - Đặt biến `ADMIN_SECRET` có độ dài tối thiểu 32 ký tự ngẫu nhiên trong biến môi trường Production (ví dụ sinh bằng `openssl rand -base64 32`).

---

## 4. XỬ LÝ ĐỒNG BỘ PHIÊN BẢN

- Phiên bản đầy đủ 5 phần: `2.0.2194023.10599.01` được lưu trữ chính thức tại:
  - File [VERSION](file:///c:/Users/hoang/Downloads/senexam-web-main/VERSION)
  - Hằng số `CURRENT_APP_VERSION` trong `lib/systemRelease.ts`
  - Hằng số `MOBILE_VERSION` tại toàn bộ phân hệ di động `app/m/*`
  - Tài liệu [CHANGELOG.md](file:///c:/Users/hoang/Downloads/senexam-web-main/CHANGELOG.md) và [README.md](file:///c:/Users/hoang/Downloads/senexam-web-main/README.md)
- Để bảo đảm tương thích chuẩn SemVer của npm/Node.js, trường `version` trong `package.json` được gán hợp lệ là `2.0.2194023` (3 phần), giúp `next build` và bộ đóng gói npm không bị lỗi cú pháp.
