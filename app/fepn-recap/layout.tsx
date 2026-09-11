import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Kỷ Yếu & Hoạt Động',
  description: 'Kỷ yếu điện tử, hình ảnh và hoạt động Khoa Vật lý kỹ thuật & Công nghệ Nano',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnRecapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
