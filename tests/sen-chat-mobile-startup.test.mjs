import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../app/m/chat/page.tsx', import.meta.url), 'utf8')
const start = source.lastIndexOf('  useEffect(() => {', source.indexOf('    async function initMobileChat()'))
const end = source.indexOf('  // Khởi động Realtime Relay Node', start)
const { outputText } = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
})

test('mobile Sen Chat opens from the active session before background requests finish', async () => {
  const user = { id: 'signed-in', email: 'chat@example.test' }
  const blocked = new Promise(() => {})
  const conversations = [{ id: 'saved-conversation' }]
  let account = null
  let cleanup
  let lists
  let redirect
  let unsubscribe = false
  let resolveUser
  const rendered = new Promise((resolve) => { resolveUser = resolve })
  const spy = {
    useEffect: (effect) => { cleanup = effect() },
    router: { replace: (url) => { redirect = url } },
    startupAttempt: 0,
    syncConversationsStateIfChanged: () => {},
    setupEphemeralCleanupListener: () => () => {},
    setStartupError: (message) => assert.equal(message, ''),
    isFlagSecureEnabled: () => false,
    setFlagSecureActive: () => {},
    setFlagSecure: () => {},
    isAppLockConfigured: () => false,
    window: {},
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user, access_token: 'test-token' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { unsubscribe = true } } } }),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => blocked }) }) }),
    },
    bindSenChatAccount: (id) => { account = id; return true },
    getSenChatAccount: () => account,
    restoreLegacySenChatHistory: () => {},
    saveLocalSenChatUser: () => {},
    getLocalConversations: () => conversations,
    ensureSenAiStudioInConversations: (list) => list,
    setConversations: (list) => { lists = list },
    setOfflinePendingCount: () => {},
    globalOfflineChatQueue: { getPendingCount: () => 0 },
    setCurrentUser: (profile) => resolveUser(profile),
    retrieveIdentityPrivateKey: () => blocked,
    getOrCreateDeviceId: () => 'test-device',
    fetch: () => blocked,
    triggerFullDeviceSync: () => blocked,
  }
  new Function(...Object.keys(spy), outputText)(...Object.values(spy))
  try {
    const profile = await Promise.race([rendered, new Promise((resolve) => setImmediate(() => resolve(null)))])
    assert.equal(profile?.id, user.id)
    assert.deepEqual(lists, conversations)
    assert.equal(redirect, undefined)
  } finally {
    cleanup()
  }
  assert.equal(unsubscribe, true)
})
