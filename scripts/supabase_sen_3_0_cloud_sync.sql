-- ==============================================================================
-- SENEXAM 2026 - MIGRATION SUPABASE CHO 6 YÊU CẦU MỚI (SEN UI 3.0 & SEN HEART 1.0.2)
-- Bản cập nhật: Lưu trữ đám mây toàn diện (Cloud Sync) cho tài khoản người dùng
-- 100% NON-DESTRUCTIVE: TUYỆT ĐỐI KHÔNG DROP BẢNG, KHÔNG LÀM MẤT DỮ LIỆU KHO ĐỀ
-- ==============================================================================

-- 1. BỔ SUNG CỘT CẤU HÌNH & GÓI VIP VÀO BẢNG PUBLIC.PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_vip_premium_plus boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_bubble_disabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS flame_motion_disabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_ui_version text DEFAULT 'sen_3.0';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_3_0_theme text DEFAULT 'gold';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senheart_protocol text DEFAULT 'Sen-Heart-Shield-1.0.2';

-- 2. CẬP NHẬT RÀNG BUỘC KIỂM TRA (CHECK CONSTRAINT) CHO HẠNG GÓI VIP & SEN ONE
-- Cho phép đầy đủ 6 hạng gói: 'lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_tier_check 
  CHECK (plan_tier IN ('lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'));

-- Cập nhật ràng buộc cho bảng đơn hàng VIP (nếu có bảng vip_orders)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vip_orders') THEN
    ALTER TABLE public.vip_orders DROP CONSTRAINT IF EXISTS vip_orders_plan_group_check;
    ALTER TABLE public.vip_orders ADD CONSTRAINT vip_orders_plan_group_check 
      CHECK (plan_group IN ('lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'));
  END IF;
END $$;

-- 3. ĐỒNG BỘ TỰ ĐỘNG CỜ is_vip_premium_plus DỰA THEO plan_tier
-- Đảm bảo người dùng sở hữu Gói Premium+ hoặc Sen One luôn có is_vip_premium_plus = true
UPDATE public.profiles 
SET is_vip_premium_plus = true 
WHERE plan_tier IN ('premium_plus', 'sen_one');

-- 4. BẢNG GHI NHẬT KÝ BẢO MẬT & TELEMETRY SEN HEART 1.0.2 (TÙY CHỌN CHO ADMIN)
CREATE TABLE IF NOT EXISTS public.senheart_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'anti_tamper_guard', 'session_integrity_verified', 'zombie_thread_pruned'
  protocol_version text DEFAULT 'Sen-Heart-Shield-1.0.2',
  details text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index tra cứu telemetry nhanh cho Admin
CREATE INDEX IF NOT EXISTS idx_senheart_logs_user_created ON public.senheart_security_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_senheart_logs_event ON public.senheart_security_logs(event_type);

-- 5. PHÂN QUYỀN ROW LEVEL SECURITY (RLS) AN TOÀN TRÊN SUPABASE
ALTER TABLE public.senheart_security_logs ENABLE ROW LEVEL SECURITY;

-- Người dùng authenticated có thể tự ghi nhật ký an ninh phiên làm việc của mình
DROP POLICY IF EXISTS "Users can insert own senheart log" ON public.senheart_security_logs;
CREATE POLICY "Users can insert own senheart log" 
  ON public.senheart_security_logs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Chỉ Admin hoặc chính chủ nhân mới có thể xem nhật ký an ninh
DROP POLICY IF EXISTS "Users or Admin can view senheart logs" ON public.senheart_security_logs;
CREATE POLICY "Users or Admin can view senheart logs" 
  ON public.senheart_security_logs 
  FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE public.profiles.id = auth.uid() 
      AND public.profiles.role IN ('admin', 'collab')
    )
  );

-- Đảm bảo người dùng có quyền cập nhật các cài đặt giao diện của chính mình trong bảng profiles
-- (Cài đặt bong bóng chat, chế độ mượt, giao diện Sen 3.0)
DROP POLICY IF EXISTS "Users can update own UI preferences" ON public.profiles;
CREATE POLICY "Users can update own UI preferences"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- HOÀN TẤT: Toàn bộ 6 tính năng đã sẵn sàng lưu trữ đồng bộ trên Supabase Cloud!
-- ==============================================================================
