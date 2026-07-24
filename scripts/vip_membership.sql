-- Hệ thống thành viên VIP: chuyển khoản qua VietQR + xác nhận tự động qua webhook SePay
-- Run in Supabase SQL Editor

-- Trạng thái VIP lưu thẳng trên profiles để việc kiểm tra quyền (isVipActive) chỉ cần 1 lần đọc
alter table public.profiles add column if not exists vip_expires_at timestamptz;
alter table public.profiles add column if not exists vip_plan_code text;

-- Đơn hàng nâng cấp VIP. order_code được nhúng vào nội dung chuyển khoản để đối soát qua webhook
create table if not exists public.vip_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null,
  order_code text not null unique,
  amount_vnd integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  sepay_id text,
  raw_webhook jsonb
);

create index if not exists vip_orders_user_id_idx on public.vip_orders(user_id);
create index if not exists vip_orders_status_idx on public.vip_orders(status);

alter table public.vip_orders enable row level security;

drop policy if exists "vip_orders_select_own_or_staff" on public.vip_orders;
create policy "vip_orders_select_own_or_staff" on public.vip_orders
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

drop policy if exists "vip_orders_insert_own" on public.vip_orders;
create policy "vip_orders_insert_own" on public.vip_orders
  for insert with check (user_id = auth.uid());

-- Không có policy update/delete cho client: đơn hàng chỉ được chuyển sang 'paid' bởi webhook
-- (server dùng service role key, tự bỏ qua RLS).

-- Đánh dấu tài liệu chỉ dành riêng cho thành viên VIP
alter table public.library_documents add column if not exists is_vip_only boolean not null default false;

-- Nhật ký lượt tải tài liệu VIP, dùng để giới hạn 5 lượt/ngày
create table if not exists public.vip_document_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.library_documents(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create index if not exists vip_document_downloads_user_day_idx on public.vip_document_downloads(user_id, downloaded_at);

alter table public.vip_document_downloads enable row level security;

drop policy if exists "vip_downloads_select_own_or_staff" on public.vip_document_downloads;
create policy "vip_downloads_select_own_or_staff" on public.vip_document_downloads
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- Không cho client tự insert nhật ký tải — route /api/drive/stream ghi bằng service role key
-- sau khi đã xác thực và kiểm tra quota, tránh học sinh tự gọi insert để né giới hạn.
