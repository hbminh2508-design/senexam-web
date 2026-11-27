CREATE TABLE IF NOT EXISTS public.chat_call_invitations (
  call_id uuid NOT NULL,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('voice', 'video')),
  state text NOT NULL DEFAULT 'ringing' CHECK (state IN ('ringing', 'accepted', 'declined', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  PRIMARY KEY (call_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS chat_call_invitations_recipient_idx
  ON public.chat_call_invitations (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_call_invitations_caller_idx
  ON public.chat_call_invitations (caller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_web_push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keys jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_web_push_subscriptions_user_idx
  ON public.chat_web_push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.chat_notification_mutes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_key uuid NOT NULL,
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.chat_whiteboard_items (
  call_id uuid NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, id)
);
CREATE INDEX IF NOT EXISTS chat_whiteboard_items_order_idx
  ON public.chat_whiteboard_items (call_id, created_at, id);
CREATE INDEX IF NOT EXISTS chat_whiteboard_items_author_idx
  ON public.chat_whiteboard_items (call_id, author_id, created_at);

ALTER TABLE public.chat_call_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notification_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_whiteboard_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_call_invitations, public.chat_web_push_subscriptions,
  public.chat_notification_mutes, public.chat_whiteboard_items FROM anon, authenticated;
GRANT ALL ON public.chat_call_invitations, public.chat_web_push_subscriptions,
  public.chat_notification_mutes, public.chat_whiteboard_items TO service_role;

CREATE OR REPLACE FUNCTION public.sen_chat_can_signal(topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_call_invitations i
    WHERE i.conversation_id IS NULL
      AND topic = 'sen-call:' || i.call_id::text
      AND (i.caller_id = auth.uid() OR i.recipient_id = auth.uid())
      AND (
        (i.state = 'ringing' AND i.expires_at > now())
        OR (i.state = 'accepted' AND i.created_at > now() - interval '1 day')
      )
  )
$$;

REVOKE ALL ON FUNCTION public.sen_chat_can_signal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_can_signal(text) TO authenticated;

DROP POLICY IF EXISTS sen_chat_read_private_realtime ON realtime.messages;
CREATE POLICY sen_chat_read_private_realtime ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension = 'broadcast' AND (
      (SELECT realtime.topic()) = 'sen-alerts:' || (SELECT auth.uid())::text
      OR public.sen_chat_can_signal((SELECT realtime.topic()))
    )
  );

DROP POLICY IF EXISTS sen_chat_send_private_signaling ON realtime.messages;
CREATE POLICY sen_chat_send_private_signaling ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (extension = 'broadcast' AND public.sen_chat_can_signal((SELECT realtime.topic())));

CREATE OR REPLACE FUNCTION public.sen_chat_notify_call_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.send(jsonb_build_object('callId', NEW.call_id, 'state', NEW.state),
    'call-change', 'sen-alerts:' || NEW.recipient_id::text, true);
  IF TG_OP = 'UPDATE' AND NEW.conversation_id IS NULL THEN
    PERFORM realtime.send(jsonb_build_object('callId', NEW.call_id, 'state', NEW.state),
      'call-change', 'sen-alerts:' || NEW.caller_id::text, true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sen_chat_call_invitation_realtime ON public.chat_call_invitations;
CREATE TRIGGER sen_chat_call_invitation_realtime
  AFTER INSERT OR UPDATE OF state ON public.chat_call_invitations
  FOR EACH ROW EXECUTE FUNCTION public.sen_chat_notify_call_change();

-- Whiteboard data lives only as long as its call; periodic cleanup can use the call lifecycle.
CREATE OR REPLACE FUNCTION public.sen_chat_finish_call_alerts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.chat_call_invitations SET state = 'ended'
    WHERE call_id = NEW.id AND state IN ('ringing', 'accepted');
  DELETE FROM public.chat_whiteboard_items WHERE call_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sen_chat_finish_call_alerts ON public.chat_call_sessions;
CREATE TRIGGER sen_chat_finish_call_alerts AFTER UPDATE OF status ON public.chat_call_sessions
  FOR EACH ROW WHEN (NEW.status = 'ended' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sen_chat_finish_call_alerts();

CREATE OR REPLACE FUNCTION public.sen_chat_store_whiteboard_item(
  session_id uuid, author uuid, item_id uuid, content jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  room uuid;
BEGIN
  SELECT s.conversation_id INTO room FROM public.chat_call_sessions s
    WHERE s.id = session_id AND s.transport_mode = 'sfu'
      AND s.status IN ('active', 'reconnecting') AND (s.expires_at IS NULL OR s.expires_at > now())
    FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.chat_call_participants p WHERE p.call_id = session_id AND p.user_id = author AND p.status = 'joined'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.chat_members m WHERE m.conversation_id = room AND m.user_id = author
  ) THEN
    RETURN 'forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_whiteboard_items b WHERE b.call_id = session_id AND b.id = item_id AND b.author_id = author) THEN
    RETURN 'ok';
  END IF;
  IF content->>'kind' = 'undo' AND NOT EXISTS (
    SELECT 1 FROM public.chat_whiteboard_items b WHERE b.call_id = session_id AND b.id = (content->>'target')::uuid
      AND b.author_id = author AND b.item->>'kind' IN ('note', 'stroke')
  ) THEN
    RETURN 'forbidden';
  END IF;
  IF (SELECT count(*) FROM public.chat_whiteboard_items b
      WHERE b.call_id = session_id AND b.author_id = author AND b.created_at > now() - interval '1 minute') >= 120 THEN
    RETURN 'rate';
  END IF;
  INSERT INTO public.chat_whiteboard_items(call_id,id,author_id,item)
    VALUES (session_id,item_id,author,content);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.sen_chat_store_whiteboard_item(uuid, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_store_whiteboard_item(uuid, uuid, uuid, jsonb) TO service_role;
