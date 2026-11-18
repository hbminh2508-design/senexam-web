#!/usr/bin/env node
/**
 * Automated Semantic Versioning and Release Generator for SenExam
 * Conforms to Conventional Commits and SemVer specification.
 * 
 * Usage:
 *   node scripts/release.mjs [--dry-run] [--force-bump <major|minor|patch>]
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const PACKAGE_JSON_PATH = path.join(process.cwd(), 'package.json')
const VERSION_FILE_PATH = path.join(process.cwd(), 'VERSION')
const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md')
const RELEASE_NOTES_PATH = path.join(process.cwd(), 'RELEASE_NOTES.md')

function getGitCommitsSinceLastTag() {
  try {
    const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
    const log = execSync(`git log ${lastTag}..HEAD --oneline`, { encoding: 'utf8' }).trim()
    return { lastTag, commits: log ? log.split('\n') : [] }
  } catch {
    // Không có tag trước đó, lấy 20 commit gần nhất
    const log = execSync('git log -n 20 --oneline', { encoding: 'utf8' }).trim()
    return { lastTag: null, commits: log ? log.split('\n') : [] }
  }
}

const COMMIT_REGEX = /^[a-f0-9]+\s+(feat|fix|perf|security|refactor|docs|chore|test|build|ci)(\([a-z0-9_-]+\))?(!)?:\s+(.+)$/i

export function analyzeCommits(commits) {
  let hasBreaking = false
  let hasFeat = false
  let hasFixOrPerf = false

  const categorized = {
    breaking: [],
    feat: [],
    fix: [],
    perf: [],
    security: [],
    other: [],
  }

  for (const line of commits) {
    const match = line.match(COMMIT_REGEX)
    if (!match) {
      if (/breaking change/i.test(line)) {
        hasBreaking = true
        categorized.breaking.push(line)
      } else {
        categorized.other.push(line)
      }
      continue
    }

    const [, type, scope, exclamation, message] = match
    const lowerType = type.toLowerCase()

    if (exclamation || /breaking change/i.test(message)) {
      hasBreaking = true
      categorized.breaking.push(line)
    } else if (lowerType === 'feat') {
      hasFeat = true
      categorized.feat.push(line)
    } else if (lowerType === 'fix') {
      hasFixOrPerf = true
      categorized.fix.push(line)
    } else if (lowerType === 'perf') {
      hasFixOrPerf = true
      categorized.perf.push(line)
    } else if (lowerType === 'security') {
      hasFixOrPerf = true
      categorized.security.push(line)
    } else {
      categorized.other.push(line)
    }
  }

  let bumpType = 'none'
  if (hasBreaking) bumpType = 'major'
  else if (hasFeat) bumpType = 'minor'
  else if (hasFixOrPerf) bumpType = 'patch'

  return { bumpType, categorized }
}

export function calculateNextVersion(currentVersion, bumpType) {
  const parts = currentVersion.split('.').map(Number)
  let [major, minor, patch] = parts

  if (bumpType === 'major') {
    major++
    minor = 0
    patch = 0
  } else if (bumpType === 'minor') {
    minor++
    patch = 0
  } else if (bumpType === 'patch') {
    patch++
  }
  return `${major}.${minor}.${patch}`
}

export async function runRelease() {
  const isDryRun = process.argv.includes('--dry-run')
  const forceBumpArg = process.argv.indexOf('--force-bump')
  const forcedBump = forceBumpArg !== -1 ? process.argv[forceBumpArg + 1] : null

  console.log('🚀 SENEXAM AUTOMATED RELEASE ENGINE')
  console.log('--------------------------------------------------')

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  const currentVersion = pkg.version
  console.log(`📌 Phiên bản hiện tại : ${currentVersion}`)

  const { lastTag, commits } = getGitCommitsSinceLastTag()
  console.log(`🏷️  Tag gần nhất      : ${lastTag || '(chưa có tag)'}`)
  console.log(`📝 Số commit mới     : ${commits.length}`)

  const { bumpType, categorized } = analyzeCommits(commits)
  const effectiveBump = forcedBump || bumpType
  console.log(`📈 Mức tăng phiên bản: ${effectiveBump.toUpperCase()}`)

  if (effectiveBump === 'none') {
    console.log('ℹ️ Không có commit yêu cầu tăng phiên bản (chỉ gồm docs, test, chore...). Bỏ qua release.')
    return { version: currentVersion, bumped: false }
  }

  const nextVersion = calculateNextVersion(currentVersion, effectiveBump)
  console.log(`✨ Phiên bản kế tiếp : ${nextVersion}`)

  if (isDryRun) {
    console.log('🔍 [DRY RUN] Đã tính xong phiên bản, không ghi đè tệp tin.')
    return { version: nextVersion, bumped: true }
  }

  // 1. Cập nhật package.json
  pkg.version = nextVersion
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

  // 2. Cập nhật file VERSION
  fs.writeFileSync(VERSION_FILE_PATH, `${nextVersion}\n`, 'utf8')

  // 3. Tạo Release Notes
  const today = new Date().toISOString().split('T')[0]
  let releaseNotes = `## [${nextVersion}] - ${today}\n\n`

  if (categorized.breaking.length > 0) {
    releaseNotes += `### ⚠️ BREAKING CHANGES\n`
    categorized.breaking.forEach(c => releaseNotes += `- ${c}\n`)
    releaseNotes += '\n'
  }
  if (categorized.feat.length > 0) {
    releaseNotes += `### 🚀 Tính Năng Mới (Features)\n`
    categorized.feat.forEach(c => releaseNotes += `- ${c}\n`)
    releaseNotes += '\n'
  }
  if (categorized.fix.length > 0 || categorized.security.length > 0) {
    releaseNotes += `### 🐛 Sửa Lỗi & Bảo Mật (Fixes & Security)\n`
    categorized.fix.forEach(c => releaseNotes += `- ${c}\n`)
    categorized.security.forEach(c => releaseNotes += `- ${c}\n`)
    releaseNotes += '\n'
  }
  if (categorized.perf.length > 0) {
    releaseNotes += `### ⚡ Tối Ưu Hiệu Năng (Performance)\n`
    categorized.perf.forEach(c => releaseNotes += `- ${c}\n`)
    releaseNotes += '\n'
  }

  fs.writeFileSync(RELEASE_NOTES_PATH, releaseNotes, 'utf8')

  // 4. Cập nhật CHANGELOG.md (chèn lên đầu)
  let changelog = ''
  if (fs.existsSync(CHANGELOG_PATH)) {
    changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8')
  }
  const headerIdx = changelog.indexOf('\n## ')
  if (headerIdx !== -1) {
    const top = changelog.slice(0, headerIdx)
    const rest = changelog.slice(headerIdx)
    changelog = `${top}\n\n${releaseNotes.trim()}\n${rest}`
  } else {
    changelog = `# CHANGELOG - SenExam Platform\n\n${releaseNotes}\n${changelog}`
  }
  fs.writeFileSync(CHANGELOG_PATH, changelog, 'utf8')

  console.log('✅ Đã cập nhật package.json, VERSION, CHANGELOG.md và RELEASE_NOTES.md.')
  return { version: nextVersion, bumped: true }
}

if (process.argv[1] && process.argv[1].endsWith('release.mjs')) {
  runRelease().catch(err => {
    console.error('❌ Lỗi khi thực hiện release:', err)
    process.exit(1)
  })
}
