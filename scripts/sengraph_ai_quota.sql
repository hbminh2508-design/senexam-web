-- Bảng nhật ký truy vấn Sen AI trong SenGraph để kiểm soát hạn mức (Plus: 1 câu/ngày, Ultra: 5 câu/ngày)
-- Chạy script này trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.sengraph_ai_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sengraph_ai_log_user_day_idx ON public.sengraph_ai_log(user_id, asked_at);

ALTER TABLE public.sengraph_ai_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sengraph_log_select_own_or_staff" ON public.sengraph_ai_log;
CREATE POLICY "sengraph_log_select_own_or_staff" ON public.sengraph_ai_log
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'collab'))
  );
