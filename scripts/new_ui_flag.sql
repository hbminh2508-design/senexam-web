-- Cờ bật/tắt giao diện mới (New UI) + màu chủ đề, theo từng tài khoản
-- Run in Supabase SQL Editor

alter table public.profiles
  add column if not exists new_ui_enabled boolean not null default false;

alter table public.profiles
  add column if not exists theme_color text not null default 'terracotta';
