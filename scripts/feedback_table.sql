-- Bảng lưu feedback người dùng gửi qua chatbot SenAI (gõ "Feedback: ...")
-- Run in Supabase SQL Editor

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  mode text not null default 'basic', -- 'basic' | 'advanced'
  source text not null default 'chat_widget',
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert
  with check (auth.uid() = user_id);

drop policy if exists feedback_select_staff on public.feedback;
create policy feedback_select_staff on public.feedback
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  );
