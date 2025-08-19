import {useState, useEffect, useRef, useCallback} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {addSeenEventId} from "@/utils/memcache"
import shuffle from "lodash/shuffle"
import {useUserStore} from "@/stores/user"

interface CombinedPostFetcherCache {
  events?: NDKEvent[]
}

interface CombinedPostFetcherProps {
  getNextPopular: (n: number) => Promise<NDKEvent[]>
  getNextChronological: (n: number) => Promise<NDKEvent[]>
  cache: CombinedPostFetcherCache
  popularRatio?: number
}

export default function useCombinedPostFetcher({
  getNextPopular,
  getNextChronological,
  cache,
  popularRatio = 0.5,
}: CombinedPostFetcherProps) {
  const [events, setEvents] = useState<NDKEvent[]>(cache.events || [])
  const [loading, setLoading] = useState<boolean>(false)
  const myPubKey = useUserStore((state) => state.publicKey)
  const isLoadingRef = useRef(false)

  useEffect(() => {
    cache.events = events
  }, [events, cache])

  const loadBatch = useCallback(
    async (batchSize: number = 10) => {
      const popularCount = Math.floor(batchSize * popularRatio)
      const chronologicalCount = batchSize - popularCount

      const [popularEvents, chronologicalEvents] = await Promise.all([
        getNextPopular(popularCount),
        getNextChronological(chronologicalCount),
      ])

      // Combine and deduplicate events
      const eventMap = new Map<string, NDKEvent>()
      popularEvents.forEach((e) => eventMap.set(e.id, e))
      chronologicalEvents.forEach((e) => eventMap.set(e.id, e))

      const combinedEvents = Array.from(eventMap.values())
      const shuffledEvents = shuffle(combinedEvents)

      return shuffledEvents
    },
    [getNextPopular, getNextChronological, popularRatio, myPubKey]
  )

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || loading) {
      return
    }
    isLoadingRef.current = true
    setLoading(true)

    try {
      const newEvents = await loadBatch(10)

      newEvents.forEach((event) => addSeenEventId(event.id))

      setEvents((prevEvents) => {
        return [...prevEvents, ...newEvents]
      })

      isLoadingRef.current = false
      setLoading(false)
    } catch (error) {
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [loadBatch])

  return {
    events,
    loading,
    loadMore,
  }
}
