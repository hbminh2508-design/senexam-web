# SenExam Web Platform
**Phiên bản:** `2.0.2194023.10599.01` (SemVer package: `2.0.2194023`)

Hệ sinh thái nền tảng khảo thí, quản trị học tập, thi trực tuyến chuyên biệt (SEB, HSA, TSA, VNU TEST, University Portal UET) và tài chính lớp học thông minh.

---

## 🚀 Khởi chạy dự án

### 1. Cấu hình biến môi trường
Sao chép `.env.example` thành `.env.local` và điền các khóa dịch vụ:
```bash
cp .env.example .env.local
```

### 2. Kiểm tra kết nối Supabase
Chạy công cụ chẩn đoán kết nối Supabase:
```bash
node scripts/check-supabase.mjs
```

### 3. Khởi chạy máy chủ phát triển
```bash
npm run dev
```

### 4. Kiểm thử tự động & Quét bảo mật
```bash
npm test
node scripts/pre-commit-check.mjs
```

### 5. Biên dịch Production Build
```bash
npm run build
```

---

## 🔒 Kiểm toán & Tiêu chuẩn Bảo mật
- **Row Level Security (RLS) & Client-side Masking:** Đề thi được lọc bỏ đáp án trước khi truyền về client phòng thi. Chấm điểm được thực hiện hoàn toàn ở máy chủ (`/api/exams/submit`).
- **Chống nộp đúp (Double-submit Lock):** Ngăn chặn race condition khi kết nối mạng chập chờn.
- **Không nhúng cứng khóa bí mật:** Toàn bộ khóa service_role, database url, admin secret được quản lý độc quyền qua biến môi trường.
