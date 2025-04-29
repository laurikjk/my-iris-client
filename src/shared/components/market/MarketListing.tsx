import {extractMarketData} from "@/shared/utils/marketUtils"
import ErrorBoundary from "../ui/ErrorBoundary"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import MarketDetails from "./MarketDetails"
import MarketImage from "./MarketImage"
import HyperText from "../HyperText"

type MarketListingProps = {
  event: NDKEvent
  truncate?: number
  isTruncated?: boolean
}

/**
 * Component for truncated market listings
 */
function TruncatedMarketListing({event}: {event: NDKEvent}) {
  const {title, price, imageUrl, summary} = extractMarketData(event)

  return (
    <ErrorBoundary>
      <div className="px-4">
        <div className="flex gap-4">
          <MarketImage event={event} imageUrl={imageUrl} className="w-40" />
          <div className="flex-1">
            {price && <div className="text-lg font-bold text-info mb-2">{price}</div>}
            {title && (
              <div className="text-lg font-bold text-base-content mb-4">{title}</div>
            )}
            <HyperText event={event} truncate={100} small={true}>
              {summary}
            </HyperText>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

/**
 * Component for full market listings
 */
function FullMarketListing({event}: {event: NDKEvent}) {
  const {title, price, imageUrl, content, tags} = extractMarketData(event)

  return (
    <ErrorBoundary>
      <div className="px-4">
        <div className="flex gap-4">
          <MarketImage event={event} imageUrl={imageUrl} className="w-40" />
          <div className="flex-1">
            {price && <div className="text-lg font-bold text-info mb-2">{price}</div>}
            {title && (
              <div className="text-lg font-bold text-base-content mb-4">{title}</div>
            )}
            <HyperText event={event} textPadding={false}>
              {content}
            </HyperText>
          </div>
        </div>
        <MarketDetails tags={tags} />
      </div>
    </ErrorBoundary>
  )
}

/**
 * Main component that decides which version to render
 */
function MarketListing({event, truncate, isTruncated}: MarketListingProps) {
  // Use isTruncated prop if provided, otherwise fall back to truncate check
  const shouldTruncate = isTruncated !== undefined ? isTruncated : !!truncate
  if (shouldTruncate) {
    return <TruncatedMarketListing event={event} />
  }
  return <FullMarketListing event={event} />
}

export default MarketListing
