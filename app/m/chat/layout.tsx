import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sen Chat Mobile | Nhắn Tin Mã Hóa E2EE',
  description: 'Trò chuyện mã hóa đầu cuối E2EE, nhóm bảo mật MLS và trợ lý học tập SenAI trên di động',
}

export default function MobileChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-mb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] flex-1 flex flex-col w-full h-[calc(100dvh-env(safe-area-inset-top,0px))] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {children}
    </div>
  )
}
