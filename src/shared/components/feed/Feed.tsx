import {useRef, useState, ReactNode, useEffect, useMemo} from "react"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"

import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import useHistoryState from "@/shared/hooks/useHistoryState"
import FeedItem from "../event/FeedItem/FeedItem"
import {useUserStore} from "@/stores/user"

import {useFetchMissingEvents} from "@/shared/hooks/useFetchMissingEvents"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import useFeedEvents from "@/shared/hooks/useFeedEvents.ts"
import {socialGraphLoaded} from "@/utils/socialGraph.ts"
import UnknownUserEvents from "./UnknownUserEvents.tsx"
import {DisplayAsSelector} from "./DisplayAsSelector"
import NewEventsButton from "./NewEventsButton.tsx"
import {useSettingsStore} from "@/stores/settings"
import {useFeedStore} from "@/stores/feed"
import MediaFeed from "./MediaFeed"

interface FeedProps {
  filters: NDKFilter
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
  showEventsByUnknownUsersButton?: boolean
  displayAs?: "list" | "grid"
  showDisplayAsSelector?: boolean
  showFilters?: boolean
  onDisplayAsChange?: (display: "list" | "grid") => void
  sortLikedPosts?: boolean
}

const DefaultEmptyPlaceholder = (
  <div className="p-8 flex flex-col gap-8 items-center justify-center text-base-content/50">
    No posts yet
  </div>
)

function Feed({
  filters,
  displayFilterFn,
  fetchFilterFn,
  sortFn,
  cacheKey = JSON.stringify({...filters, isTruncated: true}),
  asReply = false,
  showRepliedTo = true,
  showReplies = 0,
  onEvent,
  borderTopFirst = true,
  emptyPlaceholder = DefaultEmptyPlaceholder,
  forceUpdate,
  showEventsByUnknownUsersButton = true,
  displayAs: initialDisplayAs = "list",
  showDisplayAsSelector = true,
  showFilters = false,
  onDisplayAsChange,
  sortLikedPosts = false,
}: FeedProps) {
  const [displayCount, setDisplayCount] = useHistoryState(
    INITIAL_DISPLAY_COUNT,
    "displayCount"
  )
  const firstFeedItemRef = useRef<HTMLDivElement>(null)
  const myPubKey = useUserStore((state) => state.publicKey)

  const {content} = useSettingsStore()
  const [hideEventsByUnknownUsers, setHideEventsByUnknownUsers] = useHistoryState(
    content.hideEventsByUnknownUsers,
    "initialHideEventsByUnknownUsers"
  )
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useState(false)

  const {feedDisplayAs: persistedDisplayAs, setFeedDisplayAs} = useFeedStore()

  // Use persisted value only when selector is shown, otherwise use initialDisplayAs
  const displayAs = showDisplayAsSelector ? persistedDisplayAs : initialDisplayAs
  const setDisplayAs = (value: "list" | "grid") => {
    setFeedDisplayAs(value)
  }

  const {
    newEvents: newEventsMap,
    newEventsFrom,
    filteredEvents,
    eventsByUnknownUsers,
    showNewEvents,
    loadMoreItems: hookLoadMoreItems,
    initialLoadDone,
  } = useFeedEvents({
    filters,
    cacheKey,
    displayCount,
    displayFilterFn,
    fetchFilterFn,
    sortFn,
    hideEventsByUnknownUsers,
    sortLikedPosts,
  })

  // Separate full events from {id} objects for batch fetching
  const missingIds = useMemo(() => {
    const missingIds: string[] = []

    filteredEvents.forEach((event) => {
      if (!("content" in event)) {
        missingIds.push(event.id)
      }
    })

    return missingIds
  }, [filteredEvents])

  // Fetch missing events for list view
  const {fetchedEvents, loadingIds, errorIds, refetch} = useFetchMissingEvents(
    displayAs === "list" ? missingIds : []
  )

  // Combine all events for list view
  const allEventsForList = useMemo(() => {
    const combinedEvents: (NDKEvent | {id: string})[] = []

    filteredEvents.forEach((event) => {
      if ("content" in event) {
        combinedEvents.push(event)
      } else {
        const fetchedEvent = fetchedEvents.get(event.id)
        combinedEvents.push(fetchedEvent || event)
      }
    })

    return combinedEvents
  }, [filteredEvents, fetchedEvents])

  const loadMoreItems = () => {
    const hasMore = hookLoadMoreItems()
    if (hasMore) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
    }
    return hasMore
  }

  const newEventsFiltered = Array.from(newEventsMap.values())

  const [, setForceUpdateCount] = useState(0)

  const [isSocialGraphLoaded, setIsSocialGraphLoaded] = useState(
    filters?.authors?.length === 1
  )

  useEffect(() => {
    if (forceUpdate !== undefined) {
      setForceUpdateCount((prev) => prev + 1)
    }
  }, [forceUpdate])

  useEffect(() => {
    socialGraphLoaded.then(() => setIsSocialGraphLoaded(true))
  }, [])

  useEffect(() => {
    if (history.state?.initialHideEventsByUnknownUsers === undefined) {
      setHideEventsByUnknownUsers(content.hideEventsByUnknownUsers)
    }
  }, [content.hideEventsByUnknownUsers])

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

      {showFilters && (
        <div className="flex items-center gap-2 p-2">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={!hideEventsByUnknownUsers}
            onChange={(e) => setHideEventsByUnknownUsers(!e.target.checked)}
          />
          <span className="text-sm">Show posts from unknown users</span>
        </div>
      )}

      {newEventsFiltered.length > 0 && (
        <NewEventsButton
          newEventsFiltered={newEventsFiltered}
          newEventsFrom={newEventsFrom}
          showNewEvents={showNewEvents}
          firstFeedItemRef={firstFeedItemRef}
        />
      )}

      <div>
        {filteredEvents.length > 0 && (
          <InfiniteScroll onLoadMore={loadMoreItems}>
            {displayAs === "grid" ? (
              <MediaFeed events={filteredEvents} />
            ) : (
              <>
                {allEventsForList.slice(0, displayCount).map((event, index) => {
                  const isLoading = !("content" in event) && loadingIds.has(event.id)
                  const hasError = !("content" in event) && errorIds.has(event.id)

                  if (isLoading) {
                    return (
                      <div
                        key={`loading-${event.id}`}
                        className="border-b border-base-300"
                      >
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (hasError) {
                    return (
                      <div key={`error-${event.id}`} className="border-b border-base-300">
                        <div className="p-4 flex items-center gap-3 text-gray-500">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-gray-400">!</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-sm">Failed to load post</span>
                            <button
                              onClick={() => refetch([event.id])}
                              className="ml-2 text-xs text-blue-500 hover:text-blue-600 underline"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={event.id} ref={index === 0 ? firstFeedItemRef : null}>
                      <FeedItem
                        key={event.id}
                        asReply={asReply}
                        showRepliedTo={showRepliedTo}
                        showReplies={showReplies}
                        event={"content" in event ? event : undefined}
                        eventId={"content" in event ? undefined : event.id}
                        onEvent={onEvent}
                        borderTop={borderTopFirst && index === 0}
                      />
                    </div>
                  )
                })}
              </>
            )}
          </InfiniteScroll>
        )}
        {(displayAs === "grid" ? filteredEvents.length : allEventsForList.length) === 0 &&
          newEventsFiltered.length === 0 &&
          initialLoadDone &&
          emptyPlaceholder}
        {showEventsByUnknownUsersButton &&
          myPubKey &&
          eventsByUnknownUsers.length > 0 && (
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
            showRepliedTo={showRepliedTo}
            asReply={true}
          />
        )}
      </div>
    </>
  )
}

export default Feed
