import SmallImageComponent from "../embed/media/SmallImageComponent"
import HyperText from "@/shared/components/HyperText.tsx"
import ErrorBoundary from "../ui/ErrorBoundary"
import {RiImageLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState} from "react"

type MarketListingProps = {
  event: NDKEvent
  truncate?: number
  isTruncated?: boolean
}

// Component for truncated market listings
function TruncatedMarketListing({event}: {event: NDKEvent}) {
  const title = event?.tagValue("title")
  const priceTag = event?.tags?.find((tag) => tag[0] === "price")
  const price = priceTag ? `${priceTag[1]} ${priceTag[2] || ""}` : null
  const imageTag = event?.tags?.find((tag) => tag[0] === "image")
  const imageUrl = imageTag ? imageTag[1] : null
  const summary = event?.tagValue("summary") || event?.content || ""
  const cleanSummary = imageUrl ? summary.replace(imageUrl, "").trim() : summary

  return (
    <ErrorBoundary>
      <div className="px-4">
        <div className="flex gap-4">
          <div className="w-40 flex-shrink-0">
            {imageUrl ? (
              <SmallImageComponent match={imageUrl} event={event} size={160} />
            ) : (
              <div className="w-40 h-40 bg-base-200 rounded flex items-center justify-center">
                <RiImageLine className="w-8 h-8 text-base-content/50" />
              </div>
            )}
          </div>
          <div className="flex-1">
            {price && <div className="text-lg font-bold text-info mb-2">{price}</div>}
            {title && (
              <div className="text-lg font-bold text-base-content mb-4">{title}</div>
            )}
            <HyperText event={event} truncate={100} small={true}>
              {cleanSummary}
            </HyperText>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

// Component for full market listings
function FullMarketListing({event}: {event: NDKEvent}) {
  const title = event?.tagValue("title")
  const [showDetails, setShowDetails] = useState(false)

  // Get all tags except the title tag which is already displayed
  const tags = event?.tags?.filter((tag) => tag[0] !== "title") || []

  // Format tag values for display
  const formatTagValue = (tag: string[]) => {
    if (tag[0] === "price") {
      return `${tag[1]} ${tag[2] || ""}`
    }
    return tag[1]
  }

  // Get price tag if it exists
  const priceTag = event?.tags?.find((tag) => tag[0] === "price")
  const price = priceTag ? `${priceTag[1]} ${priceTag[2] || ""}` : null

  // Get first image URL if it exists
  const imageTag = event?.tags?.find((tag) => tag[0] === "image")
  const imageUrl = imageTag ? imageTag[1] : null

  return (
    <ErrorBoundary>
      <div className="px-4">
        <div className="flex gap-4">
          {imageUrl ? (
            <div className="w-40 flex-shrink-0">
              <SmallImageComponent match={imageUrl} event={event} size={160} />
            </div>
          ) : (
            <div className="w-40 h-40 bg-base-200 rounded flex items-center justify-center">
              <RiImageLine className="w-8 h-8 text-base-content/50" />
            </div>
          )}
          <div className="flex-1">
            {price && <div className="text-lg font-bold text-info mb-2">{price}</div>}
            {title && (
              <div className="text-lg font-bold text-base-content mb-4">{title}</div>
            )}
            <HyperText event={event} textPadding={false}>
              {event?.content || ""}
            </HyperText>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="mt-4">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>

            {showDetails && (
              <div className="mt-2 p-2 bg-base-200 rounded-lg whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
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
      </div>
    </ErrorBoundary>
  )
}

// Main component that decides which version to render
function MarketListing({event, truncate, isTruncated}: MarketListingProps) {
  // Use isTruncated prop if provided, otherwise fall back to truncate check
  const shouldTruncate = isTruncated !== undefined ? isTruncated : !!truncate
  if (shouldTruncate) {
    return <TruncatedMarketListing event={event} />
  }
  return <FullMarketListing event={event} />
}

export default MarketListing
