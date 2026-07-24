-- SenAI Studio: app trò chuyện AI riêng dành cho thành viên SenAI Ultra — lưu lịch sử theo
-- từng cuộc trò chuyện, hỗ trợ đính kèm hình ảnh/tài liệu, không giới hạn số lượt hỏi.
-- Run in Supabase SQL Editor SAU KHI đã chạy scripts/senai_tiers_and_admin_tools.sql

create table if not exists public.senai_studio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Cuộc trò chuyện mới',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists senai_studio_sessions_user_idx on public.senai_studio_sessions(user_id, updated_at desc);

alter table public.senai_studio_sessions enable row level security;

drop policy if exists "senai_studio_sessions_all_own" on public.senai_studio_sessions;
create policy "senai_studio_sessions_all_own" on public.senai_studio_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.senai_studio_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.senai_studio_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null default '',
  attachments jsonb not null default '[]',
  deep_think boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists senai_studio_messages_session_idx on public.senai_studio_messages(session_id, created_at);

alter table public.senai_studio_messages enable row level security;

drop policy if exists "senai_studio_messages_select_own" on public.senai_studio_messages;
create policy "senai_studio_messages_select_own" on public.senai_studio_messages
  for select using (user_id = auth.uid());

-- Không có policy insert cho client — route /api/senai-studio/chat ghi bằng service role key
-- sau khi đã xác minh gói SenAI Ultra, tránh học sinh tự chèn tin nhắn giả hoặc né giới hạn.
