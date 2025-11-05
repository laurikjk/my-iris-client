import type {NDKCacheAdapter} from "@/lib/ndk/cache"

/**
 * Simple blob storage using NDK cache's generic cache data
 * Avoids Dexie schema conflicts
 */
export class SimpleBlobStorage {
  private cache: NDKCacheAdapter

  constructor(cache: NDKCacheAdapter) {
    this.cache = cache
  }

  async initialize() {
    // No initialization needed for generic cache data
  }

  async get(
    hash: string
  ): Promise<{hash: string; data: ArrayBuffer; size: number} | null> {
    if (!this.cache.getCacheData) return null

    try {
      const entry = await this.cache.getCacheData<{
        hash: string
        data: ArrayBuffer
        size: number
        stored_at: number
      }>("binary_blobs", hash)

      if (!entry) return null

      return {
        hash: entry.hash,
        data: entry.data,
        size: entry.size,
      }
    } catch (error) {
      console.error("Error getting blob from cache:", error)
      return null
    }
  }

  async save(hash: string, data: ArrayBuffer): Promise<void> {
    if (!this.cache.setCacheData) return

    try {
      await this.cache.setCacheData("binary_blobs", hash, {
        hash,
        data,
        size: data.byteLength,
        stored_at: Date.now(),
      })
    } catch (error) {
      console.error("Error saving blob to cache:", error)
    }
  }
}
