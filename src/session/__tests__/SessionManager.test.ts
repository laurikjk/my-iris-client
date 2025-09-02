import {describe, it, expect, vi} from "vitest"
import SessionManager from "../SessionManager"
import {
  Filter,
  generateSecretKey,
  getPublicKey,
  UnsignedEvent,
  VerifiedEvent,
} from "nostr-tools"
import {serializeSessionState, Invite} from "nostr-double-ratchet/src"
import {Rumor} from "nostr-double-ratchet"
import {KIND_CHAT_MESSAGE} from "../../utils/constants"
import {InMemoryStorageAdapter} from "../StorageAdapter"
import {NDKEvent} from "@nostr-dev-kit/ndk"

// const nostrSubscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
//   const sub = ndk().subscribe(filter)
//   sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
//   return () => sub.stop()
// }
//
// const nostrPublish = async (event: UnsignedEvent) => {
//   const ndkEvent = new NDKEvent()
//   ndkEvent.ndk = ndk()
//   ndkEvent.kind = event.kind
//   ndkEvent.content = event.content
//   ndkEvent.tags = event.tags
//   ndkEvent.created_at = event.created_at
//   ndkEvent.pubkey = event.pubkey
//
//   await ndkEvent.publish()
//
//   // Return the event as VerifiedEvent format for SessionManager
//   return {
//     ...event,
//     id: ndkEvent.id,
//     sig: ndkEvent.sig || "",
//   } as VerifiedEvent
// }

describe("SessionManager", () => {
  const subscriptionMap = new Map<string, (event: VerifiedEvent) => void>()

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
        filter.authors?.forEach((author) => {
          console.log("user", publicKey, "subscribing to author:", author)
          subscriptionMap.set(author, onEvent)
        })
        return () => {} // empty sub stop function
      })
    const publish = vi.fn().mockImplementation(async (event: UnsignedEvent) => {
      const ndkEvent = new NDKEvent()
      ndkEvent.kind = event.kind
      ndkEvent.content = event.content
      ndkEvent.tags = event.tags
      ndkEvent.created_at = event.created_at
      ndkEvent.pubkey = event.pubkey

      const onEvent = subscriptionMap.get(event.pubkey)

      console.log(
        "Publishing event to deviceId:",
        deviceId,
        "onEvent exists:",
        !!onEvent,
        onEvent
      )
      if (onEvent) {
        onEvent({
          ...event,
          id: ndkEvent.id || "mock-id",
          sig: ndkEvent.sig || "mock-sig",
        } as VerifiedEvent)
      }
      return {
        ...event,
        id: ndkEvent.id || "mock-id",
        sig: ndkEvent.sig || "mock-sig",
      } as VerifiedEvent
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
    }
  }

  it("should receive a message", async () => {
    const {
      manager: managerAlice,
      subscribe: subAlice,
      publish: publishAlice,
      onEvent: onEventAlice,
      publicKey: alicePubkey,
      secretKey: aliceSeckey,
    } = await createMockSessionManager("alice-device-1")

    const {
      manager: managerBob,
      subscribe: subBob,
      publish: publishBob,
      onEvent: onEventBob,
      publicKey: bobPubkey,
      secretKey: bobSeckey,
    } = await createMockSessionManager("bob-device-1")

    const chatMessage: Partial<Rumor> = {
      kind: KIND_CHAT_MESSAGE,
      content: "Hello Bob from Alice!",
      created_at: Math.floor(Date.now() / 1000),
    }

    managerAlice.sendEvent(bobPubkey, chatMessage)

    expect(publishAlice).toHaveBeenCalled()

    expect(onEventBob).toHaveBeenCalled()
  })
})
