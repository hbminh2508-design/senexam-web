import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    // Hứng dữ liệu từ giao diện gửi lên
    const { message, history, context, images } = await req.json();

    // 🌟 LẤY DỮ LIỆU ĐIỂM CHUẨN TỪ SUPABASE (THAY VÌ ĐỌC FILE)
    let universityDataText = "";
    try {
      const { data: dbData } = await supabase
        .from('university_scores')
        .select('data')
        .eq('id', 1)
        .single();
        
      if (dbData && dbData.data && dbData.data.length > 0) {
        universityDataText = JSON.stringify(dbData.data);
      }
    } catch (dbErr) {
      console.error("Lỗi hệ thống khi đọc dữ liệu điểm chuẩn từ DB:", dbErr);
    }

    // 🌟 ĐỊNH HÌNH TÍNH CÁCH VÀ NẠP KIẾN THỨC CHO AI
    const baseInstruction = context || "Bạn là SenAI, một trợ lý học thuật thông minh, thân thiện của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi ngắn gọn, dễ hiểu và truyền cảm hứng.";
    
    const systemInstruction = `
${baseInstruction}

QUY TẮC HIỂN THỊ TOÁN HỌC & ĐIỂM SỐ:
- Phải sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân ở mọi điểm số hoặc bài toán (Ví dụ: 27,85 hoặc 9,8 . 10).
- Khi trả về công thức Toán học phức tạp, luôn bọc trong ký hiệu $ (inline) hoặc $$ (block) để hệ thống hiển thị TeX/KaTeX mượt mà.

KHO DỮ LIỆU ĐIỂM CHUẨN ĐẠI HỌC VÀ NGÀNH HỌC CHÍNH XÁC CỦA HỆ THỐNG:
${universityDataText ? universityDataText : "Chưa có dữ liệu điểm chuẩn. Hãy thông báo cho học sinh là hệ thống đang cập nhật."}

Nhiệm vụ tư vấn trường/ngành:
- Khi học sinh hỏi về cơ hội trúng tuyển hoặc xin gợi ý trường/ngành, hãy đối chiếu thật NGHIÊM NGẶT với KHO DỮ LIỆU JSON ở trên.
- Tuyệt đối không tự bịa ra điểm chuẩn hoặc tên ngành không có trong danh sách. 
- Nếu học sinh hỏi về trường tính theo thang 100 điểm, hãy tự động quy đổi điểm của học sinh ra thang 100 hoặc quy chuẩn điểm của trường về thang 30 để so sánh logic.
`;

    // Ghép lịch sử trò chuyện và câu lệnh
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện trước đó:\n${JSON.stringify(history || [])}\n\nCâu hỏi mới: ${message}`;

    // Gọi AI (Hỗ trợ Multimodal: Đọc Ảnh, PDF, Text)
    let result;
    if (images && images.length > 0) {
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
      result = await model.generateContent(finalPrompt);
    }

    return NextResponse.json({ text: result.response.text() });

  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    return NextResponse.json(
      { error: error.message || 'Đã có lỗi xảy ra khi xử lý luồng tư duy AI' }, 
      { status: error.status || 500 }
    );
  }
}