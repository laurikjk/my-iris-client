import {vi} from "vitest"
import {generateSecretKey} from "nostr-tools"
import {InMemoryStorageAdapter} from "../StorageAdapter"
import {serializeSessionState} from "nostr-double-ratchet/src"

export const createMockDependencies = () => {
  const nostrSubscribe = vi.fn().mockReturnValue(() => {})
  const nostrPublish = vi.fn().mockResolvedValue({id: "mock-event-id"})
  const storage = new InMemoryStorageAdapter()
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device-123"

  return {
    nostrSubscribe,
    nostrPublish,
    storage,
    ourIdentityKey,
    deviceId,
  }
}

/**
 * Helper to populate storage with realistic session data
 * Storage key format: session/{userPubKey}/{deviceId}
 */
export const populateStorageWithSessions = async (
  storage: InMemoryStorageAdapter,
  sessions: Array<{
    userPubKey: string
    deviceId: string
    sessionState?: any // Will create mock state if not provided
  }>
) => {
  for (const {userPubKey, deviceId, sessionState} of sessions) {
    // Create a realistic session state that serializeSessionState can handle
    // Based on the actual SessionState structure from nostr-double-ratchet
    const mockSessionState = sessionState || {
      rootKey: new Uint8Array(32), // 32 bytes for root key
      theirCurrentNostrPublicKey: `mock-their-current-key-${deviceId}`,
      theirNextNostrPublicKey: `mock-their-next-key-${deviceId}`,
      ourCurrentNostrKey: {
        publicKey: `mock-our-current-key-${deviceId}`,
        privateKey: new Uint8Array(32),
      },
      ourNextNostrKey: {
        publicKey: `mock-our-next-key-${deviceId}`,
        privateKey: new Uint8Array(32),
      },
      receivingChainKey: new Uint8Array(32),
      sendingChainKey: new Uint8Array(32),
      sendingChainMessageNumber: 0,
      receivingChainMessageNumber: 0,
      previousSendingChainMessageCount: 0,
      skippedKeys: {}, // Empty object for skipped keys map
    }

    const key = `session/${userPubKey}/${deviceId}`
    const serializedState = serializeSessionState(mockSessionState)
    await storage.put(key, serializedState)
  }
}

/**
 * Helper to populate storage with invite data
 * Storage key format: invite/{deviceId}
 */
export const populateStorageWithInvite = async (
  storage: InMemoryStorageAdapter,
  deviceId: string,
  inviteData?: string
) => {
  const key = `invite/${deviceId}`
  const mockInviteData = inviteData || "mock-serialized-invite-data"
  await storage.put(key, mockInviteData)
}