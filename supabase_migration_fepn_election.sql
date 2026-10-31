-- ==============================================================================
-- BẦU CỬ FEPN - SUPABASE DATABASE MIGRATION SCRIPT
-- Hệ thống bầu cử Ban Cán Sự & BCH Lâm Thời Lớp K71-P-ME2 (Năm học 2026-2027)
-- Đồng bộ Online và Realtime tức thì (sub-second)
-- ==============================================================================

-- 1. Bảng cấu hình phiên bầu cử (Settings)
CREATE TABLE IF NOT EXISTS public.fepn_election_settings (
  id text PRIMARY KEY DEFAULT 'k71p_me2',
  unit text NOT NULL DEFAULT 'K71-P-ME2',
  academic_year text NOT NULL DEFAULT '2026-2027',
  title text NOT NULL DEFAULT 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K71-P-ME2',
  is_registration_open boolean NOT NULL DEFAULT true,
  is_voting_open boolean NOT NULL DEFAULT true,
  round integer NOT NULL DEFAULT 1,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Khởi tạo bản ghi mặc định cho lớp K71-P-ME2 (nếu chưa có)
INSERT INTO public.fepn_election_settings (id, unit, academic_year, title, is_registration_open, is_voting_open, round)
VALUES ('k71p_me2', 'K71-P-ME2', '2026-2027', 'BẦU CỬ BAN CHẤP HÀNH LÂM THỜI & BAN CÁN SỰ K71-P-ME2', true, true, 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Bảng danh sách ứng viên tranh cử (Candidates)
CREATE TABLE IF NOT EXISTS public.fepn_election_candidates (
  id text PRIMARY KEY,
  election_id text NOT NULL DEFAULT 'k71p_me2' REFERENCES public.fepn_election_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  student_id text NOT NULL, -- MSSV
  phone text,
  email text,
  position_ids text[] NOT NULL DEFAULT '{}'::text[], -- Các chức vụ ứng cử
  slogan text, -- Lời hứa tranh cử / Chương trình hành động
  bio text, -- Giới thiệu bản thân
  avatar text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Tạo chỉ mục tìm kiếm theo MSSV ứng viên
CREATE INDEX IF NOT EXISTS idx_fepn_candidates_student_id ON public.fepn_election_candidates(student_id);

-- 3. Bảng lưu trữ phiếu bầu của cử tri (Votes)
CREATE TABLE IF NOT EXISTS public.fepn_election_votes (
  id text PRIMARY KEY,
  election_id text NOT NULL DEFAULT 'k71p_me2' REFERENCES public.fepn_election_settings(id) ON DELETE CASCADE,
  voter_name text NOT NULL,
  voter_student_id text NOT NULL, -- MSSV cử tri
  selections jsonb NOT NULL DEFAULT '{}'::jsonb, -- { [positionId]: [candidateId1, candidateId2] }
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- ĐIỀU 2 KHOẢN 1: Đảm bảo ở mức cơ sở dữ liệu mỗi MSSV chỉ gửi phiếu 1 lần duy nhất trong phiên bầu cử
  CONSTRAINT unique_vote_per_student UNIQUE (election_id, voter_student_id)
);

CREATE INDEX IF NOT EXISTS idx_fepn_votes_voter_mssv ON public.fepn_election_votes(voter_student_id);

-- 4. Bật tính năng Realtime (Supabase Realtime Channel)
-- Giúp Trang Tổng Kết (Trang 3) tự động nhảy số tức thì khi có người nộp phiếu mà không cần tải lại trang
DO $$
BEGIN
  -- Thêm bảng fepn_election_votes vào publication nếu chưa có
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fepn_election_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fepn_election_votes;
  END IF;

  -- Thêm bảng fepn_election_candidates vào publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fepn_election_candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fepn_election_candidates;
  END IF;

  -- Thêm bảng fepn_election_settings vào publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'fepn_election_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fepn_election_settings;
  END IF;
END $$;

-- 5. Cấu hình phân quyền RLS (Row Level Security)
-- Cho phép cử tri trong lớp xem và bỏ phiếu trực tiếp KHÔNG CẦN ĐĂNG NHẬP
ALTER TABLE public.fepn_election_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_election_votes ENABLE ROW LEVEL SECURITY;

-- Cho phép tất cả mọi người đọc thông tin cấu hình, danh sách ứng viên và kết quả phiếu
DROP POLICY IF EXISTS "Public read fepn settings" ON public.fepn_election_settings;
CREATE POLICY "Public read fepn settings" ON public.fepn_election_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read fepn candidates" ON public.fepn_election_candidates;
CREATE POLICY "Public read fepn candidates" ON public.fepn_election_candidates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read fepn votes" ON public.fepn_election_votes;
CREATE POLICY "Public read fepn votes" ON public.fepn_election_votes FOR SELECT USING (true);

-- Cho phép cử tri ghi danh ứng cử
DROP POLICY IF EXISTS "Public insert fepn candidates" ON public.fepn_election_candidates;
CREATE POLICY "Public insert fepn candidates" ON public.fepn_election_candidates FOR INSERT WITH CHECK (true);

-- Cho phép cử tri bỏ phiếu
DROP POLICY IF EXISTS "Public insert fepn votes" ON public.fepn_election_votes;
CREATE POLICY "Public insert fepn votes" ON public.fepn_election_votes FOR INSERT WITH CHECK (true);

-- Cho phép cập nhật cấu hình và ứng viên (cho Admin)
DROP POLICY IF EXISTS "Public update fepn settings" ON public.fepn_election_settings;
CREATE POLICY "Public update fepn settings" ON public.fepn_election_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete fepn candidates" ON public.fepn_election_candidates;
CREATE POLICY "Public delete fepn candidates" ON public.fepn_election_candidates FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public delete fepn votes" ON public.fepn_election_votes;
CREATE POLICY "Public delete fepn votes" ON public.fepn_election_votes FOR DELETE USING (true);

-- 6. Làm mới Schema Cache của Supabase PostgREST
NOTIFY pgrst, 'reload schema';
