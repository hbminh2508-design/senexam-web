-- ==============================================================================
-- 🚀 SEB EXAM SYSTEM MIGRATION (SAFE EXAM BROWSER & FOLDER STRUCTURE)
-- Chạy đoạn mã này trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. BẢNG THƯ MỤC MẸ & THƯ MỤC CON SEB
CREATE TABLE IF NOT EXISTS public.seb_folders (
  id text PRIMARY KEY DEFAULT ('fld_' || replace(gen_random_uuid()::text, '-', '')),
  name text NOT NULL,
  description text DEFAULT '',
  parent_id text REFERENCES public.seb_folders(id) ON DELETE CASCADE,
  icon text DEFAULT 'folder',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Đảm bảo bổ sung cột description nếu bảng đã tồn tại từ trước
ALTER TABLE public.seb_folders 
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_seb_folders_parent_id ON public.seb_folders(parent_id);

-- 2. BỔ SUNG CÁC CỘT QUẢN LÝ THƯ MỤC VÀ SEB VÀO BẢNG EXAMS
ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS folder_id text;

ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS require_seb boolean DEFAULT false;

ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS seb_config_key text DEFAULT '';

ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS part_instructions jsonb DEFAULT '{"part1": true, "part2": true, "part3": true}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_exams_folder_id ON public.exams(folder_id);

-- 3. THIẾT LẬP ROW LEVEL SECURITY (RLS) CHO seb_folders
ALTER TABLE public.seb_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read seb folders" ON public.seb_folders;
CREATE POLICY "Everyone can read seb folders" ON public.seb_folders
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage seb folders" ON public.seb_folders;
CREATE POLICY "Admins can manage seb folders" ON public.seb_folders
  FOR ALL TO authenticated
  USING (
    public.is_collab_or_admin()
    OR auth.jwt() ->> 'email' = 'hoangbinhminh2508@gmail.com'
  )
  WITH CHECK (
    public.is_collab_or_admin()
    OR auth.jwt() ->> 'email' = 'hoangbinhminh2508@gmail.com'
  );

-- 4. TẠO CÁC THƯ MỤC MẸ VÀ CON MẪU ĐỂ SỬ DỤNG NGAY
DO $$
DECLARE
  p1_id text := 'parent_thptqg';
  p2_id text := 'parent_dgnl';
BEGIN
  -- Thư mục mẹ 1: THPTQG
  IF NOT EXISTS (SELECT 1 FROM public.seb_folders WHERE id = p1_id) THEN
    INSERT INTO public.seb_folders (id, name, parent_id, sort_order, icon)
    VALUES (p1_id, 'Thi Thử THPT Quốc Gia', NULL, 1, 'award');

    INSERT INTO public.seb_folders (id, name, parent_id, sort_order, icon) VALUES
      ('child_thpt_vatly', 'Vật Lí Kỹ Thuật', p1_id, 1, 'atom'),
      ('child_thpt_toanhoc', 'Toán Học Chuyên Sâu', p1_id, 2, 'binary'),
      ('child_thpt_hoahoc', 'Hóa Học Đề Chuẩn', p1_id, 3, 'flask-conical');
  END IF;

  -- Thư mục mẹ 2: ĐGNL & ĐGTD
  IF NOT EXISTS (SELECT 1 FROM public.seb_folders WHERE id = p2_id) THEN
    INSERT INTO public.seb_folders (id, name, parent_id, sort_order, icon)
    VALUES (p2_id, 'Kỳ Thi Đánh Giá Năng Lực & Tư Duy', NULL, 2, 'shield-check');

    INSERT INTO public.seb_folders (id, name, parent_id, sort_order, icon) VALUES
      ('child_dgnl_hsa', 'ĐGNL ĐHQGHN (HSA)', p2_id, 1, 'graduation-cap'),
      ('child_dgtd_tsa', 'ĐGTD Đại Học Bách Khoa (TSA)', p2_id, 2, 'cpu');
  END IF;
END $$;

-- 5. ĐỒNG BỘ CỘT CHO BẢNG SUBMISSIONS DÙNG CHUNG SENEXAM & SEB
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_graded boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tab_switches integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blur_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_submissions_user_created ON public.submissions(user_id, created_at DESC);

-- 6. TỰ ĐỘNG ĐỒNG BỘ CÁC ĐỀ THI SENEXAM HIỆN CÓ VÀO CÂY THƯ MỤC SEB
UPDATE public.exams 
SET folder_id = 'child_dgnl_hsa' 
WHERE folder_id IS NULL AND (title ILIKE '%hsa%' OR exam_type ILIKE '%hsa%' OR title ILIKE '%đgnl%');

UPDATE public.exams 
SET folder_id = 'child_dgtd_tsa' 
WHERE folder_id IS NULL AND (title ILIKE '%tsa%' OR exam_type ILIKE '%tsa%' OR title ILIKE '%đgtd%');

UPDATE public.exams 
SET folder_id = 'child_thpt_vatly' 
WHERE folder_id IS NULL AND (title ILIKE '%vật lý%' OR title ILIKE '%vật lí%' OR exam_type ILIKE '%lý%' OR exam_type ILIKE '%lí%');

UPDATE public.exams 
SET folder_id = 'child_thpt_toanhoc' 
WHERE folder_id IS NULL AND (title ILIKE '%toán%' OR exam_type ILIKE '%toán%');

UPDATE public.exams 
SET folder_id = 'child_thpt_hoahoc' 
WHERE folder_id IS NULL AND (title ILIKE '%hóa%' OR exam_type ILIKE '%hóa%');

SELECT 'Khởi tạo hệ thống thư mục, đồng bộ submissions và đề thi SEB thành công!' AS status;
