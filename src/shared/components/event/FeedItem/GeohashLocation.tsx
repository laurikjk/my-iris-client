import {NDKEvent} from "@nostr-dev-kit/ndk"
import {RiMapPinLine} from "@remixicon/react"
import {Link} from "@/navigation"

interface GeohashLocationProps {
  event: NDKEvent
  className?: string
}

export function GeohashLocation({event, className = ""}: GeohashLocationProps) {
  // Get location tags from the event
  const locationTags = event.tags.filter((tag) => tag[0] === "location" && tag[1])

  // Get geohash tags from the event and convert to lowercase
  const geohashTags = event.tags.filter((tag) => tag[0] === "g" && tag[1])

  if (locationTags.length === 0 && geohashTags.length === 0) {
    return null
  }

  // Get first location tag and truncate if needed
  const locationText = locationTags.length > 0 ? locationTags[0][1] : null
  const truncatedLocation =
    locationText && locationText.length > 30
      ? locationText.substring(0, 30) + "..."
      : locationText

  // Get all unique geohashes (lowercase) and sort by length (most specific first)
  const uniqueGeohashes = [
    ...new Set(geohashTags.map((tag) => tag[1].toLowerCase())),
  ].sort((a, b) => b.length - a.length)

  // Limit to first 10 geohashes for safety
  const geohashes = uniqueGeohashes.slice(0, 10)
  const hasMoreGeohashes = uniqueGeohashes.length > 10

  return (
    <div
      className={`flex items-center gap-1 text-xs text-base-content/50 flex-wrap ${className}`}
    >
      <RiMapPinLine className="w-3 h-3 flex-shrink-0" />
      {truncatedLocation && (
        <>
          <span title={locationText || undefined}>{truncatedLocation}</span>
          {geohashes.length > 0 && <span className="mx-1">·</span>}
        </>
      )}
      {geohashes.map((geohash, index) => (
        <span key={geohash}>
          <Link
            to={`/map/${geohash}`}
            className="hover:text-base-content/70 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {geohash}
          </Link>
          {index < geohashes.length - 1 && <span className="mx-1">·</span>}
        </span>
      ))}
      {hasMoreGeohashes && <span className="ml-1">...</span>}
    </div>
  )
}
