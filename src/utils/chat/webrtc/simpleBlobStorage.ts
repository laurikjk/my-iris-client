import Dexie from "dexie"

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
    },
    string
  >

  constructor() {
    super("iris-blob-storage")
    this.version(1).stores({
      blobs: "hash, stored_at",
    })
  }
}

const blobDb = new BlobDatabase()

/**
 * Simple blob storage using dedicated Dexie database
 * No dependency on NDK cache adapter
 */
export class SimpleBlobStorage {
  async initialize() {
    // Database auto-initializes
  }

  async get(hash: string): Promise<{
    hash: string
    data: ArrayBuffer
    size: number
    mimeType?: string
    first_author?: string
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
      // Check if already exists - don't overwrite first_author
      const existing = await this.get(hash)
      const author = existing?.first_author || firstAuthor

      await blobDb.blobs.put({
        hash,
        data,
        size: data.byteLength,
        mimeType,
        first_author: author,
        stored_at: Date.now(),
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
}
