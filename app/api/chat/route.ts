import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabaseAdmin';
import { getEffectiveDailyLimit } from '@/lib/senaiTiers';
import { getEffectivePlanTier, SENAI_DAILY_BONUS_BY_TIER } from '@/lib/vipMembership';

export async function POST(req: Request) {
  try {
    // 0. Xác thực người dùng + kiểm tra hạn mức câu hỏi/ngày theo hạng SenAI đang có hiệu lực
    // (free/lite/plus_lite/plus/ultra, đã tính hết hạn). VIP/Premium tặng thêm hạn mức tối thiểu
    // mỗi ngày dù chưa mua gói SenAI nào (mức tặng theo gói — xem SENAI_DAILY_BONUS_BY_TIER);
    // gói Lite không có phần thưởng này.
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('senai_tier, senai_tier_expires_at, senai_tier_permanent, vip_expires_at, plan_tier')
      .eq('id', user.id)
      .maybeSingle();
    const tierDailyLimit = getEffectiveDailyLimit(profile);
    const planTier = getEffectivePlanTier(profile);
    const dailyLimit = planTier ? Math.max(tierDailyLimit, SENAI_DAILY_BONUS_BY_TIER[planTier]) : tierDailyLimit;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from('senai_question_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('asked_at', startOfToday.toISOString());

    if ((count || 0) >= dailyLimit) {
      return NextResponse.json(
        { error: `Bạn đã dùng hết ${dailyLimit} lượt hỏi SenAI hôm nay. Nâng cấp gói tại /vi-sen để hỏi thêm.` },
        { status: 429 }
      );
    }

    // 1. Kiểm tra API Key hệ thống
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Lỗi Server: Không tìm thấy biến môi trường GEMINI_API_KEY");
      return NextResponse.json({ error: 'Chưa cấu hình API Key trên hệ thống Vercel' }, { status: 500 });
    }

    await supabaseAdmin.from('senai_question_log').insert({ user_id: user.id });

    // 2. Khởi tạo Google SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Sử dụng mô hình gemini-3.5-flash theo yêu cầu
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    // 4. Phân tích dữ liệu từ Client gửi lên
    const { message, history, context, images } = await req.json();

    // 5. ĐỌC TỰ ĐỘNG FILE ĐIỂM CHUẨN TỪ PROJECT ROOT
    let universityDataText = "";
    try {
      // Giả định sếp đặt file diemchuan.json trong thư mục 'data' ở thư mục gốc của dự án
      const filePath = path.join(process.cwd(), 'data', 'diemchuan.json');
      
      if (fs.existsSync(filePath)) {
        universityDataText = fs.readFileSync(filePath, 'utf8');
      } else {
        console.warn(`Cảnh báo: Không tìm thấy file dữ liệu tại đường dẫn: ${filePath}`);
      }
    } catch (fileError) {
      console.error("Lỗi hệ thống khi đọc tệp diemchuan.json:", fileError);
    }

    // 6. ĐỊNH HÌNH TÍNH CÁCH VÀ GĂM NẰM VÙNG DỮ LIỆU ĐIỂM CHUẨN VÀO NÃO AI
    const baseInstruction = context || "Bạn là SenAI, một trợ lý học thuật thông minh, thân thiện của nền tảng SenExam. Bạn hãy giải đáp các câu hỏi ngắn gọn, dễ hiểu và truyền cảm hứng.";
    
    const systemInstruction = `
${baseInstruction}

QUY TẮC HIỂN THỊ TOÁN HỌC & ĐIỂM SỐ:
- Phải sử dụng dấu chấm "." cho phép nhân và dấu phẩy "," cho dấu thập phân ở mọi điểm số hoặc bài toán (Ví dụ: 27,85 hoặc 9,8 . 10).
- Khi trả về công thức Toán học phức tạp, luôn bọc trong ký hiệu $ (inline) hoặc $$ (block) để hệ thống hiển thị TeX/KaTeX mượt mà.

KHO DỮ LIỆU ĐIỂM CHUẨN ĐẠI HỌC VÀ NGÀNH HỌC CHÍNH XÁC (Tham chiếu năm 2025):
${universityDataText ? universityDataText : "Hiện tại hệ thống dữ liệu đang được bảo trì, hãy dùng kiến thức nền của bạn."}

Nhiệm vụ tư vấn trường/ngành:
- Khi học sinh hỏi về cơ hội trúng tuyển hoặc xin gợi ý trường/ngành dựa trên điểm số và khối thi, bạn hãy đối chiếu thật nghiêm ngặt với KHO DỮ LIỆU ở trên.
- Tuyệt đối không tự bịa ra điểm chuẩn hoặc tên ngành không có trong danh sách. 
- Nếu học sinh hỏi về các trường tính theo thang điểm 100 (Ví dụ: Đại học Bách Khoa TP,HCM - QSB), bạn hãy tính toán quy đổi điểm của học sinh sang thang điểm 100 tương ứng hoặc quy đổi điểm chuẩn của trường về thang điểm 30 để giải thích một cách dễ hiểu, khoa học.
`;

    // Ghép toàn bộ ngữ cảnh chỉ dẫn, lịch sử cuộc trò chuyện và câu hỏi mới
    const finalPrompt = `${systemInstruction}\n\nLịch sử trò chuyện trước đó:\n${JSON.stringify(history || [])}\n\nCâu hỏi mới: ${message}`;

    // 7. Gọi AI xử lý đa phương thức (Hỗ trợ cả văn bản và tệp hình ảnh/PDF)
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

    const responseText = result.response.text();
    return NextResponse.json({ text: responseText });

  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    return NextResponse.json(
      { error: error.message || 'Đã có lỗi xảy ra khi xử lý luồng tư duy AI' }, 
      { status: error.status || 500 }
    );
  }
}