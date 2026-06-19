import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { newData } = await req.json();

    if (!newData || !Array.isArray(newData)) {
      return NextResponse.json({ error: 'Dữ liệu gửi lên không đúng định dạng mảng JSON.' }, { status: 400 });
    }

    // 1. Đọc dữ liệu cũ từ Supabase
    const { data: dbRecord, error: fetchErr } = await supabase
      .from('university_scores')
      .select('data')
      .eq('id', 1)
      .single();

    let existingData: any[] = dbRecord?.data || [];

    // 2. Thuật toán Merge (Gộp) dữ liệu thông minh
    newData.forEach((newGroup: any) => {
      const existingGroup = existingData.find(g => g.group === newGroup.group);
      
      if (existingGroup) {
        newGroup.universities.forEach((newUni: any) => {
          const existingUni = existingGroup.universities.find((u: any) => u.code === newUni.code);
          
          if (existingUni) {
            newUni.majors.forEach((newMajor: any) => {
              const existingMajorIndex = existingUni.majors.findIndex((m: any) => m.major_code === newMajor.major_code || m.major_name === newMajor.major_name);
              if (existingMajorIndex > -1) {
                existingUni.majors[existingMajorIndex] = newMajor; // Ghi đè cập nhật điểm mới
              } else {
                existingUni.majors.push(newMajor); // Thêm ngành mới
              }
            });
          } else {
            existingGroup.universities.push(newUni); // Thêm trường mới
          }
        });
      } else {
        existingData.push(newGroup); // Thêm nguyên khối nhóm ngành mới
      }
    });

    // 3. Lưu lại lên Supabase thay vì ghi file local
    const { error: updateErr } = await supabase
      .from('university_scores')
      .update({ data: existingData })
      .eq('id', 1);

    if (updateErr) {
        // Fallback nếu bảng chưa có dòng id=1
        await supabase.from('university_scores').insert([{ id: 1, data: existingData }]);
    }

    return NextResponse.json({ success: true, message: 'Đồng bộ cơ sở dữ liệu lên Supabase thành công!' });
  } catch (error: any) {
    console.error('Lỗi khi cập nhật DB:', error);
    return NextResponse.json({ error: error.message || 'Lỗi Server khi cập nhật dữ liệu.' }, { status: 500 });
  }
}