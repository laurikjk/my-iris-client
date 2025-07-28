import {memo} from "react"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import FeedItem from "../event/FeedItem/FeedItem"
import MediaFeed from "./MediaFeed"
import {DisplayAsSelector} from "./DisplayAsSelector"
import useSpecialFeedEvents from "@/shared/hooks/useSpecialFeedEvents"
import {useFeedStore} from "@/stores/feed"

const SpecialFeed = memo(function SpecialFeed() {
  const {events, loadMore, loading} = useSpecialFeedEvents()
  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  if (events.length === 0 && loading) {
    return (
      <div className="p-8 flex items-center justify-center text-base-content/50">
        Loading popular posts...
      </div>
    )
  }

  if (events.length === 0 && !loading) {
    return (
      <div className="p-8 flex items-center justify-center text-base-content/50">
        No popular posts found.
      </div>
    )
  }

  return (
    <>
      <DisplayAsSelector activeSelection={displayAs} onSelect={setDisplayAs} />

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

export default SpecialFeed
