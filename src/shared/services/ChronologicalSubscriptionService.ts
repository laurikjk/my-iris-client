import {NDKFilter, NDKSubscription, NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {seenEventIds} from "@/utils/memcache"
import {getEventReplyingTo} from "@/utils/nostr"
import {LRUCache} from "typescript-lru-cache"

const LOW_THRESHOLD = 15
const INITIAL_TIME_RANGE = 48 * 60 * 60
const TIME_RANGE_INCREMENT = 24 * 60 * 60

interface ChronologicalServiceCacheState {
  pendingPosts: Map<string, number>
  showingPosts: Map<string, number>
  follows: string[]
  timeRange: number
}

// Service-specific cache
const chronologicalServiceCache = new LRUCache<string, ChronologicalServiceCacheState>({
  maxSize: 10,
})

export class ChronologicalSubscriptionService {
  private subscription: NDKSubscription | null = null
  private showingPosts: Map<string, number> = new Map()
  private pendingPosts: Map<string, number> = new Map()
  private filterSeen: boolean
  private showReplies: boolean
  private timeRange: number
  private follows: string[] = []
  private isReady: boolean = false
  private waitForReady: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private readyTimeout: NodeJS.Timeout | null = null
  private cacheKey: string | undefined

  constructor(filterSeen = false, showReplies = false, cacheKey?: string) {
    this.filterSeen = filterSeen
    this.showReplies = showReplies
    this.cacheKey = cacheKey
    this.timeRange = INITIAL_TIME_RANGE

    // Restore from cache if available
    if (cacheKey) {
      const cached = chronologicalServiceCache.get(cacheKey)
      if (cached) {
        this.pendingPosts = cached.pendingPosts
        this.showingPosts = cached.showingPosts
        this.follows = cached.follows
        this.timeRange = cached.timeRange
      }
    }

    this.waitForReady = new Promise<void>((resolve) => {
      this.readyResolve = resolve
    })

    if (this.pendingPosts.size >= 20) {
      this.isReady = true
      this.readyResolve?.()
    }
  }

  start(follows: string[]) {
    this.stop()

    if (!follows.length) {
      return
    }

    this.follows = follows

    if (!this.isReady) {
      this.readyTimeout = setTimeout(() => {
        if (!this.isReady) {
          this.expandTimeRange()
          this.isReady = true
          this.readyResolve?.()
        }
      }, 5000)
    }

    const now = Math.floor(Date.now() / 1000)
    const chronologicalFilter: NDKFilter = {
      kinds: [KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT],
      authors: follows,
      since: now - this.timeRange,
      limit: 300,
    }

    this.subscription = ndk().subscribe(chronologicalFilter)

    this.subscription.on("event", (event: NDKEvent) => {
      if (!event.created_at || !event.id) return
      if (this.filterSeen && seenEventIds.has(event.id)) return

      if (!this.showReplies && getEventReplyingTo(event)) {
        return
      }

      if (!this.showingPosts.has(event.id) && !this.pendingPosts.has(event.id)) {
        this.pendingPosts.set(event.id, event.created_at)
        this.updateCache()
      }

      if (!this.isReady && this.pendingPosts.size >= 20) {
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

  private expandTimeRange() {
    this.timeRange += TIME_RANGE_INCREMENT
    this.updateCache()

    if (this.follows.length > 0) {
      this.start(this.follows)
    }
  }

  async getNext(n: number): Promise<NDKEvent[]> {
    if (!this.isReady && this.waitForReady) {
      await this.waitForReady
    }
    const currentPendingCount = this.pendingPosts.size
    if (currentPendingCount <= LOW_THRESHOLD) {
      this.expandTimeRange()
    }

    const top = Array.from(this.pendingPosts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)

    const eventIds = top.map(([eventId]) => eventId)

    top.forEach(([eventId, timestamp]) => {
      this.pendingPosts.delete(eventId)
      this.showingPosts.set(eventId, timestamp)
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
      chronologicalServiceCache.set(this.cacheKey, {
        pendingPosts: this.pendingPosts,
        showingPosts: this.showingPosts,
        follows: this.follows,
        timeRange: this.timeRange,
      })
    }
  }
}
