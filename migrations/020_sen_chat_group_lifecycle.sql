CREATE OR REPLACE FUNCTION public.sen_chat_change_group(
  group_id uuid, actor uuid, operation text, successor uuid DEFAULT NULL,
  title_value text DEFAULT NULL, avatar_value text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_role text;
  remaining integer;
  next_owner uuid;
BEGIN
  PERFORM 1 FROM public.chat_conversations c WHERE c.id = group_id AND c.type = 'group' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', operation = 'leave', 'error', 'Nhóm không còn tồn tại.');
  END IF;
  SELECT m.role INTO actor_role FROM public.chat_members m WHERE m.conversation_id = group_id AND m.user_id = actor;
  IF actor_role IS NULL THEN
    RETURN jsonb_build_object('success', operation = 'leave', 'error', 'Bạn không còn là thành viên.');
  END IF;

  IF operation = 'edit' AND actor_role IN ('owner', 'admin') THEN
    UPDATE public.chat_conversations SET title = title_value, avatar_url = avatar_value, updated_at = now()
      WHERE id = group_id;
    RETURN jsonb_build_object('success', true, 'title', title_value, 'avatar_url', avatar_value);
  ELSIF operation = 'delete' AND actor_role = 'owner' THEN
    DELETE FROM public.chat_conversations WHERE id = group_id;
    RETURN jsonb_build_object('success', true, 'deleted', true);
  ELSIF operation = 'transfer' AND actor_role = 'owner' AND successor IS DISTINCT FROM actor THEN
    SELECT m.user_id INTO next_owner FROM public.chat_members m
      WHERE m.conversation_id = group_id AND m.user_id = successor;
    IF next_owner IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Người nhận quyền phải đang ở trong nhóm.');
    END IF;
  ELSIF operation = 'leave' THEN
    SELECT count(*) INTO remaining FROM public.chat_members m
      WHERE m.conversation_id = group_id AND m.user_id <> actor;
    IF remaining = 0 THEN
      DELETE FROM public.chat_conversations WHERE id = group_id;
      RETURN jsonb_build_object('success', true, 'deleted', true);
    END IF;
    IF actor_role = 'owner' THEN
      SELECT m.user_id INTO next_owner FROM public.chat_members m
        WHERE m.conversation_id = group_id AND m.user_id <> actor
        ORDER BY (m.role = 'admin') DESC, m.joined_at, m.user_id LIMIT 1;
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Bạn không có quyền thực hiện thao tác này.');
  END IF;

  IF next_owner IS NOT NULL THEN
    UPDATE public.chat_members SET role = 'admin' WHERE conversation_id = group_id AND user_id = actor;
    UPDATE public.chat_members SET role = 'owner' WHERE conversation_id = group_id AND user_id = next_owner;
  END IF;
  IF operation = 'leave' THEN
    DELETE FROM public.chat_members WHERE conversation_id = group_id AND user_id = actor;
    UPDATE public.chat_call_participants p SET status = 'left', left_at = now(), updated_at = now()
      FROM public.chat_call_sessions s WHERE p.call_id = s.id AND s.conversation_id = group_id AND p.user_id = actor;
  END IF;
  UPDATE public.chat_conversations SET updated_at = now() WHERE id = group_id;
  RETURN jsonb_build_object('success', true, 'owner_id', next_owner);
END;
$$;

REVOKE ALL ON FUNCTION public.sen_chat_change_group(uuid, uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_change_group(uuid, uuid, text, uuid, text, text) TO service_role;
