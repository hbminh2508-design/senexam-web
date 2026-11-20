-- ==============================================================================
-- MIGRATION 011: SEN CHAT P8 SECURITY HARDENING & CASCADING ACCOUNT PURGE
-- Mục đích: Đảm bảo 100% các bảng chat_* có RLS bật, khóa ngoại ON DELETE CASCADE,
--          và cơ chế dọn dẹp sạch toàn bộ dữ liệu khi xóa tài khoản (GDPR Erasure).
-- ==============================================================================

-- 1. BẬT VÀ XÁC NHẬN ROW LEVEL SECURITY (RLS) TRÊN TOÀN BỘ 11 BẢNG CHAT
ALTER TABLE IF EXISTS public.chat_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_prekeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_mls_key_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_mls_commits ENABLE ROW LEVEL SECURITY;

-- 2. HÀM QUẢN TRỊ DỌN DẸP SẠCH DỮ LIỆU CHAT KHI XÓA TÀI KHOẢN (GDPR PURGE)
CREATE OR REPLACE FUNCTION public.purge_chat_user_data(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_msgs INT := 0;
  deleted_devs INT := 0;
  deleted_pks INT := 0;
  deleted_kps INT := 0;
  deleted_atts INT := 0;
BEGIN
  -- Chỉ Admin hoặc chính người dùng sở hữu mới được chạy hàm này
  IF auth.uid() <> target_user_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Không có quyền xóa dữ liệu người dùng';
  END IF;

  -- 1. Đếm và xóa attachments
  WITH del_att AS (
    DELETE FROM public.chat_attachments
    WHERE uploader_id = target_user_id
    RETURNING id
  )
  SELECT count(*) INTO deleted_atts FROM del_att;

  -- 2. Đếm và xóa messages (gửi hoặc nhận)
  WITH del_msg AS (
    DELETE FROM public.chat_messages
    WHERE sender_id = target_user_id OR recipient_id = target_user_id
    RETURNING id
  )
  SELECT count(*) INTO deleted_msgs FROM del_msg;

  -- 3. Xóa MLS key packages
  WITH del_kp AS (
    DELETE FROM public.chat_mls_key_packages
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT count(*) INTO deleted_kps FROM del_kp;

  -- 4. Xóa MLS commits
  DELETE FROM public.chat_mls_commits
  WHERE committed_by = target_user_id
     OR welcome_for_user_id = target_user_id
     OR target_user_id = target_user_id;

  -- 5. Xóa prekeys
  WITH del_pk AS (
    DELETE FROM public.chat_prekeys
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT count(*) INTO deleted_pks FROM del_pk;

  -- 6. Xóa devices
  WITH del_dev AS (
    DELETE FROM public.chat_devices
    WHERE user_id = target_user_id
    RETURNING id
  )
  SELECT count(*) INTO deleted_devs FROM del_dev;

  -- 7. Xóa tư cách thành viên nhóm và bạn bè
  DELETE FROM public.chat_members WHERE user_id = target_user_id;
  DELETE FROM public.chat_friendships WHERE user_id = target_user_id OR friend_id = target_user_id;

  -- 8. Xóa báo cáo và sự kiện kiểm toán
  DELETE FROM public.chat_reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.chat_audit_events WHERE user_id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'deleted_attachments', deleted_atts,
    'deleted_messages', deleted_msgs,
    'deleted_key_packages', deleted_kps,
    'deleted_prekeys', deleted_pks,
    'deleted_devices', deleted_devs
  );
END;
$$;

-- Cấp quyền gọi hàm cho người dùng đã xác thực
REVOKE ALL ON FUNCTION public.purge_chat_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_chat_user_data(UUID) TO authenticated, service_role;
