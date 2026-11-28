'use client'

import { Paperclip, X } from 'lucide-react'
import { useId, useState } from 'react'
import type { ClipboardEvent } from 'react'
import { SEN_AI_FILE_COUNT, SEN_AI_FILE_LIMIT, SEN_AI_FILE_TYPES, SEN_AI_MODES, type SenAiAttachment, type SenAiMode } from '@/lib/senAiModes'

export function useSenAiFiles() {
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const add = (picked: File[]) => {
    if (!picked.length) return
    if (picked.some((file) => !file.size || !Object.hasOwn(SEN_AI_FILE_TYPES, file.name.split('.').pop()?.toLowerCase() || ''))) {
      setFileError('Chọn ảnh PNG/JPG/WebP/HEIC/HEIF, PDF hoặc TXT/MD/CSV/JSON.')
      return
    }
    const next = [...files, ...picked]
    if (next.length > SEN_AI_FILE_COUNT || next.reduce((sum, file) => sum + file.size, 0) > SEN_AI_FILE_LIMIT) {
      setFileError('Tối đa 3 tệp, tổng dung lượng 2,5 MB.')
      return
    }
    setFileError('')
    setFiles(next)
  }
  const paste = (event: ClipboardEvent<HTMLElement>) => {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'))
    if (!images.length) return
    event.preventDefault()
    add(images)
  }
  const encode = () => Promise.all(files.map((file) => new Promise<SenAiAttachment>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được tệp ' + file.name))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result.split(',')[1] : ''
      const ext = file.name.split('.').pop()?.toLowerCase() as keyof typeof SEN_AI_FILE_TYPES
      if (!result) { reject(new Error('Tệp không có nội dung.')); return }
      resolve({ name: file.name, mimeType: SEN_AI_FILE_TYPES[ext], base64: result })
    }
    reader.readAsDataURL(file)
  })))
  return { files, fileError, add, paste, encode, remove: (index: number) => {
    setFiles((value) => value.filter((_, current) => current !== index))
    setFileError('')
  }, clear: () => { setFiles([]); setFileError('') } }
}

export function SenAiModePicker({ mode, onChange, disabled }: { mode: SenAiMode; onChange: (mode: SenAiMode) => void; disabled?: boolean }) {
  return <select value={mode} aria-label="Mô hình SenAI 2" disabled={disabled} onChange={(event) => onChange(event.target.value as SenAiMode)}
    className="max-w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    {Object.entries(SEN_AI_MODES).map(([key, value]) => <option key={key} value={key}>{value.name} · {value.label}</option>)}
  </select>
}

export function SenAiFileControls({ state, disabled }: { state: ReturnType<typeof useSenAiFiles>; disabled?: boolean }) {
  const id = useId()
  return <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
    <label htmlFor={id} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg bg-sky-100 px-2.5 font-semibold text-sky-900">
      <Paperclip size={14} /> Đính kèm
      <input type="file" id={id} multiple disabled={disabled} className="sr-only"
        accept={Object.keys(SEN_AI_FILE_TYPES).map((value) => '.' + value).join(',')}
        onChange={(event) => { state.add(Array.from(event.currentTarget.files || [])); event.currentTarget.value = '' }} />
    </label>
    {state.files.map((file, index) => <span key={file.name + index} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-100 px-2 dark:bg-slate-800">
      <span className="max-w-40 truncate">{file.name}</span>
      <button type="button" disabled={disabled} aria-label={`Bỏ tệp ${file.name}`} onClick={() => state.remove(index)} className="grid h-7 w-7 place-items-center"><X size={12} /></button>
    </span>)}
    {state.fileError && <p role="status" className="basis-full text-rose-700 dark:text-rose-300">{state.fileError}</p>}
  </div>
}
