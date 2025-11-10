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

  async get(hash: string): Promise<{
    hash: string
    data: ArrayBuffer
    size: number
    mimeType?: string
    first_author?: string
  } | null> {
    if (!this.cache.getCacheData) return null

    try {
      const entry = await this.cache.getCacheData<{
        hash: string
        data: ArrayBuffer
        size: number
        mimeType?: string
        first_author?: string
        stored_at: number
      }>("binary_blobs", hash)

      if (!entry) return null

      return {
        hash: entry.hash,
        data: entry.data,
        size: entry.size,
        mimeType: entry.mimeType,
        first_author: entry.first_author,
      }
    } catch (error) {
      console.error("Error getting blob from cache:", error)
      return null
    }
  }

  async save(
    hash: string,
    data: ArrayBuffer,
    mimeType?: string,
    firstAuthor?: string
  ): Promise<void> {
    if (!this.cache.setCacheData) return

    try {
      // Check if already exists - don't overwrite first_author
      const existing = await this.get(hash)

      const author = existing?.first_author || firstAuthor

      await this.cache.setCacheData("binary_blobs", hash, {
        hash,
        data,
        size: data.byteLength,
        mimeType,
        first_author: author,
        stored_at: Date.now(),
      })

      if (author) {
        console.log(`Saved blob ${hash.slice(0, 8)} with author ${author.slice(0, 8)}`)
      }
    } catch (error) {
      console.error("Error saving blob to cache:", error)
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
    }[]
  > {
    try {
      const results = await db.cacheData
        .where("key")
        .startsWith("binary_blobs:")
        .toArray()

      // Sort by stored_at descending (most recent first)
      results.sort((a, b) => {
        const aData = a.data as {stored_at: number}
        const bData = b.data as {stored_at: number}
        return bData.stored_at - aData.stored_at
      })

      // Apply offset and limit
      const paginated = results.slice(offset, offset + limit)

      return paginated.map((entry) => {
        const data = entry.data as {
          hash: string
          size: number
          mimeType?: string
          stored_at: number
          first_author?: string
        }
        return {
          hash: data.hash,
          size: data.size,
          mimeType: data.mimeType,
          stored_at: data.stored_at,
          first_author: data.first_author,
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
