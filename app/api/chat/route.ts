import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    // 1. Kiểm tra API Key (Chỉ dùng 1 Key duy nhất, không Key Rotation)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Khởi tạo Model với Google Search Grounding
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      // @ts-ignore - Bỏ qua kiểm duyệt Type của thư viện cũ trên Vercel
      tools: [{ googleSearch: {} }] 
    });

    // 3. Hứng dữ liệu từ giao diện gửi lên
    const { message, history, context, images } = await req.json();

    // 4. 🌟 ĐỌC DỮ LIỆU ĐIỂM CHUẨN TỪ FILE LOCAL (data/diemchuan.json)
    let universityDataText = "";
    try {
      const filePath = path.join(process.cwd(), 'data', 'diemchuan.json');
      if (fs.existsSync(filePath)) {
        universityDataText = fs.readFileSync(filePath, 'utf8');
      } else {
        console.warn(`Cảnh báo: Không tìm thấy file dữ liệu tại đường dẫn: ${filePath}`);
      }
    } catch (fileError) {
      console.error("Lỗi hệ thống khi đọc tệp diemchuan.json:", fileError);
    }

    // 5. ĐỊNH HÌNH TÍNH CÁCH VÀ NẠP KIẾN THỨC CHO AI
    const baseInstruction = context || "Bạn là SenAI, một trợ lý học thuật thông minh, thân thiện của nền tảng SenExam. Hãy giải đáp các câu hỏi ngắn gọn, dễ hiểu và truyền cảm hứng.";
    
    const systemInstruction = `
${baseInstruction}

QUY TẮC BẮT BUỘC:
1. TOÁN HỌC & VẬT LÍ: Sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân ở mọi bài toán (Ví dụ: 27,85 hoặc 9,8 . 10).
2. CÔNG THỨC: Khi trả về công thức Toán học/Vật lí, luôn bọc trong ký hiệu $ (inline) hoặc $$ (block) để hệ thống render TeX/KaTeX mượt mà.
3. TÁC GIẢ: Khi nhắc đến tác giả Hoàng Bình Minh, tuyệt đối không lặp thừa chữ Minh.

KHO DỮ LIỆU ĐIỂM CHUẨN ĐẠI HỌC VÀ NGÀNH HỌC CỦA HỆ THỐNG:
${universityDataText ? universityDataText : "Chưa có dữ liệu điểm chuẩn cục bộ."}

NHIỆM VỤ TƯ VẤN TRƯỜNG/NGÀNH:
- BƯỚC 1: Ưu tiên đối chiếu NGHIÊM NGẶT với KHO DỮ LIỆU JSON ở trên.
- BƯỚC 2: Nếu trường học hoặc ngành học mà thí sinh hỏi KHÔNG CÓ TRONG KHO DỮ LIỆU, bạn HÃY TỰ ĐỘNG TÌM KIẾM TRÊN WEB (Google Search) để lấy thông tin điểm chuẩn năm gần nhất (2024 hoặc 2025) và tư vấn cho thí sinh.
- BƯỚC 3: Tuyệt đối KHÔNG TỰ BỊA RA (Hallucinate) điểm chuẩn hoặc tên ngành nếu chưa tìm thấy nguồn dữ liệu thực tế. 
- Nếu học sinh hỏi về trường tính theo thang 100 điểm, hãy tự động quy đổi điểm của học sinh ra thang 100 hoặc quy chuẩn điểm của trường về thang 30 để so sánh logic.
`;

    // Ghép lịch sử trò chuyện và câu lệnh mới
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện trước đó:\n${JSON.stringify(history || [])}\n\nCâu hỏi mới: ${message}`;

    // 6. Gọi AI (Hỗ trợ Multimodal: Đọc Ảnh, PDF, Text + Trình tìm kiếm Web)
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