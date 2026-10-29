-- ==============================================================================
-- SENEXAM / PORTAL UET - SUPABASE DATABASE MIGRATION SCRIPT
-- Đồng bộ cột 'tags', các trường định dạng bài thi Đại học và làm mới Schema Cache
-- ==============================================================================

-- 1. Bổ sung các cột cần thiết cho bảng 'exams' (nếu chưa có)
ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS format text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS max_score numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_options boolean DEFAULT false;

-- 2. Gỡ bỏ ràng buộc check cũ trên exam_type (nếu có) để cho phép các loại đề mới:
--    'UNIVERSITY', 'PORTAL_UET', 'HSA', 'TSA', 'SPT', 'THPTQG',...
DO $$
BEGIN
  -- Tìm và xóa constraint check trên exam_type nếu đang giới hạn chỉ THPTQG/HSA
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'exams' 
      AND constraint_type = 'CHECK' 
      AND constraint_name = 'exams_exam_type_check'
  ) THEN
    ALTER TABLE public.exams DROP CONSTRAINT exams_exam_type_check;
  END IF;
END $$;

-- 3. Đảm bảo bảng 'submissions' có đủ các cột lưu kết quả và chế độ thi online
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'exam',
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS earned_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent integer DEFAULT 0;

-- 4. Đồng bộ dữ liệu các đề thi Đại học hiện có trong hệ thống
--    Tự động gắn tag 'Đại học' & 'Portal UET' cho các đề thuộc khối đại học
UPDATE public.exams
SET 
  tags = array_cat(COALESCE(tags, '{}'::text[]), ARRAY['Đại học', 'Portal UET']::text[]),
  format = 'university',
  exam_type = 'UNIVERSITY'
WHERE 
  title ILIKE '%đại học%' OR 
  title ILIKE '%dai hoc%' OR 
  title ILIKE '%uet%' OR 
  title ILIKE '%portal%' OR
  title ILIKE '%giải tích%' OR 
  title ILIKE '%giai tich%' OR 
  title ILIKE '%toán cao cấp%' OR 
  title ILIKE '%toan cao cap%' OR 
  title ILIKE '%đại số tuyến tính%' OR 
  title ILIKE '%dai so tuyen tinh%' OR 
  title ILIKE '%xác suất thống kê%' OR 
  title ILIKE '%xac suat thong ke%' OR 
  title ILIKE '%kỹ thuật lập trình%' OR 
  title ILIKE '%ky thuat lap trinh%' OR 
  title ILIKE '%vật lý đại cương%' OR 
  title ILIKE '%vat ly dai cuong%' OR 
  title ILIKE '%tin đại cương%' OR 
  title ILIKE '%tin dai cuong%' OR
  exam_type ILIKE '%university%' OR
  exam_type ILIKE '%uet%' OR
  format = 'university';

-- Loại bỏ tag trùng lặp (nếu có)
UPDATE public.exams
SET tags = ARRAY(SELECT DISTINCT unnest(tags))
WHERE tags IS NOT NULL;

-- 5. Làm mới bộ nhớ đệm (Schema Cache) của Supabase PostgREST
--    Lệnh này khắc phục triệt để lỗi "Could not find the 'tags' column in the schema cache"
NOTIFY pgrst, 'reload schema';
