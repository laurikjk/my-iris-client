import {NDKUserProfile} from "@/lib/ndk"
import {getMainThreadDb} from "@/lib/ndk-cache/db"
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

  try {
    const db = getMainThreadDb()
    const profiles = await db.profiles.toArray()

    const processedData = [] as SearchResult[]
    for (const profile of profiles) {
      const name = profile.name || profile.username
      if (name) {
        processedData.push({
          pubKey: profile.pubkey,
          name: String(name),
          nip05: profile.nip05 || undefined,
        })
      }
    }

    searchIndex = new Fuse<SearchResult>(processedData, {
      keys: ["name", "nip05"],
      includeScore: true,
    })
    const duration = performance.now() - start
    log(`fuse init from dexie: ${duration.toFixed(2)} ms, ${profiles.length} profiles`)
  } catch (e) {
    error("Failed to initialize search index:", e)
  }
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
        searchIndex.remove((profile) => profile.pubKey === pubKey)
        searchIndex.add({name, pubKey, nip05})
      }
    }
  })
}
