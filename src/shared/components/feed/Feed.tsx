import {useRef, useState, ReactNode, useEffect, useMemo, memo} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"

import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import useHistoryState from "@/shared/hooks/useHistoryState"
import FeedItem from "../event/FeedItem/FeedItem"
import {useUserStore} from "@/stores/user"

import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import useFeedEvents from "@/shared/hooks/useFeedEvents.ts"
import {useSocialGraphLoaded} from "@/utils/socialGraph.ts"
import UnknownUserEvents from "./UnknownUserEvents.tsx"
import {DisplayAsSelector} from "./DisplayAsSelector"
import NewEventsButton from "./NewEventsButton.tsx"
import {useFeedStore, type FeedConfig} from "@/stores/feed"
import {getTag} from "@/utils/nostr"
import MediaFeed from "./MediaFeed"
import socialGraph from "@/utils/socialGraph"
import {hasMedia} from "@/shared/components/embed"
import {getEventReplyingTo} from "@/utils/nostr"
import {seenEventIds} from "@/utils/memcache"

interface FeedProps {
  // Either provide filters + legacy props, or feedConfig
  filters?: NDKFilter
  feedConfig?: FeedConfig
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  sortFn?: (a: NDKEvent, b: NDKEvent) => number
  cacheKey?: string
  asReply?: boolean
  showRepliedTo?: boolean
  showReplies?: number
  onEvent?: (event: NDKEvent) => void
  borderTopFirst?: boolean
  emptyPlaceholder?: ReactNode
  forceUpdate?: number
  displayAs?: "list" | "grid"
  showDisplayAsSelector?: boolean
  onDisplayAsChange?: (display: "list" | "grid") => void
  sortLikedPosts?: boolean
  relayUrls?: string[]
  showEventsByUnknownUsers?: boolean
  followDistance?: number
  // Special props for legacy compatibility
  refreshSignal?: number
  openedAt?: number
}

const DefaultEmptyPlaceholder = (
  <div className="p-8 flex flex-col gap-8 items-center justify-center text-base-content/50">
    No posts yet
  </div>
)

const Feed = memo(function Feed({
  filters: propFilters,
  feedConfig,
  displayFilterFn,
  fetchFilterFn,
  sortFn,
  cacheKey,
  asReply = false,
  showRepliedTo,
  showReplies = 0,
  onEvent,
  borderTopFirst = true,
  emptyPlaceholder = DefaultEmptyPlaceholder,
  forceUpdate,
  displayAs: initialDisplayAs = "list",
  showDisplayAsSelector = true,
  onDisplayAsChange,
  sortLikedPosts,
  relayUrls,
  showEventsByUnknownUsers: showEventsByUnknownUsersProp,
  followDistance,
  refreshSignal,
  openedAt,
}: FeedProps) {
  // Validation: either filters or feedConfig must be provided
  if (!propFilters && !feedConfig?.filter) {
    throw new Error(
      "Feed component requires either 'filters' prop or 'feedConfig' with filter"
    )
  }

  // Derive values from feedConfig or use props
  const filters = useMemo(() => {
    if (feedConfig?.filter) {
      return feedConfig.filter as unknown as NDKFilter
    }
    return propFilters!
  }, [feedConfig?.filter, propFilters])

  const derivedCacheKey = useMemo(() => {
    if (cacheKey) return cacheKey
    if (feedConfig) {
      return `${feedConfig.id}-${feedConfig.filter?.search || ""}`
    }
    return JSON.stringify({...filters, isTruncated: true})
  }, [cacheKey, feedConfig, filters])

  const derivedShowRepliedTo = showRepliedTo ?? feedConfig?.showRepliedTo ?? true
  const derivedSortLikedPosts = sortLikedPosts ?? feedConfig?.sortLikedPosts ?? false
  const derivedRelayUrls = relayUrls ?? feedConfig?.relayUrls
  const derivedShowEventsByUnknownUsers =
    showEventsByUnknownUsersProp ?? feedConfig?.showEventsByUnknownUsers ?? false
  const derivedFollowDistance = followDistance ?? feedConfig?.followDistance

  const [displayCount, setDisplayCount] = useHistoryState(
    INITIAL_DISPLAY_COUNT,
    "displayCount"
  )
  const firstFeedItemRef = useRef<HTMLDivElement>(null)
  const myPubKey = useUserStore((state) => state.publicKey)

  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useState(false)

  // Create filter functions from feedConfig
  const configBasedDisplayFilterFn = useMemo(() => {
    if (!feedConfig) return undefined

    return (event: NDKEvent) => {
      // Check if requires media
      if (feedConfig.requiresMedia && !hasMedia(event)) {
        return false
      }

      // Check if requires replies
      if (feedConfig.requiresReplies && !getEventReplyingTo(event)) {
        return false
      }

      // Check reply exclusion for display
      if (feedConfig.hideReplies && getEventReplyingTo(event)) {
        return false
      }

      // Handle excludeSeen with special logic for unseen tab
      if (feedConfig.excludeSeen) {
        if (
          feedConfig.id === "unseen" &&
          refreshSignal &&
          openedAt &&
          refreshSignal > openedAt &&
          seenEventIds.has(event.id)
        ) {
          return false
        } else if (feedConfig.id !== "unseen" && seenEventIds.has(event.id)) {
          return false
        }
      }

      return true
    }
  }, [feedConfig, refreshSignal, openedAt])

  const configBasedFetchFilterFn = useMemo(() => {
    if (!feedConfig) return undefined

    return (event: NDKEvent) => {
      // Check if should exclude seen events
      if (feedConfig.excludeSeen && seenEventIds.has(event.id)) {
        return false
      }

      // Check reply exclusion
      if (feedConfig.hideReplies && getEventReplyingTo(event)) {
        return false
      }

      return true
    }
  }, [feedConfig])

  // Use config-based filters if available, otherwise use props
  const finalDisplayFilterFn = displayFilterFn || configBasedDisplayFilterFn
  const finalFetchFilterFn = fetchFilterFn || configBasedFetchFilterFn

  // Create combined display filter that includes follow distance filtering if needed
  const combinedDisplayFilterFn = useMemo(() => {
    // Simple relay URL normalization
    const normalizeRelay = (url: string) =>
      url.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "").replace(/\/$/, "")

    return (event: NDKEvent) => {
      // First apply custom display filter if provided
      if (finalDisplayFilterFn && !finalDisplayFilterFn(event)) {
        return false
      }

      // Apply relay filtering if relayUrls is configured
      if (derivedRelayUrls && derivedRelayUrls.length > 0) {
        if (!event.onRelays || event.onRelays.length === 0) return false

        const normalizedTargetRelays = derivedRelayUrls.map(normalizeRelay)
        const eventIsOnTargetRelay = event.onRelays.some((relay) =>
          normalizedTargetRelays.includes(normalizeRelay(relay.url))
        )

        if (!eventIsOnTargetRelay) return false
      }

      // Apply follow distance filter if specified and showEventsByUnknownUsers is false
      if (derivedFollowDistance !== undefined && !derivedShowEventsByUnknownUsers) {
        const eventFollowDistance = socialGraph().getFollowDistance(event.pubkey)
        if (eventFollowDistance > derivedFollowDistance) {
          return false
        }
      }

      return true
    }
  }, [
    finalDisplayFilterFn,
    derivedFollowDistance,
    derivedShowEventsByUnknownUsers,
    derivedRelayUrls,
  ])

  const {feedDisplayAs: persistedDisplayAs, setFeedDisplayAs} = useFeedStore()

  // Use persisted value only when selector is shown, otherwise use initialDisplayAs
  const displayAs = showDisplayAsSelector ? persistedDisplayAs : initialDisplayAs
  const setDisplayAs = (value: "list" | "grid") => {
    setFeedDisplayAs(value)
  }

  const {
    newEvents: newEventsMap,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems: hookLoadMoreItems,
    initialLoadDone,
  } = useFeedEvents({
    filters,
    cacheKey: derivedCacheKey,
    displayCount,
    displayFilterFn: combinedDisplayFilterFn,
    fetchFilterFn: finalFetchFilterFn,
    sortFn,
    hideEventsByUnknownUsers: !derivedShowEventsByUnknownUsers,
    sortLikedPosts: derivedSortLikedPosts,
    relayUrls: derivedRelayUrls,
  })

  const loadMoreItems = () => {
    const hasMore = hookLoadMoreItems()
    if (hasMore) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
    }
    return hasMore
  }

  const newEventsFiltered = useMemo(() => {
    return Array.from(newEventsMap.values()).filter(combinedDisplayFilterFn)
  }, [newEventsMap, combinedDisplayFilterFn])

  const newEventsFromFiltered = useMemo(() => {
    return new Set(newEventsFiltered.map((event) => event.pubkey))
  }, [newEventsFiltered])

  const gridEvents = useMemo(() => {
    if (displayAs === "grid") {
      return filteredEvents
        .map((event) => {
          if ("content" in event && event.kind === 7) {
            const eTag = getTag("e", event.tags)
            return eTag ? {id: eTag} : null
          }
          return event
        })
        .filter((event) => event !== null)
    }
    return filteredEvents
  }, [filteredEvents, displayAs])

  const [, setForceUpdateCount] = useState(0)

  const isSocialGraphLoaded = useSocialGraphLoaded()

  useEffect(() => {
    if (forceUpdate !== undefined) {
      setForceUpdateCount((prev) => prev + 1)
    }
  }, [forceUpdate])

  if (!isSocialGraphLoaded) {
    return null
  }

  return (
    <>
      {showDisplayAsSelector && (
        <DisplayAsSelector
          activeSelection={displayAs}
          onSelect={(display) => {
            setDisplayAs(display)
            onDisplayAsChange?.(display)
          }}
        />
      )}

      {newEventsFiltered.length > 0 && (
        <NewEventsButton
          newEventsFiltered={newEventsFiltered}
          newEventsFrom={newEventsFromFiltered}
          showNewEvents={showNewEvents}
          firstFeedItemRef={firstFeedItemRef}
        />
      )}

      <div>
        {filteredEvents.length > 0 && (
          <InfiniteScroll onLoadMore={loadMoreItems}>
            {displayAs === "grid" ? (
              <MediaFeed events={gridEvents} />
            ) : (
              <>
                {filteredEvents.slice(0, displayCount).map((event, index) => (
                  <div key={event.id} ref={index === 0 ? firstFeedItemRef : null}>
                    <FeedItem
                      key={event.id}
                      asReply={asReply}
                      showRepliedTo={derivedShowRepliedTo}
                      showReplies={showReplies}
                      event={"content" in event ? event : undefined}
                      eventId={"content" in event ? undefined : event.id}
                      onEvent={onEvent}
                      borderTop={borderTopFirst && index === 0}
                    />
                  </div>
                ))}
              </>
            )}
          </InfiniteScroll>
        )}
        {filteredEvents.length === 0 &&
          newEventsFiltered.length === 0 &&
          initialLoadDone &&
          emptyPlaceholder}
        {myPubKey && eventsByUnknownUsers.length > 0 && (
          <div
            className="p-4 border-t border-b border-custom text-info text-center transition-colors duration-200 ease-in-out hover:underline hover:bg-[var(--note-hover-color)] cursor-pointer"
            onClick={() => setShowEventsByUnknownUsers(!showEventsByUnknownUsers)}
          >
            {showEventsByUnknownUsers ? "Hide" : "Show"} {eventsByUnknownUsers.length}{" "}
            events by unknown users
          </div>
        )}
        {showEventsByUnknownUsers && eventsByUnknownUsers.length > 0 && (
          <UnknownUserEvents
            eventsByUnknownUsers={eventsByUnknownUsers}
            showRepliedTo={derivedShowRepliedTo}
            asReply={true}
          />
        )}
      </div>
    </>
  )
})

export default Feed
