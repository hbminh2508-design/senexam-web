#!/usr/bin/env node
/**
 * Pre-commit Verification Script
 * Scans for sensitive keys, runs diagnostic tests, and checks environment hygiene.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

console.log('🔍 [1/3] Running automated security audit scans...')

const FORBIDDEN_PATTERNS = [
  /c2Jfc2VjcmV0/i,
  /sb_secret_[a-zA-Z0-9_-]{10,}/i,
  /postgresql:\/\/[^:]+:[^@]+@/i,
  /admin-\$\{d\}/i,
]

let foundViolations = 0

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', '.gemini', 'backups', 'tests'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDir(full)
    } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name) && entry.name !== 'pre-commit-check.mjs') {
      const content = fs.readFileSync(full, 'utf8')
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`❌ Security Violation in ${full}: matched forbidden pattern ${pattern}`)
          foundViolations++
        }
      }
    }
  }
}

scanDir('.')

if (foundViolations > 0) {
  console.error(`\n🚨 Pre-commit check FAILED: ${foundViolations} hardcoded secrets/patterns found!`)
  process.exit(1)
}

console.log('✅ [2/3] No hardcoded secrets or backdoors found in source files.')
console.log('🧪 [3/3] Running automated test suite...')

try {
  execSync('node --test tests/**/*.test.mjs', { stdio: 'inherit' })
  console.log('\n🎉 ALL PRE-COMMIT AUDIT CHECKS PASSED!')
  process.exit(0)
} catch (err) {
  console.error('\n❌ Tests failed during pre-commit check.')
  process.exit(1)
}
