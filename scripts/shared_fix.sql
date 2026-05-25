-- scripts/shared_fix.sql
-- SQL helper để kiểm tra và chuyển các mục do admin/collab tải lên thành "chung" (created_by = NULL)
-- Chạy các câu lệnh này trong Supabase SQL Editor hoặc psql với quyền admin.

-- 1) Xem danh sách admin/collab
SELECT id, email, role FROM profiles WHERE role IN ('admin','collab');

-- 2) Xem các thư mục do admin/collab tạo
SELECT id, name, created_by, created_at FROM library_folders WHERE created_by IN (SELECT id FROM profiles WHERE role IN ('admin','collab')) ORDER BY created_at DESC LIMIT 200;

-- 3) Xem các tài liệu do admin/collab tạo
SELECT id, title, drive_file_id, created_by, created_at FROM library_documents WHERE created_by IN (SELECT id FROM profiles WHERE role IN ('admin','collab')) ORDER BY created_at DESC LIMIT 200;

-- 4) Nếu bạn muốn *chuyển tất cả* mục do admin/collab tạo thành chung (đặt created_by = NULL), bỏ comment và chạy:
-- UPDATE library_folders SET created_by = NULL WHERE created_by IN (SELECT id FROM profiles WHERE role IN ('admin','collab'));
-- UPDATE library_documents SET created_by = NULL WHERE created_by IN (SELECT id FROM profiles WHERE role IN ('admin','collab'));

-- 5) Nếu chỉ muốn chuyển 1 mục cụ thể (ví dụ id = '...') thì dùng:
-- UPDATE library_folders SET created_by = NULL WHERE id = 'PUT_FOLDER_ID_HERE';
-- UPDATE library_documents SET created_by = NULL WHERE id = 'PUT_DOCUMENT_ID_HERE';

-- 6) Nếu muốn đưa các mục có created_by = NULL vào một uploader giả (ví dụ admin root id), thay NULL bằng id cụ thể:
-- UPDATE library_folders SET created_by = 'ADMIN_ID_HERE' WHERE created_by IS NULL;
-- UPDATE library_documents SET created_by = 'ADMIN_ID_HERE' WHERE created_by IS NULL;

-- Lưu ý:
-- - Sao lưu trước khi chạy các UPDATE/DELETE.
-- - Bạn có thể chạy SELECT đầu tiên để kiểm tra danh sách trước khi thực hiện UPDATE.
-- - Sau khi chỉnh sửa, refresh cache/frontend (hard refresh) để thấy thay đổi.
