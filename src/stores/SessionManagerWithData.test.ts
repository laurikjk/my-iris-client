import {describe, it, expect, vi, beforeEach} from "vitest"
import SessionManager from "./SessionManager"
import {
  createMockDependencies,
  populateStorageWithSessions,
  populateStorageWithInvite,
} from "./test-utils/sessionManager"

// Mock the nostr-double-ratchet module
vi.mock("nostr-double-ratchet/src", async () => {
  const actual = await vi.importActual("nostr-double-ratchet/src")
  
  // Mock Session class
  const mockSession = {
    name: "mock-device-id",
    state: {
      theirNextNostrPublicKey: "mock-their-key",
      ourCurrentNostrKey: {publicKey: "mock-our-key"},
    },
    onEvent: vi.fn().mockReturnValue(() => {}),
    close: vi.fn(),
  }

  return {
    ...actual,
    Session: vi.fn().mockImplementation(() => mockSession),
    Invite: {
      createNew: vi.fn().mockImplementation((publicKey, deviceId) => ({
        deviceId,
        serialize: vi.fn().mockReturnValue("mock-serialized-invite"),
        getEvent: vi.fn().mockReturnValue({id: "mock-invite-event", kind: 1}),
        listen: vi.fn(),
      })),
      deserialize: vi.fn().mockReturnValue({
        deviceId: "existing-device",
        serialize: vi.fn().mockReturnValue("existing-serialized-invite"),
        getEvent: vi.fn().mockReturnValue({id: "existing-invite-event"}),
        listen: vi.fn(),
      }),
      fromUser: vi.fn(),
    },
    deserializeSessionState: vi.fn().mockReturnValue({
      theirNextNostrPublicKey: "mock-their-key",
      ourCurrentNostrKey: {publicKey: "mock-our-key"},
    }),
  }
})

describe("SessionManager - With Pre-populated Storage", () => {
  let mockDeps: ReturnType<typeof createMockDependencies>
  let sessionManager: SessionManager

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDeps = createMockDependencies()
  })

  it("should load existing sessions from storage and create UserRecords", async () => {
    // Pre-populate storage with session data
    await populateStorageWithSessions(mockDeps.storage, [
      {
        userPubKey: "alice123",
        deviceId: "device1",
      },
      {
        userPubKey: "alice123", 
        deviceId: "device2",
      },
      {
        userPubKey: "bob456",
        deviceId: "device1",
      },
    ])

    // Verify storage was populated
    const storageKeys = await mockDeps.storage.list("session/")
    expect(storageKeys).toContain("session/alice123/device1")
    expect(storageKeys).toContain("session/alice123/device2") 
    expect(storageKeys).toContain("session/bob456/device1")

    // Create SessionManager
    sessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      mockDeps.deviceId,
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )

    // Wait for initialization to load sessions
    await sessionManager.init()

    // Verify sessions were loaded (we can't directly access private properties,
    // but we can verify the side effects like storage access patterns)
    
    // The loadSessions method should have been called and processed our data
    // We can verify by checking that Session constructor was called
    // (6 times because init() gets called twice - once in constructor, once manually)
    const {Session} = await import("nostr-double-ratchet/src")
    expect(Session).toHaveBeenCalledTimes(6) // 3 sessions × 2 init calls

    // Manager should still create its own invite since we didn't provide one
    const invite = sessionManager.getInvite()
    expect(invite).toBeDefined()
  })

  it("should restore existing invite from storage instead of creating new one", async () => {
    // Pre-populate storage with existing invite
    await populateStorageWithInvite(mockDeps.storage, mockDeps.deviceId, "existing-invite-data")

    // Create SessionManager  
    sessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      mockDeps.deviceId,
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )

    // Wait for initialization
    await sessionManager.init()

    // Verify existing invite was loaded (not created new)
    const {Invite} = await import("nostr-double-ratchet/src")
    expect(Invite.deserialize).toHaveBeenCalledWith("existing-invite-data")
    expect(Invite.createNew).not.toHaveBeenCalled()

    // Verify invite was still published (even existing ones get republished)
    expect(mockDeps.nostrPublish).toHaveBeenCalledWith({
      id: "existing-invite-event",
    })

    // Manager should have the restored invite
    const invite = sessionManager.getInvite()
    expect(invite).toBeDefined()
    expect(invite.deviceId).toBe("existing-device")
  })
})