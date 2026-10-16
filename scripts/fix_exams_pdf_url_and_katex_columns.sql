-- ==============================================================================
-- SENEXAM: BỔ SUNG CỘT BẢNG EXAMS, XÓA RÀNG BUỘC EXAM_TYPE & LÀM MỚI SCHEMA CACHE
-- Chạy đoạn mã này trong Supabase Dashboard -> SQL Editor -> Bấm RUN
-- ==============================================================================

-- 1. Xóa ràng buộc cũ giới hạn exam_type (để cho phép mọi loại kỳ thi: THPTQG, HSA, TSA, SPT, DGNL, Kiểm tra 1 tiết, Học kỳ...)
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;

-- 2. Bổ sung cột pdf_url và solution_pdf_url vào bảng exams (nếu chưa có)
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS solution_pdf_url TEXT DEFAULT NULL;

-- 3. Bổ sung các cột tính năng mới cho đề thi KaTeX & SEB 2026 (nếu chưa có)
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS require_seb BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS require_proctoring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS allow_review BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS grading_method TEXT DEFAULT 'highest',
ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '["Toán học"]'::jsonb,
ADD COLUMN IF NOT EXISTS part_instructions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS folder_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

-- 4. Đảm bảo bảng profiles có cột is_vip và vip_until
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vip_until TIMESTAMPTZ DEFAULT NULL;

-- 5. Làm mới Schema Cache của Supabase PostgREST (Xử lý dứt điểm lỗi cache)
NOTIFY pgrst, 'reload schema';

