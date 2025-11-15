import {useEffect, useRef, useState} from "react"
import {NDKFilter} from "@/lib/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_REACTION, KIND_REPOST} from "@/utils/constants"
import {getTag} from "@/utils/nostr"
import {PopularityFilters} from "./usePopularityFilters"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import {seenEventIds} from "@/utils/memcache"

const LOW_THRESHOLD = 20
const INITIAL_DATA_THRESHOLD = 5

interface ReactionSubscriptionCache {
  hasInitialData?: boolean
  pendingReactionCounts?: Map<string, Set<string>>
  showingReactionCounts?: Map<string, Set<string>>
}

export default function useReactionSubscription(
  currentFilters: PopularityFilters,
  expandFilters: () => void,
  cache: ReactionSubscriptionCache,
  filterSeen?: boolean
) {
  const isSocialGraphLoaded = useSocialGraphLoaded()
  const showingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const pendingReactionCounts = useRef<Map<string, Set<string>>>(new Map())
  const oldestEventAt = useRef<number | null>(null)
  const unfilteredEventsReceivedAfterFilterChange = useRef(0)
  const expansionsWithoutNewEvents = useRef(0)
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)

  useEffect(() => {
    if (cache.pendingReactionCounts) {
      pendingReactionCounts.current = cache.pendingReactionCounts
    }
    if (cache.showingReactionCounts) {
      showingReactionCounts.current = cache.showingReactionCounts
    }
  }, [])

  useEffect(() => {
    cache.hasInitialData = hasInitialData
  }, [hasInitialData, cache])

  useEffect(() => {
    const {since, limit, authors: filterAuthors} = currentFilters

    console.log(
      "[ReactionSubscription] Starting subscription, authors:",
      filterAuthors?.length || "undefined (match all)"
    )

    const now = Math.floor(Date.now() / 1000)

    const reactionFilter: NDKFilter = {
      kinds: [KIND_REACTION, KIND_REPOST],
      since,
      until: oldestEventAt.current || now,
      authors: filterAuthors,
      limit,
    }

    unfilteredEventsReceivedAfterFilterChange.current = 0

    const sub = ndk().subscribe(reactionFilter)

    let reactionCount = 0
    sub.on("event", (event) => {
      if (!event.created_at || !event.id) return
      if (event.kind !== KIND_REACTION) return
      const originalPostId = getTag("e", event.tags)
      if (!originalPostId) return

      if (filterSeen && seenEventIds.has(originalPostId)) return

      reactionCount++
      if (reactionCount <= 5) {
        console.log(
          `[ReactionSubscription] Reaction ${reactionCount} to post:`,
          originalPostId.slice(0, 8)
        )
      }

      unfilteredEventsReceivedAfterFilterChange.current += 1

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

    const timeout = setTimeout(() => {
      if (pendingReactionCounts.current.size <= LOW_THRESHOLD) {
        if (unfilteredEventsReceivedAfterFilterChange.current === 0) {
          expansionsWithoutNewEvents.current += 1
        }
        if (expansionsWithoutNewEvents.current < 3) {
          expandFilters()
        }
      }
    }, 5000)

    return () => {
      clearTimeout(timeout)
      sub.stop()
    }
  }, [currentFilters, isSocialGraphLoaded])

  const getNextMostPopular = (n: number): string[] => {
    // Note: We don't call expandFilters() here to avoid triggering re-renders during data fetching
    // It will be called by the timeout in the subscription effect if needed

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
  }
}
