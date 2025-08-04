import {useEffect, useRef, useState, useCallback} from "react"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import useFollows from "./useFollows"
import {useUserStore} from "@/stores/user"
import {seenEventIds} from "@/utils/memcache"

const LOW_THRESHOLD = 20
const INITIAL_DATA_THRESHOLD = 10
const INITIAL_TIME_RANGE = 24 * 60 * 60 // 24 hours
const TIME_RANGE_INCREMENT = 24 * 60 * 60 // Add 24 hours each expansion

interface ChronologicalSubscriptionCache {
  hasInitialData?: boolean
  pendingPosts?: Map<string, number> // eventId -> timestamp
  showingPosts?: Map<string, number>
  timeRange?: number
}

export default function useChronologicalSubscription(
  cache: ChronologicalSubscriptionCache,
  filterSeen?: boolean
) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const follows = useFollows(myPubKey, true)
  const isSocialGraphLoaded = useSocialGraphLoaded()

  const showingPosts = useRef<Map<string, number>>(new Map())
  const pendingPosts = useRef<Map<string, number>>(new Map())
  const [timeRange, setTimeRange] = useState(cache.timeRange || INITIAL_TIME_RANGE)
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)

  // Initialize refs from cache on mount
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

      // Skip seen events if filtering is enabled
      if (filterSeen && seenEventIds.has(event.id)) return

      if (!showingPosts.current.has(event.id) && !pendingPosts.current.has(event.id)) {
        pendingPosts.current.set(event.id, event.created_at)
      }

      if (!hasInitialData && pendingPosts.current.size >= INITIAL_DATA_THRESHOLD) {
        setHasInitialData(true)
        cache.hasInitialData = true
      }

      cache.pendingPosts = pendingPosts.current
      cache.showingPosts = showingPosts.current
    })

    return () => sub.stop()
  }, [follows, isSocialGraphLoaded, timeRange])

  const expandTimeRange = useCallback(() => {
    setTimeRange((prev) => {
      const newRange = prev + TIME_RANGE_INCREMENT
      cache.timeRange = newRange
      return newRange
    })
  }, [])

  const getNextChronological = (n: number): string[] => {
    const currentPendingCount = pendingPosts.current.size
    if (currentPendingCount <= LOW_THRESHOLD) {
      expandTimeRange()
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

    return top.map(([eventId]) => eventId)
  }

  return {
    getNextChronological,
    hasInitialData,
  }
}
