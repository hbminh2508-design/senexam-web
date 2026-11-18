-- ==============================================================================
-- MIGRATION 004: TỔNG RÀ SOÁT VÀ THIẾT LẬP RLS CHO 80 BẢNG SUPABASE
-- Mục đích: Khóa chặt các bảng nhạy cảm (admin log, sencash, access codes, user sessions)
-- Trạng thái: ĐỀ XUẤT - CHỜ PHÊ DUYỆT CỦA QUẢN TRỊ VIÊN
-- ==============================================================================

-- 1. Bật RLS bắt buộc trên các bảng nhạy cảm cốt lõi
ALTER TABLE public.admin_grants_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seb_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sencash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sencash_topup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fepn_login_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senheart_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fund_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_system_plans ENABLE ROW LEVEL SECURITY;

-- 2. Khóa triệt để quyền truy cập của Anon trên các bảng quản trị nội bộ
REVOKE ALL ON public.admin_grants_log FROM anon;
REVOKE ALL ON public.seb_access_codes FROM anon;
REVOKE ALL ON public.sencash_transactions FROM anon;
REVOKE ALL ON public.sencash_topup_orders FROM anon;
REVOKE ALL ON public.hidden_system_plans FROM anon;
REVOKE ALL ON public.senheart_security_logs FROM anon;

-- 3. Chỉ cho phép người dùng xem giao dịch SenCash của chính mình
DROP POLICY IF EXISTS "Users view own transactions" ON public.sencash_transactions;
CREATE POLICY "Users view own transactions" 
ON public.sencash_transactions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id::uuid);

-- 4. Đảm bảo toàn bộ hàm SECURITY DEFINER được gán search_path cố định
-- Chống tấn công chiếm quyền qua đường dẫn tìm kiếm hàm (Trojan Function / Search Path Hijacking)
ALTER FUNCTION public.get_election_tallies(text) SET search_path = public, pg_temp;
