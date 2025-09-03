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
import {NDKEvent, NDKPrivateKeySigner} from "@nostr-dev-kit/ndk"

// Helpers
function eventMatchesFilter(event: VerifiedEvent, filter: Filter): boolean {
  // Check kinds
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false

  // Check authors
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false

  // Check tag filters (#p, #e, #d, etc.)
  for (const [key, values] of Object.entries(filter)) {
    if (key.startsWith("#")) {
      const tagName = key.substring(1)
      const eventTagValues =
        event.tags?.filter((tag) => tag[0] === tagName).map((tag) => tag[1]) || []

      const hasMatch = (values as string[]).some((requiredValue) =>
        eventTagValues.includes(requiredValue)
      )

      if (!hasMatch) return false
    }
  }

  return true
}

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
  const subscriptions = new Map<
    string,
    {
      callback: (event: VerifiedEvent) => void
      filter: Filter
      userId: string
    }
  >()
  const eventStore = new Map<string, VerifiedEvent[]>() // Store events by pubkey
  let subscriptionCounter = 0

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
        const subId = `sub-${++subscriptionCounter}`

        // Store the subscription with complete filter
        subscriptions.set(subId, {
          callback: onEvent,
          filter: filter,
          userId: publicKey,
        })

        eventStore.forEach((events, pubkey) => {
          events.forEach((event) => {
            if (eventMatchesFilter(event, filter)) {
              onEvent(event)
            }
          })
        })

        return () => {
          subscriptions.delete(subId)
        }
      })
    const publish = vi.fn().mockImplementation(async (event: UnsignedEvent) => {
      // Use NDK to sign the event properly
      const ndkEvent = new NDKEvent()
      ndkEvent.kind = event.kind
      ndkEvent.content = event.content
      ndkEvent.tags = event.tags
      ndkEvent.created_at = event.created_at
      ndkEvent.pubkey = event.pubkey

      // Create a signer and sign the event
      const signer = new NDKPrivateKeySigner(secretKey)
      await ndkEvent.sign(signer)

      const verifiedEvent = {
        ...event,
        id: ndkEvent.id!,
        sig: ndkEvent.sig!,
      } as VerifiedEvent

      // Store the event
      if (!eventStore.has(event.pubkey)) {
        eventStore.set(event.pubkey, [])
      }
      eventStore.get(event.pubkey)!.push(verifiedEvent)

      // Route to ALL matching subscriptions
      let deliveredCount = 0
      const matchingSubscriptions: string[] = []

      subscriptions.forEach((sub, subId) => {
        if (eventMatchesFilter(verifiedEvent, sub.filter)) {
          console.log(
            `Delivering event ${event.kind} to subscription ${subId} (${sub.userId})`
          )
          sub.callback(verifiedEvent)
          deliveredCount++
          matchingSubscriptions.push(subId)
        }
      })

      console.log(
        "Publishing event - kind:",
        event.kind,
        "pubkey:",
        event.pubkey,
        "id:",
        ndkEvent.id,
        "delivered to:",
        deliveredCount,
        "subscriptions:",
        matchingSubscriptions
      )

      return verifiedEvent
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

    await managerAlice.sendEvent(bobPubkey, chatMessage)

    expect(publishAlice).toHaveBeenCalled()
    expect(onEventBob).toHaveBeenCalled()
  })
})
