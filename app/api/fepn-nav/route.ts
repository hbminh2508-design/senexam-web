import { NextResponse } from 'next/server'

export interface FepnNavEcosystemItem {
  id: string
  label: string
  href: string
  icon: string
  badge?: string
  color?: string
  description: string
  requiresAdmin?: boolean
}

export interface FepnNavPageAction {
  id: string
  label: string
  icon: string
  actionType: 'modal' | 'scroll' | 'toggle' | 'navigation'
  target?: string
  requiresAdmin?: boolean
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || 'dashboard'
    const role = searchParams.get('role') || 'student'
    const isAdmin = role === 'admin'

    // Hệ sinh thái các tính năng của Web con FEPN
    const ecosystem: FepnNavEcosystemItem[] = [
      {
        id: 'dashboard',
        label: 'Kho Học Liệu',
        href: '/fepn-dashboard',
        icon: 'BookOpen',
        badge: 'Chính',
        color: 'sky',
        description: 'Slide, đề thi & bài tập môn học',
      },
      {
        id: 'schedule',
        label: 'Lịch Học',
        href: '/fepn-schedule',
        icon: 'Calendar',
        badge: 'TKB',
        color: 'sky',
        description: 'Thời khóa biểu & nhắc nhở 30p',
      },
      {
        id: 'gpa',
        label: 'Tính Điểm GPA',
        href: '/fepn-gpa',
        icon: 'Calculator',
        badge: 'GPA/CPA',
        color: 'emerald',
        description: 'Tính điểm tích lũy & mục tiêu kỳ',
      },
      {
        id: 'recap',
        label: 'Kỷ Yếu Recap',
        href: '/fepn-recap',
        icon: 'Award',
        badge: 'Kỷ yếu',
        color: 'indigo',
        description: 'Ảnh kỷ niệm & hoạt động Khoa FEPN',
      },
      {
        id: 'gift',
        label: 'Đổi Quà FEPN',
        href: '/fepn-gift',
        icon: 'Gift',
        badge: 'Hot',
        color: 'pink',
        description: 'Vòng quay may mắn & quà tặng hiện vật',
      },
      {
        id: 'senmail',
        label: 'Sen Mail',
        href: '/sen-mail',
        icon: 'Inbox',
        badge: 'Email',
        color: 'teal',
        description: 'Hòm thư & quản lý công việc nội bộ',
      },
      ...(isAdmin
        ? [
            {
              id: 'admin',
              label: 'Quản Trị Admin',
              href: '/fepn-admin',
              icon: 'ShieldCheck',
              badge: 'Admin',
              color: 'amber',
              description: 'Deep Security Vault (.key) & CSDL',
              requiresAdmin: true,
            },
          ]
        : []),
    ]

    // Cấu hình các nút chính trên mobile bottom bar theo từng trang
    const bottomBarConfig: Record<string, any> = {
      dashboard: {
        left: { label: 'Lịch học', href: '/fepn-schedule', icon: 'Calendar' },
        center: { label: 'Tất cả tài liệu', action: 'scroll_to_materials', icon: 'FolderOpen', targetId: 'materials-section' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      schedule: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: 'Thêm Môn', action: 'open_add_modal', icon: 'Plus', targetId: 'add-subject-modal' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      gpa: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: '+ Thêm Điểm', action: 'open_add_modal', icon: 'Plus', targetId: 'add-grade-modal' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      recap: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: isAdmin ? 'Đăng Bài' : 'Kỷ Yếu FEPN', action: isAdmin ? 'open_editor_modal' : 'scroll_top', icon: isAdmin ? 'Plus' : 'BookOpen' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      gift: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: 'Quay Thưởng', action: 'spin_or_scroll', icon: 'Gift', targetId: 'wheel-section' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      admin: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: 'Deep Vault', action: 'switch_vault_tab', icon: 'ShieldCheck', targetId: 'vault' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      subject: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: isAdmin ? 'Đăng Tài Liệu' : 'Tài Liệu', action: isAdmin ? 'open_add_material' : 'scroll_materials', icon: isAdmin ? 'Upload' : 'FolderOpen', targetId: 'materials-section' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
      senmail: {
        left: { label: 'Dashboard', href: '/fepn-dashboard', icon: 'LayoutDashboard' },
        center: { label: 'Soạn Thư', action: 'open_compose', icon: 'Send', targetId: 'compose_modal' },
        right: { label: 'Tính năng', action: 'open_drawer', icon: 'LayoutGrid' },
      },
    }

    // Các hành động riêng biệt trong Drawer theo từng trang
    const pageActions: Record<string, FepnNavPageAction[]> = {
      schedule: [
        { id: 'semester_setting', label: 'Lịch Theo Kỳ', icon: 'CalendarRange', actionType: 'modal', target: 'semester_modal' },
        { id: 'shift_setting', label: 'Chỉnh Ca Học', icon: 'Clock', actionType: 'modal', target: 'shift_modal' },
        { id: 'email_reminder', label: 'Nhắc Email 30p', icon: 'BellRing', actionType: 'modal', target: 'email_modal' },
      ],
      gpa: [
        { id: 'new_semester', label: '+ Học Kỳ Mới', icon: 'Plus', actionType: 'modal', target: 'semester_modal' },
        ...(isAdmin ? [{ id: 'manage_semesters', label: 'Mở Kỳ (Admin)', icon: 'ShieldCheck', actionType: 'modal', target: 'admin_modal', requiresAdmin: true }] : []),
      ],
      gift: [
        { id: 'share_qr', label: 'Chia Sẻ Mã QR & Link', icon: 'Share2', actionType: 'modal', target: 'share_modal' },
        { id: 'toggle_sound', label: 'Âm Thanh Hiệu Ứng', icon: 'Volume2', actionType: 'toggle', target: 'sound' },
        { id: 'redeem_code', label: 'Nhập Mã Lượt Quay', icon: 'Ticket', actionType: 'scroll', target: 'code-section' },
        ...(isAdmin ? [{ id: 'manage_gift_admin', label: 'Quản Trị Sự Kiện (Admin)', icon: 'ShieldCheck', actionType: 'navigation', target: '/fepn-admin', requiresAdmin: true }] : []),
      ],
      recap: [
        ...(isAdmin ? [{ id: 'create_recap_post', label: 'Đăng Bài Viết Kỷ Yếu', icon: 'Plus', actionType: 'modal', target: 'editor_modal', requiresAdmin: true }] : []),
      ],
      admin: [
        { id: 'admin_overview', label: 'Tổng Quan Hệ Thống', icon: 'Database', actionType: 'modal', target: 'overview' },
        { id: 'admin_subjects', label: 'Quản Lý Môn Học', icon: 'BookOpen', actionType: 'modal', target: 'subjects' },
        { id: 'admin_materials', label: 'Quản Lý Tài Liệu', icon: 'FolderOpen', actionType: 'modal', target: 'materials' },
        { id: 'admin_recap', label: 'Quản Lý Kỷ Yếu', icon: 'Award', actionType: 'modal', target: 'recap' },
        { id: 'admin_gifts', label: 'Quản Lý Đổi Quà', icon: 'Gift', actionType: 'modal', target: 'gifts' },
        { id: 'admin_vault', label: 'Deep Vault (.key)', icon: 'ShieldCheck', actionType: 'modal', target: 'vault' },
      ],
      subject: [
        ...(isAdmin ? [{ id: 'upload_material', label: 'Đăng Học Liệu Cho Môn', icon: 'Upload', actionType: 'modal', target: 'add_material_modal', requiresAdmin: true }] : []),
      ],
    }

    return NextResponse.json({
      success: true,
      data: {
        subsite: {
          id: 'fepn',
          name: 'Tài liệu FEPN',
          shortName: 'FEPN',
          faculty: 'Khoa Vật lý kỹ thuật & Công nghệ Nano',
          university: 'Trường ĐH Công nghệ - ĐHQGHN (UET - VNU)',
          logo: '/fepn-logo.png',
          favicon: '/fepn-logo.png',
        },
        activePage: page,
        role,
        bottomBar: bottomBarConfig[page] || bottomBarConfig.dashboard,
        ecosystem,
        currentPageActions: pageActions[page] || [],
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi xử lý API navigation FEPN' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Lưu các tuỳ biến quick links hoặc cấu hình navbar mobile từ phía client
    return NextResponse.json({
      success: true,
      message: 'Cấu hình navigation mobile FEPN đã được tiếp nhận',
      data: body,
      updated_at: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi xử lý yêu cầu' },
      { status: 400 }
    )
  }
}
