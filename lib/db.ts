import { Pool } from 'pg'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('[db] Missing DATABASE_URL environment variable')
    }
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
  try {
    const p = getDbPool()
    const res = await p.query(text, params)
    return res.rows
  } catch (err: any) {
    console.warn('[db query error]', err?.message || err)
    return []
  }
}
