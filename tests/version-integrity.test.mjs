import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { analyzeCommits, calculateNextVersion } from '../scripts/release.mjs'

test('Version Integrity: package.json version matches VERSION file', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const versionFile = fs.readFileSync('VERSION', 'utf8').trim()
  assert.strictEqual(pkg.version, versionFile, 'package.json and VERSION must be identical')
})

test('Version Integrity: Version is valid SemVer (MAJOR.MINOR.PATCH)', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const semverRegex = /^\d+\.\d+\.\d+$/
  assert.match(pkg.version, semverRegex, 'Version must strictly follow SemVer X.Y.Z format')
})

test('Version Integrity: lib/version.ts exists and single source of truth is established', () => {
  assert.strictEqual(fs.existsSync('lib/version.ts'), true)
  const content = fs.readFileSync('lib/version.ts', 'utf8')
  assert.match(content, /import pkg from '@\/package\.json'/)
  assert.match(content, /export const APP_VERSION/)
})

test('Release Engine: Conventional commits bump calculation', () => {
  // 1. Breaking change -> MAJOR
  const breakingRes = analyzeCommits(['1234567 feat(api)!: drop deprecated legacy endpoint'])
  assert.strictEqual(breakingRes.bumpType, 'major')
  assert.strictEqual(calculateNextVersion('2.1.0', 'major'), '3.0.0')

  // 2. Feature -> MINOR
  const featRes = analyzeCommits([
    '1234567 feat(exams): add auto-recovery for network drops',
    '890abcd docs: update changelog'
  ])
  assert.strictEqual(featRes.bumpType, 'minor')
  assert.strictEqual(calculateNextVersion('2.1.0', 'minor'), '2.2.0')

  // 3. Fix / Perf / Security -> PATCH
  const fixRes = analyzeCommits([
    '1234567 fix(auth): prevent double submit',
    '890abcd perf(render): memoize question list'
  ])
  assert.strictEqual(fixRes.bumpType, 'patch')
  assert.strictEqual(calculateNextVersion('2.1.0', 'patch'), '2.1.1')

  // 4. Chore / Docs / Test -> NONE
  const choreRes = analyzeCommits([
    '1234567 docs: update readme',
    '890abcd test: add unit tests'
  ])
  assert.strictEqual(choreRes.bumpType, 'none')
})
