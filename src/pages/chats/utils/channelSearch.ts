import {ChannelMetadata} from "./channelMetadata"
import {LRUCache} from "typescript-lru-cache"
import Fuse from "fuse.js"

// LRU cache for channel metadata
const channelCache = new LRUCache<string, ChannelMetadata>({maxSize: 200})

// Fuse.js search index
let fuse: Fuse<ChannelMetadata> | null = null

// Update the search index with new channel metadata
export const updateChannelSearchIndex = (
  channelId: string,
  metadata: ChannelMetadata
) => {
  // Update the cache
  channelCache.set(channelId, metadata)

  // Recreate the Fuse.js index
  const channels = Array.from(channelCache.values())
  fuse = new Fuse(channels, {
    keys: ["name", "about"],
    threshold: 0.3,
    includeScore: true,
  })
}

// Search for channels using the Fuse.js index
export const searchChannels = (query: string): ChannelMetadata[] => {
  if (!fuse || !query.trim()) {
    return []
  }

  const results = fuse.search(query)
  // Deduplicate results by channel ID
  const seenIds = new Set<string>()
  return results
    .map((result) => result.item)
    .filter((metadata) => {
      if (seenIds.has(metadata.founderPubkey)) {
        return false
      }
      seenIds.add(metadata.founderPubkey)
      return true
    })
}

// Get a channel from the cache
export const getCachedChannel = (channelId: string): ChannelMetadata | undefined => {
  return channelCache.get(channelId) ?? undefined
}
