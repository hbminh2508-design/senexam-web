-- ==============================================================================
-- MIGRATION 012: SEN CHAT RETENTION, GROUP 15GB QUOTA & TRANSIT QUEUE
-- Hỗ trợ:
-- 1. Bảng public.chat_transit_queue đồng bộ kết bạn, tin nhắn, media
-- 2. Hạn ngạch dung lượng nhóm tối đa 15GB (16,106,127,360 bytes)
-- 3. Thời hạn lưu trữ tệp đính kèm mặc định 30 ngày & RPC gia hạn bởi Trưởng nhóm / Admin
-- ==============================================================================

-- 1. BẢNG HÀNG ĐỢI ĐIỀU PHỐI ĐỒNG BỘ TIN NHẮN VÀ MEDIA (CHAT_TRANSIT_QUEUE)
CREATE TABLE IF NOT EXISTS public.chat_transit_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  receiver_id TEXT NOT NULL,
  device_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_type TEXT NOT NULL DEFAULT 'message',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_transit_queue_receiver 
ON public.chat_transit_queue(receiver_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_transit_queue_sender 
ON public.chat_transit_queue(sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_transit_queue_created 
ON public.chat_transit_queue(created_at);

ALTER TABLE IF EXISTS public.chat_transit_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_transit_queue_all_authenticated" ON public.chat_transit_queue;
CREATE POLICY "chat_transit_queue_all_authenticated" ON public.chat_transit_queue
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. BỔ SUNG CỘT BẢO LƯU 30 NGÀY VÀ GIA HẠN CHO CHAT_ATTACHMENTS
ALTER TABLE public.chat_attachments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
ADD COLUMN IF NOT EXISTS retention_extended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS retention_extended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_pinned_permanent BOOLEAN NOT NULL DEFAULT false;

-- Cập nhật các bản ghi cũ chưa có expires_at: mặc định 30 ngày kể từ lúc tạo
UPDATE public.chat_attachments
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL AND is_pinned_permanent = false;

CREATE INDEX IF NOT EXISTS idx_chat_attachments_expires
ON public.chat_attachments(conversation_id, expires_at)
WHERE is_deleted = false;

-- Policy cho phép Trưởng nhóm, Quản trị viên cập nhật tệp (gia hạn lưu trữ)
DROP POLICY IF EXISTS "chat_attachments_update_owner_or_admin" ON public.chat_attachments;
CREATE POLICY "chat_attachments_update_owner_or_admin" ON public.chat_attachments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_attachments.conversation_id
        AND chat_members.user_id = auth.uid()
        AND chat_members.role IN ('owner', 'admin')
    )
    OR uploader_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_attachments.conversation_id
        AND chat_members.user_id = auth.uid()
        AND chat_members.role IN ('owner', 'admin')
    )
    OR uploader_id = auth.uid()
  );

-- 3. RPC KIỂM TRA DUNG LƯỢNG LƯU TRỮ CỦA NHÓM (HẠN MỨC 15GB = 16,106,127,360 BYTES)
CREATE OR REPLACE FUNCTION public.get_conversation_storage_usage(
  p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_member BOOLEAN;
  v_total_bytes BIGINT := 0;
  v_file_count INT := 0;
  v_max_quota BIGINT := 16106127360; -- 15 GB
  v_conv_type TEXT;
BEGIN
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

-- 4. RPC GIA HẠN LƯU TRỮ TỆP ĐÍNH KÈM (BỞI TRƯỞNG NHÓM / ADMIN)
CREATE OR REPLACE FUNCTION public.extend_attachment_retention(
  p_attachment_id UUID,
  p_days INT DEFAULT 30,
  p_permanent BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_attachment RECORD;
  v_member_role TEXT;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
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

-- 5. CẬP NHẬT RPC DỌN DẸP CÁC TỆP ĐÃ QUÁ HẠN LƯU TRỮ 30 NGÀY
DROP FUNCTION IF EXISTS public.get_and_mark_expired_chat_attachments(INT);
CREATE OR REPLACE FUNCTION public.get_and_mark_expired_chat_attachments(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  attachment_id UUID,
  drive_file_id TEXT,
  storage_provider TEXT,
  storage_path TEXT,
  conversation_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH expired_candidates AS (
    SELECT a.id, a.drive_file_id, a.storage_provider, a.storage_path, a.conversation_id
    FROM public.chat_attachments a
    LEFT JOIN public.chat_messages m ON m.id = a.message_id
    WHERE a.is_deleted = false
      AND (
        (m.expires_at IS NOT NULL AND m.expires_at <= NOW())
        OR
        (a.is_pinned_permanent = false AND a.expires_at IS NOT NULL AND a.expires_at <= NOW())
      )
    LIMIT p_limit
  )
  UPDATE public.chat_attachments target
  SET is_deleted = true,
      deleted_at = NOW()
  FROM expired_candidates c
  WHERE target.id = c.id
  RETURNING target.id, target.drive_file_id, target.storage_provider, target.storage_path, target.conversation_id;
END;
$$;
