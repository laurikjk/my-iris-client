import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {serializeSessionState, Invite} from "nostr-double-ratchet/src"

describe("SessionManager", () => {
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device"

  it("should receive a message", async () => {
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
    const publishBob = vi.fn().mockResolvedValue({})
    const onEventBob = vi.fn()

    const managerBob = new SessionManager(
      bobIdentityKey,
      "bob-device",
      subBob,
      publishBob,
      mockStorage
    )

    await managerBob.init()

    console.log("subBob calls:", subBob.mock.calls)
    console.log("publishBob calls:", publishBob.mock.calls)
    console.log("onEventBob calls:", onEventBob.mock.calls)

    managerBob.onEvent(onEventBob)

    console.log("subBob calls:", subBob.mock.calls)
    console.log("publishBob calls:", publishBob.mock.calls)
    console.log("onEventBob calls:", onEventBob.mock.calls)
  })
})
