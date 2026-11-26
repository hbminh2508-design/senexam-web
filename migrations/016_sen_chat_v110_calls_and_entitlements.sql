-- ==============================================================================
-- MIGRATION 016: SEN CHAT v1.1.0 — GROUP CALLS, SFU SESSIONS & PLAN ENTITLEMENTS
-- Đồng bộ toàn diện với Supabase:
--   - chat_plan_entitlements (single DB source of truth cho quyền lợi gói)
--   - chat_call_sessions (quản lý phiên gọi 1-1 & nhóm, hạn mức người & thời lượng)
--   - chat_call_participants (trạng thái tham gia, mic/cam/screen, heartbeat)
--   - chat_call_events (nhật ký sự kiện tham gia/rời/kết thúc)
-- Thiết lập RLS nghiêm ngặt + RPC nguyên tử chống race condition
-- An toàn khi triển khai: KHÔNG DROP bảng hoặc xóa dữ liệu production
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG QUYỀN LỢI GÓI DỊCH VỤ (CHAT_PLAN_ENTITLEMENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_plan_entitlements (
  plan_tier TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  can_create_group BOOLEAN NOT NULL DEFAULT false,
  max_group_members INTEGER NOT NULL DEFAULT 0,
  max_call_participants INTEGER, -- NULL = theo gói chủ nhóm (với Free)
  max_call_duration_seconds INTEGER, -- NULL = Không giới hạn (hoặc theo chủ nhóm với Free)
  max_file_size_bytes BIGINT NOT NULL DEFAULT 104857600,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.chat_plan_entitlements (
  plan_tier, display_name, can_create_group, max_group_members,
  max_call_participants, max_call_duration_seconds, max_file_size_bytes
) VALUES
  ('free',         'Miễn phí',     false, 0,   NULL, NULL,  104857600),
  ('lite',         'Lite',         true,  5,   5,    3600,  104857600),
  ('vip',          'VIP',          true,  20,  20,   18000, 262144000),
  ('premium',      'Premium',      true,  50,  50,   NULL,  524288000),
  ('premium_plus', 'Premium+',     true,  100, 100,  NULL,  1073741824),
  ('sen_one_lite', 'One Lite',     true,  30,  30,   NULL,  262144000),
  ('sen_one',      'One',          true,  200, 200,  NULL,  1073741824)
ON CONFLICT (plan_tier) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  can_create_group = EXCLUDED.can_create_group,
  max_group_members = EXCLUDED.max_group_members,
  max_call_participants = EXCLUDED.max_call_participants,
  max_call_duration_seconds = EXCLUDED.max_call_duration_seconds,
  max_file_size_bytes = EXCLUDED.max_file_size_bytes,
  updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 2. BẢNG PHIÊN CUỘC GỌI (CHAT_CALL_SESSIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  group_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  transport_mode TEXT NOT NULL DEFAULT 'p2p' CHECK (transport_mode IN ('p2p', 'sfu')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'reconnecting', 'ended')),
  sfu_room_name TEXT,
  owner_plan_tier TEXT NOT NULL DEFAULT 'free',
  max_participants INTEGER NOT NULL DEFAULT 2,
  max_duration_seconds INTEGER, -- NULL = không giới hạn
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- Tính từ thời điểm phiên gọi thực sự bắt đầu
  expires_at TIMESTAMPTZ, -- started_at + max_duration_seconds (server authoritative)
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ cho phép tối đa 1 phiên gọi đang hoạt động trong cùng 1 hội thoại (chống race condition)
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_call_active_per_conv
  ON public.chat_call_sessions(conversation_id)
  WHERE status IN ('ringing', 'active', 'reconnecting');

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_call_idempotency
  ON public.chat_call_sessions(conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_conv_status
  ON public.chat_call_sessions(conversation_id, status, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. BẢNG THÀNH VIÊN THAM GIA CUỘC GỌI (CHAT_CALL_PARTICIPANTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_group TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'joined', 'left', 'declined', 'kicked')),
  mic_enabled BOOLEAN NOT NULL DEFAULT true,
  camera_enabled BOOLEAN NOT NULL DEFAULT false,
  screen_sharing BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chat_call_participant UNIQUE (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_call_participants_call_status
  ON public.chat_call_participants(call_id, status);

-- ------------------------------------------------------------------------------
-- 4. BẢNG SỰ KIỆN CUỘC GỌI (CHAT_CALL_EVENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_call_events_call_time
  ON public.chat_call_events(call_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. BẬT RLS & POLICIES BẢO MẬT
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_plan_entitlements_read_auth" ON public.chat_plan_entitlements;
CREATE POLICY "chat_plan_entitlements_read_auth" ON public.chat_plan_entitlements
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_call_sessions_select_member" ON public.chat_call_sessions;
CREATE POLICY "chat_call_sessions_select_member" ON public.chat_call_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.conversation_id = chat_call_sessions.conversation_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_call_participants_select_member" ON public.chat_call_participants;
CREATE POLICY "chat_call_participants_select_member" ON public.chat_call_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_call_sessions s
      JOIN public.chat_members m ON m.conversation_id = s.conversation_id
      WHERE s.id = chat_call_participants.call_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_call_events_select_member" ON public.chat_call_events;
CREATE POLICY "chat_call_events_select_member" ON public.chat_call_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_call_sessions s
      JOIN public.chat_members m ON m.conversation_id = s.conversation_id
      WHERE s.id = chat_call_events.call_id
        AND m.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 6. HÀM NỘI BỘ XÁC ĐỊNH GÓI HIỆU LỰC CỦA USER TRONG DB
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_chat_plan_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT plan_tier, vip_expires_at
  INTO v_tier, v_expires
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_tier IS NULL OR v_tier = '' THEN
    RETURN 'free';
  END IF;

  v_tier := LOWER(TRIM(v_tier));
  IF v_tier = 'free' THEN
    RETURN 'free';
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= NOW() THEN
    RETURN 'free';
  END IF;

  IF v_tier IN ('lite', 'vip', 'premium', 'premium_plus', 'sen_one_lite', 'sen_one') THEN
    RETURN v_tier;
  END IF;

  RETURN 'free';
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC NGUYÊN TỬ: KHỞI TẠO HOẶC THAM GIA PHIÊN GỌI NHÓM
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_or_join_group_call(
  p_conversation_id UUID,
  p_call_type TEXT,
  p_caller_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv RECORD;
  v_member RECORD;
  v_owner_id UUID;
  v_owner_tier TEXT;
  v_entitlement RECORD;
  v_existing RECORD;
  v_active_count INTEGER;
  v_call_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không có quyền thực thi');
  END IF;

  -- Khóa dòng hội thoại để tránh race condition tạo 2 phiên gọi cùng lúc
  SELECT id, type, created_by INTO v_conv
  FROM public.chat_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cuộc hội thoại không tồn tại');
  END IF;

  SELECT role INTO v_member
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND user_id = p_caller_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bạn không phải thành viên của nhóm này', 'code', 'NOT_A_MEMBER');
  END IF;

  -- Nếu đã có phiên gọi đang hoạt động -> kiểm tra hết hạn hoặc cho phép tham gia lại
  SELECT * INTO v_existing
  FROM public.chat_call_sessions
  WHERE conversation_id = p_conversation_id
    AND status IN ('ringing', 'active', 'reconnecting')
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.expires_at IS NOT NULL AND v_existing.expires_at <= v_now THEN
      UPDATE public.chat_call_sessions
      SET status = 'ended', ended_at = v_now, end_reason = 'DURATION_LIMIT_EXCEEDED', updated_at = v_now
      WHERE id = v_existing.id;
    ELSE
      SELECT COUNT(*) INTO v_active_count
      FROM public.chat_call_participants
      WHERE call_id = v_existing.id AND status = 'joined' AND user_id <> p_caller_id;

      IF v_active_count >= v_existing.max_participants THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format('Cuộc gọi nhóm đã đạt giới hạn tối đa %s người tham gia.', v_existing.max_participants),
          'code', 'CALL_PARTICIPANT_LIMIT_REACHED'
        );
      END IF;

      INSERT INTO public.chat_call_participants (
        call_id, user_id, role_in_group, status, mic_enabled, camera_enabled, joined_at, last_heartbeat_at
      ) VALUES (
        v_existing.id, p_caller_id, v_member.role, 'joined', true, (p_call_type = 'video'), v_now, v_now
      )
      ON CONFLICT (call_id, user_id) DO UPDATE SET
        status = 'joined',
        left_at = NULL,
        last_heartbeat_at = v_now,
        updated_at = v_now;

      IF v_existing.status = 'ringing' THEN
        v_expires_at := CASE
          WHEN v_existing.max_duration_seconds IS NOT NULL THEN v_now + make_interval(secs => v_existing.max_duration_seconds)
          ELSE NULL
        END;
        UPDATE public.chat_call_sessions
        SET status = 'active', started_at = COALESCE(started_at, v_now), expires_at = COALESCE(expires_at, v_expires_at), updated_at = v_now
        WHERE id = v_existing.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'joinedExisting', true,
        'callId', v_existing.id,
        'sfuRoomName', v_existing.sfu_room_name,
        'maxParticipants', v_existing.max_participants,
        'maxDurationSeconds', v_existing.max_duration_seconds,
        'ownerPlanTier', v_existing.owner_plan_tier
      );
    END IF;
  END IF;

  -- Xác định chủ sở hữu nhóm để lấy hạn mức gói dịch vụ
  SELECT user_id INTO v_owner_id
  FROM public.chat_members
  WHERE conversation_id = p_conversation_id AND role = 'owner'
  ORDER BY joined_at ASC
  LIMIT 1;

  v_owner_id := COALESCE(v_owner_id, v_conv.created_by, p_caller_id);

  IF v_conv.type = 'group' THEN
    v_owner_tier := public.get_effective_chat_plan_tier(v_owner_id);
    IF v_owner_tier = 'free' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Chủ sở hữu nhóm hiện đang ở gói Miễn phí. Vui lòng nâng cấp gói hoặc chuyển quyền sở hữu cho thành viên trả phí để khởi tạo cuộc gọi nhóm mới.',
        'code', 'GROUP_OWNER_FREE_TIER'
      );
    END IF;

    SELECT * INTO v_entitlement
    FROM public.chat_plan_entitlements
    WHERE plan_tier = v_owner_tier;
  ELSE
    v_owner_tier := 'p2p';
  END IF;

  v_expires_at := CASE
    WHEN v_conv.type = 'group' AND v_entitlement.max_call_duration_seconds IS NOT NULL
      THEN v_now + make_interval(secs => v_entitlement.max_call_duration_seconds)
    ELSE NULL
  END;

  INSERT INTO public.chat_call_sessions (
    conversation_id, group_owner_id, initiator_id, call_type, transport_mode, status,
    sfu_room_name, owner_plan_tier, max_participants, max_duration_seconds,
    idempotency_key, started_at, expires_at
  ) VALUES (
    p_conversation_id,
    v_owner_id,
    p_caller_id,
    COALESCE(p_call_type, 'voice'),
    CASE WHEN v_conv.type = 'group' THEN 'sfu' ELSE 'p2p' END,
    'active',
    'senchat-' || replace(p_conversation_id::text, '-', ''),
    v_owner_tier,
    CASE WHEN v_conv.type = 'group' THEN COALESCE(v_entitlement.max_call_participants, 5) ELSE 2 END,
    CASE WHEN v_conv.type = 'group' THEN v_entitlement.max_call_duration_seconds ELSE NULL END,
    p_idempotency_key,
    v_now,
    v_expires_at
  )
  RETURNING id INTO v_call_id;

  INSERT INTO public.chat_call_participants (
    call_id, user_id, role_in_group, status, mic_enabled, camera_enabled, joined_at, last_heartbeat_at
  ) VALUES (
    v_call_id, p_caller_id, v_member.role, 'joined', true, (p_call_type = 'video'), v_now, v_now
  );

  INSERT INTO public.chat_call_events (call_id, actor_id, event_type, payload)
  VALUES (v_call_id, p_caller_id, 'call_started', jsonb_build_object('callType', p_call_type, 'ownerTier', v_owner_tier));

  RETURN jsonb_build_object(
    'success', true,
    'joinedExisting', false,
    'callId', v_call_id,
    'sfuRoomName', 'senchat-' || replace(p_conversation_id::text, '-', ''),
    'maxParticipants', CASE WHEN v_conv.type = 'group' THEN COALESCE(v_entitlement.max_call_participants, 5) ELSE 2 END,
    'maxDurationSeconds', CASE WHEN v_conv.type = 'group' THEN v_entitlement.max_call_duration_seconds ELSE NULL END,
    'ownerPlanTier', v_owner_tier,
    'startedAt', v_now,
    'expiresAt', v_expires_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC NGUYÊN TỬ: RỜI HOẶC KẾT THÚC CUỘC GỌI NHÓM
-- - Thành viên rời đi: chỉ đổi trạng thái bản thân thành 'left', cuộc gọi vẫn tiếp tục
-- - Owner / Admin có thể chọn p_end_for_all = true để kết thúc cho toàn nhóm
-- - Nếu hết tất cả thành viên rời đi -> tự động đánh dấu phiên gọi đã kết thúc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_or_end_group_call(
  p_call_id UUID,
  p_caller_id UUID,
  p_end_for_all BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT 'USER_LEFT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_call RECORD;
  v_member RECORD;
  v_remaining INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không có quyền thực thi');
  END IF;

  SELECT * INTO v_call FROM public.chat_call_sessions WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phiên gọi không tồn tại');
  END IF;

  SELECT role INTO v_member
  FROM public.chat_members
  WHERE conversation_id = v_call.conversation_id AND user_id = p_caller_id;

  IF p_end_for_all THEN
    IF v_member.role IS NULL OR v_member.role NOT IN ('owner', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chỉ Chủ nhóm hoặc Quản trị viên mới có quyền kết thúc cuộc gọi cho toàn nhóm');
    END IF;

    UPDATE public.chat_call_participants
    SET status = 'left', left_at = COALESCE(left_at, v_now), updated_at = v_now
    WHERE call_id = p_call_id AND status IN ('ringing', 'joined');

    UPDATE public.chat_call_sessions
    SET status = 'ended', ended_at = v_now, end_reason = COALESCE(p_reason, 'ENDED_BY_ADMIN'), updated_at = v_now
    WHERE id = p_call_id;

    INSERT INTO public.chat_call_events (call_id, actor_id, event_type, payload)
    VALUES (p_call_id, p_caller_id, 'call_ended_for_all', jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object('success', true, 'endedForAll', true);
  END IF;

  UPDATE public.chat_call_participants
  SET status = 'left', left_at = v_now, screen_sharing = false, updated_at = v_now
  WHERE call_id = p_call_id AND user_id = p_caller_id;

  INSERT INTO public.chat_call_events (call_id, actor_id, event_type, payload)
  VALUES (p_call_id, p_caller_id, 'participant_left', jsonb_build_object('reason', p_reason));

  SELECT COUNT(*) INTO v_remaining
  FROM public.chat_call_participants
  WHERE call_id = p_call_id AND status = 'joined';

  IF v_remaining = 0 THEN
    UPDATE public.chat_call_sessions
    SET status = 'ended', ended_at = v_now, end_reason = 'ALL_PARTICIPANTS_LEFT', updated_at = v_now
    WHERE id = p_call_id AND status <> 'ended';
  END IF;

  RETURN jsonb_build_object('success', true, 'endedForAll', false, 'remainingParticipants', v_remaining);
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. HÀM DỌN DẸP PHIÊN GỌI TREO / QUÁ THỜI LƯỢNG
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_call_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_closed INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.chat_call_participants
  SET status = 'left', left_at = v_now, screen_sharing = false, updated_at = v_now
  WHERE status = 'joined'
    AND last_heartbeat_at < (v_now - INTERVAL '120 seconds');

  WITH expired AS (
    UPDATE public.chat_call_sessions
    SET status = 'ended', ended_at = v_now, end_reason = 'DURATION_LIMIT_EXCEEDED', updated_at = v_now
    WHERE status IN ('ringing', 'active', 'reconnecting')
      AND expires_at IS NOT NULL
      AND expires_at <= v_now
    RETURNING id
  )
  SELECT COUNT(*) INTO v_closed FROM expired;

  RETURN v_closed;
END;
$$;
