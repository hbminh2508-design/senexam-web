#!/usr/bin/env node
/**
 * Commit Message Linter (Conventional Commits) for SenExam
 * Enforces commit message format:
 *   <type>(<scope>): <subject>
 * Types allowed: feat, fix, perf, security, refactor, docs, chore, test, build, ci
 */

import fs from 'fs'

const msgFile = process.argv[2]
if (!msgFile) {
  console.error('❌ Thiếu đường dẫn file commit message.')
  process.exit(1)
}

const rawMsg = fs.readFileSync(msgFile, 'utf8')
const firstLine = rawMsg.split('\n')[0].trim()

// Bỏ qua merge commits tự động của git
if (firstLine.startsWith('Merge branch') || firstLine.startsWith('Merge pull request')) {
  process.exit(0)
}

const CONVENTIONAL_REGEX = /^(feat|fix|perf|security|refactor|docs|chore|test|build|ci)(\([a-z0-9_-]+\))?(!)?:\s+[a-z0-9]/i

if (!CONVENTIONAL_REGEX.test(firstLine)) {
  console.error('\n🚨 LỖI QUY ƯỚC COMMIT (CONVENTIONAL COMMITS VIOLATION)!')
  console.error(`Tin nhắn commit không hợp lệ: "${firstLine}"`)
  console.error('\nCú pháp yêu cầu:')
  console.error('  <type>(<scope>): <mô tả ngắn>')
  console.error('Ví dụ hợp lệ:')
  console.error('  feat(exams): bổ sung tính năng nộp bài tự động khi hết giờ')
  console.error('  fix(auth): sửa lỗi phân quyền admin token')
  console.error('  perf(bundle): tối ưu lazy load thư viện Three.js')
  console.error('  security(deps): cập nhật vá lỗ hổng phụ thuộc')
  console.error('\nCác type được chấp nhận: feat, fix, perf, security, refactor, docs, chore, test, build, ci\n')
  process.exit(1)
}

console.log('✅ Commit message hợp lệ chuẩn Conventional Commits.')
process.exit(0)
