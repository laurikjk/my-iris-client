import {NDKFilter, NDKSubscription, NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_REACTION, KIND_REPOST} from "@/utils/constants"
import {getTag} from "@/utils/nostr"
import {seenEventIds} from "@/utils/memcache"
import {LRUCache} from "typescript-lru-cache"

const LOW_THRESHOLD = 20

export interface PopularityFilters {
  timeRange: number
  limit: number
  authors?: string[]
}

interface ReactionServiceCacheState {
  pendingReactionCounts: Map<string, Set<string>>
  showingReactionCounts: Map<string, Set<string>>
  currentFilters: PopularityFilters | null
}

// Service-specific cache
const reactionServiceCache = new LRUCache<string, ReactionServiceCacheState>({
  maxSize: 10,
})

export class ReactionSubscriptionService {
  private subscription: NDKSubscription | null = null
  private showingReactionCounts: Map<string, Set<string>> = new Map()
  private pendingReactionCounts: Map<string, Set<string>> = new Map()
  private filterSeen: boolean
  private currentFilters: PopularityFilters | null = null
  private expandFiltersCallback: (() => void) | null = null
  private isReady: boolean = false
  private waitForReady: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private readyTimeout: NodeJS.Timeout | null = null
  private cacheKey: string | undefined

  constructor(filterSeen = false, cacheKey?: string) {
    this.filterSeen = filterSeen
    this.cacheKey = cacheKey

    // Restore from cache if available
    if (cacheKey) {
      const cached = reactionServiceCache.get(cacheKey)
      if (cached) {
        this.pendingReactionCounts = cached.pendingReactionCounts
        this.showingReactionCounts = cached.showingReactionCounts
        this.currentFilters = cached.currentFilters
      }
    }

    this.waitForReady = new Promise<void>((resolve) => {
      this.readyResolve = resolve
    })

    if (this.pendingReactionCounts.size >= 20) {
      this.isReady = true
      this.readyResolve?.()
    }
  }

  start(filters: PopularityFilters, expandFiltersCallback: () => void) {
    this.stop()

    this.currentFilters = filters
    this.expandFiltersCallback = expandFiltersCallback

    if (!this.isReady) {
      this.readyTimeout = setTimeout(() => {
        if (!this.isReady && this.expandFiltersCallback) {
          this.expandFiltersCallback()
          this.isReady = true
          this.readyResolve?.()
        }
      }, 5000)
    }

    const {timeRange, limit, authors: filterAuthors} = filters
    const now = Math.floor(Date.now() / 1000)
    const since = now - timeRange

    const reactionFilter: NDKFilter = {
      kinds: [KIND_REACTION, KIND_REPOST],
      since,
      authors: filterAuthors,
      limit,
    }

    this.subscription = ndk().subscribe(reactionFilter)

    this.subscription.on("event", (event) => {
      if (event.kind !== KIND_REACTION) return

      const originalPostId = getTag("e", event.tags)

      if (!originalPostId) return

      if (this.filterSeen && seenEventIds.has(originalPostId)) return

      if (this.showingReactionCounts.has(originalPostId)) {
        this.showingReactionCounts.get(originalPostId)?.add(event.id)
      } else if (this.pendingReactionCounts.has(originalPostId)) {
        this.pendingReactionCounts.get(originalPostId)?.add(event.id)
      } else {
        this.pendingReactionCounts.set(originalPostId, new Set([event.id]))
      }

      // Update cache
      this.updateCache()

      if (!this.isReady && this.pendingReactionCounts.size >= 20) {
        this.isReady = true
        this.readyResolve?.()
        if (this.readyTimeout) {
          clearTimeout(this.readyTimeout)
          this.readyTimeout = null
        }
      }
    })
  }

  stop() {
    if (this.subscription) {
      this.subscription.stop()
      this.subscription = null
    }

    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout)
      this.readyTimeout = null
    }
  }

  async getNext(n: number): Promise<NDKEvent[]> {
    if (!this.isReady && this.waitForReady) {
      await this.waitForReady
    }

    const currentPendingCount = this.pendingReactionCounts.size
    if (currentPendingCount <= LOW_THRESHOLD && this.expandFiltersCallback) {
      this.expandFiltersCallback()
    }

    const top = Array.from(this.pendingReactionCounts.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, n)

    const eventIds = top.map(([eventId]) => eventId)

    top.forEach(([eventId, reactions]) => {
      this.pendingReactionCounts.delete(eventId)
      this.showingReactionCounts.set(eventId, reactions)
    })

    // Update cache after moving items
    this.updateCache()

    if (eventIds.length === 0) {
      return []
    }

    const filter: NDKFilter = {
      ids: eventIds,
    }

    const events = await ndk().fetchEvents(filter)
    const eventsArray = Array.from(events)

    const eventMap = new Map(eventsArray.map((e) => [e.id, e]))
    const sortedEvents = eventIds
      .map((id) => eventMap.get(id))
      .filter((e): e is NDKEvent => e !== undefined)

    return sortedEvents
  }

  private updateCache() {
    if (this.cacheKey) {
      reactionServiceCache.set(this.cacheKey, {
        pendingReactionCounts: this.pendingReactionCounts,
        showingReactionCounts: this.showingReactionCounts,
        currentFilters: this.currentFilters,
      })
    }
  }
}
