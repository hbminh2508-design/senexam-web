import {
  isFlagSecureEnabled,
  setFlagSecure,
  toggleFlagSecure,
  isAppLockConfigured,
  getAppLockConfig,
  setupAppLock,
  verifyAppLockPin,
  verifyBiometricAuth,
  disableAppLock,
  isSessionLocked,
  lockSession,
  unlockSession,
  isKeystoreHardwareBacked,
  storeIdentityPrivateKey,
  retrieveIdentityPrivateKey,
  deleteIdentityPrivateKey,
  formatE2eePushPayload,
  validatePushPayloadSecurity,
} from './senChatMobileSecurity.mjs'

export interface AppLockConfig {
  enabled: boolean
  hasPin: boolean
  pinLength?: number
  useBiometric: boolean
}

export interface E2eePushNotificationPayload {
  title: string
  body: string
  badge: number
  sound: string
  data: {
    conversationId: string
    isGroup: boolean
    pushType: string
    receivedAt: number
  }
}

export {
  isFlagSecureEnabled,
  setFlagSecure,
  toggleFlagSecure,
  isAppLockConfigured,
  getAppLockConfig,
  setupAppLock,
  verifyAppLockPin,
  verifyBiometricAuth,
  disableAppLock,
  isSessionLocked,
  lockSession,
  unlockSession,
  isKeystoreHardwareBacked,
  storeIdentityPrivateKey,
  retrieveIdentityPrivateKey,
  deleteIdentityPrivateKey,
  formatE2eePushPayload,
  validatePushPayloadSecurity,
}
