-- ============================================================================
-- SENEXAM: VNU TEST & DATABASE SCHEMA SYNCHRONIZATION
-- File: supabase/vnu_test_schema.sql
-- Mục đích: Cập nhật ràng buộc exam_type cho phép 'VNU_TEST' và 'VNU TEST',
--           đồng bộ các cột tags, format, max_score, shuffle, reload schema cache
--           giải quyết dứt điểm lỗi "Could not find the 'tags' column in schema cache".
-- ============================================================================

-- 1. Bổ sung các cột mở rộng cho bảng public.exams (nếu chưa có)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'katex',
  ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_review BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS exam_structure JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';

-- 2. Cập nhật ràng buộc check constraint exams_exam_type_check
-- Cho phép VNU_TEST, VNU TEST, UNIVERSITY, PORTAL_UET cùng các loại đề chuẩn khác
DO $$
BEGIN
  -- Xóa ràng buộc cũ nếu tồn tại
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'exams_exam_type_check' 
      AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams DROP CONSTRAINT exams_exam_type_check;
  END IF;
END $$;

-- Thêm lại ràng buộc nới rộng hỗ trợ tất cả các loại đề thi SenExam
ALTER TABLE public.exams
  ADD CONSTRAINT exams_exam_type_check
  CHECK (
    exam_type IS NULL 
    OR exam_type IN (
      'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'ĐGTD', 
      'UNIVERSITY', 'PORTAL_UET', 'VNU_TEST', 'VNU TEST',
      'Kiểm tra 1 tiết', 'Học kỳ', 'Giữa kỳ', 'Cuối kỳ'
    ) 
    OR length(exam_type) > 0
  );

-- 3. Tạo Index tối ưu hóa truy vấn theo loại đề và định dạng phòng thi
CREATE INDEX IF NOT EXISTS idx_exams_exam_type_format 
  ON public.exams(exam_type, format);

CREATE INDEX IF NOT EXISTS idx_exams_tags_gin 
  ON public.exams USING GIN (tags);

-- 4. Reload PostgREST schema cache tức thì để Supabase REST API nhận diện cột mới
NOTIFY pgrst, 'reload schema';

-- Hoàn tất! Bạn có thể dán toàn bộ đoạn SQL này vào Supabase SQL Editor và bấm Run.
