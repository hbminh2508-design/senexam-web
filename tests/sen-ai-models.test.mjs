import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { senAiProductKnowledge } from '../lib/senAiKnowledge.mjs'

function load(path, dependency = () => ({})) {
  const exports = {}
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  new Function('require', 'exports', outputText)(dependency, exports)
  return exports
}

const modes = load('../lib/senAiModes.ts')
const requests = []
const generate = load('../lib/senAiGenerate.ts', (id) => {
  if (id === './senAiModes') return modes
  if (id === './senAiKnowledge.mjs') return { senAiProductKnowledge }
  return {
    ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
    GoogleGenAI: class {
      models = { generateContent: async (body) => { requests.push(body); return { text: 'Đã đọc tệp' } } }
    },
  }
})

test('Rose, Tulip and Orchid map to provider thinking levels without losing attached data', async () => {
  for (const mode of ['rose', 'tulip', 'orchid']) {
    const input = generate.prepareSenAiRequest({
      mode,
      attachments: [
        { name: 'note.txt', mimeType: 'text/plain', base64: Buffer.from('Mã ghi chú: 731').toString('base64') },
        { name: 'paper.pdf', mimeType: 'application/pdf', base64: 'JVBERg==' },
      ],
    })
    assert.equal(await generate.generateSenAi('fake', input), 'Đã đọc tệp')
  }
  assert.deepEqual(requests.map((body) => body.config.thinkingConfig.thinkingLevel), ['LOW', 'MEDIUM', 'HIGH'])
  for (const request of requests) {
    assert.match(request.config.systemInstruction, /Sen Chat hiện là 1\.2\.1/)
    const parts = request.contents.at(-1).parts
    assert.ok(parts.some((part) => part.text?.includes('Mã ghi chú: 731')))
    assert.ok(parts.some((part) => part.inlineData?.data === 'JVBERg=='))
  }
})

test('invalid attachments fail before model invocation', () => {
  for (const body of [
    { message: 'hello', attachments: [{ name: 'x.exe', mimeType: 'application/octet-stream', base64: 'YQ==' }] },
    { message: 'hello', image: 'broken' },
    { message: 'hello', attachments: [{ name: 'x.txt', mimeType: 'text/plain', base64: '/w==' }] },
  ]) {
    assert.throws(() => generate.prepareSenAiRequest(body), generate.SenAiInputError)
  }
})
