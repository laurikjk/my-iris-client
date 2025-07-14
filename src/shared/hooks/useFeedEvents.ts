import {useEffect, useState, useRef, useCallback, useReducer, useMemo} from "react"
import {eventComparator} from "../components/feed/utils"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldHideAuthor} from "@/utils/visibility"
import socialGraph from "@/utils/socialGraph"
import {feedCache} from "@/utils/memcache"
import {useUserStore} from "@/stores/user"
import {ndk} from "@/utils/ndk"

interface UseFeedEventsProps {
  filters: NDKFilter
  cacheKey: string
  displayCount: number
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  hideEventsByUnknownUsers: boolean
  sortLikedPosts?: boolean
  sortFn?: (a: NDKEvent, b: NDKEvent) => number
}

type FeedEventBuffers = {
  feed: SortedMap<string, NDKEvent>
  pending: Map<string, NDKEvent>
}

export default function useFeedEvents({
  filters,
  cacheKey,
  displayCount,
  displayFilterFn,
  fetchFilterFn,
  sortFn,
  hideEventsByUnknownUsers,
  sortLikedPosts = false,
}: UseFeedEventsProps) {
  const myPubKey = useUserStore((state) => state.publicKey)

  const feedEventBuffersRef = useRef<FeedEventBuffers>({
    feed:
      feedCache.get(cacheKey) ||
      new SortedMap(
        [],
        sortFn
          ? ([, a]: [string, NDKEvent], [, b]: [string, NDKEvent]) => sortFn(a, b)
          : eventComparator
      ),
    pending: new Map(),
  })
  const [, forceUpdate] = useReducer((x) => x + 1, 0)
  const [newEventsFrom, setNewEventsFrom] = useState(new Set<string>())
  const [paginationUntil, setPaginationUntil] = useState<number | undefined>(undefined)
  const [initialLoadDone, setInitialLoadDone] = useState(
    feedEventBuffersRef.current.feed.size > 0
  )

  const newestTimestamp = useRef<number | undefined>(
    feedEventBuffersRef.current.feed.size > 0
      ? Math.max(
          ...Array.from(feedEventBuffersRef.current.feed.values()).map(
            (e) => e.created_at || 0
          )
        )
      : undefined
  )
  const oldestTimestamp = useRef<number | undefined>(undefined)

  const filterEvents = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at) return false
      if (displayFilterFn && !displayFilterFn(event)) return false
      const inAuthors = filters.authors?.includes(event.pubkey)
      if (!inAuthors && shouldHideAuthor(event.pubkey, 3)) {
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
    [displayFilterFn, hideEventsByUnknownUsers, filters.authors]
  )

  const routeEventToBuffer = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at || feedEventBuffersRef.current.feed.has(event.id)) return

      if (fetchFilterFn && !fetchFilterFn(event)) {
        return
      }

      const isMyRecentEvent =
        event.pubkey === myPubKey && event.created_at * 1000 > Date.now() - 10000

      if ((!initialLoadDone || isMyRecentEvent) && filterEvents(event)) {
        feedEventBuffersRef.current.feed.set(event.id, event)
      } else {
        const eventTimestamp = event.created_at
        const oldestFeedTimestamp = Array.from(
          feedEventBuffersRef.current.feed.values()
        ).reduce(
          (minTimestamp, e) => Math.min(minTimestamp, e.created_at || Infinity),
          Infinity
        )

        if (sortLikedPosts) {
          // For like-sorted feeds, add all events directly to main feed (no banner)
          if (filterEvents(event)) {
            feedEventBuffersRef.current.feed.set(event.id, event)
          }
        } else {
          if (eventTimestamp > oldestFeedTimestamp) {
            if (filterEvents(event)) {
              feedEventBuffersRef.current.pending.set(event.id, event)
              setNewEventsFrom((prev) => new Set([...prev, event.pubkey]))
            }
          } else {
            if (filterEvents(event)) {
              feedEventBuffersRef.current.feed.set(event.id, event)
            }
          }
        }
      }

      if (
        oldestTimestamp.current === undefined ||
        oldestTimestamp.current > event.created_at
      ) {
        oldestTimestamp.current = event.created_at
      }
      if (
        newestTimestamp.current === undefined ||
        newestTimestamp.current < event.created_at
      ) {
        newestTimestamp.current = event.created_at
      }

      forceUpdate()
    },
    [filterEvents, fetchFilterFn, initialLoadDone, myPubKey]
  )

  const filteredEvents = useMemo(() => {
    const events = Array.from(feedEventBuffersRef.current.feed.values()).filter(filterEvents)

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
        return Array.from(feedEventBuffersRef.current.feed.values()).find((e) => e.id === id)
      }).filter((event): event is NDKEvent => event !== undefined)
    }

    return events
  }, [feedEventBuffersRef.current.feed.size, filterEvents, sortLikedPosts])

  const eventsByUnknownUsers = Array.from(
    feedEventBuffersRef.current.feed.values()
  ).filter(
    (event) =>
      (!displayFilterFn || displayFilterFn(event)) &&
      socialGraph().getFollowDistance(event.pubkey) >= 5 &&
      !(filters.authors && filters.authors.includes(event.pubkey)) &&
      !shouldHideAuthor(event.pubkey, undefined, true)
  )

  useEffect(() => {
    oldestTimestamp.current = undefined
    newestTimestamp.current = undefined
    setPaginationUntil(undefined)
    feedEventBuffersRef.current.pending.clear()
    setNewEventsFrom(new Set())
  }, [filters])

  useEffect(() => {
    if (filters.authors && filters.authors.length === 0) {
      return
    }

    const currentFilter = paginationUntil ? {...filters, until: paginationUntil} : filters
    const sub = ndk().subscribe(currentFilter)

    setInitialLoadDone(feedEventBuffersRef.current.feed.size > 0)

    // Set up a timeout to mark initial load as done even if no events arrive
    const initialLoadTimeout = setTimeout(() => {
      setInitialLoadDone(true)
    }, 5000)

    sub.on("eose", () => {
      setInitialLoadDone(true)
      clearTimeout(initialLoadTimeout)
    })

    sub.on("event", routeEventToBuffer)

    return () => {
      sub.stop()
      clearTimeout(initialLoadTimeout)
    }
  }, [JSON.stringify(filters), paginationUntil, routeEventToBuffer])

  useEffect(() => {
    feedEventBuffersRef.current.feed.size &&
      !feedCache.has(cacheKey) &&
      feedCache.set(cacheKey, feedEventBuffersRef.current.feed)
  }, [feedEventBuffersRef.current.feed.size, cacheKey])

  const showNewEvents = () => {
    feedEventBuffersRef.current.pending.forEach((event) => {
      if (!feedEventBuffersRef.current.feed.has(event.id)) {
        feedEventBuffersRef.current.feed.set(event.id, event)
      }
    })

    feedEventBuffersRef.current.pending.clear()
    setNewEventsFrom(new Set())
    forceUpdate()
  }

  const loadMoreItems = () => {
    if (filteredEvents.length > displayCount) {
      return true
    } else if (paginationUntil !== oldestTimestamp.current) {
      setPaginationUntil(oldestTimestamp.current)
    }
    return false
  }

  const eventsRef = useRef(feedEventBuffersRef.current.feed)
  eventsRef.current = feedEventBuffersRef.current.feed

  return {
    events: eventsRef,
    newEvents: feedEventBuffersRef.current.pending,
    newEventsFrom,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems,
    initialLoadDone,
  }
}
