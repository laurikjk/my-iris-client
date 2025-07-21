import {useEffect, useMemo, useRef, useState, useCallback} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {feedCache} from "@/utils/memcache"
import {useUserStore} from "@/stores/user"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"
import {eventComparator, createEventFilter, getEventsByUnknownUsers} from "./feedUtils"

interface UsePopularTabFeedProps {
  filters: NDKFilter
  cacheKey: string
  displayCount: number
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  hideEventsByUnknownUsers: boolean
  sortFn?: (a: NDKEvent, b: NDKEvent) => number
  enabled?: boolean
}

export default function usePopularTabFeed({
  filters,
  cacheKey,
  displayCount,
  displayFilterFn,
  fetchFilterFn,
  hideEventsByUnknownUsers,
  enabled = true,
}: UsePopularTabFeedProps) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const [localFilter, setLocalFilter] = useState(filters)
  const [newPosts, setNewPosts] = useState(new Map<string, NDKEvent>())
  const [newPostsFrom, setNewPostsFrom] = useState(new Set<string>())
  
  // Store reactions/likes
  const reactionsRef = useRef(
    feedCache.get(cacheKey) || new SortedMap([], eventComparator)
  )
  
  // Store actual posts
  const postsRef = useRef(new Map<string, NDKEvent>())
  
  // Track which post IDs we've already fetched
  const fetchedPostIds = useRef(new Set<string>())
  
  // Track like counts
  const likesByPostId = useRef(new Map<string, number>())
  
  const oldestRef = useRef<number | undefined>(undefined)
  const initialLoadDoneRef = useRef<boolean>(reactionsRef.current.size > 0)
  const [initialLoadDoneState, setInitialLoadDoneState] = useState(
    initialLoadDoneRef.current
  )
  const hasReceivedEventsRef = useRef<boolean>(reactionsRef.current.size > 0)
  const [eventsVersion, setEventsVersion] = useState(0)

  const showNewEvents = () => {
    newPosts.forEach((post) => {
      if (!postsRef.current.has(post.id)) {
        postsRef.current.set(post.id, post)
      }
    })
    setNewPosts(new Map())
    setNewPostsFrom(new Set())
    setEventsVersion((prev) => prev + 1)
  }

  const filterEvents = useCallback(
    createEventFilter(
      displayFilterFn,
      localFilter.authors,
      hideEventsByUnknownUsers,
      filters.authors
    ),
    [displayFilterFn, localFilter.authors, hideEventsByUnknownUsers, filters.authors]
  )

  const fetchPosts = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return

    // Mark these as fetched so we don't try again
    postIds.forEach(id => fetchedPostIds.current.add(id))

    const postFilter: NDKFilter = {
      ids: postIds,
      kinds: [1],
    }

    const sub = ndk().subscribe(postFilter)
    
    sub.on("event", (event) => {
      if (event?.id && event.created_at) {
        const isMyRecent =
          event.pubkey === myPubKey && event.created_at * 1000 > Date.now() - 10000
        const isNewPost = initialLoadDoneRef.current && !isMyRecent

        if (isNewPost) {
          setNewPosts((prev) => new Map([...prev, [event.id, event]]))
          setNewPostsFrom((prev) => new Set([...prev, event.pubkey]))
        } else {
          postsRef.current.set(event.id, event)
          setEventsVersion((prev) => prev + 1)
        }
      }
    })

    // Stop subscription after a timeout
    setTimeout(() => sub.stop(), 5000)
  }, [])

  // Calculate popular posts and fetch them if needed
  const filteredEvents = useMemo(() => {
    if (!enabled) return []
    
    // Recalculate likes for all posts
    likesByPostId.current.clear()
    
    Array.from(reactionsRef.current.values()).forEach((reaction) => {
      if (!reaction.tags) return
      const postId = reaction.tags.find((t) => t[0] === "e")?.[1]
      if (postId) {
        likesByPostId.current.set(postId, (likesByPostId.current.get(postId) || 0) + 1)
      }
    })

    // Sort by popularity
    const sortedPostIds = Array.from(likesByPostId.current.entries())
      .sort(([, likesA], [, likesB]) => likesB - likesA)
      .map(([postId]) => postId)

    // Get actual post events
    const events: NDKEvent[] = []
    const missingPostIds: string[] = []

    sortedPostIds.forEach((postId) => {
      const post = postsRef.current.get(postId)
      if (post && filterEvents(post)) {
        events.push(post)
      } else if (!fetchedPostIds.current.has(postId)) {
        missingPostIds.push(postId)
      }
    })

    // Fetch missing posts
    if (missingPostIds.length > 0) {
      fetchPosts(missingPostIds)
    }

    return events
  }, [eventsVersion, filterEvents, fetchPosts, enabled])

  const eventsByUnknownUsers = useMemo(() => {
    if (!enabled) return []
    return getEventsByUnknownUsers(
      new SortedMap(Array.from(postsRef.current.entries()), eventComparator),
      displayFilterFn,
      hideEventsByUnknownUsers,
      filters.authors
    )
  }, [eventsVersion, displayFilterFn, hideEventsByUnknownUsers, filters.authors, enabled])

  useEffect(() => {
    setLocalFilter(filters)
    oldestRef.current = undefined
  }, [filters])

  useEffect(() => {
    if (!enabled) return
    if (localFilter.authors && localFilter.authors.length === 0) {
      return
    }

    const sub = ndk().subscribe(localFilter)

    hasReceivedEventsRef.current = reactionsRef.current.size > 0
    initialLoadDoneRef.current = reactionsRef.current.size > 0
    setInitialLoadDoneState(reactionsRef.current.size > 0)

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
      if (reactionsRef.current.has(event.id)) return
      if (fetchFilterFn && !fetchFilterFn(event)) return

      // This is a reaction/like event - always add to main feed
      reactionsRef.current.set(event.id, event)
      
      oldestRef.current = Math.min(
        oldestRef.current ?? event.created_at,
        event.created_at
      )
      hasReceivedEventsRef.current = true
      
      // Trigger re-aggregation
      setEventsVersion((prev) => prev + 1)
      
      markLoadDoneIfHasEvents()
    })

    return () => {
      sub.stop()
      clearTimeout(initialLoadTimeout)
      markLoadDoneIfHasEvents.cancel()
    }
  }, [JSON.stringify(localFilter), enabled])

  useEffect(() => {
    reactionsRef.current.size &&
      !feedCache.has(cacheKey) &&
      feedCache.set(cacheKey, reactionsRef.current)
  }, [reactionsRef.current.size])

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
    events: reactionsRef,
    newEvents: newPosts,
    newEventsFrom: newPostsFrom,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems,
    initialLoadDone: initialLoadDoneState,
  }
}