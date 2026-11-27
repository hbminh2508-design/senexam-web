import assert from 'node:assert/strict'
import test from 'node:test'
import { generateInboxKeyPair, openInboxPayload, sealInboxPayload } from '../lib/senChatInboxCrypto.mjs'

test('encrypted inbox opens only on the addressed devices with the original conversation and sender context', async () => {
  const records = await Promise.all(['desktop', 'mobile', 'other-user'].map(async (device_id) => {
    const pair = await generateInboxKeyPair()
    return {
      device_id, user_id: 'recipient', privateKey: pair.privateKey,
      public_key: await crypto.subtle.exportKey('jwk', pair.publicKey),
    }
  }))
  const [desktop, mobile, stranger] = records
  const original = JSON.stringify({ content: 'Ghi chú và cuộc gọi nhóm 🌸' })
  const context = 'sen-inbox-v1:sender:message:group'
  const sealed = await sealInboxPayload(original, context, [desktop, mobile])
  const envelope = { ...sealed, ephemeral_key: sealed.ephemeral }
  assert.equal(sealed.wraps.length, 2)
  assert.equal(desktop.privateKey.extractable, false)
  assert.ok(!JSON.stringify(sealed).includes('Ghi chú'))
  for (const device of [desktop, mobile]) {
    const delivery = sealed.wraps.find((item) => item.device_id === device.device_id)
    assert.equal(await openInboxPayload(envelope, delivery, device.privateKey, context, device.user_id, device.device_id), original)
  }
  const delivery = sealed.wraps[0]
  await assert.rejects(openInboxPayload(envelope, delivery, stranger.privateKey, context, desktop.user_id, desktop.device_id))
  await assert.rejects(openInboxPayload(envelope, delivery, desktop.privateKey, context + ':changed', desktop.user_id, desktop.device_id))
  await assert.rejects(openInboxPayload(envelope, delivery, desktop.privateKey, context, desktop.user_id, mobile.device_id))
})
