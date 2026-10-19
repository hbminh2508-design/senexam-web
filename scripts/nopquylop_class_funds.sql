-- ==============================================================================
-- BẢNG DỮ LIỆU ĐỒNG BỘ ONLINE: TRANG NỘP TIỀN QUỸ LỚP ME2 (nopquylop.senexam.me)
-- Tích hợp VietQR chuẩn Ngân hàng + Đối soát Webhook SePay chống gian lận
-- Chạy đoạn mã này trong Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. BẢNG QUẢN LÝ CÁC ĐỢT THU QUỸ LỚP (class_funds)
CREATE TABLE IF NOT EXISTS public.class_funds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  class_name TEXT NOT NULL DEFAULT 'ME2',
  amount_per_person NUMERIC NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT 'MBBANK',
  bank_account TEXT NOT NULL,
  account_name TEXT NOT NULL,
  description TEXT,
  admin_passcode TEXT DEFAULT 'me2@2026',
  students JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tối ưu truy vấn danh sách quỹ
CREATE INDEX IF NOT EXISTS class_funds_created_at_idx ON public.class_funds (created_at DESC);
CREATE INDEX IF NOT EXISTS class_funds_class_name_idx ON public.class_funds (class_name);

-- 2. BẢNG QUẢN LÝ GIAO DỊCH NỘP TIỀN VIETQR (class_fund_payments)
-- Phục vụ đối soát tự động từ Webhook SePay khi sinh viên quét mã VietQR
CREATE TABLE IF NOT EXISTS public.class_fund_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id TEXT NOT NULL REFERENCES public.class_funds(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  mssv TEXT,
  order_code TEXT NOT NULL UNIQUE, -- Định dạng NOPQUYXXXXXX khớp bộ lọc SePay
  amount_vnd NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  sepay_id TEXT,
  paid_at TIMESTAMPTZ,
  raw_webhook JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tìm nhanh đơn thanh toán theo mã giao dịch SePay
CREATE INDEX IF NOT EXISTS class_fund_payments_order_code_idx ON public.class_fund_payments (order_code);
CREATE INDEX IF NOT EXISTS class_fund_payments_fund_id_idx ON public.class_fund_payments (fund_id);
CREATE INDEX IF NOT EXISTS class_fund_payments_status_idx ON public.class_fund_payments (status);

-- 3. CẤU HÌNH ROW LEVEL SECURITY (RLS)
ALTER TABLE public.class_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fund_payments ENABLE ROW LEVEL SECURITY;

-- 3.1 Quyền xem công khai (Ai có link/QR đều có thể xem danh sách quỹ và tình trạng nộp)
DROP POLICY IF EXISTS "class_funds_public_read" ON public.class_funds;
CREATE POLICY "class_funds_public_read" ON public.class_funds
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "class_fund_payments_public_read" ON public.class_fund_payments;
CREATE POLICY "class_fund_payments_public_read" ON public.class_fund_payments
  FOR SELECT USING (true);

-- 3.2 Quyền tạo đơn thanh toán (Public insert khi sinh viên nhập Tên/MSSV sinh mã VietQR)
DROP POLICY IF EXISTS "class_fund_payments_public_insert" ON public.class_fund_payments;
CREATE POLICY "class_fund_payments_public_insert" ON public.class_fund_payments
  FOR INSERT WITH CHECK (true);

-- 3.3 Quyền ghi danh sách quỹ (Service role của server Next.js tự động bypass RLS để ghi)
-- Nếu có nhu cầu insert trực tiếp qua client có thể mở:
DROP POLICY IF EXISTS "class_funds_public_insert" ON public.class_funds;
CREATE POLICY "class_funds_public_insert" ON public.class_funds
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "class_funds_public_update" ON public.class_funds;
CREATE POLICY "class_funds_public_update" ON public.class_funds
  FOR UPDATE USING (true);

-- 4. DỮ LIỆU KHỞI TẠO MẪU CHO LỚP ME2 (Nếu chưa có dữ liệu)
INSERT INTO public.class_funds (
  id,
  title,
  class_name,
  amount_per_person,
  due_date,
  bank_name,
  bank_account,
  account_name,
  description,
  admin_passcode,
  students
)
VALUES (
  'me2-hk2-2026',
  'Quỹ Lớp Học Kỳ 2 (2025 - 2026)',
  'ME2',
  100000,
  (CURRENT_DATE - INTERVAL '9 days')::text, -- Đặt quá hạn > 7 ngày để kiểm thử tính năng cảnh báo đỏ & ưu tiên lên đầu
  'MBBANK',
  '0988776655',
  'BUI HOANG BINH MINH',
  'Thu tiền quỹ phục vụ photo tài liệu ôn tập, sinh hoạt ngoại khóa và quỹ thực hành xưởng ME2.',
  'me2@2026',
  '[
    {"id": "1", "name": "Nguyễn Văn An", "mssv": "20221001", "paid": true, "paidAt": "2026-10-09T08:00:00Z", "paymentCode": "NOPQUYAN1001"},
    {"id": "2", "name": "Trần Thị Bích", "mssv": "20221002", "paid": true, "paidAt": "2026-10-11T10:30:00Z", "paymentCode": "NOPQUYBICH02"},
    {"id": "3", "name": "Lê Hoàng Cường", "mssv": "20221003", "paid": false},
    {"id": "4", "name": "Phạm Minh Đức", "mssv": "20221004", "paid": false},
    {"id": "5", "name": "Hoàng Quốc Hưng", "mssv": "20221005", "paid": false},
    {"id": "6", "name": "Vũ Thùy Linh", "mssv": "20221006", "paid": true, "paidAt": "2026-10-14T15:20:00Z", "paymentCode": "NOPQUYLINH06"},
    {"id": "7", "name": "Đặng Tuấn Nam", "mssv": "20221007", "paid": false},
    {"id": "8", "name": "Bùi Thị Phương", "mssv": "20221008", "paid": false}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
