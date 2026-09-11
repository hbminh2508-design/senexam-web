import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Lịch Học & Thời Khóa Biểu',
  description: 'Thời khóa biểu và lịch học sinh viên Khoa Vật lý kỹ thuật & Công nghệ Nano',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnScheduleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
