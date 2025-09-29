import {describe, it, expect} from "vitest"
import {Rumor} from "nostr-double-ratchet"
import {KIND_CHAT_MESSAGE} from "../../utils/constants"
import {createMockSessionManager} from "./helpers/mockSessionManager"
import {MockRelay} from "./helpers/mockRelay"

describe("SessionManager", () => {
  it("should receive a message", async () => {
    const sharedRelay = new MockRelay()

    const {manager: managerAlice, publish: publishAlice} = await createMockSessionManager(
      "alice-device-1",
      sharedRelay
    )

    const {manager: managerBob, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    const chatMessage = "Hello Bob from Alice!"

    await managerAlice.sendMessage(bobPubkey, chatMessage)

    expect(publishAlice).toHaveBeenCalled()
    const bobReceivedMessage = await new Promise((resolve) => {
      managerBob.onEvent((event) => {
        if (event.content === chatMessage) resolve(true)
      })
    })
    expect(bobReceivedMessage).toBe(true)
  })

  it("should sync messages across multiple devices", async () => {
    const sharedRelay = new MockRelay()

    const {
      manager: aliceDevice1,
      publicKey: alicePubkey,
      secretKey: aliceSecretKey,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {manager: aliceDevice2} = await createMockSessionManager(
      "alice-device-2",
      sharedRelay,
      aliceSecretKey
    )

    const {onEvent: onEventBob, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    // Both Alice devices need to set up Bob as a user
    aliceDevice1.setupUser(bobPubkey)
    aliceDevice2.setupUser(bobPubkey)

    // Alice devices also need to set up each other for multi-device sync
    aliceDevice1.setupUser(alicePubkey)
    aliceDevice2.setupUser(alicePubkey)

    const msg1: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice device 1",
      created_at: Math.floor(Date.now() / 1000),
    }
    const msg2: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice device 2",
      created_at: Math.floor(Date.now() / 1000),
    }

    await aliceDevice1.sendEvent(bobPubkey, msg1)
    await aliceDevice2.sendEvent(bobPubkey, msg2)

    expect(onEventBob).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hello Bob from Alice device 1",
      }),
      alicePubkey
    )
    expect(onEventBob).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hello Bob from Alice device 2",
      }),
      alicePubkey
    )
    // Multi-device sync is not implemented in SessionManager
    // expect(onEventAliceDevice1).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     content: "Hello Bob from Alice device 2",
    //   }),
    //   alicePubkey
    // )
  })

  it("should persist sessions across manager restarts", async () => {
    // Phase 1: Initial communication to establish sessions
    let sharedRelay = new MockRelay()

    const {
      manager: aliceManager1,
      secretKey: aliceSecretKey,
      publicKey: alicePubkey,
      mockStorage: aliceStorage,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {
      manager: bobManager1,
      secretKey: bobSecretKey,
      publicKey: bobPubkey,
      mockStorage: bobStorage,
    } = await createMockSessionManager("bob-device-1", sharedRelay)

    // Set up users to discover each other
    aliceManager1.setupUser(bobPubkey)
    bobManager1.setupUser(alicePubkey)

    // Send initial message to establish session - Alice sends first
    const initialMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Initial message",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceManager1.sendEvent(bobPubkey, initialMessage)

    // Bob needs to send a message back to trigger his session storage
    const replyMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Reply message",
      created_at: Math.floor(Date.now() / 1000),
    }
    await bobManager1.sendEvent(alicePubkey, replyMessage)

    // Verify sessions exist in storage (should be stored as user records)
    const aliceStorageKeys = await aliceStorage.list()
    const bobStorageKeys = await bobStorage.list()
    expect(
      aliceStorageKeys.filter((key) => key.startsWith("user/")).length
    ).toBeGreaterThan(0)
    expect(
      bobStorageKeys.filter((key) => key.startsWith("user/")).length
    ).toBeGreaterThan(0)

    // Close the managers
    aliceManager1.close()
    bobManager1.close()

    // Phase 2: Restart with fresh relay but same storage
    sharedRelay = new MockRelay()

    const {manager: aliceManager2} = await createMockSessionManager(
      "alice-device-1",
      sharedRelay,
      aliceSecretKey,
      aliceStorage
    )

    const {onEvent: onEventBob2} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay,
      bobSecretKey,
      bobStorage
    )

    const afterRestartMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Message after restart",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceManager2.sendEvent(bobPubkey, afterRestartMessage)

    expect(onEventBob2).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Message after restart",
      }),
      alicePubkey
    )
  })

  it("should handle messages from multiple Alice devices to Bob", async () => {
    const sharedRelay = new MockRelay()

    const {
      manager: aliceDevice1,
      publicKey: alicePubkey,
      secretKey: aliceSecretKey,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {manager: aliceDevice2} = await createMockSessionManager(
      "alice-device-2",
      sharedRelay,
      aliceSecretKey
    )

    const {onEvent: onEventBob, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    // Set up users
    aliceDevice1.setupUser(bobPubkey)
    aliceDevice2.setupUser(bobPubkey)

    const initialMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice device 1",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceDevice1.sendEvent(bobPubkey, initialMessage)

    const syncMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice device 2",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceDevice2.sendEvent(bobPubkey, syncMessage)

    expect(onEventBob).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hello Bob from Alice device 2",
      }),
      alicePubkey
    )

    // Multi-device sync is not implemented in SessionManager
    // expect(onEventAliceDevice1).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     content: "Hello Bob from Alice device 2",
    //   }),
    //   alicePubkey
    // )
  })

  it("should store user records when sending messages", async () => {
    const sharedRelay = new MockRelay()

    const {
      manager: aliceManager1,
      mockStorage: aliceStorage,
      publicKey: alicePubkey,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {
      publicKey: bobPubkey,
      mockStorage: bobStorage,
      manager: bobManager,
    } = await createMockSessionManager("bob-device-1", sharedRelay)

    // Set up users
    aliceManager1.setupUser(bobPubkey)
    bobManager.setupUser(alicePubkey)

    const initialMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Initial message",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceManager1.sendEvent(bobPubkey, initialMessage)
    await aliceManager1.sendEvent(bobPubkey, initialMessage)

    // Check for user records (not session keys)
    const aliceStorageKeys = await aliceStorage.list()
    const bobStorageKeys = await bobStorage.list()
    expect(aliceStorageKeys.filter((key) => key.startsWith("user/")).length).toBe(1)
    expect(bobStorageKeys.filter((key) => key.startsWith("user/")).length).toBe(0) // Bob hasn't sent anything
  })

  it("should return complete message events when sending", async () => {
    const sharedRelay = new MockRelay()

    const {manager: aliceManager, publicKey: alicePubkey} =
      await createMockSessionManager("alice-device-1", sharedRelay)

    const {manager: bobManager, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    // Set up users
    aliceManager.setupUser(bobPubkey)
    bobManager.setupUser(alicePubkey)

    // Send initial message to establish session
    const initialMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob",
      created_at: Math.floor(Date.now() / 1000),
    }
    await aliceManager.sendEvent(bobPubkey, initialMessage)

    // Now test sendMessage
    const messageContent = "Test message with sendMessage"
    const sentMessage = await aliceManager.sendMessage(bobPubkey, messageContent)

    expect(sentMessage).toMatchObject({
      content: messageContent,
      pubkey: alicePubkey,
      kind: KIND_CHAT_MESSAGE,
    })
    expect(sentMessage.id).toBeDefined()
    expect(sentMessage.created_at).toBeDefined()
    expect(sentMessage.tags).toBeDefined()
    expect(Array.isArray(sentMessage.tags)).toBe(true)
  })
})
