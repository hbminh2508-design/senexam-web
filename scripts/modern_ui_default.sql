-- Đặt "Giao diện Mới" (trước đây gọi là Beta UI) thành giao diện CHÍNH THỨC cho mọi tài khoản.
-- Không còn yêu cầu tham gia Chương trình Beta để dùng — chương trình Beta giờ chỉ còn ý nghĩa
-- "nhận bản cập nhật thử nghiệm sớm hơn" (xem is_beta_tester), tách hẳn khỏi lựa chọn giao diện.
-- Run in Supabase SQL Editor sau khi đã chạy scripts/new_ui_flag.sql

-- Tài khoản mới tạo từ nay mặc định vào thẳng Giao diện Mới
alter table public.profiles alter column new_ui_enabled set default true;

-- Bật luôn cho toàn bộ tài khoản đang có sẵn — chỉ những ai TỰ TAY đổi về "Mặc định" trong Cài đặt
-- sau lần chạy script này mới còn thấy giao diện cũ (ghi new_ui_enabled = false).
update public.profiles set new_ui_enabled = true where new_ui_enabled = false;
