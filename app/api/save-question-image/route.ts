import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Sử dụng Service Role Key nếu có, ngược lại dùng Anon Key
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey!
)

export async function POST(request: Request) {
  try {
    const { image, fileName, sectionId, questionIndex } = await request.json()

    if (!image || !fileName || !sectionId) {
      return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 })
    }

    // Chuyển base64 thành Buffer
    const base64Data = image.split(',')[1] || image
    const buffer = Buffer.from(base64Data, 'base64')

    // Tạo tên file unique
    const timestamp = Date.now()
    const filePath = `exam-questions/${sectionId}/${questionIndex}-${timestamp}.jpg`

    // 🔧 Kiểm tra xem bucket tồn tại không, nếu không thì tạo nó
    try {
      await supabase.storage.getBucket('exam-media')
    } catch (err) {
      // Tạo bucket nếu chưa tồn tại
      await supabase.storage.createBucket('exam-media', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      })
    }

    // Upload lên Supabase Storage
    const { data, error } = await supabase.storage
      .from('exam-media')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (error) {
      console.error('Storage error:', error)
      throw new Error(`Lỗi lưu ảnh: ${error.message}`)
    }

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from('exam-media')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (error: any) {
    console.error('Save question image error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi lưu ảnh câu hỏi' },
      { status: 500 }
    )
  }
}
