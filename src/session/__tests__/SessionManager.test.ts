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

    const bobReceivedMessageAfterRestart = new Promise((resolve) => {
      bobManager2.onEvent((event) => {
        if (event.content === afterRestartMessage) {
          resolve(true)
        }
      })
    })

    await aliceManager2.sendMessage(bobPubkey, afterRestartMessage)

    expect(await bobReceivedMessageAfterRestart)
  })

  it("should not accumulate additional sessions after restart", async () => {
    const sharedRelay = new MockRelay(true)

    const {
      manager: aliceManager,
      secretKey: aliceSecretKey,
      publicKey: alicePubkey,
      mockStorage: aliceStorage,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {
      manager: bobManager,
      secretKey: bobSecretKey,
      publicKey: bobPubkey,
      mockStorage: bobStorage,
    } = await createMockSessionManager("bob-device-1", sharedRelay)

    console.log("Initialized devices")

    const [msg1, msg2] = ["hello bob", "hello alice"]

    const messagesReceivedBob = new Promise<void>((resolve) => {
      bobManager.onEvent((event) => {
        if (event.content === msg1) {
          resolve()
        }
      })
    })

    const messagesReceivedAlice = new Promise<void>((resolve) => {
      aliceManager.onEvent((event) => {
        if (event.content === msg2) {
          resolve()
        }
      })
    })

    console.log("\n\n\n Sesnigng initial messages")
    await aliceManager.sendMessage(bobPubkey, msg1)
    await bobManager.sendMessage(alicePubkey, msg2)

    await Promise.all([messagesReceivedBob, messagesReceivedAlice])

    aliceManager.close()
    bobManager.close()

    console.log("\n\n\nClosed managers")

    const {manager: aliceManagerRestart} = await createMockSessionManager(
      "alice-device-1",
      sharedRelay,
      aliceSecretKey,
      aliceStorage
    )

    const {manager: bobManagerRestart} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay,
      bobSecretKey,
      bobStorage
    )

    console.log("Restarted managers")

    const afterRestartMessage = "after restart"

    const bobReveivedMessages = new Promise<void>((resolve) => {
      bobManagerRestart.onEvent((event) => {
        if (event.content === afterRestartMessage) {
          resolve()
        }
      })
    })

    await aliceManagerRestart.sendMessage(bobPubkey, "after restart")
    await bobReveivedMessages

    console.log("a", aliceManagerRestart.getAllDeviceRecords())
    console.log("b", bobManagerRestart.getAllDeviceRecords())
  })
})
