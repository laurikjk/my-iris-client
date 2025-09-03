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

    const {onEvent: onEventBob, publicKey: bobPubkey} = await createMockSessionManager(
      "bob-device-1",
      sharedRelay
    )

    const chatMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice!",
      created_at: Math.floor(Date.now() / 1000),
    }

    await managerAlice.sendEvent(bobPubkey, chatMessage)

    expect(publishAlice).toHaveBeenCalled()
    expect(onEventBob).toHaveBeenCalled()
  })

  it("should sync messages across multiple devices", async () => {
    const sharedRelay = new MockRelay()

    const {
      manager: aliceDevice1,
      onEvent: onEventAliceDevice1,
      publicKey: alicePubkey,
      secretKey: aliceSecretKey,
    } = await createMockSessionManager("alice-device-1", sharedRelay)

    const {manager: aliceDevice2, onEvent: onEventAliceDevice2} =
      await createMockSessionManager("alice-device-2", sharedRelay, aliceSecretKey)

    const {
      manager: bobDevice1,
      onEvent: onEventBob,
      publicKey: bobPubkey,
    } = await createMockSessionManager("bob-device-1", sharedRelay)

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

    expect(onEventAliceDevice1).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hello Bob from Alice device 2",
      }),
      alicePubkey
    )
  })
})
