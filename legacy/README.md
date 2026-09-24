# SenExam Legacy Vault (Encrypted Storage)

Thư mục này chứa toàn bộ các mô-đun và tệp mã nguồn phiên bản cũ (Legacy) của hệ thống **SenExam** trước đợt nâng cấp giao diện lớn 2026.

## 1. Cơ chế Bảo mật
- Tất cả các tệp mã nguồn legacy đã được mã hóa theo chuẩn **AES-256-GCM** quân đội để ngăn chặn triệt để nguy cơ quét lỗ hổng (vulnerability scanning), rò rỉ mã nguồn và khai thác dữ liệu cũ.
- Từng tệp riêng lẻ được lưu dưới định dạng `.enc` trong thư mục `encrypted_vault/`.
- Toàn bộ gói tổng hợp được đóng gói trong `vault_archive.enc`.

## 2. Truy cập Giao diện Legacy (Dành cho Admin)
- Trong ứng dụng web, Quản trị viên (Admin/Collab) có thể truy cập các trang legacy để quản lý tính năng cũ thông qua tiền tố:
  - `/legacy-dashboard`
  - `/legacy-admin`
  - `/legacy-exams`
  - `/legacy-library`
  - `/legacy-submissions`
  - `/legacy-vip`
  - `/legacy-senai-studio`
  - ... (toàn bộ các module cũ được cấp đầu `legacy-`)
- Người dùng thông thường khi truy cập các đường dẫn này sẽ tự động được chuyển hướng về giao diện mới (`/new-...` hoặc `/dashboard`).

## 3. Khôi phục / Giải mã mã nguồn khi cần
Nếu Quản trị viên cần khôi phục lại mã nguồn rõ để đối chiếu:
```bash
node legacy/decrypt-vault.js [đường_dẫn_đích]
```
*(Khóa giải mã mặc định được đọc từ biến môi trường `SENEXAM_LEGACY_MASTER_KEY`)*
