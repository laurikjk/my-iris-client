import {describe, it, expect, vi, beforeEach} from "vitest"
import SessionManager from "./SessionManager"
import {createMockDependencies} from "./test-utils/sessionManager"

// Mock the nostr-double-ratchet module to control Invite behavior
vi.mock("nostr-double-ratchet/src", async () => {
  const actual = await vi.importActual("nostr-double-ratchet/src")
  return {
    ...actual,
    Invite: {
      createNew: vi.fn().mockImplementation((publicKey, deviceId) => ({
        deviceId,
        serialize: vi.fn().mockReturnValue("mock-serialized-invite"),
        getEvent: vi.fn().mockReturnValue({id: "mock-invite-event", kind: 1}),
        listen: vi.fn(),
      })),
      fromUser: vi.fn(),
      deserialize: vi.fn(),
    },
  }
})

describe("SessionManager - Empty Storage", () => {
  let mockDeps: ReturnType<typeof createMockDependencies>
  let sessionManager: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeps = createMockDependencies()
  })

  it("should initialize with empty storage and create new invite", async () => {
    // Create SessionManager (constructor calls init() automatically)
    sessionManager = new SessionManager(
      mockDeps.ourIdentityKey,
      mockDeps.deviceId,
      mockDeps.nostrSubscribe,
      mockDeps.nostrPublish,
      mockDeps.storage
    )

    // Wait for initialization to complete
    await sessionManager.init()

    // Verify new invite was created and stored
    const storedInvite = await mockDeps.storage.get(`invite/${mockDeps.deviceId}`)
    expect(storedInvite).toBe("mock-serialized-invite")

    // Verify invite was published to nostr
    expect(mockDeps.nostrPublish).toHaveBeenCalledWith({
      id: "mock-invite-event",
      kind: 1,
    })

    // Verify manager has the invite available
    const invite = sessionManager.getInvite()
    expect(invite).toBeDefined()
    expect(invite.deviceId).toBe(mockDeps.deviceId)
  })

  it("should handle empty storage gracefully without crashing", async () => {
    // Ensure storage is completely empty
    expect(await mockDeps.storage.list()).toEqual([])

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

    // Manager should be in clean initialized state
    expect(sessionManager.getDeviceId()).toBe(mockDeps.deviceId)

    // Should have created and stored an invite (only thing in storage)
    const storageKeys = await mockDeps.storage.list()
    expect(storageKeys).toEqual([`invite/${mockDeps.deviceId}`])

    // Should not crash when trying to use manager
    expect(() => sessionManager.getInvite()).not.toThrow()
  })
})