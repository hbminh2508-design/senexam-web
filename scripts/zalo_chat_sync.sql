-- ==============================================================================
-- BẢNG HÀNG ĐỢI ĐỒNG BỘ TRUNG CHUYỂN ZALO CHAT (chat.senexam.me)
-- Triết lý: Lưu trữ Local-First trên thiết bị người dùng (như Zalo).
-- Máy chủ chỉ là cầu nối trung chuyển (transit queue). Ngay khi thiết bị nhận
-- kéo dữ liệu về máy thành công, bản ghi trên bảng này sẽ ĐƯỢC XÓA NGAY LẬP TỨC
-- để máy chủ luôn sạch 100% dung lượng.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.zalo_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  receiver_id TEXT NOT NULL, -- user_id hoặc email/số điện thoại người nhận
  device_id TEXT NOT NULL,   -- ID thiết bị gửi
  payload JSONB NOT NULL,    -- nội dung tin nhắn hoặc gói sao lưu
  sync_type TEXT DEFAULT 'message', -- 'message' | 'history_bundle' | 'read_receipt'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days')
);

-- Chỉ mục tối ưu tốc độ đọc và xóa theo người nhận
CREATE INDEX IF NOT EXISTS idx_zalo_sync_queue_receiver ON public.zalo_sync_queue(receiver_id);
CREATE INDEX IF NOT EXISTS idx_zalo_sync_queue_created ON public.zalo_sync_queue(created_at);

-- Bật Row Level Security (RLS)
ALTER TABLE public.zalo_sync_queue ENABLE ROW LEVEL SECURITY;

-- Chính sách truy cập mở qua Service Role và API Route
DROP POLICY IF EXISTS "zalo_sync_queue_all" ON public.zalo_sync_queue;
CREATE POLICY "zalo_sync_queue_all" ON public.zalo_sync_queue
  FOR ALL USING (true) WITH CHECK (true);

-- Tự động dọn dẹp tin nhắn mồ côi (nếu người nhận không bao giờ mở app sau 3 ngày)
CREATE OR REPLACE FUNCTION clean_expired_zalo_sync_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM public.zalo_sync_queue WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
