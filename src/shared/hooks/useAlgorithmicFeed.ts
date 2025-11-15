import useReactionSubscription from "./useReactionSubscription"
import useChronologicalSubscription from "./useChronologicalSubscription"
import useCombinedPostFetcher from "./useCombinedPostFetcher"
import usePopularityFilters from "./usePopularityFilters"
import {NDKEvent} from "@/lib/ndk"

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface ReactionSubscriptionCache {
  hasInitialData?: boolean
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
}

interface ChronologicalSubscriptionCache {
  hasInitialData?: boolean
  pendingPosts?: Map<string, number>
  showingPosts?: Map<string, number>
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
  excludeOwnPosts?: boolean
}

export default function useAlgorithmicFeed(cache: FeedCache, config: FeedConfig = {}) {
  const {
    showReplies = false,
    filterSeen = false,
    popularRatio = 0.5,
    excludeOwnPosts = false,
  } = config

  console.log("[useAlgorithmicFeed] Called with config:", config)
  const {currentFilters, expandFilters} = usePopularityFilters(filterSeen)
  console.log("[useAlgorithmicFeed] currentFilters:", currentFilters)

  const {getNextMostPopular, hasInitialData: hasPopularData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    cache.reactionSubscription,
    filterSeen
  )

  const {getNextChronological, hasInitialData: hasChronologicalData} =
    useChronologicalSubscription(
      cache.chronologicalSubscription || {},
      filterSeen,
      showReplies,
      excludeOwnPosts
    )

  const result = useCombinedPostFetcher({
    getNextPopular: getNextMostPopular,
    getNextChronological,
    hasPopularData,
    hasChronologicalData,
    cache: cache.combinedPostFetcher || {},
    popularRatio,
    excludeOwnPosts,
  })

  return result
}
