/**
 * Script sao lưu toàn bộ số dư ví và giao dịch SenCash & SCm trước khi di chuyển dữ liệu
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

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
      if (!process.env[key]) process.env[key] = val
    }
  }
}

loadEnvLocal()

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!token || !url) {
    console.error('Thiếu SUPABASE_ACCESS_TOKEN hoặc NEXT_PUBLIC_SUPABASE_URL trong .env.local')
    process.exit(1)
  }

  const match = url.match(/https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co/)
  const projectRef = match[1]

  console.log('📡 Đang sao lưu số dư và sổ cái tiền tệ từ Supabase...')

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `
        SELECT jsonb_build_object(
          'timestamp', now(),
          'profiles_wallets', (
            SELECT jsonb_agg(jsonb_build_object(
              'id', id,
              'email', email,
              'role', role,
              'sencash_balance', sencash_balance,
              'scm_balance', scm_balance,
              'sencash_mobile_balance', sencash_mobile_balance
            ))
            FROM public.profiles
          ),
          'sencash_transactions', (
            SELECT jsonb_agg(t) FROM public.sencash_transactions t
          ),
          'mobile_sencash_transactions', (
            SELECT jsonb_agg(m) FROM public.mobile_sencash_transactions m
          )
        ) as backup_payload;
      `,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Sao lưu thất bại:', errText)
    process.exit(1)
  }

  const data = await res.json()
  const backupDir = path.join(ROOT_DIR, 'backups')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

  const filename = `wallet_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const filePath = path.join(backupDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(data[0]?.backup_payload || {}, null, 2), 'utf8')

  console.log(`✅ Sao lưu ví thành công vào tệp: backups/${filename}`)
}

main()
