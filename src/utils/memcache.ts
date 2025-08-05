import {NDKEvent} from "@nostr-dev-kit/ndk"
import {SortedMap} from "./SortedMap/SortedMap"
import {LRUCache} from "typescript-lru-cache"
import throttle from "lodash/throttle"
import localforage from "localforage"

export const eventsByIdCache = new LRUCache({maxSize: 500})
export const feedCache = new LRUCache<string, SortedMap<string, NDKEvent>>({maxSize: 10})
export const replyFeedCache = new LRUCache<string, SortedMap<string, NDKEvent>>({
  maxSize: 20,
})
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

interface PopularityFiltersCache {
  filterLevel?: number
}

interface ChronologicalSubscriptionCache {
  hasInitialData?: boolean
  pendingPosts?: Map<string, number>
  showingPosts?: Map<string, number>
  timeRange?: number
}

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface AlgorithmicFeedCache {
  popularityFilters: PopularityFiltersCache
  combinedPostFetcher: CombinedPostFetcherCache
  reactionSubscription: ReactionSubscriptionCache
  chronologicalSubscription: ChronologicalSubscriptionCache
}

const algorithmicFeedCache = new LRUCache<string, AlgorithmicFeedCache>({
  maxSize: 10,
})

export const getOrCreateAlgorithmicFeedCache = (feedId: string): AlgorithmicFeedCache => {
  let cache = algorithmicFeedCache.get(feedId)
  if (!cache) {
    cache = {
      popularityFilters: {},
      combinedPostFetcher: {},
      reactionSubscription: {},
      chronologicalSubscription: {},
    }
    algorithmicFeedCache.set(feedId, cache)
  }
  return cache
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
