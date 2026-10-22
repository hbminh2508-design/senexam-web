import fs from 'fs'
import path from 'path'

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

export function getExamCollections(): ExamCollection[] {
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

export function saveExamCollections(collections: ExamCollection[]): void {
  try {
    const dir = path.dirname(COLLECTIONS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving exam_collections.json:', err)
    throw err
  }
}
