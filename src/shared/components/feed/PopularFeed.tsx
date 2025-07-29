import {memo} from "react"
import EventBorderless from "@/shared/components/event/EventBorderless"
import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import MediaFeed from "./MediaFeed"
import {DisplayAsSelector} from "./DisplayAsSelector"
import usePopularHomeFeedEvents from "@/shared/hooks/usePopularHomeFeedEvents"
import {useFeedStore} from "@/stores/feed"

interface PopularFeedDisplayOptions {
  small?: boolean
  showDisplaySelector?: boolean
}

interface PopularFeedProps {
  displayOptions?: PopularFeedDisplayOptions
}

const defaultDisplayOptions: PopularFeedDisplayOptions = {
  small: false,
  showDisplaySelector: true,
}

const PopularFeed = memo(function PopularFeed({displayOptions = {}}: PopularFeedProps) {
  const {small, showDisplaySelector} = {
    ...defaultDisplayOptions,
    ...displayOptions,
  }

  const {events, loadMore, loading} = usePopularHomeFeedEvents()
  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  if (events.length === 0) {
    return (
      <div
        className={
          small ? "px-4" : "p-8 flex items-center justify-center text-base-content/50"
        }
      >
        {loading ? "Loading popular posts..." : "No popular posts found"}
      </div>
    )
  }

  if (small) {
    return (
      <InfiniteScroll onLoadMore={loadMore}>
        <div className="flex flex-col gap-4 text-base-content/50">
          {events.map((event) => (
            <EventBorderless key={event.id} eventId={event.id} />
          ))}
        </div>
      </InfiniteScroll>
    )
  }

  return (
    <>
      {showDisplaySelector && (
        <DisplayAsSelector activeSelection={displayAs} onSelect={setDisplayAs} />
      )}

      <InfiniteScroll onLoadMore={loadMore}>
        {displayAs === "grid" ? (
          <MediaFeed events={events} />
        ) : (
          events.map((event) => <FeedItem key={event.id} event={event} />)
        )}
      </InfiniteScroll>
    </>
  )
})

export default PopularFeed
