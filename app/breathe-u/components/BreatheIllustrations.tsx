'use client'

import React from 'react'

// 1. LOGO BREATHE U
export function BreatheLogo({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
        {/* Vòng hào quang xanh mát */}
        <circle cx="60" cy="60" r="54" fill="url(#bgLeafGrad)" opacity="0.15" />
        
        {/* Lá chính bên trái (vươn cao) */}
        <path
          d="M60 95C60 95 30 75 30 45C30 25 45 15 60 25C75 15 90 25 90 45C90 75 60 95 60 95Z"
          fill="url(#leafMain)"
        />
        {/* Gân lá trung tâm thanh thoát */}
        <path d="M60 30V88" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        <path d="M60 48L46 40" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <path d="M60 62L74 54" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <path d="M60 74L48 68" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

        {/* Chồi non thứ hai bên phải */}
        <path
          d="M60 85C75 80 88 65 85 45C85 45 78 58 60 68"
          fill="url(#leafAccent)"
          opacity="0.85"
        />

        <defs>
          <linearGradient id="bgLeafGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10B981" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="leafMain" x1="30" y1="20" x2="85" y2="95" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="0.5" stopColor="#10B981" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="leafAccent" x1="60" y1="45" x2="90" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6EE7B7" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// 2. TRANH MINH HỌA MÀN HÌNH CHÀO (SPLASH SCREEN: 3 SINH VIÊN VÀ GIẢNG ĐƯỜNG ĐHQGHN)
export function SplashIllustration({ className = 'w-full h-64' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Nền trời xanh mát & mây */}
        <rect width="400" height="320" rx="24" fill="url(#skyGradient)" />
        <ellipse cx="80" cy="60" rx="45" ry="18" fill="#FFFFFF" opacity="0.6" />
        <ellipse cx="320" cy="50" rx="55" ry="20" fill="#FFFFFF" opacity="0.6" />

        {/* Giảng đường ĐHQGHN phong cách cổ kính & hiện đại phía sau */}
        <path d="M120 180H280V120H120V180Z" fill="#E2E8F0" />
        <path d="M110 120L200 80L290 120H110Z" fill="#CBD5E1" />
        {/* Mái vòm trung tâm */}
        <path d="M175 80C175 65 200 55 200 55C200 55 225 65 225 80H175Z" fill="#047857" />
        <rect x="195" y="40" width="10" height="15" fill="#065F46" />
        <circle cx="200" cy="38" r="4" fill="#F59E0B" />
        {/* Cột giảng đường */}
        <rect x="140" y="130" width="12" height="50" fill="#94A3B8" />
        <rect x="170" y="130" width="12" height="50" fill="#94A3B8" />
        <rect x="218" y="130" width="12" height="50" fill="#94A3B8" />
        <rect x="248" y="130" width="12" height="50" fill="#94A3B8" />
        {/* Cửa vòm */}
        <path d="M185 180V150C185 142 215 142 215 150V180H185Z" fill="#0F172A" opacity="0.75" />

        {/* Cây xanh hai bên khuôn viên */}
        <ellipse cx="60" cy="180" rx="45" ry="60" fill="#10B981" />
        <ellipse cx="75" cy="165" rx="35" ry="45" fill="#34D399" />
        <ellipse cx="340" cy="180" rx="45" ry="60" fill="#10B981" />
        <ellipse cx="325" cy="165" rx="35" ry="45" fill="#34D399" />
        <rect x="55" y="210" width="14" height="40" fill="#78350F" />
        <rect x="335" y="210" width="14" height="40" fill="#78350F" />

        {/* Đồi cỏ phía trước */}
        <path d="M0 240C80 230 180 235 400 230V320H0V240Z" fill="#059669" />
        <path d="M0 260C120 250 250 255 400 250V320H0V260Z" fill="#047857" />

        {/* SINH VIÊN 1 (Bên trái - Nam sinh đeo balo xanh, cầm tập vở) */}
        <g id="student-left">
          {/* Chân */}
          <rect x="85" y="260" width="10" height="40" rx="5" fill="#1E293B" />
          <rect x="100" y="260" width="10" height="40" rx="5" fill="#1E293B" />
          {/* Áo thun trắng & quai ba lô */}
          <ellipse cx="98" cy="225" rx="18" ry="30" fill="#F8FAFC" />
          <path d="M86 210C86 210 82 235 84 250" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" />
          {/* Cổ áo & đầu */}
          <circle cx="98" cy="185" r="14" fill="#FCD34D" />
          {/* Tóc */}
          <path d="M85 182C85 172 95 168 108 172C112 176 112 185 110 188C105 186 100 186 96 186C90 186 85 182 85 182Z" fill="#1E293B" />
          {/* Nụ cười */}
          <circle cx="95" cy="184" r="1.5" fill="#1E293B" />
          <circle cx="102" cy="184" r="1.5" fill="#1E293B" />
          <path d="M96 190Q98 193 102 190" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
          {/* Tập tài liệu trên tay */}
          <rect x="104" y="220" width="14" height="20" rx="2" fill="#0284C7" transform="rotate(15 104 220)" />
        </g>

        {/* SINH VIÊN 2 (Ở giữa - Nữ sinh tóc dài, áo cam/hồng, nụ cười rạng rỡ) */}
        <g id="student-center">
          {/* Chân / Váy */}
          <path d="M190 260L185 300H195L198 260Z" fill="#475569" />
          <path d="M205 260L208 300H218L213 260Z" fill="#475569" />
          <path d="M185 240L178 268H225L218 240Z" fill="#3B82F6" />
          {/* Áo khoác vàng/cam năng động */}
          <ellipse cx="201" cy="215" rx="19" ry="26" fill="#F59E0B" />
          {/* Khăn / Cổ áo xanh */}
          <circle cx="201" cy="192" r="6" fill="#10B981" />
          {/* Mặt */}
          <circle cx="201" cy="175" r="15" fill="#FDE68A" />
          {/* Mắt, miệng */}
          <circle cx="196" cy="174" r="1.5" fill="#1E293B" />
          <circle cx="206" cy="174" r="1.5" fill="#1E293B" />
          <path d="M198 181Q201 185 204 181" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" />
          {/* Mái tóc dài cột cao */}
          <path d="M187 172C187 160 215 158 215 170C215 180 212 188 212 188C218 190 220 205 216 215C214 210 212 205 210 198" fill="#334155" />
          {/* Cặp sách / Bìa tài liệu "Breathe U" */}
          <rect x="188" y="218" width="26" height="20" rx="3" fill="#FFFFFF" stroke="#10B981" strokeWidth="1.5" />
          <path d="M195 225L200 231L208 223" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* SINH VIÊN 3 (Bên phải - Nữ sinh tóc ngắn, đeo kính năng động) */}
        <g id="student-right">
          {/* Chân quần jean */}
          <rect x="290" y="260" width="10" height="40" rx="5" fill="#2563EB" />
          <rect x="305" y="260" width="10" height="40" rx="5" fill="#2563EB" />
          {/* Áo xanh dương VNU */}
          <ellipse cx="303" cy="225" rx="18" ry="28" fill="#1D4ED8" />
          <path d="M292 210C292 210 288 235 290 250" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
          {/* Mặt */}
          <circle cx="303" cy="185" r="14" fill="#FCD34D" />
          {/* Kính mắt thông thái */}
          <circle cx="298" cy="184" r="4.5" stroke="#1E293B" strokeWidth="1.5" fill="none" />
          <circle cx="308" cy="184" r="4.5" stroke="#1E293B" strokeWidth="1.5" fill="none" />
          <line x1="302.5" y1="184" x2="303.5" y2="184" stroke="#1E293B" strokeWidth="1.5" />
          {/* Tóc */}
          <path d="M290 182C290 170 316 168 316 182C314 190 310 195 304 195C298 195 290 190 290 182Z" fill="#475569" />
          <path d="M300 190Q303 193 306 190" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        <defs>
          <linearGradient id="skyGradient" x1="200" y1="0" x2="200" y2="320" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ECFDF5" />
            <stop offset="0.6" stopColor="#E0F2FE" />
            <stop offset="1" stopColor="#D1FAE5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// 3. MINH HỌA LÁ PHỔI KHỎE MẠNH VS PHỔI TỔN THƯƠNG DO VAPE (DÙNG TRONG BÀI VIẾT)
export function LungsComparisonIllustration({ className = 'w-full h-44' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 340 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full max-w-sm">
        {/* Nền bo góc nhẹ */}
        <rect width="340" height="180" rx="16" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />

        {/* Khí quản trung tâm phân nhánh */}
        <path d="M170 20V65" stroke="#94A3B8" strokeWidth="10" strokeLinecap="round" />
        <path d="M170 65L145 95" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
        <path d="M170 65L195 95" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />

        {/* LÁ PHỔI TRÁI: KHỎE MẠNH (HỒNG TƯƠI, TRONG LÀNH, CÓ MẦM CÂY) */}
        <g id="healthy-lung">
          <path
            d="M135 75C115 65 75 75 75 110C75 140 100 155 130 155C150 155 155 135 155 115C155 95 145 80 135 75Z"
            fill="url(#healthyLungGrad)"
          />
          {/* Nhánh phế quản khỏe mạnh */}
          <path d="M135 90L105 105" stroke="#FDA4AF" strokeWidth="3" strokeLinecap="round" />
          <path d="M125 110L100 130" stroke="#FDA4AF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M135 125L115 145" stroke="#FDA4AF" strokeWidth="2.5" strokeLinecap="round" />
          {/* Biểu tượng lá xanh thanh sạch */}
          <circle cx="85" cy="85" r="14" fill="#10B981" />
          <path d="M81 85L84 88L90 82" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="75" y="172" fill="#047857" fontSize="11" fontWeight="bold">KHỎE MẠNH</text>
        </g>

        {/* LÁ PHỔI PHẢI: BỊ TỔN THƯƠNG DO VAPE / KHÓI THUỐC (ĐEN SẠM, ĐỐM ĐỘC HẠI, KHÓI BỐC LÊN) */}
        <g id="damaged-lung">
          <path
            d="M205 75C225 65 265 75 265 110C265 140 240 155 210 155C190 155 185 135 185 115C185 95 195 80 205 75Z"
            fill="url(#damagedLungGrad)"
          />
          {/* Đốm hắc ín & hóa chất độc hại */}
          <circle cx="235" cy="100" r="5" fill="#1E293B" opacity="0.8" />
          <circle cx="220" cy="120" r="7" fill="#1E293B" opacity="0.7" />
          <circle cx="245" cy="130" r="6" fill="#1E293B" opacity="0.85" />
          <circle cx="205" cy="140" r="4" fill="#1E293B" opacity="0.6" />
          {/* Dải khói độc bay lên */}
          <path d="M255 70C265 55 250 40 260 25" stroke="#94A3B8" strokeWidth="3" strokeDasharray="3 3" strokeLinecap="round" />
          <path d="M240 60C248 48 242 35 250 20" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
          {/* Biểu tượng cảnh báo nguy hiểm */}
          <circle cx="255" cy="85" r="14" fill="#EF4444" />
          <path d="M250 90L260 80M260 90L250 80" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <text x="200" y="172" fill="#DC2626" fontSize="11" fontWeight="bold">TỔN THƯƠNG DO VAPE</text>
        </g>

        <defs>
          <linearGradient id="healthyLungGrad" x1="75" y1="75" x2="155" y2="155" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F472B6" />
            <stop offset="0.5" stopColor="#FB7185" />
            <stop offset="1" stopColor="#E11D48" />
          </linearGradient>
          <linearGradient id="damagedLungGrad" x1="185" y1="75" x2="265" y2="155" gradientUnits="userSpaceOnUse">
            <stop stopColor="#64748B" />
            <stop offset="0.5" stopColor="#475569" />
            <stop offset="1" stopColor="#334155" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// 4. TRANH MINH HỌA BÀI VIẾT: HÚT THUỐC LÁ ĐIỆN TỬ VÀ SỰ ĐỘC HẠI
export function ArticleHeroIllustration({ className = 'w-full h-48' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 dark:from-slate-900 dark:via-rose-950/20 dark:to-slate-900 border border-rose-200/50 dark:border-rose-900/30 ${className}`}>
      <svg viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Vòng cấm thuốc lá điện tử */}
        <circle cx="320" cy="45" r="22" stroke="#EF4444" strokeWidth="4" fill="#FFFFFF" opacity="0.9" />
        <line x1="305" y1="30" x2="335" y2="60" stroke="#EF4444" strokeWidth="4" />
        {/* Hình Pod mini trong vòng cấm */}
        <rect x="316" y="32" width="8" height="26" rx="2" fill="#475569" />

        {/* NỮ SINH BÊN TRÁI: KHÓ CHỊU, HO SẶC SỤA VÌ KHÓI THUỐC THỤ ĐỘNG */}
        <g id="victim-girl">
          <circle cx="70" cy="80" r="20" fill="#FDE68A" />
          {/* Tóc */}
          <path d="M52 75C52 60 88 58 88 75C88 95 85 105 82 110C80 115 60 115 58 110" fill="#92400E" />
          {/* Biểu cảm ho sặc sụa: Mắt nhắm nghiền (> <), tay ôm ngực */}
          <path d="M62 76L67 80L62 84" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          <path d="M78 76L73 80L78 84" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          <path d="M68 89C70 93 74 93 76 89" stroke="#E11D48" strokeWidth="2" fill="#E11D48" />
          {/* Áo xanh */}
          <path d="M45 130C45 110 95 110 95 130V190H45V130Z" fill="#38BDF8" />
          {/* Bàn tay ôm ngực / che miệng */}
          <ellipse cx="80" cy="115" rx="8" ry="12" fill="#FDE68A" transform="rotate(-30 80 115)" />
          {/* Các dấu hiệu ho: "Khụ! Khụ!" */}
          <path d="M95 70C100 65 110 68 115 62" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M100 80C106 78 112 82 120 76" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* ĐÁM MÂY KHÓI ĐỘC HẠI CHỨA HÓA CHẤT TỎA RA Ở GIỮA */}
        <g id="smoke-cloud">
          <path
            d="M130 90C125 70 145 50 170 55C190 40 220 50 225 70C245 70 255 90 245 110C255 130 235 150 215 145C195 160 165 150 155 135C135 135 120 115 130 90Z"
            fill="#E2E8F0"
            opacity="0.85"
          />
          {/* Các phân tử hóa chất độc hại bọc trong khói: Nicotine, Chì, Formaldehyde */}
          <circle cx="165" cy="80" r="5" fill="#EF4444" />
          <text x="173" y="84" fill="#DC2626" fontSize="9" fontWeight="bold">Nicotine</text>
          <circle cx="185" cy="115" r="4" fill="#7C3AED" />
          <text x="192" y="118" fill="#6D28D9" fontSize="8" fontWeight="bold">Pb, Ni</text>
          <circle cx="150" cy="120" r="4" fill="#F59E0B" />
        </g>

        {/* NAM SINH BÊN PHẢI: CẦM POD VAPE BƠM KHÓI */}
        <g id="vaper-boy">
          <circle cx="280" cy="85" r="20" fill="#FCD34D" />
          <path d="M260 80C260 65 298 62 298 78C298 90 295 95 290 100" fill="#1E293B" />
          <circle cx="274" cy="83" r="2" fill="#1E293B" />
          {/* Mồm ngậm ống hút vape */}
          <rect x="255" y="88" width="16" height="5" rx="2.5" fill="#0284C7" />
          {/* Thân vape pod hiện đại */}
          <rect x="245" y="90" width="14" height="35" rx="4" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />
          <circle cx="252" cy="100" r="2" fill="#22C55E" /> {/* Đèn LED vape */}
          {/* Áo khoác hoodie xanh lá */}
          <path d="M255 135C255 115 310 115 310 135V190H255V135Z" fill="#10B981" />
        </g>
      </svg>
    </div>
  )
}

// 5. TRANH MINH HỌA THỬ THÁCH 7 NGÀY (SINH VIÊN GIƠ NGÓN TAY CÁI LIKE QUYẾT TÂM)
export function ChallengeHeroIllustration({ className = 'w-32 h-32' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Nền tròn năng động */}
        <circle cx="80" cy="80" r="70" fill="url(#challengeGrad)" />
        <circle cx="80" cy="80" r="64" stroke="#FFFFFF" strokeWidth="3" opacity="0.4" strokeDasharray="6 6" />

        {/* Sinh viên tươi cười */}
        <circle cx="80" cy="65" r="24" fill="#FDE68A" />
        {/* Mái tóc */}
        <path d="M58 60C58 40 102 38 102 58C100 70 96 75 92 78" fill="#1E293B" />
        <circle cx="73" cy="63" r="2" fill="#1E293B" />
        <circle cx="87" cy="63" r="2" fill="#1E293B" />
        <path d="M75 72Q80 78 85 72" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" />

        {/* Áo thể thao xanh lá */}
        <path d="M50 120C50 98 110 98 110 120V150H50V120Z" fill="#10B981" />

        {/* Bàn tay giơ ngón tay cái Thumbs Up 👍 */}
        <g id="thumbs-up">
          <ellipse cx="115" cy="115" rx="14" ry="12" fill="#FCD34D" />
          {/* Ngón cái chỉ lên */}
          <rect x="110" y="90" width="10" height="22" rx="5" fill="#FCD34D" />
          <path d="M120 108C124 108 126 114 123 118" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Ánh sao lấp lánh */}
        <path d="M30 40L33 46L40 48L34 52L35 58L30 54L25 58L26 52L20 48L27 46Z" fill="#FCD34D" />
        <path d="M135 45L137 49L142 50L138 53L139 57L135 54L131 57L132 53L128 50L133 49Z" fill="#FCD34D" />

        <defs>
          <linearGradient id="challengeGrad" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// 6. MINH HỌA GIẤY CAM KẾT & BÀN TAY KÝ TÊN TRANG TRỌNG
export function CommitmentHeroIllustration({ className = 'w-48 h-48' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
        {/* Tờ giấy chứng nhận nền trắng viền xanh lá */}
        <rect x="35" y="20" width="130" height="160" rx="8" fill="#FFFFFF" stroke="#10B981" strokeWidth="4" />
        <rect x="42" y="27" width="116" height="146" rx="4" fill="#F0FDF4" stroke="#D1FAE5" strokeWidth="1" />

        {/* Dải ruy băng / Huy hiệu chứng nhận phía trên */}
        <circle cx="100" cy="65" r="22" fill="#FEF2F2" stroke="#EF4444" strokeWidth="3" />
        {/* Biểu tượng cấm hút thuốc bên trong con dấu */}
        <line x1="88" y1="65" x2="112" y2="65" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
        <rect x="108" y="63" width="5" height="4" fill="#EF4444" />
        <line x1="85" y1="78" x2="115" y2="52" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />

        {/* Các dòng chữ cam kết mô phỏng */}
        <line x1="55" y1="105" x2="145" y2="105" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
        <line x1="60" y1="117" x2="140" y2="117" stroke="#6EE7B7" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="65" y1="127" x2="135" y2="127" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" />

        {/* Vệt chữ ký mực xanh uốn lượn */}
        <path d="M70 148Q85 138 95 152T125 145" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* BÀN TAY CẦM BÚT KÝ TÊN */}
        <g id="hand-pen">
          {/* Cây bút máy đen/vàng */}
          <rect x="125" y="105" width="8" height="55" rx="3" fill="#1E293B" transform="rotate(35 125 105)" />
          <polygon points="120,158 126,155 124,166" fill="#F59E0B" />
          <circle cx="123" cy="165" r="1.5" fill="#1D4ED8" /> {/* Ngòi mực */}
          {/* Bàn tay da sáng cầm thân bút */}
          <ellipse cx="145" cy="135" rx="16" ry="12" fill="#FCD34D" transform="rotate(20 145 135)" />
          <ellipse cx="132" cy="142" rx="7" ry="6" fill="#FDE68A" />
        </g>
      </svg>
    </div>
  )
}

// 7. BẢN ĐỒ KHUÔN VIÊN TRƯỜNG ĐỒ HỌA VECTOR TƯƠNG TÁC
export function CampusMapGraphic({
  markers,
  selectedMarkerId,
  onSelectMarker,
}: {
  markers: any[]
  selectedMarkerId?: string
  onSelectMarker?: (id: string) => void
}) {
  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#E2E8F0] border border-black/10 dark:border-white/10 shadow-inner">
      <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Nền đất & bãi cỏ khuôn viên */}
        <rect width="400" height="300" fill="#E2E8F0" />
        <path d="M20 20H150V120H20V20Z" fill="#D1FAE5" rx="8" />
        <path d="M180 30H370V110H180V30Z" fill="#D1FAE5" rx="8" />
        <path d="M30 160H160V270H30V160Z" fill="#D1FAE5" rx="8" />
        <path d="M200 150H370V270H200V150Z" fill="#D1FAE5" rx="8" />

        {/* Hệ thống đường giao thông nội khu (màu xám nhạt / trắng) */}
        <rect x="0" y="125" width="400" height="24" fill="#CBD5E1" />
        <rect x="160" y="0" width="24" height="300" fill="#CBD5E1" />
        {/* Đường kẻ tim đường */}
        <line x1="0" y1="137" x2="400" y2="137" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="10 10" />
        <line x1="172" y1="0" x2="172" y2="300" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="10 10" />

        {/* Các tòa nhà ĐHQGHN */}
        {/* Nhà E3 - UET */}
        <g>
          <rect x="40" y="40" width="80" height="60" rx="6" fill="#3B82F6" opacity="0.8" />
          <text x="80" y="75" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">Nhà E3 (UET)</text>
        </g>
        {/* Thư viện VNU */}
        <g>
          <rect x="220" y="45" width="110" height="50" rx="6" fill="#10B981" opacity="0.85" />
          <text x="275" y="75" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">Thư viện VNU</text>
        </g>
        {/* Giảng đường G2 */}
        <g>
          <rect x="45" y="180" width="90" height="65" rx="6" fill="#6366F1" opacity="0.8" />
          <text x="90" y="218" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">Giảng đường G2</text>
        </g>
        {/* Canteen & Ký túc xá */}
        <g>
          <rect x="230" y="175" width="120" height="75" rx="6" fill="#F59E0B" opacity="0.85" />
          <text x="290" y="218" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">Căn tin & KTX</text>
        </g>

        {/* Hàng cây xanh trên vỉa hè */}
        {[30, 80, 130, 210, 260, 310, 360].map((cx, i) => (
          <circle key={i} cx={cx} cy={118} r="6" fill="#059669" />
        ))}
        {[40, 90, 190, 240].map((cy, i) => (
          <circle key={i} cx={152} cy={cy} r="6" fill="#059669" />
        ))}

        {/* CÁC ĐIỂM GHIM TRẠNG THÁI (PINS) */}
        {markers.map((m) => {
          const isSelected = selectedMarkerId === m.id
          const posX = (m.x / 100) * 400
          const posY = (m.y / 100) * 300
          const pinColor = m.type === 'safe' ? '#10B981' : m.type === 'resolved' ? '#F59E0B' : '#EF4444'

          return (
            <g
              key={m.id}
              className="cursor-pointer transition-transform hover:scale-125"
              onClick={() => onSelectMarker && onSelectMarker(m.id)}
            >
              {/* Vòng lan tỏa nếu đang chọn */}
              {isSelected && (
                <circle cx={posX} cy={posY} r="18" fill={pinColor} opacity="0.3" className="animate-ping" />
              )}
              {/* Bóng đổ */}
              <ellipse cx={posX} cy={posY + 2} rx="8" ry="3" fill="#000000" opacity="0.25" />
              {/* Hình ghim Map Pin */}
              <path
                d={`M${posX} ${posY - 24}C${posX - 9} ${posY - 24} ${posX - 14} ${posY - 18} ${posX - 14} ${posY - 10}C${posX - 14} ${posY - 2} ${posX} ${posY} ${posX} ${posY}C${posX} ${posY} ${posX + 14} ${posY - 2} ${posX + 14} ${posY - 10}C${posX + 14} ${posY - 18} ${posX + 9} ${posY - 24} ${posX} ${posY - 24}Z`}
                fill={pinColor}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {/* Chấm tròn biểu tượng trong ghim */}
              <circle cx={posX} cy={posY - 12} r="4.5" fill="#FFFFFF" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
