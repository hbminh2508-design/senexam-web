CREATE TABLE IF NOT EXISTS public.chat_group_invites (
  conversation_id uuid PRIMARY KEY REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  invite_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  requires_approval boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.chat_group_join_requests (
  conversation_id uuid NOT NULL REFERENCES public.chat_group_invites(conversation_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.chat_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_group_invites, public.chat_group_join_requests FROM anon, authenticated;
GRANT ALL ON public.chat_group_invites, public.chat_group_join_requests TO service_role;

CREATE OR REPLACE FUNCTION public.sen_chat_group_invite(
  actor uuid, action text, group_id uuid DEFAULT NULL, link_token uuid DEFAULT NULL,
  target uuid DEFAULT NULL, approval boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  invite public.chat_group_invites%ROWTYPE;
  grp public.chat_conversations%ROWTYPE;
  actor_role text;
  candidate uuid;
  owner_id uuid;
  member_limit integer;
BEGIN
  IF action = 'join' THEN
    SELECT i.conversation_id INTO group_id FROM public.chat_group_invites i WHERE i.invite_token = link_token;
  END IF;
  SELECT * INTO grp FROM public.chat_conversations c WHERE c.id = group_id AND c.type = 'group' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Liên kết hoặc nhóm không còn tồn tại.'); END IF;
  SELECT * INTO invite FROM public.chat_group_invites i WHERE i.conversation_id = group_id;
  SELECT m.role INTO actor_role FROM public.chat_members m WHERE m.conversation_id = group_id AND m.user_id = actor;

  IF action = 'join' THEN
    IF invite.invite_token IS DISTINCT FROM link_token OR link_token IS NULL THEN
      RETURN jsonb_build_object('error', 'Liên kết đã hết hiệu lực.');
    END IF;
    IF actor_role IS NOT NULL THEN RETURN jsonb_build_object('state', 'joined', 'conversationId', group_id, 'title', grp.title); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor) THEN
      RETURN jsonb_build_object('error', 'Bạn cần hoàn tất hồ sơ SenExam trước khi tham gia.');
    END IF;
    IF invite.requires_approval THEN
      INSERT INTO public.chat_group_join_requests(conversation_id, user_id) VALUES(group_id, actor) ON CONFLICT DO NOTHING;
      RETURN jsonb_build_object('state', 'pending');
    END IF;
    candidate := actor;
  ELSE
    IF actor_role IS NULL OR actor_role NOT IN ('owner', 'admin') THEN
      RETURN jsonb_build_object('error', 'Bạn không có quyền quản lý lời mời.');
    END IF;
    IF action IN ('get', 'configure', 'rotate') THEN
      IF action IN ('configure', 'rotate') AND actor_role <> 'owner' THEN
        RETURN jsonb_build_object('error', 'Chỉ chủ nhóm được đổi thiết lập liên kết.');
      END IF;
      IF action = 'configure' THEN
        INSERT INTO public.chat_group_invites(conversation_id, requires_approval) VALUES(group_id, COALESCE(approval, true))
          ON CONFLICT(conversation_id) DO UPDATE SET requires_approval = EXCLUDED.requires_approval;
      ELSIF action = 'rotate' THEN
        UPDATE public.chat_group_invites SET invite_token = gen_random_uuid() WHERE conversation_id = group_id;
      END IF;
      SELECT * INTO invite FROM public.chat_group_invites i WHERE i.conversation_id = group_id;
      RETURN jsonb_build_object('token', invite.invite_token, 'approval', COALESCE(invite.requires_approval, true),
        'requests', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', r.user_id, 'name', COALESCE(p.full_name, 'Thành viên mới')) ORDER BY r.requested_at)
          FROM public.chat_group_join_requests r JOIN public.profiles p ON p.id = r.user_id WHERE r.conversation_id = group_id
        ), '[]'::jsonb));
    END IF;
    IF action NOT IN ('approve', 'reject') OR NOT EXISTS (
      SELECT 1 FROM public.chat_group_join_requests r WHERE r.conversation_id = group_id AND r.user_id = target
    ) THEN RETURN jsonb_build_object('error', 'Yêu cầu không còn tồn tại.'); END IF;
    IF action = 'reject' THEN
      DELETE FROM public.chat_group_join_requests WHERE conversation_id = group_id AND user_id = target;
      RETURN jsonb_build_object('state', 'rejected');
    END IF;
    candidate := target;
  END IF;

  SELECT m.user_id INTO owner_id FROM public.chat_members m WHERE m.conversation_id = group_id AND m.role = 'owner';
  SELECT e.max_group_members INTO member_limit FROM public.chat_plan_entitlements e
    WHERE e.plan_tier = public.get_effective_chat_plan_tier(owner_id);
  IF NOT EXISTS (SELECT 1 FROM public.chat_members m WHERE m.conversation_id = group_id AND m.user_id = candidate)
    AND (SELECT count(*) FROM public.chat_members m WHERE m.conversation_id = group_id) >= COALESCE(member_limit, 0) THEN
    RETURN jsonb_build_object('error', 'Nhóm đã đạt giới hạn thành viên hoặc gói đã hết hạn.');
  END IF;
  -- Existing ciphertext remains addressed to the original recipient devices.
  INSERT INTO public.chat_members(conversation_id, user_id, role) VALUES(group_id, candidate, 'member') ON CONFLICT DO NOTHING;
  DELETE FROM public.chat_group_join_requests WHERE conversation_id = group_id AND user_id = candidate;
  UPDATE public.chat_conversations SET updated_at = now() WHERE id = group_id;
  RETURN jsonb_build_object('state', 'joined', 'conversationId', group_id, 'title', grp.title);
END;
$$;
REVOKE ALL ON FUNCTION public.sen_chat_group_invite(uuid, text, uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_group_invite(uuid, text, uuid, uuid, uuid, boolean) TO service_role;
