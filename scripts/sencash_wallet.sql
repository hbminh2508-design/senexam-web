-- Ví SenCash: đồng tiền ảo quy đổi từ VND (500đ = 1 SenCash), dùng để đổi VIP hoặc mua thêm lượt tải tài liệu VIP
-- Run in Supabase SQL Editor SAU KHI đã chạy scripts/vip_membership.sql

alter table public.profiles add column if not exists sencash_balance integer not null default 0;

-- Đơn nạp SenCash — cùng cơ chế VietQR + webhook SePay như vip_orders, nhưng order_code có tiền tố SENCASH
create table if not exists public.sencash_topup_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_code text not null unique,
  amount_vnd integer not null,
  sencash_amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  sepay_id text,
  raw_webhook jsonb
);

create index if not exists sencash_topup_orders_user_id_idx on public.sencash_topup_orders(user_id);
create index if not exists sencash_topup_orders_status_idx on public.sencash_topup_orders(status);

alter table public.sencash_topup_orders enable row level security;

drop policy if exists "sencash_topup_select_own_or_staff" on public.sencash_topup_orders;
create policy "sencash_topup_select_own_or_staff" on public.sencash_topup_orders
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

drop policy if exists "sencash_topup_insert_own" on public.sencash_topup_orders;
create policy "sencash_topup_insert_own" on public.sencash_topup_orders
  for insert with check (user_id = auth.uid());

-- Sổ cái biến động số dư SenCash — mọi thay đổi (nạp, đổi VIP, trừ tải tài liệu) đều có 1 dòng ở đây
create table if not exists public.sencash_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('topup', 'vip_redeem', 'vip_download_spend')),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists sencash_transactions_user_id_idx on public.sencash_transactions(user_id, created_at desc);

alter table public.sencash_transactions enable row level security;

drop policy if exists "sencash_tx_select_own_or_staff" on public.sencash_transactions;
create policy "sencash_tx_select_own_or_staff" on public.sencash_transactions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- Không có policy insert/update cho client — mọi thay đổi số dư đi qua hàm adjust_sencash_balance()
-- được gọi bằng service role key trong route handler, tránh học sinh tự chèn giao dịch giả.

-- Đánh dấu lượt tải tài liệu VIP nào được trả bằng SenCash (2 SenCash/lượt) thay vì nằm trong 5 lượt free/ngày,
-- để bộ đếm quota miễn phí hàng ngày không tính nhầm các lượt đã trả tiền.
alter table public.vip_document_downloads add column if not exists paid_with_sencash boolean not null default false;

-- Hàm cộng/trừ số dư SenCash nguyên tử: khoá dòng profile, kiểm tra không âm nếu là trừ tiền,
-- ghi sổ cái, trả về số dư mới. Chỉ gọi qua service role key (bỏ qua RLS) từ route handler.
create or replace function public.adjust_sencash_balance(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_reference text default null
) returns integer
language plpgsql
as $$
declare
  v_new_balance integer;
begin
  select sencash_balance into v_new_balance from public.profiles where id = p_user_id for update;

  if v_new_balance is null then
    raise exception 'Không tìm thấy tài khoản';
  end if;

  v_new_balance := v_new_balance + p_delta;

  if v_new_balance < 0 then
    raise exception 'Số dư SenCash không đủ';
  end if;

  update public.profiles set sencash_balance = v_new_balance where id = p_user_id;

  insert into public.sencash_transactions (user_id, delta, reason, reference)
  values (p_user_id, p_delta, p_reason, p_reference);

  return v_new_balance;
end;
$$;
