import InfiniteScroll from "@/shared/components/ui/InfiniteScroll.tsx"
import socialGraph, {
  socialGraphLoaded,
  DEFAULT_SOCIAL_GRAPH_ROOT,
} from "@/utils/socialGraph"
import {useCallback, useState, useMemo, useEffect} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import EventBorderless from "../event/EventBorderless"
import FeedItem from "../event/FeedItem/FeedItem"

import useFeedEvents from "@/shared/hooks/useFeedEvents"
import useFollows from "@/shared/hooks/useFollows"
import {useUserStore} from "@/stores/user"
import classNames from "classnames"

export default function Popular({
  small = true,
  randomSort = true,
}: {
  small?: boolean
  randomSort?: boolean
}) {
  const [isSocialGraphLoaded, setIsSocialGraphLoaded] = useState(false)
  const [displayCount, setDisplayCount] = useState(10)
  const myPubKey = useUserStore((state) => state.publicKey)
  const myFollows = useFollows(myPubKey, false)

  // Determine if we should use fallback to DEFAULT_SOCIAL_GRAPH_ROOT
  const shouldUseFallback = myFollows.length === 0

  // Get authors for the query - either from user's follows or DEFAULT_SOCIAL_GRAPH_ROOT's follows
  const authors = useMemo(() => {
    if (shouldUseFallback) {
      // Use follows of DEFAULT_SOCIAL_GRAPH_ROOT
      const follows = Array.from(
        socialGraph().getFollowedByUser(DEFAULT_SOCIAL_GRAPH_ROOT)
      )
      console.log(
        "Popular: using DEFAULT_SOCIAL_GRAPH_ROOT follows",
        follows.length,
        follows.slice(0, 5)
      )
      return follows
    }
    console.log("Popular: using user follows", myFollows.length, myFollows.slice(0, 5))
    return myFollows
  }, [shouldUseFallback, myFollows])

  // Create filters for popular feed - fetch likes/reactions from last 24 hours
  const filters = useMemo(() => {
    const f = {
      kinds: [6, 7], // Like and reaction events only
      since: Math.floor(Date.now() / 1000 - 60 * 60 * 24), // Last 24 hours
      authors: authors.length > 0 ? authors : undefined, // Only add authors if we have any
      limit: 300,
    }
    console.log("Popular: filters", f)
    return f
  }, [authors])

  // Social graph filter - only show posts from users within distance 2 (unless using fallback)
  const displayFilterFn = useCallback(
    (e: NDKEvent) => {
      if (shouldUseFallback) {
        // Don't filter by follow distance when using fallback
        return true
      }
      return socialGraph().getFollowDistance(e.pubkey) <= 2
    },
    [shouldUseFallback]
  )

  const {filteredEvents: rawFilteredEvents, initialLoadDone} = useFeedEvents({
    filters,
    cacheKey: "popularFeed",
    displayCount: displayCount * 2, // Fetch more to account for filtering
    displayFilterFn,
    fetchFilterFn: undefined,
    hideEventsByUnknownUsers: false,
    sortLikedPosts: false, // We'll handle the sorting ourselves
  })

  // Custom sorting logic that preserves reaction counts
  const filteredEvents = useMemo(() => {
    console.log(
      "Popular: rawFilteredEvents",
      rawFilteredEvents?.length,
      rawFilteredEvents
    )
    if (!rawFilteredEvents) return []

    const likesByPostId = new Map<string, number>()
    rawFilteredEvents.forEach((event) => {
      if ("tags" in event) {
        const postId = event.tags?.find((t: string[]) => t[0] === "e")?.[1]
        if (postId) {
          likesByPostId.set(postId, (likesByPostId.get(postId) || 0) + 1)
        }
      }
    })

    const sortedEntries = Array.from(likesByPostId.entries()).sort(
      ([, likesA], [, likesB]) => likesB - likesA
    )

    // For random sort, apply minimum reaction filter if we have enough events
    if (randomSort) {
      const qualifyingEvents = sortedEntries.filter(([, likes]) => likes >= 2)
      const eventsToUse = qualifyingEvents.length >= 5 ? qualifyingEvents : sortedEntries
      return eventsToUse.map(([postId, likes]) => ({id: postId, likes}))
    }

    return sortedEntries.map(([postId, likes]) => ({id: postId, likes}))
  }, [rawFilteredEvents, randomSort])

  const sortedData = useMemo(() => {
    console.log("Popular component - filteredEvents:", filteredEvents)
    if (!filteredEvents) return []

    // filteredEvents now contains objects like {id, likes}
    const validEvents = filteredEvents.filter((e) => {
      return e && typeof e === "object" && "id" in e
    })

    console.log("Popular component - validEvents:", validEvents)
    return randomSort ? [...validEvents].sort(() => Math.random() - 0.5) : validEvents
  }, [filteredEvents, randomSort])

  const loadMore = useCallback(() => {
    setDisplayCount((prevCount) => Math.min(prevCount + 10, sortedData.length))
  }, [sortedData])

  useEffect(() => {
    socialGraphLoaded.then(() => {
      setIsSocialGraphLoaded(true)
    })
  }, [])

  const isTestEnvironment =
    typeof window !== "undefined" && window.location.href.includes("localhost:5173")
  if (!isSocialGraphLoaded && !isTestEnvironment) {
    return null
  }

  return (
    <InfiniteScroll onLoadMore={loadMore}>
      <div className={classNames("flex flex-col gap-8", {"text-base-content/50": small})}>
        {initialLoadDone && sortedData.length === 0 ? (
          <div className="px-4">No popular posts found</div>
        ) : null}
        {sortedData.slice(0, displayCount).map((event) => {
          if (!event || !event.id) return null

          // Events now have structure {id, likes} - pass eventId to fetch the actual post
          return small ? (
            <EventBorderless key={event.id} eventId={event.id} />
          ) : (
            <FeedItem key={event.id} eventId={event.id} />
          )
        })}
      </div>
    </InfiniteScroll>
  )
}
