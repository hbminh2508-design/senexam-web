import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Client (Đặt ngoài handler để tối ưu connection pool)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    // 🌟 HỆ THỐNG ĐẢO KEY (KEY ROTATION) V2 - SIÊU BỀN BỈ
    const rawKeys = process.env.GEMINI_API_KEY;
    if (!rawKeys) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    // Tách các key ra thành mảng (Hỗ trợ vô hạn Key cách nhau bằng dấu phẩy)
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

    // Hứng dữ liệu từ giao diện gửi lên
    const { message, history, context, images } = await req.json();

    // 🌟 LẤY DỮ LIỆU ĐIỂM CHUẨN TỪ SUPABASE
    let universityDataText = "";
    try {
      const { data: dbData, error } = await supabase
        .from('university_scores')
        .select('data')
        .eq('id', 1)
        .single();
        
      if (!error && dbData && dbData.data && dbData.data.length > 0) {
        universityDataText = JSON.stringify(dbData.data);
      }
    } catch (dbErr) {
      console.error("Lỗi hệ thống khi đọc dữ liệu điểm chuẩn từ DB:", dbErr);
    }

    // 🌟 ĐỊNH HÌNH TÍNH CÁCH VÀ NẠP KIẾN THỨC CHO AI
    const baseInstruction = context || "Bạn là SenAI, một trợ lý học thuật thông minh, thân thiện của nền tảng SenExam. Hãy giải đáp các câu hỏi ngắn gọn, dễ hiểu và truyền cảm hứng.";
    
    const systemInstruction = `
${baseInstruction}

QUY TẮC BẮT BUỘC:
1. TOÁN HỌC & VẬT LÍ: Sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân ở mọi bài toán (Ví dụ: 27,85 hoặc 9,8 . 10).
2. CÔNG THỨC: Khi trả về công thức Toán học/Vật lí, luôn bọc trong ký hiệu $ (inline) hoặc $$ (block) để hệ thống render TeX/KaTeX mượt mà.
3. TÁC GIẢ: Khi nhắc đến tác giả Hoàng Bình Minh, tuyệt đối không lặp thừa chữ Minh.

KHO DỮ LIỆU ĐIỂM CHUẨN ĐẠI HỌC VÀ NGÀNH HỌC CỦA HỆ THỐNG:
${universityDataText ? universityDataText : "Chưa có dữ liệu điểm chuẩn."}

NHIỆM VỤ TƯ VẤN TRƯỜNG/NGÀNH:
- BƯỚC 1: Ưu tiên đối chiếu NGHIÊM NGẶT với KHO DỮ LIỆU JSON ở trên.
- BƯỚC 2: Nếu trường học hoặc ngành học mà thí sinh hỏi KHÔNG CÓ TRONG KHO DỮ LIỆU, bạn HÃY TỰ ĐỘNG TÌM KIẾM TRÊN WEB (Google Search) để lấy thông tin điểm chuẩn năm gần nhất (2024 hoặc 2025) và tư vấn cho thí sinh.
- BƯỚC 3: Tuyệt đối KHÔNG TỰ BỊA RA (Hallucinate) điểm chuẩn hoặc tên ngành nếu chưa tìm thấy nguồn dữ liệu thực tế. 
- Nếu học sinh hỏi về trường tính theo thang 100 điểm, hãy tự động quy đổi điểm của học sinh ra thang 100 hoặc quy chuẩn điểm của trường về thang 30 để so sánh logic.
`;

    // Ghép lịch sử trò chuyện và câu lệnh mới
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện trước đó:\n${JSON.stringify(history || [])}\n\nCâu hỏi mới: ${message}`;

    // 🌟 THUẬT TOÁN THỬ TỪNG API KEY (FALLBACK CHỐNG LỖI 400, 429)
    let result = null;
    let lastError: any = null;

    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-3.1-flash-lite',
          // @ts-ignore - Bỏ qua kiểm duyệt Type của thư viện cũ trên Vercel
          tools: [{ googleSearch: {} }] 
        });

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
        
        // Nếu thành công, thoát vòng lặp ngay lập tức
        break; 

      } catch (e: any) {
        lastError = e;
        console.warn(`API Key số ${i + 1} gặp lỗi:`, e.message);
        
        // 🌟 Bỏ qua TẤT CẢ các lỗi liên quan đến Auth (400, 401, 403) và Quota (429) để nhảy sang Key tiếp theo
        const isAuthOrQuotaError = 
          e.status === 429 || 
          e.status === 400 || 
          e.status === 401 || 
          e.status === 403 || 
          e.message?.includes('expired') || 
          e.message?.includes('INVALID');

        if (isAuthOrQuotaError) {
          continue; // Key hỏng/hết lưu lượng -> Chạy tiếp vòng lặp với Key sau
        } else {
          // Nếu là lỗi khác (Lỗi Prompt, Lỗi mạng Vercel...) thì throw luôn
          throw e; 
        }
      }
    }

    // Nếu đã thử hết sạch danh sách Key mà vẫn không có kết quả
    if (!result) {
      throw lastError || new Error("Toàn bộ API Keys trong hệ thống đều đã lỗi hoặc vượt quá hạn mức truy cập.");
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