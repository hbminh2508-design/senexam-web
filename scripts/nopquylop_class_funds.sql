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

-- 4. BUCKET LƯU ẢNH BILL CHI TIÊU
-- Route server upload bằng SUPABASE_SERVICE_ROLE_KEY; ảnh chỉ đọc được bằng URL public.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nopquylop-bills',
  'nopquylop-bills',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "nopquylop_bills_public_read" ON storage.objects;
CREATE POLICY "nopquylop_bills_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'nopquylop-bills');

-- Chỉ server service-role được upload/xóa ảnh bill. Không mở INSERT/DELETE cho anon.