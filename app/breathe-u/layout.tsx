import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BREATHE U – Một thế hệ, Một môi trường, Không khói thuốc | ĐHQGHN',
  description: 'Nền tảng số tương tác học đường phòng chống tác hại thuốc lá của sinh viên Đại học Quốc gia Hà Nội (ĐHQGHN) - Đội K70P-ME2 Trường Đại học Công nghệ.',
}

export default function BreatheULayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC]">
      {children}
    </div>
  )
}
