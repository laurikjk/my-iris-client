import {memo} from "react"
import FeedWidget from "./FeedWidget"
import usePopularHomeFeedEvents from "@/shared/hooks/usePopularHomeFeedEvents"
import {useFeedStore} from "@/stores/feed"

interface PopularFeedDisplayOptions {
  small?: boolean
  showDisplaySelector?: boolean
  randomSort?: boolean
}

interface PopularFeedProps {
  displayOptions?: PopularFeedDisplayOptions
}

const defaultDisplayOptions: PopularFeedDisplayOptions = {
  small: false,
  showDisplaySelector: true,
  randomSort: false,
}

const PopularFeed = memo(function PopularFeed({displayOptions = {}}: PopularFeedProps) {
  const {small, showDisplaySelector, randomSort} = {
    ...defaultDisplayOptions,
    ...displayOptions,
  }

  const {events, loadMore, loading} = usePopularHomeFeedEvents()
  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  return (
    <FeedWidget
      events={events}
      loading={loading}
      loadMore={loadMore}
      displayAs={small ? "borderless" : displayAs}
      showDisplaySelector={showDisplaySelector}
      onDisplayAsChange={setDisplayAs}
      emptyMessage="No popular posts found"
      loadingMessage="Loading popular posts..."
      small={small}
      randomSort={randomSort}
    />
  )
})

export default PopularFeed
