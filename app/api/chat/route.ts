import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Khởi tạo SDK với API Key từ môi trường
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // Sử dụng model Gemini 1.5 Flash cho các tác vụ hỏi đáp nhanh
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Khởi tạo prompt hệ thống định hình nhân vật
    const systemInstruction = "Bạn là Sen AI, một trợ lý học tập thân thiện, thông minh của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi học thuật của học sinh một cách ngắn gọn, dễ hiểu và truyền cảm hứng.";
    
    const finalPrompt = `${systemInstruction}\n\nCâu hỏi của học sinh: ${message}`;

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: 'Đã có lỗi xảy ra khi xử lý AI' }, { status: 500 });
  }
}