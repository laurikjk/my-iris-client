import SessionManager from "../../session/SessionManager"
import {VerifiedEvent} from "nostr-tools"
import {
  LocalStorageAdapter,
  LocalforageAdapter,
  migration,
} from "../../session/StorageAdapter"
import {NostrPublish, NostrSubscribe} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {useUserStore} from "../../stores/user"
import {hexToBytes} from "nostr-tools/utils"

const createSubscribe = (ndk: NDK): NostrSubscribe => {
  return (filter: NDKFilter, onEvent: (event: VerifiedEvent) => void) => {
    const subscription = ndk.subscribe(filter)

    subscription.on("event", (event: NDKEvent) => {
      console.warn("PrivateChats received event:", event.kind, event.id)
      onEvent(event as unknown as VerifiedEvent)
    })

    subscription.start()

    return () => {
      subscription.stop()
    }
  }
}

// NDK-compatible publish function - TODO: remove "as" by handling nostr-tools version mismatch between lib and app
const createPublish = (ndk: NDK): NostrPublish => {
  return (async (event) => {
    const e = new NDKEvent(ndk, event)
    console.warn("PrivateChats publishing event:", e)
    await e.publish()
    console.warn("PrivateChats published event:", e.kind, e.id, e.sig)
    return event
  }) as NostrPublish
}

const getOrCreateDeviceId = (): string => {
  let deviceId = localStorage.getItem("deviceId")
  if (!deviceId) {
    deviceId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    localStorage.setItem("deviceId", deviceId)
  }
  return deviceId
}

let manager: SessionManager | null = null

export const getSessionManager = (): SessionManager | null => {
  if (manager) return manager

  try {
    const {publicKey, privateKey} = useUserStore.getState()

    const encrypt = privateKey
      ? hexToBytes(privateKey)
      : async (plaintext: string, pubkey: string) => {
          if (window.nostr?.nip44) {
            return window.nostr.nip44.encrypt(pubkey, plaintext)
          }
          throw new Error("No nostr extension or private key")
        }

    const ndkInstance = ndk()

    const localStorageAdapter = new LocalStorageAdapter("private")
    const localforageAdapter = new LocalforageAdapter("private-chats/")

    migration(localStorageAdapter, localforageAdapter)().catch((error) => {
      console.error("Failed to migrate session storage:", error)
    })

    manager = new SessionManager(
      publicKey,
      encrypt,
      getOrCreateDeviceId(),
      createSubscribe(ndkInstance),
      createPublish(ndkInstance),
      localforageAdapter
    )

    return manager
  } catch (error) {
    console.error("Failed to create session manager:", error)
    return null
  }
}
