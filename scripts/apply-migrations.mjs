/**
 * SenExam Automated Supabase Migration Runner
 * Executes pending SQL migrations in migrations/ automatically.
 * Supports:
 *   1. Direct Postgres connection via DATABASE_URL / POSTGRES_URL / SOURCE_DB_URL
 *   2. Supabase Management API via SUPABASE_ACCESS_TOKEN
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'migrations')

// Load .env.local if not already loaded into process.env
function loadEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx === -1) continue
      const key = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

loadEnvLocal()

const { Pool } = pg

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort()
}

async function runWithPostgres(connectionString) {
  console.log('📡 Đang kết nối tới PostgreSQL trực tiếp qua Connection Pool...')
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  const client = await pool.connect()
  try {
    // 1. Tạo bảng lưu lịch sử migrations nếu chưa có
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // 2. Lấy danh sách migration đã chạy
    const { rows } = await client.query('SELECT name FROM _migrations')
    const appliedSet = new Set(rows.map(r => r.name))

    const files = getMigrationFiles()
    let appliedCount = 0

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ⏭️  Đã chạy trước đó: ${file}`)
        continue
      }

      console.log(`  ⏳ Đang áp dụng migration: ${file}...`)
      const filePath = path.join(MIGRATIONS_DIR, file)
      const sqlContent = fs.readFileSync(filePath, 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sqlContent)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  ✅ Hoàn tất thành công: ${file}`)
        appliedCount++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ❌ Lỗi khi thực thi ${file}:`, err.message)
        throw err
      }
    }

    console.log(`\n🎉 Tất cả migration đã hoàn tất! Đã áp dụng mới: ${appliedCount} tệp.`)
  } finally {
    client.release()
    await pool.end()
  }
}

async function executeManagementQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Lỗi API (${res.status}): ${errText}`)
  }
  return res.json()
}

async function runWithManagementApi(token, supabaseUrl) {
  const match = supabaseUrl.match(/https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co/)
  if (!match) {
    throw new Error('Không thể trích xuất Project Ref từ NEXT_PUBLIC_SUPABASE_URL')
  }
  const projectRef = match[1]
  console.log(`📡 Đang áp dụng migration qua Supabase Management API (Project: ${projectRef})...`)

  // 1. Tạo bảng _migrations nếu chưa có
  await executeManagementQuery(
    token,
    projectRef,
    `CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  )

  // 2. Lấy danh sách migration đã chạy
  const appliedRows = await executeManagementQuery(token, projectRef, `SELECT name FROM _migrations;`)
  const appliedSet = new Set((appliedRows || []).map(r => r.name))

  const files = getMigrationFiles()
  let appliedCount = 0

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  Đã chạy trước đó: ${file}`)
      continue
    }

    console.log(`  ⏳ Đang gửi migration: ${file}...`)
    const filePath = path.join(MIGRATIONS_DIR, file)
    const sqlContent = fs.readFileSync(filePath, 'utf8')

    await executeManagementQuery(token, projectRef, sqlContent)
    await executeManagementQuery(
      token,
      projectRef,
      `INSERT INTO _migrations (name) VALUES ('${file}') ON CONFLICT (name) DO NOTHING;`
    )

    console.log(`  ✅ Hoàn tất thành công: ${file}`)
    appliedCount++
  }
  console.log(`\n🎉 Đã gửi và thực thi tất cả migration thành công qua Supabase API! Đã áp dụng mới: ${appliedCount} tệp.`)
}

async function main() {
  console.log('=== SENEXAM SUPABASE MIGRATION RUNNER ===\n')

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SOURCE_DB_URL

  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (connectionString) {
    try {
      await runWithPostgres(connectionString)
      process.exit(0)
    } catch (err) {
      console.error('\n❌ Thực thi migration qua PostgreSQL thất bại:', err.message)
      process.exit(1)
    }
  }

  if (supabaseAccessToken && supabaseUrl) {
    try {
      await runWithManagementApi(supabaseAccessToken, supabaseUrl)
      process.exit(0)
    } catch (err) {
      console.error('\n❌ Thực thi migration qua Management API thất bại:', err.message)
      process.exit(1)
    }
  }

  console.log(`⚠️  CHƯA CẤU HÌNH THÔNG TIN KẾT NỐI TRỰC TIẾP TỚI POSTGRESQL HOẶC MANAGEMENT API.

Để hệ thống TỰ ĐỘNG đẩy và áp dụng mọi code SQL/migration lên Supabase (không cần copy/paste bằng tay), bạn chỉ cần cấu hình 1 trong 2 cách sau vào file .env.local:

--------------------------------------------------------------------------------
👉 CÁCH 1 (Khuyên dùng - Kết nối PostgreSQL chuẩn):
Thêm dòng sau vào .env.local:
DATABASE_URL="postgresql://postgres.[project-ref]:[mật_khẩu_db]@aws-0-[region].pooler.supabase.com:6543/postgres"

(Lấy tại: Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI / Transaction Pooler)
--------------------------------------------------------------------------------
👉 CÁCH 2 (Qua Supabase Access Token):
Thêm dòng sau vào .env.local:
SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxxxxxx"

(Lấy tại: https://supabase.com/dashboard/account/tokens -> Generate new token)
--------------------------------------------------------------------------------

Sau khi thêm, bạn chỉ cần gõ lệnh:
  npm run db:migrate
Toàn bộ mã SQL trong thư mục migrations/ sẽ tự động được chạy lên cơ sở dữ liệu Supabase!
`)
}

main()
