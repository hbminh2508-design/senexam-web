/**
 * Sen Chat Unified Design Tokens (v1.1.0 — Communication & Stability Update)
 * Single source of truth for Ocean Blue brand theme, light/dark surface tokens,
 * semantic status colors, and safe-area / responsive layout helpers.
 */

export const SEN_CHAT_THEME = {
  brand: {
    name: 'Sen Chat',
    primaryGradient: 'bg-gradient-to-r from-blue-600 to-sky-500',
    primaryGradientHover: 'hover:from-blue-500 hover:to-sky-400',
    primaryButton:
      'bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-sm shadow-blue-600/20',
    avatarGradient: 'bg-gradient-to-br from-blue-600 to-sky-500',
    avatarRing: 'ring-2 ring-blue-500/40 dark:ring-sky-400/40',
    badgeSoft:
      'bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-sky-300 dark:border-sky-400/30',
    activeItem:
      'bg-blue-500/10 text-blue-900 dark:bg-blue-500/20 dark:text-sky-100 border border-blue-500/25',
    focusRing:
      'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:border-sky-400 dark:focus:ring-sky-400/20',
    textAccent: 'text-blue-600 dark:text-sky-400',
    speakingRing: 'ring-2 ring-sky-400 shadow-[0_0_16px_rgba(14,165,233,0.45)]',
  },
  semantic: {
    // Giữ màu đỏ cho thao tác nguy hiểm, kết thúc cuộc gọi và lỗi
    dangerButton: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/25',
    dangerSoft: 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300',
    warningSoft: 'bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300',
    // Trạng thái kết nối an toàn / đang hoạt động dùng Ocean Blue nhất quán
    connectedBadge: 'bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-sky-300',
    connectingBadge: 'bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300',
    reconnectingBadge: 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300',
  },
  surface: {
    modalBackdrop: 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 backdrop-blur-md',
    modalCard:
      'rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100',
    callSurface:
      'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white',
    safeAreaBottom: 'pb-[env(safe-area-inset-bottom,0px)]',
    safeAreaTop: 'pt-[env(safe-area-inset-top,0px)]',
  },
} as const

export type SenChatTheme = typeof SEN_CHAT_THEME
