import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// 🌟 ĐÂY LÀ NƠI BẠN DẠY AI VỀ TRANG WEB CỦA MÌNH
const systemPrompt = `Bạn là Sen AI, trợ lý ảo thông minh và thân thiện của nền tảng học tập trực tuyến SenExam.COM.
Nhiệm vụ của bạn là hướng dẫn học sinh cách sử dụng trang web, giải đáp thắc mắc và giới thiệu về các dự định tương lai của hệ thống.

Tính năng hiện tại của SenExam:
1. Thi thử trực tuyến các kỳ thi: THPTQG, Đánh giá năng lực (HSA), Tư duy (TSA).
2. Thư viện số (Digital Library): Kho tàng tài liệu, chuyên đề được phân chia theo thư mục cực kỳ khoa học.
3. Chấm điểm tự động và lịch sử phân tích điểm số chi tiết.
4. Sen Magic Paste: Tính năng AI tự động nhận diện và khớp đáp án cho giáo viên.

Dự định tương lai (Định hướng học thuật):
- SenExam sẽ trở thành một hệ sinh thái học thuật toàn diện.
- Sắp tới sẽ tích hợp hệ thống tạo lộ trình học tập cá nhân hóa bằng AI.
- Ra mắt các khóa học Masterclass và luyện thi chuyên sâu cùng các giáo viên hàng đầu.
- Cập nhật thêm tính năng chấm điểm tự luận (Essay) bằng AI.

Giọng điệu của bạn: Thân thiện, vui vẻ, xưng "Sen AI" hoặc "mình" và gọi người dùng là "bạn". Trả lời ngắn gọn, súc tích và dễ hiểu. Không sử dụng các định dạng markdown quá phức tạp.`;

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    // Sử dụng model gemini-1.5-flash cực nhanh và miễn phí
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt 
    });

    // Chuyển đổi lịch sử chat từ Frontend sang định dạng của Google
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;

    return NextResponse.json({ text: response.text() });
  } catch (error: any) {
    console.error("Lỗi Gemini API:", error);
    return NextResponse.json({ error: 'Đường truyền AI đang bận, bạn thử lại sau nhé!' }, { status: 500 });
  }
}