import {memo} from "react"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import FeedItem from "../event/FeedItem/FeedItem"
import MediaFeed from "./MediaFeed"
import {DisplayAsSelector} from "./DisplayAsSelector"
import usePopularHomeFeedEvents from "@/shared/hooks/usePopularHomeFeedEvents"
import {useFeedStore} from "@/stores/feed"

const PopularHomeFeed = memo(function PopularHomeFeed() {
  const {events, loadMore, loading} = usePopularHomeFeedEvents()
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

export default PopularHomeFeed
