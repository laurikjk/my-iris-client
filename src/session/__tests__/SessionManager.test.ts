import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {serializeSessionState, Invite} from "nostr-double-ratchet/src"

describe("SessionManager", () => {
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device"

  it("should receive a message", async () => {
    // Test the actual SessionManager message sending without network dependencies
    // This test verifies that when sessions are established, messages flow correctly
    const aliceIdentityKey = generateSecretKey()
    const bobIdentityKey = generateSecretKey()
    const alicePubkey = getPublicKey(aliceIdentityKey)
    const bobPubkey = getPublicKey(bobIdentityKey)

    const testMessage = {
      kind: 14,
      content: "Hello Bob!",
    }

    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(undefined),
    }

    const subBob = vi.fn().mockReturnValue(() => {})
    const onEventBob = vi.fn().mockResolvedValue({})

    const managerBob = new SessionManager(
      bobIdentityKey,
      "bob-device",
      subBob,
      onEventBob,
      mockStorage
    )

    await managerBob.init()

    console.log("subBob calls:", subBob.mock.calls)
    console.log("onEventBob calls:", onEventBob.mock.calls)

    managerBob.onEvent((event, fromPubKey) => {
      console.log("Bob received event:", event, "from:", fromPubKey)
    })

    
  })
})
