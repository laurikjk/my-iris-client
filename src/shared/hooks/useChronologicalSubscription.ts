import {useEffect, useRef, useState, useCallback} from "react"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import useFollows from "./useFollows"
import {useUserStore} from "@/stores/user"
import {seenEventIds} from "@/utils/memcache"
import {createTimestampStorage} from "@/utils/utils"
import {getEventReplyingTo} from "@/utils/nostr"

const LOW_THRESHOLD = 15
const INITIAL_DATA_THRESHOLD = 5
const INITIAL_TIME_RANGE = 48 * 60 * 60 // Start with 2 days instead of 1
const TIME_RANGE_INCREMENT = 24 * 60 * 60

interface ChronologicalSubscriptionCache {
  hasInitialData?: boolean
  pendingPosts?: Map<string, number>
  showingPosts?: Map<string, number>
}

export default function useChronologicalSubscription(
  cache: ChronologicalSubscriptionCache,
  filterSeen?: boolean,
  showReplies?: boolean
) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const follows = useFollows(myPubKey, true)
  const isSocialGraphLoaded = useSocialGraphLoaded()

  const showingPosts = useRef<Map<string, number>>(new Map())
  const pendingPosts = useRef<Map<string, number>>(new Map())
  const timeRangeStorage = createTimestampStorage(
    "chronological_subscription_time_range",
    INITIAL_TIME_RANGE
  )
  const [timeRange, setTimeRange] = useState(timeRangeStorage.get)
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)

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

      // Filter out replies if showReplies is false
      if (!showReplies && getEventReplyingTo(event)) {
        return
      }

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
      timeRangeStorage.set(newRange)
      return newRange
    })
  }, [timeRangeStorage])

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
