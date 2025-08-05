import useReactionSubscription from "./useReactionSubscription"
import useChronologicalSubscription from "./useChronologicalSubscription"
import useCombinedPostFetcher from "./useCombinedPostFetcher"
import usePostFetcher from "./usePostFetcher"
import usePopularityFilters from "./usePopularityFilters"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface PostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

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
  timeRange?: number
}

interface PopularityFiltersCache {
  filterLevel?: number
}

interface FeedCache {
  postFetcher?: PostFetcherCache
  combinedPostFetcher?: CombinedPostFetcherCache
  reactionSubscription: ReactionSubscriptionCache
  chronologicalSubscription?: ChronologicalSubscriptionCache
  popularityFilters: PopularityFiltersCache
}

interface FeedConfig {
  filterSeen?: boolean
  includeChronological?: boolean
  popularRatio?: number
}

export default function useAlgorithmicFeed(cache: FeedCache, config: FeedConfig = {}) {
  const {filterSeen = false, includeChronological = false, popularRatio = 0.5} = config

  const {currentFilters, expandFilters} = usePopularityFilters(cache.popularityFilters)

  const {getNextMostPopular, hasInitialData: hasPopularData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    cache.reactionSubscription,
    filterSeen
  )

  const {getNextChronological, hasInitialData: hasChronologicalData} =
    useChronologicalSubscription(cache.chronologicalSubscription || {}, filterSeen)
  const popularFeedResult = usePostFetcher(
    getNextMostPopular,
    hasPopularData,
    cache.postFetcher || {}
  )

  const forYouFeedResult = useCombinedPostFetcher({
    getNextPopular: getNextMostPopular,
    getNextChronological,
    hasPopularData,
    hasChronologicalData,
    cache: cache.combinedPostFetcher || {},
    popularRatio,
  })

  return includeChronological ? forYouFeedResult : popularFeedResult
}
