-- ==============================================================================
-- SENEXAM & SEB: CƠ SỞ DỮ LIỆU ĐỒNG BỘ GIÁM THỊ AI & QUẢN LÝ HỌC SINH THEO TRƯỜNG/LỚP
-- Chạy script này trực tiếp trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. BỔ SUNG CÁC TRƯỜNG THÔNG TIN PHÂN LOẠI VÀO BẢNG PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS class_name TEXT,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Index để tối ưu tìm kiếm và nhóm theo Trường, Lớp
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school);
CREATE INDEX IF NOT EXISTS idx_profiles_class_name ON public.profiles(class_name);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON public.profiles(province);

-- 2. TẠO BẢNG NHẬT KÝ GIÁM THỊ AI (EXAM_PROCTORING_LOGS)
-- Lưu lại lịch sử kiểm tra camera, phát hiện che cam, dùng điện thoại, phao thi
-- và trạng thái học sinh không dùng camera nhưng có làm bài hay không.
CREATE TABLE IF NOT EXISTS public.exam_proctoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    school TEXT,
    class_name TEXT,
    province TEXT,
    subject TEXT,
    has_camera BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    violation_type TEXT NOT NULL DEFAULT 'none',
    -- 'none' | 'camera_blocked' | 'phone_detected' | 'cheat_sheet_detected' | 'multiple_people' | 'face_missing' | 'no_camera'
    severity TEXT NOT NULL DEFAULT 'warning', 
    -- 'info' | 'warning' | 'critical'
    confidence NUMERIC DEFAULT 0,
    snapshot_url TEXT, -- Lưu URL ảnh bằng chứng hoặc Base64 snapshot
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tăng tốc truy vấn theo đề thi, người dùng và thời gian
CREATE INDEX IF NOT EXISTS idx_proctor_exam_id ON public.exam_proctoring_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_proctor_user_id ON public.exam_proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proctor_created_at ON public.exam_proctoring_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctor_violation ON public.exam_proctoring_logs(violation_type);

-- 3. THIẾT LẬP RLS (ROW LEVEL SECURITY)
ALTER TABLE public.exam_proctoring_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép học sinh gửi nhật ký/bằng chứng khi làm bài thi
DROP POLICY IF EXISTS "Users can insert their own proctoring logs" ON public.exam_proctoring_logs;
CREATE POLICY "Users can insert their own proctoring logs"
ON public.exam_proctoring_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Cho phép người dùng xem log của chính mình
DROP POLICY IF EXISTS "Users can view their own proctoring logs" ON public.exam_proctoring_logs;
CREATE POLICY "Users can view their own proctoring logs"
ON public.exam_proctoring_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Cho phép Admin và Service Role toàn quyền đọc/xóa log giám thị
DROP POLICY IF EXISTS "Admins can view all proctoring logs" ON public.exam_proctoring_logs;
CREATE POLICY "Admins can view all proctoring logs"
ON public.exam_proctoring_logs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'collab')
    )
);

-- 4. HÀM TỰ ĐỘNG DỌN DẸP BẰNG CHỨNG SAU 1 TUẦN (7 NGÀY)
-- Hệ thống lưu giữ các hình ảnh và hành vi vi phạm trong vòng 7 ngày đúng theo yêu cầu.
CREATE OR REPLACE FUNCTION public.cleanup_old_proctoring_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.exam_proctoring_logs
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Nếu database của bạn đã bật pg_cron (tùy chọn trong Supabase Database -> Extensions),
-- bạn có thể lên lịch chạy tự động hàm dọn dẹp mỗi đêm lúc 02:00:
-- SELECT cron.schedule('cleanup-proctoring-logs-nightly', '0 2 * * *', 'SELECT public.cleanup_old_proctoring_logs();');

-- 5. CẤU HÌNH SUPABASE STORAGE CHO ẢNH BẰNG CHỨNG (TÙY CHỌN NẾU DÙNG BUCKET)
-- Tạo bucket 'proctoring-evidence' nếu chưa có
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-evidence', 'proctoring-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Chính sách cho phép tải ảnh bằng chứng vào bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload proctoring evidence" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload proctoring evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proctoring-evidence');

DROP POLICY IF EXISTS "Allow public read proctoring evidence" ON storage.objects;
CREATE POLICY "Allow public read proctoring evidence"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'proctoring-evidence');
