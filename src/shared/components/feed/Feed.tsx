import {useRef, useState, ReactNode, useEffect, useMemo, memo, useCallback} from "react"
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
import {useFeedStore, type FeedConfig, getFeedCacheKey} from "@/stores/feed"
import {getTag} from "@/utils/nostr"
import MediaFeed from "./MediaFeed"
import socialGraph from "@/utils/socialGraph"
import useFollows from "@/shared/hooks/useFollows"

interface FeedProps {
  feedConfig: FeedConfig
  asReply?: boolean
  showReplies?: number
  onEvent?: (event: NDKEvent) => void
  borderTopFirst?: boolean
  emptyPlaceholder?: ReactNode
  forceUpdate?: number
  displayAs?: "list" | "grid"
  showDisplayAsSelector?: boolean
  onDisplayAsChange?: (display: "list" | "grid") => void
  refreshSignal?: number
  openedAt?: number
}

const DefaultEmptyPlaceholder = (
  <div className="p-8 flex flex-col gap-8 items-center justify-center text-base-content/50">
    No posts yet
  </div>
)

const Feed = memo(function Feed({
  feedConfig,
  asReply = false,
  showReplies = 0,
  onEvent,
  borderTopFirst = true,
  emptyPlaceholder = DefaultEmptyPlaceholder,
  forceUpdate,
  displayAs: initialDisplayAs = "list",
  showDisplayAsSelector = true,
  onDisplayAsChange,
  refreshSignal,
  openedAt,
}: FeedProps) {
  if (!feedConfig?.filter) {
    throw new Error("Feed component requires feedConfig with filter")
  }

  const myPubKey = useUserStore((state) => state.publicKey)
  const follows = useFollows(myPubKey, true)

  // Enhance filters with authors list for follow-distance-based feeds
  const filters = useMemo(() => {
    const baseFilters = feedConfig.filter as unknown as NDKFilter

    // Set authors based on followDistance for better relay-level filtering
    if (feedConfig.followDistance === 0 && myPubKey) {
      // followDistance 0: only our own posts
      return {
        ...baseFilters,
        authors: [myPubKey],
      }
    } else if (feedConfig.followDistance === 1 && follows.length > 0) {
      // followDistance 1: people we follow
      return {
        ...baseFilters,
        authors: follows,
      }
    }

    // followDistance > 1 or undefined: fetch all, filter client-side
    return baseFilters
  }, [feedConfig.filter, feedConfig.followDistance, follows, myPubKey])

  const sortFn = useMemo(() => {
    switch (feedConfig.sortType) {
      case "followDistance":
        return (a: NDKEvent, b: NDKEvent) => {
          const followDistanceA = socialGraph().getFollowDistance(a.pubkey)
          const followDistanceB = socialGraph().getFollowDistance(b.pubkey)
          if (followDistanceA !== followDistanceB) {
            return followDistanceA - followDistanceB
          }
          return (a.created_at || 0) - (b.created_at || 0)
        }
      case "chronological":
        return (a: NDKEvent, b: NDKEvent) => (b.created_at || 0) - (a.created_at || 0)
      default:
        return undefined
    }
  }, [feedConfig.sortType])

  const cacheKey = useMemo(() => getFeedCacheKey(feedConfig), [feedConfig])

  const [displayCount, setDisplayCount] = useHistoryState(
    INITIAL_DISPLAY_COUNT,
    "displayCount"
  )
  const firstFeedItemRef = useRef<HTMLDivElement>(null)

  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useState(false)

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
    cacheKey,
    displayCount,
    feedConfig,
    hideEventsByUnknownUsers: false,
    sortLikedPosts: feedConfig.sortLikedPosts || false,
    sortFn,
    relayUrls: feedConfig.relayUrls,
    refreshSignal,
    openedAt,
  })

  const loadMoreItems = () => {
    const hasMore = hookLoadMoreItems()
    if (hasMore) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
    }
    return hasMore
  }

  const newEventsFiltered = useMemo(() => {
    return Array.from(newEventsMap.values())
  }, [newEventsMap])

  const newEventsFromFiltered = useMemo(() => {
    return new Set(newEventsFiltered.map((event) => event.pubkey))
  }, [newEventsFiltered])

  const gridEvents = useMemo(() => {
    if (displayAs === "grid") {
      const seen = new Set<string>()
      return filteredEvents
        .map((event) => {
          if ("content" in event && event.kind === 7) {
            const eTag = getTag("e", event.tags)
            return eTag ? {id: eTag} : null
          }
          return event
        })
        .filter((event): event is NDKEvent | {id: string} => {
          if (event === null) return false
          // Deduplicate by event ID to prevent multiple reposts of same event
          if (seen.has(event.id)) return false
          seen.add(event.id)
          return true
        })
    }
    return filteredEvents
  }, [filteredEvents, displayAs])

  const [, setForceUpdateCount] = useState(0)

  // Track events that should be highlighted (those added via showNewEvents)
  const [eventsToHighlight, setEventsToHighlight] = useState(new Set<string>())

  // Custom showNewEvents wrapper that tracks which events to highlight
  const showNewEventsWithHighlight = useCallback(() => {
    const eventIdsToHighlight = new Set(Array.from(newEventsMap.keys()))
    setEventsToHighlight(eventIdsToHighlight)
    showNewEvents()

    // Clear highlight after animation
    setTimeout(() => {
      setEventsToHighlight(new Set())
    }, 2000)
  }, [newEventsMap, showNewEvents])

  // Auto-show new events if enabled
  useEffect(() => {
    if (feedConfig.autoShowNewEvents && newEventsFiltered.length > 0) {
      showNewEventsWithHighlight()
    }
  }, [feedConfig.autoShowNewEvents, newEventsFiltered.length, showNewEventsWithHighlight])

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

      {newEventsFiltered.length > 0 && !feedConfig.autoShowNewEvents && (
        <NewEventsButton
          newEventsFiltered={newEventsFiltered}
          newEventsFrom={newEventsFromFiltered}
          showNewEvents={showNewEventsWithHighlight}
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
                      showRepliedTo={feedConfig.showRepliedTo ?? true}
                      showReplies={showReplies}
                      event={"content" in event ? event : undefined}
                      eventId={"content" in event ? undefined : event.id}
                      onEvent={onEvent}
                      borderTop={borderTopFirst && index === 0}
                      highlightAsNew={eventsToHighlight.has(event.id)}
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
            showRepliedTo={feedConfig.showRepliedTo ?? true}
            asReply={true}
          />
        )}
      </div>
    </>
  )
})

export default Feed
