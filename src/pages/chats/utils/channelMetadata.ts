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
    console.log("Fetching channel metadata for ID:", channelId)

    // First try to fetch the channel creation event
    const channelEvent = await ndk().fetchEvent({
      kinds: [CHANNEL_CREATE],
      ids: [channelId],
    })

    if (channelEvent) {
      try {
        console.log("Found channel creation event:", channelEvent)
        const metadata = JSON.parse(channelEvent.content)
        return metadata
      } catch (e) {
        console.error("Failed to parse channel creation content:", e)
      }
    } else {
      console.log("No channel creation event found for ID:", channelId)

      // If no channel creation event found, try to fetch the channel message event
      // This is a fallback approach since some channels might not have a creation event
      const channelMessageEvent = await ndk().fetchEvent({
        kinds: [42], // CHANNEL_MESSAGE
        ids: [channelId],
      })

      if (channelMessageEvent) {
        console.log("Found channel message event as fallback:", channelMessageEvent)
        // Create a basic metadata object from the message event
        return {
          name: `Channel ${channelId.substring(0, 8)}...`,
          about: "Channel information not available",
          picture: "",
          relays: [],
        }
      }
    }
  } catch (err) {
    console.error("Error fetching channel metadata:", err)
  }

  return null
}
