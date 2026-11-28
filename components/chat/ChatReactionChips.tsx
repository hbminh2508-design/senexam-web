'use client'

import { useState } from 'react'

export default function ChatReactionChips({ reactions, userId, onChange }: {
  reactions: Record<string, string[]>
  userId: string
  onChange: (emoji: string, remove?: boolean) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const checked = selected ? reactions[selected] : undefined
  const ownCount = checked?.filter((id) => id === userId).length || 0
  return <div className="mt-1.5" onClick={(event) => event.stopPropagation()}>
    <div className="flex flex-wrap gap-1">
      {Object.entries(reactions).map(([emoji, users]) => users.length > 0 && (
        <button key={emoji} type="button" aria-expanded={selected === emoji}
          aria-label={`${emoji}, ${users.length} lượt thả`} onClick={() => setSelected(selected === emoji ? null : emoji)}
          className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-bold ${users.includes(userId) ? 'border-sky-400 bg-sky-100 text-sky-900' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}>
          <span>{emoji}</span><span>{users.length}</span>
        </button>
      ))}
    </div>
    {selected && checked && (
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl bg-white px-2 py-1 text-xs text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
        <span>{selected} {checked.length} lượt · Bạn: {ownCount}</span>
        <button type="button" className="min-h-8 font-semibold text-sky-700 dark:text-sky-300" onClick={() => onChange(selected)}>Thêm</button>
        {ownCount > 0 && <button type="button" className="min-h-8 font-semibold text-rose-700 dark:text-rose-300" onClick={() => onChange(selected, true)}>Xóa 1 lượt</button>}
      </div>
    )}
  </div>
}
