import type {
  CacheModuleDefinition,
  CacheModuleCollection,
  NDKCacheAdapter,
} from "@/lib/ndk/cache"

/**
 * Blob storage entry
 */
export interface BlobStorageEntry {
  hash: string // SHA-256 hex (primary key)
  data: ArrayBuffer
  size: number
  stored_at: number
  access_count: number
  last_access: number
}

/**
 * Blob storage statistics
 */
export interface BlobStats {
  total_blobs: number
  total_bytes: number
  last_cleanup: number
}

/**
 * NDK cache module definition for WebRTC blob storage
 */
export const blobStorageModule: CacheModuleDefinition = {
  namespace: "webrtc_blobs",
  version: 1,
  collections: {
    blobs: {
      primaryKey: "hash",
      indexes: ["stored_at", "access_count", "last_access"],
      schema: {
        hash: "string",
        data: "blob",
        size: "number",
        stored_at: "number",
        access_count: "number",
        last_access: "number",
      },
    },
    stats: {
      primaryKey: "id",
      schema: {
        id: "string", // always "global"
        total_blobs: "number",
        total_bytes: "number",
        last_cleanup: "number",
      },
    },
  },
  migrations: {
    1: async (context) => {
      await context.createCollection("blobs", blobStorageModule.collections.blobs)
      await context.createCollection("stats", blobStorageModule.collections.stats)
    },
  },
}

/**
 * Blob storage manager
 */
export class BlobStorage {
  private blobsCollection: CacheModuleCollection<BlobStorageEntry> | null = null
  private statsCollection: CacheModuleCollection<BlobStats & {id: string}> | null = null
  private cache: NDKCacheAdapter

  constructor(cache: NDKCacheAdapter) {
    this.cache = cache
  }

  async initialize() {
    if (!this.cache.registerModule || !this.cache.getModuleCollection) {
      console.warn("Cache adapter does not support modules, using fallback storage")
      return
    }

    try {
      await this.cache.registerModule(blobStorageModule)
      this.blobsCollection = await this.cache.getModuleCollection<BlobStorageEntry>(
        "webrtc_blobs",
        "blobs"
      )
      this.statsCollection = await this.cache.getModuleCollection<
        BlobStats & {id: string}
      >("webrtc_blobs", "stats")
    } catch (error) {
      console.warn("Failed to initialize blob storage module:", error)
      // Fallback to simple in-memory storage for tests
    }
  }

  async get(hash: string): Promise<BlobStorageEntry | null> {
    if (!this.blobsCollection) return null

    const entry = await this.blobsCollection.get(hash)
    if (entry) {
      // Update access stats
      entry.access_count++
      entry.last_access = Date.now()
      await this.blobsCollection.save(entry)
    }
    return entry
  }

  async save(hash: string, data: ArrayBuffer): Promise<void> {
    if (!this.blobsCollection) return

    const entry: BlobStorageEntry = {
      hash,
      data,
      size: data.byteLength,
      stored_at: Date.now(),
      access_count: 0,
      last_access: Date.now(),
    }

    await this.blobsCollection.save(entry)
    await this.updateStats(data.byteLength, 1)
  }

  async delete(hash: string): Promise<void> {
    if (!this.blobsCollection) return

    const entry = await this.blobsCollection.get(hash)
    if (entry) {
      await this.blobsCollection.delete(hash)
      await this.updateStats(-entry.size, -1)
    }
  }

  async getStats(): Promise<BlobStats> {
    if (!this.statsCollection) {
      return {total_blobs: 0, total_bytes: 0, last_cleanup: 0}
    }

    const stats = await this.statsCollection.get("global")
    return (
      stats || {
        id: "global",
        total_blobs: 0,
        total_bytes: 0,
        last_cleanup: 0,
      }
    )
  }

  private async updateStats(byteDelta: number, blobDelta: number): Promise<void> {
    if (!this.statsCollection) return

    const stats = await this.getStats()
    const updated = {
      id: "global",
      total_blobs: Math.max(0, stats.total_blobs + blobDelta),
      total_bytes: Math.max(0, stats.total_bytes + byteDelta),
      last_cleanup: stats.last_cleanup,
    }
    await this.statsCollection.save(updated)
  }

  async cleanup(maxBytes: number, maxAge: number): Promise<number> {
    if (!this.blobsCollection) return 0

    const all = await this.blobsCollection.all()
    const now = Date.now()
    const cutoff = now - maxAge

    // Sort by LRU (least recently used first)
    all.sort((a, b) => a.last_access - b.last_access)

    let totalSize = all.reduce((sum, entry) => sum + entry.size, 0)
    let deleted = 0

    for (const entry of all) {
      // Delete if too old or over size limit
      if (entry.last_access < cutoff || totalSize > maxBytes) {
        await this.delete(entry.hash)
        totalSize -= entry.size
        deleted++
      }
    }

    if (this.statsCollection) {
      const stats = await this.getStats()
      await this.statsCollection.save({
        ...stats,
        id: "global",
        last_cleanup: now,
      })
    }

    return deleted
  }

  async clear(): Promise<void> {
    if (!this.blobsCollection) return
    await this.blobsCollection.clear()
    if (this.statsCollection) {
      await this.statsCollection.save({
        id: "global",
        total_blobs: 0,
        total_bytes: 0,
        last_cleanup: Date.now(),
      })
    }
  }
}
