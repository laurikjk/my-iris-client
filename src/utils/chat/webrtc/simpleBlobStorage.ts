import Dexie from "dexie"
import throttle from "lodash/throttle"

/**
 * Dedicated Dexie database for blob storage
 * Independent of NDK cache adapter
 */
class BlobDatabase extends Dexie {
  blobs!: Dexie.Table<
    {
      hash: string
      data: ArrayBuffer
      size: number
      mimeType?: string
      first_author?: string
      stored_at: number
      times_requested_locally: number
      times_requested_by_peers: number
      last_requested: number
    },
    string
  >

  constructor() {
    super("iris-blob-storage")
    this.version(1).stores({
      blobs: "hash, stored_at",
    })
    this.version(2).stores({
      blobs: "hash, stored_at",
    })
    this.version(3)
      .stores({
        blobs: "hash, stored_at, last_requested",
      })
      .upgrade((tx) => {
        // Backfill last_requested to stored_at for existing blobs
        return tx
          .table("blobs")
          .toCollection()
          .modify((blob) => {
            blob.last_requested = blob.stored_at
          })
      })
  }
}

const blobDb = new BlobDatabase()

// In-memory cache for request stats (write to IDB throttled)
const requestStatsCache = new Map<
  string,
  {local: number; peer: number; lastRequested: number}
>()
const dirtyHashes = new Set<string>()

// Flush to IDB every 5 seconds
const flushRequestStatsToIDB = throttle(
  async () => {
    if (dirtyHashes.size === 0) return
    const updates = Array.from(dirtyHashes).map(async (hash) => {
      const stats = requestStatsCache.get(hash)
      if (stats) {
        await blobDb.blobs.update(hash, {
          times_requested_locally: stats.local,
          times_requested_by_peers: stats.peer,
          last_requested: stats.lastRequested,
        })
      }
    })
    dirtyHashes.clear()
    await Promise.all(updates)
  },
  5000,
  {leading: false, trailing: true}
)

/**
 * Simple blob storage using dedicated Dexie database
 * No dependency on NDK cache adapter
 */
export class SimpleBlobStorage {
  async initialize() {
    // Database auto-initializes
    // Load existing stats into cache
    const all = await blobDb.blobs.toArray()
    all.forEach((entry) => {
      requestStatsCache.set(entry.hash, {
        local: entry.times_requested_locally || 0,
        peer: entry.times_requested_by_peers || 0,
        lastRequested: entry.last_requested || entry.stored_at,
      })
    })
  }

  async get(hash: string): Promise<{
    hash: string
    data: ArrayBuffer
    size: number
    mimeType?: string
    first_author?: string
    stored_at: number
    times_requested_locally: number
    times_requested_by_peers: number
    last_requested: number
  } | null> {
    try {
      const entry = await blobDb.blobs.get(hash)
      if (!entry) return null

      return {
        hash: entry.hash,
        data: entry.data,
        size: entry.size,
        mimeType: entry.mimeType,
        first_author: entry.first_author,
        stored_at: entry.stored_at,
        times_requested_locally: entry.times_requested_locally || 0,
        times_requested_by_peers: entry.times_requested_by_peers || 0,
        last_requested: entry.last_requested || entry.stored_at,
      }
    } catch (error) {
      console.error("Error getting blob:", error)
      return null
    }
  }

  async save(
    hash: string,
    data: ArrayBuffer,
    mimeType?: string,
    firstAuthor?: string
  ): Promise<void> {
    try {
      // Check if already exists - don't overwrite first_author or stats
      const existing = await this.get(hash)
      const author = existing?.first_author || firstAuthor
      const now = Date.now()

      await blobDb.blobs.put({
        hash,
        data,
        size: data.byteLength,
        mimeType,
        first_author: author,
        stored_at: existing?.stored_at || now,
        times_requested_locally: existing?.times_requested_locally || 0,
        times_requested_by_peers: existing?.times_requested_by_peers || 0,
        last_requested: now,
      })
    } catch (error) {
      console.error("Error saving blob:", error)
    }
  }

  async list(
    offset = 0,
    limit = 20
  ): Promise<
    {
      hash: string
      size: number
      mimeType?: string
      stored_at: number
      first_author?: string
      times_requested_locally: number
      times_requested_by_peers: number
      last_requested: number
    }[]
  > {
    try {
      const results = await blobDb.blobs
        .orderBy("stored_at")
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray()

      return results.map((entry) => ({
        hash: entry.hash,
        size: entry.size,
        mimeType: entry.mimeType,
        stored_at: entry.stored_at,
        first_author: entry.first_author,
        times_requested_locally: entry.times_requested_locally || 0,
        times_requested_by_peers: entry.times_requested_by_peers || 0,
        last_requested: entry.last_requested || entry.stored_at,
      }))
    } catch (error) {
      console.error("Error listing blobs:", error)
      return []
    }
  }

  async count(): Promise<number> {
    try {
      return await blobDb.blobs.count()
    } catch (error) {
      console.error("Error counting blobs:", error)
      return 0
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      await blobDb.blobs.delete(hash)
    } catch (error) {
      console.error("Error deleting blob:", error)
    }
  }

  async clear(): Promise<void> {
    try {
      await blobDb.blobs.clear()
    } catch (error) {
      console.error("Error clearing blobs:", error)
    }
  }

  incrementLocalRequests(hash: string): void {
    const existing = requestStatsCache.get(hash) || {local: 0, peer: 0, lastRequested: 0}
    const now = Date.now()
    requestStatsCache.set(hash, {
      local: existing.local + 1,
      peer: existing.peer,
      lastRequested: now,
    })
    dirtyHashes.add(hash)
    flushRequestStatsToIDB()
  }

  incrementPeerRequests(hash: string): void {
    const existing = requestStatsCache.get(hash) || {local: 0, peer: 0, lastRequested: 0}
    const now = Date.now()
    requestStatsCache.set(hash, {
      local: existing.local,
      peer: existing.peer + 1,
      lastRequested: now,
    })
    dirtyHashes.add(hash)
    flushRequestStatsToIDB()
  }
}
