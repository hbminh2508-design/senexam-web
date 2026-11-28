let account = null
let retired = false

export function bindSenChatAccount(userId) {
  if (retired || (account && account !== userId)) {
    account = null
    retired = true
    return false
  }
  account = userId || null
  return true
}

export function getSenChatAccount() {
  return account
}

export function senChatAccountKey(key) {
  return account ? `senchat:account:${account}:${key}` : null
}
