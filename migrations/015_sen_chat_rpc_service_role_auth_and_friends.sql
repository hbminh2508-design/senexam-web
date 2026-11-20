-- ==============================================================================
-- MIGRATION 015: FIX SERVICE_ROLE CALLER AUTH IN ALL SEN CHAT RPCS & SYNC MISSING PROFILES
-- 1. Ensure all auth.users have a profile and email_hash
-- 2. Upgrade send_friend_invitation, respond_friend_invitation, revoke_chat_device, recall_chat_message
--    to support p_caller_id for service_role invocations
-- ==============================================================================

-- 1. ĐỒNG BỘ CÁC USER CHƯA CÓ TRONG PROFILES TỪ AUTH.USERS
INSERT INTO public.profiles (id, email, full_name, email_hash)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'full_name', 'Học viên SenExam'),
  encode(sha256(lower(trim(u.email))::bytea), 'hex')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL AND u.email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  email_hash = EXCLUDED.email_hash
WHERE public.profiles.email IS NULL OR public.profiles.email_hash IS NULL;

-- Cập nhật lại email_hash cho toàn bộ profiles hiện hữu nếu chưa có
UPDATE public.profiles
SET email_hash = encode(sha256(lower(trim(email))::bytea), 'hex')
WHERE email IS NOT NULL AND trim(email) <> '' AND (email_hash IS NULL OR email_hash = '');

-- 2. DROP VÀ TẠO LẠI SEND_FRIEND_INVITATION VỚI THAM SỐ P_CALLER_ID
DROP FUNCTION IF EXISTS public.send_friend_invitation(UUID);
DROP FUNCTION IF EXISTS public.send_friend_invitation(UUID, UUID);

CREATE OR REPLACE FUNCTION public.send_friend_invitation(
  p_friend_id UUID,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_existing RECORD;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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

-- 3. DROP VÀ TẠO LẠI RESPOND_FRIEND_INVITATION VỚI THAM SỐ P_CALLER_ID
DROP FUNCTION IF EXISTS public.respond_friend_invitation(UUID, TEXT);
DROP FUNCTION IF EXISTS public.respond_friend_invitation(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.respond_friend_invitation(
  p_sender_id UUID,
  p_action TEXT, -- 'accept', 'reject', 'block'
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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

-- 4. DROP VÀ TẠO LẠI REVOKE_CHAT_DEVICE VỚI THAM SỐ P_CALLER_ID
DROP FUNCTION IF EXISTS public.revoke_chat_device(TEXT);
DROP FUNCTION IF EXISTS public.revoke_chat_device(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.revoke_chat_device(
  p_device_id TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
    jsonb_build_object('device_id', p_device_id, 'timestamp', NOW())
  );

  RETURN jsonb_build_object('success', true, 'message', 'Đã thu hồi quyền truy cập của thiết bị');
END;
$$;

-- 5. DROP VÀ TẠO LẠI RECALL_CHAT_MESSAGE VỚI THAM SỐ P_CALLER_ID
DROP FUNCTION IF EXISTS public.recall_chat_message(UUID);
DROP FUNCTION IF EXISTS public.recall_chat_message(UUID, UUID);

CREATE OR REPLACE FUNCTION public.recall_chat_message(
  p_message_id UUID,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_msg RECORD;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
