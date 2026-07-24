-- Gói SenAI Plus/Ultra (mua bằng SenCash, tăng số câu hỏi AI/ngày) + công cụ Admin
-- cấp VIP/tặng SenCash cho người dùng. Run in Supabase SQL Editor SAU KHI đã chạy
-- scripts/vip_membership.sql và scripts/sencash_wallet.sql

-- Hạng SenAI hiện tại của người dùng — nâng vĩnh viễn (không theo ngày) khi mua bằng SenCash
alter table public.profiles add column if not exists senai_tier text not null default 'free' check (senai_tier in ('free', 'plus', 'ultra'));

-- Nhật ký mỗi lượt hỏi SenAI ở chế độ Nâng cao (Gemini) — dùng để đếm hạn mức câu hỏi/ngày
create table if not exists public.senai_question_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asked_at timestamptz not null default now()
);

create index if not exists senai_question_log_user_day_idx on public.senai_question_log(user_id, asked_at);

alter table public.senai_question_log enable row level security;

drop policy if exists "senai_log_select_own_or_staff" on public.senai_question_log;
create policy "senai_log_select_own_or_staff" on public.senai_question_log
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- Không có policy insert cho client — route /api/chat ghi bằng service role key sau khi đã kiểm tra hạn mức.

-- Mở rộng danh sách lý do biến động SenCash để gồm cả mua gói SenAI và admin tặng
alter table public.sencash_transactions drop constraint if exists sencash_transactions_reason_check;
alter table public.sencash_transactions add constraint sencash_transactions_reason_check
  check (reason in ('topup', 'vip_redeem', 'vip_download_spend', 'senai_tier_purchase', 'admin_gift'));

-- Nhật ký các thao tác admin cấp VIP / tặng SenCash thủ công, phục vụ đối soát/kiểm tra sau này
create table if not exists public.admin_grants_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('vip_days', 'sencash_gift')),
  amount integer not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_grants_log enable row level security;

drop policy if exists "admin_grants_log_select_staff" on public.admin_grants_log;
create policy "admin_grants_log_select_staff" on public.admin_grants_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- Không có policy insert cho client — route /api/admin/* ghi bằng service role key sau khi đã xác minh role admin.
