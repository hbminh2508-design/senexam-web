-- ==============================================================================
-- MIGRATION 006: SEN CHAT E2EE TABLES & SIGNAL PROTOCOL CRYPTOGRAPHIC ENGINE
-- Mục đích: Hệ thống bảng E2EE cho Sen Chat (chat.senexam.me / app/m/chat)
-- Nguyên tắc: Chỉ thêm (IF NOT EXISTS), không DROP, bật RLS mọi bảng, RPC nguyên tử
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG THIẾT BỊ NGƯỜI DÙNG (CHAT_DEVICES)
-- Mỗi thiết bị có Identity Key riêng, Registration ID kiểu Signal Protocol
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT DEFAULT 'Sen Chat Device',
  platform TEXT DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios', 'desktop')),
  identity_key TEXT NOT NULL, -- Public Identity Key (Base64)
  registration_id INTEGER NOT NULL, -- Signal Registration ID (1..16380)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chat_device_per_user UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_devices_user ON public.chat_devices(user_id, is_active);

-- ------------------------------------------------------------------------------
-- 2. BẢNG PREKEYS CHO X3DH (CHAT_PREKEYS)
-- Lưu Signed Prekeys & One-Time Prekeys (OPK) phục vụ khởi tạo phiên E2EE Signal
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL, -- Public Key (Base64)
  key_type TEXT NOT NULL CHECK (key_type IN ('signed_prekey', 'one_time_prekey')),
  signature TEXT, -- Chữ ký điện tử của Identity Key cho Signed Prekey
  is_consumed BOOLEAN NOT NULL DEFAULT false,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chat_prekey UNIQUE (user_id, device_id, key_id, key_type)
);

CREATE INDEX IF NOT EXISTS idx_chat_prekeys_lookup 
ON public.chat_prekeys(user_id, device_id, key_type, is_consumed);

-- ------------------------------------------------------------------------------
-- 3. BẢNG QUAN HỆ BẠN BÈ / KẾT NỐI (CHAT_FRIENDSHIPS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chat_friendship UNIQUE (user_id, friend_id),
  CONSTRAINT chk_friendship_distinct CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_friendships_users ON public.chat_friendships(user_id, friend_id);

-- ------------------------------------------------------------------------------
-- 4. BẢNG PHÒNG HỘI THOẠI (CHAT_CONVERSATIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON public.chat_conversations(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 5. BẢNG THÀNH VIÊN PHÒNG HỘI THOẠI (CHAT_MEMBERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,
  CONSTRAINT uq_chat_conv_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id, conversation_id);

-- ------------------------------------------------------------------------------
-- 6. BẢNG TIN NHẮN E2EE (CHAT_MESSAGES)
-- Chỉ lưu ciphertext và metadata tối thiểu, tuyệt đối không lưu plaintext
-- Chống replay bằng counter, nonce, và idempotency_key
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_device_id TEXT NOT NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_device_id TEXT,
  ciphertext TEXT NOT NULL, -- Dữ liệu mã hóa E2EE (Base64)
  message_type INTEGER NOT NULL DEFAULT 1, -- 1: Normal Signal, 2: PreKeyWhisper, 3: AttachmentDescriptor
  counter BIGINT NOT NULL DEFAULT 0, -- Ratchet counter chống replay
  nonce TEXT NOT NULL, -- IV / Nonce 12-byte ngẫu nhiên (Base64)
  ephemeral_ratchet_key TEXT, -- Public key cho bước Double Ratchet mới (nếu có)
  idempotency_key TEXT NOT NULL, -- UUID/Key chống gửi trùng và chống replay
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chat_message_idempotency UNIQUE (conversation_id, sender_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created 
ON public.chat_messages(conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 7. BẢNG TỆP ĐÍNH KÈM CHAT (CHAT_ATTACHMENTS)
-- Lưu metadata tệp đã mã hóa E2EE trên Google Drive API
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL, -- Google Drive File ID bảo mật
  encrypted_file_hash TEXT NOT NULL, -- SHA-256 hash của tệp mã hóa để xác minh toàn vẹn
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_msg ON public.chat_attachments(message_id);

-- ------------------------------------------------------------------------------
-- 8. BẢNG NHẬT KÝ KIỂM TOÁN AN NINH (CHAT_AUDIT_EVENTS)
-- Ghi nhận các sự kiện: đổi Identity Key, phát hiện replay, xác minh safety number
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'device_registered', 'identity_key_changed', 'replay_blocked', 'safety_verified'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_events_user ON public.chat_audit_events(user_id, created_at DESC);

-- ==============================================================================
-- BẬT ROW LEVEL SECURITY (RLS) TRÊN CẢ 8 BẢNG
-- ==============================================================================
ALTER TABLE public.chat_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_prekeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_audit_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH BẢO MẬT RLS CHO TỪNG BẢNG
-- ------------------------------------------------------------------------------

-- chat_devices
DROP POLICY IF EXISTS "chat_devices_select_active" ON public.chat_devices;
CREATE POLICY "chat_devices_select_active" ON public.chat_devices
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "chat_devices_insert_own" ON public.chat_devices;
CREATE POLICY "chat_devices_insert_own" ON public.chat_devices
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_devices_update_own" ON public.chat_devices;
CREATE POLICY "chat_devices_update_own" ON public.chat_devices
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chat_prekeys
DROP POLICY IF EXISTS "chat_prekeys_select" ON public.chat_prekeys;
CREATE POLICY "chat_prekeys_select" ON public.chat_prekeys
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_prekeys_manage_own" ON public.chat_prekeys;
CREATE POLICY "chat_prekeys_manage_own" ON public.chat_prekeys
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chat_friendships
DROP POLICY IF EXISTS "chat_friendships_select" ON public.chat_friendships;
CREATE POLICY "chat_friendships_select" ON public.chat_friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "chat_friendships_insert" ON public.chat_friendships;
CREATE POLICY "chat_friendships_insert" ON public.chat_friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_friendships_update" ON public.chat_friendships;
CREATE POLICY "chat_friendships_update" ON public.chat_friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- chat_conversations
DROP POLICY IF EXISTS "chat_conversations_select_member" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_member" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_conversations.id
        AND chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_conversations_insert_auth" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert_auth" ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- chat_members
DROP POLICY IF EXISTS "chat_members_select" ON public.chat_members;
CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_members.conversation_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_members.conversation_id
        AND c.created_by = auth.uid()
    )
  );

-- chat_messages
DROP POLICY IF EXISTS "chat_messages_select_member" ON public.chat_messages;
CREATE POLICY "chat_messages_select_member" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_messages.conversation_id
        AND chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert_sender" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_sender" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_messages.conversation_id
        AND chat_members.user_id = auth.uid()
    )
  );

-- chat_attachments
DROP POLICY IF EXISTS "chat_attachments_select_member" ON public.chat_attachments;
CREATE POLICY "chat_attachments_select_member" ON public.chat_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_attachments.conversation_id
        AND chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_attachments_insert_uploader" ON public.chat_attachments;
CREATE POLICY "chat_attachments_insert_uploader" ON public.chat_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id AND
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_attachments.conversation_id
        AND chat_members.user_id = auth.uid()
    )
  );

-- chat_audit_events
DROP POLICY IF EXISTS "chat_audit_events_select_own" ON public.chat_audit_events;
CREATE POLICY "chat_audit_events_select_own" ON public.chat_audit_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_audit_events_insert_own" ON public.chat_audit_events;
CREATE POLICY "chat_audit_events_insert_own" ON public.chat_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- THAO TÁC NHẠY CẢM QUA RPC NGUYÊN TỬ (ATOMIC STORED PROCEDURES)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC 1: ĐĂNG KÝ THIẾT BỊ VÀ NẠP PREKEYS NGUYÊN TỬ
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_chat_device(
  p_device_id TEXT,
  p_device_name TEXT,
  p_platform TEXT,
  p_identity_key TEXT,
  p_registration_id INTEGER,
  p_signed_prekey JSONB,
  p_one_time_prekeys JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_prev_device RECORD;
  v_otk JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  -- 1. Kiểm tra thiết bị cũ xem Identity Key có thay đổi không (Phát hiện đổi khóa)
  SELECT identity_key INTO v_prev_device
  FROM public.chat_devices
  WHERE user_id = v_user_id AND device_id = p_device_id;

  IF FOUND AND v_prev_device.identity_key <> p_identity_key THEN
    INSERT INTO public.chat_audit_events (user_id, event_type, details)
    VALUES (
      v_user_id,
      'identity_key_changed',
      jsonb_build_object(
        'device_id', p_device_id,
        'old_identity_key', v_prev_device.identity_key,
        'new_identity_key', p_identity_key
      )
    );
  END IF;

  -- 2. Upsert thông tin thiết bị
  INSERT INTO public.chat_devices (
    user_id, device_id, device_name, platform, identity_key, registration_id, is_active, last_seen_at
  )
  VALUES (
    v_user_id, p_device_id, COALESCE(p_device_name, 'Sen Chat Device'),
    COALESCE(p_platform, 'web'), p_identity_key, p_registration_id, true, NOW()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    device_name = EXCLUDED.device_name,
    platform = EXCLUDED.platform,
    identity_key = EXCLUDED.identity_key,
    registration_id = EXCLUDED.registration_id,
    is_active = true,
    last_seen_at = NOW();

  -- 3. Lưu Signed Prekey
  IF p_signed_prekey IS NOT NULL AND p_signed_prekey ? 'key_id' THEN
    INSERT INTO public.chat_prekeys (
      user_id, device_id, key_id, public_key, key_type, signature
    )
    VALUES (
      v_user_id,
      p_device_id,
      (p_signed_prekey->>'key_id')::INTEGER,
      p_signed_prekey->>'public_key',
      'signed_prekey',
      p_signed_prekey->>'signature'
    )
    ON CONFLICT (user_id, device_id, key_id, key_type) DO UPDATE SET
      public_key = EXCLUDED.public_key,
      signature = EXCLUDED.signature,
      is_consumed = false;
  END IF;

  -- 4. Lưu One-Time Prekeys
  IF p_one_time_prekeys IS NOT NULL AND jsonb_array_length(p_one_time_prekeys) > 0 THEN
    FOR v_otk IN SELECT * FROM jsonb_array_elements(p_one_time_prekeys)
    LOOP
      INSERT INTO public.chat_prekeys (
        user_id, device_id, key_id, public_key, key_type, is_consumed
      )
      VALUES (
        v_user_id,
        p_device_id,
        (v_otk->>'key_id')::INTEGER,
        v_otk->>'public_key',
        'one_time_prekey',
        false
      )
      ON CONFLICT (user_id, device_id, key_id, key_type) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        is_consumed = false;
    END LOOP;
  END IF;

  -- 5. Ghi nhận nhật ký audit
  INSERT INTO public.chat_audit_events (user_id, event_type, details)
  VALUES (
    v_user_id,
    'device_registered',
    jsonb_build_object(
      'device_id', p_device_id,
      'registration_id', p_registration_id,
      'platform', p_platform
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Đăng ký thiết bị E2EE thành công');
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 2: LẤY VÀ TIÊU THỤ PREKEY BUNDLE CỦA ĐỐI PHƯƠNG (X3DH HANDSHAKE)
-- Lấy Identity Key, Signed Prekey và 1 One-Time Prekey nguyên tử (FOR UPDATE SKIP LOCKED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_and_consume_prekey_bundle(
  p_target_user_id UUID,
  p_target_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device RECORD;
  v_spk RECORD;
  v_opk RECORD;
BEGIN
  -- 1. Tìm thiết bị active của đối phương
  SELECT * INTO v_device
  FROM public.chat_devices
  WHERE user_id = p_target_user_id
    AND is_active = true
    AND (p_target_device_id IS NULL OR device_id = p_target_device_id)
  ORDER BY last_seen_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy thiết bị hoạt động của đối phương');
  END IF;

  -- 2. Lấy Signed Prekey mới nhất của thiết bị đó
  SELECT key_id, public_key, signature INTO v_spk
  FROM public.chat_prekeys
  WHERE user_id = p_target_user_id
    AND device_id = v_device.device_id
    AND key_type = 'signed_prekey'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Thiết bị đối phương chưa tạo Signed Prekey');
  END IF;

  -- 3. Lấy và đánh dấu One-Time Prekey (nếu còn) một cách nguyên tử
  SELECT id, key_id, public_key INTO v_opk
  FROM public.chat_prekeys
  WHERE user_id = p_target_user_id
    AND device_id = v_device.device_id
    AND key_type = 'one_time_prekey'
    AND is_consumed = false
  ORDER BY key_id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.chat_prekeys
    SET is_consumed = true, consumed_at = NOW()
    WHERE id = v_opk.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'device_id', v_device.device_id,
    'registration_id', v_device.registration_id,
    'identity_key', v_device.identity_key,
    'signed_prekey', jsonb_build_object(
      'key_id', v_spk.key_id,
      'public_key', v_spk.public_key,
      'signature', v_spk.signature
    ),
    'one_time_prekey', CASE 
      WHEN v_opk.key_id IS NOT NULL THEN jsonb_build_object('key_id', v_opk.key_id, 'public_key', v_opk.public_key)
      ELSE NULL
    END
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 3: GỬI TIN NHẮN E2EE VỚI KIỂM SOÁT CHỐNG REPLAY & IDEMPOTENCY NGUYÊN TỬ
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_e2ee_message(
  p_conversation_id UUID,
  p_sender_device_id TEXT,
  p_recipient_id UUID,
  p_recipient_device_id TEXT,
  p_ciphertext TEXT,
  p_message_type INTEGER,
  p_counter BIGINT,
  p_nonce TEXT,
  p_ephemeral_ratchet_key TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_existing_msg RECORD;
  v_new_msg RECORD;
  v_is_member BOOLEAN;
BEGIN
  IF v_sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  -- 1. Kiểm tra tính thành viên trong cuộc trò chuyện
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = p_conversation_id AND user_id = v_sender_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'Người dùng không thuộc hội thoại này');
  END IF;

  -- 2. Kiểm tra Idempotency Key (Chống gửi lặp và replay attack)
  SELECT id, created_at INTO v_existing_msg
  FROM public.chat_messages
  WHERE conversation_id = p_conversation_id
    AND sender_id = v_sender_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message_id', v_existing_msg.id,
      'created_at', v_existing_msg.created_at,
      'message', 'Tin nhắn đã được ghi nhận trước đó (Idempotent replay protection)'
    );
  END IF;

  -- 3. Chèn tin nhắn mã hóa E2EE
  INSERT INTO public.chat_messages (
    conversation_id, sender_id, sender_device_id, recipient_id, recipient_device_id,
    ciphertext, message_type, counter, nonce, ephemeral_ratchet_key, idempotency_key, created_at
  )
  VALUES (
    p_conversation_id, v_sender_id, p_sender_device_id, p_recipient_id, p_recipient_device_id,
    p_ciphertext, p_message_type, p_counter, p_nonce, p_ephemeral_ratchet_key, p_idempotency_key, NOW()
  )
  RETURNING * INTO v_new_msg;

  -- 4. Cập nhật thời gian hội thoại
  UPDATE public.chat_conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'message_id', v_new_msg.id,
    'created_at', v_new_msg.created_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 4: TẠO HOẶC LẤY HỘI THOẠI 1-1 (DIRECT CONVERSATION) NGUYÊN TỬ
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_or_get_direct_conversation(
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_conv_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF v_user_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không thể tạo hội thoại với chính mình');
  END IF;

  -- 1. Tìm hội thoại 1-1 đã có giữa 2 người
  SELECT m1.conversation_id INTO v_conv_id
  FROM public.chat_members m1
  JOIN public.chat_members m2 ON m1.conversation_id = m2.conversation_id
  JOIN public.chat_conversations c ON c.id = m1.conversation_id
  WHERE c.type = 'direct'
    AND m1.user_id = v_user_id
    AND m2.user_id = p_recipient_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'conversation_id', v_conv_id, 'is_new', false);
  END IF;

  -- 2. Nếu chưa có, tạo hội thoại mới và thêm 2 thành viên
  INSERT INTO public.chat_conversations (type, created_by, metadata)
  VALUES ('direct', v_user_id, jsonb_build_object('direct_pair', ARRAY[v_user_id, p_recipient_id]))
  RETURNING id INTO v_conv_id;

  INSERT INTO public.chat_members (conversation_id, user_id, role)
  VALUES 
    (v_conv_id, v_user_id, 'owner'),
    (v_conv_id, p_recipient_id, 'member');

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conv_id, 'is_new', true);
END;
$$;
