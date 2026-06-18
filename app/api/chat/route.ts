import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Kiểm tra API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống' }, { status: 500 });
    }

    // 2. Khởi tạo SDK kết nối
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Lấy dữ liệu gửi lên từ Frontend
    const { message, history } = await req.json();

    // Định hình Persona của SenAI
    const systemInstruction = "Bạn là SenAI, một trợ lý học tập thân thiện, thông minh của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi học thuật của học sinh một cách ngắn gọn, dễ hiểu và truyền cảm hứng. Lưu ý: Không lạm dụng Markdown in đậm quá mức.";
    
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện:\n${JSON.stringify(history || [])}\n\nCâu hỏi: ${message}`;

    let responseText = '';

    try {
      // THỬ NGHIỆM 1: Dùng Model chính (Mạnh & Nhanh nhất)
      const primaryModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      const result = await primaryModel.generateContent(finalPrompt);
      responseText = result.response.text();
      
    } catch (primaryError: any) {
      // NẾU GẶP LỖI 503 (QUÁ TẢI) -> TỰ ĐỘNG KÍCH HOẠT FALLBACK
      if (primaryError.status === 503) {
        console.warn('Model chính đang quá tải (503), tự động chuyển sang luồng AI dự phòng...');
        
        // THỬ NGHIỆM 2: Dùng Model dự phòng có độ ổn định cực cao
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        const fallbackResult = await fallbackModel.generateContent(finalPrompt);
        responseText = fallbackResult.response.text();
      } else {
        // Ném lỗi ra ngoài nếu không phải là lỗi quá tải mạng
        throw primaryError;
      }
    }

    // Trả về trường text theo đúng chuẩn frontend
    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error('Chi tiết lỗi hệ thống Gemini API:', error);
    
    // Trả mã lỗi cụ thể về Frontend để kích hoạt cơ chế Offline Mode
    return NextResponse.json(
      { error: error.message || 'Đã có lỗi xảy ra khi xử lý AI' }, 
      { status: error.status || 500 }
    );
  }
}