CREATE TABLE IF NOT EXISTS public.chat_inbox_devices (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  public_key jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.chat_inbox_messages (
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  group_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  ephemeral_key jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, message_id)
);

CREATE TABLE IF NOT EXISTS public.chat_inbox_deliveries (
  sender_id uuid NOT NULL,
  message_id text NOT NULL,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL,
  wrapped_key text NOT NULL,
  wrap_iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  PRIMARY KEY (sender_id, message_id, user_id, device_id),
  FOREIGN KEY (sender_id, message_id) REFERENCES public.chat_inbox_messages(sender_id, message_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, device_id) REFERENCES public.chat_inbox_devices(user_id, device_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chat_inbox_deliveries_pending_idx
  ON public.chat_inbox_deliveries(user_id, device_id, created_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS chat_inbox_messages_expiry_idx ON public.chat_inbox_messages(created_at);
CREATE INDEX IF NOT EXISTS chat_inbox_messages_sender_recent_idx ON public.chat_inbox_messages(sender_id, created_at DESC);

ALTER TABLE public.chat_inbox_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_inbox_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_inbox_devices, public.chat_inbox_messages, public.chat_inbox_deliveries FROM anon, authenticated;
GRANT ALL ON public.chat_inbox_devices, public.chat_inbox_messages, public.chat_inbox_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.sen_chat_deliver_encrypted(
  sender uuid, message text, group_id uuid, encrypted text, nonce text, ephemeral jsonb, deliveries jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inserted integer;
  recipient uuid;
  recipients jsonb := '[]'::jsonb;
BEGIN
  INSERT INTO public.chat_inbox_messages(sender_id, message_id, group_id, ciphertext, iv, ephemeral_key)
    VALUES (sender, message, group_id, encrypted, nonce, ephemeral)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN RETURN recipients; END IF;

  INSERT INTO public.chat_inbox_deliveries(sender_id, message_id, user_id, device_id, wrapped_key, wrap_iv)
    SELECT sender, message, d.user_id, d.device_id, d.wrapped_key, d.wrap_iv
    FROM jsonb_to_recordset(deliveries) AS d(user_id uuid, device_id uuid, wrapped_key text, wrap_iv text)
    ON CONFLICT DO NOTHING;

  FOR recipient IN
    SELECT DISTINCT d.user_id FROM public.chat_inbox_deliveries d WHERE d.sender_id = sender AND d.message_id = message
  LOOP
    recipients := recipients || to_jsonb(recipient);
    PERFORM realtime.send('{}'::jsonb, 'inbox-change', 'sen-alerts:' || recipient::text, true);
  END LOOP;
  RETURN recipients;
END;
$$;

REVOKE ALL ON FUNCTION public.sen_chat_deliver_encrypted(uuid, text, uuid, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_deliver_encrypted(uuid, text, uuid, text, text, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.sen_chat_cleanup_communications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.cleanup_stale_call_sessions();
  UPDATE public.chat_call_sessions s SET status = 'ended', ended_at = now(),
    end_reason = 'ALL_PARTICIPANTS_LEFT', updated_at = now()
  WHERE s.status IN ('active', 'reconnecting', 'ringing')
    AND s.created_at < now() - interval '2 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_call_participants p WHERE p.call_id = s.id AND p.status = 'joined'
    );
  DELETE FROM public.chat_call_invitations WHERE created_at < now() - interval '7 days';
  DELETE FROM public.chat_inbox_messages WHERE created_at < now() - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.sen_chat_cleanup_communications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_cleanup_communications() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('sen-chat-communications-cleanup', '*/2 * * * *', 'SELECT public.sen_chat_cleanup_communications()');
  END IF;
END;
$$;
