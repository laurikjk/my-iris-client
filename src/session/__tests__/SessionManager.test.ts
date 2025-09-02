import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {serializeSessionState, Invite} from "nostr-double-ratchet/src"

describe("SessionManager", () => {
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device"

  it("should check storage and subscribe to invites on initialization", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null), // no stored invite
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]), // no stored sessions
      del: vi.fn().mockResolvedValue(undefined), // Add missing del method
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
      del: vi.fn().mockResolvedValue(undefined), // Add missing del method
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

  it("should properly set up event subscriptions for restored sessions", async () => {
    // Create a real session and serialize it
    const alicePubkey = getPublicKey(generateSecretKey())

    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    const mockPublish = vi.fn().mockResolvedValue({})

    // Create a real session to get proper serialized data
    const aliceInvite = Invite.createNew(alicePubkey, "alice-device")
    const {session: aliceSession} = await aliceInvite.accept(
      mockSubscribe,
      alicePubkey,
      generateSecretKey()
    )
    const serializedAliceSession = serializeSessionState(aliceSession.state)

    const mockStorage = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === `invite/${deviceId}`) {
          return Promise.resolve(null)
        }
        if (key === `session/${alicePubkey}/alice-device`) {
          return Promise.resolve(serializedAliceSession)
        }
        return Promise.resolve(null)
      }),
      put: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockImplementation((prefix: string) => {
        if (prefix === "session/") {
          return Promise.resolve([`session/${alicePubkey}/alice-device`])
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

    // Track events received
    const receivedEvents: Array<{event: any; fromPubKey: string}> = []

    // CRITICAL: Set up event listener AFTER init() to match the current broken behavior
    // This test should initially fail, then pass after we fix the timing
    await manager.init()

    // Set up event listener (this simulates the current problematic timing)
    const unsubscribe = manager.onEvent((event, fromPubKey) => {
      receivedEvents.push({event, fromPubKey})
    })

    // Verify session was restored
    const userRecords = (manager as any).userRecords
    expect(userRecords.has(alicePubkey)).toBe(true)

    const aliceRecord = userRecords.get(alicePubkey)
    const restoredSessions = aliceRecord.getActiveSessions()
    expect(restoredSessions).toHaveLength(1)

    // The real test: restored sessions should have event handlers set up
    // We can test this by checking if the session has proper event subscriptions
    const restoredSession = restoredSessions[0]

    // This is the critical test - if event handlers are properly set up,
    // the session should have an internal subscription
    const sessionInternalSubs = (restoredSession as any).internalSubscriptions

    // This should be > 0 if event handlers were properly set up during restoration
    // Currently this will likely be 0, indicating the bug
    expect(sessionInternalSubs?.size).toBeGreaterThan(0)

    unsubscribe()
  })

  it("should properly set up event subscriptions when onEvent is called AFTER init", async () => {
    // Same setup as above test
    const alicePubkey = getPublicKey(generateSecretKey())

    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    const mockPublish = vi.fn().mockResolvedValue({})

    const aliceInvite = Invite.createNew(alicePubkey, "alice-device")
    const {session: aliceSession} = await aliceInvite.accept(
      mockSubscribe,
      alicePubkey,
      generateSecretKey()
    )
    const serializedAliceSession = serializeSessionState(aliceSession.state)

    const mockStorage = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === `invite/${deviceId}`) {
          return Promise.resolve(null)
        }
        if (key === `session/${alicePubkey}/alice-device`) {
          return Promise.resolve(serializedAliceSession)
        }
        return Promise.resolve(null)
      }),
      put: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockImplementation((prefix: string) => {
        if (prefix === "session/") {
          return Promise.resolve([`session/${alicePubkey}/alice-device`])
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

    // Now set up event listener (this is the correct timing)
    const receivedEvents: Array<{event: any; fromPubKey: string}> = []
    const unsubscribe = manager.onEvent((event, fromPubKey) => {
      receivedEvents.push({event, fromPubKey})
    })

    // Verify restored sessions have proper event handlers
    const userRecords = (manager as any).userRecords
    const aliceRecord = userRecords.get(alicePubkey)
    const restoredSessions = aliceRecord.getActiveSessions()
    const restoredSession = restoredSessions[0]

    // With correct timing, event handlers should be properly set up
    const sessionInternalSubs = (restoredSession as any).internalSubscriptions
    expect(sessionInternalSubs?.size).toBeGreaterThan(0)

    unsubscribe()
  })

  it("should receive a message", async () => {
    // Same setup as above test
    const alicePubkey = getPublicKey(generateSecretKey())
    const bobPubkey = getPublicKey(generateSecretKey())

    // TODO: mock subs and pubs for alice and bob
    //
    // NOTE: Using these mocks we should be able to simulate network requests / websocket messages
    // to fully test the message sending and receiving flow without real network activity.

    // TODO: mock storage for alice and bob (empty)

    // const managerAlice = new SessionManager(
    //   ourIdentityKey,
    //   deviceId,
    //   mockSubscribeAlice,
    //   mockPublishAlice,
    //   mockStorage
    // )

    // await managerAlice.init()

    // Now set up event listener (this is the correct timing)
    const receivedEvents: Array<{event: any; fromPubKey: string}> = []
    const unsubscribe = manager.onEvent((event, fromPubKey) => {
      receivedEvents.push({event, fromPubKey})
    })

    // TODO: send to bob
  })
})
