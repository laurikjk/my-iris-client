import SessionManager from "../../session/SessionManager"
import {generateSecretKey, getPublicKey, VerifiedEvent} from "nostr-tools"
import {LocalStorageAdapter} from "../../session/StorageAdapter"
import {Rumor, NostrPublish, NostrSubscribe} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKPrivateKeySigner, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {useUserStore} from "../../stores/user"
import {getEncryptFunction} from "@/utils/nostrCrypto"


// TODO: this should not be needed
const seenEvents = new Set<string>()
const persistSeenEvents = () => {
  localStorage.setItem("seenEvents", JSON.stringify(Array.from(seenEvents)))
}

const createSubscribe = (ndk: NDK): NostrSubscribe => {
  return (filter: NDKFilter, onEvent: (event: VerifiedEvent) => void) => {
    const subscription = ndk.subscribe(filter)

    subscription.on("event", (event: NDKEvent) => {
      if (seenEvents.size <= 0) {
        const stored = localStorage.getItem("seenEvents")
        if (stored) {
          const parsed: string[] = JSON.parse(stored)
          parsed.forEach((id) => seenEvents.add(id))
        }
      }

      if (seenEvents.has(event.id)) return
      seenEvents.add(event.id)
      persistSeenEvents()
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
    await e.publish()
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

export const getSessionManager = () => {
  if (manager) return manager

  const privateKey = useUserStore.getState().privateKey
  if (!privateKey) throw new Error("No private key")

  // TODO: support encrypt function
  const privateKeyOrEncryptFunction = getEncryptFunction(privateKey)
  if (typeof privateKeyOrEncryptFunction === "function")
    throw new Error("Encrypt function not supported")

  const ndkInstance = ndk()

  manager = new SessionManager(
    privateKeyOrEncryptFunction,
    getOrCreateDeviceId(),
    createSubscribe(ndkInstance),
    createPublish(ndkInstance),
    new LocalStorageAdapter("private")
  )

  return manager
}
