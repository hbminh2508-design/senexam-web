-- ==============================================================================
-- 🚀 SENEXAM 2026 - FULL SUPABASE DATABASE MIGRATION SCRIPT
-- Tập tin: scripts/senexam_2026_full_migration.sql
-- Áp dụng cho: new-dashboard, new-admin, new-teacher, new-schedule, new-media, 
--              new-announcement, new-profile, new-codes, new-sencash
-- Hướng dẫn: Dán toàn bộ nội dung file này vào Supabase -> SQL Editor -> Run
-- ==============================================================================

-- 1. BẢNG PROFILES: Bổ sung các cột thông tin học tập, phân quyền & ví SenCash
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS sencash_balance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_exams jsonb DEFAULT '["A00 (Toán, Lý, Hóa)"]'::jsonb,
  ADD COLUMN IF NOT EXISTS school text DEFAULT '',
  ADD COLUMN IF NOT EXISTS province text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS grade text DEFAULT '12',
  ADD COLUMN IF NOT EXISTS target_score text DEFAULT '27',
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. BẢNG EXAMS: Bổ sung các cột đề thi ẩn, mã code bí mật & quyền xem đáp án
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grading_method text DEFAULT 'highest',
  ADD COLUMN IF NOT EXISTS require_proctoring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS drive_file_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS exam_structure jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subjects jsonb DEFAULT '["Toán học"]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT NULL;

-- 3. BẢNG SUBMISSIONS: Bổ sung theo dõi chống gian lận (thoát tab/chuyển cửa sổ)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS tab_switches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blur_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback text DEFAULT NULL;

-- 4. BẢNG GIFT_CODES: Quản lý mã quà tặng 16 chữ số (XXXX-XXXX-XXXX-XXXX)
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  reward_type text NOT NULL, -- 'sencash', 'vip_days', 'senai_tier'
  reward_sencash_amount integer DEFAULT NULL,
  reward_vip_days integer DEFAULT NULL,
  reward_senai_tier text DEFAULT NULL,
  reward_senai_duration_days integer DEFAULT NULL,
  reward_senai_permanent boolean DEFAULT false,
  batch_id text DEFAULT 'SEN2026',
  note text DEFAULT 'Quà tặng SenExam',
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  active boolean DEFAULT true,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

-- 5. BẢNG GIFT_CODE_REDEMPTIONS: Lưu lịch sử người dùng đổi mã quà tặng
CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_gift_code UNIQUE (code_id, user_id)
);

-- 6. BẢNG SENCASH_TRANSACTIONS: Ghi log biến động số dư Ví Sen
CREATE TABLE IF NOT EXISTS public.sencash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text DEFAULT 'gift', -- 'topup', 'gift', 'spend', 'vip_purchase'
  description text DEFAULT 'Giao dịch SenCash',
  created_at timestamptz DEFAULT now()
);

-- 7. BẢNG ANNOUNCEMENTS: Bảng tin thông báo hệ thống từ Admin
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  content text NOT NULL,
  is_active boolean DEFAULT true,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz DEFAULT (now() + interval '365 days'),
  created_by uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Cập nhật bổ sung cột nếu bảng announcements đã tồn tại từ trước
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_time timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_time timestamptz DEFAULT (now() + interval '365 days'),
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT NULL;

-- 8. BẢNG FEEDBACK: Tiếp nhận góp ý & báo lỗi từ học sinh gửi Admin
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL,
  user_email text DEFAULT '',
  user_name text DEFAULT '',
  content text NOT NULL,
  category text DEFAULT 'feature', -- 'bug', 'feature', 'exam', 'other'
  created_at timestamptz DEFAULT now()
);

-- 9. BẢNG USER_SCHEDULES: Quản lý thời khóa biểu, lịch học & lịch thi (new-schedule)
CREATE TABLE IF NOT EXISTS public.user_schedules (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  type text DEFAULT 'study', -- 'study', 'mock_exam', 'real_exam', 'review'
  room text DEFAULT '',
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  remind_before integer DEFAULT 15,
  repeat text DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly'
  repeat_until date DEFAULT NULL,
  note text DEFAULT '',
  color text DEFAULT 'Indigo',
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 10. BẢNG POSTS & COMMENTS: Diễn đàn & Hỏi đáp sĩ tử Sen Media
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'Thảo luận',
  likes_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  drive_file_id text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- ⚡ 11. STORED PROCEDURE / RPC: ĐIỀU CHỈNH SỐ DƯ SENCASH AN TOÀN
-- ==============================================================================
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
  -- Lấy số dư hiện tại
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

  -- Cập nhật bảng profiles
  UPDATE public.profiles
  SET sencash_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  -- Ghi log giao dịch vào sencash_transactions
  INSERT INTO public.sencash_transactions(user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_delta, p_reason, COALESCE(p_reference, 'Điều chỉnh số dư'));

  RETURN v_new_balance;
END;
$$;

-- ==============================================================================
-- 🔒 12. ROW LEVEL SECURITY (RLS) POLICIES (IDEMPOTENT)
-- ==============================================================================
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sencash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 12.1. Gift Codes
DROP POLICY IF EXISTS "Public read active gift_codes" ON public.gift_codes;
CREATE POLICY "Public read active gift_codes" ON public.gift_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert redemptions" ON public.gift_code_redemptions;
CREATE POLICY "Users can insert redemptions" ON public.gift_code_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own redemptions" ON public.gift_code_redemptions;
CREATE POLICY "Users can read own redemptions" ON public.gift_code_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 12.2. SenCash Transactions
DROP POLICY IF EXISTS "Users can read own sencash_transactions" ON public.sencash_transactions;
CREATE POLICY "Users can read own sencash_transactions" ON public.sencash_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 12.3. Announcements
DROP POLICY IF EXISTS "Public read active announcements" ON public.announcements;
CREATE POLICY "Public read active announcements" ON public.announcements FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Admin manage announcements" ON public.announcements;
CREATE POLICY "Admin manage announcements" ON public.announcements FOR ALL TO authenticated USING (true);

-- 12.4. Feedback
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can read feedback" ON public.feedback;
CREATE POLICY "Admin can read feedback" ON public.feedback FOR SELECT TO authenticated USING (true);

-- 12.5. User Schedules
DROP POLICY IF EXISTS "Users can manage own schedules" ON public.user_schedules;
CREATE POLICY "Users can manage own schedules" ON public.user_schedules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12.6. Posts & Comments (Sen Media)
DROP POLICY IF EXISTS "Public read posts" ON public.posts;
CREATE POLICY "Public read posts" ON public.posts FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can insert posts" ON public.posts;
CREATE POLICY "Users can insert posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read comments" ON public.comments;
CREATE POLICY "Public read comments" ON public.comments FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can insert comments" ON public.comments;
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- 🎁 13. SAMPLE SEED DATA (DỮ LIỆU MẪU ĐỂ TEST NGAY)
-- ==============================================================================

-- 13.1. Tạo 3 mã Gift Code 16 ký tự mẫu (XXXX-XXXX-XXXX-XXXX)
INSERT INTO public.gift_codes (code, reward_type, reward_sencash_amount, reward_vip_days, max_uses, note)
VALUES 
  ('SENC-ASH1-00SC-2026', 'sencash', 100, NULL, 50, 'Mã tặng 100 SenCash sự kiện ra mắt New Dashboard'),
  ('SENX-VIP3-0DAY-PASS', 'vip_days', NULL, 30, 20, 'Mã kích hoạt 30 ngày trải nghiệm Sen VIP'),
  ('GIFT-2026-FOCU-SPRO', 'sencash', 200, NULL, 100, 'Mã tặng 200 SenCash thử thách Focus')
ON CONFLICT (code) DO NOTHING;

-- 13.2. Tạo thông báo hệ thống mẫu
INSERT INTO public.announcements (title, content, is_active)
VALUES 
  (
    'Chào Đón Giao Diện New Dashboard 2.0 & Đếm Ngược Kỳ Thi THPT 2026',
    '###(H1) {Center: CHÀO MỪNG BẠN ĐẾN VỚI SENEXAM 2.0}

Kỳ thi tốt nghiệp THPT Quốc Gia 2026 đang đến rất gần: {time_:2026-06-25T07:30}

{bold:Các tính năng mới nổi bật:}
• **SenAI Studio:** Tích hợp model suy luận sâu Gemini 3.7 Flash và KaTeX LaTeX.
• **Thời khóa biểu & Lịch thi:** Đặt lịch thi, nhắc nhở thông minh và lặp lại theo tuần.
• **Sen Media 2.0:** Diễn đàn hỏi đáp sĩ tử và phòng chat trực tiếp toàn quốc.
• **Phòng thí nghiệm ảo 60FPS:** Mô phỏng 10 hiện tượng Vật lý & Hóa học chuẩn xác.

{underline:Nhập mã quà tặng SENC-ASH1-00SC-2026 tại mục Đổi Mã Quà Tặng để nhận ngay 100 SenCash nhé!}',
    true
  )
ON CONFLICT DO NOTHING;
