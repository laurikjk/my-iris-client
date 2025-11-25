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
const indexedPubkeys = new Set<string>()

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
        indexedPubkeys.add(profile.pubkey)
      }
    }

    searchIndex = new Fuse<SearchResult>(processedData, {
      keys: ["name", "nip05"],
      includeScore: true,
    })
    const duration = performance.now() - start
    log(`fuse init from dexie: ${duration.toFixed(2)} ms, ${profiles.length} profiles`)

    // Start populating from social graph after initial index is ready
    queueMicrotask(() => populateFromSocialGraph())
  } catch (e) {
    error("Failed to initialize search index:", e)
  }
}

/**
 * Populate search index from social graph users in a non-blocking way.
 * Processes users in batches by follow distance.
 */
async function populateFromSocialGraph() {
  try {
    const {getSocialGraph} = await import("./socialGraph")
    const graph = getSocialGraph()
    const db = getMainThreadDb()

    const BATCH_SIZE = 50
    const DELAY_BETWEEN_BATCHES = 100 // ms

    let processed = 0
    let added = 0

    // Process users by follow distance (closer users first)
    for (let distance = 0; distance <= 3; distance++) {
      const users = graph.getUsersByFollowDistance(distance)
      const batch: string[] = []

      for (const pubkey of users) {
        // Skip if already in index
        if (indexedPubkeys.has(pubkey)) continue

        batch.push(pubkey)

        // Process batch when full
        if (batch.length >= BATCH_SIZE) {
          const result = await processBatch(batch, db)
          processed += result.processed
          added += result.added
          batch.length = 0

          // Yield to main thread
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }

      // Process remaining batch
      if (batch.length > 0) {
        const result = await processBatch(batch, db)
        processed += result.processed
        added += result.added
      }
    }

    if (added > 0) {
      log(`Added ${added}/${processed} profiles from social graph to search index`)
    }
  } catch (e) {
    error("Failed to populate from social graph:", e)
  }
}

async function processBatch(pubkeys: string[], db: ReturnType<typeof getMainThreadDb>) {
  let processed = 0
  let added = 0

  for (const pubkey of pubkeys) {
    processed++

    try {
      const profile = await db.profiles.get(pubkey)
      if (profile) {
        const name = profile.name || profile.username
        if (name) {
          searchIndex.add({
            pubKey: pubkey,
            name: String(name),
            nip05: profile.nip05 || undefined,
          })
          indexedPubkeys.add(pubkey)
          added++
        }
      }
    } catch (e) {
      // Skip profiles that fail to load
    }
  }

  return {processed, added}
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
        indexedPubkeys.add(pubKey)
      }
    }
  })
}
