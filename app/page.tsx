import { redirect } from 'next/navigation'

export default function RootPage() {
  // Tự động đá người dùng sang trang dashboard ngay khi vừa tải trang gốc
  redirect('/dashboard')
}