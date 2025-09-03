import {describe, it, expect, vi, beforeEach} from "vitest"
import SessionManager from "../SessionManager"
import {
  Filter,
  generateSecretKey,
  getPublicKey,
  UnsignedEvent,
  VerifiedEvent,
} from "nostr-tools"
import {Rumor} from "nostr-double-ratchet"
import {KIND_CHAT_MESSAGE} from "../../utils/constants"
import {InMemoryStorageAdapter} from "../StorageAdapter"
import {MockRelay} from "./helpers/mockRelay"

describe("SessionManager", () => {
  let mockRelay: MockRelay

  beforeEach(() => {
    mockRelay = new MockRelay()
  })

  const createMockSessionManager = async (deviceId: string) => {
    const secretKey = generateSecretKey()
    const publicKey = getPublicKey(secretKey)

    const mockStorage = new InMemoryStorageAdapter()
    const storageSpy = {
      get: vi.spyOn(mockStorage, "get"),
      del: vi.spyOn(mockStorage, "del"),
      put: vi.spyOn(mockStorage, "put"),
      list: vi.spyOn(mockStorage, "list"),
    }

    const subscribe = vi
      .fn()
      .mockImplementation((filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
        return mockRelay.subscribe(filter, onEvent)
      })

    const publish = vi.fn().mockImplementation(async (event: UnsignedEvent) => {
      return await mockRelay.publish(event, secretKey)
    })

    const manager = new SessionManager(
      secretKey,
      deviceId,
      subscribe,
      publish,
      mockStorage
    )

    await manager.init()

    const onEvent = vi.fn()
    manager.onEvent(onEvent)

    return {
      manager,
      subscribe,
      publish,
      onEvent,
      mockStorage,
      storageSpy,
      secretKey,
      publicKey,
      relay: mockRelay,
    }
  }

  it("should receive a message", async () => {
    const {manager: managerAlice, publish: publishAlice} =
      await createMockSessionManager("alice-device-1")

    const {onEvent: onEventBob, publicKey: bobPubkey} =
      await createMockSessionManager("bob-device-1")

    const chatMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice!",
      created_at: Math.floor(Date.now() / 1000),
    }

    await managerAlice.sendEvent(bobPubkey, chatMessage)

    expect(publishAlice).toHaveBeenCalled()
    expect(onEventBob).toHaveBeenCalled()
  })
})
