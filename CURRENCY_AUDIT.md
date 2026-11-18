# BÁO CÁO KHẢO SÁT TIỀN TỆ & ĐIỂM ẢO HỆ THỐNG SENEXAM (CURRENCY AUDIT)

**Thời điểm khảo sát:** 18/11/2026  
**Môi trường:** Production Database (Supabase PostgreSQL) & Next.js 16 Codebase  
**Trạng thái:** Giai đoạn P1 - Khảo sát chỉ đọc, KHÔNG thực hiện thay đổi dữ liệu nào.

---

## 1. Bản chất và định nghĩa của SC (SenCash) và các loại tiền/điểm ảo

### 1.1. SC (SenCash) - Tiền ảo nền tảng PC
- **Tên gọi:** SenCash (Ký hiệu: **SC**).
- **Tỉ giá cố định:** `500 VND = 1 SenCash` (1 SC = 500đ) (Định nghĩa tại `lib/senCash.ts`).
- **Nơi lưu trữ trong CSDL:**
  - Bảng `public.profiles`: Cột `sencash_balance` (kiểu `integer`, mặc định `0`) và cột dự phòng cũ `sen_cash` (kiểu `integer`).
  - Bảng `public.sencash_transactions`: Sổ cái ghi nhận lịch sử biến động số dư (`user_id`, `amount`, `delta`, `transaction_type`, `reason`, `description`, `reference`, `created_at`).
  - Bảng `public.sencash_topup_orders`: Bảng quản lý đơn nạp tiền qua cổng thanh toán QR ngân hàng (SePay / VietQR) (`order_code`, `amount_vnd`, `sencash_amount`, `status`: `pending` | `paid` | `expired` | `cancelled`).
  - Bảng `public.sencash_vouchers`: Bảng mã voucher quà tặng nội bộ.

### 1.2. SCm (Cash Mobile) - Tiền tệ định hướng độc quyền Di động
- **Tên gọi:** Cash Mobile (Ký hiệu: **SCm**).
- **Tỉ giá định nghĩa:** `1.000 VND = 10 SCm` (1 SCm = 100đ; quy đổi tương đương `1 SC PC = 5 SCm Mobile`).
- **Nơi lưu trữ trong CSDL:**
  - Bảng `public.profiles`: Cột `sencash_mobile_balance` (kiểu `numeric`, mặc định `0`) và cột `scm_balance` (kiểu `numeric`, mặc định `0`).
  - Bảng `public.mobile_sencash_transactions`: Bảng giao dịch riêng của Mobile (`user_id`, `amount`, `balance_after`, `transaction_type`, `description`, `reference_id`, `created_at`).
  - Bảng `public.mobile_sync_devices`: Quản lý thiết bị đồng bộ (`user_id`, `device_id`, `platform`, `app_version`).

### 1.3. Các loại tiền / điểm ảo / tài nguyên có giá trị khác trong hệ thống
1. **Tiền thật (VND) - Quỹ Lớp (Class Funds):**
   - Lưu tại bảng `public.class_funds` và `public.class_fund_payments`. Dùng để thu chi quỹ lớp, học phí thật của học sinh qua cổng thanh toán QR.
2. **Hạn mức Trợ lý SenAI (Daily Question Quota):**
   - Không lưu dưới dạng số dư tiền mà lưu theo số câu hỏi đã dùng trong ngày (`user_question_quotas`) và so sánh với cấp bậc gói (`senai_tier`: `free`: 15 câu/ngày, `basic`: 50 câu/ngày, `pro`: 150 câu/ngày, `master`: 300 câu/ngày, `vip`: 500 câu/ngày, `sen_one`: Không giới hạn).
3. **Điểm thưởng Điểm danh & Chuỗi Ngày (Daily Streak & Checkin):**
   - Lưu tại bảng `public.daily_checkins` (`reward_sc`: 2 SC/ngày) và `profiles.streak_days`.
4. **Mã Quà Tặng (Gift Codes):**
   - Lưu tại bảng `public.gift_codes` và `public.fepn_gift_codes`. Trả thưởng theo `reward_type`: `sencash`, `vip_days`, `senai_tier`, `senai_days`.

---

## 2. Ai kiếm SC và bằng cách nào?

| Phương thức nhận SC | API / Nơi xử lý | Số lượng SC nhận | Điều kiện / Ràng buộc |
| :--- | :--- | :--- | :--- |
| **Nạp tiền thật qua VietQR / SePay** | `/api/sencash/create-topup-order` & Webhook SePay | Số VND nạp / 500 | Tối thiểu 1.000đ, bội số 1.000đ |
| **Điểm danh hàng ngày (Daily Check-in)** | `/api/sen-chat-bubble` / Modal Streak | +2 SC / ngày | Mỗi ngày 1 lần duy nhất (unique checkin_date) |
| **Nhiệm vụ cuối tuần (Weekend Mission)** | `/api/vip/redeem-sencash` | +5 SC | Nhận vào Thứ 7 hoặc Chủ nhật |
| **Đổi mã quà tặng GiftCode** | `/api/gift-codes/redeem` | Tùy mã (VD: 50 SC) | Mã còn hạn, chưa hết lượt sử dụng |
| **Quản trị viên tặng/thưởng trực tiếp** | `/api/admin/gift-sencash` | Tùy admin nhập | Chỉ role `admin` mới gọi được |
| **Khởi tạo tài khoản Quản trị viên** | `/api/admin/ensure-admin-account` | 999.999 SC | Tự động cấp cho tài khoản admin hệ thống |

---

## 3. Tiêu SC bằng cách nào?

| Hành động tiêu SC | API / Hàm thực thi | Số SC bị trừ | Kết quả sau khi tiêu |
| :--- | :--- | :--- | :--- |
| **Đổi gói Hội viên Sen VIP** | `/api/vip/redeem-sencash` | Tùy gói (VD: 1.000 - 9.958 SC) | Nâng cấp `profiles.is_vip = true`, gia hạn `vip_expires_at` |
| **Mua cấp bậc Trợ lý SenAI Studio** | `/api/senai/purchase-tier` | 29 SC - 199 SC | Nâng cấp `profiles.senai_tier`, tăng hạn mức hỏi bài |
| **Tải tài liệu PDF VIP (vượt hạn mức)** | `/api/drive/stream` | 2 SC / lượt tải | Ghi vào `vip_document_downloads` (`paid_with_sencash = true`) |
| **Mua Deal Hot Cửa Hàng Độc Quyền** | `/api/exclusive-store/purchase` | Tùy mặt hàng (VD: 39 SC) | Mở khóa tính năng/thời gian VIP ưu đãi |

---

## 4. Thống kê số dư thực tế trong CSDL Supabase Production

### 4.1. Tổng quan số dư toàn hệ thống
- **Tổng số tài khoản người dùng:** 29 tài khoản.
- **Số tài khoản có số dư SC > 0:** 4 tài khoản (13.8%).
- **Số tài khoản có số dư SC = 0:** 25 tài khoản (86.2%).
- **Tổng số SenCash đang lưu hành:** **1.099.552 SC**.
- **Số dư SCm Mobile hiện có:** **0 SCm trên toàn bộ 29 tài khoản** (chưa từng nạp/tiêu SCm).
- **Số giao dịch trong `mobile_sencash_transactions`:** 0 dòng.
- **Số giao dịch trong `sencash_transactions`:** 36 dòng.

### 4.2. Danh sách chi tiết các tài khoản đang nắm giữ SC

| STT | User ID | Email | Họ và tên | Vai trò (Role) | Số dư SenCash (SC) |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | `e72a7f4d-f29a-40eb-9ae3-547df920e715` | `admin@senexam.me` | SenExam System Administrator | `admin` | **999.999 SC** |
| 2 | `7885277a-f8dd-49ac-bad7-0c939db0af44` | `hoangbinhminh2508@gmail.com` | Hoàng Bình Minh | `admin` | **86.935 SC** |
| 3 | `b52e4323-3174-4ffc-a08f-910eda5c1a0e` | `0100@senexam.me` | Hoàng Bình Minh | `student` | **10.002 SC** |
| 4 | `12008951-3491-4cee-9f2e-5206bb3fa4ef` | `baobint27@gmail.com` | Bảo Minh Trần | `student` | **2.616 SC** |
| - | *25 tài khoản còn lại* | *Đều có số dư bằng 0* | - | `student` / `guest` | **0 SC** |

---

## 5. Các điểm thắt & Lỗi kiến trúc tiền tệ hiện tại trên Mobile

1. **Hiển thị lẫn lộn:**
   - Tại [app/m/profile/page.tsx#L226](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/profile/page.tsx#L226), giao diện hiển thị:  
     `Ví Cash Mobile: 0 SCm (X SC PC)`. Việc này vi phạm yêu cầu tách độc lập hoàn toàn.
   - Tại [app/m/pay/page.tsx#L496](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/pay/page.tsx#L496), thanh Header hiển thị trực tiếp số dư `senCashBalance` (SC của PC).
2. **Tiêu tiền PC trên giao diện Mobile:**
   - Tại [app/m/pay/page.tsx#L330](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/pay/page.tsx#L330), hàm `handleBuySenAiPlan` kiểm tra `senCashBalance < plan.priceSenCash` và gọi API `/api/senai/purchase-tier` trừ thẳng vào ví PC.
   - Tại [app/m/pay/page.tsx#L428](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/pay/page.tsx#L428), mua ưu đãi độc quyền gọi `/api/exclusive-store/purchase` trừ SC PC.
3. **Nạp tiền Mobile tạo đơn PC:**
   - Tại [app/m/pay/page.tsx#L290](file:///c:/Users/hoang/Downloads/senexam-web-main/app/m/pay/page.tsx#L290), hàm `handleCreateTopup` gửi `{ platform: 'mobile' }` tới `/api/sencash/create-topup-order`, nhưng API này cộng vào `profiles.sencash_balance` thay vì ví Mobile riêng.
4. **Cơ hội thuận lợi:**
   - Vì **toàn bộ 29 người dùng hiện có số dư SCm = 0**, việc triển khai kiến trúc ví Mobile độc lập (SCm) trong giai đoạn P2 sẽ **HOÀN TOÀN KHÔNG GÂY THẤT THOÁT HAY XUNG ĐỘT DỮ LIỆU ĐANG CÓ**.
