import {useState, useEffect, useRef} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_TEXT_NOTE} from "@/utils/constants"

interface PostFetcherCache {
  events?: NDKEvent[]
  hasLoadedInitial?: boolean
}

export default function usePostFetcher(
  nextMostPopular: (n: number) => string[],
  hasInitialData: boolean,
  cache: PostFetcherCache
) {
  const [events, setEvents] = useState<NDKEvent[]>(cache.events || [])
  const [loading, setLoading] = useState<boolean>(false)
  const hasLoadedInitial = useRef(cache.hasLoadedInitial || false)

  // Update cache when events change
  useEffect(() => {
    cache.events = events
  }, [events])

  // Update cache when hasLoadedInitial changes
  useEffect(() => {
    cache.hasLoadedInitial = hasLoadedInitial.current
  }, [hasLoadedInitial.current])

  const loadInitial = async () => {
    setLoading(true)
    const nextMostPopularEventIds = nextMostPopular(10)
    if (nextMostPopularEventIds.length === 0) {
      setLoading(false)
      return
    }
    const postFilter: NDKFilter = {
      kinds: [KIND_TEXT_NOTE],
      ids: nextMostPopularEventIds,
    }
    const fetchedEvents = await ndk().fetchEvents(postFilter)
    setEvents(Array.from(fetchedEvents))
    setLoading(false)
  }

  const loadMore = async () => {
    setLoading(true)
    const nextMostPopularEventIds = nextMostPopular(10)
    const postFilter: NDKFilter = {
      kinds: [KIND_TEXT_NOTE],
      ids: nextMostPopularEventIds,
    }
    const fetchedEvents = await ndk().fetchEvents(postFilter)
    setEvents((prevEvents) => [...prevEvents, ...Array.from(fetchedEvents)])
    setLoading(false)
  }

  useEffect(() => {
    if (hasInitialData && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true
      loadInitial()
    }
  }, [hasInitialData])

  return {
    events,
    loading,
    loadMore,
  }
}
