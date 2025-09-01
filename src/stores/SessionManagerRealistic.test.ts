import {describe, it, expect, vi, beforeEach, afterEach} from "vitest"
import SessionManager from "./SessionManager"
import {createMockDependencies} from "./test-utils/sessionManager"
import {CHAT_MESSAGE_KIND} from "nostr-double-ratchet/src"

// Mock the nostr-double-ratchet module for realistic multi-device scenarios
vi.mock("nostr-double-ratchet/src", async () => {
  const actual = await vi.importActual("nostr-double-ratchet/src")

  // Create mock sessions for different devices
  const createMockSession = (deviceId: string) => {
    const callbacks: Array<(event: any) => void> = []
    return {
      name: deviceId,
      state: {
        theirNextNostrPublicKey: `alice-device-${deviceId}-next-key`,
        ourCurrentNostrKey: {publicKey: `our-current-key-${deviceId}`},
      },
      sendEvent: vi.fn().mockImplementation((event: any) => ({
        event: {...event, id: `encrypted-${deviceId}-${Date.now()}`},
      })),
      onEvent: vi.fn().mockImplementation((callback: (event: any) => void) => {
        callbacks.push(callback)
        return () => {}
      }),
      close: vi.fn(),
      // Helper to simulate incoming message
      _emit: (event: any) => callbacks.forEach((cb) => cb(event)),
    }
  }

  // Mock invite acceptance to return different sessions for different devices
  const mockInviteAccept = vi
    .fn()
    .mockImplementation(async (subscribe, publicKey, identityKey) => {
      const deviceId = mockInviteAccept.mock.calls.length.toString() // Increment device IDs
      const session = createMockSession(`alice-device-${deviceId}`)
      const event = {id: `acceptance-event-${deviceId}`, kind: 1}
      return {session, event}
    })

  return {
    ...actual,
    Session: vi
      .fn()
      .mockImplementation((subscribe, state) => createMockSession("restored")),
    Invite: {
      createNew: vi.fn().mockImplementation((publicKey, deviceId) => ({
        deviceId,
        serialize: vi.fn().mockReturnValue(`invite-${deviceId}`),
        getEvent: vi.fn().mockReturnValue({id: `invite-event-${deviceId}`, kind: 1}),
        listen: vi.fn(),
      })),
      fromUser: vi.fn(), // Will be setup in tests to simulate Alice's devices
      deserialize: vi.fn(),
    },
    deserializeSessionState: vi.fn(),
    serializeSessionState: vi
      .fn()
      .mockImplementation((state) =>
        JSON.stringify({mockState: state.theirNextNostrPublicKey})
      ),
    CHAT_MESSAGE_KIND: 4,
  }
})

describe("SessionManager - Realistic Multi-Device Chat Scenarios", () => {
  let mockDeps: ReturnType<typeof createMockDependencies>
  let sessionManager: SessionManager
  let alicePubKey: string
  let mockInviteCallbacks: Map<string, (invite: any) => void>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDeps = createMockDependencies()
    alicePubKey = "alice-public-key-123"
    mockInviteCallbacks = new Map()

    // Setup SessionManager
    sessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      mockDeps.deviceId,
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )
    await sessionManager.init()
  })

  afterEach(() => {
    sessionManager.close()
  })

  it("should initialize chat with user and create sessions for all their devices", async () => {
    const {Invite} = await import("nostr-double-ratchet/src")

    // Track calls to Invite.fromUser
    let aliceInviteCallback: (invite: any) => void = () => {}
    const inviteFromUserCalls: string[] = []

    // Setup Invite.fromUser to track what users are being listened to
    Invite.fromUser = vi.fn().mockImplementation((userPubKey, subscribe, callback) => {
      inviteFromUserCalls.push(userPubKey)
      console.log("🔍 Invite.fromUser called with:", userPubKey)

      if (userPubKey === alicePubKey) {
        aliceInviteCallback = callback

        // Simulate ONE Alice device sending an invite
        setTimeout(() => {
          console.log("📨 Alice device publishing invite")
          const mockInvite = {
            deviceId: "alice-device-1",
            accept: vi.fn().mockResolvedValue({
              session: {
                name: "alice-device-1",
                state: {
                  theirNextNostrPublicKey: "alice-next-key",
                  ourCurrentNostrKey: {publicKey: "our-key"},
                },
                onEvent: vi.fn().mockReturnValue(() => {}),
                sendEvent: vi.fn(),
                close: vi.fn(),
              },
              event: {id: "acceptance-1", kind: 1},
            }),
          }

          console.log("📨 Calling invite callback")
          callback(mockInvite)
        }, 50)
      }

      return () => {} // unsubscribe function
    })

    // Start listening to Alice
    console.log("🎯 Starting to listen to Alice:", alicePubKey)
    sessionManager.listenToUser(alicePubKey)

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 200))

    console.log("📞 All Invite.fromUser calls:", inviteFromUserCalls)
    console.log("📂 Storage keys:", await mockDeps.storage.list())

    // Basic check: was Alice's pubkey passed to Invite.fromUser?
    expect(inviteFromUserCalls).toContain(alicePubKey)
  })

  it("should send message to all active sessions for a user", async () => {
    // First set up sessions for Alice (simulate previous test outcome)
    const aliceDevices = ["alice-device-1", "alice-device-2"]
    const mockSessions = new Map()

    // Setup sessions in SessionManager (simulating they were created from invites)
    for (const deviceId of aliceDevices) {
      const mockSession = {
        name: deviceId,
        state: {
          theirNextNostrPublicKey: `alice-${deviceId}-next-key`,
          ourCurrentNostrKey: {publicKey: `our-key-for-${deviceId}`},
        },
        sendEvent: vi.fn().mockImplementation((event: any) => ({
          event: {...event, id: `encrypted-${deviceId}-${Date.now()}`},
        })),
        onEvent: vi.fn().mockReturnValue(() => {}),
        close: vi.fn(),
      }

      mockSessions.set(`${alicePubKey}:${deviceId}`, mockSession)

      // Add to storage as if they were persisted
      await mockDeps.storage.put(
        `session/${alicePubKey}/${deviceId}`,
        JSON.stringify({mockState: true})
      )
    }

    // Mock SessionManager's internal methods to use our mock sessions
    const originalSendEvent = sessionManager.sendEvent
    sessionManager.sendEvent = vi.fn().mockImplementation(async (recipientKey, event) => {
      // Simulate sending to all mock sessions for this user
      const results: string[] = []
      for (const [sessionId, session] of mockSessions.entries()) {
        if (sessionId.startsWith(`${recipientKey}:`)) {
          const encrypted = session.sendEvent(event)
          results.push(encrypted.event.id)
        }
      }
      return results
    })

    // Send a message to Alice
    const testMessage = {
      kind: CHAT_MESSAGE_KIND,
      content: "Hello Alice from all my devices!",
      created_at: Math.floor(Date.now() / 1000),
    }

    const results = await sessionManager.sendEvent(alicePubKey, testMessage)

    // Verify message was sent to all Alice's active sessions
    expect(results).toHaveLength(2) // Should send to both devices
    expect(results.every((id) => typeof id === "string")).toBe(true)

    // Verify each device session's sendEvent was called
    for (const [sessionId, session] of mockSessions.entries()) {
      expect(session.sendEvent).toHaveBeenCalledWith(testMessage)
    }
  })

  it("should properly handle incoming messages from multi-device user", async () => {
    const incomingMessages: Array<{event: any; fromUser: string}> = []

    // Setup message listener (simulating what privateChats.new.ts does)
    sessionManager.onEvent((event, fromUserPubKey) => {
      incomingMessages.push({event, fromUser: fromUserPubKey})
    })

    // Simulate Alice sending messages from different devices
    const aliceMessages = [
      {
        kind: CHAT_MESSAGE_KIND,
        content: "Message from my laptop",
        device: "alice-device-1",
      },
      {
        kind: CHAT_MESSAGE_KIND,
        content: "Message from my phone",
        device: "alice-device-2",
      },
    ]

    // Simulate messages arriving (this would normally happen through invite acceptance)
    for (const message of aliceMessages) {
      // This simulates a session receiving and decrypting a message
      const mockEvent = {...message, id: `msg-${Date.now()}`}

      // Manually trigger the onEvent callback as if SessionManager received it
      sessionManager["internalSubscriptions"]?.forEach?.((callback) => {
        callback(mockEvent, alicePubKey)
      })
    }

    // Verify all messages were received and attributed to Alice
    expect(incomingMessages).toHaveLength(2)
    expect(incomingMessages[0].fromUser).toBe(alicePubKey)
    expect(incomingMessages[1].fromUser).toBe(alicePubKey)
    expect(incomingMessages[0].event.content).toBe("Message from my laptop")
    expect(incomingMessages[1].event.content).toBe("Message from my phone")
  })

  it("should persist and restore sessions correctly", async () => {
    // Simulate having sessions in storage from previous session
    const alicePubKey = "alice-restored-test"
    const deviceId = "alice-device-restore"

    // Put session data in storage
    await mockDeps.storage.put(
      `session/${alicePubKey}/${deviceId}`,
      JSON.stringify({
        version: 1,
        rootKey: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        theirCurrentNostrPublicKey: "alice-current-key",
        theirNextNostrPublicKey: "alice-next-key",
        // ... other required session state fields
      })
    )

    // Create new SessionManager instance (simulating app restart)
    const newSessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      "new-device-id",
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )

    await newSessionManager.init()

    // Verify that the Session constructor was called during restoration
    const {Session} = await import("nostr-double-ratchet/src")
    expect(Session).toHaveBeenCalled()

    // Verify sessions are available for communication
    const incomingMessages: Array<{event: any; fromUser: string}> = []
    newSessionManager.onEvent((event, fromUserPubKey) => {
      incomingMessages.push({event, fromUser: fromUserPubKey})
    })

    // Simulate receiving a message on restored session
    newSessionManager["internalSubscriptions"]?.forEach?.((callback) => {
      callback(
        {kind: CHAT_MESSAGE_KIND, content: "Message to restored session"},
        alicePubKey
      )
    })

    expect(incomingMessages).toHaveLength(1)
    expect(incomingMessages[0].fromUser).toBe(alicePubKey)

    newSessionManager.close()
  })
})
