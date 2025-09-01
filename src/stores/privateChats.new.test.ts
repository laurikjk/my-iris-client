import {describe, it, expect, beforeEach, vi} from "vitest"
import {usePrivateChatsStoreNew} from "./privateChats.new"

// Mock dependencies
vi.mock("./user", () => ({
  useUserStore: {
    getState: () => ({privateKey: "test-private-key", publicKey: "test-public-key"}),
  },
}))

vi.mock("@/utils/ndk", () => ({
  ndk: () => ({
    subscribe: vi.fn(() => ({
      on: vi.fn(),
      stop: vi.fn(),
    })),
  }),
}))

vi.mock("localforage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    keys: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock("@/utils/messageRepository", () => ({
  upsert: vi.fn(),
  getById: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
}))

describe("PrivateChatsStoreNew", () => {
  beforeEach(async () => {
    // Reset store state before each test
    usePrivateChatsStoreNew.getState().reset()
    // Give zustand time to update
    await new Promise((resolve) => setTimeout(resolve, 10))
  })

  it("should initialize with empty state", () => {
    const store = usePrivateChatsStoreNew.getState()

    expect(store.messages.size).toBe(0)
    expect(store.chats.size).toBe(0)
    expect(store.userRecords.size).toBe(0)
    expect(store.isInitialized).toBe(false)
  })

  it("should provide getChatsList method", () => {
    const store = usePrivateChatsStoreNew.getState()
    const chatsList = store.getChatsList()

    expect(Array.isArray(chatsList)).toBe(true)
    expect(chatsList).toHaveLength(0)
  })

  it("should update last seen timestamp", () => {
    const userPubKey = "test-user-pubkey"

    usePrivateChatsStoreNew.getState().updateLastSeen(userPubKey)

    // Get fresh state after update
    const store = usePrivateChatsStoreNew.getState()
    const chat = store.chats.get(userPubKey)
    expect(chat).toBeDefined()
    expect(chat?.lastSeen).toBeGreaterThan(0)
  })

  it("should handle upsertMessage", async () => {
    const chatId = "test-chat-id"
    const message = {
      id: "test-message-id",
      kind: 14,
      content: "Hello world",
      created_at: Math.floor(Date.now() / 1000),
      pubkey: "test-pubkey",
      tags: [],
      reactions: {},
    }

    await usePrivateChatsStoreNew.getState().upsertMessage(chatId, message)

    // Get fresh state after update
    const store = usePrivateChatsStoreNew.getState()
    const messages = store.messages.get(chatId)
    expect(messages).toBeDefined()
    expect(messages?.get(message.id)).toEqual(message)
  })

  it("should provide reset functionality", () => {
    // Add some data
    usePrivateChatsStoreNew.getState().updateLastSeen("test-user")

    // Check data was added
    let store = usePrivateChatsStoreNew.getState()
    expect(store.chats.size).toBe(1)

    // Reset
    usePrivateChatsStoreNew.getState().reset()

    // Check data was cleared
    store = usePrivateChatsStoreNew.getState()
    expect(store.chats.size).toBe(0)
    expect(store.messages.size).toBe(0)
    expect(store.isInitialized).toBe(false)
  })
})
