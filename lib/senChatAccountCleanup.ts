/**
 * TypeScript re-export and types for Sen Chat Account Cleanup Engine (P8)
 */

import { deleteDriveFilesBatch } from './senChatDriveService'
import {
  filterDriveIdsToPurge,
  filterStoragePathsToPurge,
  validateDeletionPayload,
  purgeUserChatData as purgeUserChatDataMjs,
  deleteUserFullAccount as deleteUserFullAccountMjs,
} from './senChatAccountCleanup.mjs'

export interface CleanupResult {
  userId: string
  deletedDriveFiles: number
  deletedStoragePaths: number
  deletedMessages: number
  deletedDevices: number
  deletedPrekeys: number
  deletedKeyPackages: number
  success: boolean
  error?: string | null
}

export {
  filterDriveIdsToPurge,
  filterStoragePathsToPurge,
  validateDeletionPayload,
}

export async function purgeUserChatData(userId: string, supabaseAdmin: any): Promise<CleanupResult> {
  return purgeUserChatDataMjs(userId, supabaseAdmin, deleteDriveFilesBatch)
}

export async function deleteUserFullAccount(userId: string, supabaseAdmin: any): Promise<CleanupResult> {
  return deleteUserFullAccountMjs(userId, supabaseAdmin, deleteDriveFilesBatch)
}
