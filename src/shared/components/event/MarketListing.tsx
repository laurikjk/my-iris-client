import HyperText from "@/shared/components/HyperText.tsx"
import ErrorBoundary from "../ui/ErrorBoundary"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState} from "react"

type MarketListingProps = {
  event: NDKEvent
  truncate?: number
}

function MarketListing({event, truncate}: MarketListingProps) {
  const title = event?.tagValue("title")
  const [showDetails, setShowDetails] = useState(false)

  // Get all tags except the title tag which is already displayed
  const tags = event?.tags?.filter((tag) => tag[0] !== "title") || []

  // Format tag values for display
  const formatTagValue = (tag: string[]) => {
    if (tag[0] === "price" && tag[2] === "SATS") {
      return `${tag[1]} sats`
    }
    if (tag[0] === "image" || tag[0] === "r") {
      return "Image URL"
    }
    return tag[1]
  }

  // Get price tag if it exists
  const priceTag = event?.tags?.find((tag) => tag[0] === "price" && tag[2] === "SATS")
  const price = priceTag ? `${priceTag[1]} sats` : null

  return (
    <ErrorBoundary>
      {price && <div className="text-lg font-bold text-info px-4 mb-2">{price}</div>}
      {title && (
        <div className="text-lg font-bold text-base-content px-4 mb-4">{title}</div>
      )}
      <HyperText event={event} truncate={truncate}>
        {event?.content || ""}
      </HyperText>

      {!truncate && tags.length > 0 && (
        <div className="mt-4 px-4">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>

          {showDetails && (
            <div className="mt-2 p-2 bg-base-200 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Listing Details:</h3>
              <ul className="text-xs space-y-1">
                {tags.map((tag, index) => (
                  <li key={index} className="flex">
                    <span className="font-medium mr-2">{tag[0]}:</span>
                    <span>{formatTagValue(tag)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ErrorBoundary>
  )
}

export default MarketListing
