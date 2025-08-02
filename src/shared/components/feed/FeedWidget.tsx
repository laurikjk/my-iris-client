import {memo} from "react"
import EventBorderless from "@/shared/components/event/EventBorderless"
import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import MediaFeed from "./MediaFeed"
import {DisplayAsSelector} from "./DisplayAsSelector"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface FeedWidgetProps {
  events: NDKEvent[]
  loading: boolean
  loadMore?: () => void
  displayAs?: "list" | "grid" | "borderless"
  showDisplaySelector?: boolean
  onDisplayAsChange?: (display: "list" | "grid") => void
  emptyMessage?: string
  loadingMessage?: string
  maxItems?: number
  small?: boolean
  randomSort?: boolean
}

const FeedWidget = memo(function FeedWidget({
  events,
  loading,
  loadMore,
  displayAs = "borderless",
  showDisplaySelector = false,
  onDisplayAsChange,
  emptyMessage = "No posts found",
  loadingMessage = "Loading...",
  maxItems,
  small = true,
  randomSort = false,
}: FeedWidgetProps) {
  // Apply randomization if requested
  const sortedEvents = randomSort ? [...events].sort(() => Math.random() - 0.5) : events
  const displayEvents = maxItems ? sortedEvents.slice(0, maxItems) : sortedEvents

  if (loading && events.length === 0) {
    return (
      <div className={small ? "px-4 py-2" : "p-8 flex items-center justify-center"}>
        <span className="text-base-content/50 text-sm">{loadingMessage}</span>
      </div>
    )
  }

  if (displayEvents.length === 0) {
    return (
      <div className={small ? "px-4 py-2" : "p-8 flex items-center justify-center"}>
        <span className="text-base-content/50 text-sm">{emptyMessage}</span>
      </div>
    )
  }

  const renderEvents = () => {
    if (displayAs === "borderless") {
      return (
        <div className="flex flex-col gap-4">
          {displayEvents.map((event) => (
            <EventBorderless key={event.id} event={event} />
          ))}
        </div>
      )
    }

    if (displayAs === "grid") {
      return <MediaFeed events={displayEvents} />
    }

    // displayAs === "list"
    return displayEvents.map((event) => (
      <FeedItem key={event.id} event={event} />
    ))
  }

  return (
    <>
      {showDisplaySelector && onDisplayAsChange && (
        <DisplayAsSelector
          activeSelection={displayAs as "list" | "grid"}
          onSelect={onDisplayAsChange}
        />
      )}

      {loadMore ? (
        <InfiniteScroll onLoadMore={loadMore}>
          {renderEvents()}
        </InfiniteScroll>
      ) : (
        renderEvents()
      )}
    </>
  )
})

export default FeedWidget