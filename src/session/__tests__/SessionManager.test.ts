import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {Session, serializeSessionState, Invite} from "nostr-double-ratchet/src"

describe("SessionManager", () => {
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device"

  it("should check storage and subscribe to invites on initialization", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null), // no stored invite
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]), // no stored sessions
    }

    const mockSubscribe = vi.fn().mockReturnValue(() => {}) // unsubscribe function
    const mockPublish = vi.fn().mockResolvedValue({})

    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      mockSubscribe,
      mockPublish,
      mockStorage
    )

    // Wait for initialization to complete
    await manager.init()

    // Should check storage for existing invite
    expect(mockStorage.get).toHaveBeenCalledWith(`invite/${deviceId}`)

    // Should check storage for existing sessions
    expect(mockStorage.list).toHaveBeenCalledWith("session/")

    // Should subscribe to invites (multiple times - own invites, invite acceptances, etc.)
    expect(mockSubscribe).toHaveBeenCalled()

    // Should publish new invite since none was found in storage
    expect(mockPublish).toHaveBeenCalled()
  })

  it("should restore sessions from storage on initialization", async () => {
    // Create real sessions and serialize them
    const alicePubkey = getPublicKey(generateSecretKey())
    const bobPubkey = getPublicKey(generateSecretKey())

    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    const mockPublish = vi.fn().mockResolvedValue({})

    // Create a real session to get proper serialized data
    const aliceInvite = Invite.createNew(alicePubkey, "alice-device")
    const {session: aliceSession} = await aliceInvite.accept(
      mockSubscribe,
      bobPubkey,
      generateSecretKey()
    )
    const serializedAliceSession = serializeSessionState(aliceSession.state)

    const bobInvite = Invite.createNew(bobPubkey, "bob-device")
    const {session: bobSession} = await bobInvite.accept(
      mockSubscribe,
      alicePubkey,
      generateSecretKey()
    )
    const serializedBobSession = serializeSessionState(bobSession.state)

    const mockStorage = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === `invite/${deviceId}`) {
          return Promise.resolve(null) // no stored invite
        }
        if (key === `session/${alicePubkey}/alice-device`) {
          return Promise.resolve(serializedAliceSession)
        }
        if (key === `session/${bobPubkey}/bob-device`) {
          return Promise.resolve(serializedBobSession)
        }
        return Promise.resolve(null)
      }),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockImplementation((prefix: string) => {
        if (prefix === "session/") {
          return Promise.resolve([
            `session/${alicePubkey}/alice-device`,
            `session/${bobPubkey}/bob-device`,
          ])
        }
        return Promise.resolve([])
      }),
    }

    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      mockSubscribe,
      mockPublish,
      mockStorage
    )

    await manager.init()

    // Should have loaded sessions from storage
    expect(mockStorage.list).toHaveBeenCalledWith("session/")
    expect(mockStorage.get).toHaveBeenCalledWith(`session/${alicePubkey}/alice-device`)
    expect(mockStorage.get).toHaveBeenCalledWith(`session/${bobPubkey}/bob-device`)

    // Verify sessions were restored by checking internal state
    const userRecords = (manager as any).userRecords
    expect(userRecords.has(alicePubkey)).toBe(true)
    expect(userRecords.has(bobPubkey)).toBe(true)

    const aliceRecord = userRecords.get(alicePubkey)
    const bobRecord = userRecords.get(bobPubkey)

    expect(aliceRecord.getActiveSessions()).toHaveLength(1)
    expect(bobRecord.getActiveSessions()).toHaveLength(1)
  })
})
