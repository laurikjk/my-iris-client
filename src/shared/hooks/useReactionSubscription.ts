import {useEffect, useRef, useState, useCallback, useMemo} from "react"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_REACTION, KIND_REPOST} from "@/utils/constants"
import {getTag} from "@/utils/nostr"
import socialGraph, {
  DEFAULT_SOCIAL_GRAPH_ROOT,
  useSocialGraphLoaded,
} from "@/utils/socialGraph"
import {seenEventIds} from "@/utils/memcache"
import useFollows from "./useFollows"
import {useUserStore} from "@/stores/user"

const LOW_THRESHOLD = 20
const INITIAL_DATA_THRESHOLD = 5
const BASE_TIME_RANGE = 48 * 60 * 60 // Start with 2 days
const BASE_LIMIT = 500 // Initial limit
const TIME_RANGE_INCREMENT = 24 * 60 * 60 // Add 1 day per level
const LIMIT_INCREMENT = 250 // Add 250 per level

interface ReactionSubscriptionCache {
  hasInitialData?: boolean
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
  filterLevel?: number
}

export default function useReactionSubscription(
  cache: ReactionSubscriptionCache,
  filterSeen?: boolean
) {
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const showingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const pendingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)
  const [filterLevel, setFilterLevel] = useState(
    typeof cache.filterLevel === "number" ? cache.filterLevel : 0
  )

  const myPubKey = useUserStore((state) => state.publicKey)
  const myFollows = useFollows(myPubKey, false)
  const shouldUseFallback = myFollows.length === 0

  // Use fixed follow distance - always include second degree follows
  const fixedAuthors = useMemo(() => {
    const baseAuthors = shouldUseFallback
      ? Array.from(socialGraph().getFollowedByUser(DEFAULT_SOCIAL_GRAPH_ROOT))
      : myFollows

    const expandedAuthors = new Set(baseAuthors)
    baseAuthors.forEach((pubkey) => {
      const secondDegreeFollows = socialGraph().getFollowedByUser(pubkey)
      secondDegreeFollows.forEach((follow) => expandedAuthors.add(follow))
    })

    return Array.from(expandedAuthors)
  }, [shouldUseFallback, myFollows])

  const currentFilters = useMemo(() => {
    // Linear expansion: add TIME_RANGE_INCREMENT and LIMIT_INCREMENT per level
    const timeRange = BASE_TIME_RANGE + TIME_RANGE_INCREMENT * filterLevel
    const limit = BASE_LIMIT + LIMIT_INCREMENT * filterLevel

    return {
      timeRange,
      limit,
      authors: fixedAuthors.length > 0 ? fixedAuthors : undefined,
    }
  }, [filterLevel, fixedAuthors])

  const expandFilters = useCallback(() => {
    setFilterLevel((prev) => {
      const newLevel = prev + 1
      cache.filterLevel = newLevel
      return newLevel
    })
  }, [])

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

      if (
        !hasInitialData &&
        pendingReactionCounts.current.size >= INITIAL_DATA_THRESHOLD
      ) {
        setHasInitialData(true)
        cache.hasInitialData = true
      }
      cache.pendingReactionCounts = pendingReactionCounts.current
      cache.showingReactionCounts = showingReactionCounts.current
    })

    return () => sub.stop()
  }, [currentFilters, hasInitialData, isSocialGraphLoaded, filterSeen])

  const getNextMostPopular = (n: number): string[] => {
    const currentPendingCount = pendingReactionCounts.current.size
    if (currentPendingCount <= LOW_THRESHOLD) {
      expandFilters()
    }

    const top = Array.from(pendingReactionCounts.current.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, n)

    top.forEach(([eventId, reactions]) => {
      pendingReactionCounts.current.delete(eventId)
      showingReactionCounts.current.set(eventId, reactions)
    })

    return top.map(([eventId]) => eventId)
  }

  return {
    getNextMostPopular,
    hasInitialData,
    expandFilters,
  }
}
