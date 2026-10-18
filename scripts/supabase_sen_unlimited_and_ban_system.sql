-- ==============================================================================
-- SCRIPT SUPABASE SQL: GÓI SEN UNLIMITED (GÓI ẨN KHÔNG BÁN) & HỆ THỐNG KHÓA TÀI KHOẢN
-- Hướng dẫn: Copy toàn bộ mã này và dán vào Supabase Dashboard -> SQL Editor -> Run
-- Đảm bảo an toàn 100%: Dùng IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, không mất dữ liệu cũ.
-- ==============================================================================

-- ==============================================================================
-- PHẦN 1: HỆ THỐNG KHÓA VÀ ĐÌNH CHỈ TÀI KHOẢN (ACCOUNT BAN / SUSPENSION SYSTEM)
-- ==============================================================================

-- 1. Thêm các cột quản lý trạng thái khóa vào bảng public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Tạo Index tăng tốc truy vấn lọc tài khoản bị khóa
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_banned_at ON public.profiles(banned_at DESC);

-- 3. Trigger tự động vô hiệu hóa toàn bộ phiên đăng nhập khi tài khoản bị khóa
CREATE OR REPLACE FUNCTION public.handle_profile_ban_sessions()
RETURNS trigger AS $$
BEGIN
  -- Khi tài khoản chuyển từ chưa khóa sang bị khóa
  IF NEW.is_banned = true AND (OLD.is_banned = false OR OLD.is_banned IS NULL) THEN
    -- Đặt thời gian khóa nếu chưa có
    IF NEW.banned_at IS NULL THEN
      NEW.banned_at := now();
    END IF;

    -- Vô hiệu hóa (ngắt kết nối) toàn bộ các phiên thiết bị đang hoạt động
    UPDATE public.fepn_user_sessions
    SET is_active = false
    WHERE user_id = NEW.id AND is_active = true;
  END IF;

  -- Khi tài khoản được mở khóa
  IF NEW.is_banned = false AND OLD.is_banned = true THEN
    NEW.banned_at := NULL;
    NEW.ban_reason := NULL;
    NEW.banned_by := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_ban_sessions ON public.profiles;
CREATE TRIGGER trg_profile_ban_sessions
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_ban_sessions();

-- 4. Stored Procedure hỗ trợ Admin KHÓA tài khoản trực tiếp qua SQL:
-- Cách dùng: SELECT public.admin_ban_user('student0001@senexam.edu.vn', 'Vi phạm quy chế thi');
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_identifier text,
  p_reason text DEFAULT 'Vi phạm điều khoản dịch vụ bởi Quản trị viên'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Tìm user theo ID hoặc Email
  IF p_identifier ~ '^[0-9a-fA-F-]{36}$' THEN
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE id = p_identifier::uuid;
  ELSE
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE email = p_identifier;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng với định danh: ' || p_identifier);
  END IF;

  -- Cập nhật profiles
  UPDATE public.profiles
  SET 
    is_banned = true,
    banned_at = now(),
    ban_reason = p_reason,
    updated_at = now()
  WHERE id = v_user_id;

  -- Khóa trong Supabase Auth (cập nhật ban_duration = 100 năm và metadata)
  UPDATE auth.users
  SET 
    banned_until = now() + interval '100 years',
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('is_banned', true, 'ban_reason', p_reason),
    updated_at = now()
  WHERE id = v_user_id;

  -- Ngắt kết nối phiên làm việc
  UPDATE public.fepn_user_sessions
  SET is_active = false
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Đã khóa thành công tài khoản ' || v_email,
    'user_id', v_user_id,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Stored Procedure hỗ trợ Admin MỞ KHÓA tài khoản trực tiếp qua SQL:
-- Cách dùng: SELECT public.admin_unban_user('student0001@senexam.edu.vn');
CREATE OR REPLACE FUNCTION public.admin_unban_user(
  p_identifier text
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF p_identifier ~ '^[0-9a-fA-F-]{36}$' THEN
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE id = p_identifier::uuid;
  ELSE
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE email = p_identifier;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  UPDATE public.profiles
  SET 
    is_banned = false,
    banned_at = NULL,
    ban_reason = NULL,
    banned_by = NULL,
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE auth.users
  SET 
    banned_until = NULL,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'is_banned' - 'ban_reason',
    updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Đã mở khóa tài khoản ' || v_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- PHẦN 2: CẤU HÌNH GÓI SEN UNLIMITED (GÓI ẨN KHÔNG BÁN - MASTER ACCESS)
-- ==============================================================================

-- 1. Cập nhật check constraint cho public.profiles.plan_tier để bổ sung 'sen_unlimited'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_tier_check 
  CHECK (plan_tier IN ('free', 'lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite', 'sen_unlimited'));

-- 2. Cập nhật check constraint cho public.profiles.senai_tier để bổ sung 'unlimited'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_senai_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_senai_tier_check
  CHECK (senai_tier IN ('free', 'lite', 'plus_lite', 'plus', 'ultra', 'max', 'unlimited'));

-- 2.1 Cập nhật check constraint cho bảng public.gift_codes (mã quà tặng SenAI)
ALTER TABLE public.gift_codes DROP CONSTRAINT IF EXISTS gift_codes_reward_senai_tier_check;
ALTER TABLE public.gift_codes ADD CONSTRAINT gift_codes_reward_senai_tier_check
  CHECK (reward_senai_tier IN ('lite', 'plus_lite', 'plus', 'ultra', 'max', 'unlimited'));

-- 3. Thêm cột cờ nhận diện đặc quyền Gói Ẩn Vô Cực (Sen Unlimited)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sen_unlimited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlimited_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlimited_note text;

-- 4. Bảng lưu trữ danh mục Gói Ẩn Hệ Thống (Hidden Special Plans)
CREATE TABLE IF NOT EXISTS public.hidden_system_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  badge text NOT NULL,
  description text NOT NULL,
  is_public_sale boolean NOT NULL DEFAULT false, -- Luôn là false: Không bán công khai
  privileges jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bật RLS cho hidden_system_plans
ALTER TABLE public.hidden_system_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view hidden plan info" ON public.hidden_system_plans;
CREATE POLICY "Anyone can view hidden plan info" ON public.hidden_system_plans
  FOR SELECT TO authenticated, anon USING (true);

-- Khởi tạo thông tin gói Sen Unlimited vào bảng cấu hình gói ẩn
INSERT INTO public.hidden_system_plans (code, name, badge, description, is_public_sale, privileges)
VALUES (
  'sen_unlimited',
  'Sen Unlimited (Vô Cực Toàn Quyền)',
  'UNLIMITED VIP',
  'Gói đặc quyền nội bộ cao cấp nhất SenExam. Không bán thương mại. Mở khóa toàn bộ ngân hàng đề, SEB chống gian lận, tải PDF KaTeX 2 cột và SenAI Studio Unlimited trọn đời.',
  false,
  '{
    "unlimited_exam_access": true,
    "unlimited_pdf_downloads": true,
    "unlimited_senai_prompts": true,
    "seb_proctor_priority": true,
    "bypass_all_quotas": true,
    "lifetime_validity": true
  }'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  description = EXCLUDED.description,
  is_public_sale = false,
  privileges = EXCLUDED.privileges;

-- 5. Stored Procedure hỗ trợ Admin CẤP NHANH GÓI SEN UNLIMITED VĨNH VIỄN:
-- Cách dùng: SELECT public.admin_grant_sen_unlimited('user@example.com', 'Cấp cho Co-Founder / Đối tác chiến lược');
CREATE OR REPLACE FUNCTION public.admin_grant_sen_unlimited(
  p_identifier text,
  p_note text DEFAULT 'Đặc quyền Sen Unlimited cấp bởi Root Admin'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_expiry timestamptz := '2099-12-31 23:59:59.999+00'::timestamptz;
BEGIN
  IF p_identifier ~ '^[0-9a-fA-F-]{36}$' THEN
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE id = p_identifier::uuid;
  ELSE
    SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE email = p_identifier;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng: ' || p_identifier);
  END IF;

  -- Cập nhật gói Sen Unlimited toàn diện cho user
  UPDATE public.profiles
  SET 
    plan_tier = 'sen_unlimited',
    is_sen_unlimited = true,
    vip_expires_at = v_expiry,
    senai_tier = 'unlimited',
    senai_tier_permanent = true,
    senai_tier_expires_at = v_expiry,
    unlimited_granted_at = now(),
    unlimited_note = p_note,
    updated_at = now()
  WHERE id = v_user_id;

  -- Ghi nhật ký admin log nếu bảng tồn tại
  INSERT INTO public.admin_grants_log (target_user_id, kind, amount, note)
  VALUES (v_user_id, 'sen_unlimited_grant', 99999, p_note)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã cấp thành công gói Sen Unlimited (Vĩnh viễn đến năm 2099) cho: ' || v_email,
    'user_id', v_user_id,
    'expires_at', v_expiry
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cấp quyền thực thi cho các role
GRANT EXECUTE ON FUNCTION public.admin_ban_user(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_sen_unlimited(text, text) TO authenticated, service_role;
