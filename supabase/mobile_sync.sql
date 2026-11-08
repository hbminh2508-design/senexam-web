-- ============================================================================
-- SENEXAM MOBILE SYNCHRONIZATION & SEPARATE SCm WALLET ENGINE
-- File: supabase/mobile_sync.sql
-- Mục đích: Tách hoàn toàn Ví Cash Mobile (SCm) khỏi SenCash (SC) chính gốc PC,
--           cung cấp API RPC nguyên tử và bảng đồng bộ thiết bị di động.
-- ============================================================================

-- 1. Bổ sung cột số dư ví Cash Mobile (SCm) độc quyền di động vào bảng profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sencash_mobile_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scm_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mobile_last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mobile_device_id TEXT,
  ADD COLUMN IF NOT EXISTS mobile_version TEXT;

-- Đồng bộ giá trị khởi tạo nếu một trong hai cột chưa có giá trị
UPDATE public.profiles
SET sencash_mobile_balance = COALESCE(sencash_mobile_balance, scm_balance, 0),
    scm_balance = COALESCE(scm_balance, sencash_mobile_balance, 0)
WHERE sencash_mobile_balance IS NULL OR scm_balance IS NULL;

-- 2. Bảng theo dõi lịch sử giao dịch Ví Cash Mobile (SCm)
CREATE TABLE IF NOT EXISTS public.mobile_sencash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- Số SCm biến động (+ nạp, - tiêu)
  balance_after NUMERIC NOT NULL, -- Số dư SCm sau giao dịch
  transaction_type TEXT NOT NULL, -- 'topup', 'vip_purchase', 'senai_quota', 'admin_gift', 'refund'
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tra cứu nhanh theo user_id
CREATE INDEX IF NOT EXISTS idx_mobile_sencash_user_id
  ON public.mobile_sencash_transactions(user_id, created_at DESC);

-- 3. Bảng quản lý thiết bị di động đã đăng nhập & đồng bộ
CREATE TABLE IF NOT EXISTS public.mobile_sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT DEFAULT 'mobile_web', -- 'android', 'ios', 'mobile_web'
  app_version TEXT,
  user_agent TEXT,
  push_token TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_sync_devices_user
  ON public.mobile_sync_devices(user_id);

-- 4. RPC NGUYÊN TỬ: Điều chỉnh số dư Ví Cash Mobile (SCm) an toàn chống race-condition
CREATE OR REPLACE FUNCTION public.adjust_scm_balance(
  p_user_id UUID,
  p_delta NUMERIC,
  p_reason TEXT DEFAULT 'mobile_action',
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_scm NUMERIC;
  v_new_scm NUMERIC;
BEGIN
  -- Khóa dòng profile để thực hiện phép trừ/cộng nguyên tử (SELECT FOR UPDATE)
  SELECT COALESCE(sencash_mobile_balance, scm_balance, 0)
  INTO v_current_scm
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Người dùng không tồn tại';
  END IF;

  v_new_scm := v_current_scm + p_delta;

  -- Nếu số dư sau khi trừ nhỏ hơn 0 thì từ chối giao dịch
  IF v_new_scm < 0 THEN
    RAISE EXCEPTION 'Số dư Cash Mobile (SCm) không đủ (hiện có: % SCm, cần: % SCm)', v_current_scm, ABS(p_delta);
  END IF;

  -- Cập nhật cả 2 cột để tương thích tối đa
  UPDATE public.profiles
  SET sencash_mobile_balance = v_new_scm,
      scm_balance = v_new_scm,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Ghi log lịch sử biến động số dư
  INSERT INTO public.mobile_sencash_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    reference_id
  ) VALUES (
    p_user_id,
    p_delta,
    v_new_scm,
    p_reason,
    COALESCE(p_reference, p_reason),
    p_reference
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

-- 5. RPC ĐỒNG BỘ THIẾT BỊ DI ĐỘNG (Heartbeat & sync device)
CREATE OR REPLACE FUNCTION public.sync_mobile_device(
  p_user_id UUID,
  p_device_id TEXT,
  p_platform TEXT DEFAULT 'mobile_web',
  p_app_version TEXT DEFAULT '2.0',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.mobile_sync_devices (
    user_id,
    device_id,
    platform,
    app_version,
    user_agent,
    last_synced_at
  ) VALUES (
    p_user_id,
    p_device_id,
    p_platform,
    p_app_version,
    p_user_agent,
    NOW()
  )
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    user_agent = COALESCE(EXCLUDED.user_agent, public.mobile_sync_devices.user_agent),
    last_synced_at = NOW();

  UPDATE public.profiles
  SET mobile_last_active_at = NOW(),
      mobile_device_id = p_device_id,
      mobile_version = p_app_version
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'synced_at', NOW());
END;
$$;

-- 6. Phân quyền và kích hoạt RLS an toàn
ALTER TABLE public.mobile_sencash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_devices ENABLE ROW LEVEL SECURITY;

-- Cử tri/học sinh chỉ được xem lịch sử ví và thiết bị của chính mình
CREATE POLICY "Users can read own mobile transactions"
  ON public.mobile_sencash_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read and update own mobile devices"
  ON public.mobile_sync_devices
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cấp quyền gọi hàm RPC cho authenticated users
GRANT EXECUTE ON FUNCTION public.adjust_scm_balance(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_mobile_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
