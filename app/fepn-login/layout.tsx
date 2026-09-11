import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Đăng Nhập Xác Thực VNU',
  description: 'Đăng nhập cổng học liệu sinh viên Khoa Vật lý kỹ thuật & Công nghệ Nano',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
