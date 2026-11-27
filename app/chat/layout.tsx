import type { Metadata } from 'next'

export const metadata: Metadata = { manifest: '/sen-chat.webmanifest' }

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
