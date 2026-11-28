import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

test('a stale Studio response cannot overwrite the currently selected conversation', async () => {
  const source = readFileSync(new URL('../components/chat/ChatSenAiStudioView.tsx', import.meta.url), 'utf8')
  const selection = source.slice(source.indexOf('  const handleSelectSession ='), source.indexOf('  // Tạo phiên mới'))
  const { outputText } = ts.transpileModule(selection, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
  const requests = new Map()
  const cached = new Map()
  let messages = []
  const bindings = {
    isSending: false, userId: 'account-a', selectionVersion: { current: 0 },
    attachment: { clear: () => {} }, setInputText: () => {}, setLoadingSession: () => {},
    setMessages: (value) => { messages = value },
    setActiveSessionId: () => {}, setShowSessionDropdown: () => {},
    messagesKey: (id) => 'senai-studio:account-a:messages:' + id,
    localStorage: { getItem: (key) => cached.get(key), setItem: (key, value) => cached.set(key, value) },
    supabase: { from: () => {
      let id
      const query = {
        select: () => query,
        eq: (column, value) => { if (column === 'session_id') id = value; return query },
        order: () => query,
        abortSignal: () => new Promise((resolve) => requests.set(id, resolve)),
      }
      return query
    } },
  }
  const select = new Function(...Object.keys(bindings), outputText + '\nreturn handleSelectSession')(...Object.values(bindings))
  const first = select('first')
  const second = select('second')
  const current = [{ id: 'message-two' }]
  requests.get('second')({ data: current })
  await second
  requests.get('first')({ data: [{ id: 'old-message' }] })
  await first
  assert.deepEqual(messages, current)
  assert.deepEqual([...cached.keys()], ['senai-studio:account-a:messages:second'])
  assert.ok(source.includes("const sessionListKey = 'senai-studio:' + userId + ':sessions'"))
})
