-- Cờ bật/tắt giao diện mới (New UI) theo từng tài khoản
-- Run in Supabase SQL Editor

alter table public.profiles
  add column if not exists new_ui_enabled boolean not null default false;
