import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Trang chủ',
  description: 'Tài liệu FEPN - Khoa Vật lý kỹ thuật & Công nghệ Nano, ĐH Công nghệ (UET - VNU)',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
