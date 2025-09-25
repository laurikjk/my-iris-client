import SessionManager from "../../session/SessionManager"
import {generateSecretKey, getPublicKey, VerifiedEvent} from "nostr-tools"
import {LocalStorageAdapter} from "../../session/StorageAdapter"
import {Rumor, NostrPublish, NostrSubscribe} from "nostr-double-ratchet"
import NDK, {NDKEvent, NDKPrivateKeySigner, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {useUserStore} from "../../stores/user"
import {getEncryptFunction} from "@/utils/nostrCrypto"

const createSubscribe = (ndk: NDK): NostrSubscribe => {
  return (filter: NDKFilter, onEvent: (event: VerifiedEvent) => void) => {
    const subscription = ndk.subscribe(filter)

    subscription.on("event", (event: NDKEvent) => {
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
    "alice-device-1",
    createSubscribe(ndkInstance),
    createPublish(ndkInstance),
    new LocalStorageAdapter("yeyeyeyeyyeyey")
  )

  return manager
}
