import {useState, useEffect, useRef, useCallback} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {addSeenEventId, seenEventIds} from "@/utils/memcache"
import shuffle from "lodash/shuffle"
import {useUserStore} from "@/stores/user"
import {getEventReplyingTo} from "@/utils/nostr"

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

interface CombinedPostFetcherProps {
  getNextPopular: (n: number) => string[]
  getNextChronological: (n: number) => string[]
  hasPopularData: boolean
  hasChronologicalData: boolean
  cache: CombinedPostFetcherCache
  popularRatio?: number
  refreshSignal?: number
}

export default function useCombinedPostFetcher({
  getNextPopular,
  getNextChronological,
  hasPopularData,
  hasChronologicalData,
  cache,
  popularRatio = 0.5,
  refreshSignal,
}: CombinedPostFetcherProps) {
  const [events, setEvents] = useState<NDKEvent[]>(cache.events || [])
  const [loading, setLoading] = useState<boolean>(false)
  const hasLoadedInitial = useRef(cache.hasLoadedInitial || false)
  const myPubKey = useUserStore((state) => state.publicKey)
  const lastRefreshSignal = useRef(refreshSignal)
  const isLoadingRef = useRef(false) // Track loading state in ref to prevent concurrent calls

  useEffect(() => {
    cache.events = events
  }, [events, cache])

  useEffect(() => {
    cache.hasLoadedInitial = hasLoadedInitial.current
  }, [cache])

  const loadBatch = useCallback(
    async (batchSize: number = 10) => {
      const popularCount = Math.floor(batchSize * popularRatio)
      const chronologicalCount = batchSize - popularCount

      console.log("loadBatch - requesting", popularCount, "popular and", chronologicalCount, "chronological")
      
      const popularIds = hasPopularData ? getNextPopular(popularCount) : []
      const chronologicalIds = hasChronologicalData
        ? getNextChronological(chronologicalCount)
        : []

      console.log("loadBatch - got", popularIds.length, "popular IDs and", chronologicalIds.length, "chronological IDs")

      let allIds = [...new Set([...popularIds, ...chronologicalIds])]

      // If we don't have enough events, try to get more from whichever source has data
      if (allIds.length < batchSize) {
        const remainingNeeded = batchSize - allIds.length
        if (hasPopularData && popularIds.length < remainingNeeded) {
          const extraPopular = getNextPopular(remainingNeeded)
          allIds = [...new Set([...allIds, ...extraPopular])]
        } else if (hasChronologicalData && chronologicalIds.length < remainingNeeded) {
          const extraChronological = getNextChronological(remainingNeeded)
          allIds = [...new Set([...allIds, ...extraChronological])]
        }
      }

      if (allIds.length === 0) {
        return []
      }

      const postFilter: NDKFilter = {
        ids: allIds,
      }

      const fetchedEvents = await ndk().fetchEvents(postFilter)
      const eventsArray = Array.from(fetchedEvents)

      // Filter out replies and own posts
      const filteredEvents = eventsArray.filter((event) => {
        // Filter out own posts
        if (event.pubkey === myPubKey) return false

        // Filter out replies using the existing utility function
        const replyingTo = getEventReplyingTo(event)
        if (replyingTo) return false

        return true
      })

      const shuffledEvents = shuffle(filteredEvents)

      return shuffledEvents
    },
    [
      getNextPopular,
      getNextChronological,
      hasPopularData,
      hasChronologicalData,
      popularRatio,
      myPubKey,
    ]
  )

  // Handle refresh signal - filter seen events and load more if needed
  useEffect(() => {
    if (
      !refreshSignal ||
      refreshSignal === 0 ||
      refreshSignal === lastRefreshSignal.current
    ) {
      return
    }

    lastRefreshSignal.current = refreshSignal

    // Filter out seen events from current state
    setEvents((currentEvents) => {
      const unseenEvents = currentEvents.filter((event) => !seenEventIds.has(event.id))

      // If we have too few events left after filtering, load more
      if (unseenEvents.length < 5 && (hasPopularData || hasChronologicalData)) {
        // Load more events to replace the filtered ones
        loadBatch(10).then((newEvents) => {
          if (newEvents.length > 0) {
            newEvents.forEach((event) => addSeenEventId(event.id))
            setEvents((prev) => {
              // Only deduplicate if there might be duplicates
              const existingIds = new Set(prev.map((e) => e.id))
              const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id))
              return uniqueNewEvents.length > 0 ? [...prev, ...uniqueNewEvents] : prev
            })
          }
        })
      }

      return unseenEvents
    })
  }, [refreshSignal, hasPopularData, hasChronologicalData, loadBatch])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const newEvents = await loadBatch(10)

    newEvents.forEach((event) => addSeenEventId(event.id))

    setEvents(newEvents)
    setLoading(false)
  }, [loadBatch])

  const loadMore = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoadingRef.current) {
      console.log("loadMore skipped - already loading")
      return
    }
    
    console.log("loadMore called in useCombinedPostFetcher")
    isLoadingRef.current = true
    setLoading(true)
    
    try {
      const newEvents = await loadBatch(10)
      console.log("loadMore fetched", newEvents.length, "new events")

      // If no new events, stop trying to load more for a bit
      if (newEvents.length === 0) {
        console.log("No new events available, stopping infinite scroll temporarily")
        // Keep loading state true for a moment to prevent immediate retrigger
        setTimeout(() => {
          isLoadingRef.current = false
          setLoading(false)
        }, 1000) // Wait 1 second before allowing another load attempt
        return
      }

      newEvents.forEach((event) => addSeenEventId(event.id))

      setEvents((prevEvents) => {
        // Only deduplicate if there might be duplicates
        const existingIds = new Set(prevEvents.map((e) => e.id))
        const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id))
        console.log("loadMore adding", uniqueNewEvents.length, "unique events, had", prevEvents.length, "total")
        return uniqueNewEvents.length > 0 ? [...prevEvents, ...uniqueNewEvents] : prevEvents
      })
      
      isLoadingRef.current = false
      setLoading(false)
    } catch (error) {
      console.error("Error loading more events:", error)
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [loadBatch])

  useEffect(() => {
    const hasAnyData = hasPopularData || hasChronologicalData
    if (hasAnyData && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true
      loadInitial()
    }
  }, [hasPopularData, hasChronologicalData, loadInitial])

  return {
    events,
    loading,
    loadMore,
  }
}
