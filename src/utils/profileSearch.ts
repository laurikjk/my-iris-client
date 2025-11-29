import {NDKUserProfile} from "@/lib/ndk"
import {getMainThreadDb} from "@/lib/ndk-cache/db"
import {createDebugLogger} from "./createDebugLogger"
import {DEBUG_NAMESPACES} from "./constants"

const {log, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export type SearchResult = {
  name: string
  pubKey: string
  nip05?: string
}

type WorkerResponse =
  | {type: "ready"}
  | {
      type: "searchResult"
      requestId: number
      results: Array<{item: SearchResult; score?: number}>
    }

const latestProfileEvents = new Map<string, number>()
let worker: Worker | null = null
let workerReady = false
let requestId = 0
const pendingSearches = new Map<
  number,
  {resolve: (results: Array<{item: SearchResult; score?: number}>) => void}
>()

// Queue for operations before worker is ready
const pendingOperations: Array<() => void> = []

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/search-worker.ts", import.meta.url), {
      type: "module",
    })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === "ready") {
        workerReady = true
        log("Search worker ready")
        // Process any pending operations
        for (const op of pendingOperations) {
          op()
        }
        pendingOperations.length = 0
      } else if (msg.type === "searchResult") {
        const pending = pendingSearches.get(msg.requestId)
        if (pending) {
          pending.resolve(msg.results)
          pendingSearches.delete(msg.requestId)
        }
      }
    }
    worker.onerror = (e) => {
      error("Search worker error:", e)
    }
  }
  return worker
}

function postToWorker(message: unknown) {
  const w = getWorker()
  if (workerReady) {
    w.postMessage(message)
  } else {
    pendingOperations.push(() => w.postMessage(message))
  }
}

async function initializeSearchIndex() {
  const start = performance.now()

  try {
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

    const w = getWorker()
    w.postMessage({type: "init", profiles: processedData})

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
          postToWorker({
            type: "add",
            profile: {
              pubKey: pubkey,
              name: String(name),
              nip05: profile.nip05 || undefined,
            },
          })
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

export function handleProfile(pubKey: string, profile: NDKUserProfile) {
  queueMicrotask(() => {
    const lastSeen = latestProfileEvents.get(pubKey) || 0
    if (profile.created_at && profile.created_at > lastSeen) {
      latestProfileEvents.set(pubKey, profile.created_at)
      const name = String(profile.name || profile.username)
      const nip05 = profile.nip05
      if (name) {
        postToWorker({
          type: "update",
          pubKey,
          profile: {name, pubKey, nip05},
        })
      }
    }
  })
}

/**
 * Search the index. Returns a promise that resolves with the search results.
 */
export function search(
  query: string
): Promise<Array<{item: SearchResult; score?: number}>> {
  return new Promise((resolve) => {
    const id = ++requestId
    pendingSearches.set(id, {resolve})
    postToWorker({type: "search", query, requestId: id})
  })
}
