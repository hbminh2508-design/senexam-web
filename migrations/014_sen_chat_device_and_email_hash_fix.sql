-- ==============================================================================
-- MIGRATION 014: FIX SEN CHAT EMAIL HASH LOOKUP & DEVICE REGISTRATION RPC
-- 1. Sync email and email_hash for all existing accounts in profiles
-- 2. Update lookup_user_by_email_hash to support service_role and self-detection
-- 3. Ensure chat_devices and chat_audit_events are ready for auto-registration
-- ==============================================================================

-- 1. ĐỒNG BỘ EMAIL TỪ auth.users NẾU profiles.email CÒN TRỐNG
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR trim(p.email) = '') AND u.email IS NOT NULL;

-- 2. TÍNH TOÁN EMAIL_HASH CHUẨN XÁC CHO TOÀN BỘ TÀI KHOẢN TRONG profiles
UPDATE public.profiles
SET email_hash = encode(sha256(lower(trim(email))::bytea), 'hex')
WHERE email IS NOT NULL AND trim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON public.profiles(email_hash) WHERE email_hash IS NOT NULL;

-- 3. TRIGGER TỰ ĐỘNG TÍNH email_hash KHI PROFILE THAY ĐỔI EMAIL
CREATE OR REPLACE FUNCTION public.sync_profile_email_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND trim(NEW.email) <> '' THEN
    NEW.email_hash := encode(sha256(lower(trim(NEW.email))::bytea), 'hex');
  ELSE
    NEW.email_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_hash ON public.profiles;
CREATE TRIGGER trg_sync_profile_email_hash
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_hash();

-- 4. DROP VÀ TẠO LẠI lookup_user_by_email_hash HỖ TRỢ SERVICE_ROLE VÀ NHẬN DIỆN CHÍNH MÌNH
DROP FUNCTION IF EXISTS public.lookup_user_by_email_hash(TEXT);
DROP FUNCTION IF EXISTS public.lookup_user_by_email_hash(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.lookup_user_by_email_hash(
  p_email_hash TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_target RECORD;
  v_friendship RECORD;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF p_email_hash IS NULL OR length(p_email_hash) <> 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hash email không hợp lệ');
  END IF;

  -- Tra cứu theo email_hash
  SELECT id, full_name, avatar_url, school, class_name, allow_search_by_email
  INTO v_target
  FROM public.profiles
  WHERE email_hash = lower(trim(p_email_hash))
  LIMIT 1;

  -- Nếu không tìm thấy hoặc người dùng đã tắt cho phép tìm kiếm
  IF NOT FOUND OR NOT COALESCE(v_target.allow_search_by_email, true) THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'Không tìm thấy người dùng phù hợp');
  END IF;

  -- Nếu tìm email của chính mình
  IF v_target.id = v_caller_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', false,
      'is_self', true,
      'message', 'Đây là email tài khoản của chính bạn.'
    );
  END IF;

  -- Kiểm tra trạng thái bạn bè / chặn
  SELECT status INTO v_friendship
  FROM public.chat_friendships
  WHERE (user_id = v_caller_id AND friend_id = v_target.id)
     OR (user_id = v_target.id AND friend_id = v_caller_id)
  LIMIT 1;

  IF FOUND AND v_friendship.status = 'blocked' THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'Không thể kết nối với người dùng này');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'user', jsonb_build_object(
      'id', v_target.id,
      'name', COALESCE(v_target.full_name, 'Học viên SenExam'),
      'avatar', COALESCE(v_target.avatar_url, ''),
      'school', COALESCE(v_target.school, ''),
      'className', COALESCE(v_target.class_name, ''),
      'friendshipStatus', COALESCE(v_friendship.status, 'none')
    )
  );
END;
$$;
