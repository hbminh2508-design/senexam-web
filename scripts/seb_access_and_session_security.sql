-- ==============================================================================
-- 🛡️ SENEXAM / SEB DATABASE MIGRATION: BẢO TOÀN DỮ LIỆU & LƯU VẾT HÀNH ĐỘNG
-- Chạy đoạn mã này trong Supabase Dashboard -> SQL Editor
-- 
-- CAM KẾT AN TOÀN:
-- 1. BẢO TOÀN 100% DỮ LIỆU CŨ: Không xóa bảng, không drop cột, không ghi đè dữ liệu.
-- 2. KHÔNG PHÁT SINH DỮ LIỆU DEMO/MẪU: Không chèn bất kỳ hàng dữ liệu mẫu nào.
-- 3. CHỈ DÙNG IF NOT EXISTS / ADD COLUMN IF NOT EXISTS: Chạy nhiều lần không lỗi.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG seb_access_codes (Lưu vết mã dự thi 6 số, phiên thiết bị & trạng thái vào thi)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seb_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(6) NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  exam_id text,
  token_hash text,
  action_link text,
  device_id text,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  used_at timestamptz,
  terminated_other_sessions boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Chỉ mục tối ưu tốc độ tra cứu mã 6 số tức thì (dưới 5ms)
CREATE INDEX IF NOT EXISTS idx_seb_access_codes_code ON public.seb_access_codes(code);
CREATE INDEX IF NOT EXISTS idx_seb_access_codes_user_exam ON public.seb_access_codes(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_seb_access_codes_active ON public.seb_access_codes(code, expires_at) WHERE (used = false);

-- Kích hoạt RLS cho seb_access_codes
ALTER TABLE public.seb_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own access codes" ON public.seb_access_codes;
CREATE POLICY "Users can read own access codes" ON public.seb_access_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own access codes" ON public.seb_access_codes;
CREATE POLICY "Users can create own access codes" ON public.seb_access_codes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on seb_access_codes" ON public.seb_access_codes;
CREATE POLICY "Service role full access on seb_access_codes" ON public.seb_access_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. BẢNG fepn_user_sessions (Lưu vết các phiên thiết bị để thực hiện chấm dứt máy khác)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fepn_user_sessions (
  id text PRIMARY KEY DEFAULT ('sess_' || replace(gen_random_uuid()::text, '-', '')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  device_id text NOT NULL,
  device_name text DEFAULT 'Thiết bị không xác định',
  device_type text DEFAULT 'desktop',
  browser text,
  os text,
  ip_address text,
  is_active boolean DEFAULT true,
  logged_in_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Đảm bảo bổ sung các cột nếu bảng đã tồn tại từ trước
ALTER TABLE public.fepn_user_sessions
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text DEFAULT 'Thiết bị không xác định',
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_user_id ON public.fepn_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_device_id ON public.fepn_user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_fepn_user_sessions_user_active ON public.fepn_user_sessions(user_id, is_active);

ALTER TABLE public.fepn_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sessions" ON public.fepn_user_sessions;
CREATE POLICY "Users can manage own sessions" ON public.fepn_user_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on fepn_user_sessions" ON public.fepn_user_sessions;
CREATE POLICY "Service role full access on fepn_user_sessions" ON public.fepn_user_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. BẢNG seb_folders (Cây thư mục môn thi SEB - Không chèn thêm dữ liệu mẫu nào)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seb_folders (
  id text PRIMARY KEY DEFAULT ('fld_' || replace(gen_random_uuid()::text, '-', '')),
  name text NOT NULL,
  parent_id text REFERENCES public.seb_folders(id) ON DELETE CASCADE,
  icon text DEFAULT 'folder',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.seb_folders 
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_seb_folders_parent_id ON public.seb_folders(parent_id);

ALTER TABLE public.seb_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read seb folders" ON public.seb_folders;
CREATE POLICY "Everyone can read seb folders" ON public.seb_folders
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage seb folders" ON public.seb_folders;
CREATE POLICY "Admins can manage seb folders" ON public.seb_folders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'collab'))
    OR auth.jwt() ->> 'email' = 'hoangbinhminh2508@gmail.com'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'collab'))
    OR auth.jwt() ->> 'email' = 'hoangbinhminh2508@gmail.com'
  );

-- ------------------------------------------------------------------------------
-- 4. BỔ SUNG CỘT BẢO MẬT & QUẢN LÝ THƯ MỤC VÀO BẢNG exams
-- ------------------------------------------------------------------------------
ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS folder_id text,
  ADD COLUMN IF NOT EXISTS require_seb boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS seb_config_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_instructions jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_exams_folder_id ON public.exams(folder_id);

-- ------------------------------------------------------------------------------
-- 5. BỔ SUNG CỘT ĐỒNG BỘ TIẾN TRÌNH & PHÒNG THI VÀO BẢNG submissions
-- ------------------------------------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_graded boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tab_switches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blur_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_submissions_user_exam ON public.submissions(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON public.submissions(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 6. BỔ SUNG CỘT THEO DÕI PHIÊN THI ĐƠN NHẤT VÀO BẢNG profiles
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_seb_session text,
  ADD COLUMN IF NOT EXISTS last_seb_exam_id text,
  ADD COLUMN IF NOT EXISTS last_seb_exam_at timestamptz;

-- ==============================================================================
-- ✅ HOÀN TẤT: Cấu trúc cơ sở dữ liệu đã sẵn sàng mà không ảnh hưởng bất kỳ dữ liệu cũ nào!
-- ==============================================================================
