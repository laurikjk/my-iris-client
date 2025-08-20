import {useEffect, useRef, useState, useCallback} from "react"
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
const INITIAL_TIME_RANGE = 48 * 60 * 60 // Start with 2 days
const TIME_RANGE_INCREMENT = 24 * 60 * 60 // Add 1 day per expansion

interface ReactionSubscriptionCache {
  hasInitialData?: boolean
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
}

export default function useReactionSubscription(
  cache: ReactionSubscriptionCache,
  filterSeen?: boolean
) {
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const showingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const pendingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)
  const [timeRange, setTimeRange] = useState(INITIAL_TIME_RANGE)

  const myPubKey = useUserStore((state) => state.publicKey)
  const myFollows = useFollows(myPubKey, false)
  const shouldUseFallback = myFollows.length === 0

  // Get authors with fixed follow distance (always second degree)
  const getAuthors = () => {
    if (!isSocialGraphLoaded) return []

    const baseAuthors = shouldUseFallback
      ? Array.from(socialGraph().getFollowedByUser(DEFAULT_SOCIAL_GRAPH_ROOT))
      : myFollows

    const expandedAuthors = new Set(baseAuthors)
    baseAuthors.forEach((pubkey) => {
      const secondDegreeFollows = socialGraph().getFollowedByUser(pubkey)
      secondDegreeFollows.forEach((follow) => expandedAuthors.add(follow))
    })

    return Array.from(expandedAuthors)
  }

  const expandTimeRange = useCallback(() => {
    setTimeRange((prev) => prev + TIME_RANGE_INCREMENT)
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

    const authors = getAuthors()
    if (!authors.length) return

    const now = Math.floor(Date.now() / 1000)
    const since = now - timeRange

    const reactionFilter: NDKFilter = {
      kinds: [KIND_REACTION, KIND_REPOST],
      since,
      authors,
      limit: 1000, // Fixed limit
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
  }, [
    timeRange,
    hasInitialData,
    isSocialGraphLoaded,
    filterSeen,
    shouldUseFallback,
    myFollows,
  ])

  const getNextMostPopular = (n: number): string[] => {
    const currentPendingCount = pendingReactionCounts.current.size
    if (currentPendingCount <= LOW_THRESHOLD) {
      expandTimeRange()
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

    return top.map(([eventId]) => eventId)
  }

  return {
    getNextMostPopular,
    hasInitialData,
  }
}
