-- ==============================================================================
-- SCRIPT SUPABASE SQL: KHỞI TẠO TÀI KHOẢN ADMIN VÀ BẢO MẬT QUẢN LÝ PHIÊN (IDP 2.0)
-- Đảm bảo an toàn 100%: Dùng IF NOT EXISTS, ON CONFLICT, không xóa bỏ dữ liệu cũ.
-- ==============================================================================

-- 1. BẬT TIỆN ÍCH MÃ HÓA MẬT KHẨU
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TẠO CỘT LƯU GÓC NHÌN QUẢN TRỊ TRONG PROFILES (NẾU CHƯA CÓ)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS admin_view_perspective text DEFAULT 'admin';

-- 3. BẢNG QUẢN LÝ PHIÊN THIẾT BỊ NGƯỜI DÙNG (fepn_user_sessions)
CREATE TABLE IF NOT EXISTS public.fepn_user_sessions (
    id text PRIMARY KEY DEFAULT ('sess-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    device_name text DEFAULT 'Thiết bị Web',
    device_type text DEFAULT 'desktop',
    browser text DEFAULT 'Trình duyệt Web',
    os text DEFAULT 'Hệ điều hành',
    ip_address text DEFAULT '127.0.0.1',
    is_active boolean DEFAULT true,
    last_active_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
);

-- Index tăng tốc truy vấn danh sách phiên
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.fepn_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON public.fepn_user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON public.fepn_user_sessions(last_active_at DESC);

-- Bật RLS cho bảng phiên
ALTER TABLE public.fepn_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sessions" ON public.fepn_user_sessions;
CREATE POLICY "Users view own sessions" ON public.fepn_user_sessions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on sessions" ON public.fepn_user_sessions;
CREATE POLICY "Service role full access on sessions" ON public.fepn_user_sessions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. BẢNG NHẬT KÝ CẤP TÀI KHOẢN CỦA ADMIN (admin_grants_log)
CREATE TABLE IF NOT EXISTS public.admin_grants_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    kind text DEFAULT 'provision_account',
    amount numeric DEFAULT 0,
    note text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_grants_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on admin_grants_log" ON public.admin_grants_log;
CREATE POLICY "Service role full access on admin_grants_log" ON public.admin_grants_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 5. KHỞI TẠO HOẶC CẬP NHẬT TÀI KHOẢN ADMIN:
-- Email: admin@senexam.me (Username: admin)
-- Mật khẩu: admin-16/10/2026
-- Vai trò: admin
-- ==============================================================================

DO $$
DECLARE
    v_admin_id uuid;
    v_password text := 'admin-16/10/2026';
    v_encrypted_pwd text;
BEGIN
    -- Sinh mã băm mật khẩu chuẩn bcrypt
    v_encrypted_pwd := crypt(v_password, gen_salt('bf'));

    -- Kiểm tra xem tài khoản admin@senexam.me đã tồn tại trong auth.users chưa
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@senexam.me';

    IF v_admin_id IS NULL THEN
        -- Tạo mới tài khoản trong auth.users
        v_admin_id := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_admin_id,
            'authenticated',
            'authenticated',
            'admin@senexam.me',
            v_encrypted_pwd,
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"SenExam System Administrator","role":"admin"}',
            now(),
            now()
        );
    ELSE
        -- Nếu tài khoản đã tồn tại, đồng bộ mật khẩu mới và kích hoạt xác thực
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pwd,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
            updated_at = now()
        WHERE id = v_admin_id;
    END IF;

    -- Đồng bộ thông tin quản trị vào bảng public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        plan_tier,
        sencash_balance,
        created_at
    ) VALUES (
        v_admin_id,
        'admin@senexam.me',
        'SenExam System Administrator',
        'admin',
        'sen_one',
        999999,
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        plan_tier = 'sen_one',
        sencash_balance = GREATEST(COALESCE(public.profiles.sencash_balance, 0), 999999);

    RAISE NOTICE '✓ Tài khoản admin@senexam.me đã được khởi tạo/đồng bộ thành công với ID: %', v_admin_id;
END $$;
