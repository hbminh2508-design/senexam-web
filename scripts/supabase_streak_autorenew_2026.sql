-- ==============================================================================
-- SENEXAM 2026 - MIGRATION AN TOÀN (100% NON-DESTRUCTIVE / KHÔNG MẤT DỮ LIỆU)
-- Tính năng: Điểm danh nhận SC hằng ngày, Chuỗi học tập, Nhiệm vụ cuối tuần,
-- Tự động gia hạn VIP & Sen AI bằng SC, Lưu vết giao dịch SenCash.
-- TUYỆT ĐỐI KHÔNG DROP TABLE, KHÔNG TRUNCATE, KHÔNG LÀM MẤT KHO ĐỀ HOẶC BÀI LÀM!
-- ==============================================================================

-- 1. Bổ sung các cột mới vào bảng profiles (nếu chưa có)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_checkin_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekend_mission_claimed_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_renew_vip boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_renew_senai boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sencash_balance numeric DEFAULT 0;

-- 2. Đảm bảo bảng lưu vết giao dịch SenCash tồn tại (không tạo lại nếu đã có)
CREATE TABLE IF NOT EXISTS public.sencash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'general',
  description text,
  created_at timestamptz DEFAULT now()
);

-- Bổ sung cột an toàn trong trường hợp bảng đã tồn tại từ trước nhưng thiếu cột
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'general';
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS description text;

-- Hủy bỏ ràng buộc CHECK cũ nếu có để tránh lỗi khi nạp/trừ SC tính năng mới
ALTER TABLE public.sencash_transactions DROP CONSTRAINT IF EXISTS sencash_transactions_reason_check;
ALTER TABLE public.sencash_transactions DROP CONSTRAINT IF EXISTS sencash_transactions_type_check;

-- 3. Tạo Index tối ưu hóa truy vấn lịch sử giao dịch SC
CREATE INDEX IF NOT EXISTS idx_sencash_tx_user_created ON public.sencash_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_checkin ON public.profiles (last_checkin_date);

-- 4. Kích hoạt Row Level Security (RLS) an toàn
ALTER TABLE public.sencash_transactions ENABLE ROW LEVEL SECURITY;

-- Policy đọc lịch sử SC của chính mình
DROP POLICY IF EXISTS "Users can read own sencash_transactions" ON public.sencash_transactions;
CREATE POLICY "Users can read own sencash_transactions" 
  ON public.sencash_transactions 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Policy tạo giao dịch SC cho chính mình (điểm danh, đổi thưởng, gia hạn)
DROP POLICY IF EXISTS "Users can insert own sencash_transactions" ON public.sencash_transactions;
CREATE POLICY "Users can insert own sencash_transactions" 
  ON public.sencash_transactions 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Đảm bảo user có quyền tự cập nhật streak_days, last_checkin_date và auto_renew của bản thân
DROP POLICY IF EXISTS "Users can update own profile checkin" ON public.profiles;
CREATE POLICY "Users can update own profile checkin" 
  ON public.profiles 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- Thông báo hoàn tất
SELECT 'Migration SenExam 2026 (Daily Streak & Auto Renew) đã chạy thành công mà không làm ảnh hưởng đến bất kỳ dữ liệu đề thi nào!' AS result;
