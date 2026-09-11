import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Cổng Quản Trị Khoa & Deep Vault',
  description: 'Hệ thống quản trị cơ sở dữ liệu và bảo mật Khoa Vật lý kỹ thuật & Công nghệ Nano',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
