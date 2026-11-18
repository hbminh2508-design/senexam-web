/**
 * Core utility functions and constants for Cash Mobile (SCm)
 * ESM format compatible with both Next.js and Node native test runner.
 */

export const VND_PER_SENCASH = 500
export const VND_PER_SCM = 100
export const SCM_PER_SENCASH = 5
export const MIN_TOPUP_VND = 1_000

export function vndToScm(vnd) {
  return Math.floor(vnd / VND_PER_SCM)
}

export function scmToVnd(scm) {
  return scm * VND_PER_SCM
}

export function senCashToScm(sc) {
  return (sc || 0) * SCM_PER_SENCASH
}
