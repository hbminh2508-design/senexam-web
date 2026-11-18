-- ==============================================================================
-- MIGRATION 001: CHỐNG RÒ RỈ ĐÁP ÁN VÀ THÔNG TIN BẢO MẬT ĐỀ THI
-- Mục đích: Thu hồi quyền SELECT các cột nhạy cảm từ anon/authenticated trên bảng exams và questions
-- Trạng thái: ĐỀ XUẤT - CHỜ PHÊ DUYỆT CỦA QUẢN TRỊ VIÊN
-- ==============================================================================

-- 1. Thu hồi quyền đọc trực tiếp các cột nhạy cảm trên bảng exams đối với anon và authenticated
-- Các cột bị thu hồi: solution_pdf_url, seb_config_key, access_code
REVOKE SELECT (solution_pdf_url, seb_config_key, access_code) ON public.exams FROM anon;
REVOKE SELECT (solution_pdf_url, seb_config_key, access_code) ON public.exams FROM authenticated;

-- 2. Thu hồi quyền đọc cột correct_answer trên bảng questions đối với anon và authenticated
REVOKE SELECT (correct_answer) ON public.questions FROM anon;
REVOKE SELECT (correct_answer) ON public.questions FROM authenticated;

-- 3. Đảm bảo Service Role vẫn có toàn quyền đọc để phục vụ chấm thi Authoritative tại máy chủ
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.questions TO service_role;

-- 4. Tạo view công khai an toàn cho học sinh/thí sinh (Safe Exam View)
CREATE OR REPLACE VIEW public.safe_exams AS
SELECT 
  id,
  title,
  exam_type,
  subject_combo,
  subjects,
  duration,
  allow_review,
  max_attempts,
  grading_method,
  is_hidden,
  require_proctoring,
  creation_mode,
  folder_id,
  require_seb,
  part_instructions,
  max_score,
  is_vip,
  format,
  total_questions,
  pdf_url,
  shuffle_questions,
  shuffle_options,
  tags,
  created_at
FROM public.exams
WHERE is_hidden IS NOT TRUE;

GRANT SELECT ON public.safe_exams TO anon, authenticated;
