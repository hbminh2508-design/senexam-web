import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tài liệu FEPN - Chi Tiết Môn Học',
  description: 'Kho slide bài giảng, video thí nghiệm, bài tập và đề thi môn học Khoa FEPN UET',
  icons: {
    icon: '/fepn-logo.png',
    shortcut: '/fepn-logo.png',
    apple: '/fepn-logo.png',
  },
}

export default function TsvFepnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
