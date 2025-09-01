import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {generateSecretKey} from "nostr-tools"

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
})
