# ĐỀ XUẤT CẢI TIẾN TRẢI NGHIỆM NGƯỜI DÙNG (UI PROPOSALS)

**Phạm vi áp dụng:** Các màn hình **NGOÀI** phòng thi (Trang chủ `/m`, Cửa hàng `/m/pay`, Hồ sơ `/m/profile`, Kho đề & Thư viện & Lịch sử `/m/sen-ground`, Xem lại bài nộp `/m/submissions/[id]`).  
**Quy tắc bất biến:** Tuyệt đối **KHÔNG** làm thay đổi giao diện các phòng thi chính thức đã chuẩn hóa theo đúng kỳ thi thật.

---

## 1. Khảo sát hiện trạng công thái học & khả năng tiếp cận (Accessibility & Usability)

| Tiêu chí | Trước cải tiến | Vấn đề phát hiện | Giải pháp cải tiến (P4) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Kích thước mục chạm (Touch Target)** | Một số nút biểu tượng, nút chuyển tab chỉ cao `28px` - `32px`. | Người dùng ngón tay lớn khó bấm trúng, dễ bấm nhầm sang nút bên cạnh khi dùng điện thoại 1 tay. | Áp dụng chuẩn WCAG 2.5.5 / Apple HIG: mọi phần tử tương tác chạm đều đạt tối thiểu $\ge 44\text{px}$ (`min-touch-target`). | ✅ Đã triển khai |
| **Cỡ chữ & Khả năng đọc** | Một số nhãn mô tả phụ dùng cỡ `text-[9px]` hoặc `text-[10px]` với màu `text-slate-400`. | Độ tương phản kém dưới ánh sáng mặt trời, gây mỏi mắt cho học sinh. | Tăng kích thước tối thiểu nội dung chính lên $\ge 12\text{px} - 14\text{px}$, tăng độ tương phản màu lên `text-slate-600` / `dark:text-slate-300`. | ✅ Đã triển khai |
| **Trạng thái đang tải (Loading & Skeleton)** | Màn hình trắng hoặc spinner đơn điệu khi tải dữ liệu trang chủ hoặc kho đề. | Gây cảm giác ứng dụng bị đơ (frozen) trên kết nối mạng di động 3G/4G yếu. | Tích hợp skeleton loading dạng card nhịp nhàng hoặc `ModernLoading` với thông điệp động viên học sinh. | ✅ Đã triển khai |
| **Thông báo khi danh sách rỗng (Empty States)** | Khung xám trơn kèm dòng chữ khô khan "Chưa có dữ liệu". | Thiếu tính định hướng, học sinh không biết cần bấm vào đâu tiếp theo. | Thiết kế Empty State thân thiện: Icon minh họa trực quan + Lời hướng dẫn hành động cụ thể (VD: "Bắt đầu làm bài thi đầu tiên để ghi danh"). | ✅ Đã triển khai |
| **Hiệu ứng chuyển động (Motion Sensitivity)** | Chỉ có cờ tắt chuyển động thủ công trong cài đặt. | Chưa tự động lắng nghe cài đặt trợ năng `prefers-reduced-motion` của HĐH Android / iOS. | Bổ sung `@media (prefers-reduced-motion: reduce)` vào `app/globals.css`, triệt tiêu giật lag trên thiết bị bật chế độ tiết kiệm pin hoặc trợ năng. | ✅ Đã triển khai |

---

## 2. Chi tiết thay đổi trên từng màn hình ngoài phòng thi

### 2.1. Trang chủ di động (`/m`)
- **Trước:** Các nút Quick Actions (Luyện thi, Nạp VIP, Quỹ lớp, v.v.) có padding hẹp, touch target ~36px.
- **Sau:** Nâng kích thước vùng chạm lên $\ge 44\text{px}$, hiệu ứng phản hồi `active:scale-95` mượt mà, bóng đổ êm dịu `shadow-xs`.
- **Lý do:** Đây là sảnh trung tâm thao tác thường xuyên nhất của thí sinh.

### 2.2. Cửa hàng Sen (`/m/pay`)
- **Trước:** Nút chọn các mệnh giá nạp thẻ và gói SenAI có kích thước chữ nhỏ, thẻ nạp SCm sát nhau.
- **Sau:** Phân bổ khoảng cách thẻ thông thoáng (gap-3), nút nạp tiền và mua gói nổi bật với chiều cao $\ge 44\text{px}$, nhãn giá tiền SCm rõ ràng và tự động tính quy đổi sang VNĐ (1 SCm = 100đ).
- **Lý do:** Thao tác tài chính cần rõ ràng, chống bấm nhầm.

### 2.3. Lịch sử bài làm & Thư viện (`/m/sen-ground`)
- **Trước:** Tab Lịch sử chỉ có nút "Làm lại đề", thiếu liên kết xem lại bài làm chi tiết; tab Thư viện nút Tải PDF không hoạt động trên Android WebView.
- **Sau:** Bổ sung nút "Xem lại bài" trực tiếp vào từng bài nộp (`/m/submissions/[id]`); nút tải tài liệu tích hợp `openSafeDownload` ủy quyền mở Android DownloadManager.
- **Lý do:** Giúp học sinh học từ lỗi sai sau khi thi và lưu tài liệu ôn tập về điện thoại an toàn.

### 2.4. Màn hình Xem lại bài thi di động (`/m/submissions/[id]`)
- **Màn hình mới:** Giao diện thẻ câu hỏi bo góc tròn lớn (`rounded-3xl`), hiển thị công thức toán KaTeX và hình vẽ TikZ sắc nét, màu sắc phân biệt trực quan (Xanh = Đúng, Đỏ = Sai), bộ lọc nhanh 3 chế độ (Tất cả, Câu sai, Câu đúng), bảng số câu hỏi dạng ngăn kéo (Drawer).
- **Lý do:** Giải quyết triệt để nhu cầu ôn tập và chữa bài của thí sinh trên smartphone.
