import {ndk} from "@/utils/ndk"

// NIP-28 event kinds
export const CHANNEL_CREATE = 40

export type ChannelMetadata = {
  name: string
  about: string
  picture: string
  relays: string[]
}

/**
 * Fetches channel metadata for a given channel ID
 * @param channelId The ID of the channel to fetch metadata for
 * @returns A promise that resolves to the channel metadata or null if not found
 */
export const fetchChannelMetadata = async (
  channelId: string
): Promise<ChannelMetadata | null> => {
  try {
    const channelEvent = await ndk().fetchEvent({
      kinds: [CHANNEL_CREATE],
      ids: [channelId],
    })

    if (channelEvent) {
      try {
        const metadata = JSON.parse(channelEvent.content)
        return metadata
      } catch (e) {
        console.error("Failed to parse channel creation content:", e)
      }
    }
  } catch (err) {
    console.error("Error fetching channel metadata:", err)
  }

  return null
}
