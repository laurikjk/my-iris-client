import {describe, it, expect} from "vitest"
import {Rumor} from "nostr-double-ratchet"
import {KIND_CHAT_MESSAGE} from "../../utils/constants"
import {createMockSessionManager} from "./helpers/mockSessionManager"
import {MockRelay} from "./helpers/mockRelay"

describe("SessionManager", () => {
  it("should receive a message", async () => {
    const sharedRelay = new MockRelay()
    
    const {manager: managerAlice, publish: publishAlice} =
      await createMockSessionManager("alice-device-1", sharedRelay)

    const {onEvent: onEventBob, publicKey: bobPubkey} =
      await createMockSessionManager("bob-device-1", sharedRelay)

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
