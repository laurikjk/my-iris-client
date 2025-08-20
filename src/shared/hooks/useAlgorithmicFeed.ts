import useReactionSubscription from "./useReactionSubscription"
import useChronologicalSubscription from "./useChronologicalSubscription"
import useCombinedPostFetcher from "./useCombinedPostFetcher"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface ReactionSubscriptionCache {
  hasInitialData?: boolean
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
  timeRange?: number
}

interface ChronologicalSubscriptionCache {
  hasInitialData?: boolean
  pendingPosts?: Map<string, number>
  showingPosts?: Map<string, number>
  timeRange?: number
}

interface FeedCache {
  combinedPostFetcher?: CombinedPostFetcherCache
  reactionSubscription: ReactionSubscriptionCache
  chronologicalSubscription?: ChronologicalSubscriptionCache
}

interface FeedConfig {
  filterSeen?: boolean
  showReplies?: boolean
  popularRatio?: number
}

export default function useAlgorithmicFeed(cache: FeedCache, config: FeedConfig = {}) {
  const {showReplies = false, filterSeen = false, popularRatio = 0.5} = config

  const {getNextMostPopular, hasInitialData: hasPopularData} = useReactionSubscription(
    cache.reactionSubscription,
    filterSeen
  )

  const {getNextChronological, hasInitialData: hasChronologicalData} =
    useChronologicalSubscription(
      cache.chronologicalSubscription || {},
      filterSeen,
      showReplies
    )

  const result = useCombinedPostFetcher({
    getNextPopular: getNextMostPopular,
    getNextChronological,
    hasPopularData,
    hasChronologicalData,
    cache: cache.combinedPostFetcher || {},
    popularRatio,
  })

  const getPopularPendingCount = () => {
    return cache.reactionSubscription.pendingReactionCounts?.size || 0
  }

  const getChronologicalPendingCount = () => {
    return cache.chronologicalSubscription?.pendingPosts?.size || 0
  }

  const isStuck =
    result.events.length === 0 &&
    !result.loading &&
    (getPopularPendingCount() > 0 || getChronologicalPendingCount() > 0)

  return {...result, isStuck}
}
