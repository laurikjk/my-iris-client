import {useState, useMemo, RefObject} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import {KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"
import {ALL_GEOHASHES} from "@/utils/geohash"
import Icon from "@/shared/components/Icons/Icon"

interface MapSearchProps {
  searchInputRef: RefObject<HTMLInputElement | null>
}

export default function MapSearch({searchInputRef}: MapSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>([])
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([])
  const [displayAs, setDisplayAs] = useState<"list" | "grid">("list")

  const handleInputChange = (value: string) => {
    setSearchTerm(value)
    // Update map instantly as user types
    if (value.trim()) {
      const geohash = value.toLowerCase().replace(/[^0-9bcdefghjkmnpqrstuvwxyz]/g, "")
      if (geohash) {
        setSelectedGeohashes((current) => {
          // Only update if different to prevent unnecessary re-renders
          if (current.length === 1 && current[0] === geohash) return current
          return [geohash]
        })
      }
    } else {
      setSelectedGeohashes([])
    }
  }

  // Use selected geohashes or empty array for initial state
  const geohashes = selectedGeohashes

  const feedConfig = useMemo(() => {
    // When no geohashes selected, show global view with all geohashes
    const isGlobalView = geohashes.length === 0

    const filter = isGlobalView
      ? {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": ALL_GEOHASHES,
          limit: 100,
        }
      : {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": geohashes,
          limit: 100,
        }

    return {
      id: `map-search-${geohashes.join(",") || "global"}`,
      name: "Location Feed",
      filter,
      followDistance: 5,
      showRepliedTo: true,
      hideReplies: false,
      displayAs,
    }
  }, [geohashes, displayAs])

  return (
    <div className="w-full">
      <div className="w-full p-2">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <input
            ref={searchInputRef}
            type="text"
            className="grow"
            placeholder="Search geohash area..."
            value={searchTerm}
            onChange={(e) => handleInputChange(e.target.value)}
          />
          <Icon name="search-outline" className="text-neutral-content/60" />
        </label>
      </div>

      <div className="mt-4">
        <GeohashMap
          geohashes={geohashes.length === 0 ? ALL_GEOHASHES : geohashes}
          feedEvents={feedEvents}
          onGeohashSelect={(geohash) => {
            setSelectedGeohashes([geohash.toLowerCase()])
            setSearchTerm(geohash.toLowerCase()) // Update search input to match selection
          }}
          height="20rem"
          className="w-full max-w-full"
        />
        <div className="mt-4">
          <Feed
            key={geohashes.join(",") || "global"}
            feedConfig={feedConfig}
            showReplies={0}
            borderTopFirst={true}
            showDisplayAsSelector={true}
            displayAs={displayAs}
            onDisplayAsChange={setDisplayAs}
            onEvent={(event) => {
              setFeedEvents((prev) => {
                if (prev.some((e) => e.id === event.id)) return prev
                return [...prev.slice(-99), event]
              })
            }}
          />
        </div>
      </div>
    </div>
  )
}
