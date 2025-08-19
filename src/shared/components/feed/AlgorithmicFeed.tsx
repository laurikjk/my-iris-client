import FeedWidget from "./FeedWidget"
import useAlgorithmicFeed from "@/shared/hooks/useAlgorithmicFeed"
import {useFeedStore, type FeedType} from "@/stores/feed"
import {getOrCreateAlgorithmicFeedCache} from "@/utils/memcache"
import {useScrollContainer} from "@/contexts/useScrollContainer"
import {useEffect} from "react"

interface FeedDisplayOptions {
  small?: boolean
  showDisplaySelector?: boolean
}

interface AlgorithmicFeedProps {
  type: FeedType
  displayOptions?: FeedDisplayOptions
}

const defaultDisplayOptions: FeedDisplayOptions = {
  small: false,
  showDisplaySelector: true,
}

const feedConfigs = {
  popular: {
    filterSeen: false,
    includeChronological: false,
    emptyMessage: "No popular posts found",
    loadingMessage: "Loading popular posts...",
  },
  "for-you": {
    filterSeen: false, // TODO: Implement seen filtering that works with algorithmic feeds
    includeChronological: true,
    emptyMessage: "No posts found for you",
    loadingMessage: "Loading your personalized feed...",
  },
}

const AlgorithmicFeed = function AlgorithmicFeed({
  type,
  displayOptions = {},
}: AlgorithmicFeedProps) {
  const scrollContainer = useScrollContainer()

  const {small, showDisplaySelector} = {
    ...defaultDisplayOptions,
    ...displayOptions,
  }

  const config = feedConfigs[type]

  const cache = getOrCreateAlgorithmicFeedCache(type)

  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  const {events, loadMore, loading, isStuck} = useAlgorithmicFeed(cache, {
    filterSeen: config.filterSeen,
    popularRatio: config.includeChronological ? 0.5 : 1.0,
  })

  useEffect(() => {
    if (events.length === 0 && !loading) loadMore()
    if (isStuck) loadMore()
  }, [isStuck])

  if (loading && events.length === 0) {
    return null
  }
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
      scrollContainer={scrollContainer}
    />
  )
}

export default AlgorithmicFeed
