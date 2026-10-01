-- Cập nhật hệ thống VIP cho Gói VIP Premium+, Hệ sinh thái Gói Sen One và Gói Sen One Lite
-- Chạy script này trong Supabase SQL Editor

-- 1. Thêm cột is_vip_premium_plus vào bảng profiles nếu chưa có
alter table public.profiles add column if not exists is_vip_premium_plus boolean default false;

-- 2. Cập nhật check constraint cho public.profiles.plan_tier
alter table public.profiles drop constraint if exists profiles_plan_tier_check;
alter table public.profiles add constraint profiles_plan_tier_check 
  check (plan_tier in ('lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'));

-- 3. Cập nhật check constraint cho public.vip_orders.plan_group
alter table public.vip_orders drop constraint if exists vip_orders_plan_group_check;
alter table public.vip_orders add constraint vip_orders_plan_group_check 
  check (plan_group in ('lite', 'vip', 'premium', 'premium_plus', 'sen_one', 'sen_one_lite'));
