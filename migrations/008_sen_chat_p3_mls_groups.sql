-- ==============================================================================
-- MIGRATION 008: SEN CHAT P3 MLS (RFC 9420) GROUP MESSAGING & ROLE PERMISSIONS
-- Chuẩn hóa mã hóa nhóm đầu-cuối MLS RFC 9420 bằng thư viện ts-mls
-- Quản trị vai trò (owner, admin, member), xoay khóa (MLS Commit) khi thêm/xóa
-- RLS nghiêm ngặt: chỉ thành viên mới được xem/gửi, chỉ bạn bè mới được thêm vào nhóm
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BỔ SUNG CỘT CHO BẢNG CHAT_CONVERSATIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS epoch BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ciphersuite TEXT NOT NULL DEFAULT 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256',
ADD COLUMN IF NOT EXISTS mls_group_id TEXT;

-- ------------------------------------------------------------------------------
-- 2. BẢNG KEY PACKAGES CHO MLS (CHAT_MLS_KEY_PACKAGES)
-- Lưu trữ các public KeyPackage phục vụ mời và gia nhập nhóm MLS RFC 9420
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_mls_key_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  key_package_ref TEXT NOT NULL,
  key_package_data TEXT NOT NULL, -- Serialized KeyPackage JSON (chứa Uint8Array Base64)
  ciphersuite TEXT NOT NULL DEFAULT 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256',
  is_consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mls_key_package_ref UNIQUE (key_package_ref)
);

CREATE INDEX IF NOT EXISTS idx_chat_mls_kp_user 
ON public.chat_mls_key_packages(user_id, is_consumed, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. BẢNG LỊCH SỬ MLS COMMITS & WELCOME (CHAT_MLS_COMMITS)
-- Ghi nhận các Commit xoay khóa khi thêm/xóa thành viên và gói Welcome cho người mới
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_mls_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  epoch BIGINT NOT NULL,
  commit_message TEXT NOT NULL, -- Serialized MLS Commit Message
  welcome_message TEXT, -- Serialized MLS Welcome Message (chỉ có khi thêm thành viên)
  welcome_for_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ratchet_tree TEXT, -- Serialized Ratchet Tree để đồng bộ cây khóa ngoài băng
  action_type TEXT NOT NULL CHECK (action_type IN ('create_group', 'add_member', 'remove_member', 'update_key')),
  committed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_mls_commits_conv 
ON public.chat_mls_commits(conversation_id, epoch ASC);

CREATE INDEX IF NOT EXISTS idx_chat_mls_commits_welcome 
ON public.chat_mls_commits(welcome_for_user_id, conversation_id);

-- ------------------------------------------------------------------------------
-- 4. BẬT RLS VÀ CẬP NHẬT POLICIES BẢO MẬT
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_mls_key_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mls_commits ENABLE ROW LEVEL SECURITY;

-- chat_mls_key_packages
DROP POLICY IF EXISTS "chat_mls_kp_select" ON public.chat_mls_key_packages;
CREATE POLICY "chat_mls_kp_select" ON public.chat_mls_key_packages
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_mls_kp_insert_own" ON public.chat_mls_key_packages;
CREATE POLICY "chat_mls_kp_insert_own" ON public.chat_mls_key_packages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_mls_kp_update_own" ON public.chat_mls_key_packages;
CREATE POLICY "chat_mls_kp_update_own" ON public.chat_mls_key_packages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_mls_kp_delete_own" ON public.chat_mls_key_packages;
CREATE POLICY "chat_mls_kp_delete_own" ON public.chat_mls_key_packages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- chat_mls_commits
DROP POLICY IF EXISTS "chat_mls_commits_select_member" ON public.chat_mls_commits;
CREATE POLICY "chat_mls_commits_select_member" ON public.chat_mls_commits
  FOR SELECT TO authenticated
  USING (
    welcome_for_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_mls_commits.conversation_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_mls_commits_insert_member" ON public.chat_mls_commits;
CREATE POLICY "chat_mls_commits_insert_member" ON public.chat_mls_commits
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = committed_by AND
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_mls_commits.conversation_id
        AND m.user_id = auth.uid()
    )
  );

-- Cập nhật Policies cho chat_conversations: chỉ owner/admin mới sửa được info
DROP POLICY IF EXISTS "chat_conversations_update_admin" ON public.chat_conversations;
CREATE POLICY "chat_conversations_update_admin" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_conversations.id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_conversations.id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "chat_conversations_delete_owner" ON public.chat_conversations;
CREATE POLICY "chat_conversations_delete_owner" ON public.chat_conversations
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_conversations.id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- Cập nhật Policies cho chat_members:
-- Xóa thành viên: bản thân tự rời, hoặc owner xóa bất kỳ ai, hoặc admin xóa member
DROP POLICY IF EXISTS "chat_members_delete_policy" ON public.chat_members;
CREATE POLICY "chat_members_delete_policy" ON public.chat_members
  FOR DELETE TO authenticated
  USING (
    -- Tự rời nhóm
    user_id = auth.uid() OR
    -- Owner có quyền xóa bất kỳ ai
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_members.conversation_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    ) OR
    -- Admin có quyền xóa regular member
    (
      chat_members.role = 'member' AND
      EXISTS (
        SELECT 1 FROM public.chat_members m
        WHERE m.conversation_id = chat_members.conversation_id
          AND m.user_id = auth.uid()
          AND m.role = 'admin'
      )
    )
  );

-- Cập nhật vai trò (role): chỉ Owner mới được promote/demote
DROP POLICY IF EXISTS "chat_members_update_role" ON public.chat_members;
CREATE POLICY "chat_members_update_role" ON public.chat_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_members.conversation_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_members.conversation_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- ------------------------------------------------------------------------------
-- 5. RPC NGUYÊN TỬ: TẠO NHÓM MLS BẰNG EMAIL BẠN BÈ
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_mls_group(
  p_title TEXT,
  p_avatar_url TEXT,
  p_mls_group_id TEXT,
  p_initial_commit TEXT,
  p_ratchet_tree TEXT,
  p_member_emails TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator_id UUID := auth.uid();
  v_conv_id UUID;
  v_email TEXT;
  v_target_profile RECORD;
  v_added_count INTEGER := 0;
  v_invalid_emails TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tên nhóm không được để trống');
  END IF;

  -- 1. Tạo phòng hội thoại dạng nhóm
  INSERT INTO public.chat_conversations (
    type, created_by, title, avatar_url, epoch, mls_group_id, metadata
  )
  VALUES (
    'group', v_creator_id, trim(p_title), p_avatar_url, 0, p_mls_group_id,
    jsonb_build_object('mls_protocol', 'RFC_9420')
  )
  RETURNING id INTO v_conv_id;

  -- 2. Thêm người tạo với vai trò 'owner'
  INSERT INTO public.chat_members (
    conversation_id, user_id, role
  )
  VALUES (
    v_conv_id, v_creator_id, 'owner'
  );

  -- 3. Lưu initial commit nếu có
  IF p_initial_commit IS NOT NULL AND p_initial_commit <> '' THEN
    INSERT INTO public.chat_mls_commits (
      conversation_id, epoch, commit_message, ratchet_tree, action_type, committed_by
    )
    VALUES (
      v_conv_id, 0, p_initial_commit, p_ratchet_tree, 'create_group', v_creator_id
    );
  END IF;

  -- 4. Thêm từng thành viên theo email (chỉ cho phép nếu là bạn bè đã chấp nhận)
  IF p_member_emails IS NOT NULL AND array_length(p_member_emails, 1) > 0 THEN
    FOREACH v_email IN ARRAY p_member_emails LOOP
      v_email := lower(trim(v_email));
      IF v_email = '' THEN CONTINUE; END IF;

      -- Tìm profile theo email
      SELECT id, full_name, email INTO v_target_profile
      FROM public.profiles
      WHERE lower(trim(email)) = v_email;

      IF NOT FOUND THEN
        v_invalid_emails := array_append(v_invalid_emails, v_email || ' (không tồn tại)');
        CONTINUE;
      END IF;

      IF v_target_profile.id = v_creator_id THEN
        CONTINUE;
      END IF;

      -- Kiểm tra quan hệ bạn bè đã accepted
      IF NOT EXISTS (
        SELECT 1 FROM public.chat_friendships
        WHERE status = 'accepted'
          AND (
            (user_id = v_creator_id AND friend_id = v_target_profile.id) OR
            (user_id = v_target_profile.id AND friend_id = v_creator_id)
          )
      ) THEN
        v_invalid_emails := array_append(v_invalid_emails, v_email || ' (chưa kết bạn)');
        CONTINUE;
      END IF;

      -- Thêm thành viên vào nhóm
      INSERT INTO public.chat_members (
        conversation_id, user_id, role
      )
      VALUES (
        v_conv_id, v_target_profile.id, 'member'
      )
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;

  -- Ghi nhận nhật ký bảo mật
  INSERT INTO public.chat_audit_events (user_id, event_type, details)
  VALUES (
    v_creator_id,
    'mls_group_created',
    jsonb_build_object(
      'conversation_id', v_conv_id,
      'title', p_title,
      'added_members_count', v_added_count,
      'invalid_emails', v_invalid_emails
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', v_conv_id,
    'title', p_title,
    'added_count', v_added_count,
    'invalid_emails', v_invalid_emails
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC NGUYÊN TỬ: THÊM THÀNH VIÊN VÀO NHÓM MLS (XOAY KHÓA COMMIT + WELCOME)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_mls_group_member(
  p_conversation_id UUID,
  p_target_email TEXT,
  p_commit_message TEXT,
  p_welcome_message TEXT,
  p_new_epoch BIGINT,
  p_ratchet_tree TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_profile RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  -- 1. Kiểm tra vai trò của người gọi (chỉ owner hoặc admin mới được thêm)
  SELECT role INTO v_caller_role
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ chủ nhóm hoặc quản trị viên mới có quyền thêm thành viên');
  END IF;

  -- 2. Tìm profile người nhận
  SELECT id, full_name, email INTO v_target_profile
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_target_email));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng với email này');
  END IF;

  -- 3. Kiểm tra xem người nhận đã ở trong nhóm chưa
  IF EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = p_conversation_id AND user_id = v_target_profile.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Người dùng đã là thành viên của nhóm');
  END IF;

  -- 4. Kiểm tra điều kiện bạn bè đã chấp nhận
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_friendships
    WHERE status = 'accepted'
      AND (
        (user_id = v_caller_id AND friend_id = v_target_profile.id) OR
        (user_id = v_target_profile.id AND friend_id = v_caller_id)
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ có thể thêm bạn bè đã chấp nhận kết bạn vào nhóm');
  END IF;

  -- 5. Thêm thành viên vào nhóm
  INSERT INTO public.chat_members (
    conversation_id, user_id, role
  )
  VALUES (
    p_conversation_id, v_target_profile.id, 'member'
  );

  -- 6. Cập nhật Epoch mới trên conversation
  UPDATE public.chat_conversations
  SET epoch = p_new_epoch, updated_at = NOW()
  WHERE id = p_conversation_id;

  -- 7. Lưu Commit xoay khóa và Welcome package cho thành viên mới
  INSERT INTO public.chat_mls_commits (
    conversation_id, epoch, commit_message, welcome_message,
    welcome_for_user_id, ratchet_tree, action_type, committed_by, target_user_id
  )
  VALUES (
    p_conversation_id, p_new_epoch, p_commit_message, p_welcome_message,
    v_target_profile.id, p_ratchet_tree, 'add_member', v_caller_id, v_target_profile.id
  );

  -- 8. Ghi audit
  INSERT INTO public.chat_audit_events (user_id, event_type, details)
  VALUES (
    v_caller_id,
    'mls_member_added',
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'target_user_id', v_target_profile.id,
      'new_epoch', p_new_epoch
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target_profile.id,
    'full_name', v_target_profile.full_name,
    'email', v_target_profile.email,
    'new_epoch', p_new_epoch
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC NGUYÊN TỬ: XÓA HOẶC RỜI NHÓM MLS (XOAY KHÓA COMMIT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_mls_group_member(
  p_conversation_id UUID,
  p_target_user_id UUID,
  p_commit_message TEXT,
  p_new_epoch BIGINT,
  p_ratchet_tree TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  -- Lấy vai trò của caller và target
  SELECT role INTO v_caller_role
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

  SELECT role INTO v_target_role
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Thành viên không tồn tại trong nhóm này');
  END IF;

  -- Kiểm tra quyền:
  IF v_caller_id = p_target_user_id THEN
    -- Bản thân tự rời nhóm
    IF v_caller_role = 'owner' THEN
      -- Nếu chủ nhóm rời thì phải chuyển quyền trước hoặc giải tán nhóm
      RETURN jsonb_build_object('success', false, 'error', 'Chủ nhóm không thể tự rời khi chưa chuyển quyền chủ nhóm');
    END IF;
  ELSE
    -- Xóa người khác
    IF v_caller_role = 'owner' THEN
      -- Owner có toàn quyền xóa
      NULL;
    ELSIF v_caller_role = 'admin' THEN
      -- Admin chỉ được xóa member thường
      IF v_target_role <> 'member' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quản trị viên chỉ có thể xóa thành viên thường');
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Bạn không có quyền xóa thành viên khỏi nhóm');
    END IF;
  END IF;

  -- 1. Xóa thành viên khỏi nhóm
  DELETE FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  -- 2. Cập nhật Epoch mới
  UPDATE public.chat_conversations
  SET epoch = p_new_epoch, updated_at = NOW()
  WHERE id = p_conversation_id;

  -- 3. Lưu Commit xoay khóa (loại bỏ người bị xóa)
  INSERT INTO public.chat_mls_commits (
    conversation_id, epoch, commit_message, ratchet_tree,
    action_type, committed_by, target_user_id
  )
  VALUES (
    p_conversation_id, p_new_epoch, p_commit_message, p_ratchet_tree,
    'remove_member', v_caller_id, p_target_user_id
  );

  -- 4. Audit
  INSERT INTO public.chat_audit_events (user_id, event_type, details)
  VALUES (
    v_caller_id,
    'mls_member_removed',
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'target_user_id', p_target_user_id,
      'is_self_leave', (v_caller_id = p_target_user_id),
      'new_epoch', p_new_epoch
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'new_epoch', p_new_epoch
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC ĐỔI TÊN / ẢNH NHÓM
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_mls_group_info(
  p_conversation_id UUID,
  p_title TEXT,
  p_avatar_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ chủ nhóm hoặc quản trị viên mới được đổi thông tin nhóm');
  END IF;

  UPDATE public.chat_conversations
  SET
    title = COALESCE(NULLIF(trim(p_title), ''), title),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'title', p_title,
    'avatar_url', p_avatar_url
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC CẬP NHẬT VAI TRÒ THÀNH VIÊN (CHỦ NHÓM / QUẢN TRỊ VIÊN / THÀNH VIÊN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_mls_member_role(
  p_conversation_id UUID,
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  IF p_new_role NOT IN ('owner', 'admin', 'member') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vai trò không hợp lệ');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

  IF NOT FOUND OR v_caller_role <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ chủ nhóm mới có quyền phân quyền vai trò');
  END IF;

  -- Nếu chuyển quyền Owner cho người khác, caller chuyển thành admin
  IF p_new_role = 'owner' THEN
    UPDATE public.chat_members
    SET role = 'admin'
    WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

    UPDATE public.chat_conversations
    SET created_by = p_target_user_id
    WHERE id = p_conversation_id;
  END IF;

  UPDATE public.chat_members
  SET role = p_new_role
  WHERE conversation_id = p_conversation_id AND user_id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'new_role', p_new_role
  );
END;
$$;
