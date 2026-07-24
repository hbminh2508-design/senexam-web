-- Hệ thống mã quà tặng: admin tạo hàng loạt mã, mỗi mã tặng VIP (số ngày), SenCash, hoặc gói SenAI
-- (hạng + thời hạn/vĩnh viễn) — người dùng tự đổi mã ở /vi-sen. Run in Supabase SQL Editor SAU KHI
-- đã chạy scripts/vip_senai_gifts.sql

create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  reward_type text not null check (reward_type in ('vip_days', 'sencash', 'senai_tier')),
  reward_vip_days integer,
  reward_sencash_amount integer,
  reward_senai_tier text check (reward_senai_tier in ('lite', 'plus_lite', 'plus', 'ultra')),
  reward_senai_duration_days integer,
  reward_senai_permanent boolean not null default false,
  batch_id uuid not null default gen_random_uuid(),
  note text,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists gift_codes_code_idx on public.gift_codes(code);
create index if not exists gift_codes_batch_idx on public.gift_codes(batch_id, created_at desc);

alter table public.gift_codes enable row level security;
-- Không có policy nào cho client — chỉ truy cập qua route server dùng service role key
-- (admin tạo/xem danh sách mã, người dùng đổi mã), tránh lộ danh sách mã qua truy vấn trực tiếp.

create table if not exists public.gift_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.gift_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_id)
);

alter table public.gift_code_redemptions enable row level security;

drop policy if exists "gift_code_redemptions_select_own" on public.gift_code_redemptions;
create policy "gift_code_redemptions_select_own" on public.gift_code_redemptions
  for select using (user_id = auth.uid());

-- Mở rộng lý do biến động SenCash để gồm cả trường hợp đổi từ mã quà tặng
alter table public.sencash_transactions drop constraint if exists sencash_transactions_reason_check;
alter table public.sencash_transactions add constraint sencash_transactions_reason_check
  check (reason in ('topup', 'vip_redeem', 'vip_download_spend', 'senai_tier_purchase', 'admin_gift', 'gift_code'));
