import FeedWidget from "./FeedWidget"
import useAlgorithmicFeed from "@/shared/hooks/useAlgorithmicFeed"
import {useFeedStore, type FeedType} from "@/stores/feed"
import {getOrCreateAlgorithmicFeedCache} from "@/utils/memcache"
import runningOstrich from "@/assets/running-ostrich.gif"

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
    emptyMessage: "No popular posts found",
    loadingMessage: "Loading popular posts...",
  },
  "for-you": {
    filterSeen: true,
    includeChronological: true,
    emptyMessage: "No posts found for you",
    loadingMessage: "Loading your personalized feed...",
  },
}

const AlgorithmicFeed = function AlgorithmicFeed({
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
    popularRatio: config.includeChronological ? 0.5 : 1.0,
  })

  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  if (loading && events.length === 0) {
    return (
      <div className={small ? "px-4 py-2" : "p-8 flex items-center justify-center"}>
        <div className="flex flex-col items-center gap-2">
          <img src={runningOstrich} alt="Loading..." className="w-16 h-16" />
        </div>
      </div>
    )
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
      randomSort={randomSort}
    />
  )
}

export default AlgorithmicFeed
