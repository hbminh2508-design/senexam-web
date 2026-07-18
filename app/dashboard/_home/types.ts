import type { LucideIcon } from 'lucide-react'
import type { useRouter } from 'next/navigation'

export type Feature = {
  key: string
  label: string
  desc: string
  icon: LucideIcon
  color: string
  onSelect: () => void
}

export type HomeProps = {
  router: ReturnType<typeof useRouter>
  userRole: string
  formData: {
    fullName: string
    province: string
    school: string
    targetExams: string[]
  }
  isDark: boolean
  toggleTheme: () => void
  unreadCount: number
  setShowNotifications: (v: boolean) => void
  setShowProfile: (v: boolean) => void
  showFeatureMenu: boolean
  setShowFeatureMenu: (v: boolean | ((v: boolean) => boolean)) => void
  FEATURES: readonly Feature[]
  activeAnnouncement: string | null
  studentHistoryList: any[]
  setShowCodeModal: (v: boolean) => void
  overlayActive: boolean
  themeColor: string
}
