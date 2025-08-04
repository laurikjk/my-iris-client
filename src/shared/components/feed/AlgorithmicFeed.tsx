import {memo} from "react"
import FeedWidget from "./FeedWidget"
import useAlgorithmicFeed from "@/shared/hooks/useAlgorithmicFeed"
import {useFeedStore, type FeedType} from "@/stores/feed"
import {getOrCreateAlgorithmicFeedCache} from "@/utils/memcache"

interface FeedDisplayOptions {
  small?: boolean
  showDisplaySelector?: boolean
  randomSort?: boolean
}

interface AlgorithmicFeedProps {
  type: FeedType
  displayOptions?: FeedDisplayOptions
}

const defaultDisplayOptions: FeedDisplayOptions = {
  small: false,
  showDisplaySelector: true,
  randomSort: false,
}

const feedConfigs = {
  popular: {
    filterSeen: false,
    includeChronological: false,
    popularRatio: 1.0,
    emptyMessage: "No popular posts found",
    loadingMessage: "Loading popular posts...",
  },
  "for-you": {
    filterSeen: true,
    includeChronological: true,
    popularRatio: 0.5,
    emptyMessage: "No posts found for you",
    loadingMessage: "Loading your personalized feed...",
  },
}

const AlgorithmicFeed = memo(function AlgorithmicFeed({
  type,
  displayOptions = {},
}: AlgorithmicFeedProps) {
  const {small, showDisplaySelector, randomSort} = {
    ...defaultDisplayOptions,
    ...displayOptions,
  }

  const config = feedConfigs[type]

  const cache = getOrCreateAlgorithmicFeedCache(type)

  const {events, loadMore, loading} = useAlgorithmicFeed(cache, {
    filterSeen: config.filterSeen,
    includeChronological: config.includeChronological,
    popularRatio: config.popularRatio,
  })

  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  return (
    <FeedWidget
      events={events}
      loading={loading}
      loadMore={loadMore}
      displayAs={small ? "borderless" : displayAs}
      showDisplaySelector={showDisplaySelector}
      onDisplayAsChange={setDisplayAs}
      emptyMessage={config.emptyMessage}
      loadingMessage={config.loadingMessage}
      small={small}
      randomSort={randomSort}
    />
  )
})

export default AlgorithmicFeed
