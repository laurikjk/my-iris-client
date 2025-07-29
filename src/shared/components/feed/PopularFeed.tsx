import {useCallback, useMemo, useState} from "react"
import classNames from "classnames"

import {useSocialGraphLoaded} from "@/utils/socialGraph"
import EventBorderless from "@/shared/components/event/EventBorderless"
import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import usePopularHomeFeedEvents from "@/shared/hooks/usePopularHomeFeedEvents"

export default function PopularFeed({
  small = true,
  randomSort = true,
}: {
  small?: boolean
  randomSort?: boolean
  days?: number
}) {
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const [displayCount, setDisplayCount] = useState(10)
  const {events, loadMore, loading} = usePopularHomeFeedEvents()

  // Apply randomization if requested
  const displayEvents = useMemo(() => {
    if (!events.length) return []

    if (randomSort) {
      return [...events].sort(() => Math.random() - 0.5)
    }

    return events
  }, [events, randomSort])

  const visibleEvents = small ? displayEvents.slice(0, displayCount) : displayEvents

  const customLoadMore = useCallback(() => {
    if (small) {
      setDisplayCount((prevCount) => prevCount + 10)
    } else {
      loadMore()
    }
  }, [small, loadMore])

  const isTestEnvironment =
    typeof window !== "undefined" && window.location.href.includes("localhost:5173")
  if (!isSocialGraphLoaded && !isTestEnvironment) {
    return null
  }

  const emptyPlaceholder = <div className="px-4">No popular posts found</div>

  if (small) {
    return (
      <InfiniteScroll onLoadMore={customLoadMore}>
        <div
          className={classNames("flex flex-col gap-4", {
            "text-base-content/50": small,
          })}
        >
          {!loading && visibleEvents.length === 0 ? emptyPlaceholder : null}
          {visibleEvents.map((event) => (
            <EventBorderless key={event.id} eventId={event.id} />
          ))}
        </div>
      </InfiniteScroll>
    )
  }

  // For non-small, use full FeedItem display
  return (
    <InfiniteScroll onLoadMore={customLoadMore}>
      <div className="flex flex-col">
        {!loading && visibleEvents.length === 0 ? emptyPlaceholder : null}
        {visibleEvents.map((event) => (
          <FeedItem key={event.id} event={event} />
        ))}
      </div>
    </InfiniteScroll>
  )
}
