import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Security: .gitignore must ignore all .env* files except .env.example', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8')
  assert.match(gitignore, /\.env\*/, '.gitignore should contain .env*')
  assert.match(gitignore, /!\.env\.example/, '.gitignore should permit .env.example')
})

test('Security: lib/supabaseAdmin.ts and lib/supabaseClient.ts must not have hardcoded keys', () => {
  const adminContent = fs.readFileSync('lib/supabaseAdmin.ts', 'utf8')
  const clientContent = fs.readFileSync('lib/supabaseClient.ts', 'utf8')
  const dbContent = fs.readFileSync('lib/db.ts', 'utf8')

  assert.doesNotMatch(adminContent, /c2Jfc2VjcmV0/, 'supabaseAdmin must not contain base64 secret key')
  assert.doesNotMatch(adminContent, /DEFAULT_KEY/, 'supabaseAdmin must not have DEFAULT_KEY fallback')
  assert.doesNotMatch(clientContent, /c2JfcHVibGlzaGFibGU/, 'supabaseClient must not contain base64 anon key')
  assert.doesNotMatch(dbContent, /SenExam%402026/, 'lib/db.ts must not contain hardcoded postgres password')
})

test('Security: ensure-admin-account must reject date-based password bypass', async () => {
  const routeContent = fs.readFileSync('app/api/admin/ensure-admin-account/route.ts', 'utf8')
  assert.doesNotMatch(routeContent, /admin-\$\{d\}/, 'Must not accept admin date format admin-d/m/y')
  assert.doesNotMatch(routeContent, /admin-\d{1,2}\/\d{1,2}\/\d{4}/, 'Must not accept date strings')
  assert.match(routeContent, /ADMIN_SECRET/, 'Must enforce ADMIN_SECRET')
})

test('Security: clean-library must not accept hardcoded confirm code without admin auth', () => {
  const cleanLibrary = fs.readFileSync('app/api/admin/clean-library/route.ts', 'utf8')
  assert.match(cleanLibrary, /requireAdmin/, 'clean-library must require admin auth')
})
