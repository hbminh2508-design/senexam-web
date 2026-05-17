'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, X, Loader2 } from 'lucide-react'

// 🤖 BỘ NÃO SEN AI OFFLINE
const generateOfflineAIResponse = (input: string, userName: string) => {
  const text = input.toLowerCase();
  
  const intents = [
    {
      keywords: ['chào', 'hi ', 'hello', 'alo', 'ê '],
      responses: [
        `Chào ${userName || 'bạn'}! Mình là Sen AI - Trợ lý nội bộ của SenExam. Mình giúp gì được cho bạn?`,
        `Hi ${userName || 'bạn'}! Sen AI đây. Bạn cần hỗ trợ tính năng gì trên web không?`,
        'Chào bạn nha! Cần thi thử hay tìm tài liệu thì cứ hỏi mình.'
      ]
    },
    {
      keywords: ['thi', 'làm bài', 'kiểm tra', 'đề', 'test', 'vào thi'],
      responses: [
        'Để bắt đầu thi, bạn hãy bấm vào nút **"Vào kho đề thi"** màu xanh dương ngay giữa màn hình chính nhé!',
        'Bạn muốn luyện đề đúng không? Kho đề thi của SenExam có đầy đủ THPTQG, ĐGNL (HSA) và TSA. Bấm "Vào kho đề" ở giao diện chính để xem nhé.',
        'Nếu bạn có mã đề nội bộ giáo viên cấp, hãy bấm vào nút **"Đề thi riêng"** cạnh kho đề để nhập mã nhé.'
      ]
    },
    {
      keywords: ['tài liệu', 'sách', 'thư viện', 'pdf', 'ôn tập', 'tài nguyên'],
      responses: [
        'SenExam có một **Thư Viện Số** cực kỳ đồ sộ nằm ngay phía dưới trang Dashboard. Bạn cuộn xuống dưới cùng để vào tải tài liệu và sách nhé!',
        'Bạn có thể tìm PDF và chuyên đề học tập ở mục **"Thư Viện Số Trực Tuyến"** nha. Giao diện giống hệt thư mục máy tính rất dễ dùng.',
        'Kho tài liệu được phân chia theo từng môn học trong Thư Viện Số. Bạn lướt xuống cuối màn hình sẽ thấy biểu tượng Thư mục màu xanh dương nhé.'
      ]
    },
    {
      keywords: ['cộng đồng', 'forum', 'diễn đàn', 'hỏi bài', 'thảo luận'],
      responses: [
        'Bạn có bài khó cần hỏi? Hãy truy cập **Thảo luận Forum** (nút màu trắng góc phải phía trên) để giao lưu cùng mọi người nhé!',
        'Cộng đồng SenExam luôn sẵn sàng hỗ trợ. Bạn bấm vào nút Forum trên thanh điều hướng để tham gia thảo luận nhé.'
      ]
    },
    {
      keywords: ['điểm', 'lịch sử', 'kết quả', 'thành tích'],
      responses: [
        'Lịch sử điểm số và phân tích bài làm của bạn nằm ngay trong bảng **"Lịch sử phân tích điểm"** trên màn hình chính. Bạn có thể bấm nút con mắt để xem lại bài làm chi tiết.',
        'Bảng điểm cao nhất và các lần thi gần đây hiển thị ngay trên Dashboard đó. Cố gắng phá kỷ lục của chính mình nhé!'
      ]
    },
    {
      keywords: ['tương lai', 'sắp tới', 'dự định', 'định hướng', 'update', 'mới'],
      responses: [
        'Trong tương lai, SenExam sẽ cập nhật hệ thống tạo Lộ trình học tập bằng AI, các khóa Masterclass, và tự động chấm điểm bài tự luận (Essay) siêu việt!',
        'Dự định sắp tới của SenExam là biến thành một Hệ sinh thái Học thuật toàn diện, có giáo viên hỗ trợ 1-1 và AI tạo lộ trình cá nhân hóa.',
        'Chúng mình sắp ra mắt tính năng chấm thi Tự Luận bằng AI và mở rộng tính năng Sen Magic Paste cho giáo viên đấy!'
      ]
    },
    {
      keywords: ['admin', 'quản trị', 'đăng đề', 'tạo đề', 'giáo viên'],
      responses: [
        'Trạm Admin là nơi dành riêng cho Quản trị viên và Cộng tác viên (Collab) để đăng đề, quản lý tài liệu và duyệt điểm học sinh.',
        'Nếu bạn là Collab/Admin, bạn sẽ thấy nút "Trạm Admin" màu đỏ cam ở góc trên cùng. Trong đó có tính năng Sen Magic Paste cực đỉnh để tự chia đáp án.'
      ]
    },
    {
      keywords: ['bạn là ai', 'sen ai là gì', 'ai tạo ra'],
      responses: [
        'Mình là Sen AI, một thuật toán nội bộ được thiết kế đặc biệt cho nền tảng SenExam. Mình hoạt động offline để đảm bảo tốc độ phản hồi nhanh nhất cho bạn!',
        'Mình là trợ lý ảo của SenExam! Mình được tạo ra để chỉ đường, hướng dẫn tính năng và làm bạn đồng hành cùng các sĩ tử.'
      ]
    },
    {
      keywords: ['cảm ơn', 'ok', 'thank', 'được rồi'],
      responses: [
        'Không có gì nha! Chúc bạn học tốt và đạt kết quả cao!',
        'Rất vui vì đã giúp được bạn. Cần gì cứ réo Sen AI nhé!',
        'Cố lên sĩ tử! Sen AI luôn ở đây hỗ trợ bạn.'
      ]
    }
  ];

  let matchedIntent = null;
  let highestMatchCount = 0;

  for (const intent of intents) {
    let matchCount = 0;
    for (const keyword of intent.keywords) {
      if (text.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      matchedIntent = intent;
    }
  }

  if (matchedIntent) {
    const randomIndex = Math.floor(Math.random() * matchedIntent.responses.length);
    return matchedIntent.responses[randomIndex];
  }

  const fallbacks = [
    'Mình chưa hiểu rõ ý bạn lắm. Bạn đang muốn tìm Đề thi, Tài liệu hay hỏi về tính năng nào?',
    'Câu này hơi khó! Bạn có thể nói rõ hơn bạn muốn tìm Kho đề thi, Thư viện hay Forum không?',
    'Sen AI đang học hỏi thêm mỗi ngày. Tạm thời bạn có thể hỏi mình về cách Làm bài thi, Tải tài liệu, hoặc xem Lịch sử điểm nhé.'
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

export default function ChatOffline({ userName }: { userName: string }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'Chào bạn! Mình là Sen AI - trợ lý ảo nội bộ của hệ thống SenExam. Bạn cần mình hướng dẫn tính năng nào không?' }
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
    }, 800 + Math.random() * 700); 
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
                <p className="text-[10px] text-blue-100 font-medium">Hoạt động ngoại tuyến cực nhanh</p>
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
                  <span className="text-xs text-slate-500 font-bold">Sen AI đang xử lý...</span>
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
                placeholder="Hỏi Sen AI tính năng web..." 
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