import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Kiểm tra API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên Vercel' }, { status: 500 });
    }

    // 2. Khởi tạo SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Gọi chính xác Model (Sử dụng 1.5 Pro để ổn định tuyệt đối và thông minh nhất)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

    // 4. Lấy dữ liệu
    const { message, history } = await req.json();

    const systemInstruction = "Bạn là SenAI, một trợ lý học tập thân thiện, thông minh của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi học thuật của học sinh một cách ngắn gọn, dễ hiểu và truyền cảm hứng. Lưu ý: Không sử dụng Markdown in đậm quá nhiều.";
    
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện:\n${JSON.stringify(history || [])}\n\nCâu hỏi: ${message}`;

    // 5. Gọi AI
    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    
    return NextResponse.json(
      { error: error.message || 'Đã có lỗi xảy ra khi xử lý AI' }, 
      { status: error.status || 500 }
    );
  }
}