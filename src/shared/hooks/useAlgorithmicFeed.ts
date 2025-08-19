import {
  useReactionSubscription,
  useChronologicalSubscription,
  type SubscriptionCache,
} from "./useNostrSubscriptions"
import useCombinedPostFetcher from "./useCombinedPostFetcher"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface FeedCache {
  combinedPostFetcher?: CombinedPostFetcherCache
  subscriptionCache: SubscriptionCache
}

interface FeedConfig {
  filterSeen?: boolean
  showReplies?: boolean
  popularRatio?: number
}

export default function useAlgorithmicFeed(cache: FeedCache, config: FeedConfig = {}) {
  const {showReplies = false, filterSeen = false, popularRatio = 0.5} = config

  const {getNext: getNextPopular} = useReactionSubscription({
    cache: cache.subscriptionCache,
    filterSeen,
    showReplies,
  })

  const {getNext: getNextChronological} = useChronologicalSubscription({
    cache: cache.subscriptionCache,
    filterSeen,
    showReplies,
  })

  const result = useCombinedPostFetcher({
    getNextPopular,
    getNextChronological,
    cache: cache.combinedPostFetcher || {},
    popularRatio,
  })

  return result
}
