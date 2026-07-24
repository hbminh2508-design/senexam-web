-- Nâng cấp hệ thống gói SenAI: Lite/Plus Lite/Plus/Ultra theo tháng hoặc năm, gói Plus có thêm
-- bản Vĩnh viễn, và 1 lượt dùng thử SenAI Plus 3 ngày (chỉ dùng được 1 lần/tài khoản).
-- Run in Supabase SQL Editor SAU KHI đã chạy scripts/senai_tiers_and_admin_tools.sql

-- Mở rộng danh sách hạng SenAI hợp lệ
alter table public.profiles drop constraint if exists profiles_senai_tier_check;
alter table public.profiles add constraint profiles_senai_tier_check
  check (senai_tier in ('free', 'lite', 'plus_lite', 'plus', 'ultra'));

-- Hạn dùng của gói đang mua (null = không có gói trả phí đang hoạt động, TRỪ KHI senai_tier_permanent = true)
alter table public.profiles add column if not exists senai_tier_expires_at timestamptz;

-- true nếu đã mua gói SenAI Plus Vĩnh viễn — không bao giờ hết hạn, bỏ qua senai_tier_expires_at
alter table public.profiles add column if not exists senai_tier_permanent boolean not null default false;

-- Đánh dấu đã dùng lượt dùng thử SenAI Plus 3 ngày — mỗi tài khoản chỉ được dùng 1 lần
alter table public.profiles add column if not exists senai_trial_used boolean not null default false;
