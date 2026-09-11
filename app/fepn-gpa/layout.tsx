import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Tính Điểm GPA & CPA',
  description: 'Công cụ tính điểm học tập GPA và CPA tích lũy cho sinh viên FEPN UET',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function FepnGpaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
