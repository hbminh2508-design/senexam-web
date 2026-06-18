import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Kiểm tra cấu hình API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    // 2. Khởi tạo SDK kết nối
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. NÂNG CẤP LÊN THẾ HỆ MODEL MỚI (Khắc phục lỗi 404 do Gemini 1.5 bị khai tử)
    // Lõi gemini-3.5-flash đảm bảo tốc độ phản hồi tối đa
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // 4. Lấy dữ liệu gửi lên từ Frontend (ChatOffline.tsx)
    const { message, history } = await req.json();

    // Định hình Persona của SenAI
    const systemInstruction = "Bạn là SenAI, một trợ lý học tập thân thiện, thông minh của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi học thuật của học sinh một cách ngắn gọn, dễ hiểu và truyền cảm hứng. Lưu ý: Không lạm dụng Markdown in đậm quá mức.";
    
    // Ghép ngữ cảnh để AI hiểu mạch trò chuyện
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện:\n${JSON.stringify(history || [])}\n\nCâu hỏi: ${message}`;

    // 5. Gọi AI sinh phản hồi
    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    // Trả về trường text theo đúng chuẩn frontend đang gọi
    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error('Chi tiết lỗi hệ thống Gemini API:', error);
    
    // Trả mã lỗi cụ thể về Frontend để kích hoạt cơ chế Offline Fallback
    return NextResponse.json(
      { error: error.message || 'Đã có lỗi xảy ra khi xử lý AI' }, 
      { status: error.status || 500 }
    );
  }
}