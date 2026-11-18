/**
 * Universal Source of Truth for SenExam Versioning
 * Version is loaded dynamically from package.json at build/runtime.
 * DO NOT hardcode version numbers in component files.
 */

import pkg from '@/package.json'

export const APP_VERSION: string = pkg.version
export const APP_NAME: string = pkg.name

export interface VersionInfo {
  version: string
  major: number
  minor: number
  patch: number
  isRelease: boolean
}

export function getVersionInfo(): VersionInfo {
  const parts = APP_VERSION.split('.').map(Number)
  return {
    version: APP_VERSION,
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    isRelease: true,
  }
}

export default APP_VERSION
