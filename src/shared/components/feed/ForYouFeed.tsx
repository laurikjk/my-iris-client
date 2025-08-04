import {memo} from "react"
import FeedWidget from "./FeedWidget"
import useForYouFeedEvents from "@/shared/hooks/useForYouFeedEvents"
import {useFeedStore} from "@/stores/feed"

interface ForYouFeedDisplayOptions {
  small?: boolean
  showDisplaySelector?: boolean
  randomSort?: boolean
}

interface ForYouFeedProps {
  displayOptions?: ForYouFeedDisplayOptions
}

const defaultDisplayOptions: ForYouFeedDisplayOptions = {
  small: false,
  showDisplaySelector: true,
  randomSort: false,
}

const ForYouFeed = memo(function ForYouFeed({displayOptions = {}}: ForYouFeedProps) {
  const {small, showDisplaySelector, randomSort} = {
    ...defaultDisplayOptions,
    ...displayOptions,
  }

  const {events, loadMore, loading} = useForYouFeedEvents()
  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  return (
    <FeedWidget
      events={events}
      loading={loading}
      loadMore={loadMore}
      displayAs={small ? "borderless" : displayAs}
      showDisplaySelector={showDisplaySelector}
      onDisplayAsChange={setDisplayAs}
      emptyMessage="No posts found for you"
      loadingMessage="Loading your personalized feed..."
      small={small}
      randomSort={randomSort}
    />
  )
})

export default ForYouFeed
