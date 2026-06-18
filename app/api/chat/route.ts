import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Kiểm tra API Key (Lỗi 403 thường xuất phát từ việc biến này bị undefined trên Vercel)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    // 2. Khởi tạo SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Sử dụng mô hình Flash Lite siêu tốc theo thiết lập của bạn
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    // 4. Phân tích dữ liệu từ Client gửi lên (Hứng thêm images và context từ giao diện)
    const { message, history, context, images } = await req.json();

    // 5. Định hình tính cách của SenAI (Ưu tiên context từ frontend gửi lên nếu có)
    const systemInstruction = context || "Bạn là SenAI, một trợ lý học tập thân thiện, thông minh của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi học thuật của học sinh một cách ngắn gọn, dễ hiểu và truyền cảm hứng. Lưu ý: Không sử dụng Markdown in đậm quá nhiều.";
    
    // Ghép lịch sử để AI hiểu ngữ cảnh cuộc trò chuyện
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện trước đó:\n${JSON.stringify(history || [])}\n\nCâu hỏi mới: ${message}`;

    // 6. Xử lý gửi nội dung (Hỗ trợ cả Text và Hình ảnh)
    let result;
    if (images && images.length > 0) {
      // Nếu có ảnh, gói dữ liệu thành mảng (parts) theo chuẩn Multimodal của Gemini
      const parts: any[] = [{ text: finalPrompt }];
      
      images.forEach((img: any) => {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType
          }
        });
      });
      
      result = await model.generateContent(parts);
    } else {
      // Nếu chỉ có văn bản thông thường
      result = await model.generateContent(finalPrompt);
    }

    // 7. Trích xuất và trả về kết quả
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