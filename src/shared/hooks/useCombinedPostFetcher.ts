import {useState, useEffect, useRef, useCallback} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {addSeenEventId} from "@/utils/memcache"
import shuffle from "lodash/shuffle"
import {useUserStore} from "@/stores/user"

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
}

export default function useCombinedPostFetcher({
  getNextPopular,
  getNextChronological,
  hasPopularData,
  hasChronologicalData,
  cache,
  popularRatio = 0.5,
}: CombinedPostFetcherProps) {
  const [events, setEvents] = useState<NDKEvent[]>(cache.events || [])
  const [loading, setLoading] = useState<boolean>(false)
  const hasLoadedInitial = useRef(cache.hasLoadedInitial || false)
  const myPubKey = useUserStore((state) => state.publicKey)
  const isLoadingRef = useRef(false)

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

      const popularIds = hasPopularData ? getNextPopular(popularCount) : []
      const chronologicalIds = hasChronologicalData
        ? getNextChronological(chronologicalCount)
        : []

      let allIds = [...new Set([...popularIds, ...chronologicalIds])]

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

      const shuffledEvents = shuffle(eventsArray)

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

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const newEvents = await loadBatch(10)

    newEvents.forEach((event) => addSeenEventId(event.id))

    setEvents(newEvents)
    hasLoadedInitial.current = true
    setLoading(false)
  }, [loadBatch])

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) {
      return
    }

    isLoadingRef.current = true
    setLoading(true)

    try {
      const newEvents = await loadBatch(10)

      if (newEvents.length === 0) {
        setTimeout(() => {
          isLoadingRef.current = false
          setLoading(false)
        }, 1000)
        return
      }

      newEvents.forEach((event) => addSeenEventId(event.id))

      setEvents((prevEvents) => {
        const existingIds = new Set(prevEvents.map((e) => e.id))
        const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id))
        return uniqueNewEvents.length > 0
          ? [...prevEvents, ...uniqueNewEvents]
          : prevEvents
      })

      isLoadingRef.current = false
      setLoading(false)
    } catch (error) {
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [loadBatch])

  useEffect(() => {
    const hasAnyData = hasPopularData || hasChronologicalData
    if (hasAnyData && !hasLoadedInitial.current) {
      loadInitial()
    }
  }, [hasPopularData, hasChronologicalData, loadInitial])

  const isInitializing =
    !hasLoadedInitial.current && (hasPopularData || hasChronologicalData)
  const waitingForDataSources =
    !hasLoadedInitial.current && !hasPopularData && !hasChronologicalData

  return {
    events,
    loading: loading || isInitializing || waitingForDataSources,
    loadMore,
  }
}
