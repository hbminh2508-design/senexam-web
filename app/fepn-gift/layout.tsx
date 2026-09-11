import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Đổi Quà & Vòng Quay May Mắn',
  description: 'Đổi quà hiện vật và vòng quay may mắn Khoa Vật lý kỹ thuật & Công nghệ Nano',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnGiftLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
