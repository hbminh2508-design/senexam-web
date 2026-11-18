-- ==============================================================================
-- MIGRATION 002: CHỐNG NỘP TRÙNG LẶP & RÀNG BUỘC IDEMPOTENCY CHO BÀI THI
-- Mục đích: Đảm bảo tính toàn vẹn khi nộp bài, chống race condition và hỗ trợ server timing
-- Trạng thái: ĐỀ XUẤT - CHỜ PHÊ DUYỆT CỦA QUẢN TRỊ VIÊN
-- ==============================================================================

-- 1. Bổ sung cột idempotency_key vào bảng submissions để khóa giao dịch cấp cơ sở dữ liệu
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2. Thêm cột ghi nhận trạng thái quá hạn / vi phạm giờ thi
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS is_disqualified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS disqualification_reason text;

-- 3. Tạo Unique Index có điều kiện trên idempotency_key (nếu key tồn tại)
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_idempotency_key 
ON public.submissions (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 4. Tạo Index cho tra cứu và tối ưu truy vấn bài thi của học sinh
CREATE INDEX IF NOT EXISTS idx_submissions_exam_user 
ON public.submissions (exam_id, user_id);

-- 5. Bật Row Level Security cho bảng submissions nếu chưa bật
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 6. Học sinh chỉ được xem bài nộp của chính mình
DROP POLICY IF EXISTS "Users can read own submissions" ON public.submissions;
CREATE POLICY "Users can read own submissions" 
ON public.submissions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id::uuid);

-- 7. Cấm học sinh tự ý sửa hoặc xóa bài nộp
DROP POLICY IF EXISTS "Disallow client update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Disallow client delete submissions" ON public.submissions;
