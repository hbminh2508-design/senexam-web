import { redirect } from 'next/navigation'

export default function RootPage() {
  // Tự động chuyển hướng người dùng sang trang New Dashboard 2.0
  redirect('/new-dashboard')
}