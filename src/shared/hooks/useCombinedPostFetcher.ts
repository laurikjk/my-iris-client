import {useState, useEffect, useRef} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT} from "@/utils/constants"
import {addSeenEventId} from "@/utils/memcache"
import shuffle from "lodash/shuffle"

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

  useEffect(() => {
    cache.events = events
  }, [events])

  useEffect(() => {
    cache.hasLoadedInitial = hasLoadedInitial.current
  }, [hasLoadedInitial.current])

  const loadBatch = async (batchSize: number = 10) => {
    const popularCount = Math.floor(batchSize * popularRatio)
    const chronologicalCount = batchSize - popularCount

    const popularIds = hasPopularData ? getNextPopular(popularCount) : []
    const chronologicalIds = hasChronologicalData
      ? getNextChronological(chronologicalCount)
      : []

    const allIds = [...new Set([...popularIds, ...chronologicalIds])]

    if (allIds.length === 0) {
      return []
    }

    const postFilter: NDKFilter = {
      kinds: [KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT],
      ids: allIds,
    }

    const fetchedEvents = await ndk().fetchEvents(postFilter)
    const eventsArray = Array.from(fetchedEvents)

    const shuffledEvents = shuffle(eventsArray)

    return shuffledEvents
  }

  const loadInitial = async () => {
    setLoading(true)
    const newEvents = await loadBatch(10)

    newEvents.forEach((event) => addSeenEventId(event.id))

    setEvents(newEvents)
    setLoading(false)
  }

  const loadMore = async () => {
    setLoading(true)
    const newEvents = await loadBatch(10)

    newEvents.forEach((event) => addSeenEventId(event.id))

    setEvents((prevEvents) => [...prevEvents, ...newEvents])
    setLoading(false)
  }

  useEffect(() => {
    const hasAnyData = hasPopularData || hasChronologicalData
    if (hasAnyData && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true
      loadInitial()
    }
  }, [hasPopularData, hasChronologicalData])

  return {
    events,
    loading,
    loadMore,
  }
}
