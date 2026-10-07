-- ======================================================================================
-- SENEXAM 2026 - MIGRATION SUPABASE ĐỒNG BỘ TÍNH NĂNG CONSOLIDATED (BẢN FIX LỖI TRIỆT ĐỂ)
-- 1. Hợp nhất Cửa Hàng Sen (/new-pay): VIP, SenAI Quota, Ví SenCash, Ưu Đãi & Gift Code
-- 2. Hệ thống điểm danh hàng ngày có theo dõi lịch sử (Đánh dấu ✓ đã điểm danh, ✕ bỏ lỡ)
-- 3. Quota hỏi bài SenAI Studio và SenGraph AI
-- 4. Tương thích 100% với các bảng cũ (Tự động bù các cột created_at, redeemed_at, v.v...)
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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_renew_vip boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_renew_senai boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Gỡ bỏ ràng buộc check cũ trên senai_tier nếu có để không bị lỗi cấp bậc mới
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_senai_tier_check;

-- Index cho profiles để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_profiles_senai_tier ON public.profiles(senai_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_vip_expires ON public.profiles(vip_expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_last_checkin ON public.profiles(last_checkin_date);

-- --------------------------------------------------------------------------------------
-- PHẦN 2: BẢNG DAILY_CHECKINS (THEO DÕI ĐIỂM DANH TỪNG NGÀY & ĐÁNH DẤU X KHI BỎ LỠ)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkin_date date NOT NULL,
  reward_sc integer NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now()
);

-- Đảm bảo an toàn 100% cột tồn tại trước khi tạo index hoặc truy vấn
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS checkin_date date;
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS reward_sc integer DEFAULT 2;
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Thêm ràng buộc unique cho cặp (user_id, checkin_date) nếu chưa có
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_checkin_date'
  ) THEN
    ALTER TABLE public.daily_checkins ADD CONSTRAINT uq_user_checkin_date UNIQUE (user_id, checkin_date);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

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
  user_id uuid,
  amount numeric DEFAULT 0,
  transaction_type text DEFAULT 'general',
  description text,
  created_at timestamptz DEFAULT now()
);

-- Bổ sung đầy đủ tất cả các trường cho cả schema cũ (delta, reason) lẫn mới (amount, transaction_type)
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS delta integer DEFAULT 0;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'general';
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.sencash_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Bỏ các ràng buộc NOT NULL hoặc CHECK cũ nếu có để tránh conflict
ALTER TABLE public.sencash_transactions ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE public.sencash_transactions ALTER COLUMN transaction_type DROP NOT NULL;
ALTER TABLE public.sencash_transactions ALTER COLUMN delta DROP NOT NULL;
ALTER TABLE public.sencash_transactions ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE public.sencash_transactions DROP CONSTRAINT IF EXISTS sencash_transactions_reason_check;
ALTER TABLE public.sencash_transactions DROP CONSTRAINT IF EXISTS sencash_transactions_type_check;

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
  user_id uuid,
  asked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  question_prompt text,
  model text DEFAULT 'gemini-2.5-flash',
  status text DEFAULT 'completed'
);

ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS asked_at timestamptz DEFAULT now();
ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS question_prompt text;
ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS model text DEFAULT 'gemini-2.5-flash';
ALTER TABLE public.senai_question_log ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

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
  user_id uuid,
  asked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'completed'
);

ALTER TABLE public.sengraph_ai_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.sengraph_ai_log ADD COLUMN IF NOT EXISTS asked_at timestamptz DEFAULT now();
ALTER TABLE public.sengraph_ai_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.sengraph_ai_log ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

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
-- KHẮC PHỤC TRIỆT ĐỂ LỖI: ERROR 42703 (column "created_at" does not exist)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  reward_type text NOT NULL DEFAULT 'sencash',
  reward_amount integer NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Bổ sung phòng ngừa tất cả các cột nếu bảng gift_codes đã tồn tại từ các bản trước
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'sencash';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_amount integer DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_sencash_amount integer DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_vip_days integer DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_senai_tier text;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_senai_duration_days integer DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_senai_permanent boolean DEFAULT false;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS max_uses integer DEFAULT 1;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Gỡ bỏ ràng buộc check nếu có để chấp nhận cả 'vip_days', 'sencash', 'senai_tier', 'senai_days'
ALTER TABLE public.gift_codes DROP CONSTRAINT IF EXISTS gift_codes_reward_type_check;

CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes(code);

-- BẢNG GIFT_CODE_REDEMPTIONS (NƠI GÂY RA LỖI THIẾU CREATED_AT NẾU ĐÃ TẠO TỪ SCRIPT CŨ)
CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid,
  code text,
  user_id uuid,
  reward_summary text,
  redeemed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- BỔ SUNG CỘT BẢO ĐẢM TỒN TẠI TRƯỚC KHI TẠO INDEX HOẶC CHẠY TRUY VẤN
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS code_id uuid;
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS reward_summary text;
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS redeemed_at timestamptz DEFAULT now();
ALTER TABLE public.gift_code_redemptions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Đồng bộ giá trị giữa created_at và redeemed_at nếu một trong hai đang trống
UPDATE public.gift_code_redemptions SET created_at = redeemed_at WHERE created_at IS NULL AND redeemed_at IS NOT NULL;
UPDATE public.gift_code_redemptions SET redeemed_at = created_at WHERE redeemed_at IS NULL AND created_at IS NOT NULL;

-- Bây giờ tạo index an toàn tuyệt đối 100%, không bao giờ gặp lỗi 42703 nữa
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_user ON public.gift_code_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_user_redeemed ON public.gift_code_redemptions(user_id, redeemed_at DESC);

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng đã đăng nhập có thể xem lịch sử đổi code của chính họ
DROP POLICY IF EXISTS "Users can view own redemptions" ON public.gift_code_redemptions;
CREATE POLICY "Users can view own redemptions" ON public.gift_code_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Cấp sẵn một số Gift Code mẫu dùng thử (tương thích cả hệ thống cũ và mới)
INSERT INTO public.gift_codes (
  code, reward_type, reward_vip_days, reward_sencash_amount, reward_senai_tier, reward_senai_duration_days, reward_amount, max_uses, active, is_active, description
)
VALUES 
  ('SENEXAM2026VIP30', 'vip_days', 30, 0, NULL, 0, 30, 500, true, true, 'Tặng 30 ngày Hội viên Sen VIP'),
  ('SENCASH50CHIENTHAN', 'sencash', 0, 50, NULL, 0, 50, 1000, true, true, 'Tặng 50 SenCash vào ví'),
  ('SENAIULTRA7DAYFREE', 'senai_tier', 0, 0, 'ultra', 7, 7, 300, true, true, 'Tặng 7 ngày trải nghiệm SenAI Ultra')
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------------------
-- PHẦN 6: CẬP NHẬT QUYỀN VÀ RLS CHO PROFILES
-- --------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile checkin and settings" ON public.profiles;
CREATE POLICY "Users can update own profile checkin and settings" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------------------------
-- PHẦN 7: HÀM RPC ĐIỀU CHỈNH SỐ DƯ SENCASH AN TOÀN (ADJUST_SENCASH_BALANCE)
-- --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_sencash_balance(
  p_user_id uuid,
  p_delta integer,
  p_reason text DEFAULT 'gift_code',
  p_reference text DEFAULT ''
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  SELECT COALESCE(sencash_balance, 0) INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  v_new_balance := v_current_balance + p_delta;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Số dư SenCash không đủ để thực hiện giao dịch';
  END IF;

  UPDATE public.profiles
  SET sencash_balance = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO public.sencash_transactions(user_id, amount, delta, transaction_type, reason, description)
  VALUES (
    p_user_id,
    p_delta,
    p_delta,
    p_reason,
    p_reason,
    COALESCE(p_reference, 'Điều chỉnh số dư SenCash')
  );

  RETURN v_new_balance;
END;
$$;

-- ======================================================================================
-- HOÀN TẤT ĐỒNG BỘ SUPABASE CHO SENEXAM 2026 CONSOLIDATED (KHÔNG CÒN LỖI 42703)
-- ======================================================================================
