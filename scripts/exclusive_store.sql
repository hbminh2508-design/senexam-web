-- Cửa hàng cao cấp (VIP/Premium): mua gói SenAI Plus/Ultra giá ưu đãi vào ngày sale hàng tháng
-- và đợt Black Friday (giới hạn số suất/năm). Run in Supabase SQL Editor.

-- Ghi lại mỗi suất Black Friday đã được nhận — dùng để đếm "còn bao nhiêu suất" và chặn
-- một người dùng nhận trùng cùng 1 deal trong cùng 1 năm.
create table if not exists public.exclusive_deal_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deal_code text not null,
  claim_year int not null,
  created_at timestamptz not null default now(),
  unique (deal_code, claim_year, user_id)
);

create index if not exists exclusive_deal_claims_deal_year_idx on public.exclusive_deal_claims(deal_code, claim_year);

alter table public.exclusive_deal_claims enable row level security;

drop policy if exists "exclusive_deal_claims_select_own_or_staff" on public.exclusive_deal_claims;
create policy "exclusive_deal_claims_select_own_or_staff" on public.exclusive_deal_claims
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- Không có policy insert cho client: route /api/exclusive-store/purchase ghi bằng service role key
-- sau khi đã kiểm tra còn suất, tránh học sinh tự insert để giành suất mà không thanh toán.
