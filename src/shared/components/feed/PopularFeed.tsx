import classNames from "classnames"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import EventBorderless from "@/shared/components/event/EventBorderless"
import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import usePopularHomeFeedEvents from "@/shared/hooks/usePopularHomeFeedEvents"

export default function PopularFeed({small = true}: {small?: boolean}) {
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const {events, loadMore, loading} = usePopularHomeFeedEvents()

  if (!isSocialGraphLoaded) {
    return <div className="px-4">Loading popular posts...</div>
  }

  const emptyPlaceholder = <div className="px-4">No popular posts found</div>

  if (small) {
    return (
      <InfiniteScroll onLoadMore={loadMore}>
        <div
          className={classNames("flex flex-col gap-4", {
            "text-base-content/50": small,
          })}
        >
          {!loading && events.length === 0 ? emptyPlaceholder : null}
          {events.map((event) => (
            <EventBorderless key={event.id} eventId={event.id} />
          ))}
        </div>
      </InfiniteScroll>
    )
  }

  return (
    <InfiniteScroll onLoadMore={loadMore}>
      <div className="flex flex-col">
        {!loading && events.length === 0 ? emptyPlaceholder : null}
        {events.map((event) => (
          <FeedItem key={event.id} event={event} />
        ))}
      </div>
    </InfiniteScroll>
  )
}
