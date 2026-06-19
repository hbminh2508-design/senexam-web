import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { newData } = await req.json();

    if (!newData || !Array.isArray(newData)) {
      return NextResponse.json({ error: 'Dữ liệu gửi lên không đúng định dạng mảng JSON.' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'data', 'diemchuan.json');
    let existingData: any[] = [];

    // Đọc dữ liệu cũ nếu file đã tồn tại
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent) {
        existingData = JSON.parse(fileContent);
      }
    }

    // Thuật toán Merge (Gộp) dữ liệu thông minh
    newData.forEach((newGroup: any) => {
      // Tìm nhóm ngành (Ví dụ: Công nghệ - Kỹ thuật)
      const existingGroup = existingData.find(g => g.group === newGroup.group);
      
      if (existingGroup) {
        // Nhóm đã tồn tại -> Kiểm tra từng trường đại học
        newGroup.universities.forEach((newUni: any) => {
          const existingUni = existingGroup.universities.find((u: any) => u.code === newUni.code);
          
          if (existingUni) {
            // Trường đã tồn tại -> Gộp ngành học (nếu trùng mã ngành thì ghi đè điểm mới, nếu không thì thêm vào)
            newUni.majors.forEach((newMajor: any) => {
              const existingMajorIndex = existingUni.majors.findIndex((m: any) => m.major_code === newMajor.major_code || m.major_name === newMajor.major_name);
              if (existingMajorIndex > -1) {
                existingUni.majors[existingMajorIndex] = newMajor; // Ghi đè
              } else {
                existingUni.majors.push(newMajor); // Thêm mới
              }
            });
          } else {
            // Trường chưa tồn tại trong nhóm -> Thêm mới trường
            existingGroup.universities.push(newUni);
          }
        });
      } else {
        // Nhóm chưa tồn tại -> Thêm nguyên cả khối nhóm mới
        existingData.push(newGroup);
      }
    });

    // Lưu lại vào file hệ thống
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf8');

    return NextResponse.json({ success: true, message: 'Cập nhật cơ sở dữ liệu diemchuan.json thành công!' });
  } catch (error: any) {
    console.error('Lỗi khi ghi file diemchuan.json:', error);
    return NextResponse.json({ error: error.message || 'Lỗi Server khi cập nhật dữ liệu.' }, { status: 500 });
  }
}