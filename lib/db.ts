import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://senexam_admin:SenExam%402026%21Azure@localhost:5432/senexam_db'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

export async function queryDb<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getDbPool()
  try {
    const res = await p.query(text, params)
    return res.rows
  } catch (err: any) {
    console.warn('[db query error]', err?.message || err)
    return []
  }
}
