-- ==============================================================================
-- MIGRATION 003: BẢO MẬT HỆ THỐNG BẦU CỬ (FEPN ELECTIONS) & BẢO VỆ PHIẾU BẦU KÍN
-- Mục đích: Khắc phục lỗ hổng xóa phiếu, lộ danh tính cử tri và bầu nhiều lần
-- Trạng thái: ĐỀ XUẤT - CHỜ PHÊ DUYỆT CỦA QUẢN TRỊ VIÊN
-- ==============================================================================

-- 1. Bổ sung ràng buộc UNIQUE (election_id, voter_student_id)
-- Ngăn chặn 1 cử tri/MSSV nộp nhiều phiếu vào cùng một cuộc bầu cử
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_election_voter'
  ) THEN
    ALTER TABLE public.fepn_election_votes 
    ADD CONSTRAINT unique_election_voter UNIQUE (election_id, voter_student_id);
  END IF;
END $$;

-- 2. Xóa bỏ các chính sách RLS nguy hiểm cho phép Public/Anon SELECT và DELETE
DROP POLICY IF EXISTS "Public read fepn votes" ON public.fepn_election_votes;
DROP POLICY IF EXISTS "Public delete fepn votes" ON public.fepn_election_votes;
DROP POLICY IF EXISTS "Public insert fepn votes" ON public.fepn_election_votes;

-- 3. Chỉ Service Role (máy chủ Next.js) mới có quyền đọc và ghi bảng phiếu bầu chi tiết
REVOKE ALL ON public.fepn_election_votes FROM anon;
REVOKE ALL ON public.fepn_election_votes FROM authenticated;
GRANT ALL ON public.fepn_election_votes TO service_role;

-- 4. Tạo RPC tổng hợp số phiếu bảo mật (Secret Ballot Tally)
-- Chỉ trả về số lượng phiếu cho từng ứng viên, TUYỆT ĐỐI không để lộ Họ tên / MSSV cử tri
CREATE OR REPLACE FUNCTION public.get_election_tallies(p_election_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_object_agg(candidate_id, vote_count)
  INTO v_result
  FROM (
    SELECT 
      elem->>'candidateId' as candidate_id,
      count(*) as vote_count
    FROM public.fepn_election_votes v,
    jsonb_array_elements(v.selections) as elem
    WHERE v.election_id = p_election_id
    GROUP BY elem->>'candidateId'
  ) t;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_election_tallies(text) TO anon, authenticated;
