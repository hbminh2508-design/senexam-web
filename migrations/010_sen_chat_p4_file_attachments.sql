-- ==============================================================================
-- MIGRATION 010: SEN CHAT P4 FILE ATTACHMENTS & GOOGLE DRIVE INTEGRATION
-- Hỗ trợ lưu trữ ảnh mã hóa E2EE trên Google Drive, video/tệp trên Supabase Storage
-- Tự động thu hồi, dọn dẹp file khi tin nhắn hết hạn, bảo vệ quyền riêng tư tuyệt đối
-- ==============================================================================

-- 1. Bổ sung các cột metadata cho bảng chat_attachments
ALTER TABLE public.chat_attachments
ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'google_drive' CHECK (storage_provider IN ('google_drive', 'supabase_storage')),
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS file_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mime_type_encrypted TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_encrypted TEXT,
ADD COLUMN IF NOT EXISTS encryption_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Chỉ mục tối ưu tra cứu file theo drive_file_id và lọc tệp chưa xóa
CREATE INDEX IF NOT EXISTS idx_chat_attachments_drive_id 
ON public.chat_attachments(drive_file_id) 
WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_attachments_conv_active 
ON public.chat_attachments(conversation_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_uploader 
ON public.chat_attachments(uploader_id, created_at DESC);

-- 2. Cập nhật RLS Policy cho chat_attachments: Chỉ thành viên hội thoại mới xem được và tệp chưa bị xóa
DROP POLICY IF EXISTS "chat_attachments_select_member" ON public.chat_attachments;
CREATE POLICY "chat_attachments_select_member" ON public.chat_attachments
  FOR SELECT TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.conversation_id = chat_attachments.conversation_id
        AND chat_members.user_id = auth.uid()
    )
  );

-- 3. Cập nhật RPC recall_chat_message: Khi thu hồi tin nhắn, đánh dấu xóa attachments và trả về danh sách Drive file IDs
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
  v_drive_ids TEXT[];
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

  -- Thu thập danh sách drive_file_id của các tệp đính kèm liên quan
  SELECT array_agg(drive_file_id) INTO v_drive_ids
  FROM public.chat_attachments
  WHERE message_id = p_message_id AND drive_file_id IS NOT NULL AND is_deleted = false;

  -- Đánh dấu xóa toàn bộ attachments thuộc tin nhắn này
  UPDATE public.chat_attachments
  SET is_deleted = true,
      deleted_at = NOW()
  WHERE message_id = p_message_id;

  -- Thu hồi tin nhắn: Đánh dấu is_recalled = true và xóa sạch ciphertext
  UPDATE public.chat_messages
  SET is_recalled = true,
      ciphertext = '[RECALLED]'
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Tin nhắn đã được thu hồi',
    'drive_file_ids', COALESCE(v_drive_ids, ARRAY[]::TEXT[])
  );
END;
$$;

-- 4. RPC lấy và dọn dẹp các tệp đính kèm của tin nhắn đã tự hủy (expired) hoặc đã bị thu hồi
CREATE OR REPLACE FUNCTION public.get_and_mark_expired_chat_attachments(
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_rows RECORD;
  v_items JSONB := '[]'::jsonb;
BEGIN
  -- Lấy các file đính kèm của tin nhắn đã hết hạn (expires_at <= NOW()) hoặc đã recall nhưng chưa dọn dẹp
  FOR v_rows IN
    SELECT a.id, a.drive_file_id, a.storage_provider, a.storage_path
    FROM public.chat_attachments a
    JOIN public.chat_messages m ON m.id = a.message_id
    WHERE a.is_deleted = false
      AND (
        (m.expires_at IS NOT NULL AND m.expires_at <= NOW())
        OR m.is_recalled = true
      )
    LIMIT p_limit
  LOOP
    v_items := v_items || jsonb_build_object(
      'attachment_id', v_rows.id,
      'drive_file_id', v_rows.drive_file_id,
      'storage_provider', v_rows.storage_provider,
      'storage_path', v_rows.storage_path
    );

    UPDATE public.chat_attachments
    SET is_deleted = true, deleted_at = NOW()
    WHERE id = v_rows.id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'expired_attachments', v_items);
END;
$$;
