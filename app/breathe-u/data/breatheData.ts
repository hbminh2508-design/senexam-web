export interface KnowledgeArticle {
  id: string
  title: string
  category: 'all' | 'traditional' | 'vape'
  readTime: string
  views: string
  keyTakeaway: string
  summary: string
  content: string[]
  iconType: 'lungs' | 'vape' | 'brain' | 'law' | 'heart'
}

export interface Challenge {
  id: string
  title: string
  subtitle: string
  points: number
  category: 'featured' | 'quick'
  daysTotal?: number
  daysCompleted?: number
  isJoined?: boolean
  description: string
  icon: string
}

export interface BadgeItem {
  id: string
  name: string
  pointsRequired: number
  unlocked: boolean
  description: string
  category: 'starter' | 'knowledge' | 'commitment' | 'challenge' | 'community' | 'spread'
}

export interface CommunityPost {
  id: string
  authorName: string
  authorRole: string
  authorAvatar: string
  timeAgo: string
  content: string
  imageBanner?: string
  likes: number
  comments: number
  shares: number
  isLiked?: boolean
  tags: string[]
}

export interface MapMarker {
  id: string
  name: string
  campus: 'cau_giay' | 'hoa_lac'
  type: 'safe' | 'resolved' | 'pending' // safe: 🟢, resolved: 🟡, pending: 🔴
  address: string
  description: string
  x: number // percent on custom SVG map 0-100
  y: number // percent on custom SVG map 0-100
  updatedAt: string
}

export interface ViolationReport {
  id: string
  locationName: string
  violationType: string
  description: string
  timestamp: string
  status: 'pending' | 'resolved' | 'processing'
  imageUrl?: string
}

// 1. DỮ LIỆU BÀI VIẾT KIẾN THỨC
export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'vape-harm',
    title: 'Vì sao thuốc lá điện tử vẫn gây hại?',
    category: 'vape',
    readTime: '5 phút đọc',
    views: '1.2K lượt xem',
    iconType: 'lungs',
    keyTakeaway:
      'Thuốc lá điện tử không an toàn như nhiều người nghĩ. Chúng chứa nicotine hàm lượng cao và hàng trăm hợp chất hóa học độc hại gây tổn thương nặng nề cho phổi, hệ tim mạch và não bộ người trẻ.',
    summary:
      'Thuốc lá điện tử (Vape, Pod) thường được tiếp thị đánh lừa là giải pháp thay thế "ít hại hơn", nhưng thực chất chứa nicotine nguyên chất gây nghiện cực mạnh và khói aerosol độc hại.',
    content: [
      'Thuốc lá điện tử hoạt động bằng cách đun nóng dung dịch lỏng (e-liquid) tạo thành khí dung (aerosol) để người dùng hít vào. Khí dung này KHÔNG PHẢI hơi nước đơn thuần mà là một hỗn hợp gồm nicotine, hạt kim loại siêu mịn (chì, niken, thiếc), hương liệu nhân tạo và các chất gây ung thư.',
      'Nicotine trong thuốc lá điện tử tác động trực tiếp lên hệ thần kinh đang phát triển của người dưới 25 tuổi, làm suy giảm trí nhớ, mất tập trung, gia tăng lo âu và trầm cảm.',
      'Hội chứng EVALI (tổn thương phổi cấp tính do thuốc lá điện tử) đã khiến hàng nghìn thanh thiếu niên phải nhập viện thở máy, để lại sẹo phổi vĩnh viễn không thể hồi phục.',
    ],
  },
  {
    id: 'new-gen-tobacco',
    title: 'Thuốc lá thế hệ mới là gì?',
    category: 'vape',
    readTime: '4 phút đọc',
    views: '980 lượt xem',
    iconType: 'vape',
    keyTakeaway:
      'Thuốc lá thế hệ mới bao gồm thuốc lá nung nóng (HTPs) và thuốc lá điện tử (ENDS), được thiết kế tinh vi dưới dạng thỏi son, bút dạ quang, USB để nhắm vào học sinh, sinh viên.',
    summary:
      'Hiểu rõ các biến thể của thuốc lá thế hệ mới và nhận diện những cạm bẫy quảng cáo tinh vi trong giới trẻ.',
    content: [
      'Thuốc lá nung nóng (Heated Tobacco Products - HTPs) làm nóng sợi thuốc lá ở nhiệt độ thấp hơn thuốc lá thông thường, nhưng vẫn sinh ra hắc ín, khí carbon monoxide (CO) và các hóa chất độc hại tương tự thuốc lá điếu.',
      'Nhiều loại pod dùng một lần (disposable pod) chứa hàm lượng nicotine tổng hợp (nicotine salts) cao gấp 3-5 lần một bao thuốc lá truyền thống, khiến người thử dễ dàng bị nghiện ngay từ lần hút đầu tiên.',
      'Nguy cơ cháy nổ pin lithium trong thiết bị vape cũng là mối hiểm họa thương tật nguy hiểm đã được ghi nhận tại nhiều cơ sở y tế.',
    ],
  },
  {
    id: 'youth-health',
    title: 'Ảnh hưởng đến sức khỏe tuổi trẻ',
    category: 'traditional',
    readTime: '6 phút đọc',
    views: '1.5K lượt xem',
    iconType: 'brain',
    keyTakeaway:
      'Khói thuốc lá phá hủy thể lực, làm giảm 30% dung tích sống của phổi, cản trở sự dẻo dai thể thao và đẩy nhanh quá trình lão hóa cơ thể sớm.',
    summary:
      'Tác động khôn lường của nicotine và khí độc đối với sức bền, trí não và hệ miễn dịch của sinh viên đại học.',
    content: [
      'Sinh viên hút thuốc hoặc tiếp xúc khói thuốc thụ động thường xuyên bị ho mãn tính, thở dốc khi leo cầu thang hoặc tập thể dục, đồng thời có nguy cơ mắc viêm xoang, viêm họng cao gấp 4 lần.',
      'Khí CO trong khói thuốc chiếm chỗ của oxy trong hồng cầu, khiến não bộ và các nhóm cơ luôn trong tình trạng thiếu oxy, dẫn đến mệt mỏi kinh niên trong các giờ học căng thẳng.',
      'Về lâu dài, hút thuốc là nguyên nhân số một gây xơ vữa động mạch sớm ở người trẻ, tăng đột quỵ não và nhồi máu cơ tim trước tuổi 35.',
    ],
  },
  {
    id: 'smoke-free-law',
    title: 'Luật pháp và quy định về môi trường không khói thuốc',
    category: 'traditional',
    readTime: '5 phút đọc',
    views: '820 lượt xem',
    iconType: 'law',
    keyTakeaway:
      'Luật Phòng, chống tác hại thuốc lá Việt Nam nghiêm cấm hoàn toàn hành vi hút thuốc lá trong khuôn viên trường đại học, cao đẳng, khu vực công cộng và giảng đường.',
    summary:
      'Cập nhật các chế tài xử phạt hành chính và quy chế xử lý kỷ luật sinh viên vi phạm quy định không khói thuốc tại ĐHQGHN.',
    content: [
      'Theo Điều 11 Luật Phòng, chống tác hại thuốc lá, cơ sở giáo dục đại học là địa điểm cấm hút thuốc lá hoàn toàn trong nhà và trong phạm vi khuôn viên.',
      'Nghị định 117/2020/NĐ-CP quy định phạt tiền từ 200.000đ đến 500.000đ đối với hành vi hút thuốc tại địa điểm có quy định cấm, phạt từ 3.000.000đ đến 5.000.000đ đối với hành vi bán thuốc lá cho người dưới 18 tuổi.',
      'Tại ĐHQGHN, hành vi hút thuốc lá trong trường bị trừ điểm rèn luyện, ghi nhận vi phạm kỷ luật sinh viên và không xét học bổng khuyến khích.',
    ],
  },
  {
    id: 'healthy-tips',
    title: 'Bí quyết sống khỏe không khói thuốc',
    category: 'all',
    readTime: '3 phút đọc',
    views: '2.1K lượt xem',
    iconType: 'heart',
    keyTakeaway:
      'Xây dựng thói quen thể thao, uống nhiều nước, tập hít thở sâu và tham gia các câu lạc bộ tình nguyện để nói KHÔNG dứt khoát với lời rủ rê hút thuốc.',
    summary:
      'Cẩm nang 5 bước vàng giúp thanh niên giữ vững bản lĩnh sống lành mạnh và tự do hít thở không khí trong lành.',
    content: [
      'Nguyên tắc 4D khi đối mặt cơn thèm hút: Delay (Trì hoãn 5 phút), Deep breath (Hít thở thật sâu 10 lần), Drink water (Uống một cốc nước lọc mát), Distract (Làm việc khác để phân tán chú ý).',
      'Tham gia các nhóm chạy bộ, cầu lông hoặc hoạt động tình nguyện xanh của Hội Sinh viên để hòa mình vào môi trường tích cực không khói thuốc.',
      'Tự hào khẳng định cá tính: "Mình không hút thuốc vì yêu quý lá phổi của chính mình và tôn trọng mọi người xung quanh!"',
    ],
  },
]

// 2. DỮ LIỆU THỬ THÁCH
export const CHALLENGES: Challenge[] = [
  {
    id: '7days-smoke-free',
    title: 'THỬ THÁCH 7 NGÀY KHÔNG KHÓI THUỐC',
    subtitle: 'Cùng nhau tạo nên phiên bản tốt hơn của chính mình!',
    points: 150,
    category: 'featured',
    daysTotal: 7,
    daysCompleted: 3,
    isJoined: true,
    description: 'Thực hiện chuỗi 7 ngày liên tiếp check-in không chạm vào khói thuốc và lan tỏa lối sống năng động.',
    icon: 'target',
  },
  {
    id: 'check-in-clean',
    title: 'Check-in không khói',
    subtitle: 'Chụp ảnh góc học tập hoặc khuôn viên trường trong lành hôm nay',
    points: 50,
    category: 'quick',
    isJoined: false,
    description: 'Chia sẻ hình ảnh bạn đang học tập tại khu vực không khói thuốc của trường.',
    icon: 'camera',
  },
  {
    id: 'quiz-5min',
    title: 'Tìm hiểu trong 5 phút',
    subtitle: 'Trả lời đúng 3 câu hỏi trắc nghiệm về tác hại thuốc lá điện tử',
    points: 30,
    category: 'quick',
    isJoined: false,
    description: 'Kiểm tra kiến thức nhanh và nhận ngay huy hiệu Kiến thức.',
    icon: 'book',
  },
  {
    id: 'share-message',
    title: 'Lan tỏa thông điệp',
    subtitle: 'Chia sẻ cam kết "Breathe U - ĐHQGHN" lên mạng xã hội kèm hashtag',
    points: 100,
    category: 'quick',
    isJoined: false,
    description: 'Đăng tải thông điệp tích cực cùng hashtag #BreatheU #VNU_KhongKhoiThuoc.',
    icon: 'share',
  },
]

// 3. DANH SÁCH HUY HIỆU
export const BADGES: BadgeItem[] = [
  {
    id: 'newbie',
    name: 'Tân binh',
    pointsRequired: 10,
    unlocked: true,
    description: 'Hoàn tất đăng ký tài khoản Breathe U',
    category: 'starter',
  },
  {
    id: 'knowledge',
    name: 'Kiến thức',
    pointsRequired: 50,
    unlocked: true,
    description: 'Đọc đủ 3 bài viết chuyên đề về tác hại khói thuốc',
    category: 'knowledge',
  },
  {
    id: 'commit',
    name: 'Cam kết',
    pointsRequired: 50,
    unlocked: true,
    description: 'Ký chứng nhận trực tuyến xây dựng trường học xanh',
    category: 'commitment',
  },
  {
    id: 'challenge',
    name: 'Thử thách',
    pointsRequired: 100,
    unlocked: true,
    description: 'Vượt qua thử thách 7 ngày không khói thuốc',
    category: 'challenge',
  },
  {
    id: 'community',
    name: 'Cộng đồng',
    pointsRequired: 200,
    unlocked: false,
    description: 'Đóng góp 5 bài đăng/phản ánh tích cực cho chiến dịch',
    category: 'community',
  },
  {
    id: 'spread',
    name: 'Lan tỏa',
    pointsRequired: 500,
    unlocked: false,
    description: 'Giới thiệu 10 bạn bè cùng tham gia Breathe U',
    category: 'spread',
  },
]

// 4. BÀI ĐĂNG CỘNG ĐỒNG
export const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    authorName: 'CLB Sinh viên Xanh UET',
    authorRole: 'Câu lạc bộ tình nguyện',
    authorAvatar: '🌿',
    timeAgo: '2 giờ trước',
    content:
      'Cùng nhìn lại những khoảnh khắc đẹp trong Chiến dịch "Khuôn viên không khói thuốc" vừa diễn ra sáng nay tại Nhà E3 & Giảng đường G2! Hơn 300 bạn sinh viên đã ký tên lên bảng cam kết lớn. Cảm ơn sự đồng hành tuyệt vời của các bạn! 💚🌱',
    imageBanner: 'campaign-1',
    likes: 128,
    comments: 12,
    shares: 36,
    isLiked: true,
    tags: ['#BreatheU', '#UET_Green', '#KhongKhoiThuoc'],
  },
  {
    id: 'post-2',
    authorName: 'Nguyễn Hoàng',
    authorRole: 'K70 Cơ kỹ thuật & Tự động hóa',
    authorAvatar: '🧑‍🎓',
    timeAgo: '5 giờ trước',
    content:
      'Môi trường trong lành là quyền của tất cả chúng ta! Hôm nay chạy bộ quanh khuôn viên ĐHQGHN Hòa Lạc không khí cực kỳ mát mẻ và sảng khoái. Hãy giữ gìn bầu không khí này nhé các bạn!',
    imageBanner: 'campaign-2',
    likes: 89,
    comments: 7,
    shares: 14,
    isLiked: false,
    tags: ['#VNUHoaLac', '#BreatheFree'],
  },
  {
    id: 'post-3',
    authorName: 'Đoàn Thanh niên ĐHQGHN',
    authorRole: 'Ban Thường vụ Đoàn ĐHQGHN',
    authorAvatar: '⭐',
    timeAgo: '1 ngày trước',
    content:
      '📢 Phát động Cuộc thi "SÁNG TẠO VÌ MỘT THẾ HỆ KHÔNG KHÓI THUỐC 2026". Nền tảng BREATHE U hân hạnh là giải pháp công nghệ tiên phong kết nối ý thức và hành động của sinh viên toàn Đại học Quốc gia!',
    likes: 245,
    comments: 34,
    shares: 58,
    isLiked: true,
    tags: ['#SangTao2026', '#BreatheU'],
  },
]

// 5. ĐIỂM GHIM TRÊN BẢN ĐỒ
export const MAP_MARKERS: MapMarker[] = [
  {
    id: 'm1',
    name: 'Khuôn viên Nhà E3 - UET',
    campus: 'cau_giay',
    type: 'safe',
    address: '144 Xuân Thủy, Cầu Giấy',
    description: 'Khu vực cấm hút thuốc 100%. Có gắn biển báo và thùng rác phân loại.',
    x: 42,
    y: 36,
    updatedAt: 'Hôm nay',
  },
  {
    id: 'm2',
    name: 'Thư viện Trung tâm ĐHQGHN',
    campus: 'cau_giay',
    type: 'safe',
    address: 'Tòa nhà Thư viện KTX Mễ Trì',
    description: 'Không gian học tập yên tĩnh, văn minh, hoàn toàn không khói thuốc.',
    x: 58,
    y: 28,
    updatedAt: 'Hôm nay',
  },
  {
    id: 'm3',
    name: 'Giảng đường G2 - UET',
    campus: 'cau_giay',
    type: 'safe',
    address: '144 Xuân Thủy',
    description: 'Khu vực phòng học và hội trường không khói thuốc.',
    x: 48,
    y: 52,
    updatedAt: 'Hôm qua',
  },
  {
    id: 'm4',
    name: 'Cổng sau KTX Xuân Thủy',
    campus: 'cau_giay',
    type: 'pending',
    address: 'Góc ngõ 130 Xuân Thủy',
    description: 'Phát hiện học sinh/sinh viên hút thuốc lá điện tử giờ tan học.',
    x: 68,
    y: 65,
    updatedAt: '15 phút trước',
  },
  {
    id: 'm5',
    name: 'Bãi đỗ xe cạnh Nhà E4',
    campus: 'cau_giay',
    type: 'resolved',
    address: 'Khuôn viên UET',
    description: 'Đã nhắc nhở và lắp thêm camera giám sát trật tự.',
    x: 32,
    y: 45,
    updatedAt: '2 ngày trước',
  },
  {
    id: 'm6',
    name: 'Khu Tổ hợp Giảng đường Hòa Lạc',
    campus: 'hoa_lac',
    type: 'safe',
    address: 'Khu đô thị ĐHQGHN tại Hòa Lạc',
    description: 'Khuôn viên sinh thái xanh, hoàn toàn cấm thuốc lá.',
    x: 50,
    y: 40,
    updatedAt: 'Hôm nay',
  },
]

// 6. PHẢN ÁNH MẪU BAN ĐẦU
export const INITIAL_REPORTS: ViolationReport[] = [
  {
    id: 'rep-01',
    locationName: 'Cầu thang bộ Tầng 3 Nhà E3',
    violationType: 'Hút thuốc lá điện tử (Pod)',
    description: 'Thấy có nhóm hút vape nhả khói nồng mùi hoa quả trong góc cầu thang.',
    timestamp: '14:30 - Hôm nay',
    status: 'pending',
  },
  {
    id: 'rep-02',
    locationName: 'Căn tin sinh viên Cầu Giấy',
    violationType: 'Hút thuốc lá truyền thống',
    description: 'Bảo vệ đã tới nhắc nhở người vi phạm và dập tàn thuốc.',
    timestamp: '09:15 - Hôm qua',
    status: 'resolved',
  },
]
