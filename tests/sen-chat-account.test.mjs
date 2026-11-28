import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/senChatStorage.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})

async function openTab(name) {
  const account = await import('../lib/senChatAccount.mjs?tab=' + name)
  const storage = {}
  new Function('require', 'exports', outputText)(() => account, storage)
  return { ...account, ...storage }
}

test('changing account retires the current tab and legacy mixed history stays separated', async () => {
  const oldWindow = globalThis.window
  const oldStorage = globalThis.localStorage
  const data = new Map()
  globalThis.window = {}
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
  try {
    const conversation = { id: 'friend', partnerId: 'friend', partnerName: 'Bạn', lastMessage: 'Dữ liệu lẫn tài khoản' }
    const message = (id, senderId, receiverId) => ({
      id, senderId, receiverId, conversationId: 'friend', content: id, type: 'text', createdAt: '2026-11-28T00:00:00Z',
    })
    data.set('sen_chat_conversations', JSON.stringify([conversation]))
    data.set('sen_chat_msgs_friend', JSON.stringify([message('only-a', 'friend', 'a'), message('only-b', 'b', 'friend')]))

    const first = await openTab('a')
    assert.deepEqual(first.getLocalConversations(), [])
    assert.equal(first.bindSenChatAccount('a'), true)
    first.restoreLegacySenChatHistory('a')
    assert.deepEqual(first.getLocalMessages('friend').map(({ id }) => id), ['only-a'])
    assert.equal(first.getLocalConversations()[0].lastMessage, 'only-a')
    first.applyChatReaction('friend', 'only-a', 'a', { emoji: '👍', count: 3, updatedAt: 300 })
    first.applyChatReaction('friend', 'only-a', 'a', { emoji: '👍', count: 1, updatedAt: 200 })
    assert.deepEqual(first.getLocalMessages('friend')[0].reactions['👍'], ['a', 'a', 'a'])
    first.applyChatReaction('friend', 'only-a', 'a', { emoji: '👍', count: 2, updatedAt: 400 })
    assert.deepEqual(first.getLocalMessages('friend')[0].reactions['👍'], ['a', 'a'])
    first.saveConversationDraft('friend', 'Bản nháp A')
    assert.equal(first.bindSenChatAccount('b'), false)
    assert.deepEqual(first.getLocalMessages('friend'), [])
    first.saveLocalMessages('friend', [message('late-a', 'a', 'friend')])

    const second = await openTab('b')
    second.bindSenChatAccount('b')
    second.restoreLegacySenChatHistory('b')
    assert.deepEqual(second.getLocalMessages('friend').map(({ id }) => id), ['only-b'])
    assert.equal(second.getLocalConversations()[0].lastMessage, 'only-b')
    assert.equal(second.getConversationDraft('friend'), '')

    const reopened = await openTab('a-again')
    reopened.bindSenChatAccount('a')
    reopened.restoreLegacySenChatHistory('a')
    assert.deepEqual(reopened.getLocalMessages('friend').map(({ id }) => id), ['only-a'])
    assert.equal(reopened.getConversationDraft('friend'), 'Bản nháp A')
  } finally {
    if (oldWindow === undefined) delete globalThis.window
    else globalThis.window = oldWindow
    if (oldStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = oldStorage
  }
})
