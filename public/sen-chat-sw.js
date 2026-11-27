const settings = 'sen-chat-push-settings-v1'
const accountKey = '/sen-chat-push-account'

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'sen-chat-user') return
  event.waitUntil(caches.open(settings).then((cache) => cache.put(accountKey, new Response(event.data.user || ''))))
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const data = event.data?.json()
    if (!data || !['call', 'message'].includes(data.kind)) return
    const account = await (await caches.open(settings)).match(accountKey)
    if (!account || await account.text() !== data.user) return
    if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now()) return
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (clients.some((client) => client.focused && client.visibilityState === 'visible')) return
    const url = new URL('/chat', self.location.origin)
    url.searchParams.set('conversation', data.conversation)
    if (data.callId) url.searchParams.set('call', data.callId)
    await self.registration.showNotification(data.kind === 'call' ? 'Cuộc gọi đến · Sen Chat' : 'Tin nhắn mới · Sen Chat', {
      body: data.kind === 'call' ? 'Chạm để mở lời mời gọi.' : 'Chạm để mở cuộc trò chuyện.',
      icon: '/sen-chat-icon-192.png',
      tag: data.callId ? `sen-call-${data.callId}` : `sen-msg-${data.conversation}`,
      data: { url: url.href },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = new URL(event.notification.data.url)
    if (url.origin !== self.location.origin) return
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clients.find((client) => ['/chat', '/m/chat'].includes(new URL(client.url).pathname))
    if (existing) {
      await existing.focus()
      await existing.navigate(url.href)
    } else {
      await self.clients.openWindow(url.href)
    }
  })())
})
