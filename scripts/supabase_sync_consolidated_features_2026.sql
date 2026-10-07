-- ======================================================================================
-- SENEXAM 2026 - MIGRATION SUPABASE ĐỒNG BỘ TÍNH NĂNG CONSOLIDATED
-- 1. Hợp nhất Cửa Hàng Sen (/new-pay): VIP, SenAI Quota, Ví SenCash, Ưu Đãi & Gift Code
-- 2. Hệ thống điểm danh hàng ngày có theo dõi lịch sử (Đánh dấu ✓ đã điểm danh, ✕ bỏ lỡ)
-- 3. Quota hỏi bài SenAI Studio và SenGraph AI
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- PHẦN 1: CẬP NHẬT BẢNG PROFILES (HỒ SƠ NGƯỜI DÙNG)
-- --------------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_tier text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_tier_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_tier_permanent boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sencash_balance bigint DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_bubble_disabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_checkin_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekend_mission_claimed_date text;

-- Index cho profiles để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_profiles_senai_tier ON public.profiles(senai_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_vip_expires ON public.profiles(vip_expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_last_checkin ON public.profiles(last_checkin_date);

-- --------------------------------------------------------------------------------------
-- PHẦN 2: BẢNG DAILY_CHECKINS (THEO DÕI ĐIỂM DANH TỪNG NGÀY & ĐÁNH DẤU X KHI BỎ LỠ)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  reward_sc integer NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_checkin_date UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checkins" ON public.daily_checkins;
CREATE POLICY "Users can view own checkins" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own checkins" ON public.daily_checkins;
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------------------
-- PHẦN 3: BẢNG SENCASH_TRANSACTIONS (LỊCH SỬ GIAO DỊCH VÍ SENCASH)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sencash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL, -- 'daily_checkin', 'weekend_mission', 'topup', 'vip_purchase', 'senai_purchase', 'giftcode'
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sencash_tx_user_created ON public.sencash_transactions(user_id, created_at DESC);

ALTER TABLE public.sencash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sencash transactions" ON public.sencash_transactions;
CREATE POLICY "Users can view own sencash transactions" ON public.sencash_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sencash transactions" ON public.sencash_transactions;
CREATE POLICY "Users can insert own sencash transactions" ON public.sencash_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------------------
-- PHẦN 4: BẢNG SENAI_QUESTION_LOG & SENGRAPH_AI_LOG (QUOTA HỎI BÀI)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.senai_question_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asked_at timestamptz DEFAULT now(),
  question_prompt text,
  model text DEFAULT 'gemini-2.5-flash',
  status text DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS idx_senai_log_user_date ON public.senai_question_log(user_id, asked_at DESC);

ALTER TABLE public.senai_question_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own question log" ON public.senai_question_log;
CREATE POLICY "Users can view own question log" ON public.senai_question_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own question log" ON public.senai_question_log;
CREATE POLICY "Users can insert own question log" ON public.senai_question_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SenGraph AI Log
CREATE TABLE IF NOT EXISTS public.sengraph_ai_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asked_at timestamptz DEFAULT now(),
  status text DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS idx_sengraph_log_user_date ON public.sengraph_ai_log(user_id, asked_at DESC);

ALTER TABLE public.sengraph_ai_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sengraph log" ON public.sengraph_ai_log;
CREATE POLICY "Users can view own sengraph log" ON public.sengraph_ai_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sengraph log" ON public.sengraph_ai_log;
CREATE POLICY "Users can insert own sengraph log" ON public.sengraph_ai_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------------------
-- PHẦN 5: BẢNG GIFT CODES & LỊCH SỬ ĐỔI MÃ (/new-pay?tab=giftcode)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  reward_type text NOT NULL, -- 'sencash', 'vip_days', 'senai_days'
  reward_amount integer NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid REFERENCES public.gift_codes(id) ON DELETE SET NULL,
  code text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_summary text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_code_redemption UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes(code);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_user ON public.gift_code_redemptions(user_id, created_at DESC);

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng đã đăng nhập có thể xem lịch sử đổi code của chính họ
DROP POLICY IF EXISTS "Users can view own redemptions" ON public.gift_code_redemptions;
CREATE POLICY "Users can view own redemptions" ON public.gift_code_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Cấp sẵn một số Gift Code mẫu dùng thử
INSERT INTO public.gift_codes (code, reward_type, reward_amount, max_uses, description)
VALUES 
  ('SENEXAM2026VIP30', 'vip_days', 30, 500, 'Tặng 30 ngày Hội viên Sen VIP'),
  ('SENCASH50CHIENTHAN', 'sencash', 50, 1000, 'Tặng 50 SenCash vào ví'),
  ('SENAIULTRA7DAYFREE', 'senai_days', 7, 300, 'Tặng 7 ngày trải nghiệm SenAI Ultra')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------------------
-- PHẦN 6: CẬP NHẬT QUYỀN VÀ RLS CHO PROFILES
-- --------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile checkin and settings" ON public.profiles;
CREATE POLICY "Users can update own profile checkin and settings" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ======================================================================================
-- HOÀN TẤT ĐỒNG BỘ SUPABASE CHO SENEXAM 2026 CONSOLIDATED
-- ======================================================================================
