import {getEventIdHex} from "@/shared/components/event/utils"
import {useState, useEffect, useCallback} from "react"
import {eventsByIdCache} from "@/utils/memcache"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {fetchEvent} from "@/utils/nostr"

interface UseFetchMissingEventsResult {
  fetchedEvents: Map<string, NDKEvent>
  loadingIds: Set<string>
  errorIds: Set<string>
  refetch: (ids: string[]) => void
}

export function useFetchMissingEvents(missingIds: string[]): UseFetchMissingEventsResult {
  const [fetchedEvents, setFetchedEvents] = useState<Map<string, NDKEvent>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())

  const fetchEventById = useCallback(async (eventId: string, retryCount = 0) => {
    const hexId = getEventIdHex(undefined, eventId)

    // Check cache first
    const cachedEvent = eventsByIdCache.get(hexId)
    if (cachedEvent) {
      setFetchedEvents((prev) => new Map(prev).set(eventId, cachedEvent))
      return cachedEvent
    }

    setLoadingIds((prev) => new Set(prev).add(eventId))
    setErrorIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })

    try {
      const event = await fetchEvent({ids: [hexId]})
      if (event) {
        // Cache the event
        eventsByIdCache.set(hexId, event)

        // Update state
        setFetchedEvents((prev) => new Map(prev).set(eventId, event))
        setLoadingIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(eventId)
          return newSet
        })

        return event
      }
    } catch (error) {
      console.warn(`Failed to fetch event ${eventId} (attempt ${retryCount + 1}):`, error)

      // Retry logic: exponential backoff with max 2 retries
      if (retryCount < 2) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        setTimeout(() => {
          fetchEventById(eventId, retryCount + 1)
        }, delay)
        return null
      }

      // Max retries reached, mark as error
      setErrorIds((prev) => new Set(prev).add(eventId))
    }

    setLoadingIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })

    return null
  }, [])

  const refetch = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => {
        setErrorIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        fetchEventById(id)
      })
    },
    [fetchEventById]
  )

  useEffect(() => {
    if (missingIds.length === 0) return

    const idsToFetch = missingIds.filter(
      (id) => !fetchedEvents.has(id) && !loadingIds.has(id) && !errorIds.has(id)
    )

    if (idsToFetch.length === 0) return

    // Progressive loading: prioritize first items for better UX
    const priorityIds = idsToFetch.slice(0, 6) // First 6 items (2 rows)
    const remainingIds = idsToFetch.slice(6)

    // Fetch priority items immediately in small batches to avoid overwhelming
    const priorityBatchSize = 3
    for (let i = 0; i < priorityIds.length; i += priorityBatchSize) {
      const batch = priorityIds.slice(i, i + priorityBatchSize)
      const delay = i * 50 // Small delay between priority batches

      setTimeout(() => {
        batch.forEach((id) => fetchEventById(id))
      }, delay)
    }

    // Batch fetch remaining items with progressive delay
    const batchSize = 5 // Smaller batch size for better network behavior
    for (let i = 0; i < remainingIds.length; i += batchSize) {
      const batch = remainingIds.slice(i, i + batchSize)
      const delay = Math.min(i * 100 + 500, 3000) // Progressive delay, max 3s

      setTimeout(() => {
        batch.forEach((id, index) => {
          // Stagger individual requests within batch
          setTimeout(() => fetchEventById(id), index * 20)
        })
      }, delay)
    }
  }, [missingIds, fetchedEvents, loadingIds, errorIds, fetchEventById])

  return {
    fetchedEvents,
    loadingIds,
    errorIds,
    refetch,
  }
}
