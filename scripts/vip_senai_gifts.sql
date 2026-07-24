-- Quà tặng khi mua VIP: VIP theo tháng tặng SenAI Lite, VIP theo năm tặng SenAI Plus Lite (bỏ qua
-- nếu người dùng đã có hạng SenAI cao hơn hoặc bằng), và voucher giảm 30% gói SenAI Plus năm khi
-- mua VIP từ 3 tháng trở lên (quarterly/yearly). Run in Supabase SQL Editor SAU KHI đã chạy
-- scripts/senai_plans_v2.sql

create table if not exists public.sencash_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('senai_plus_yearly_30off')),
  discount_percent integer not null default 30,
  used boolean not null default false,
  used_at timestamptz,
  source_vip_plan text,
  created_at timestamptz not null default now()
);

create index if not exists sencash_vouchers_user_idx on public.sencash_vouchers(user_id, kind, used);

alter table public.sencash_vouchers enable row level security;

drop policy if exists "sencash_vouchers_select_own" on public.sencash_vouchers;
create policy "sencash_vouchers_select_own" on public.sencash_vouchers
  for select using (user_id = auth.uid());

-- Không có policy insert/update cho client — voucher được cấp khi webhook/route xác nhận mua VIP
-- thành công (service role key), và chỉ route mua gói SenAI mới được đánh dấu đã dùng.
