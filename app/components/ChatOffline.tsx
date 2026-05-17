'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, X, Loader2 } from 'lucide-react'

// Hàm chuẩn hóa Tiếng Việt (Xóa dấu, đưa về chữ thường)
const normalizeText = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
};

// 🤖 BỘ NÃO SEN AI OFFLINE - ĐÃ TRAIN MẠNH MẼ
const generateOfflineAIResponse = (input: string, userName: string) => {
  const normalizedInput = normalizeText(input);
  const rawInput = input.toLowerCase();
  
  const intents = [
    {
      // Chào hỏi chung
      keywords: ['chao', 'hi ', 'hello', 'alo', 'ê', 'hey'],
      responses: [
        `Chào ${userName || 'bạn'}! 🌸 Mình là Sen AI - Trợ lý học tập của SenExam. Mình giúp gì được cho bạn?`,
        `Hi ${userName || 'bạn'}! ✨ Sen AI đây. Bạn cần tìm đề thi, tài liệu hay cần tư vấn học tập không?`,
      ]
    },
    {
      // Tính năng: Thi thử (Exams)
      keywords: ['thi', 'lam bai', 'kiem tra', 'de', 'test', 'vao thi', 'luyen', 'hsa', 'tsa', 'thptqg', 'kiem de'],
      responses: [
        'Để luyện đề, bạn hãy vào kho đề thi của tụi mình nhé! Có đầy đủ THPTQG, ĐGNL (HSA) và TSA luôn. 🚀 Link truy cập: https://www.senexam.me/exams',
        'Bạn muốn thử sức với các bài thi? 🌸 SenExam có sẵn hàng ngàn đề trắc nghiệm chấm điểm tự động. Bắt đầu làm bài tại đây: https://www.senexam.me/exams',
        'Tới giờ thực chiến rồi! Bạn bấm vào đường dẫn này để chọn đề thi phù hợp với lộ trình của mình nhé: https://www.senexam.me/exams ✨'
      ]
    },
    {
      // Tính năng: Thư viện (Library)
      keywords: ['tai lieu', 'sach', 'thu vien', 'pdf', 'on tap', 'tai nguyen', 'ly thuyet', 'file', 'chuyen de', 'xin de cuong'],
      responses: [
        'SenExam có một **Thư Viện Số** cực kỳ đồ sộ. Bạn có thể tìm thấy rất nhiều file PDF, chuyên đề ôn thi phân loại khoa học ở đây nhé: https://www.senexam.me/library 📚',
        'Bạn đang tìm tài liệu ôn thi? 🌸 Khám phá ngay kho tàng kiến thức trực quan tại đây nha: https://www.senexam.me/library',
        'Tất tần tật sách, chuyên đề và tài liệu luyện thi đều nằm trong Thư viện số. Bạn truy cập link này để tải miễn phí nhé: https://www.senexam.me/library ✨'
      ]
    },
    {
      // Tính năng: Cộng đồng (Forum)
      keywords: ['cong dong', 'forum', 'dien dan', 'hoi bai', 'thao luan', 'giup do', 'giai dap', 'group'],
      responses: [
        'Có bài khó cần hỏi ư? 🚀 Bạn hãy tham gia Cộng đồng Thảo luận của SenExam để được các bạn khác và AI hỗ trợ giải đáp nhé: https://www.senexam.me/forum',
        'Đừng học một mình! 🌸 Bạn hãy vào Forum để giao lưu, hỏi đáp và trao đổi bài tập cùng mọi người nha: https://www.senexam.me/forum'
      ]
    },
    {
      // Kỹ năng Cố vấn: Học tập, xin tips
      keywords: ['kho qua', 'hoc dot', 'mat goc', 'lam sao', 'diem kem', 'meo', 'tips', 'lo trinh', 'cach hoc', 'luoi'],
      responses: [
        'Đừng nản chí nhé! 🚀 Trước tiên hãy nắm thật chắc kiến thức cơ bản trong SGK. Nếu có bài khó, hãy lên Cộng đồng để hỏi nha: https://www.senexam.me/forum',
        'Học tập là một quá trình kiên trì. 📚 Bạn hãy chia nhỏ mục tiêu ra, và vào Thư viện số tìm các chuyên đề lấy gốc trước nhé: https://www.senexam.me/library',
        'Để cải thiện điểm số, hãy luyện đề thường xuyên để quen áp lực. ✨ Thử sức ngay với các đề cơ bản trên hệ thống nha: https://www.senexam.me/exams'
      ]
    },
    {
      // Đặc quyền Giáo viên (Magic Paste, Chấm điểm)
      keywords: ['magic paste', 'cham bai', 'tao de', 'giao vien', 'cham diem', 'dap an', 'admin'],
      responses: [
        'Chào thầy/cô! 🌸 Sen Magic Paste là "trợ thủ" đắc lực dùng AI để tự động nhận diện và khớp đáp án cực kỳ nhanh, giúp tiết kiệm tối đa thời gian chấm bài ạ. ✨',
        'Dạ, tính năng Sen Magic Paste là đặc quyền dành cho Giáo viên, giúp thầy/cô lên đề và khớp đáp án tự động siêu tốc. Thầy/cô trải nghiệm ngay nhé! 🚀'
      ]
    },
    {
      // Định hướng tương lai / Tính năng chưa có
      keywords: ['tuong lai', 'sap toi', 'du dinh', 'ai cham', 'tu luan', 'essay', 'khoa hoc', 'masterclass'],
      responses: [
        'Sắp tới SenExam sẽ ra mắt AI tạo Lộ trình học tập cá nhân hóa và tự động chấm điểm Tự Luận (Essay) siêu tốc đó! 🚀 Cùng chờ đón nhé.',
        'Mục tiêu của tụi mình là trở thành Hệ sinh thái học thuật toàn diện. Sắp tới sẽ có các khóa Masterclass cùng giáo viên hàng đầu nha! ✨'
      ]
    },
    {
      // Ngoài lề (Out of scope)
      keywords: ['code', 'lap trinh', 'chinh tri', 'game', 'choi', 'giai tri', 'tin tuc'],
      responses: [
        'Tiếc quá, nhiệm vụ chính của mình là hỗ trợ bạn học tập và ôn luyện trên SenExam nên mình không rành chủ đề này rồi. 📚 Bạn có muốn xem tài liệu ôn thi không?',
        'Mình chỉ là trợ lý học tập nên không trả lời được câu này nha. 🌸 Bạn có muốn mình dẫn bạn đi xem Thư viện tài liệu của web không?'
      ]
    },
    {
      // Lịch sử, Phân tích điểm
      keywords: ['diem so', 'lich su', 'thanh tich', 'tien bo', 'phan tich'],
      responses: [
        'Hệ thống tự động chấm điểm ngay sau khi bạn nộp bài. 🌸 Lịch sử phân tích điểm số chi tiết nằm ngay trên Dashboard để bạn theo dõi sự tiến bộ đó!',
        'Bạn có thể xem lại toàn bộ lịch sử làm bài và phân tích năng lực ngay trên màn hình chính (Dashboard) nha! ✨'
      ]
    },
    {
      // Cảm ơn
      keywords: ['cam on', 'ok', 'thank', 'duoc roi', 'hay', 'tuyet'],
      responses: [
        'Không có gì nha! 🌸 Chúc bạn ôn tập thật tốt và đạt điểm cao nhé.',
        'Sen AI luôn ở đây hỗ trợ bạn. ✨ Cố lên sĩ tử!'
      ]
    }
  ];

  let matchedIntent = null;
  let highestScore = 0;

  for (const intent of intents) {
    let score = 0;
    for (const keyword of intent.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      // Kiểm tra bao hàm, nếu từ khóa có khoảng trắng (cụm từ) thì cộng điểm cao hơn
      if (rawInput.includes(keyword) || normalizedInput.includes(normalizedKeyword)) {
        score += keyword.includes(' ') ? 3 : 1; 
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      matchedIntent = intent;
    }
  }

  if (matchedIntent) {
    const randomIndex = Math.floor(Math.random() * matchedIntent.responses.length);
    return matchedIntent.responses[randomIndex];
  }

  // Fallback mặc định
  const fallbacks = [
    'Mình chưa hiểu rõ ý bạn lắm. Bạn đang muốn tìm Đề thi, Thư viện tài liệu hay cần Cố vấn học tập? 📚',
    'Câu này hơi khó với mình! Bạn thử hỏi về việc "tải tài liệu", "làm đề thi" hoặc "hỏi bài" xem sao nhé. ✨',
    'Nhiệm vụ của mình là hướng dẫn sử dụng web và cố vấn học tập. 🌸 Bạn cần hỗ trợ tính năng nào của SenExam không?'
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// FORMATTER: Giúp in đậm chữ và tự động biến các Link thành thẻ <a> click được
const formatMessage = (text: string, role: 'user' | 'model') => {
  const parts = text.split('**');
  return parts.map((part, i) => {
    // Xử lý in đậm
    if (i % 2 === 1) return <strong key={i}>{part}</strong>;
    
    // Xử lý link URL trong đoạn text bình thường
    const words = part.split(/(https?:\/\/[^\s]+)/g);
    return words.map((word, j) => {
      if (word.match(/^https?:\/\//)) {
        return (
          <a 
            key={j} 
            href={word} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`font-semibold underline underline-offset-2 transition-colors ${role === 'user' ? 'text-white hover:text-blue-200' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'}`}
          >
            {word}
          </a>
        );
      }
      return <span key={j}>{word}</span>;
    });
  });
};


export default function ChatOffline({ userName }: { userName: string }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Chào bạn! 🌸 Mình là Sen AI - trợ lý và cố vấn học tập của SenExam. Bạn cần mình chỉ chỗ lấy đề thi hay tài liệu không?' }
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

    // Giả lập thời gian suy nghĩ của AI (cảm giác chân thật hơn)
    setTimeout(() => {
      const aiResponseText = generateOfflineAIResponse(userMessage, userName);
      setChatMessages([...newHistory, { role: 'model', text: aiResponseText }]);
      setIsChatLoading(false);
    }, 600 + Math.random() * 400); 
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isChatOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[520px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Trợ lý Sen AI ✨</h3>
                <p className="text-[11px] text-blue-100 font-medium">Hoạt động ngoại tuyến cực nhanh</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50" ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[14px] font-medium leading-relaxed shadow-sm 
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
                  <span className="text-xs text-slate-500 font-bold">Sen AI đang gõ...</span>
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
                placeholder="Hỏi Sen AI (tài liệu, đề thi, xin tips)..." 
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-4 pr-12 py-3 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner placeholder:text-slate-400"
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