'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, X, Loader2 } from 'lucide-react'

// Hàm chuẩn hóa Tiếng Việt (Xóa dấu, đưa về chữ thường, xóa khoảng trắng thừa)
const normalizeText = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

// 🤖 BỘ NÃO SEN AI OFFLINE - PHIÊN BẢN MỞ RỘNG (MEDIUM LLM SIMULATION)
const generateOfflineAIResponse = (input: string, userName: string) => {
  const normalizedInput = normalizeText(input);
  const rawInput = input.toLowerCase();
  
  const intents = [
    {
      // 1. Chào hỏi chung
      keywords: ['chao', 'hi', 'hello', 'alo', 'ê', 'hey', 'co ai khong', 'buoi sang', 'buoi toi', 'chao sen'],
      responses: [
        `Chào ${userName || 'bạn'}! 🌸 Mình là Sen AI - Trợ lý học tập của SenExam. Mình giúp gì được cho bạn?`,
        `Hi ${userName || 'bạn'}! ✨ Sen AI đây. Bạn cần tìm đề thi, tài liệu hay cần tư vấn học tập không?`,
        'Chào đằng ấy! 🚀 Sẵn sàng để bứt phá điểm số cùng SenExam chưa? Bạn cần mình hướng dẫn gì nào?'
      ]
    },
    {
      // 2. Thông tin Tác giả / Founder (NEW)
      keywords: ['ai tao ra', 'nguoi tao', 'tac gia', 'founder', 'hoang binh minh', 'lien he', 'contact', 'ai lam ra', 'developer', 'dev', 'chu web', 'ai viet', 'thong tin he thong'],
      responses: [
        'SenExam và mình (Sen AI) được phát triển bởi **Hoàng Bình Minh**, sinh viên trường Đại học Công nghệ, Đại học Quốc gia Hà Nội (UET-VNU) đó! 🚀 Nếu bạn cần liên hệ hợp tác hoặc báo lỗi, có thể gửi email qua: hbminh2508@gmail.com nhé.',
        'Người tạo ra nền tảng này là anh **Hoàng Bình Minh** (Sinh viên UET-VNU). 🌸 Nền tảng được xây dựng với mong muốn mang lại môi trường học tập miễn phí tốt nhất cho học sinh. Bạn có thể liên hệ trực tiếp qua email hbminh2508@gmail.com.',
        'Hệ thống SenExam được kiến tạo bởi developer **Hoàng Bình Minh** đến từ UET-VNU. ✨ Mọi thắc mắc hoặc góp ý, bạn cứ thoải mái gửi về hbminh2508@gmail.com nha!'
      ]
    },
    {
      // 3. Tính năng: Thi thử (Exams)
      keywords: ['thi', 'lam bai', 'kiem tra', 'de', 'test', 'vao thi', 'luyen', 'hsa', 'tsa', 'thptqg', 'kiem de', 'mock test', 'thi thu', 'de minh hoa', 'de chinh thuc', 'lam de'],
      responses: [
        'Để luyện đề, bạn hãy vào kho đề thi của tụi mình nhé! Có đầy đủ THPTQG, ĐGNL (HSA) và TSA luôn. 🚀 Link truy cập: https://www.senexam.me/exams',
        'Bạn muốn thử sức với các bài thi? 🌸 SenExam có sẵn hàng ngàn đề trắc nghiệm chấm điểm tự động. Bắt đầu làm bài tại đây: https://www.senexam.me/exams',
        'Tới giờ thực chiến rồi! Bạn bấm vào đường dẫn này để chọn đề thi phù hợp với lộ trình của mình nhé: https://www.senexam.me/exams ✨'
      ]
    },
    {
      // 4. Tính năng: Thư viện (Library)
      keywords: ['tai lieu', 'sach', 'thu vien', 'pdf', 'on tap', 'tai nguyen', 'ly thuyet', 'file', 'chuyen de', 'xin de cuong', 'bai tap', 'giao trinh', 'in an'],
      responses: [
        'SenExam có một **Thư Viện Số** cực kỳ đồ sộ. Bạn có thể tìm thấy rất nhiều file PDF, chuyên đề ôn thi phân loại khoa học ở đây nhé: https://www.senexam.me/library 📚',
        'Bạn đang tìm tài liệu ôn thi? 🌸 Khám phá ngay kho tàng kiến thức trực quan tại đây nha: https://www.senexam.me/library',
        'Tất tần tật sách, chuyên đề và tài liệu luyện thi đều nằm trong Thư viện số. Bạn truy cập link này để tải miễn phí nhé: https://www.senexam.me/library ✨'
      ]
    },
    {
      // 5. Tính năng: Cộng đồng (Forum)
      keywords: ['cong dong', 'forum', 'dien dan', 'hoi bai', 'thao luan', 'giup do', 'giai dap', 'group', 'tim ban', 'nhom hoc', 'giao luu'],
      responses: [
        'Có bài khó cần hỏi ư? 🚀 Bạn hãy tham gia Cộng đồng Thảo luận của SenExam để được các bạn khác và AI hỗ trợ giải đáp nhé: https://www.senexam.me/forum',
        'Đừng học một mình! 🌸 Bạn hãy vào Forum để giao lưu, hỏi đáp và trao đổi bài tập cùng mọi người nha: https://www.senexam.me/forum'
      ]
    },
    {
      // 6. Cố vấn: Học tập chung & Tâm lý
      keywords: ['kho qua', 'hoc dot', 'mat goc', 'lam sao', 'diem kem', 'meo', 'tips', 'lo trinh', 'cach hoc', 'luoi', 'stress', 'ap luc', 'chan', 'buon ngu', 'khong the tap trung', 'nan', 'tram cam'],
      responses: [
        'Đừng nản chí nhé! 🚀 Việc học đôi khi sẽ có áp lực. Hãy hít thở sâu, chia nhỏ bài học ra. Nếu bí quá, hãy lên Cộng đồng để hỏi nha: https://www.senexam.me/forum',
        'Cảm thấy mệt mỏi là bình thường mà! 📚 Bạn hãy nghỉ ngơi 15 phút, sau đó vào Thư viện số tìm các chuyên đề lấy gốc học từ từ lại nhé: https://www.senexam.me/library',
        'Để vượt qua giai đoạn mất gốc, đừng lao vào làm đề khó vội. ✨ Cứ nắm chắc SGK trước, rồi vào kho đề tìm các bài cơ bản làm quen nha: https://www.senexam.me/exams'
      ]
    },
    {
      // 7. Hỏi về các môn học cụ thể
      keywords: ['toan', 'ly', 'hoa', 'sinh', 'anh', 'van', 'su', 'dia', 'gduc', 'gdcd', 'khoi a', 'khoi b', 'khoi d', 'tieng anh'],
      responses: [
        'Về các môn học cụ thể, hệ thống đã phân loại rất rõ ràng. 📚 Bạn cần tìm lý thuyết thì vào Thư Viện (https://www.senexam.me/library), còn muốn luyện đề thực chiến thì vào Kho Thi (https://www.senexam.me/exams) nhé!',
        'SenExam có đầy đủ tài liệu và đề thi cho các môn Toán, Lý, Hóa, Sinh, Anh, Văn... 🌸 Cứ vào Thư Viện hoặc Kho đề thi, chọn đúng thư mục môn học là có hết đó!'
      ]
    },
    {
      // 8. Hỗ trợ Kỹ thuật & Tài khoản
      keywords: ['loi', 'bug', 'khong vao duoc', 'quen mat khau', 'dang nhap', 'dang ky', 'lag', 'cham', 'khong tai duoc', 'hong', 'fix'],
      responses: [
        'Nếu bạn gặp lỗi hệ thống, không tải được tài liệu hay vấn đề tài khoản, hãy báo ngay cho admin nhé! 🚀 Liên hệ qua email: hbminh2508@gmail.com để anh Bình Minh hỗ trợ xử lý kịp thời.',
        'Xin lỗi vì trải nghiệm chưa tốt! 🌸 Nếu web bị lỗi hoặc bạn không đăng nhập được, bạn thử tải lại trang (F5). Nếu vẫn không được, gửi email báo lỗi về hbminh2508@gmail.com nha!'
      ]
    },
    {
      // 9. Đặc quyền Giáo viên
      keywords: ['magic paste', 'cham bai', 'tao de', 'giao vien', 'cham diem', 'admin', 'upload', 'nhap de'],
      responses: [
        'Chào thầy/cô! 🌸 Sen Magic Paste là "trợ thủ" đắc lực dùng AI để tự động nhận diện và khớp đáp án cực kỳ nhanh, giúp tiết kiệm tối đa thời gian chấm bài ạ. ✨',
        'Dạ, tính năng Sen Magic Paste là đặc quyền dành cho Giáo viên, giúp thầy/cô lên đề và khớp đáp án tự động siêu tốc. Thầy/cô trải nghiệm ngay nhé! 🚀'
      ]
    },
    {
      // 10. Định hướng tương lai / Update
      keywords: ['tuong lai', 'sap toi', 'du dinh', 'ai cham', 'tu luan', 'essay', 'khoa hoc', 'masterclass', 'lo trinh ai', 'tinh nang moi'],
      responses: [
        'Sắp tới SenExam sẽ ra mắt AI tạo Lộ trình học tập cá nhân hóa và tự động chấm điểm Tự Luận (Essay) siêu tốc đó! 🚀 Cùng chờ đón nhé.',
        'Mục tiêu của tụi mình là trở thành Hệ sinh thái học thuật toàn diện. Sắp tới sẽ có các khóa Masterclass cùng giáo viên hàng đầu nha! ✨'
      ]
    },
    {
      // 11. Ngoài lề (Out of scope)
      keywords: ['code', 'lap trinh', 'chinh tri', 'game', 'choi', 'giai tri', 'tin tuc', 'phim', 'nhac', 'bai hat'],
      responses: [
        'Tiếc quá, nhiệm vụ chính của mình là hỗ trợ bạn học tập và ôn luyện trên SenExam nên mình không rành chủ đề này rồi. 📚 Bạn có muốn xem tài liệu ôn thi không?',
        'Mình chỉ là trợ lý học tập nên không trả lời được câu này nha. 🌸 Bạn có muốn mình dẫn bạn đi xem Thư viện tài liệu của web không?'
      ]
    },
    {
      // 12. Lịch sử, Phân tích điểm
      keywords: ['diem so', 'lich su', 'thanh tich', 'tien bo', 'phan tich', 'xem lai', 'xem dap an', 'loi sai'],
      responses: [
        'Hệ thống tự động chấm điểm ngay sau khi bạn nộp bài. 🌸 Lịch sử phân tích điểm số và đáp án chi tiết nằm ngay trên Dashboard để bạn xem lại chỗ sai đó!',
        'Bạn có thể xem lại toàn bộ lịch sử làm bài và phân tích năng lực ngay trên màn hình chính (Dashboard) nha! ✨'
      ]
    },
    {
      // 13. Lời khen / Cảm ơn
      keywords: ['cam on', 'ok', 'thank', 'duoc roi', 'hay', 'tuyet', 'dinh', 'gioi', 'tot lam', 'xuat sac'],
      responses: [
        'Không có gì nha! 🌸 Chúc bạn ôn tập thật tốt và đạt điểm cao nhé.',
        'Sen AI luôn ở đây hỗ trợ bạn. ✨ Nhớ chia sẻ SenExam cho bạn bè cùng học nha. Cố lên sĩ tử!'
      ]
    }
  ];

  let matchedIntent = null;
  let highestScore = 0;

  // Thuật toán chấm điểm thông minh:
  // - Điểm cơ bản = độ dài của keyword
  // - Cụm từ càng dài (nhiều khoảng trắng) trúng đích => Điểm càng cao rệt
  for (const intent of intents) {
    let score = 0;
    for (const keyword of intent.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      
      // Nếu user gõ chính xác toàn bộ từ khóa
      if (rawInput.includes(keyword) || normalizedInput.includes(normalizedKeyword)) {
        // Trọng số: Từ đơn = 2 điểm, Cụm 2 từ = 5 điểm, Cụm 3 từ = 10 điểm...
        const wordCount = keyword.split(' ').length;
        score += wordCount === 1 ? 2 : wordCount * 2.5; 
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      matchedIntent = intent;
    }
  }

  // Cần ít nhất 2 điểm (1 từ khóa trúng) để xác định ý định
  if (matchedIntent && highestScore >= 2) {
    const randomIndex = Math.floor(Math.random() * matchedIntent.responses.length);
    return matchedIntent.responses[randomIndex];
  }

  // Fallback mặc định khi AI không hiểu
  const fallbacks = [
    'Mình chưa hiểu rõ ý bạn lắm. Bạn đang muốn tìm Đề thi, Thư viện tài liệu hay cần Cố vấn học tập? 📚',
    'Câu này hơi khó với mình! Bạn thử hỏi về việc "tải tài liệu", "làm đề thi", "hỏi bài" hoặc hỏi về "tác giả" xem sao nhé. ✨',
    'Nhiệm vụ của mình là hướng dẫn sử dụng web và cố vấn học tập. 🌸 Bạn cần hỗ trợ tính năng nào của SenExam không?'
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// FORMATTER: In đậm chữ, tự động biến URL và Email thành link click được
const formatMessage = (text: string, role: 'user' | 'model') => {
  const parts = text.split('**');
  return parts.map((part, i) => {
    if (i % 2 === 1) return <strong key={i}>{part}</strong>;
    
    // Tách theo khoảng trắng để check URL và Email
    const words = part.split(/(\s+)/);
    return words.map((word, j) => {
      // Regex check URL (http/https)
      if (/^https?:\/\/[^\s]+/.test(word)) {
        return (
          <a key={j} href={word} target="_blank" rel="noopener noreferrer" className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}>
            {word}
          </a>
        );
      }
      // Regex check Email
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(word)) {
        return (
          <a key={j} href={`mailto:${word}`} className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'}`}>
            {word}
          </a>
        );
      }
      return <span key={j}>{word}</span>;
    });
  });
};

export default function ChatOffline({ userName, avoid, hidden }: { userName: string, avoid?: boolean, hidden?: boolean }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Chào bạn! 🌸 Mình là Sen AI - trợ lý và cố vấn học tập của SenExam. Bạn cần mình chỉ chỗ lấy đề thi, tài liệu hay muốn hỏi thông tin gì nào?' }
  ])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading])

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    
    const newHistory = [...chatMessages, { role: 'user' as const, text: userMessage }];
    setChatMessages(newHistory);
    setIsChatLoading(true);

    // Thời gian render response giả lập AI đang phân tích NLP
    setTimeout(() => {
      const aiResponseText = generateOfflineAIResponse(userMessage, userName);
      setChatMessages([...newHistory, { role: 'model', text: aiResponseText }]);
      setIsChatLoading(false);
    }, 700 + Math.random() * 500); 
  }

  if (hidden) return null;

  return (
    <div className={`fixed bottom-6 z-[100] flex flex-col items-end ${avoid ? 'right-6 lg:right-[28rem]' : 'right-6'}`}>
      {isChatOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[550px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Trợ lý Sen AI ✨</h3>
                <p className="text-[11px] text-blue-100 font-medium">NLP Engine Ngoại tuyến - Siêu mượt</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-transparent" ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-[14px] font-medium leading-relaxed shadow-sm 
                  ${msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  {formatMessage(msg.text, msg.role)}
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">Sen AI đang phân tích...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 relative">
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Hỏi Sen AI (tài liệu, thông tin, tác giả)..." 
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-4 pr-12 py-3 text-[14px] font-medium outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner placeholder:text-slate-400"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isChatLoading} 
                className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full transition-transform active:scale-95 shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.4)] text-white font-black transition-all duration-300 hover:scale-105 active:scale-95 
          ${isChatOpen 
            ? 'bg-slate-800 hover:bg-slate-700' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
          }`}
      >
        {isChatOpen ? <X className="w-6 h-6" /> : (
          <>
            <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
            Trợ lý Sen AI
          </>
        )}
      </button>
    </div>
  )
}