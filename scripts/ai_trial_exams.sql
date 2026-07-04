-- Tính năng thử nghiệm: AI tạo đề tương tác từ PDF (app/tinhnangthunghiem)
-- Run in Supabase SQL Editor

create table if not exists public.ai_trial_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_file_names text[] not null default '{}',
  exam_structure jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_trial_exams enable row level security;

drop policy if exists ai_trial_exams_select_own on public.ai_trial_exams;
drop policy if exists ai_trial_exams_insert_own on public.ai_trial_exams;
drop policy if exists ai_trial_exams_delete_own on public.ai_trial_exams;

create policy ai_trial_exams_select_own
on public.ai_trial_exams
for select
to authenticated
using (user_id = auth.uid());

create policy ai_trial_exams_insert_own
on public.ai_trial_exams
for insert
to authenticated
with check (user_id = auth.uid());

create policy ai_trial_exams_delete_own
on public.ai_trial_exams
for delete
to authenticated
using (user_id = auth.uid());
