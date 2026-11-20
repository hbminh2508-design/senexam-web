-- ==============================================================================
-- MIGRATION 009: FIX MLS GROUP RPCS FOR SERVICE ROLE CALLS (NEXT.JS ROUTE HANDLERS)
-- Allows service_role callers (authenticated via getUserFromRequest) to specify
-- caller_id / creator_id, while strictly enforcing auth.uid() for authenticated clients.
-- ==============================================================================

-- 1. DROP EXISTING OVERLOADS
DROP FUNCTION IF EXISTS public.create_mls_group(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_mls_group(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], UUID);

DROP FUNCTION IF EXISTS public.add_mls_group_member(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.add_mls_group_member(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, UUID);

DROP FUNCTION IF EXISTS public.remove_mls_group_member(UUID, UUID, TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.remove_mls_group_member(UUID, UUID, TEXT, BIGINT, TEXT, UUID);

DROP FUNCTION IF EXISTS public.update_mls_group_info(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_mls_group_info(UUID, TEXT, TEXT, UUID);

DROP FUNCTION IF EXISTS public.update_mls_member_role(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_mls_member_role(UUID, UUID, TEXT, UUID);

-- ------------------------------------------------------------------------------
-- 2. CREATE_MLS_GROUP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_mls_group(
  p_title TEXT,
  p_avatar_url TEXT,
  p_mls_group_id TEXT,
  p_initial_commit TEXT,
  p_ratchet_tree TEXT,
  p_member_emails TEXT[],
  p_creator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator_id UUID;
  v_conv_id UUID;
  v_email TEXT;
  v_target_profile RECORD;
  v_added_count INTEGER := 0;
  v_invalid_emails TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.role() = 'service_role' THEN
    v_creator_id := COALESCE(p_creator_id, auth.uid());
  ELSE
    v_creator_id := auth.uid();
  END IF;

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
-- 3. ADD_MLS_GROUP_MEMBER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_mls_group_member(
  p_conversation_id UUID,
  p_target_email TEXT,
  p_commit_message TEXT,
  p_welcome_message TEXT,
  p_new_epoch BIGINT,
  p_ratchet_tree TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_profile RECORD;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
-- 4. REMOVE_MLS_GROUP_MEMBER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_mls_group_member(
  p_conversation_id UUID,
  p_target_user_id UUID,
  p_commit_message TEXT,
  p_new_epoch BIGINT,
  p_ratchet_tree TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
      RETURN jsonb_build_object('success', false, 'error', 'Chủ nhóm không thể tự rời khi chưa chuyển quyền chủ nhóm');
    END IF;
  ELSE
    -- Xóa người khác
    IF v_caller_role = 'owner' THEN
      NULL;
    ELSIF v_caller_role = 'admin' THEN
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
-- 5. UPDATE_MLS_GROUP_INFO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_mls_group_info(
  p_conversation_id UUID,
  p_title TEXT,
  p_avatar_url TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
-- 6. UPDATE_MLS_MEMBER_ROLE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_mls_member_role(
  p_conversation_id UUID,
  p_target_user_id UUID,
  p_new_role TEXT,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

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
