-- ==============================================================================
-- MIGRATION 013: FIX SEN CHAT RETENTION RPC CALLER AUTH FOR SERVICE ROLE
-- Hỗ trợ:
-- 1. extend_attachment_retention nhận p_caller_id khi gọi từ backend service_role
-- 2. get_conversation_storage_usage nhận p_caller_id khi gọi từ backend service_role
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.extend_attachment_retention(
  p_attachment_id UUID,
  p_days INT DEFAULT 30,
  p_permanent BOOLEAN DEFAULT false,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_attachment RECORD;
  v_member_role TEXT;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chưa xác thực người dùng');
  END IF;

  SELECT a.*, c.type AS conv_type
  INTO v_attachment
  FROM public.chat_attachments a
  JOIN public.chat_conversations c ON c.id = a.conversation_id
  WHERE a.id = p_attachment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy tệp đính kèm');
  END IF;

  SELECT role INTO v_member_role
  FROM public.chat_members
  WHERE conversation_id = v_attachment.conversation_id
    AND user_id = v_caller_id;

  IF v_attachment.conv_type = 'group' THEN
    IF v_member_role NOT IN ('owner', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chỉ Trưởng nhóm hoặc Quản trị viên mới có quyền gia hạn tệp trong nhóm');
    END IF;
  ELSE
    IF v_member_role IS NULL AND v_attachment.uploader_id <> v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bạn không có quyền gia hạn tệp này');
    END IF;
  END IF;

  IF p_permanent THEN
    UPDATE public.chat_attachments
    SET is_pinned_permanent = true,
        expires_at = NULL,
        retention_extended_by = v_caller_id,
        retention_extended_at = NOW()
    WHERE id = p_attachment_id;
  ELSE
    v_new_expires_at := GREATEST(COALESCE(v_attachment.expires_at, NOW()), NOW()) + (p_days || ' days')::INTERVAL;

    UPDATE public.chat_attachments
    SET expires_at = v_new_expires_at,
        is_pinned_permanent = false,
        retention_extended_by = v_caller_id,
        retention_extended_at = NOW()
    WHERE id = p_attachment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_permanent THEN 'Đã bảo lưu vĩnh viễn tệp này' ELSE 'Đã gia hạn lưu trữ thêm ' || p_days || ' ngày' END,
    'attachment_id', p_attachment_id,
    'expires_at', v_new_expires_at,
    'is_pinned_permanent', p_permanent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_storage_usage(
  p_conversation_id UUID,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_is_member BOOLEAN;
  v_total_bytes BIGINT := 0;
  v_file_count INT := 0;
  v_max_quota BIGINT := 16106127360; -- 15 GB
  v_conv_type TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_caller_id := COALESCE(p_caller_id, auth.uid());
  ELSE
    v_caller_id := auth.uid();
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE conversation_id = p_conversation_id AND user_id = v_caller_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RETURN jsonb_build_object('success', false, 'error', 'Không có quyền truy cập hội thoại');
    END IF;
  END IF;

  SELECT type INTO v_conv_type FROM public.chat_conversations WHERE id = p_conversation_id;

  SELECT COALESCE(SUM(file_size_bytes), 0), COUNT(id)
  INTO v_total_bytes, v_file_count
  FROM public.chat_attachments
  WHERE conversation_id = p_conversation_id
    AND is_deleted = false
    AND (is_pinned_permanent = true OR expires_at IS NULL OR expires_at > NOW());

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'type', v_conv_type,
    'used_bytes', v_total_bytes,
    'file_count', v_file_count,
    'max_quota_bytes', v_max_quota,
    'remaining_bytes', GREATEST(0, v_max_quota - v_total_bytes),
    'is_quota_exceeded', (v_total_bytes >= v_max_quota)
  );
END;
$$;
