import {NDKEvent, NDKUserProfile} from "@nostr-dev-kit/ndk"
import {SortedMap} from "./SortedMap/SortedMap"
import {LRUCache} from "typescript-lru-cache"
import throttle from "lodash/throttle"
import localforage from "localforage"

export const eventsByIdCache = new LRUCache({maxSize: 500})
export const feedCache = new LRUCache<string, SortedMap<string, NDKEvent>>({maxSize: 10})
export const seenEventIds = new LRUCache<string, boolean>({maxSize: 10000})
export const profileCache = new LRUCache<string, NDKUserProfile>({maxSize: 100000})

// Cache for NIP-05 verification results
export const nip05VerificationCache = new LRUCache<string, boolean>({maxSize: 1000})

// Cache for imgproxy failures - track URLs that failed to load through proxy
export const imgproxyFailureCache = new LRUCache<string, boolean>({maxSize: 100})

// Load seenEventIds from localForage
localforage
  .getItem<string[]>("seenEventIds")
  .then((s) => {
    if (s) {
      s.forEach((id) => seenEventIds.set(id, true))
    }
  })
  .catch((e) => {
    console.error("failed to load seenEventIds:", e)
  })

// Load profileCache from localForage
localforage
  .getItem<[string, NDKUserProfile][]>("profileCache")
  .then((profiles) => {
    if (profiles) {
      profiles.forEach(([pubkey, profile]) => profileCache.set(pubkey, profile))
    }
  })
  .catch((e) => {
    console.error("failed to load profileCache:", e)
  })

const throttledSave = throttle(
  () => localforage.setItem("seenEventIds", [...seenEventIds.keys()]),
  5000
)

const throttledSaveProfiles = throttle(
  () => localforage.setItem("profileCache", [...profileCache.entries()]),
  5000
)

export const addSeenEventId = (id: string) => {
  seenEventIds.set(id, true)
  throttledSave()
}

export const addCachedProfile = (pubkey: string, profile: NDKUserProfile) => {
  profileCache.set(pubkey, profile)
  throttledSaveProfiles()
}
