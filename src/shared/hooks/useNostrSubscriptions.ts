import {useEffect, useRef, useState, useCallback, useMemo} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {
  KIND_REACTION,
  KIND_REPOST,
  KIND_TEXT_NOTE,
  KIND_LONG_FORM_CONTENT,
} from "@/utils/constants"
import {getTag, getEventReplyingTo} from "@/utils/nostr"
import socialGraph, {
  useSocialGraphLoaded,
  DEFAULT_SOCIAL_GRAPH_ROOT,
} from "@/utils/socialGraph"
import {useUserStore} from "@/stores/user"
import useFollows from "./useFollows"
import {seenEventIds} from "@/utils/memcache"

// Common types
export interface SubscriptionCache {
  // Reaction subscription cache
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
  filterLevel?: number
  // Chronological subscription cache
  pendingPosts?: Map<string, number>
  showingPosts?: Map<string, number>
  timeRange?: number
}

export interface SubscriptionConfig {
  cache: SubscriptionCache
  filterSeen?: boolean
  showReplies?: boolean
}

export interface SubscriptionHook {
  getNext: (n: number) => Promise<NDKEvent[]>
}

// Constants
const REACTION_LOW_THRESHOLD = 20
const CHRONOLOGICAL_LOW_THRESHOLD = 15
const INITIAL_TIME_RANGE = 48 * 60 * 60 // 2 days
const TIME_RANGE_INCREMENT = 24 * 60 * 60
const BASE_TIME_RANGE = 48 * 60 * 60
const BASE_LIMIT = 500

// Popularity filters types and logic
interface PopularityFilters {
  timeRange: number
  limit: number
  authors: string[] | undefined
}

function calculateFilters(level: number, baseAuthors: string[]): PopularityFilters {
  const timeMultiplier = Math.pow(2, level)
  const limitMultiplier = Math.pow(1.5, level)

  let currentAuthors = baseAuthors

  if (level >= 2) {
    const expandedAuthors = new Set(baseAuthors)
    baseAuthors.forEach((pubkey) => {
      const secondDegreeFollows = socialGraph().getFollowedByUser(pubkey)
      secondDegreeFollows.forEach((follow) => expandedAuthors.add(follow))
    })
    currentAuthors = Array.from(expandedAuthors)
  }

  if (level >= 4) {
    currentAuthors = []
  }

  return {
    timeRange: BASE_TIME_RANGE * timeMultiplier,
    limit: Math.floor(BASE_LIMIT * limitMultiplier),
    authors: currentAuthors.length > 0 ? currentAuthors : undefined,
  }
}

// Reaction Subscription Hook
export function useReactionSubscription(config: SubscriptionConfig): SubscriptionHook {
  const {cache, filterSeen, showReplies} = config
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const myPubKey = useUserStore((state) => state.publicKey)
  const myFollows = useFollows(myPubKey, false)

  const showingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const pendingReactionCounts = useRef<Map<string, Set<string>>>(new Map())

  const loadingAfterFilterChange = useRef(false)
  const resolvedAfterFilterChange = useRef<(() => void) | null>(null)

  const [filterLevel, setFilterLevel] = useState(
    typeof cache.filterLevel === "number" ? cache.filterLevel : 0
  )

  const shouldUseFallback = myFollows.length === 0

  const baseAuthors = useMemo(() => {
    if (shouldUseFallback) {
      return Array.from(socialGraph().getFollowedByUser(DEFAULT_SOCIAL_GRAPH_ROOT))
    }
    return myFollows
  }, [shouldUseFallback, myFollows])

  const currentFilters = useMemo(() => {
    return calculateFilters(filterLevel, baseAuthors)
  }, [filterLevel, baseAuthors])

  const expandFilters = useCallback(() => {
    // Set up promise to wait for EOSE after filter expansion
    loadingAfterFilterChange.current = true
    const promise = new Promise<void>((resolve) => {
      resolvedAfterFilterChange.current = resolve
    })

    setFilterLevel((prev) => {
      const newLevel = prev + 1
      cache.filterLevel = newLevel
      return newLevel
    })

    return promise
  }, [cache])

  useEffect(() => {
    if (cache.pendingReactionCounts) {
      pendingReactionCounts.current = cache.pendingReactionCounts
    }
    if (cache.showingReactionCounts) {
      showingReactionCounts.current = cache.showingReactionCounts
    }
  }, [])

  useEffect(() => {
    if (!isSocialGraphLoaded) {
      return
    }

    const {timeRange, limit, authors: filterAuthors} = currentFilters
    const now = Math.floor(Date.now() / 1000)
    const since = now - timeRange

    const reactionFilter: NDKFilter = {
      kinds: [KIND_REACTION, KIND_REPOST],
      since,
      authors: filterAuthors,
      limit,
    }

    const sub = ndk().subscribe(reactionFilter)

    sub.on("event", (event) => {
      if (event.kind !== KIND_REACTION) return

      const originalPostId = getTag("e", event.tags)

      if (!originalPostId) return

      if (filterSeen && seenEventIds.has(originalPostId)) return

      if (showingReactionCounts.current.has(originalPostId)) {
        showingReactionCounts.current.get(originalPostId)?.add(event.id)
      } else if (pendingReactionCounts.current.has(originalPostId)) {
        pendingReactionCounts.current.get(originalPostId)?.add(event.id)
      } else {
        pendingReactionCounts.current.set(originalPostId, new Set([event.id]))
      }

      cache.pendingReactionCounts = pendingReactionCounts.current
      cache.showingReactionCounts = showingReactionCounts.current
    })

    sub.on("eose", () => {
      // Resolve the promise if we were waiting for EOSE after filter expansion
      if (loadingAfterFilterChange.current && resolvedAfterFilterChange.current) {
        loadingAfterFilterChange.current = false
        resolvedAfterFilterChange.current()
        resolvedAfterFilterChange.current = null
      }
    })

    return () => sub.stop()
  }, [currentFilters, isSocialGraphLoaded, filterSeen, cache])

  const getNext = async (n: number): Promise<NDKEvent[]> => {
    let currentPendingCount = pendingReactionCounts.current.size

    // If we're below threshold, expand filters and wait for EOSE
    if (currentPendingCount <= REACTION_LOW_THRESHOLD) {
      const expansionPromise = expandFilters()

      // Wait for EOSE to ensure we've received new events
      await expansionPromise

      // Re-check pending count after expansion
      currentPendingCount = pendingReactionCounts.current.size
    }

    const top = Array.from(pendingReactionCounts.current.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, n)

    top.forEach(([eventId, reactions]) => {
      pendingReactionCounts.current.delete(eventId)
      showingReactionCounts.current.set(eventId, reactions)
    })

    cache.pendingReactionCounts = pendingReactionCounts.current
    cache.showingReactionCounts = showingReactionCounts.current

    if (top.length === 0) {
      return []
    }

    const events = await ndk().fetchEvents({
      ids: top.map(([eventId]) => eventId),
    })

    const eventMap = new Map(Array.from(events).map((e) => [e.id, e]))
    const results = top
      .map(([eventId]) => eventMap.get(eventId))
      .filter((e): e is NDKEvent => e !== undefined)
      .filter((e) => showReplies || !getEventReplyingTo(e))

    return results
  }

  return {getNext}
}

export function useChronologicalSubscription(
  config: SubscriptionConfig
): SubscriptionHook {
  const {cache, filterSeen, showReplies} = config
  const myPubKey = useUserStore((state) => state.publicKey)
  const follows = useFollows(myPubKey, true)
  const isSocialGraphLoaded = useSocialGraphLoaded()

  const showingPosts = useRef<Map<string, number>>(new Map())
  const pendingPosts = useRef<Map<string, number>>(new Map())
  const [timeRange, setTimeRange] = useState(cache.timeRange || INITIAL_TIME_RANGE)

  const loadingAfterExpansion = useRef(false)
  const resolvedAfterExpansion = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (cache.pendingPosts) {
      pendingPosts.current = cache.pendingPosts
    }
    if (cache.showingPosts) {
      showingPosts.current = cache.showingPosts
    }
  }, [])

  useEffect(() => {
    if (!isSocialGraphLoaded || !follows.length) {
      return
    }

    const now = Math.floor(Date.now() / 1000)
    const chronologicalFilter: NDKFilter = {
      kinds: [KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT],
      authors: follows,
      since: now - timeRange,
      limit: 300,
    }

    const sub = ndk().subscribe(chronologicalFilter)

    sub.on("event", (event) => {
      if (!event.created_at || !event.id) return
      if (filterSeen && seenEventIds.has(event.id)) return
      if (!showReplies && getEventReplyingTo(event)) return

      if (!showingPosts.current.has(event.id) && !pendingPosts.current.has(event.id)) {
        pendingPosts.current.set(event.id, event.created_at)
      }

      cache.pendingPosts = pendingPosts.current
      cache.showingPosts = showingPosts.current
    })

    sub.on("eose", () => {
      // Resolve the promise if we were waiting for EOSE after time range expansion
      if (loadingAfterExpansion.current && resolvedAfterExpansion.current) {
        loadingAfterExpansion.current = false
        resolvedAfterExpansion.current()
        resolvedAfterExpansion.current = null
      }
    })

    return () => sub.stop()
  }, [follows, isSocialGraphLoaded, timeRange, filterSeen, showReplies, cache])

  const expandTimeRange = useCallback(() => {
    // Set up promise to wait for EOSE after time range expansion
    loadingAfterExpansion.current = true
    const promise = new Promise<void>((resolve) => {
      resolvedAfterExpansion.current = resolve
    })

    setTimeRange((prev) => {
      const newRange = prev + TIME_RANGE_INCREMENT
      cache.timeRange = newRange
      return newRange
    })

    return promise
  }, [cache])

  const getNext = async (n: number): Promise<NDKEvent[]> => {
    let currentPendingCount = pendingPosts.current.size

    if (currentPendingCount <= CHRONOLOGICAL_LOW_THRESHOLD) {
      const expansionPromise = expandTimeRange()

      await expansionPromise

      currentPendingCount = pendingPosts.current.size
    }

    const top = Array.from(pendingPosts.current.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)

    top.forEach(([eventId, timestamp]) => {
      pendingPosts.current.delete(eventId)
      showingPosts.current.set(eventId, timestamp)
    })

    cache.pendingPosts = pendingPosts.current
    cache.showingPosts = showingPosts.current

    if (top.length === 0) {
      return []
    }

    const events = await ndk().fetchEvents({
      ids: top.map(([eventId]) => eventId),
    })

    // Sort events by their timestamp order
    const eventMap = new Map(Array.from(events).map((e) => [e.id, e]))
    const results = top
      .map(([eventId]) => eventMap.get(eventId))
      .filter((e): e is NDKEvent => e !== undefined)
      .filter((e) => showReplies || !getEventReplyingTo(e))

    return results
  }

  return {getNext}
}
