-- ==============================================================================
-- 🚀 FEPN SUPABASE SQL FIX: GHI ÂM, LƯU BẬT/TẮT MÔN HỌC & BẢO MẬT RLS
-- Chạy trực tiếp đoạn mã này trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. CẬP NHẬT RÀNG BUỘC CATEGORY TRÊN BẢNG fepn_materials
-- Xóa bỏ ràng buộc cũ gây lỗi: violates check constraint "fepn_materials_category_check"
ALTER TABLE public.fepn_materials 
  DROP CONSTRAINT IF EXISTS fepn_materials_category_check;

-- Thêm lại ràng buộc cho phép đầy đủ: slides, exercises, videos, exams, recordings (cả số ít và số nhiều)
ALTER TABLE public.fepn_materials 
  ADD CONSTRAINT fepn_materials_category_check 
  CHECK (category IN (
    'slides', 'exercises', 'videos', 'exams', 'recordings',
    'slide', 'exercise', 'video', 'exam', 'recording'
  ));

-- 2. ĐẢM BẢO CỘT LƯU TRẠNG THÁI BẬT/TẮT TAB GHI ÂM CHO TỪNG MÔN HỌC
ALTER TABLE public.fepn_subjects 
  ADD COLUMN IF NOT EXISTS enable_recordings boolean DEFAULT false;

-- Tạo index để truy vấn nhanh hơn
CREATE INDEX IF NOT EXISTS idx_fepn_subjects_enable_recordings 
  ON public.fepn_subjects(enable_recordings);

-- 3. CẬP NHẬT HÀM XÁC THỰC QUYỀN ADMIN / COLLAB
CREATE OR REPLACE FUNCTION public.is_collab_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    -- Kiểm tra từ JWT token
    (auth.jwt() ->> 'email' = 'hoangbinhminh2508@gmail.com')
    OR
    -- Kiểm tra từ bảng profiles
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
        AND (role IN ('admin', 'collab') OR email = 'hoangbinhminh2508@gmail.com')
    )
  );
$$;

-- 4. THẮT CHẶT BẢO MẬT ROW LEVEL SECURITY (RLS)
-- Bật RLS cho cả 2 bảng
ALTER TABLE public.fepn_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_materials ENABLE ROW LEVEL SECURITY;

-- 4.1 Bảng fepn_subjects: Mọi người được xem, CHỈ ADMIN mới được Bật/Tắt tab và chỉnh sửa môn học
DROP POLICY IF EXISTS "Everyone can read fepn subjects" ON public.fepn_subjects;
CREATE POLICY "Everyone can read fepn subjects" ON public.fepn_subjects
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage fepn subjects" ON public.fepn_subjects;
CREATE POLICY "Admins can manage fepn subjects" ON public.fepn_subjects
  FOR ALL TO authenticated
  USING (public.is_collab_or_admin())
  WITH CHECK (public.is_collab_or_admin());

-- 4.2 Bảng fepn_materials: Mọi người được xem tài liệu, CHỈ ADMIN mới được Thêm/Sửa/Xóa
DROP POLICY IF EXISTS "Everyone can read fepn materials" ON public.fepn_materials;
CREATE POLICY "Everyone can read fepn materials" ON public.fepn_materials
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage fepn materials" ON public.fepn_materials;
CREATE POLICY "Admins can manage fepn materials" ON public.fepn_materials
  FOR ALL TO authenticated
  USING (public.is_collab_or_admin())
  WITH CHECK (public.is_collab_or_admin());

-- 5. ĐỒNG BỘ DỮ LIỆU CŨ TỪ DESCRIPTION VÀO CỘT enable_recordings (NẾU CÓ)
UPDATE public.fepn_subjects
SET enable_recordings = true
WHERE description LIKE '%[ENABLE_RECORDINGS]%';

-- Thông báo hoàn thành
SELECT 'Cập nhật thành công: Đã sửa check constraint, tạo cột enable_recordings và thắt chặt RLS!' AS status;
