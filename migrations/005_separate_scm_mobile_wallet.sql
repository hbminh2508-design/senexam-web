-- ==============================================================================
-- MIGRATION 005: TÁCH BIỆT HOÀN TOÀN VÍ CASH MOBILE (SCm) & SỔ CÁI NGUYÊN TỬ
-- Mục đích: Độc lập hóa hoàn toàn hệ sinh thái tiền tệ Mobile, chống tiêu hai lần (Double Spending)
-- Trạng thái: ĐỀ XUẤT - CHƯA CHẠY TRÊN PRODUCTION - CHỜ QUẢN TRỊ VIÊN XÁC NHẬN
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BỔ SUNG CỘT IDEMPOTENCY_KEY VÀO BẢNG SỔ CÁI GIAO DỊCH MOBILE
-- ------------------------------------------------------------------------------
ALTER TABLE public.mobile_sencash_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique Index đảm bảo mỗi idempotency_key chỉ được thực thi DUY NHẤT 1 LẦN
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_tx_idempotency_key 
ON public.mobile_sencash_transactions (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. HOÀN THIỆN RPC ĐIỀU CHỈNH SỐ DƯ MOBILE (ADJUST_SCM_BALANCE) VỚI KHÓA HÀNG
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_scm_balance(
  p_user_id UUID,
  p_delta NUMERIC,
  p_reason TEXT DEFAULT 'mobile_action',
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_scm NUMERIC;
  v_new_scm NUMERIC;
  v_existing_tx RECORD;
BEGIN
  -- 2.1 Kiểm tra Idempotency Key nếu có
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO v_existing_tx 
    FROM public.mobile_sencash_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Giao dịch đã được ghi nhận trước đó (Idempotent)',
        'balance', v_existing_tx.balance_after,
        'already_processed', true
      );
    END IF;
  END IF;

  -- 2.2 Khóa dòng Profile người dùng (SELECT FOR UPDATE) để chống Race Condition
  SELECT COALESCE(scm_balance, sencash_mobile_balance, 0)
  INTO v_current_scm
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Người dùng không tồn tại';
  END IF;

  v_new_scm := v_current_scm + p_delta;

  -- 2.3 Chặn số dư âm: Không cho phép tiêu vượt quá số dư hiện có
  IF v_new_scm < 0 THEN
    RAISE EXCEPTION 'Số dư Cash Mobile (SCm) không đủ (hiện có: % SCm, cần: % SCm)', v_current_scm, ABS(p_delta);
  END IF;

  -- 2.4 Cập nhật cả 2 cột scm_balance và sencash_mobile_balance
  UPDATE public.profiles
  SET scm_balance = v_new_scm,
      sencash_mobile_balance = v_new_scm,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- 2.5 Ghi vào Sổ cái giao dịch chỉ ghi thêm (Ledger Append-Only)
  INSERT INTO public.mobile_sencash_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    reference_id,
    idempotency_key,
    created_at
  ) VALUES (
    p_user_id,
    p_delta,
    v_new_scm,
    p_reason,
    COALESCE(p_reference, p_reason),
    p_reference,
    p_idempotency_key,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'old_balance', v_current_scm,
    'new_balance', v_new_scm,
    'delta', p_delta
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. BẢO MẬT RLS CHO SỔ CÁI VÀ CẤP QUYỀN
-- ------------------------------------------------------------------------------
ALTER TABLE public.mobile_sencash_transactions ENABLE ROW LEVEL SECURITY;

-- Cấm client trực tiếp sửa/xóa sổ cái
DROP POLICY IF EXISTS "Disallow client update mobile tx" ON public.mobile_sencash_transactions;
DROP POLICY IF EXISTS "Disallow client delete mobile tx" ON public.mobile_sencash_transactions;

-- Học sinh chỉ được xem lịch sử ví di động của chính mình
DROP POLICY IF EXISTS "Users view own mobile transactions" ON public.mobile_sencash_transactions;
CREATE POLICY "Users view own mobile transactions" 
ON public.mobile_sencash_transactions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

GRANT EXECUTE ON FUNCTION public.adjust_scm_balance(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- 4. KẾ HOẠCH DI CHUYỂN DỮ LIỆU ĐỀ XUẤT (TÙY CHỌN THEO QUẢN TRỊ VIÊN)
-- ==============================================================================
-- PHƯƠNG ÁN A (Khuyên dùng): Giữ nguyên số dư PC, ví Mobile bắt đầu từ 0 SCm.
-- Không cần chạy câu lệnh UPDATE nào.

-- PHƯƠNG ÁN B (Quy đổi 1:5 cho tài khoản học sinh đã có số dư SC):
-- UPDATE public.profiles
-- SET scm_balance = sencash_balance * 5,
--     sencash_mobile_balance = sencash_balance * 5
-- WHERE sencash_balance > 0 AND role != 'admin';

-- ==============================================================================
-- 5. KẾ HOẠCH HOÀN TÁC (ROLLBACK PLAN)
-- ==============================================================================
-- Để hoàn tác toàn bộ migration này:
-- 1. DROP INDEX IF EXISTS idx_mobile_tx_idempotency_key;
-- 2. ALTER TABLE public.mobile_sencash_transactions DROP COLUMN IF EXISTS idempotency_key;
-- 3. DROP FUNCTION IF EXISTS public.adjust_scm_balance(UUID, NUMERIC, TEXT, TEXT, TEXT);
