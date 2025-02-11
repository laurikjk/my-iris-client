import socialGraph, {shouldHideEvent, shouldSocialHide} from "@/utils/socialGraph"
import {useEffect, useMemo, useRef, useState, useCallback} from "react"
import {eventComparator} from "../components/feed/utils"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {feedCache} from "@/utils/memcache"
import debounce from "lodash/debounce"
import {localState} from "irisdb"
import {ndk} from "irisdb-nostr"

// TODO fix useLocalState so initial state is properly set from memory
let myPubKey = ""
localState.get("user/publicKey").on((k) => (myPubKey = k as string))

interface UseFeedEventsProps {
  filters: NDKFilter
  cacheKey: string
  displayCount: number
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  hideEventsByUnknownUsers: boolean
  hidePostsByMutedMoreThanFollowed: boolean
  mutes: string[]
  sortLikedPosts?: boolean
}

export default function useFeedEvents({
  filters,
  cacheKey,
  displayCount,
  displayFilterFn,
  fetchFilterFn,
  hideEventsByUnknownUsers,
  hidePostsByMutedMoreThanFollowed,
  mutes,
  sortLikedPosts = false,
}: UseFeedEventsProps) {
  const [localFilter, setLocalFilter] = useState(filters)
  const [newEventsFrom, setNewEventsFrom] = useState(new Set<string>())
  const [newEvents, setNewEvents] = useState(new Map<string, NDKEvent>())
  const eventsRef = useRef(feedCache.get(cacheKey) || new SortedMap([], eventComparator))
  const oldestRef = useRef<number | undefined>()
  const initialLoadDone = useRef<boolean>(eventsRef.current.size > 0)

  const showNewEvents = () => {
    newEvents.forEach((event) => {
      if (!eventsRef.current.has(event.id)) {
        eventsRef.current.set(event.id, event)
      }
    })
    setNewEvents(new Map())
    setNewEventsFrom(new Set())
  }

  const filterEvents = useCallback(
    (event: NDKEvent) => {
      if (!event.created_at) return false
      if (displayFilterFn && !displayFilterFn(event)) return false
      const inAuthors = localFilter.authors?.includes(event.pubkey)
      if (!inAuthors && mutes.includes(event.pubkey)) return false
      if (
        !inAuthors &&
        hidePostsByMutedMoreThanFollowed &&
        shouldSocialHide(event.pubkey, 3)
      ) {
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
      myPubKey,
      hideEventsByUnknownUsers,
      filters.authors,
      mutes,
      hidePostsByMutedMoreThanFollowed,
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
  }, [eventsRef.current.size, filterEvents, sortLikedPosts])

  const eventsByUnknownUsers = useMemo(() => {
    if (!hideEventsByUnknownUsers) {
      return []
    }
    return Array.from(eventsRef.current.values()).filter(shouldHideEvent)
  }, [eventsRef.current.size])

  useEffect(() => {
    setLocalFilter(filters)
    oldestRef.current = undefined
  }, [filters])

  useEffect(() => {
    if (localFilter.authors && localFilter.authors.length === 0) {
      return
    }

    const sub = ndk().subscribe(localFilter)

    const debouncedInitialLoadDone = debounce(
      () => {
        initialLoadDone.current = true
      },
      500,
      {maxWait: 2000}
    )

    debouncedInitialLoadDone()

    sub.on("event", (event) => {
      if (event && event.created_at && !eventsRef.current.has(event.id)) {
        if (oldestRef.current === undefined || oldestRef.current > event.created_at) {
          oldestRef.current = event.created_at
        }
        if (fetchFilterFn && !fetchFilterFn(event)) {
          return
        }
        const lastShownIndex = Math.min(displayCount, eventsRef.current.size) - 1
        const oldestShownTime =
          lastShownIndex >= 0 && eventsRef.current.nth(lastShownIndex)?.[1].created_at
        const isMyRecent =
          event.pubkey === myPubKey && event.created_at * 1000 > Date.now() - 10000
        if (
          !isMyRecent &&
          initialLoadDone.current &&
          (!oldestShownTime || event.created_at > oldestShownTime)
        ) {
          setNewEvents((prev) => new Map([...prev, [event.id, event]]))
          setNewEventsFrom((prev) => new Set([...prev, event.pubkey]))
        } else {
          eventsRef.current.set(event.id, event)
          if (!initialLoadDone.current) {
            debouncedInitialLoadDone()
          }
        }
      }
    })

    return () => {
      sub.stop()
    }
  }, [JSON.stringify(localFilter)])

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
    initialLoadDone: initialLoadDone.current,
  }
}
