import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Supabase Types: lib/database.types.ts exists and declares Database interface', () => {
  assert.strictEqual(fs.existsSync('lib/database.types.ts'), true)
  const typesContent = fs.readFileSync('lib/database.types.ts', 'utf8')
  assert.match(typesContent, /export interface Database/)
  assert.match(typesContent, /\"exams\":/)
  assert.match(typesContent, /\"profiles\":/)
  assert.match(typesContent, /\"submissions\":/)
})

test('Supabase Diagnostic: scripts/check-supabase.mjs exists and masks keys', () => {
  assert.strictEqual(fs.existsSync('scripts/check-supabase.mjs'), true)
  const checkScript = fs.readFileSync('scripts/check-supabase.mjs', 'utf8')
  assert.match(checkScript, /function maskKey/)
  assert.match(checkScript, /system_release/)
})
