import {describe, it, expect, vi, beforeEach, afterEach} from "vitest"
import SessionManager from "./SessionManager"
import {createMockDependencies} from "./test-utils/sessionManager"

// Mock the nostr-double-ratchet module to simulate real invite discovery
vi.mock("nostr-double-ratchet/src", async () => {
  const actual = await vi.importActual("nostr-double-ratchet/src")
  
  return {
    ...actual,
    Session: vi.fn(), // Will be mocked per test
    Invite: {
      createNew: vi.fn().mockImplementation((publicKey, deviceId) => ({
        deviceId,
        serialize: vi.fn().mockReturnValue(`invite-${deviceId}`),
        getEvent: vi.fn().mockReturnValue({id: `invite-event-${deviceId}`, kind: 1}),
        listen: vi.fn(),
      })),
      fromUser: vi.fn(), // Will be mocked per test to simulate Alice's invites
      deserialize: vi.fn(),
    },
    deserializeSessionState: vi.fn(),
    serializeSessionState: vi.fn().mockImplementation((state) => 
      JSON.stringify({mockState: state.theirNextNostrPublicKey})
    ),
    CHAT_MESSAGE_KIND: 4,
  }
})

describe.skip("SessionManager - End-to-End User Discovery & Communication", () => {
  let mockDeps: ReturnType<typeof createMockDependencies>
  let ourSessionManager: SessionManager
  let alicePubKey: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDeps = createMockDependencies()
    alicePubKey = "alice-public-key-for-e2e-test"

    // Initialize our SessionManager
    ourSessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      mockDeps.deviceId,
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )
    await ourSessionManager.init()
  })

  afterEach(() => {
    ourSessionManager.close()
  })

  it("should discover Alice's devices when she comes online and establish sessions", async () => {
    const {Invite} = await import("nostr-double-ratchet/src")
    
    // Mock Alice publishing invites from 2 devices
    const aliceDevices = ["alice-laptop", "alice-phone"]
    const acceptedInvites: string[] = []

    Invite.fromUser = vi.fn().mockImplementation((userPubKey, subscribe, callback) => {
      if (userPubKey === alicePubKey) {
        // Simulate Alice's devices coming online and publishing invites
        setTimeout(async () => {
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

            const mockInvite = {
              deviceId,
              accept: vi.fn().mockImplementation(async () => {
                acceptedInvites.push(deviceId)
                return {
                  session: mockSession,
                  event: {id: `acceptance-${deviceId}`, kind: 1},
                }
              }),
            }
            
            // Alice publishes invite for this device
            callback(mockInvite)
            
            // Small delay between devices
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }, 50)
      }
      
      return () => {} // unsubscribe function
    })

    // 🎯 Start listening for Alice (this is what happens when user opens Alice's chat)
    ourSessionManager.listenToUser(alicePubKey)
    
    // Wait for invite discovery and session establishment
    await new Promise(resolve => setTimeout(resolve, 200))

    // ✅ Verify Alice's invite discovery was initiated
    expect(Invite.fromUser).toHaveBeenCalledWith(
      alicePubKey,
      mockDeps.nostrSubscribe,
      expect.any(Function)
    )

    // ✅ Verify invites were accepted for both Alice's devices
    expect(acceptedInvites).toHaveLength(2)
    expect(acceptedInvites).toEqual(
      expect.arrayContaining(["alice-laptop", "alice-phone"])
    )

    // ✅ Verify sessions were stored in persistent storage
    const storageKeys = await mockDeps.storage.list("session/")
    expect(storageKeys).toContain(`session/${alicePubKey}/alice-laptop`)
    expect(storageKeys).toContain(`session/${alicePubKey}/alice-phone`)
  })

  it("should receive and decrypt messages from Alice's established sessions", async () => {
    const {Invite} = await import("nostr-double-ratchet/src")
    
    // Track received messages
    const receivedMessages: Array<{event: any, fromUser: string}> = []
    
    // Set up message listener (simulating UI integration)
    ourSessionManager.onEvent((event, fromUserPubKey) => {
      receivedMessages.push({event, fromUser: fromUserPubKey})
    })

    let sessionOnEventCallback: ((event: any) => void) | null = null

    // Setup Alice's invite acceptance that will trigger message flow
    Invite.fromUser = vi.fn().mockImplementation((userPubKey, subscribe, callback) => {
      if (userPubKey === alicePubKey) {
        setTimeout(() => {
          // Mock Alice's session that can send us messages
          const mockAliceSession = {
            name: "alice-laptop",
            state: {
              theirNextNostrPublicKey: "alice-laptop-next-key",
              ourCurrentNostrKey: {publicKey: "our-key-for-alice-laptop"},
            },
            sendEvent: vi.fn(),
            onEvent: vi.fn().mockImplementation((callback: (event: any) => void) => {
              // Store the callback from SessionManager so we can trigger it
              sessionOnEventCallback = callback
              // Simulate Alice sending us a message after session is established
              setTimeout(() => {
                const aliceMessage = {
                  kind: 4,
                  content: "Hello from Alice's laptop!",
                  created_at: Math.floor(Date.now() / 1000),
                  id: "alice-message-1"
                }
                callback(aliceMessage)
              }, 50)
              return () => {}
            }),
            close: vi.fn(),
          }

          const mockInvite = {
            deviceId: "alice-laptop",
            accept: vi.fn().mockResolvedValue({
              session: mockAliceSession,
              event: {id: "acceptance-alice-laptop", kind: 1},
            }),
          }
          callback(mockInvite)
        }, 50)
      }
      return () => {}
    })

    // 🎯 Establish session with Alice
    ourSessionManager.listenToUser(alicePubKey)
    
    // Wait for session establishment and message reception
    await new Promise(resolve => setTimeout(resolve, 300))

    // ✅ Verify we received Alice's message
    expect(receivedMessages).toHaveLength(1)
    expect(receivedMessages[0].fromUser).toBe(alicePubKey)
    expect(receivedMessages[0].event.content).toBe("Hello from Alice's laptop!")
    expect(receivedMessages[0].event.kind).toBe(4)
  })

  it("should handle multiple users coming online simultaneously", async () => {
    const {Invite} = await import("nostr-double-ratchet/src")
    
    const bobPubKey = "bob-public-key-for-e2e-test"
    const charlePubKey = "charlie-public-key-for-e2e-test"
    
    const allUsers = [
      {pubkey: alicePubKey, device: "alice-phone"},
      {pubkey: bobPubKey, device: "bob-laptop"}, 
      {pubkey: charlePubKey, device: "charlie-tablet"}
    ]

    // Track all accepted invites
    const acceptedInvites: string[] = []

    // Mock each user publishing their invite
    Invite.fromUser = vi.fn().mockImplementation((userPubKey, subscribe, callback) => {
      const user = allUsers.find(u => u.pubkey === userPubKey)
      if (user) {
        setTimeout(() => {
          const mockSession = {
            name: user.device,
            state: {
              theirNextNostrPublicKey: `${user.device}-next-key`,
              ourCurrentNostrKey: {publicKey: `our-key-for-${user.device}`},
            },
            sendEvent: vi.fn(),
            onEvent: vi.fn().mockReturnValue(() => {}),
            close: vi.fn(),
          }

          const mockInvite = {
            deviceId: user.device,
            accept: vi.fn().mockImplementation(async () => {
              acceptedInvites.push(`${user.pubkey}:${user.device}`)
              return {
                session: mockSession,
                event: {id: `acceptance-${user.device}`, kind: 1},
              }
            }),
          }
          
          callback(mockInvite)
        }, Math.random() * 100) // Random timing to simulate real network
      }
      return () => {}
    })

    // 🎯 Start listening to all users simultaneously
    ourSessionManager.listenToUser(alicePubKey)
    ourSessionManager.listenToUser(bobPubKey)  
    ourSessionManager.listenToUser(charlePubKey)
    
    // Wait for all sessions to establish
    await new Promise(resolve => setTimeout(resolve, 300))

    // ✅ Verify all users were discovered
    expect(Invite.fromUser).toHaveBeenCalledTimes(3)
    expect(Invite.fromUser).toHaveBeenCalledWith(alicePubKey, expect.any(Function), expect.any(Function))
    expect(Invite.fromUser).toHaveBeenCalledWith(bobPubKey, expect.any(Function), expect.any(Function))
    expect(Invite.fromUser).toHaveBeenCalledWith(charlePubKey, expect.any(Function), expect.any(Function))

    // ✅ Verify invites were accepted for all users
    expect(acceptedInvites).toHaveLength(3)
    expect(acceptedInvites).toEqual(
      expect.arrayContaining([
        `${alicePubKey}:alice-phone`,
        `${bobPubKey}:bob-laptop`,
        `${charlePubKey}:charlie-tablet`
      ])
    )
    
    // ✅ Verify all sessions were persisted
    const storageKeys = await mockDeps.storage.list("session/")
    expect(storageKeys).toContain(`session/${alicePubKey}/alice-phone`)
    expect(storageKeys).toContain(`session/${bobPubKey}/bob-laptop`)
    expect(storageKeys).toContain(`session/${charlePubKey}/charlie-tablet`)
  })

  it("should restore sessions after SessionManager restart and continue receiving messages", async () => {
    const {Session, serializeSessionState, deserializeSessionState} = await import("nostr-double-ratchet/src")
    
    // Pre-populate storage with Alice's session (simulating previous session)
    const aliceDeviceId = "alice-laptop-restored"
    const sessionKey = `session/${alicePubKey}/${aliceDeviceId}`
    const mockSessionState = {
      theirNextNostrPublicKey: "alice-restored-next-key",
      ourCurrentNostrKey: {publicKey: "our-restored-key"},
    }
    
    await mockDeps.storage.put(sessionKey, serializeSessionState(mockSessionState))

    // Mock deserialization
    deserializeSessionState.mockReturnValue(mockSessionState)
    
    // Track messages received after restoration
    const restoredMessages: Array<{event: any, fromUser: string}> = []
    
    // Mock restored session that can receive messages
    const mockRestoredSession = {
      name: aliceDeviceId,
      state: mockSessionState,
      sendEvent: vi.fn(),
      onEvent: vi.fn().mockImplementation((callback: (event: any) => void) => {
        // Simulate Alice sending message to restored session
        setTimeout(() => {
          callback({
            kind: 4,
            content: "Message to restored session!",
            created_at: Math.floor(Date.now() / 1000),
          })
        }, 100)
        return () => {}
      }),
      close: vi.fn(),
    }
    
    Session.mockImplementation(() => mockRestoredSession)

    // 🎯 Create new SessionManager (simulating app restart)
    const restoredSessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      "restored-device-id", 
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )
    
    // Set up message listener
    restoredSessionManager.onEvent((event, fromUserPubKey) => {
      restoredMessages.push({event, fromUser: fromUserPubKey})
    })
    
    await restoredSessionManager.init()
    
    // Wait for session restoration and message reception
    await new Promise(resolve => setTimeout(resolve, 200))

    // ✅ Verify session was restored from storage
    expect(deserializeSessionState).toHaveBeenCalledWith(expect.any(String))
    expect(Session).toHaveBeenCalled()
    
    // ✅ Verify restored session can receive messages  
    expect(restoredMessages).toHaveLength(1)
    expect(restoredMessages[0].fromUser).toBe(alicePubKey)
    expect(restoredMessages[0].event.content).toBe("Message to restored session!")

    restoredSessionManager.close()
  })
})