import {NDKUserProfile} from "@/lib/ndk"
import {getMainThreadDb} from "@/lib/ndk-cache/db"
import {getWorkerTransport} from "@/utils/ndk"
import {createDebugLogger} from "./createDebugLogger"
import {DEBUG_NAMESPACES} from "./constants"

const {log, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export type SearchResult = {
  name: string
  pubKey: string
  nip05?: string
}

async function initializeSearchIndex() {
  const start = performance.now()

  try {
    const transport = getWorkerTransport()
    if (!transport) {
      error("Worker transport not available")
      return
    }

    const db = getMainThreadDb()
    const profiles = await db.profiles.toArray()

    const processedData: SearchResult[] = []
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

    await transport.initSearchIndex(processedData)

    const duration = performance.now() - start
    log(`fuse init from dexie: ${duration.toFixed(2)} ms, ${profiles.length} profiles`)

    queueMicrotask(() => populateFromSocialGraph())
  } catch (e) {
    error("Failed to initialize search index:", e)
  }
}

async function populateFromSocialGraph() {
  try {
    const transport = getWorkerTransport()
    if (!transport) return

    const {getSocialGraph} = await import("./socialGraph")
    const graph = getSocialGraph()
    const db = getMainThreadDb()

    const BATCH_SIZE = 50
    const DELAY_BETWEEN_BATCHES = 100

    let processed = 0
    let added = 0

    for (let distance = 0; distance <= 3; distance++) {
      const users = graph.getUsersByFollowDistance(distance)
      const batch: string[] = []

      for (const pubkey of users) {
        batch.push(pubkey)

        if (batch.length >= BATCH_SIZE) {
          const result = await processBatch(batch, db, transport)
          processed += result.processed
          added += result.added
          batch.length = 0
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }

      if (batch.length > 0) {
        const result = await processBatch(batch, db, transport)
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

async function processBatch(
  pubkeys: string[],
  db: ReturnType<typeof getMainThreadDb>,
  transport: NonNullable<ReturnType<typeof getWorkerTransport>>
) {
  let processed = 0
  let added = 0

  const profiles: SearchResult[] = []
  for (const pubkey of pubkeys) {
    processed++
    try {
      const profile = await db.profiles.get(pubkey)
      if (profile) {
        const name = profile.name || profile.username
        if (name) {
          profiles.push({
            pubKey: pubkey,
            name: String(name),
            nip05: profile.nip05 || undefined,
          })
          added++
        }
      }
    } catch {
      // Skip profiles that fail to load
    }
  }

  if (profiles.length > 0) {
    await transport.initSearchIndex(profiles)
  }

  return {processed, added}
}

initializeSearchIndex().catch(error)

// Profile events are now handled directly in relay-worker when kind 0 events arrive
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleProfile(pubKey: string, profile: NDKUserProfile) {}

export function search(
  query: string
): Promise<Array<{item: SearchResult; score?: number}>> {
  const transport = getWorkerTransport()
  if (!transport) {
    return Promise.resolve([])
  }
  return transport.search(query)
}
