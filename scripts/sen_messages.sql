-- Sen Messages (Beta): phòng chat chung, tin nhắn tự xóa sau 1 phút bằng API.
-- Chạy file này trong Supabase SQL Editor trước khi bật tính năng.

create table if not exists public.sen_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  message text,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  created_at timestamptz not null default now()
);

create index if not exists sen_messages_created_at_idx on public.sen_messages(created_at);

alter table public.sen_messages enable row level security;

drop policy if exists "sen_messages_select_authenticated" on public.sen_messages;
create policy "sen_messages_select_authenticated" on public.sen_messages
  for select using (auth.uid() is not null);

drop policy if exists "sen_messages_insert_authenticated" on public.sen_messages;
create policy "sen_messages_insert_authenticated" on public.sen_messages
  for insert with check (auth.uid() is not null);
