import {useEffect, useRef, useState, useCallback} from "react"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import useFollows from "./useFollows"
import {useUserStore} from "@/stores/user"
import {seenEventIds} from "@/utils/memcache"
import {getEventReplyingTo} from "@/utils/nostr"
import {
  storeOldestTimestamp,
  getStoredOldestTimestamp,
} from "@/utils/timeRangePersistence"

const LOW_THRESHOLD = 15
const INITIAL_DATA_THRESHOLD = 5
const TIMESTAMP_DECREMENT = 24 * 60 * 60
const STORAGE_KEY = "ChronologicalFilterOldestTimestamp"

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
  const oldestEventAt = useRef<number | null>(null)
  const unfilteredEventsReceivedAfterFilterChange = useRef(0)
  const expansionsWithoutNewEvents = useRef(0)
  const [oldestTimestamp, setOldestTimestamp] = useState(
    filterSeen
      ? getStoredOldestTimestamp(STORAGE_KEY, 48)
      : Math.floor(Date.now() / 1000) - 48 * 60 * 60
  )
  const [hasInitialData, setHasInitialData] = useState(cache.hasInitialData || false)

  useEffect(() => {
    if (cache.pendingPosts && cache.pendingPosts.size > 0) {
      pendingPosts.current = cache.pendingPosts
      const timestamps = Array.from(pendingPosts.current.values())
      if (timestamps.length > 0) {
        oldestEventAt.current = Math.min(...timestamps)
      }
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
      since: oldestTimestamp,
      until: oldestEventAt.current || now,
      limit: 300,
    }

    unfilteredEventsReceivedAfterFilterChange.current = 0

    const sub = ndk().subscribe(chronologicalFilter)

    sub.on("event", (event) => {
      if (!event.created_at || !event.id) return
      if (filterSeen && seenEventIds.has(event.id)) return
      if (!showReplies && getEventReplyingTo(event)) {
        return
      }

      if (!showingPosts.current.has(event.id) && !pendingPosts.current.has(event.id)) {
        pendingPosts.current.set(event.id, event.created_at)

        if (oldestEventAt.current === null || event.created_at < oldestEventAt.current) {
          oldestEventAt.current = event.created_at
        }
      }

      if (!hasInitialData && pendingPosts.current.size >= INITIAL_DATA_THRESHOLD) {
        setHasInitialData(true)
        cache.hasInitialData = true
      }

      cache.pendingPosts = pendingPosts.current
      cache.showingPosts = showingPosts.current
    })

    const timeout = setTimeout(() => {
      if (pendingPosts.current.size <= LOW_THRESHOLD) {
        if (unfilteredEventsReceivedAfterFilterChange.current === 0) {
          expansionsWithoutNewEvents.current += 1
        }
        if (expansionsWithoutNewEvents.current >= 3) {
          expansionsWithoutNewEvents.current = 0
        } else {
          expandTimestamp()
        }
      }
    }, 5000)

    return () => {
      clearTimeout(timeout)
      sub.stop()
    }
  }, [follows, isSocialGraphLoaded, oldestTimestamp])

  const expandTimestamp = useCallback(() => {
    setOldestTimestamp((prev) => {
      const newOldestTimestamp = prev - TIMESTAMP_DECREMENT
      if (filterSeen) {
        storeOldestTimestamp(STORAGE_KEY, newOldestTimestamp)
      }
      return newOldestTimestamp
    })
  }, [filterSeen])

  const getNextChronological = (n: number): string[] => {
    const currentPendingCount = pendingPosts.current.size
    if (currentPendingCount <= LOW_THRESHOLD) {
      expandTimestamp()
    }

    const top = Array.from(pendingPosts.current.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)

    const oldestEvent = top[top.length - 1]
    if (oldestEvent && filterSeen) {
      const [, newOldestTimestamp] = oldestEvent
      storeOldestTimestamp(STORAGE_KEY, newOldestTimestamp)
    }

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
