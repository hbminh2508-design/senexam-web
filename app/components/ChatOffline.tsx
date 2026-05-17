'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, X, Loader2 } from 'lucide-react'

// Hàm chuẩn hóa Tiếng Việt (chuyển có dấu thành không dấu, in thường)
// Giúp AI hiểu được cả khi học sinh gõ "de thi", "tai lieu"
const normalizeText = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

// 🤖 BỘ NÃO SEN AI OFFLINE - ĐÃ ĐƯỢC NÂNG CẤP
const generateOfflineAIResponse = (input: string, userName: string) => {
  const normalizedInput = normalizeText(input);
  const rawInput = input.toLowerCase();
  
  const intents = [
    {
      keywords: ['chao', 'hi', 'hello', 'alo', 'e'],
      responses: [
        `Chào ${userName || 'cậu'}! Mình là Sen AI - Trợ lý học tập miễn phí của SenExam. Mình giúp gì được cho cậu?`,
        `Hi ${userName || 'bạn'}! Sen AI đây. Bạn cần tìm đề thi hay tài liệu học tập nào không?`,
        'Chào bạn nha! Cần thi thử hay kiếm tài liệu ôn thi thì cứ réo mình.'
      ]
    },
    {
      keywords: ['thi', 'lam bai', 'kiem tra', 'de', 'test', 'vao thi', 'luyen de'],
      responses: [
        'Để luyện đề, bạn hãy bấm vào nút **"Vào kho đề thi"** màu xanh dương ở màn hình chính nhé! Tất cả đều hoàn toàn miễn phí.',
        'Kho đề thi của SenExam có đầy đủ THPTQG, ĐGNL (HSA) và TSA chờ bạn khám phá. Bấm "Vào kho đề" ở giao diện chính để thực chiến ngay!',
        'Hệ thống có hàng ngàn đề thi trắc nghiệm được chấm điểm tự động. Bạn vào phần Kho Đề để bắt đầu tự luyện nhé!'
      ]
    },
    {
      keywords: ['tai lieu', 'sach', 'thu vien', 'pdf', 'on tap', 'tai nguyen', 'ly thuyet'],
      responses: [
        'SenExam có một **Thư Viện Số** cực kỳ đồ sộ và miễn phí. Bạn cuộn xuống dưới cùng Dashboard để tải tài liệu và sách nhé!',
        'Bạn có thể tìm PDF và chuyên đề học tập ở mục **"Thư Viện Số Trực Tuyến"**. Giao diện giống hệt thư mục máy tính, tải về thoải mái không giới hạn nha.',
        'Toàn bộ tài liệu ôn thi các môn đều nằm ở biểu tượng Thư mục màu xanh dương cuối màn hình. Vào tải ngay đi, xịn lắm đó!'
      ]
    },
    {
      keywords: ['cong dong', 'forum', 'dien dan', 'hoi bai', 'thao luan', 'giup do'],
      responses: [
        'Bí bài ư? Hãy truy cập **Thảo luận Forum** (nút màu trắng góc phải phía trên) để hỏi bài. Các bạn học sinh khác và AI sẽ vào hỗ trợ bạn ngay!',
        'SenExam là một cộng đồng tự học siêu xịn. Bạn bấm vào nút Forum trên thanh điều hướng để giao lưu và hỏi đáp bài tập miễn phí nhé.'
      ]
    },
    {
      keywords: ['diem', 'lich su', 'ket qua', 'thanh tich', 'phan tich'],
      responses: [
        'Lịch sử điểm số và phân tích bài làm nằm trong bảng **"Lịch sử phân tích điểm"** trên màn hình chính. Bấm vào biểu tượng con mắt để xem AI phân tích chỗ bạn làm sai nhé.',
        'Bảng điểm và tiến độ học tập hiển thị ngay trên Dashboard. Hãy theo dõi thường xuyên để xem mình tiến bộ thế nào nha!'
      ]
    },
    {
      keywords: ['tuong lai', 'sap toi', 'du dinh', 'dinh huong', 'update', 'moi', 'lo trinh'],
      responses: [
        'Mục tiêu của SenExam là trở thành Hệ sinh thái Học thuật tự do và MIỄN PHÍ 100%. Sắp tới mình sẽ tự động tạo Lộ trình học tập cá nhân hóa cho bạn luôn!',
        'Tương lai tụi mình sẽ ra mắt tính năng AI tự động chấm thi Tự Luận (Essay) và nhắc nhở học tập mỗi ngày. Tất cả vì trải nghiệm của học sinh!',
        'Chúng mình đang phát triển thêm các tính năng AI siêu việt để phân tích lỗ hổng kiến thức của bạn. Bạn sẽ không cần tốn tiền đi học thêm đâu!'
      ]
    },
    {
      keywords: ['ban la ai', 'sen ai la gi', 'ai tao ra'],
      responses: [
        'Mình là Sen AI, thuật toán lõi được sinh ra để hỗ trợ các sĩ tử trên SenExam. Mình chạy offline trên trình duyệt của bạn nên siêu nhanh và không thu thập dữ liệu cá nhân!',
        'Mình là trợ lý ảo phi lợi nhuận của nền tảng SenExam. Trách nhiệm của mình là giúp bạn tự học, tìm tài liệu và chinh phục điểm cao!'
      ]
    },
    {
      keywords: ['cam on', 'ok', 'thank', 'duoc roi', 'hay', 'tuyet'],
      responses: [
        'Không có gì nha! Chúc bạn học tốt và đạt kết quả thật cao!',
        'Rất vui vì đã giúp được bạn. Cần gì cứ mở Sen AI lên nhé, mình luôn trực 24/7!',
        'Cố lên sĩ tử! Sen AI và cộng đồng luôn ở phía sau cổ vũ bạn.'
      ]
    }
  ];

  let matchedIntent = null;
  let highestScore = 0;

  for (const intent of intents) {
    let score = 0;
    for (const keyword of intent.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      // Kiểm tra cả text chưa chuẩn hóa và đã chuẩn hóa
      if (rawInput.includes(keyword) || normalizedInput.includes(normalizedKeyword)) {
        // Tăng điểm nhiều hơn cho các từ khóa dài (có khoảng trắng)
        score += keyword.includes(' ') ? 2 : 1;
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

  const fallbacks = [
    'Mình chưa hiểu rõ ý bạn lắm. Bạn đang muốn tìm Đề thi, Thư viện tài liệu hay hỏi cách xem Điểm số?',
    'Chà, câu này hơi mới với Sen AI. Bạn gõ thử các từ khóa như "đề thi", "tài liệu" hoặc "hỏi bài" xem sao nhé!',
    'Mạng lưới nơ-ron của mình đang được cập nhật thêm. Hiện tại bạn cứ hỏi mình về cách dùng web, làm bài thi hoặc tải tài liệu nha. Tất cả đều miễn phí!'
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

export default function ChatOffline({ userName }: { userName: string }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Chào bạn! Mình là Sen AI - trợ lý học tập miễn phí của SenExam. Bạn cần mình chỉ chỗ lấy đề thi hay tải tài liệu không?' }
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

    setTimeout(() => {
      const aiResponseText = generateOfflineAIResponse(userMessage, userName);
      setChatMessages([...newHistory, { role: 'model', text: aiResponseText }]);
      setIsChatLoading(false);
    }, 800 + Math.random() * 500); // Tinh chỉnh tốc độ phản hồi nhanh hơn một chút
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isChatOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Trợ lý Sen AI</h3>
                <p className="text-[10px] text-blue-100 font-medium">Hoạt động ngoại tuyến - Miễn phí 100%</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50" ref={chatScrollRef}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                  {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">Sen AI đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 relative">
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Hỏi Sen AI (vd: tìm đề thi, tài liệu)..." 
                className="flex-1 bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-full pl-4 pr-12 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
              />
              <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-full transition-transform active:scale-95 shadow-md">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.4)] text-white font-black transition-all duration-300 hover:scale-105 active:scale-95 ${isChatOpen ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}
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