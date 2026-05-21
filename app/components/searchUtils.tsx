import type { ReactNode } from 'react'

const escapeSearchRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeSearchTerms = (query: string) => {
  return Array.from(
    new Set(
      query
        .trim()
        .split(/\s+/)
        .map(term => term.trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length)
    )
  )
}

export const highlightSearchText = (text: string, query: string): ReactNode => {
  const terms = normalizeSearchTerms(query)
  if (!terms.length) return text

  const regex = new RegExp(`(${terms.map(escapeSearchRegex).join('|')})`, 'ig')

  return text.split(regex).map((part, index) => (
    index % 2 === 1
      ? <mark key={`${part}-${index}`} className="rounded bg-yellow-200/80 px-0.5 text-inherit dark:bg-yellow-400/30">{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ))
}

export const glassSearchInputClass =
  'w-full rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/60 dark:border-white/10 text-sm font-bold outline-none shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all focus:ring-2 focus:ring-blue-500/40'

export const glassSearchPanelClass =
  'absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95'
