import fs from 'fs'
import path from 'path'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export interface ExamCollection {
  id: string
  subject: string // Tên môn học (e.g. "Toán học", "Vật lí", "Hóa học")
  title: string // Tiêu đề tuyển tập (e.g. "Tuyển tập đề Toán học")
  description?: string
  exam_ids: string[] // Danh sách ID các đề thi gộp vào tuyển tập
  created_at: string
  updated_at: string
}

const COLLECTIONS_FILE = path.join(process.cwd(), 'data', 'exam_collections.json')

export function readLocalCollections(): ExamCollection[] {
  try {
    if (!fs.existsSync(COLLECTIONS_FILE)) {
      return []
    }
    const data = fs.readFileSync(COLLECTIONS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error reading exam_collections.json:', err)
    return []
  }
}

export function writeLocalCollections(collections: ExamCollection[]): void {
  try {
    const dir = path.dirname(COLLECTIONS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving exam_collections.json:', err)
  }
}

// 1. Đọc danh sách tuyển tập đề (ưu tiên online từ Supabase, fallback file cục bộ)
export async function getExamCollectionsAsync(): Promise<ExamCollection[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('exam_collections')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      const collections: ExamCollection[] = data.map((d: any) => ({
        id: d.id,
        subject: d.subject,
        title: d.title,
        description: d.description || '',
        exam_ids: Array.isArray(d.exam_ids) ? d.exam_ids : [],
        created_at: d.created_at,
        updated_at: d.updated_at,
      }))
      writeLocalCollections(collections)
      return collections
    }
  } catch {
    // Supabase chưa có bảng hoặc lỗi mạng, fallback file cục bộ
  }

  return readLocalCollections()
}

// 2. Lưu tuyển tập đề (đồng bộ online Supabase + file cục bộ)
export async function saveExamCollectionAsync(collection: ExamCollection): Promise<ExamCollection[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('exam_collections').upsert({
      id: collection.id,
      subject: collection.subject,
      title: collection.title,
      description: collection.description || '',
      exam_ids: collection.exam_ids || [],
      created_at: collection.created_at,
      updated_at: collection.updated_at,
    })
  } catch (err) {
    console.warn('Lỗi upsert Supabase exam_collections:', err)
  }

  const current = readLocalCollections()
  const existingIdx = current.findIndex((c) => c.id === collection.id)
  if (existingIdx >= 0) {
    current[existingIdx] = collection
  } else {
    current.unshift(collection)
  }
  writeLocalCollections(current)

  return current
}

// 3. Xóa tuyển tập đề (đồng bộ online Supabase + file cục bộ)
export async function deleteExamCollectionAsync(id: string): Promise<ExamCollection[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('exam_collections').delete().eq('id', id)
  } catch (err) {
    console.warn('Lỗi delete Supabase exam_collections:', err)
  }

  const current = readLocalCollections().filter((c) => c.id !== id)
  writeLocalCollections(current)

  return current
}

export function getExamCollections(): ExamCollection[] {
  return readLocalCollections()
}

export function saveExamCollections(collections: ExamCollection[]): void {
  writeLocalCollections(collections)
}
