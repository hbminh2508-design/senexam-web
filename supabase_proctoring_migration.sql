-- ==============================================================================
-- SENEXAM & SEB: CƠ SỞ DỮ LIỆU ĐỒNG BỘ GIÁM THỊ AI & QUẢN LÝ HỌC SINH THEO TRƯỜNG/LỚP
-- Chạy script này trực tiếp trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. BỔ SUNG CÁC TRƯỜNG THÔNG TIN PHÂN LOẠI VÀ SỐ ĐIỆN THOẠI VÀO BẢNG PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS class_name TEXT,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Index để tối ưu tìm kiếm và nhóm theo SĐT, Trường, Lớp
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school);
CREATE INDEX IF NOT EXISTS idx_profiles_class_name ON public.profiles(class_name);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON public.profiles(province);

-- 2. BỔ SUNG CÁC CỘT GIÁM SÁT KỶ LUẬT VÀ SĐT VÀO BẢNG SUBMISSIONS (BÀI NỘP)
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS class_name TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS tab_switches INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blur_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_camera BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_submissions_disqualified ON public.submissions(is_disqualified);
CREATE INDEX IF NOT EXISTS idx_submissions_phone ON public.submissions(phone_number);

-- 3. TẠO HOẶC CẬP NHẬT BẢNG NHẬT KÝ GIÁM THỊ AI (EXAM_PROCTORING_LOGS)
-- Lưu lại lịch sử phát hiện dùng điện thoại (camera sau), che cam, phao thi
-- và trạng thái học sinh không dùng camera nhưng có làm bài hay không.
CREATE TABLE IF NOT EXISTS public.exam_proctoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    school TEXT,
    class_name TEXT,
    province TEXT,
    subject TEXT,
    has_camera BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_disqualified BOOLEAN DEFAULT FALSE,
    violation_type TEXT NOT NULL DEFAULT 'none',
    -- 'none' | 'camera_blocked' | 'phone_detected' | 'cheat_sheet_detected' | 'multiple_people' | 'face_missing' | 'no_camera'
    severity TEXT NOT NULL DEFAULT 'warning', 
    -- 'info' | 'warning' | 'critical'
    confidence NUMERIC DEFAULT 0,
    snapshot_url TEXT, -- Lưu URL ảnh bằng chứng hoặc Base64 snapshot (chỉ lưu khi có vi phạm)
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bổ sung cột cho bảng nếu đã tạo từ trước
ALTER TABLE public.exam_proctoring_logs
ADD COLUMN IF NOT EXISTS user_phone TEXT,
ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT FALSE;

-- Index tăng tốc truy vấn theo đề thi, người dùng và thời gian
CREATE INDEX IF NOT EXISTS idx_proctor_exam_id ON public.exam_proctoring_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_proctor_user_id ON public.exam_proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proctor_created_at ON public.exam_proctoring_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctor_violation ON public.exam_proctoring_logs(violation_type);
CREATE INDEX IF NOT EXISTS idx_proctor_phone ON public.exam_proctoring_logs(user_phone);

-- 4. THIẾT LẬP RLS (ROW LEVEL SECURITY)
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

-- 5. HÀM TỰ ĐỘNG DỌN DẸP BẰNG CHỨNG SAU 1 TUẦN (7 NGÀY)
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

-- 6. CẤU HÌNH SUPABASE STORAGE CHO ẢNH BẰNG CHỨNG (TÙY CHỌN NẾU DÙNG BUCKET)
INSERT INTO storage.buckets (id, name, public)
VALUES ('proctoring-evidence', 'proctoring-evidence', true)
ON CONFLICT (id) DO NOTHING;

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
