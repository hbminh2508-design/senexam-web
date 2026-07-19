-- Hệ thống quản lý phát hành phiên bản cho Admin
-- Run in Supabase SQL Editor

-- 1. Trạng thái phát hành hiện tại (bảng đơn dòng - luôn dùng id = 1)
create table if not exists public.system_release (
  id int primary key default 1,
  latest_version text not null default '0.1.0',
  changelog text not null default '',
  is_published boolean not null default false, -- true = đã đẩy cho tất cả người dùng, false = đang test nội bộ
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint system_release_single_row check (id = 1)
);
insert into public.system_release (id) values (1) on conflict (id) do nothing;

alter table public.system_release enable row level security;

drop policy if exists system_release_select_all on public.system_release;
create policy system_release_select_all on public.system_release
  for select
  using (true); -- ai cũng đọc được để Settings kiểm tra cập nhật

drop policy if exists system_release_write_staff on public.system_release;
create policy system_release_write_staff on public.system_release
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  );

-- 2. Nhật ký hoạt động phát hành (ai bật/tắt test mode, ai đẩy version nào, lúc nào)
create table if not exists public.release_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, -- 'set_version' | 'enable_test' | 'disable_test' | 'publish'
  version text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.release_log enable row level security;

drop policy if exists release_log_insert_staff on public.release_log;
create policy release_log_insert_staff on public.release_log
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  );

drop policy if exists release_log_select_staff on public.release_log;
create policy release_log_select_staff on public.release_log
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  );

-- 3. Log lỗi phía client gửi về từ trình duyệt người dùng (window.onerror / unhandledrejection)
create table if not exists public.client_error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  url text,
  user_agent text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.client_error_log enable row level security;

drop policy if exists client_error_log_insert_any on public.client_error_log;
create policy client_error_log_insert_any on public.client_error_log
  for insert
  with check (true); -- cho phép ghi lỗi kể cả khi chưa đăng nhập/hết phiên

drop policy if exists client_error_log_select_staff on public.client_error_log;
create policy client_error_log_select_staff on public.client_error_log
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collab')
    )
  );
