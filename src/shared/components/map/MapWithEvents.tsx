import {useState, useMemo} from "react"
import {useNavigate} from "@/navigation"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import {ALL_GEOHASHES} from "@/utils/geohash"
import Feed from "@/shared/components/feed/Feed"
import {KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface MapWithEventsProps {
  selectedGeohashes: string[]
  height?: string
  className?: string
}

export default function MapWithEvents({
  selectedGeohashes,
  height = "20rem",
  className = "w-full",
}: MapWithEventsProps) {
  const navigate = useNavigate()
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([])

  // Create feed config to get events for the map
  const feedConfig = useMemo(() => {
    const isGlobalView = selectedGeohashes.length === 0

    const filter = isGlobalView
      ? {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": ALL_GEOHASHES,
          limit: 200,
        }
      : {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": selectedGeohashes,
          limit: 100,
        }

    return {
      id: `map-events-${selectedGeohashes.join(",") || "global"}`,
      name: "Map Events",
      filter,
      followDistance: 5,
      showRepliedTo: true,
      hideReplies: false,
    }
  }, [selectedGeohashes])

  return (
    <div className={className} style={{height}}>
      <GeohashMap
        geohashes={selectedGeohashes.length === 0 ? ALL_GEOHASHES : selectedGeohashes}
        feedEvents={feedEvents}
        onGeohashSelect={(geohash) => {
          navigate(`/map/${geohash.toLowerCase()}`)
        }}
        height="100%"
        className="w-full h-full"
      />

      {/* Hidden feed to collect events for the map */}
      <div className="hidden">
        <Feed
          key={selectedGeohashes.join(",") || "global"}
          feedConfig={feedConfig}
          onEvent={(event) => {
            setFeedEvents((prev) => {
              if (prev.some((e) => e.id === event.id)) return prev
              return [...prev.slice(-199), event]
            })
          }}
        />
      </div>
    </div>
  )
}
