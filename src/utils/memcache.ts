import {NDKEvent} from "@/lib/ndk"
import {LRUCache} from "typescript-lru-cache"
import throttle from "lodash/throttle"
import localforage from "localforage"
import {FeedType} from "@/stores/feed"

export const eventsByIdCache = new LRUCache({maxSize: 500})
export const seenEventIds = new LRUCache<string, boolean>({maxSize: 10000})

// Cache for NIP-05 verification results
export const nip05VerificationCache = new LRUCache<string, boolean>({maxSize: 1000})

// Cache for imgproxy failures - track URLs that failed to load through proxy
export const imgproxyFailureCache = new LRUCache<string, boolean>({maxSize: 100})

// Cache for loaded images to prevent remounting and flashing
export const loadedImageCache = new LRUCache<string, string>({maxSize: 200})

// Special feed cache interfaces

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

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface AlgorithmicFeedCache {
  combinedPostFetcher: CombinedPostFetcherCache
  reactionSubscription: ReactionSubscriptionCache
  chronologicalSubscription: ChronologicalSubscriptionCache
}

export const feedCaches: Partial<Record<FeedType, AlgorithmicFeedCache>> = {}

export const getOrCreateAlgorithmicFeedCache = (feedId: FeedType) => {
  if (!feedCaches[feedId]) {
    feedCaches[feedId] = {
      combinedPostFetcher: {},
      reactionSubscription: {},
      chronologicalSubscription: {},
    }
  }
  return feedCaches[feedId]
}

// Load seenEventIds from localForage
localforage
  .getItem<string[]>("seenEventIds")
  .then((s) => {
    if (s) {
      s.forEach((id) => seenEventIds.set(id, true))
    }
  })
  .catch((e) => {
    console.error("failed to load seenEventIds:", e)
  })

const throttledSave = throttle(
  () => localforage.setItem("seenEventIds", [...seenEventIds.keys()]),
  5000
)

export const addSeenEventId = (id: string) => {
  seenEventIds.set(id, true)
  throttledSave()
}

export const clearAlgorithmicFeedCaches = () => {
  // Clear all algorithmic feed caches but keep pending lists to refresh fast
  Object.keys(feedCaches).forEach((key) => {
    const cache = feedCaches[key as FeedType]
    if (cache) {
      cache.combinedPostFetcher.events = []
      cache.combinedPostFetcher.hasLoadedInitial = false
      cache.reactionSubscription.hasInitialData = false
      cache.reactionSubscription.pendingReactionCounts?.clear()
      cache.reactionSubscription.showingReactionCounts?.clear()
      cache.chronologicalSubscription.hasInitialData = false
      cache.chronologicalSubscription.pendingPosts?.clear()
      cache.chronologicalSubscription.showingPosts?.clear()
      console.warn(`Cleared algorithmic feed cache for ${key}`, cache)
    }
  })
}
