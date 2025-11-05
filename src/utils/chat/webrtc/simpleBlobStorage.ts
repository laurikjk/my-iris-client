import type {NDKCacheAdapter} from "@/lib/ndk/cache"
import {db} from "@/lib/ndk-cache/db"

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
  ): Promise<{hash: string; data: ArrayBuffer; size: number; mimeType?: string} | null> {
    if (!this.cache.getCacheData) return null

    try {
      const entry = await this.cache.getCacheData<{
        hash: string
        data: ArrayBuffer
        size: number
        mimeType?: string
        stored_at: number
      }>("binary_blobs", hash)

      if (!entry) return null

      return {
        hash: entry.hash,
        data: entry.data,
        size: entry.size,
        mimeType: entry.mimeType,
      }
    } catch (error) {
      console.error("Error getting blob from cache:", error)
      return null
    }
  }

  async save(hash: string, data: ArrayBuffer, mimeType?: string): Promise<void> {
    if (!this.cache.setCacheData) return

    try {
      await this.cache.setCacheData("binary_blobs", hash, {
        hash,
        data,
        size: data.byteLength,
        mimeType,
        stored_at: Date.now(),
      })
    } catch (error) {
      console.error("Error saving blob to cache:", error)
    }
  }

  async list(
    offset = 0,
    limit = 20
  ): Promise<{hash: string; size: number; mimeType?: string; stored_at: number}[]> {
    try {
      const results = await db.cacheData
        .where("key")
        .startsWith("binary_blobs:")
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray()

      return results.map((entry) => {
        const data = entry.data as {
          hash: string
          size: number
          mimeType?: string
          stored_at: number
        }
        return {
          hash: data.hash,
          size: data.size,
          mimeType: data.mimeType,
          stored_at: data.stored_at,
        }
      })
    } catch (error) {
      console.error("Error listing blobs:", error)
      return []
    }
  }

  async count(): Promise<number> {
    try {
      return await db.cacheData.where("key").startsWith("binary_blobs:").count()
    } catch (error) {
      console.error("Error counting blobs:", error)
      return 0
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      await db.cacheData.delete(`binary_blobs:${hash}`)
    } catch (error) {
      console.error("Error deleting blob:", error)
    }
  }

  async clear(): Promise<void> {
    try {
      await db.cacheData.where("key").startsWith("binary_blobs:").delete()
    } catch (error) {
      console.error("Error clearing blobs:", error)
    }
  }
}
