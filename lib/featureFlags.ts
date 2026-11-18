/**
 * Feature Flags Configuration for SenExam
 * Allows rapid toggling of experimental or platform-specific features.
 */

export const FEATURE_FLAGS = {
  /**
   * Tách biệt hoàn toàn ví Cash Mobile (SCm) khỏi SenCash (SC) của bản PC.
   * Khi bật: Mobile độc quyền dùng SCm, mọi thao tác nạp/tiêu đều qua sổ cái SCm.
   */
  ENABLE_SEPARATE_MOBILE_WALLET: true,

  /**
   * Khóa nghiêm ngặt các yêu cầu trừ tiền SenCash PC xuất phát từ client Mobile.
   */
  ENFORCE_MOBILE_WALLET_ISOLATION: true,
}
