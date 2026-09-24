-- ==============================================================================
-- FIX CONSTRAINT: profiles_senai_tier_check & HỆ THỐNG GÓI SENAI ĐỘC QUYỀN
-- Chạy đoạn script này trực tiếp trong Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. Xoá bỏ ràng buộc cũ và cập nhật danh sách đầy đủ tất cả các hạng SenAI (gồm cả lite, plus_lite, plus, ultra, max)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_senai_tier_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_senai_tier_check
  CHECK (senai_tier IN ('free', 'lite', 'plus_lite', 'plus', 'ultra', 'max'));

-- 2. Đảm bảo các cột thời hạn và trạng thái gói cước SenAI tồn tại đầy đủ trên bảng profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_tier_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_tier_permanent boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senai_trial_used boolean NOT NULL DEFAULT false;

-- 3. Tạo bảng ghi nhận lịch sử mua gói độc quyền Flash Sale (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.exclusive_flash_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_month text NOT NULL,
  senai_plan_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kích hoạt bảo mật RLS cho bảng exclusive_flash_purchases
ALTER TABLE public.exclusive_flash_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exclusive_flash_purchases_user_all" ON public.exclusive_flash_purchases;
CREATE POLICY "exclusive_flash_purchases_user_all" ON public.exclusive_flash_purchases
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "exclusive_flash_purchases_service_role" ON public.exclusive_flash_purchases;
CREATE POLICY "exclusive_flash_purchases_service_role" ON public.exclusive_flash_purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Đảm bảo lý do biến động số dư SenCash cho phép mua gói SenAI ('senai_tier_purchase')
ALTER TABLE public.sencash_transactions DROP CONSTRAINT IF EXISTS sencash_transactions_reason_check;
ALTER TABLE public.sencash_transactions ADD CONSTRAINT sencash_transactions_reason_check
  CHECK (reason IN ('topup', 'vip_redeem', 'vip_download_spend', 'senai_tier_purchase', 'admin_gift', 'gift_code'));

-- 5. Cập nhật quyền hạn (Grant permissions)
GRANT ALL ON public.exclusive_flash_purchases TO authenticated, service_role;
