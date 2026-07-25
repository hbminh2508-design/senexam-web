-- Mở rộng hệ thống VIP (scripts/vip_membership.sql) thêm 2 hạng gói: Lite (rẻ hơn, ít đặc quyền
-- hơn) và Premium (gấp 3 giá VIP, đổi giao diện chữ SenExam + tặng hạng SenAI cao hơn).
-- Run in Supabase SQL Editor sau khi đã chạy vip_membership.sql

-- Hạng gói đang active (khi vip_expires_at > now()) — cột cũ vip_expires_at/vip_plan_code vẫn giữ
-- nguyên ý nghĩa "thời hạn/mã gói đang có hiệu lực", chỉ thêm chiều "gói nào" bên cạnh.
-- Hồ sơ VIP tạo trước khi có cột này sẽ có plan_tier = null — ứng dụng coi null là 'vip' để
-- tương thích ngược (xem getEffectivePlanTier trong lib/vipMembership.ts).
alter table public.profiles add column if not exists plan_tier text check (plan_tier in ('lite', 'vip', 'premium'));

-- Nhóm gói của từng đơn hàng — cần thiết vì mã thời hạn (vd. 'monthly', 'yearly') trùng nhau giữa
-- các nhóm nhưng giá khác nhau, nên chỉ có plan_code không đủ để tra đúng bảng giá khi đối soát.
alter table public.vip_orders add column if not exists plan_group text not null default 'vip' check (plan_group in ('lite', 'vip', 'premium'));
