-- Preserve encrypted inbox messages and remove the default attachment deadline.
ALTER TABLE public.chat_attachments ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE public.chat_attachments ALTER COLUMN is_pinned_permanent SET DEFAULT true;
UPDATE public.chat_attachments SET expires_at = NULL, is_pinned_permanent = true
WHERE NOT is_deleted AND (expires_at IS NOT NULL OR NOT is_pinned_permanent);

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
END;
$$;

REVOKE ALL ON FUNCTION public.sen_chat_cleanup_communications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sen_chat_cleanup_communications() TO service_role;
