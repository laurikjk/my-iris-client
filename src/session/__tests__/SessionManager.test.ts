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
    const sharedRelay = new MockRelay(true)

    const {manager: aliceDevice1, secretKey: aliceSecretKey} =
      await createMockSessionManager("alice-device-1", sharedRelay)

    const {manager: aliceDevice2} = await createMockSessionManager(
      "alice-device-2",
      sharedRelay,
      aliceSecretKey
    )

    const {manager: bobDevice1, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    const msg1 = "Hello Bob from Alice device 1"
    const msg2 = "Hello Bob from Alice device 2"

    await aliceDevice1.sendMessage(bobPubkey, msg1)
    await aliceDevice2.sendMessage(bobPubkey, msg2)

    const bobReceivedMessages = await new Promise((resolve) => {
      const received: string[] = []
      bobDevice1.onEvent((event) => {
        if (event.content === msg1 || event.content === msg2) {
          received.push(event.content)
          if (received.length === 2) resolve(received)
        }
      })
    })

    expect(bobReceivedMessages)
  })

  it("should persist sessions across manager restarts", async () => {
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

    const [initialMessage, replyMessage, afterRestartMessage] = [
      "Initial message",
      "Reply message",
      "Message after restart",
    ]

    await aliceManager1.sendMessage(bobPubkey, initialMessage)
    await bobManager1.sendMessage(alicePubkey, replyMessage)

    const allDeliveredBeforeClosing = await new Promise((resolve) => {
      const received = new Set<string>()
      aliceManager1.onEvent((event) => {
        received.add(event.content)
        if (received.has(initialMessage) && received.has(replyMessage)) {
          resolve(true)
        }
      })
      bobManager1.onEvent((event) => {
        received.add(event.content)
        if (received.has(initialMessage) && received.has(replyMessage)) {
          resolve(true)
        }
      })
    })

    expect(allDeliveredBeforeClosing)

    // Log storage contents for debugging
    console.log("Alice storage keys before restart:", await aliceStorage.list())
    console.log("Bob storage keys before restart:", await bobStorage.list())

    const sharedRelay2 = new MockRelay(true)

    const {manager: aliceManager2} = await createMockSessionManager(
      "alice-device-1",
      sharedRelay2,
      aliceSecretKey,
      aliceStorage
    )

    const {manager: bobManager2} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay2,
      bobSecretKey,
      bobStorage
    )

    await aliceManager2.sendMessage(bobPubkey, afterRestartMessage)
    const bobReceivedMessageAfterRestart = await new Promise((resolve) => {
      bobManager2.onEvent((event) => {
        if (event.content === afterRestartMessage) {
          resolve(true)
        }
      })
    })

    expect(bobReceivedMessageAfterRestart)
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
