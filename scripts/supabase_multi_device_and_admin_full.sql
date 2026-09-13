-- ==============================================================================
-- 🚀 SENEXAM & FEPN - SUPABASE MULTI-DEVICE RECOGNITION & ADMIN PERMISSIONS FULL SCRIPT
-- Tập tin: scripts/supabase_multi_device_and_admin_full.sql
-- ==============================================================================

-- Bật extension tạo UUID ngẫu nhiên (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 💻 PHẦN 1: QUẢN LÝ NHẬN DIỆN THIẾT BỊ & PHIÊN ĐĂNG NHẬP (MULTI-DEVICE RECOGNITION)
-- ==============================================================================

-- 1.1 Bảng lưu thông tin các thiết bị đã và đang đăng nhập của từng người dùng
CREATE TABLE IF NOT EXISTS public.fepn_user_sessions (
  id text PRIMARY KEY DEFAULT ('sess-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text DEFAULT 'Thiết bị không xác định',
  device_type text DEFAULT 'desktop', -- 'desktop', 'mobile', 'tablet'
  browser text DEFAULT 'Trình duyệt Web',
  os text DEFAULT 'Hệ điều hành',
  ip_address text DEFAULT '127.0.0.1',
  email text DEFAULT NULL,
  is_active boolean DEFAULT true,
  last_active_at timestamptz DEFAULT now(),
  logged_in_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_fepn_user_device UNIQUE (user_id, device_id)
);

-- Chỉ mục tối ưu tốc độ tra cứu thiết bị
CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_user_id ON public.fepn_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_device_id ON public.fepn_user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_is_active ON public.fepn_user_sessions(is_active);

-- 1.2 Bảng quản lý đăng nhập chéo giữa 2 thiết bị qua QR Code & Mã kiểm chứng 2 chiều
CREATE TABLE IF NOT EXISTS public.fepn_qr_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token text UNIQUE NOT NULL,
  short_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'awaiting_code' | 'approved' | 'expired' | 'rejected' | 'used'
  request_device_info jsonb DEFAULT '{}'::jsonb, -- Lưu Browser, OS, IP, thiết bị yêu cầu & mã kiểm chứng 2 số
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text DEFAULT NULL,
  auth_token_hash text DEFAULT NULL,
  completion_code text DEFAULT NULL, -- Mã 6 số bảo mật xác nhận giữa 2 máy
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Chỉ mục tra cứu mã QR nhanh theo token và code 6 số
CREATE INDEX IF NOT EXISTS idx_fepn_qr_logins_token ON public.fepn_qr_logins(qr_token);
CREATE INDEX IF NOT EXISTS idx_fepn_qr_logins_short_code ON public.fepn_qr_logins(short_code);
CREATE INDEX IF NOT EXISTS idx_fepn_qr_logins_status ON public.fepn_qr_logins(status);

-- 1.3 Bật Supabase Realtime cho bảng phiên và QR đăng nhập để các thiết bị nhận ra nhau tức thì
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fepn_user_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fepn_user_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fepn_qr_logins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fepn_qr_logins;
  END IF;
END $$;


-- ==============================================================================
-- 🛡️ PHẦN 2: HỒ SƠ NGƯỜI DÙNG & PHÂN QUYỀN ADMIN (PROFILES & ROLES)
-- ==============================================================================

-- Tạo bảng profiles nếu chưa có
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'student',
  email text DEFAULT '',
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  sencash_balance integer DEFAULT 0,
  vip_expires_at timestamptz DEFAULT NULL,
  is_beta_tester boolean DEFAULT true,
  migrated_to_new_ui boolean DEFAULT false,
  admin_key_issued_at timestamptz DEFAULT NULL,
  school text DEFAULT '',
  grade text DEFAULT '12',
  province text DEFAULT '',
  phone_number text DEFAULT '',
  target_exams jsonb DEFAULT '["A00 (Toán, Lý, Hóa)"]'::jsonb,
  target_score text DEFAULT '27',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bổ sung các cột nếu bảng profiles đã tồn tại từ trước
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sencash_balance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS migrated_to_new_ui boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_key_issued_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS school text DEFAULT '',
  ADD COLUMN IF NOT EXISTS grade text DEFAULT '12',
  ADD COLUMN IF NOT EXISTS province text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_exams jsonb DEFAULT '["A00 (Toán, Lý, Hóa)"]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_score text DEFAULT '27',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Chỉ mục tra cứu vai trò người dùng
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2.1 HÀM BẢO MẬT HỖ TRỢ KIỂM TRA QUYỀN ADMIN / COLLAB
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'hoangbinhminh2508@gmail.com')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_collab_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'collab') OR email = 'hoangbinhminh2508@gmail.com')
  );
$$;

-- 2.2 TRIGGER TỰ ĐỘNG TẠO PROFILE & GÁN QUYỀN ADMIN CHO CHỦ SỞ HỮU
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := 'student';
  v_user_email text := COALESCE(NEW.email, '');
BEGIN
  -- Tự động gán quyền admin cho tài khoản quản trị viên tối cao
  IF LOWER(v_user_email) = 'hoangbinhminh2508@gmail.com' THEN
    v_role := 'admin';
  ELSIF (NEW.raw_user_meta_data->>'role') IS NOT NULL THEN
    v_role := NEW.raw_user_meta_data->>'role';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    sencash_balance,
    is_beta_tester,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_user_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    v_role,
    100, -- Tặng 100 SenCash khởi tạo
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN LOWER(EXCLUDED.email) = 'hoangbinhminh2508@gmail.com' THEN 'admin'
      ELSE COALESCE(public.profiles.role, EXCLUDED.role)
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Đảm bảo tài khoản hoangbinhminh2508@gmail.com hiện có trong hệ thống nhận ngay quyền admin
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'hoangbinhminh2508@gmail.com'
   OR id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'hoangbinhminh2508@gmail.com');


-- ==============================================================================
-- 📊 PHẦN 3: CÁC BẢNG DỮ LIỆU NGHIỆP VỤ QUẢN TRỊ VIÊN (ADMIN TABLES)
-- ==============================================================================

-- 3.1 Bảng Thông báo hệ thống (Announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  content text NOT NULL,
  is_active boolean DEFAULT true,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz DEFAULT (now() + interval '365 days'),
  created_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 3.2 Bảng Mã Quà Tặng (Gift Codes)
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

CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_gift_code UNIQUE (code_id, user_id)
);

-- 3.3 Bảng Biến động số dư SenCash & Giao dịch
CREATE TABLE IF NOT EXISTS public.sencash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text DEFAULT 'gift', -- 'topup', 'gift', 'spend', 'vip_purchase'
  description text DEFAULT 'Giao dịch SenCash',
  created_at timestamptz DEFAULT now()
);

-- Hàm RPC điều chỉnh số dư SenCash an toàn từ Server
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
    RAISE EXCEPTION 'Không tìm thấy hồ sơ người dùng';
  END IF;

  v_new_balance := v_current_balance + p_delta;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Số dư SenCash không đủ để thực hiện giao dịch';
  END IF;

  UPDATE public.profiles
  SET sencash_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.sencash_transactions(user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_delta, p_reason, COALESCE(p_reference, 'Điều chỉnh số dư'));

  RETURN v_new_balance;
END;
$$;

-- 3.4 Bảng Tiếp nhận góp ý & Báo lỗi từ học sinh (Feedback)
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text DEFAULT '',
  user_name text DEFAULT '',
  content text NOT NULL,
  category text DEFAULT 'feature', -- 'bug', 'feature', 'exam', 'other'
  created_at timestamptz DEFAULT now()
);

-- 3.5 Bảng Báo cáo lỗi client gửi về Admin (Client Errors)
CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text DEFAULT '',
  error_message text NOT NULL,
  error_stack text DEFAULT '',
  url text DEFAULT '',
  user_agent text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 3.6 Bảng Quản lý phát hành phiên bản hệ thống (System Release)
CREATE TABLE IF NOT EXISTS public.system_release (
  id int PRIMARY KEY DEFAULT 1,
  latest_version text NOT NULL DEFAULT '1.0.0',
  changelog text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  stable_version text NOT NULL DEFAULT '1.0.0',
  stable_changelog text NOT NULL DEFAULT '',
  stable_published boolean NOT NULL DEFAULT true,
  beta_version text NOT NULL DEFAULT '1.1.0-beta',
  beta_changelog text NOT NULL DEFAULT '',
  beta_published boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_release_single_row CHECK (id = 1)
);
INSERT INTO public.system_release (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.release_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  version text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.7 Bảng FEPN: Môn học, Tài liệu bài giảng, Bài viết Recap & Quản lý Quà tặng
CREATE TABLE IF NOT EXISTS public.fepn_subjects (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  credits integer DEFAULT 3,
  semester text DEFAULT 'Kỳ 1',
  description text DEFAULT '',
  icon text DEFAULT '',
  enable_recordings boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fepn_materials (
  id text PRIMARY KEY,
  subject_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'slide', -- 'slide', 'exercise', 'video', 'exam', 'recording'
  file_url text NOT NULL,
  file_type text DEFAULT '',
  extra_info text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fepn_recap_posts (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text DEFAULT '',
  subject_id text DEFAULT '',
  title text NOT NULL,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fepn_gift_events (
  id text PRIMARY KEY DEFAULT 'fepn-active-event',
  title text NOT NULL,
  description text DEFAULT '',
  location text DEFAULT '',
  time text DEFAULT '',
  how_to_receive text DEFAULT '',
  event_type text DEFAULT 'wheel', -- 'wheel' | 'code'
  is_active boolean DEFAULT true,
  default_spins integer DEFAULT 1,
  banner_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fepn_gift_items (
  id text PRIMARY KEY,
  event_id text DEFAULT 'fepn-active-event',
  name text NOT NULL,
  image_url text DEFAULT '',
  total_quantity integer DEFAULT 10,
  remaining_quantity integer DEFAULT 10,
  win_rate integer DEFAULT 10,
  color text DEFAULT '#0284c7',
  is_consolation boolean DEFAULT false,
  order_index integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.fepn_gift_codes (
  id text PRIMARY KEY,
  event_id text DEFAULT 'fepn-active-event',
  code text UNIQUE NOT NULL,
  type text DEFAULT 'spin',
  spin_count integer DEFAULT 1,
  gift_item_id text DEFAULT NULL,
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fepn_gift_claims (
  id text PRIMARY KEY,
  event_id text DEFAULT 'fepn-active-event',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_mssv text NOT NULL,
  user_name text NOT NULL,
  gift_id text NOT NULL,
  gift_name text NOT NULL,
  claim_code text UNIQUE NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending', -- 'pending' | 'delivered'
  delivered_at timestamptz DEFAULT NULL,
  delivered_by text DEFAULT NULL
);


-- ==============================================================================
-- 🔒 PHẦN 4: BẢO MẬT TOÀN DIỆN - ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Bật RLS trên toàn bộ các bảng
ALTER TABLE public.fepn_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_qr_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sencash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_release ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_recap_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_gift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_gift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_gift_claims ENABLE ROW LEVEL SECURITY;

-- 4.1 Chính sách fepn_user_sessions (Thiết bị)
DROP POLICY IF EXISTS "Users can read own sessions" ON public.fepn_user_sessions;
CREATE POLICY "Users can read own sessions" ON public.fepn_user_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage own sessions" ON public.fepn_user_sessions;
CREATE POLICY "Users can manage own sessions" ON public.fepn_user_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4.2 Chính sách fepn_qr_logins (Đăng nhập QR giữa 2 máy)
DROP POLICY IF EXISTS "Public check qr_logins by token" ON public.fepn_qr_logins;
CREATE POLICY "Public check qr_logins by token" ON public.fepn_qr_logins
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public insert qr_logins" ON public.fepn_qr_logins;
CREATE POLICY "Public insert qr_logins" ON public.fepn_qr_logins
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update qr_logins" ON public.fepn_qr_logins;
CREATE POLICY "Users can update qr_logins" ON public.fepn_qr_logins
  FOR UPDATE TO anon, authenticated
  USING (true);

-- 4.3 Chính sách profiles (Hồ sơ & Quyền)
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 4.4 Chính sách announcements (Thông báo hệ thống)
DROP POLICY IF EXISTS "Everyone can read announcements" ON public.announcements;
CREATE POLICY "Everyone can read announcements" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.5 Chính sách gift_codes
DROP POLICY IF EXISTS "Authenticated can read active gift codes" ON public.gift_codes;
CREATE POLICY "Authenticated can read active gift codes" ON public.gift_codes
  FOR SELECT TO authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage gift codes" ON public.gift_codes;
CREATE POLICY "Admins can manage gift codes" ON public.gift_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.6 Chính sách feedback & client errors
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback;
CREATE POLICY "Admins can read feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert error logs" ON public.client_error_logs;
CREATE POLICY "Users can insert error logs" ON public.client_error_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read error logs" ON public.client_error_logs;
CREATE POLICY "Admins can read error logs" ON public.client_error_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4.7 Chính sách system_release
DROP POLICY IF EXISTS "Everyone can read system release" ON public.system_release;
CREATE POLICY "Everyone can read system release" ON public.system_release
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update system release" ON public.system_release;
CREATE POLICY "Admins can update system release" ON public.system_release
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.8 Chính sách FEPN (Môn học, Tài liệu, Quà tặng)
DROP POLICY IF EXISTS "Everyone can read fepn materials" ON public.fepn_materials;
CREATE POLICY "Everyone can read fepn materials" ON public.fepn_materials
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage fepn materials" ON public.fepn_materials;
CREATE POLICY "Admins can manage fepn materials" ON public.fepn_materials
  FOR ALL TO authenticated
  USING (public.is_collab_or_admin())
  WITH CHECK (public.is_collab_or_admin());

DROP POLICY IF EXISTS "Everyone can read fepn subjects" ON public.fepn_subjects;
CREATE POLICY "Everyone can read fepn subjects" ON public.fepn_subjects
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage fepn subjects" ON public.fepn_subjects;
CREATE POLICY "Admins can manage fepn subjects" ON public.fepn_subjects
  FOR ALL TO authenticated
  USING (public.is_collab_or_admin())
  WITH CHECK (public.is_collab_or_admin());

-- ==============================================================================
-- 🎉 HOÀN TẤT THIẾT LẬP SUPABASE DATABASE
-- ==============================================================================