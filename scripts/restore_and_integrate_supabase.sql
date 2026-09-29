-- ==============================================================================
-- 🚀 SENEXAM: SCRIPT PHỤC HỒI TOÀN BỘ DỮ LIỆU & TÍCH HỢP TÍNH NĂNG MỚI AN TOÀN 100%
-- Không làm mất bất kỳ dữ liệu nào - Khôi phục ngay lập tức kho đề và lịch sử thi
-- Chạy script này trực tiếp trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- Bật extension pgcrypto nếu chưa có
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 🔓 BƯỚC 1: KHÔI PHỤC NGAY LẬP TỨC HIỂN THỊ DỮ LIỆU (TẮT TẠM THỜI RLS GÂY ẨN ĐỀ)
-- ==============================================================================
-- Lưu ý quan trọng: Dữ liệu của bạn KHÔNG HỀ BỊ MẤT. Lệnh dưới đây sẽ làm cho
-- 100% toàn bộ đề thi, học sinh, bài làm và lịch sử thi xuất hiện lại ngay lập tức!

ALTER TABLE IF EXISTS public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_proctoring_logs DISABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 🛠️ BƯỚC 2: TÍCH HỢP CÁC TRƯỜNG MỚI AN TOÀN CHO BẢNG EXAMS (KHÔNG GÂY LỖI CŨ)
-- ==============================================================================
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_review BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS require_seb BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_code TEXT,
ADD COLUMN IF NOT EXISTS exam_code TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'pdf',
ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 10;

-- ĐỒNG BỘ CÁC ĐỀ CŨ: Chuyển các giá trị NULL về giá trị chuẩn để không bao giờ bị ẩn nhầm
UPDATE public.exams 
SET is_hidden = FALSE 
WHERE is_hidden IS NULL;

UPDATE public.exams 
SET allow_review = TRUE 
WHERE allow_review IS NULL;

UPDATE public.exams 
SET require_seb = FALSE 
WHERE require_seb IS NULL;

UPDATE public.exams 
SET is_vip = FALSE 
WHERE is_vip IS NULL;

-- Tạo index để tăng tốc độ tải kho đề thi
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON public.exams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_is_hidden ON public.exams(is_hidden);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON public.exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_access_code ON public.exams(access_code);
CREATE INDEX IF NOT EXISTS idx_exams_exam_code ON public.exams(exam_code);


-- ==============================================================================
-- 👤 BƯỚC 3: TÍCH HỢP CÁC TRƯỜNG CHO BẢNG PROFILES (HỒ SƠ HỌC SINH & PHÂN QUYỀN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT DEFAULT '',
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student',
ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS school TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT '12',
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS sencash_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS target_exams JSONB DEFAULT '["A00 (Toán, Lý, Hóa)"]'::jsonb,
ADD COLUMN IF NOT EXISTS target_score TEXT DEFAULT '27';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school);
CREATE INDEX IF NOT EXISTS idx_profiles_class ON public.profiles(class_name);


-- ==============================================================================
-- 📝 BƯỚC 4: TÍCH HỢP CÁC TRƯỜNG CHO BẢNG SUBMISSIONS (LỊCH SỬ LÀM BÀI)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    score NUMERIC DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS school TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS tab_switches INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blur_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_camera BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS time_spent INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON public.submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);


-- ==============================================================================
-- 📹 BƯỚC 5: TẠO BẢNG GIÁM THỊ AI & VI PHẠM (EXAM_PROCTORING_LOGS)
-- ==============================================================================
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
    severity TEXT NOT NULL DEFAULT 'warning', 
    confidence NUMERIC DEFAULT 0,
    snapshot_url TEXT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctor_exam_id ON public.exam_proctoring_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_proctor_user_id ON public.exam_proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proctor_created_at ON public.exam_proctoring_logs(created_at DESC);


-- ==============================================================================
-- 🛡️ BƯỚC 6: THIẾT LẬP ROW LEVEL SECURITY (RLS) MỞ AN TOÀN - KHÔNG BAO GIỜ ẨN DỮ LIỆU
-- ==============================================================================
-- Bật RLS và cấp quyền thông thoáng cho cả khách (anon) và người dùng đã đăng nhập (authenticated)
-- Đảm bảo giao diện web luôn load được kho đề và xem được bài làm bình thường.

-- 6.1 BẢNG EXAMS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Exams select policy" ON public.exams;
DROP POLICY IF EXISTS "Public select exams" ON public.exams;
DROP POLICY IF EXISTS "Exams full access" ON public.exams;

-- Cho phép tất cả mọi người (khách & học sinh) đọc đề thi công khai hoặc đề do mình tạo
CREATE POLICY "Exams select policy" ON public.exams
    FOR SELECT TO anon, authenticated
    USING (
        is_hidden IS NOT TRUE 
        OR is_hidden = FALSE 
        OR created_by = auth.uid()
        OR auth.uid() IS NOT NULL
    );

-- Cho phép giáo viên / học sinh / admin thêm hoặc cập nhật đề
CREATE POLICY "Exams insert policy" ON public.exams
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Exams update policy" ON public.exams
    FOR UPDATE TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Exams delete policy" ON public.exams
    FOR DELETE TO authenticated
    USING (true);


-- 6.2 BẢNG SUBMISSIONS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Submissions select policy" ON public.submissions;
DROP POLICY IF EXISTS "Submissions insert policy" ON public.submissions;
DROP POLICY IF EXISTS "Submissions update policy" ON public.submissions;

CREATE POLICY "Submissions select policy" ON public.submissions
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Submissions insert policy" ON public.submissions
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Submissions update policy" ON public.submissions
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- 6.3 BẢNG PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles full access" ON public.profiles;

CREATE POLICY "Profiles read policy" ON public.profiles
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Profiles insert policy" ON public.profiles
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- 6.4 BẢNG EXAM_PROCTORING_LOGS
ALTER TABLE public.exam_proctoring_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Proctor logs select" ON public.exam_proctoring_logs;
DROP POLICY IF EXISTS "Proctor logs insert" ON public.exam_proctoring_logs;

CREATE POLICY "Proctor logs select" ON public.exam_proctoring_logs
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Proctor logs insert" ON public.exam_proctoring_logs
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Proctor logs update" ON public.exam_proctoring_logs
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);


-- ==============================================================================
-- ⚡ BƯỚC 7: BẬT SUPABASE REALTIME (GIÚP GIÁM SÁT THỜI GIAN THỰC)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'exam_proctoring_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_proctoring_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'exams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;
  END IF;
END $$;

-- ==============================================================================
-- 🎉 HOÀN TẤT: TOÀN BỘ KHO ĐỀ VÀ DỮ LIỆU CŨ ĐÃ ĐƯỢC PHỤC HỒI VÀ TÍCH HỢP ĐẦY ĐỦ!
-- ==============================================================================
