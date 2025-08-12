import FeedWidget from "./FeedWidget"
import useAlgorithmicFeed from "@/shared/hooks/useAlgorithmicFeed"
import {useFeedStore, type FeedType} from "@/stores/feed"
import {useEffect} from "react"
import {useScrollContainer} from "@/contexts/useScrollContainer"

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
    showReplies: false,
    includeChronological: false,
    emptyMessage: "No popular posts found",
    loadingMessage: "Loading popular posts...",
  },
  "for-you": {
    filterSeen: true,
    showReplies: false,
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

  const {feedDisplayAs: displayAs, setFeedDisplayAs: setDisplayAs} = useFeedStore()

  const {events, loadMore, loading} = useAlgorithmicFeed({
    filterSeen: config.filterSeen,
    showReplies: config.showReplies,
    popularRatio: config.includeChronological ? 0.5 : 1.0,
  })

  useEffect(() => {
    loadMore() // Initial load
  }, [loadMore])

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
