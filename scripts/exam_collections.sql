-- =========================================================================
-- BẢNG TUYỂN TẬP ĐỀ THI THEO MÔN (EXAM COLLECTIONS) TRÊN SUPABASE
-- Cho phép lưu trữ online, đồng bộ realtime và bảo mật phân quyền RLS
-- =========================================================================

-- 1. Tạo bảng lưu trữ tuyển tập đề thi
CREATE TABLE IF NOT EXISTS public.exam_collections (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    exam_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Đặt comment mô tả cho bảng và các cột
COMMENT ON TABLE public.exam_collections IS 'Bảng lưu trữ các bộ tuyển tập đề thi theo môn, gom nhóm đề số 1, 2, 3... và phục vụ tính năng trộn đề';
COMMENT ON COLUMN public.exam_collections.id IS 'Mã định danh duy nhất của tuyển tập đề (ví dụ: col-1729600000)';
COMMENT ON COLUMN public.exam_collections.subject IS 'Tên môn học của tuyển tập (ví dụ: Toán học, Vật lí, Hóa học...)';
COMMENT ON COLUMN public.exam_collections.title IS 'Tiêu đề hiển thị của tuyển tập';
COMMENT ON COLUMN public.exam_collections.exam_ids IS 'Mảng JSON chứa danh sách ID các đề thi thành phần nằm trong tuyển tập';

-- 3. Tạo chỉ mục (Index) tăng tốc truy vấn theo môn và thời gian
CREATE INDEX IF NOT EXISTS idx_exam_collections_subject ON public.exam_collections (subject);
CREATE INDEX IF NOT EXISTS idx_exam_collections_created_at ON public.exam_collections (created_at DESC);

-- 4. Bật tính năng bảo mật cấp hàng (Row Level Security - RLS)
ALTER TABLE public.exam_collections ENABLE ROW LEVEL SECURITY;

-- 5. Policy 1: Mọi người dùng (học sinh, giáo viên, khách) đều được phép XEM tuyển tập đề
DROP POLICY IF EXISTS "Cho phep tat ca moi nguoi xem tuyen tap de" ON public.exam_collections;
CREATE POLICY "Cho phep tat ca moi nguoi xem tuyen tap de"
    ON public.exam_collections
    FOR SELECT
    USING (true);

-- 6. Policy 2: Chỉ tài khoản Quản trị viên (Admin/Collab) mới có quyền THÊM, SỬA, XÓA
DROP POLICY IF EXISTS "Chi admin duoc them sua xoa tuyen tap de" ON public.exam_collections;
CREATE POLICY "Chi admin duoc them sua xoa tuyen tap de"
    ON public.exam_collections
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role IN ('admin', 'collab') OR profiles.is_admin = true)
        )
        OR (auth.jwt() ->> 'email') = 'hoangbinhminh2508@gmail.com'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role IN ('admin', 'collab') OR profiles.is_admin = true)
        )
        OR (auth.jwt() ->> 'email') = 'hoangbinhminh2508@gmail.com'
    );

-- 7. Cấp quyền truy cập cho các vai trò Supabase
GRANT SELECT ON public.exam_collections TO anon, authenticated;
GRANT ALL ON public.exam_collections TO service_role;
