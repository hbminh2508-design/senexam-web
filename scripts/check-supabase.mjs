#!/usr/bin/env node
/**
 * Diagnostic tool: Check Supabase Connectivity
 * Run anytime: node scripts/check-supabase.mjs
 */

import fs from 'fs'
import path from 'path'

// Tự động nạp .env.local nếu có
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim()
        const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function maskKey(key) {
  if (!key) return '(chưa cấu hình)'
  if (key.length <= 10) return '***'
  return key.slice(0, 8) + '...' + key.slice(-4)
}

console.log('\n======================================================')
console.log('🩺 KIỂM TRA TÌNH TRẠNG KẾT NỐI SUPABASE (SENEXAM)')
console.log('======================================================')
console.log(`📡 URL               : ${url || '❌ CHƯA CÓ'}`)
console.log(`🔑 Anon Key         : ${maskKey(anonKey)}`)
console.log(`🔐 Service Role Key : ${maskKey(serviceRoleKey)}`)
console.log('------------------------------------------------------')

let hasError = false

async function runChecks() {
  if (!url) {
    console.error('❌ Lỗi: NEXT_PUBLIC_SUPABASE_URL chưa được thiết lập.')
    process.exit(1)
  }

  // 1. Kiểm tra Anon Key qua REST API
  if (!anonKey) {
    console.warn('⚠️ Cảnh báo: NEXT_PUBLIC_SUPABASE_ANON_KEY chưa được thiết lập.')
    hasError = true
  } else {
    try {
      const start = Date.now()
      const res = await fetch(`${url}/rest/v1/system_release?select=count&limit=1`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })
      const elapsed = Date.now() - start
      if (res.ok) {
        console.log(`✅ [Anon Client] Kết nối thành công tới Supabase REST (${elapsed}ms) - HTTP ${res.status}`)
      } else {
        const text = await res.text()
        console.error(`❌ [Anon Client] Lỗi phản hồi HTTP ${res.status}: ${text.slice(0, 100)}`)
        hasError = true
      }
    } catch (err) {
      console.error(`❌ [Anon Client] Không thể kết nối: ${err.message}`)
      hasError = true
    }
  }

  // 2. Kiểm tra Service Role Key (Admin)
  if (!serviceRoleKey) {
    console.warn('⚠️ Cảnh báo: SUPABASE_SERVICE_ROLE_KEY chưa được thiết lập.')
    hasError = true
  } else {
    try {
      const start = Date.now()
      const res = await fetch(`${url}/rest/v1/profiles?select=count&limit=1`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Range: '0-0',
          Prefer: 'count=exact',
        },
      })
      const elapsed = Date.now() - start
      if (res.ok) {
        const countHeader = res.headers.get('content-range') || ''
        console.log(`✅ [Admin Client] Kết nối thành công (Bypass RLS) (${elapsed}ms) - Range: ${countHeader || 'OK'}`)
      } else {
        const text = await res.text()
        console.error(`❌ [Admin Client] Lỗi phản hồi HTTP ${res.status}: ${text.slice(0, 100)}`)
        hasError = true
      }
    } catch (err) {
      console.error(`❌ [Admin Client] Không thể kết nối: ${err.message}`)
      hasError = true
    }
  }

  // 3. Kiểm tra Supabase Auth Gateway
  try {
    const start = Date.now()
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: anonKey || serviceRoleKey,
      },
    })
    const elapsed = Date.now() - start
    if (res.ok) {
      console.log(`✅ [Auth Gateway] Supabase Auth hoạt động bình thường (${elapsed}ms)`)
    } else {
      console.log(`ℹ️ [Auth Gateway] Trả về HTTP ${res.status} (${elapsed}ms)`)
    }
  } catch (err) {
    console.warn(`⚠️ [Auth Gateway] Không thể truy cập Auth settings: ${err.message}`)
  }

  console.log('======================================================')
  if (hasError) {
    console.error('❌ KẾT QUẢ: Kết nối Supabase có vấn đề cần khắc phục.')
    process.exit(1)
  } else {
    console.log('🎉 KẾT QUẢ: Kết nối Supabase HOẠT ĐỘNG HOÀN HẢO!')
    process.exit(0)
  }
}

runChecks()
