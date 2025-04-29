import {useState, useEffect} from "react"
import {ndk} from "@/utils/ndk"
import socialGraph from "@/utils/socialGraph"
import PopularChannelItem from "./PopularChannelItem"
import {CHANNEL_MESSAGE} from "../utils/constants"

type PopularChannel = {
  id: string
  name: string
  about: string
  picture: string
  authorCount: number
}

type PopularChannelsProps = {
  publicKey: string
}

const PopularChannels = ({publicKey}: PopularChannelsProps) => {
  const [popularChannels, setPopularChannels] = useState<PopularChannel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch popular channels from followed users
  useEffect(() => {
    // Skip if already loading or no publicKey
    if (isLoading || !publicKey) return

    const fetchPopularChannels = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log("Fetching popular channels for publicKey:", publicKey)
        // Get followed users using social graph
        const followedUsers = await socialGraph().getUsersByFollowDistance(1)
        console.log("Followed users count:", followedUsers.size)
        if (followedUsers.size === 0) {
          console.log("No followed users found")
          setError("No followed users found. Follow some people to see their channels.")
          setIsLoading(false)
          return
        }

        // Fetch channel messages from followed users
        console.log("Fetching channel messages from followed users")
        const channelMessages = await ndk().fetchEvents({
          kinds: [CHANNEL_MESSAGE],
          authors: Array.from(followedUsers),
          limit: 200,
        })
        console.log("Channel messages count:", channelMessages.size)

        // Process messages to identify channels and count unique authors
        const channelMap = new Map<string, { authors: Set<string> }>()

        for (const event of Array.from(channelMessages)) {
          // Extract channel ID from the 'e' tag
          const channelIdTag = event.tags.find(tag => tag[0] === 'e')
          if (!channelIdTag) continue

          const channelId = channelIdTag[1]

          if (!channelMap.has(channelId)) {
            channelMap.set(channelId, { authors: new Set() })
          }

          const channelData = channelMap.get(channelId)!
          channelData.authors.add(event.pubkey)
        }

        console.log("Unique channels found:", channelMap.size)

        // Convert to array and sort by author count
        const channels: PopularChannel[] = []

        for (const [id, data] of channelMap.entries()) {
          channels.push({
            id,
            name: "", // Will be fetched by PopularChannelItem
            about: "", // Will be fetched by PopularChannelItem
            picture: "", // Will be fetched by PopularChannelItem
            authorCount: data.authors.size,
          })
        }

        // Sort by author count (descending)
        channels.sort((a, b) => b.authorCount - a.authorCount)

        console.log("Channels to display:", channels.length)
        // Create a new array to ensure React detects the state change
        setPopularChannels([...channels])
      } catch (err) {
        console.error("Error fetching popular channels:", err)
        setError("Failed to load popular channels. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPopularChannels()
  }, [publicKey]) // Only run when publicKey changes, removed isLoading from dependency array

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Popular Public Channels</h2>
      <p className="text-base-content/70 mb-4">
        Channels that people you follow are actively participating in:
      </p>

      {isLoading && (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-md"></span>
          <p className="mt-2">Loading popular channels...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-error">
          {error}
        </div>
      )}

      {!isLoading && !error && popularChannels.length === 0 && (
        <div className="text-center py-8 text-base-content/70">
          No popular channels found. Join or create a channel to get started!
        </div>
      )}

      {!isLoading && !error && popularChannels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularChannels.map((channel) => (
            <PopularChannelItem
              key={channel.id}
              channelId={channel.id}
              authorCount={channel.authorCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default PopularChannels