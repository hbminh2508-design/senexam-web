-- Nâng cấp hệ thống phát hành: tách 2 kênh Chính thức / Beta + cờ "beta tester" trên profiles
-- Run in Supabase SQL Editor SAU KHI đã chạy scripts/system_release.sql

alter table public.system_release add column if not exists stable_version text not null default '0.1.0';
alter table public.system_release add column if not exists stable_changelog text not null default '';
alter table public.system_release add column if not exists stable_published boolean not null default false;
alter table public.system_release add column if not exists beta_version text not null default '0.1.0';
alter table public.system_release add column if not exists beta_changelog text not null default '';
alter table public.system_release add column if not exists beta_published boolean not null default false;

-- Di chuyển dữ liệu cũ (nếu có) sang kênh Chính thức để không mất cấu hình đã đẩy trước đó
update public.system_release
set stable_version = latest_version,
    stable_changelog = changelog,
    stable_published = is_published
where id = 1;

-- Cờ đánh dấu người dùng đã trả lời đúng 2 câu hỏi để tham gia chương trình Beta
alter table public.profiles add column if not exists is_beta_tester boolean not null default false;
