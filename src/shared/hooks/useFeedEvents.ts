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
  const [localFilter, setLocalFilter] = useState(filters)
  const [feed, setFeed] = useState(
    feedCache.get(cacheKey) ||
      new SortedMap(
        [],
        sortFn
          ? ([, a]: [string, NDKEvent], [, b]: [string, NDKEvent]) => sortFn(a, b)
          : eventComparator
      )
  )
  const newEventsRef = useRef(
    new SortedMap(
      [],
      sortFn
        ? ([, a]: [string, NDKEvent], [, b]: [string, NDKEvent]) => sortFn(a, b)
        : eventComparator
    )
  )
  const oldestRef = useRef<number | undefined>(undefined)
  const initialLoadDoneRef = useRef<boolean>(feed.size > 0)
  const [initialLoadDoneState, setInitialLoadDoneState] = useState(
    initialLoadDoneRef.current
  )
  const hasReceivedEventsRef = useRef<boolean>(feed.size > 0)

  const showNewEvents = () => {
    const newFeed = new SortedMap(
      [...feed.entries(), ...newEventsRef.current.entries()],
      feed.compareFn
    )
    setFeed(newFeed)
    newEventsRef.current.clear()
  }

  const filterEvents = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at) return false
      if (displayFilterFn && !displayFilterFn(event)) return false
      const inAuthors = localFilter.authors?.includes(event.pubkey)
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
    [displayFilterFn, myPubKey, hideEventsByUnknownUsers, filters.authors]
  )

  const filteredEvents = useMemo(() => {
    const events = Array.from(feed.values()).filter(filterEvents)

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
        const event = Array.from(feed.values()).find((e) => e.id === id)
        return event || {id}
      })
    }

    return events
  }, [feed.size, filterEvents, sortLikedPosts])

  const newEventsFiltered = useMemo(
    () => Array.from(newEventsRef.current.values()).filter(filterEvents),
    [newEventsRef.current.size, filterEvents]
  )

  const eventsByUnknownUsers = useMemo(() => {
    if (!hideEventsByUnknownUsers) {
      return []
    }
    return Array.from(feed.values()).filter(
      (event) =>
        (!displayFilterFn || displayFilterFn(event)) &&
        socialGraph().getFollowDistance(event.pubkey) >= 5 &&
        !(filters.authors && filters.authors.includes(event.pubkey)) &&
        // Only include events that aren't heavily muted
        !shouldHideAuthor(event.pubkey, undefined, true)
    )
  }, [feed.size, displayFilterFn, hideEventsByUnknownUsers, filters.authors])

  useEffect(() => {
    setLocalFilter(filters)
    oldestRef.current = undefined
  }, [filters])

  useEffect(() => {
    if (localFilter.authors && localFilter.authors.length === 0) {
      return
    }

    const sub = ndk().subscribe(localFilter)

    // Reset these flags when subscription changes
    hasReceivedEventsRef.current = feed.size > 0
    initialLoadDoneRef.current = feed.size > 0
    setInitialLoadDoneState(feed.size > 0)

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
      if (!event || !event.id) return
      if (event.created_at && !feed.has(event.id) && !newEventsRef.current.has(event.id)) {
        if (oldestRef.current === undefined || oldestRef.current > event.created_at) {
          oldestRef.current = event.created_at
        }
        if (fetchFilterFn && !fetchFilterFn(event)) {
          return
        }

        const isMyRecent =
          event.pubkey === myPubKey && event.created_at * 1000 > Date.now() - 10000

        // Mark that we've received at least one event
        hasReceivedEventsRef.current = true

        if (!initialLoadDoneRef.current || isMyRecent) {
          // Before initial load is done, add directly to main feed
          setFeed((prev) => {
            const newFeed = new SortedMap([...prev.entries()], prev.compareFn)
            newFeed.set(event.id, event)
            return newFeed
          })
          // Only mark initial load as done if we actually have events
          markLoadDoneIfHasEvents()
        } else {
          // After initial load is done, add to newEvents
          newEventsRef.current.set(event.id, event)
        }
      }
    })

    return () => {
      sub.stop()
      clearTimeout(initialLoadTimeout)
    }
  }, [JSON.stringify(localFilter)])

  useEffect(() => {
    feed.size &&
      !feedCache.has(cacheKey) &&
      feedCache.set(cacheKey, feed)
  }, [feed.size, cacheKey])

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

  const hasButton = newEventsRef.current.size > 0
  const newEventsFrom = new Set(Array.from(newEventsRef.current.values()).map(event => event.pubkey))

  return {
    feed,
    newEventsFiltered,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems,
    initialLoadDone: initialLoadDoneState,
    hasButton,
    newEventsFrom,
  }
}
