-- =====================================================================================
-- BẢN MIGRATION SUPABASE TOÀN DIỆN CHO SENEXAM:
-- 1. HỆ THỐNG MÃ QUÀ TẶNG (GIFT CODE) SENEXAM
-- 2. HỆ THỐNG TỰ ĐỘNG LƯU CUỘC TRÒ CHUYỆN VÀO SENAI STUDIO TỪ SEN CHAT BONG BÓNG
-- 3. HỖ TRỢ KÍCH HOẠT TÍNH NĂNG MOBILE & CHẾ ĐỘ SIÊU MƯỢT TIẾT KIỆM PIN (ECO MODE)
-- =====================================================================================
-- Chạy script này trực tiếp trên Supabase Dashboard -> SQL Editor
-- Script được viết an toàn với mệnh đề IF NOT EXISTS, có thể chạy lại nhiều lần mà không mất dữ liệu.

-- -------------------------------------------------------------------------------------
-- PHẦN 1: HỆ THỐNG MÃ QUÀ TẶNG (GIFT CODES)
-- -------------------------------------------------------------------------------------

-- 1.1 Bảng lưu danh sách mã quà tặng (do Admin tạo hoặc phát sinh tự động)
create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  reward_type text not null check (reward_type in ('vip_days', 'sencash', 'senai_tier')),
  reward_vip_days integer default 0,
  reward_sencash_amount integer default 0,
  reward_senai_tier text check (reward_senai_tier in ('lite', 'plus_lite', 'plus', 'ultra', 'max')),
  reward_senai_duration_days integer default 0,
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

-- Cập nhật ràng buộc hạng SenAI để hỗ trợ đầy đủ từ lite đến max (Sen Max Q4 Roadmap)
alter table public.gift_codes drop constraint if exists gift_codes_reward_senai_tier_check;
alter table public.gift_codes add constraint gift_codes_reward_senai_tier_check
  check (reward_senai_tier is null or reward_senai_tier in ('lite', 'plus_lite', 'plus', 'ultra', 'max'));

create index if not exists gift_codes_code_idx on public.gift_codes(code);
create index if not exists gift_codes_batch_idx on public.gift_codes(batch_id, created_at desc);

alter table public.gift_codes enable row level security;

-- Client không truy vấn trực tiếp bảng gift_codes để tránh quét trộm mã, chỉ truy cập qua RPC hoặc Service Role
drop policy if exists "gift_codes_admin_all" on public.gift_codes;
create policy "gift_codes_admin_all" on public.gift_codes
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );

-- 1.2 Bảng ghi nhận lịch sử đổi mã quà tặng (chống 1 người đổi 2 lần cùng 1 mã)
create table if not exists public.gift_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.gift_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code_id, user_id)
);

create index if not exists gift_code_redemptions_user_idx on public.gift_code_redemptions(user_id, redeemed_at desc);

alter table public.gift_code_redemptions enable row level security;

drop policy if exists "gift_code_redemptions_select_own" on public.gift_code_redemptions;
create policy "gift_code_redemptions_select_own" on public.gift_code_redemptions
  for select using (user_id = auth.uid());

-- 1.3 Mở rộng lý do biến động SenCash để hỗ trợ đổi mã quà tặng ('gift_code')
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sencash_transactions') then
    alter table public.sencash_transactions drop constraint if exists sencash_transactions_reason_check;
    alter table public.sencash_transactions add constraint sencash_transactions_reason_check
      check (reason in ('topup', 'vip_redeem', 'vip_download_spend', 'senai_tier_purchase', 'admin_gift', 'gift_code'));
  end if;
end $$;

-- 1.4 Hàm RPC Đổi Mã Quà Tặng Nguyên Tử (Atomic Safe Redemption)
create or replace function public.redeem_gift_code(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_code public.gift_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_new_balance integer;
  v_new_vip_exp timestamptz;
  v_reward_desc text;
begin
  -- 1. Chuẩn hóa mã (xóa khoảng trắng, chuyển chữ hoa)
  p_code := upper(trim(p_code));
  if p_code = '' then
    return jsonb_build_object('success', false, 'error', 'Mã quà tặng không được để trống.');
  end if;

  -- 2. Khóa dòng mã quà tặng để kiểm tra (chống race condition đồng thời)
  select * into v_code
  from public.gift_codes
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Mã quà tặng không tồn tại hoặc đã nhập sai.');
  end if;

  if not v_code.active then
    return jsonb_build_object('success', false, 'error', 'Mã quà tặng này đã bị tạm dừng kích hoạt.');
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'Mã quà tặng này đã hết hạn sử dụng.');
  end if;

  if v_code.used_count >= v_code.max_uses then
    return jsonb_build_object('success', false, 'error', 'Mã quà tặng đã hết lượt sử dụng.');
  end if;

  -- 3. Kiểm tra user đã đổi mã này chưa
  if exists (select 1 from public.gift_code_redemptions where code_id = v_code.id and user_id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'Bạn đã sử dụng mã quà tặng này rồi.');
  end if;

  -- 4. Lấy thông tin tài khoản
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Không tìm thấy hồ sơ người dùng.');
  end if;

  -- 5. Áp dụng phần thưởng theo loại
  if v_code.reward_type = 'sencash' then
    v_new_balance := coalesce(v_profile.sencash_balance, 0) + v_code.reward_sencash_amount;
    update public.profiles
    set sencash_balance = v_new_balance
    where id = p_user_id;

    -- Ghi nhận lịch sử giao dịch SenCash
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sencash_transactions') then
      insert into public.sencash_transactions (user_id, amount, transaction_type, description, reason, reference)
      values (p_user_id, v_code.reward_sencash_amount, 'gift', 'Đổi mã quà tặng: ' || v_code.code, 'gift_code', v_code.code);
    end if;

    v_reward_desc := '+' || v_code.reward_sencash_amount || ' SenCash';

  elsif v_code.reward_type = 'vip_days' then
    if v_profile.vip_expires_at is not null and v_profile.vip_expires_at > now() then
      v_new_vip_exp := v_profile.vip_expires_at + (v_code.reward_vip_days || ' days')::interval;
    else
      v_new_vip_exp := now() + (v_code.reward_vip_days || ' days')::interval;
    end if;

    update public.profiles
    set vip_expires_at = v_new_vip_exp
    where id = p_user_id;

    v_reward_desc := '+' || v_code.reward_vip_days || ' ngày Sen VIP';

  elsif v_code.reward_type = 'senai_tier' then
    if v_code.reward_senai_permanent then
      update public.profiles
      set senai_tier = v_code.reward_senai_tier,
          senai_tier_permanent = true,
          senai_tier_expires_at = null
      where id = p_user_id;
      v_reward_desc := 'Gói ' || upper(v_code.reward_senai_tier) || ' (Vĩnh viễn)';
    else
      update public.profiles
      set senai_tier = v_code.reward_senai_tier,
          senai_tier_permanent = false,
          senai_tier_expires_at = now() + (v_code.reward_senai_duration_days || ' days')::interval
      where id = p_user_id;
      v_reward_desc := 'Gói ' || upper(v_code.reward_senai_tier) || ' (' || v_code.reward_senai_duration_days || ' ngày)';
    end if;
  end if;

  -- 6. Ghi nhận lượt đổi và tăng used_count
  insert into public.gift_code_redemptions (code_id, user_id)
  values (v_code.id, p_user_id);

  update public.gift_codes
  set used_count = used_count + 1
  where id = v_code.id;

  return jsonb_build_object(
    'success', true,
    'message', 'Đổi mã quà tặng thành công!',
    'reward', v_reward_desc,
    'reward_type', v_code.reward_type
  );
end;
$$;


-- -------------------------------------------------------------------------------------
-- PHẦN 2: HỆ THỐNG TỰ ĐỘNG LƯU CUỘC TRÒ CHUYỆN VÀO SENAI STUDIO TỪ SEN CHAT BONG BÓNG
-- -------------------------------------------------------------------------------------

-- 2.1 Bảng lưu các phiên trò chuyện (SenAI Studio Sessions)
create table if not exists public.senai_studio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Cuộc trò chuyện mới',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists senai_studio_sessions_user_idx
  on public.senai_studio_sessions(user_id, updated_at desc);

alter table public.senai_studio_sessions enable row level security;

drop policy if exists "senai_studio_sessions_all_own" on public.senai_studio_sessions;
create policy "senai_studio_sessions_all_own" on public.senai_studio_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2.2 Bảng lưu từng tin nhắn trong cuộc trò chuyện (SenAI Studio Messages)
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

create index if not exists senai_studio_messages_session_idx
  on public.senai_studio_messages(session_id, created_at asc);

alter table public.senai_studio_messages enable row level security;

drop policy if exists "senai_studio_messages_select_own" on public.senai_studio_messages;
create policy "senai_studio_messages_select_own" on public.senai_studio_messages
  for select using (user_id = auth.uid());

drop policy if exists "senai_studio_messages_insert_own" on public.senai_studio_messages;
create policy "senai_studio_messages_insert_own" on public.senai_studio_messages
  for insert with check (user_id = auth.uid());

-- 2.3 Bảng nhật ký số lượt hỏi AI mỗi ngày (SenAI Question Log)
create table if not exists public.senai_question_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asked_at timestamptz not null default now()
);

create index if not exists senai_question_log_user_day_idx
  on public.senai_question_log(user_id, asked_at desc);

alter table public.senai_question_log enable row level security;

drop policy if exists "senai_log_select_own_or_staff" on public.senai_question_log;
create policy "senai_log_select_own_or_staff" on public.senai_question_log
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'collab'))
  );


-- -------------------------------------------------------------------------------------
-- PHẦN 3: HỖ TRỢ KÍCH HOẠT TÍNH NĂNG MOBILE & CHẾ ĐỘ SIÊU MƯỢT (ECO MODE)
-- -------------------------------------------------------------------------------------

-- 3.1 Bổ sung các cột cấu hình mobile vào bảng profiles
alter table public.profiles add column if not exists mobile_eco_mode boolean not null default false;
alter table public.profiles add column if not exists mobile_low_transparency boolean not null default false;
alter table public.profiles add column if not exists last_mobile_active_at timestamptz;

-- 3.2 Hàm RPC đồng bộ tùy chọn tiết kiệm pin & siêu mượt của người dùng mobile
create or replace function public.update_mobile_preferences(
  p_eco_mode boolean,
  p_low_transparency boolean default true
)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set mobile_eco_mode = p_eco_mode,
      mobile_low_transparency = p_low_transparency,
      last_mobile_active_at = now()
  where id = auth.uid();
end;
$$;


-- -------------------------------------------------------------------------------------
-- MÃ QUÀ TẶNG MẪU ĐỂ TEST THỬ NGHIỆM TRÊN HỆ THỐNG
-- -------------------------------------------------------------------------------------
insert into public.gift_codes (code, reward_type, reward_sencash_amount, reward_vip_days, max_uses, note)
values
  ('SENEXAM2026', 'sencash', 500, 0, 1000, 'Mã quà tặng mừng năm mới SenExam 2026'),
  ('SENEXPERIENCE', 'vip_days', 0, 7, 500, 'Tặng 7 ngày trải nghiệm VIP SenExam'),
  ('MOBILEECO2026', 'sencash', 200, 0, 500, 'Mã tri ân người dùng kích hoạt phiên bản Mobile')
on conflict (code) do nothing;
