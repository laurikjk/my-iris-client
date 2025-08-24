import {NDKEvent} from "@nostr-dev-kit/ndk"
import {RiMapPinLine} from "@remixicon/react"
import {Link} from "@/navigation"

interface GeohashLocationProps {
  event: NDKEvent
  className?: string
}

export function GeohashLocation({event, className = ""}: GeohashLocationProps) {
  // Get geohash tags from the event
  const geohashTags = event.tags.filter((tag) => tag[0] === "g" && tag[1])

  if (geohashTags.length === 0) {
    return null
  }

  // Get all unique geohashes and sort by length (most specific first)
  const uniqueGeohashes = [...new Set(geohashTags.map((tag) => tag[1]))].sort(
    (a, b) => b.length - a.length
  )

  // Limit to first 10 geohashes for safety
  const geohashes = uniqueGeohashes.slice(0, 10)
  const hasMore = uniqueGeohashes.length > 10

  return (
    <div
      className={`flex items-center gap-1 text-xs text-base-content/50 px-4 -mt-1 mb-2 flex-wrap ${className}`}
    >
      <RiMapPinLine className="w-3 h-3 flex-shrink-0" />
      {geohashes.map((geohash, index) => (
        <span key={geohash}>
          <Link
            to={`/geohash/${geohash}`}
            className="hover:text-base-content/70 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {geohash}
          </Link>
          {index < geohashes.length - 1 && <span className="mx-1">·</span>}
        </span>
      ))}
      {hasMore && <span className="ml-1">...</span>}
    </div>
  )
}
