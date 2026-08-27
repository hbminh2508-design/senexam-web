-- ==============================================================================
-- 🚀 SENEXAM 2026 - BẢN CẬP NHẬT RIÊNG (PATCH UPDATE 27/08/2026)
-- Bao gồm: Bổ sung category cho feedback, quản lý tham gia Beta, và bảng UI Migration
-- Hướng dẫn: Dán đoạn SQL này vào Supabase -> SQL Editor -> Bấm Run
-- ==============================================================================

-- 1. CẬP NHẬT BẢNG FEEDBACK (Khắc phục lỗi 'category column not found')
ALTER TABLE public.feedback 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'feature',
  ADD COLUMN IF NOT EXISTS user_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name text DEFAULT '';

-- 2. CẬP NHẬT BẢNG PROFILES (Hỗ trợ Kênh Beta & Cờ chuyển đổi New UI)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS migrated_to_new_ui boolean DEFAULT false;

-- 3. TẠO BẢNG LƯU TRỮ NGƯỜI DÙNG CHUYỂN SANG NEW DASHBOARD
CREATE TABLE IF NOT EXISTS public.ui_migration_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  migrated_at timestamptz DEFAULT now(),
  source_path text DEFAULT '/dashboard',
  CONSTRAINT uq_user_ui_migration UNIQUE (user_id)
);

-- 4. CẤP QUYỀN VÀ BẬT BẢO MẬT ROW LEVEL SECURITY (RLS) AN TOÀN
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_migration_opt_ins ENABLE ROW LEVEL SECURITY;

-- 4.1. Chính sách cho bảng Feedback
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback 
  FOR INSERT TO authenticated, anon 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can read feedback" ON public.feedback;
CREATE POLICY "Admin can read feedback" ON public.feedback 
  FOR SELECT TO authenticated 
  USING (true);

-- 4.2. Chính sách cho bảng UI Migration Opt-ins
DROP POLICY IF EXISTS "Users can insert own migration" ON public.ui_migration_opt_ins;
CREATE POLICY "Users can insert own migration" ON public.ui_migration_opt_ins 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own migration" ON public.ui_migration_opt_ins;
CREATE POLICY "Users can read own migration" ON public.ui_migration_opt_ins 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- 4.3. Chính sách cho bảng Gift Codes (Tạo và Đổi mã quà tặng)
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active gift_codes" ON public.gift_codes;
CREATE POLICY "Public read active gift_codes" ON public.gift_codes 
  FOR SELECT TO authenticated, anon 
  USING (true);

DROP POLICY IF EXISTS "Admin full access gift_codes" ON public.gift_codes;
CREATE POLICY "Admin full access gift_codes" ON public.gift_codes 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

