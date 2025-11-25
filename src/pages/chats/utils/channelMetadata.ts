import {updateChannelSearchIndex, getCachedChannel} from "./channelSearch"
import {shouldHideUser} from "@/utils/visibility"
import {fetchEventsReliable, fetchEventReliable} from "@/utils/fetchEventsReliable"

// NIP-28 event kinds
export const CHANNEL_CREATE = 40

export type ChannelMetadata = {
  id: string
  name: string
  about: string
  picture: string
  relays: string[]
  founderPubkey: string
  createdAt: number
}

// Cache for channels by followed users
let channelsByFollowed: ChannelMetadata[] | null = null

/**
 * Fetches and caches channels created by followed users
 * @returns A promise that resolves to the filtered channel metadata
 */
export const getChannelsByFollowed = async (): Promise<ChannelMetadata[]> => {
  // Return cached result if available
  if (channelsByFollowed) {
    return channelsByFollowed
  }

  try {
    // Fetch latest 100 channel creation events
    const {promise} = fetchEventsReliable(
      {kinds: [CHANNEL_CREATE], limit: 100},
      {timeout: 5000}
    )
    const eventsArray = await promise
    const events = new Set(eventsArray)

    // Process and filter events
    const channels: ChannelMetadata[] = []
    for (const event of Array.from(events)) {
      try {
        // Skip if author should be hidden
        if (shouldHideUser(event.pubkey)) {
          continue
        }

        const metadata = JSON.parse(event.content)
        const channelMetadata = {
          id: event.id,
          ...metadata,
          founderPubkey: event.pubkey,
          createdAt: event.created_at,
        }
        channels.push(channelMetadata)
        // Update search index
        updateChannelSearchIndex(event.id, channelMetadata)
      } catch (e) {
        console.error("Failed to parse channel creation content:", e)
      }
    }

    // Cache the result
    channelsByFollowed = channels
    return channels
  } catch (err) {
    console.error("Error fetching channels by followed users:", err)
    return []
  }
}

/**
 * Fetches channel metadata for a given channel ID
 * @param channelId The ID of the channel to fetch metadata for
 * @returns A promise that resolves to the channel metadata or null if not found
 */
export const fetchChannelMetadata = async (
  channelId: string
): Promise<ChannelMetadata | null> => {
  // Check cache first
  const cached = getCachedChannel(channelId)
  if (cached) {
    return cached
  }

  try {
    // First try to fetch the channel creation event
    const {promise} = fetchEventReliable(
      {kinds: [CHANNEL_CREATE], ids: [channelId]},
      {timeout: 5000}
    )
    const channelEvent = await promise

    if (channelEvent) {
      try {
        const metadata = JSON.parse(channelEvent.content)
        const channelMetadata = {
          id: channelEvent.id,
          ...metadata,
          founderPubkey: channelEvent.pubkey,
          createdAt: channelEvent.created_at,
        }
        // Update search index
        updateChannelSearchIndex(channelId, channelMetadata)
        return channelMetadata
      } catch (e) {
        console.error("Failed to parse channel creation content:", e)
      }
    } else {
      // If no channel creation event found, try to fetch the channel message event
      // This is a fallback approach since some channels might not have a creation event
      const {promise: msgPromise} = fetchEventReliable(
        {kinds: [42], ids: [channelId]},
        {timeout: 5000}
      )
      const channelMessageEvent = await msgPromise

      if (channelMessageEvent) {
        // Create a basic metadata object from the message event
        const channelMetadata = {
          id: channelMessageEvent.id,
          name: `Channel ${channelId.substring(0, 8)}...`,
          about: "Channel information not available",
          picture: "",
          relays: [],
          founderPubkey: channelMessageEvent.pubkey,
          createdAt: channelMessageEvent.created_at || Math.floor(Date.now() / 1000),
        }
        // Update search index
        updateChannelSearchIndex(channelId, channelMetadata)
        return channelMetadata
      }
    }
  } catch (err) {
    console.error("Error fetching channel metadata:", err)
  }

  return null
}
