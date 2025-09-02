import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {serializeSessionState, Invite} from "nostr-double-ratchet/src"
import {Rumor} from "nostr-double-ratchet"

describe("SessionManager", () => {
  const createMockSessionManager = async (identityKey: Uint8Array, deviceId: string) => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(undefined),
    }

    const subscribe = vi.fn().mockReturnValue(() => {})
    const publish = vi.fn().mockResolvedValue({})

    const manager = new SessionManager(
      identityKey,
      deviceId,
      subscribe,
      publish,
      mockStorage
    )

    await manager.init()

    return {manager, subscribe, publish, mockStorage}
  }

  it("should receive a message", async () => {
    const aliceIdentityKey = generateSecretKey()
    const bobIdentityKey = generateSecretKey()
    const alicePubkey = getPublicKey(aliceIdentityKey)
    const bobPubkey = getPublicKey(bobIdentityKey)

    const {
      manager: managerAlice,
      subscribe: subAlice,
      publish: publishAlice,
    } = await createMockSessionManager(aliceIdentityKey, "alice-device-1")

    const onEventAlice = vi.fn()
    managerAlice.onEvent(onEventAlice)

    const {
      manager: managerBob,
      subscribe: subBob,
      publish: publishBob,
    } = await createMockSessionManager(bobIdentityKey, "bob-device-1")

    const onEventBob = vi.fn()
    managerBob.onEvent(onEventBob)

    // TODO: Look at what kind of events are sent in the UI code and mock one here
    const event: Partial<Rumor> = {}

    managerAlice.sendEvent(bobPubkey, event)
  })
})
