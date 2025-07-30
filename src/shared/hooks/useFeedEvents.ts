import {useEffect, useMemo, useRef, useState, useCallback} from "react"
import {eventComparator} from "../components/feed/utils"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldHideAuthor} from "@/utils/visibility"
import socialGraph from "@/utils/socialGraph"
import {feedCache} from "@/utils/memcache"
import {useUserStore} from "@/stores/user"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"

interface FutureEvent {
  event: NDKEvent
  timer: NodeJS.Timeout
}

interface UseFeedEventsProps {
  filters: NDKFilter
  cacheKey: string
  displayCount: number
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  hideEventsByUnknownUsers: boolean
  sortLikedPosts?: boolean
  sortFn?: (a: NDKEvent, b: NDKEvent) => number
  relayUrls?: string[]
}

export default function useFeedEvents({
  filters,
  cacheKey,
  displayCount,
  displayFilterFn,
  fetchFilterFn,
  hideEventsByUnknownUsers,
  sortLikedPosts = false,
  sortFn,
  relayUrls,
}: UseFeedEventsProps) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const [localFilter, setLocalFilter] = useState(filters)
  const [newEventsFrom, setNewEventsFrom] = useState(new Set<string>())
  const [newEvents, setNewEvents] = useState(new Map<string, NDKEvent>())
  const eventsRef = useRef(
    feedCache.get(cacheKey) ||
      new SortedMap(
        [],
        sortFn
          ? ([, a]: [string, NDKEvent], [, b]: [string, NDKEvent]) => sortFn(a, b)
          : eventComparator
      )
  )
  // Buffer for future events (max 20 entries, sorted by timestamp)
  const futureEventsRef = useRef(
    new SortedMap<string, FutureEvent>(
      [],
      ([, a]: [string, FutureEvent], [, b]: [string, FutureEvent]) => {
        return (a.event.created_at || 0) - (b.event.created_at || 0) // Sort by timestamp ascending
      }
    )
  )
  const oldestRef = useRef<number | undefined>(undefined)
  const initialLoadDoneRef = useRef<boolean>(eventsRef.current.size > 0)
  const [initialLoadDoneState, setInitialLoadDoneState] = useState(
    initialLoadDoneRef.current
  )
  const hasReceivedEventsRef = useRef<boolean>(eventsRef.current.size > 0)
  const [eventsVersion, setEventsVersion] = useState(0) // Version counter for filtered events

  // Apply a single future event when its time comes
  const applyFutureEvent = useCallback((eventId: string) => {
    const futureEvent = futureEventsRef.current.get(eventId)
    if (futureEvent) {
      const {event} = futureEvent
      futureEventsRef.current.delete(eventId)

      if (!eventsRef.current.has(eventId)) {
        setNewEvents((prev) => new Map([...prev, [eventId, event]]))
        setNewEventsFrom((prev) => new Set([...prev, event.pubkey]))
      }
    }
  }, [])

  // Add future event to buffer with individual timer
  const addFutureEvent = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at) return

      const now = Math.floor(Date.now() / 1000)
      const delay = (event.created_at - now) * 1000 // Convert to milliseconds

      // Clear existing future event if any (this will cancel its timer)
      const existingFutureEvent = futureEventsRef.current.get(event.id)
      if (existingFutureEvent) {
        clearTimeout(existingFutureEvent.timer)
        futureEventsRef.current.delete(event.id)
      }

      // Set timer for this specific event
      const timer = setTimeout(() => {
        applyFutureEvent(event.id)
      }, delay)

      // Add to buffer
      futureEventsRef.current.set(event.id, {event, timer})

      // Keep only the 20 most recent future events (evict oldest)
      while (futureEventsRef.current.size > 20) {
        const firstEntry = futureEventsRef.current.entries().next().value
        if (firstEntry) {
          const [oldId, oldFutureEvent] = firstEntry
          clearTimeout(oldFutureEvent.timer) // Cancel timer on evict
          futureEventsRef.current.delete(oldId)
        }
      }
    },
    [applyFutureEvent]
  )

  const showNewEvents = () => {
    newEvents.forEach((event) => {
      if (!eventsRef.current.has(event.id)) {
        eventsRef.current.set(event.id, event)
      }
    })
    setNewEvents(new Map())
    setNewEventsFrom(new Set())
    setEventsVersion((prev) => prev + 1)
  }

  const filterEvents = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at) return false
      if (displayFilterFn && !displayFilterFn(event)) return false

      // Client-side search validation for relays that don't support search filters
      if (localFilter.search && event.content) {
        const searchTerm = localFilter.search.toLowerCase()
        const eventContent = event.content.toLowerCase()
        if (!eventContent.includes(searchTerm)) {
          return false
        }
      }

      const inAuthors = localFilter.authors?.includes(event.pubkey)
      // Pass `allowUnknown` based on the `hideEventsByUnknownUsers` flag so that
      // disabling the flag actually shows posts from users outside the follow graph.
      if (!inAuthors && shouldHideAuthor(event.pubkey, 3, !hideEventsByUnknownUsers)) {
        return false
      }
      if (
        hideEventsByUnknownUsers &&
        socialGraph().getFollowDistance(event.pubkey) >= 5 &&
        !(filters.authors && filters.authors.includes(event.pubkey))
      ) {
        return false
      }
      return true
    },
    [
      displayFilterFn,
      localFilter.authors,
      localFilter.search,
      hideEventsByUnknownUsers,
      filters.authors,
    ]
  )

  const filteredEvents = useMemo(() => {
    const events = Array.from(eventsRef.current.values()).filter(filterEvents)

    if (sortLikedPosts) {
      const likesByPostId = new Map<string, number>()
      events.forEach((event) => {
        const postId = event.tags.find((t) => t[0] === "e")?.[1]
        if (postId) {
          likesByPostId.set(postId, (likesByPostId.get(postId) || 0) + 1)
        }
      })

      const sortedIds = Array.from(likesByPostId.entries())
        .sort(([, likesA], [, likesB]) => likesB - likesA)
        .map(([postId]) => postId)

      return sortedIds.map((id) => {
        const event = Array.from(eventsRef.current.values()).find((e) => e.id === id)
        return event || {id}
      })
    }

    return events
  }, [eventsVersion, filterEvents, sortLikedPosts])

  const eventsByUnknownUsers = useMemo(() => {
    if (!hideEventsByUnknownUsers) {
      return []
    }
    return Array.from(eventsRef.current.values()).filter(
      (event) =>
        (!displayFilterFn || displayFilterFn(event)) &&
        socialGraph().getFollowDistance(event.pubkey) >= 5 &&
        !(filters.authors && filters.authors.includes(event.pubkey)) &&
        // Only include events that aren't heavily muted
        !shouldHideAuthor(event.pubkey, undefined, true)
    )
  }, [eventsVersion, displayFilterFn, hideEventsByUnknownUsers, filters.authors])

  useEffect(() => {
    setLocalFilter(filters)
    oldestRef.current = undefined
  }, [filters])

  useEffect(() => {
    if (localFilter.authors && localFilter.authors.length === 0) {
      return
    }

    const sub = ndk().subscribe(localFilter, relayUrls ? {relayUrls} : undefined)

    // Reset these flags when subscription changes
    hasReceivedEventsRef.current = eventsRef.current.size > 0
    initialLoadDoneRef.current = eventsRef.current.size > 0
    setInitialLoadDoneState(eventsRef.current.size > 0)

    // Set up a timeout to mark initial load as done even if no events arrive
    const initialLoadTimeout = setTimeout(() => {
      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true
        setInitialLoadDoneState(true)
      }
    }, 5000)

    const markLoadDoneIfHasEvents = debounce(() => {
      if (hasReceivedEventsRef.current && !initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true
        setInitialLoadDoneState(true)
      }
    }, 500)

    sub.on("event", (event) => {
      if (!event?.id || !event.created_at) return
      if (eventsRef.current.has(event.id)) return
      if (fetchFilterFn && !fetchFilterFn(event)) return

      const now = Math.floor(Date.now() / 1000)
      const isFutureEvent = event.created_at > now

      // Handle future events separately
      if (isFutureEvent) {
        addFutureEvent(event)
        return
      }

      oldestRef.current = Math.min(
        oldestRef.current ?? event.created_at,
        event.created_at
      )
      hasReceivedEventsRef.current = true

      const addMain = () => {
        eventsRef.current.set(event.id, event)
        setEventsVersion((prev) => prev + 1)
      }
      const addNew = () => {
        setNewEvents((prev) => new Map([...prev, [event.id, event]]))
        setNewEventsFrom((prev) => new Set([...prev, event.pubkey]))
      }

      const isMyRecent =
        event.pubkey === myPubKey && event.created_at * 1000 > Date.now() - 10000
      const isNewEvent =
        initialLoadDoneRef.current && !isMyRecent && (!sortLikedPosts || event.kind === 1)

      if (isNewEvent) addNew()
      else addMain()

      markLoadDoneIfHasEvents()
    })
    return () => {
      sub.stop()
      clearTimeout(initialLoadTimeout)
      markLoadDoneIfHasEvents.cancel()
    }
  }, [JSON.stringify(localFilter), addFutureEvent])

  // Cleanup future event timers on unmount
  useEffect(() => {
    return () => {
      // Clear all future event timers
      for (const [, futureEvent] of futureEventsRef.current.entries()) {
        clearTimeout(futureEvent.timer)
      }
      futureEventsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    eventsRef.current.size &&
      !feedCache.has(cacheKey) &&
      feedCache.set(cacheKey, eventsRef.current)
  }, [eventsRef.current.size])

  const loadMoreItems = () => {
    if (filteredEvents.length > displayCount) {
      return true
    } else if (localFilter.until !== oldestRef.current) {
      setLocalFilter((prev) => ({
        ...prev,
        until: oldestRef.current,
      }))
    }
    return false
  }

  return {
    events: eventsRef,
    newEvents,
    newEventsFrom,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems,
    initialLoadDone: initialLoadDoneState,
  }
}
