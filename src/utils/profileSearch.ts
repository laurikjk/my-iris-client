import {NDKUserProfile} from "@/lib/ndk"
import {loadProfileCache, profileCache} from "./profileCache"
import Fuse from "fuse.js"
import {createDebugLogger} from "./createDebugLogger"
import {DEBUG_NAMESPACES} from "./constants"

const {log, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export type SearchResult = {
  name: string
  pubKey: string
  nip05?: string
}

const latestProfileEvents = new Map<string, number>()

let searchIndex: Fuse<SearchResult> = new Fuse<SearchResult>([], {
  keys: ["name", "nip05"],
  includeScore: true,
})

async function initializeSearchIndex() {
  const start = performance.now()
  // Wait for profiles to be loaded from cache or profileData.json
  await loadProfileCache()

  const processedData = [] as SearchResult[]
  profileCache.forEach((profile, pubKey) => {
    const name = profile.name || profile.username
    if (name) {
      processedData.push({
        pubKey: String(pubKey),
        name: String(name),
        nip05: profile.nip05 || undefined,
      })
    }
  })

  searchIndex = new Fuse<SearchResult>(processedData, {
    keys: ["name", "nip05"],
    includeScore: true,
  })
  const duration = performance.now() - start
  log(`fuse init: ${duration.toFixed(2)} ms`)
}

initializeSearchIndex().catch(error)

export {searchIndex}

export function handleProfile(pubKey: string, profile: NDKUserProfile) {
  queueMicrotask(() => {
    const lastSeen = latestProfileEvents.get(pubKey) || 0
    if (profile.created_at && profile.created_at > lastSeen) {
      latestProfileEvents.set(pubKey, profile.created_at)
      const name = String(profile.name || profile.username)
      const nip05 = profile.nip05
      if (name) {
        // not sure if this remove is efficient?
        // should we have our internal map and reconstruct the searchIndex from it with debounce?
        searchIndex.remove((profile) => profile.pubKey === pubKey)
        searchIndex.add({name, pubKey, nip05})
      }
    }
  })
}
