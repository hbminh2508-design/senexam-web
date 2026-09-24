'use client'

import React from 'react'

interface FeatureIllustrationProps {
  featureKey: string
  className?: string
}

export default function FeatureIllustration({ featureKey, className = 'w-11 h-11' }: FeatureIllustrationProps) {
  switch (featureKey) {
    // 1. Kho đề thi mới: Tờ bài thi, bút chì, huy hiệu điểm A+, sao vàng
    case 'exams':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-exams-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="50%" stopColor="#FF8E53" />
              <stop offset="100%" stopColor="#FFA07A" />
            </linearGradient>
            <linearGradient id="grad-paper" x1="10" y1="6" x2="34" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FFF5EB" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-exams-bg)" />
          {/* Tờ giấy đề thi */}
          <rect x="11" y="9" width="22" height="30" rx="3" fill="url(#grad-paper)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          <path d="M27 9L33 15H28C27.4477 15 27 14.5523 27 14V9Z" fill="#FFE2D1" />
          {/* Dòng chữ / câu hỏi */}
          <rect x="15" y="16" width="9" height="2" rx="1" fill="#FF8E53" />
          <rect x="15" y="21" width="14" height="2" rx="1" fill="#E2E8F0" />
          <rect x="15" y="26" width="12" height="2" rx="1" fill="#E2E8F0" />
          <rect x="15" y="31" width="10" height="2" rx="1" fill="#E2E8F0" />
          {/* Bút chì 3D */}
          <g transform="translate(25, 23) rotate(-35)">
            <rect x="0" y="0" width="5" height="15" rx="1.5" fill="#FFE066" stroke="#D97706" strokeWidth="0.8" />
            <path d="M0 15L2.5 19L5 15H0Z" fill="#F59E0B" />
            <path d="M1.5 17.5L2.5 19L3.5 17.5H1.5Z" fill="#1E293B" />
            <rect x="0" y="-3" width="5" height="3" rx="1" fill="#F43F5E" />
          </g>
          {/* Huy hiệu A+ phát sáng */}
          <circle cx="36" cy="14" r="6" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="36" y="17" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900" fontFamily="sans-serif">A+</text>
        </svg>
      )

    // 2. Lịch sử bài thi: Đồng hồ cát thời gian, sổ lưu kết quả, dấu tick xanh
    case 'history':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-hist-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="grad-dial" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#EEF2FF" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-hist-bg)" />
          {/* Đồng hồ lịch sử */}
          <circle cx="24" cy="24" r="14" fill="url(#grad-dial)" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.18))" />
          <circle cx="24" cy="24" r="12" stroke="#C7D2FE" strokeWidth="1.2" strokeDasharray="2 2" />
          {/* Kim đồng hồ */}
          <circle cx="24" cy="24" r="2.5" fill="#4338CA" />
          <path d="M24 24L24 16" stroke="#4338CA" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 24L29 27" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
          {/* Tia quay thời gian */}
          <path d="M35 17A14 14 0 0 0 13 17" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Huy hiệu tick xanh */}
          <circle cx="34" cy="34" r="6" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M31.5 34L33.5 36L36.5 32" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    // 3. Quản lý bài thi: Folder cặp tài liệu lưu trữ thông minh, kẹp hồ sơ
    case 'submissions':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-sub-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
            <linearGradient id="grad-folder" x1="8" y1="16" x2="40" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-sub-bg)" />
          {/* Tab folder phía sau */}
          <path d="M12 16C12 14.8954 12.8954 14 14 14H21L24 17H34C35.1046 17 36 17.8954 36 19V32C36 33.1046 35.1046 34 34 34H14C12.8954 34 12 33.1046 12 32V16Z" fill="#D97706" />
          {/* Tờ giấy lòi ra */}
          <rect x="15" y="11" width="18" height="18" rx="2" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))" />
          <rect x="18" y="15" width="8" height="1.8" rx="0.9" fill="#F59E0B" />
          <rect x="18" y="19" width="12" height="1.8" rx="0.9" fill="#CBD5E1" />
          {/* Thân folder trước */}
          <path d="M10 20C10 18.8954 10.8954 18 12 18H36C37.1046 18 38 18.8954 38 20L37 35C37 36.1046 36.1046 37 35 37H11C9.89543 37 9 36.1046 9 35L10 20Z" fill="url(#grad-folder)" stroke="#F59E0B" strokeWidth="1" />
          {/* Kẹp tài liệu & badge */}
          <rect x="20" y="24" width="8" height="3" rx="1.5" fill="#B45309" />
          <circle cx="33" cy="28" r="4.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.2" />
          <text x="33" y="30.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="900">!</text>
        </svg>
      )

    // 4. Sen Exam Canvas: Khiên bảo mật không gian số, khóa vàng, vi mạch an ninh
    case 'seb':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-seb-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="50%" stopColor="#0369A1" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            <linearGradient id="grad-shield" x1="14" y1="10" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-seb-bg)" />
          {/* Tia vi mạch */}
          <path d="M10 24H16M32 24H38M24 10V16M24 34V40" stroke="#38BDF8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          {/* Khiên bảo mật Canvas */}
          <path d="M24 10L35 15V24C35 30.5 29.5 35.5 24 38C18.5 35.5 13 30.5 13 24V15L24 10Z" fill="url(#grad-shield)" stroke="#BAE6FD" strokeWidth="1.5" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.25))" />
          {/* Lớp gương khiên */}
          <path d="M24 12V36C28.5 33.8 33 29.5 33 24V16.5L24 12Z" fill="#FFFFFF" opacity="0.25" />
          {/* Ổ khóa vàng ở trung tâm */}
          <rect x="20" y="22" width="8" height="7" rx="1.5" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
          <path d="M21.5 22V19.5C21.5 18.1193 22.6193 17 24 17C25.3807 17 26.5 18.1193 26.5 19.5V22" stroke="#FCD34D" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="24" cy="25.5" r="1" fill="#78350F" />
        </svg>
      )

    // 5. SenGraph: Không gian toạ độ 3D, mặt phẳng cong giải tích, khối lập phương ảo
    case 'sengraph':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-graph-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="grad-wave" x1="12" y1="18" x2="36" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-graph-bg)" />
          {/* Lưới trục toạ độ không gian 3D */}
          <path d="M12 24H36M24 12V36M15 33L33 15" stroke="#E0F2FE" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          {/* Khối lập phương 3D xoay */}
          <path d="M24 15L31 19V27L24 31L17 27V19L24 15Z" fill="#1E293B" opacity="0.35" stroke="#FFFFFF" strokeWidth="1.2" />
          <path d="M24 15V31M24 23L31 19M24 23L17 19" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
          {/* Đường cong đồ thị sin(x) phát sáng */}
          <path d="M13 28C17 28 19 16 24 16C29 16 31 28 35 28" stroke="url(#grad-wave)" strokeWidth="2.5" strokeLinecap="round" filter="drop-shadow(0 2px 4px rgba(244,63,94,0.4))" />
          {/* Điểm cực trị phát sáng */}
          <circle cx="24" cy="16" r="2.5" fill="#FFFFFF" stroke="#F43F5E" strokeWidth="1.5" />
          <circle cx="33" cy="27" r="2" fill="#FDE047" />
        </svg>
      )

    // 6. Thư viện thông minh: Chồng sách tri thức 3D, dải ruy băng đánh dấu
    case 'library':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-lib-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#065F46" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-lib-bg)" />
          {/* Cuốn sách dưới cùng (Xanh navy) */}
          <rect x="11" y="28" width="26" height="7" rx="2" fill="#1E293B" stroke="#64748B" strokeWidth="0.8" />
          <path d="M33 28V35M35 28V35" stroke="#F8FAFC" strokeWidth="1" />
          {/* Cuốn sách ở giữa (Cam vàng) */}
          <rect x="13" y="21" width="24" height="6.5" rx="2" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <rect x="15" y="23" width="12" height="2" rx="0.5" fill="#FEF3C7" />
          {/* Cuốn sách trên cùng đang mở (Xanh ngọc) */}
          <path d="M15 16C18 14 22 14 24 16C26 14 30 14 33 16V12C30 10 26 10 24 12C22 10 18 10 15 12V16Z" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          <path d="M24 12V17" stroke="#059669" strokeWidth="1" />
          {/* Ruy băng dấu trang đỏ */}
          <path d="M28 14V22L29.5 20.5L31 22V14H28Z" fill="#EF4444" />
        </svg>
      )

    // 7. Sen Video: Khung máy chiếu bài giảng, nút play hồng phát sáng, tia sóng
    case 'senvideo':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-video-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="50%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#BE185D" />
            </linearGradient>
            <linearGradient id="grad-screen" x1="10" y1="12" x2="38" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FCE7F3" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-video-bg)" />
          {/* Màn hình video bo góc */}
          <rect x="10" y="13" width="28" height="22" rx="5" fill="url(#grad-screen)" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.2))" />
          <path d="M10 18H38" stroke="#FBCFE8" strokeWidth="1" />
          <circle cx="14" cy="15.5" r="1" fill="#F43F5E" />
          <circle cx="17" cy="15.5" r="1" fill="#FBBF24" />
          <circle cx="20" cy="15.5" r="1" fill="#34D399" />
          {/* Nút Play 3D chính giữa */}
          <circle cx="24" cy="25" r="6" fill="#DB2777" />
          <path d="M22.5 22L27 25L22.5 28V22Z" fill="#FFFFFF" />
          {/* Ngôi sao lấp lánh góc video */}
          <path d="M35 11L36 13L38 14L36 15L35 17L34 15L32 14L34 13L35 11Z" fill="#FDE047" />
        </svg>
      )

    // 8. Sen Media 2.0: Hai bong bóng trò chuyện giao thoa, trái tim kết nối
    case 'media':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-media-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-media-bg)" />
          {/* Bong bóng chat chính (Trắng) */}
          <path d="M12 15C12 12.7909 13.7909 11 16 11H29C31.2091 11 33 12.7909 33 15V23C33 25.2091 31.2091 27 29 27H19L14 31V27H16C13.7909 27 12 25.2091 12 23V15Z" fill="#FFFFFF" filter="drop-shadow(0 2px 5px rgba(0,0,0,0.15))" />
          {/* 3 chấm gõ tin nhắn */}
          <circle cx="18" cy="19" r="1.8" fill="#6366F1" />
          <circle cx="22.5" cy="19" r="1.8" fill="#818CF8" />
          <circle cx="27" cy="19" r="1.8" fill="#A5B4FC" />
          {/* Bong bóng chat phụ màu Cyan */}
          <path d="M24 23C24 21.3431 25.3431 20 27 20H34C35.6569 20 37 21.3431 37 23V29C37 30.6569 35.6569 32 34 32H32V35L29 32H27C25.3431 32 24 30.6569 24 29V23Z" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1" />
          {/* Trái tim nhỏ */}
          <path d="M30.5 25C29.5 24 28 25 28 26C28 27.5 30.5 29 30.5 29C30.5 29 33 27.5 33 26C33 25 31.5 24 30.5 25Z" fill="#EF4444" />
        </svg>
      )

    // 9. Lịch Học & Lịch Thi: Bàn lịch để bàn, ghim đánh dấu ngày thi, vòng xoắn
    case 'schedule':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-sched-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-sched-bg)" />
          {/* Khung tờ lịch */}
          <rect x="11" y="13" width="26" height="24" rx="4" fill="#FFFFFF" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.18))" />
          {/* Đầu tờ lịch đỏ cam */}
          <path d="M11 17C11 14.7909 12.7909 13 15 13H33C35.2091 13 37 14.7909 37 17V20H11V17Z" fill="#EF4444" />
          {/* Vòng móc lò xo */}
          <rect x="16" y="10" width="2" height="5" rx="1" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.8" />
          <rect x="23" y="10" width="2" height="5" rx="1" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.8" />
          <rect x="30" y="10" width="2" height="5" rx="1" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.8" />
          {/* Các ô ngày trong tháng */}
          <circle cx="16" cy="24" r="1.5" fill="#E2E8F0" />
          <circle cx="21" cy="24" r="1.5" fill="#E2E8F0" />
          <circle cx="26" cy="24" r="1.5" fill="#E2E8F0" />
          <circle cx="31" cy="24" r="1.5" fill="#E2E8F0" />
          <circle cx="16" cy="29" r="1.5" fill="#E2E8F0" />
          <circle cx="21" cy="29" r="1.5" fill="#E2E8F0" />
          {/* Ngày thi đặc biệt được khoanh sao */}
          <circle cx="26" cy="29" r="3" fill="#F59E0B" />
          <text x="26" y="31.2" textAnchor="middle" fill="#FFFFFF" fontSize="5" fontWeight="900">★</text>
        </svg>
      )

    // 10. Chế độ Focus: Đồng hồ đo nhịp Pomodoro, ngọn lửa đam mê, vành cung tập trung
    case 'focus':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-focus-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-focus-bg)" />
          {/* Mặt đồng hồ tốc độ / đếm giờ */}
          <circle cx="24" cy="24" r="13" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.2" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.25))" />
          {/* Vành sáng năng lượng */}
          <path d="M15 29A11 11 0 1 1 33 29" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 2" />
          {/* Ngọn lửa tĩnh tâm tập trung */}
          <path d="M24 16C24 16 27 19.5 27 22.5C27 24.1569 25.6569 25.5 24 25.5C22.3431 25.5 21 24.1569 21 22.5C21 20.5 23 18.5 24 16Z" fill="#F43F5E" />
          <path d="M24 19C24 19 25.5 21 25.5 22.5C25.5 23.3284 24.8284 24 24 24C23.1716 24 22.5 23.3284 22.5 22.5C22.5 21.5 23.5 20.5 24 19Z" fill="#FDE047" />
          {/* Kim chỉ năng suất 100% */}
          <line x1="24" y1="28" x2="31" y2="20" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="28" r="2" fill="#FFFFFF" />
        </svg>
      )

    // 11. Kênh Thử Nghiệm Beta: Tàu vũ trụ Rocket phóng vào vũ trụ, vệt lửa tốc độ
    case 'beta':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-beta-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="grad-rocket" x1="18" y1="12" x2="34" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E0E7FF" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-beta-bg)" />
          {/* Thân tên lửa */}
          <g transform="translate(1, -1)">
            {/* Cánh tên lửa đỏ */}
            <path d="M19 27L14 31V26L19 23V27Z" fill="#F43F5E" />
            <path d="M29 17L33 22H28L25 17H29Z" fill="#F43F5E" />
            {/* Thân phi thuyền */}
            <path d="M34 13C29 14 22 19 19 25L24 30C30 27 35 20 36 15L34 13Z" fill="url(#grad-rocket)" stroke="#CBD5E1" strokeWidth="1" filter="drop-shadow(0 3px 5px rgba(0,0,0,0.2))" />
            {/* Kính phi hành gia */}
            <circle cx="28" cy="20" r="3" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.8" />
            <circle cx="27" cy="19" r="0.8" fill="#FFFFFF" />
            {/* Vệt lửa phóng */}
            <path d="M19 29L13 36C15 34 16 31 16 31L19 29Z" fill="#F59E0B" />
            <path d="M17 31L11 38C13 35 14 33 14 33L17 31Z" fill="#EF4444" />
          </g>
          {/* Sao lấp lánh */}
          <path d="M12 14L13 16L15 17L13 18L12 20L11 18L9 17L11 16L12 14Z" fill="#FDE047" />
          <circle cx="36" cy="34" r="1.5" fill="#FFFFFF" />
        </svg>
      )

    // 12. Tính điểm thi: Biểu đồ cột phân tích, mũi tên tăng trưởng, huy chương điểm số
    case 'tinhdiem':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-calc-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-calc-bg)" />
          {/* Nền bảng tính điểm */}
          <rect x="11" y="11" width="26" height="26" rx="4" fill="#FFFFFF" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.18))" />
          {/* Cột 1 */}
          <rect x="15" y="27" width="4.5" height="7" rx="1.5" fill="#A7F3D0" />
          {/* Cột 2 */}
          <rect x="21.5" y="21" width="4.5" height="13" rx="1.5" fill="#34D399" />
          {/* Cột 3 */}
          <rect x="28" y="15" width="4.5" height="19" rx="1.5" fill="#059669" />
          {/* Mũi tên tăng trưởng đi lên */}
          <path d="M14 26L21 19L27 22L33 13" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M29 13H33V17" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    // 13. Lớp Học Của Tôi: Mũ cử nhân tốt nghiệp, bằng tốt nghiệp cuộn nơ đỏ
    case 'student':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-grad-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E40AF" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-grad-bg)" />
          {/* Mũ cử nhân */}
          <path d="M24 13L37 19L24 25L11 19L24 13Z" fill="#1E293B" filter="drop-shadow(0 3px 5px rgba(0,0,0,0.3))" />
          <path d="M24 15L34 19.5L24 23.5L14 19.5L24 15Z" fill="#334155" />
          {/* Thân mũ bên dưới */}
          <path d="M16 22V27C16 30 19.5 32 24 32C28.5 32 32 30 32 27V22L24 25.5L16 22Z" fill="#0F172A" />
          {/* Dây tua rua vàng */}
          <path d="M24 19V29L22 33" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="24" cy="19" r="1.8" fill="#FCD34D" />
          {/* Bằng tốt nghiệp cuộn tròn */}
          <rect x="26" y="32" width="12" height="4" rx="2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
          <rect x="31" y="31.5" width="2" height="5" fill="#EF4444" />
        </svg>
      )

    // 14. Phòng thí nghiệm ảo: Bình tam giác hóa học Erlenmeyer có bọt khí tím
    case 'phongthinghiem':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-lab-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#5B21B6" />
            </linearGradient>
            <linearGradient id="grad-potion" x1="14" y1="24" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-lab-bg)" />
          {/* Bình thí nghiệm thủy tinh */}
          <path d="M21 11H27V18L35 32C36.5 34.5 34.7 37 32 37H16C13.3 37 11.5 34.5 13 32L21 18V11Z" fill="#FFFFFF" opacity="0.2" stroke="#E2E8F0" strokeWidth="1.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.2))" />
          <rect x="20" y="10" width="8" height="2" rx="1" fill="#FFFFFF" />
          {/* Dung dịch lỏng ma thuật */}
          <path d="M17 28L15 32C14 33.7 15.2 35.5 17 35.5H31C32.8 35.5 34 33.7 33 32L31 28C28 29.5 20 26.5 17 28Z" fill="url(#grad-potion)" />
          {/* Bọt khí sủi tăm */}
          <circle cx="21" cy="30" r="1.5" fill="#FFFFFF" opacity="0.8" />
          <circle cx="26" cy="32" r="1.2" fill="#FFFFFF" opacity="0.8" />
          <circle cx="24" cy="23" r="2" fill="#F472B6" />
          <circle cx="25.5" cy="17" r="1.5" fill="#F472B6" />
          <circle cx="23" cy="14" r="1" fill="#FDE047" />
        </svg>
      )

    // 15. Cửa Hàng Độc Quyền: Viên kim cương lấp lánh phản quang, vương miện sale
    case 'exclusive_store':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-excl-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#D946EF" />
              <stop offset="100%" stopColor="#9333EA" />
            </linearGradient>
            <linearGradient id="grad-gem" x1="12" y1="14" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#F5D0FE" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-excl-bg)" />
          {/* Viên kim cương 3D đa diện */}
          <path d="M16 16L24 11L32 16L37 23L24 37L11 23L16 16Z" fill="url(#grad-gem)" stroke="#FFFFFF" strokeWidth="1.2" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.25))" />
          {/* Các mặt cắt phản chiếu ánh sáng */}
          <path d="M16 16H32M24 11V37M11 23H37" stroke="#A855F7" strokeWidth="0.8" opacity="0.6" />
          <path d="M16 16L24 23L32 16" fill="#FDF4FF" opacity="0.7" />
          <path d="M11 23L24 23L24 37L11 23Z" fill="#C084FC" opacity="0.4" />
          {/* Ngôi sao chớp sáng */}
          <path d="M37 11L38 13.5L40.5 14.5L38 15.5L37 18L36 15.5L33.5 14.5L36 13.5L37 11Z" fill="#FDE047" />
          <circle cx="12" cy="13" r="1.5" fill="#FFFFFF" />
        </svg>
      )

    // 16. Quản Lý Quota SenAI: Pin năng lượng lượng tử, vạch hiển thị câu hỏi ngày
    case 'senai_quota':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-quota-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-quota-bg)" />
          {/* Khung pin năng lượng thẳng đứng */}
          <rect x="15" y="14" width="18" height="24" rx="4" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.25))" />
          <rect x="21" y="11" width="6" height="3" rx="1" fill="#FFFFFF" />
          {/* Các vạch dung lượng pin (Xanh ngọc / vàng / hồng) */}
          <rect x="18" y="31" width="12" height="4" rx="1.5" fill="#10B981" />
          <rect x="18" y="25" width="12" height="4" rx="1.5" fill="#3B82F6" />
          <rect x="18" y="19" width="12" height="4" rx="1.5" fill="#EC4899" />
          {/* Biểu tượng tia chớp năng lượng ở giữa */}
          <path d="M25 18L21 26H25L23 32L29 24H25L27 18H25Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" filter="drop-shadow(0 0 4px rgba(253,224,71,0.8))" />
        </svg>
      )

    // 17. SenAI Studio: Lõi trí tuệ nhân tạo, chip neural phát sáng, mạng nơ-ron
    case 'senai_studio':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-ai-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="grad-chip" x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-ai-bg)" />
          {/* Chân chip xử lý neural */}
          <path d="M19 10V14M24 10V14M29 10V14M19 34V38M24 34V38M29 34V38M10 19H14M10 24H14M10 29H14M34 19H38M34 24H38M34 29H38" stroke="#FCE7F3" strokeWidth="1.5" strokeLinecap="round" />
          {/* Thân vi xử lý AI vuông bo góc */}
          <rect x="14" y="14" width="20" height="20" rx="5" fill="url(#grad-chip)" stroke="#EC4899" strokeWidth="1.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))" />
          {/* Vòng tròn bộ não / năng lượng AI */}
          <circle cx="24" cy="24" r="6" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="24" cy="24" r="3.5" fill="#F43F5E" />
          <circle cx="24" cy="24" r="1.5" fill="#FFFFFF" />
          {/* Tia sáng phát tán */}
          <circle cx="18" cy="18" r="1" fill="#FDE047" />
          <circle cx="30" cy="18" r="1" fill="#FDE047" />
          <circle cx="18" cy="30" r="1" fill="#38BDF8" />
          <circle cx="30" cy="30" r="1" fill="#38BDF8" />
        </svg>
      )

    // 18. Nâng Cấp Sen VIP: Vương miện hoàng gia vàng ánh kim đính ngọc ruby
    case 'vip':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-vip-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
            <linearGradient id="grad-crown" x1="10" y1="14" x2="38" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-vip-bg)" />
          {/* Vương miện vàng */}
          <path d="M11 31L14 18L20 24L24 14L28 24L34 18L37 31H11Z" fill="url(#grad-crown)" stroke="#FFFFFF" strokeWidth="1.2" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.25))" />
          {/* Đế vương miện */}
          <rect x="11" y="30" width="26" height="4" rx="2" fill="#B45309" stroke="#FDE047" strokeWidth="0.8" />
          {/* Viên ngọc trên đỉnh chóp */}
          <circle cx="14" cy="17" r="2" fill="#EF4444" stroke="#FFFFFF" strokeWidth="0.8" />
          <circle cx="24" cy="13" r="2.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="0.8" />
          <circle cx="34" cy="17" r="2" fill="#EF4444" stroke="#FFFFFF" strokeWidth="0.8" />
          {/* Viên ngọc đính ở đế */}
          <circle cx="18" cy="32" r="1.2" fill="#FFFFFF" />
          <circle cx="24" cy="32" r="1.5" fill="#EF4444" />
          <circle cx="30" cy="32" r="1.2" fill="#FFFFFF" />
        </svg>
      )

    // 19. Đổi Mã Quà Tặng: Hộp quà 3D thắt nơ vàng, pháo hoa ngôi sao
    case 'codes':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-gift-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#065F46" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-gift-bg)" />
          {/* Thân hộp quà */}
          <rect x="13" y="21" width="22" height="15" rx="2.5" fill="#FFFFFF" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.18))" />
          {/* Nắp hộp quà */}
          <rect x="11" y="16" width="26" height="6" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.8" />
          {/* Dây nơ đỏ */}
          <rect x="22" y="16" width="4" height="20" fill="#EF4444" />
          {/* Nơ thắt bồng bềnh */}
          <path d="M22 16C19 12 15 13 17 16H22Z" fill="#F43F5E" />
          <path d="M26 16C29 12 33 13 31 16H26Z" fill="#F43F5E" />
          <circle cx="24" cy="16" r="2" fill="#DC2626" />
          {/* Ngôi sao quà tặng */}
          <path d="M35 12L36 14L38 14.5L36 15.5L35 17.5L34 15.5L32 14.5L34 14L35 12Z" fill="#FDE047" />
        </svg>
      )

    // 20. Cổng Giáo Viên: Bảng thuyết trình lớp học, bút giảng bài
    case 'teacher':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-teach-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-teach-bg)" />
          {/* Bảng phấn xanh */}
          <rect x="10" y="11" width="28" height="21" rx="3" fill="#065F46" stroke="#D97706" strokeWidth="1.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.22))" />
          {/* Công thức trên bảng */}
          <path d="M14 17L17 21M17 17L14 21" stroke="#FEF08A" strokeWidth="1.2" strokeLinecap="round" />
          <text x="21" y="21" fill="#FFFFFF" fontSize="6" fontWeight="bold">f(x)=y</text>
          <circle cx="32" cy="19" r="3" fill="none" stroke="#6EE7B7" strokeWidth="1" />
          {/* Khay để phấn & chân giá đỡ */}
          <rect x="8" y="32" width="32" height="2" rx="1" fill="#B45309" />
          <path d="M16 34L13 40M32 34L35 40" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )

    // 21. Quản Trị Hệ Thống: Bảng điều khiển master, bánh răng cơ khí vàng, khóa bảo an
    case 'admin':
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-admin-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-admin-bg)" />
          {/* Bánh răng cơ khí trung tâm */}
          <g transform="translate(24, 24)">
            <circle cx="0" cy="0" r="10" fill="#1E293B" stroke="#FDE047" strokeWidth="2" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))" />
            <circle cx="0" cy="0" r="4.5" fill="#F59E0B" />
            {/* Răng cưa bánh xe */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect key={deg} x="-2" y="-13" width="4" height="4" rx="1" fill="#FDE047" transform={`rotate(${deg})`} />
            ))}
          </g>
          {/* Đèn chỉ báo trạng thái */}
          <circle cx="12" cy="12" r="2" fill="#10B981" />
          <circle cx="36" cy="12" r="2" fill="#38BDF8" />
        </svg>
      )

    // 22. Legacy Dashboard: Màn hình máy tính retro vintage hoài niệm
    case 'legacy-dashboard':
    default:
      return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad-legacy-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#64748B" />
              <stop offset="50%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="14" fill="url(#grad-legacy-bg)" />
          {/* Màn hình CRT cổ điển */}
          <rect x="11" y="11" width="26" height="20" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
          <rect x="13" y="13" width="22" height="16" rx="2" fill="#0F172A" />
          {/* Dòng chữ command prompt màu xanh lá cây */}
          <text x="16" y="20" fill="#22C55E" fontSize="5" fontFamily="monospace">&gt; legacy_</text>
          <line x1="16" y1="24" x2="28" y2="24" stroke="#22C55E" strokeWidth="1" strokeDasharray="2 1" />
          {/* Chân đế màn hình */}
          <path d="M21 31H27L29 36H19L21 31Z" fill="#94A3B8" />
          <rect x="16" y="36" width="16" height="2" rx="1" fill="#64748B" />
        </svg>
      )
  }
}
