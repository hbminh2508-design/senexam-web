import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/senChatWhiteboard.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { boardPointLimit, boardStrokeEndsAtRelease, readBoardPacket, traceBoardStroke, validBoardItem } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const encode = (packet) => new TextEncoder().encode(JSON.stringify(packet))

test('whiteboard rounds handwritten turns and ends at the last contact sample', () => {
  const commands = []
  const path = {
    moveTo: (...args) => commands.push(['move', ...args]),
    lineTo: (...args) => commands.push(['line', ...args]),
    quadraticCurveTo: (...args) => commands.push(['curve', ...args]),
  }
  traceBoardStroke(path, [[2, 3], [6, 3], [8, 7], [10, 8]])
  assert.deepEqual(commands, [
    ['move', 2, 3], ['curve', 4, 3, 6, 3], ['curve', 8, 5, 8, 7], ['curve', 9.5, 8, 10, 8],
  ])
  const tail = commands.at(-1)
  commands.length = 0
  traceBoardStroke(path, [[2, 3], [6, 3], [8, 7], [10, 8]], 3)
  assert.deepEqual(commands, [['move', 8, 7], tail])
  assert.equal(boardStrokeEndsAtRelease('pen'), false)
  assert.equal(boardStrokeEndsAtRelease('touch'), true)
  assert.equal(boardStrokeEndsAtRelease('mouse'), true)
})

test('mobile room info binds its disappearing message controls to state', () => {
  const page = readFileSync(new URL('../app/m/chat/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /const \[disappearingTtl, setDisappearingTtl\] = useState\(0\)/)
  assert.match(page, /disappearingTtl=\{disappearingTtl\}/)
})

test('shared whiteboard sends the center, viewport size and scale for followers', () => {
  const packet = { type: 'view', view: { center: [380, -650], size: [1180, 620], scale: 0.75 } }
  assert.deepEqual(readBoardPacket(encode(packet)), packet)
  assert.equal(readBoardPacket(encode({ ...packet, view: { ...packet.view, size: [0, 620] } })), null)
  assert.deepEqual(readBoardPacket(encode({ type: 'request-view' })), { type: 'request-view' })
})

test('whiteboard accepts incremental packets only within the same stroke limit as persistence', () => {
  const packet = {
    type: 'points', id: '61bbee73-83ba-4bdc-8607-a33195903b39', offset: boardPointLimit - 2,
    color: '#1e293b', points: [[1.25, 2], [3, 4.5]],
  }
  assert.deepEqual(readBoardPacket(encode(packet)), packet)
  assert.equal(readBoardPacket(encode({ ...packet, offset: boardPointLimit - 1 })), null)
  assert.equal(readBoardPacket(encode({ ...packet, points: [[false, 2]] })), null)
  assert.equal(validBoardItem({ kind: 'stroke', color: packet.color, points: Array(boardPointLimit).fill([1, 2]) }), true)
  assert.equal(validBoardItem({ kind: 'stroke', color: packet.color, points: Array(boardPointLimit + 1).fill([1, 2]) }), false)
})
