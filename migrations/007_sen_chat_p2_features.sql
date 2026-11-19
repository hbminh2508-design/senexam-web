-- ==============================================================================
-- MIGRATION 007: SEN CHAT P2 ADVANCED MESSAGING & SECURITY ENHANCEMENTS
-- Cập nhật tính năng: Tin nhắn tự hủy, thu hồi, báo cáo, chống enumeration email,
-- quản lý thiết bị từ xa và cài đặt quyền riêng tư
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BỔ SUNG CỘT CHO BẢNG CHAT_MESSAGES
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_expires 
ON public.chat_messages(expires_at) 
WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. BỔ SUNG CỘT CHO BẢNG PROFILES (QUYỀN RIÊNG TƯ & TRA CỨU HASH EMAIL)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allow_search_by_email BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_hash TEXT;

-- Tự động cập nhật email_hash (SHA-256) cho các profile hiện có
UPDATE public.profiles
SET email_hash = encode(digest(lower(trim(email)), 'sha256'), 'hex')
WHERE email IS NOT NULL AND (email_hash IS NULL OR email_hash = '');

CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON public.profiles(email_hash) WHERE email_hash IS NOT NULL;

-- Trigger tự động cập nhật email_hash khi profile thay đổi email
CREATE OR REPLACE FUNCTION public.sync_profile_email_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email_hash := encode(digest(lower(trim(NEW.email)), 'sha256'), 'hex');
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

-- ------------------------------------------------------------------------------
-- 3. BẢNG BÁO CÁO NGƯỜI DÙNG (CHAT_REPORTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_reports_insert_own" ON public.chat_reports;
CREATE POLICY "chat_reports_insert_own" ON public.chat_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "chat_reports_select_own" ON public.chat_reports;
CREATE POLICY "chat_reports_select_own" ON public.chat_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- ------------------------------------------------------------------------------
-- 4. RPC TRA CỨU NGƯỜI DÙNG BẰNG EMAIL HASH (CHỐNG EMAIL ENUMERATION)
-- Chỉ tìm thấy nếu người dùng cho phép allow_search_by_email = true
-- Trả về dữ liệu an toàn tối thiểu, không lộ email thật
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_user_by_email_hash(
  p_email_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target RECORD;
  v_friendship RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF p_email_hash IS NULL OR length(p_email_hash) <> 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hash email không hợp lệ');
  END IF;

  -- Tìm kiếm theo email_hash (constant-time / index scan)
  SELECT id, full_name, avatar_url, school, class_name, allow_search_by_email
  INTO v_target
  FROM public.profiles
  WHERE email_hash = lower(trim(p_email_hash))
  LIMIT 1;

  -- Nếu không tìm thấy hoặc người dùng đã tắt tính năng cho phép tìm kiếm qua email
  IF NOT FOUND OR NOT COALESCE(v_target.allow_search_by_email, true) THEN
    -- Trả về thông điệp chung để chống enumeration
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'Không tìm thấy người dùng phù hợp');
  END IF;

  IF v_target.id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'Không thể kết bạn với chính mình');
  END IF;

  -- Kiểm tra tình trạng kết bạn hiện tại
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

-- ------------------------------------------------------------------------------
-- 5. RPC GỬI LỜI MỜI KẾT BẠN (FRIEND INVITATION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_friend_invitation(
  p_friend_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_existing RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF v_caller_id = p_friend_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không thể gửi lời mời cho chính mình');
  END IF;

  -- Kiểm tra quan hệ sẵn có
  SELECT id, user_id, friend_id, status INTO v_existing
  FROM public.chat_friendships
  WHERE (user_id = v_caller_id AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = v_caller_id)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', true, 'status', 'accepted', 'message', 'Hai bạn đã là bạn bè');
    ELSIF v_existing.status = 'blocked' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Không thể gửi lời mời kết bạn');
    ELSE
      RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Lời mời kết bạn đang chờ phản hồi');
    END IF;
  END IF;

  -- Chèn lời mời mới
  INSERT INTO public.chat_friendships (user_id, friend_id, status)
  VALUES (v_caller_id, p_friend_id, 'pending');

  RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Đã gửi lời mời kết bạn thành công');
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC PHẢN HỒI LỜI MỜI KẾT BẠN / CHẶN (ACCEPT, REJECT, BLOCK)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_friend_invitation(
  p_sender_id UUID,
  p_action TEXT -- 'accept', 'reject', 'block'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.chat_friendships
    SET status = 'accepted', updated_at = NOW()
    WHERE (user_id = p_sender_id AND friend_id = v_caller_id AND status = 'pending')
       OR (user_id = v_caller_id AND friend_id = p_sender_id AND status = 'pending');
    RETURN jsonb_build_object('success', true, 'message', 'Đã đồng ý lời mời kết bạn');

  ELSIF p_action = 'reject' THEN
    DELETE FROM public.chat_friendships
    WHERE (user_id = p_sender_id AND friend_id = v_caller_id AND status = 'pending')
       OR (user_id = v_caller_id AND friend_id = p_sender_id AND status = 'pending');
    RETURN jsonb_build_object('success', true, 'message', 'Đã từ chối lời mời kết bạn');

  ELSIF p_action = 'block' THEN
    INSERT INTO public.chat_friendships (user_id, friend_id, status, updated_at)
    VALUES (v_caller_id, p_sender_id, 'blocked', NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET
      status = 'blocked', updated_at = NOW();
    RETURN jsonb_build_object('success', true, 'message', 'Đã chặn người dùng');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Hành động không hợp lệ');
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC THU HỒI TIN NHẮN (RECALL MESSAGE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recall_chat_message(
  p_message_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_msg RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  SELECT id, sender_id, created_at INTO v_msg
  FROM public.chat_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy tin nhắn');
  END IF;

  IF v_msg.sender_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bạn chỉ có thể thu hồi tin nhắn của chính mình');
  END IF;

  -- Thu hồi: Đánh dấu is_recalled = true và xóa sạch ciphertext
  UPDATE public.chat_messages
  SET is_recalled = true,
      ciphertext = '[RECALLED]'
  WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message', 'Tin nhắn đã được thu hồi');
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC HỦY KÍCH HOẠT THIẾT BỊ TỪ XA (REMOTE REVOKE DEVICE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_chat_device(
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  UPDATE public.chat_devices
  SET is_active = false, last_seen_at = NOW()
  WHERE user_id = v_caller_id AND device_id = p_device_id;

  -- Xóa các prekeys chưa tiêu thụ của thiết bị này
  DELETE FROM public.chat_prekeys
  WHERE user_id = v_caller_id AND device_id = p_device_id;

  -- Ghi nhận nhật ký kiểm toán
  INSERT INTO public.chat_audit_events (user_id, event_type, details)
  VALUES (
    v_caller_id,
    'device_revoked',
    jsonb_build_object('device_id', p_device_id, 'revoked_at', NOW())
  );

  RETURN jsonb_build_object('success', true, 'message', 'Đã hủy kích hoạt thiết bị thành công');
END;
$$;
