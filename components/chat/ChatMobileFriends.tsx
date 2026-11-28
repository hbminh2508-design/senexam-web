'use client'

import { ArrowLeft, RefreshCw, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { chatRequest } from '@/lib/senChatBrowser'

export type ChatFriendProfile = {
  id: string
  name: string
  avatar?: string
  school?: string
  className?: string
  updatedAt?: string
  mutualCount?: number
}

type FriendData = {
  friends: ChatFriendProfile[]
  incoming: ChatFriendProfile[]
  outgoing: ChatFriendProfile[]
  suggestions: ChatFriendProfile[]
}

export default function ChatMobileFriends({ userId, onBack, onFind, onMessage, lookupOpen }: {
  userId: string
  onBack: () => void
  onFind: () => void
  onMessage: (friend: ChatFriendProfile) => void
  lookupOpen: boolean
}) {
  const [tab, setTab] = useState<'incoming' | 'suggestions' | 'friends'>('incoming')
  const [data, setData] = useState<FriendData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await chatRequest<FriendData>('friend-invitation?suggestions=1', undefined, 'GET', userId))
    } catch {
      setError('Không tải được danh sách bạn bè. Hãy thử lại.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!lookupOpen) void refresh()
  }, [lookupOpen, refresh])

  const act = async (action: 'send' | 'accept' | 'reject', profile: ChatFriendProfile) => {
    setBusy(profile.id)
    setError('')
    try {
      const result = await chatRequest<{ success?: boolean; error?: string }>('friend-invitation', {
        action, targetUserId: profile.id,
      }, 'POST', userId)
      if (!result.success) throw new Error(result.error || 'Không thể cập nhật lời mời.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật lời mời.')
    } finally {
      setBusy(null)
    }
  }

  const button = 'min-h-9 rounded-xl px-3 text-xs font-semibold disabled:opacity-50'
  const primary = button + ' bg-sky-700 text-white'
  const secondary = button + ' bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'
  const list = data?.[tab] || []
  const tabs = [
    { id: 'incoming', label: 'Lời mời', count: data?.incoming.length },
    { id: 'suggestions', label: 'Đề xuất' },
    { id: 'friends', label: 'Đã kết bạn' },
  ] as const

  const renderProfile = (profile: ChatFriendProfile, kind: typeof tab | 'outgoing') => (
    <li key={profile.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      {profile.avatar ? (
        <img src={profile.avatar} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-800">
          {profile.name.slice(0, 1).toLocaleUpperCase('vi')}
        </span>
      )}
      <div className="min-w-32 flex-1">
        <p className="break-words text-sm font-bold">{profile.name}</p>
        {kind === 'suggestions' ? (
          <p className="text-xs text-slate-500">{profile.mutualCount} bạn chung</p>
        ) : (
          <p className="break-words text-xs text-slate-500">{[profile.school, profile.className].filter(Boolean).join(' · ') || 'Học viên SenExam'}</p>
        )}
        {kind === 'incoming' && profile.updatedAt && !Number.isNaN(Date.parse(profile.updatedAt)) &&
          <p className="text-xs text-slate-500">Đã gửi ngày {new Date(profile.updatedAt).toLocaleDateString('vi-VN')}</p>}
      </div>
      <div className="ml-auto flex gap-1.5">
        {kind === 'incoming' && <>
          <button type="button" className={primary} disabled={!!busy || loading} onClick={() => void act('accept', profile)}>Chấp nhận</button>
          <button type="button" className={secondary} disabled={!!busy || loading} onClick={() => void act('reject', profile)}>Từ chối</button>
        </>}
        {kind === 'suggestions' && <button type="button" className={primary} disabled={!!busy || loading} onClick={() => void act('send', profile)}>Kết bạn</button>}
        {kind === 'friends' && <button type="button" className={primary} onClick={() => onMessage(profile)}>Nhắn tin</button>}
        {kind === 'outgoing' && <span className="text-xs text-slate-500">Đang chờ</span>}
      </div>
    </li>
  )

  return (
    <section aria-label="Bạn bè Sen Chat" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <button type="button" aria-label="Về danh sách chat" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 text-lg font-bold">Bạn bè</h1>
        <button type="button" aria-label="Làm mới" disabled={loading || !!busy} onClick={() => void refresh()} className="grid h-11 w-11 place-items-center rounded-2xl disabled:opacity-50"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
        <button type="button" onClick={onFind} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-sky-700 px-3 text-xs font-bold text-white"><UserPlus size={16} /> Tìm qua email</button>
      </header>
      <nav aria-label="Danh sách bạn bè" className="grid grid-cols-3 gap-1.5 p-3">
        {tabs.map(({ id, label, ...rest }) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}
            className="min-h-10 rounded-xl px-1 text-xs font-bold text-slate-600 aria-pressed:bg-sky-100 aria-pressed:text-sky-800 dark:text-slate-300">
            {label}{'count' in rest && rest.count ? ` (${rest.count})` : ''}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5" aria-busy={loading}>
        {error && <p role="status" className="my-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {loading && !data && <p className="p-3 text-sm text-slate-500">Đang tải…</p>}
        {data && list.length === 0 && <p className="p-3 text-sm text-slate-500">
          {tab === 'incoming' ? 'Bạn chưa có lời mời đến.' : tab === 'suggestions' ? 'Chưa có đề xuất từ bạn chung.' : 'Bạn chưa có ai trong danh bạ.'}
        </p>}
        <ul className="space-y-2">{list.map((profile) => renderProfile(profile, tab))}</ul>
        {tab === 'incoming' && !!data?.outgoing.length && <>
          <h2 className="mb-2 mt-5 text-sm font-bold">Lời mời đã gửi</h2>
          <ul className="space-y-2">{data.outgoing.map((profile) => renderProfile(profile, 'outgoing'))}</ul>
        </>}
      </div>
    </section>
  )
}
