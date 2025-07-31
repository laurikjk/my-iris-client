import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import {useState, useMemo, useCallback, useEffect, useRef} from "react"
import useHistoryState from "@/shared/hooks/useHistoryState"
import MediaModal from "../media/MediaModal"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import ImageGridItem from "./ImageGridItem"
import DebugManager from "@/utils/DebugManager"

interface MediaFeedProps {
  events: (NDKEvent | {id: string})[]
}

// Limit memory usage by keeping only recent events
const MAX_FETCHED_EVENTS = 100

export default function MediaFeed({events}: MediaFeedProps) {
  const [showModal, setShowModal] = useState(false)
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [displayCount, setDisplayCount] = useHistoryState(
    INITIAL_DISPLAY_COUNT,
    "displayCount"
  )
  const [modalMedia, setModalMedia] = useState<
    Array<{type: "image" | "video"; url: string; event: NDKEvent}>
  >([])

  // Use a Map for better performance and automatic deduplication
  const [fetchedEventsMap, setFetchedEventsMap] = useState<Map<string, NDKEvent>>(
    new Map()
  )

  // Debug tracking
  const renderCount = useRef(0)
  const lastDebugTime = useRef(0)
  const debugManager = DebugManager

  // Debug: Track renders and send periodic debug info
  useEffect(() => {
    renderCount.current++
    const now = Date.now()

    // Send debug info every 5 seconds to avoid spam
    if (now - lastDebugTime.current > 5000) {
      lastDebugTime.current = now

      if (debugManager.isDebugEnabled()) {
        const debugSession = debugManager.getDebugSession()
        if (debugSession) {
          const memoryEstimate = calculateMemoryEstimate()
          debugSession.publish("mediaFeed_debug", {
            timestamp: now,
            renderCount: renderCount.current,
            eventsTotal: events.length,
            eventsVisible: displayCount,
            fetchedEventsMapSize: fetchedEventsMap.size,
            modalMediaLength: modalMedia.length,
            showModal,
            activeItemIndex,
            memoryEstimate,
            userAgent: navigator.userAgent,
          })
        }
      }
    }
  })

  // Debug: Calculate rough memory estimate
  const calculateMemoryEstimate = useCallback(() => {
    let estimate = 0

    // Estimate fetchedEventsMap memory (rough calculation)
    for (const [id, event] of fetchedEventsMap) {
      estimate += id.length * 2 // string chars are 2 bytes
      estimate += (event.content?.length || 0) * 2
      estimate += JSON.stringify(event.tags || []).length * 2
      estimate += 200 // overhead for object structure
    }

    // Estimate modalMedia memory
    estimate += modalMedia.length * (100 + 200) // url + object overhead

    // Convert to KB
    return Math.round(estimate / 1024)
  }, [fetchedEventsMap, modalMedia])

  const visibleEvents = useMemo(() => {
    return events.slice(0, displayCount)
  }, [events, displayCount])

  const calculateAllMedia = useCallback(
    (events: NDKEvent[]) => {
      const startTime = performance.now()

      const deduplicated = new Map<
        string,
        {type: "image" | "video"; url: string; event: NDKEvent}
      >()

      events.forEach((event) => {
        const imageMatches = event.content.match(IMAGE_REGEX) || []
        const videoMatches = event.content.match(VIDEO_REGEX) || []

        const imageUrls = imageMatches.flatMap((match) =>
          match
            .trim()
            .split(/\s+/)
            .map((url) => ({
              type: "image" as const,
              url,
              event,
            }))
        )

        const videoUrls = videoMatches.flatMap((match) =>
          match
            .trim()
            .split(/\s+/)
            .map((url) => ({
              type: "video" as const,
              url,
              event,
            }))
        )

        for (const item of [...imageUrls, ...videoUrls]) {
          const uniqueId = `${event.id}_${item.url}`
          if (!deduplicated.has(uniqueId)) {
            deduplicated.set(uniqueId, item)
          }
        }
      })

      const result = Array.from(deduplicated.values())
      const duration = performance.now() - startTime

      // Debug: Log expensive calculateAllMedia calls
      if (duration > 10 && debugManager.isDebugEnabled()) {
        const debugSession = debugManager.getDebugSession()
        if (debugSession) {
          debugSession.publish("mediaFeed_performance", {
            operation: "calculateAllMedia",
            duration: Math.round(duration),
            eventsProcessed: events.length,
            mediaItemsFound: result.length,
            timestamp: Date.now(),
          })
        }
      }

      return result
    },
    [debugManager]
  )

  const loadMoreItems = useCallback(() => {
    if (events.length > displayCount) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
      return true
    }
    return false
  }, [events.length, displayCount])

  const handleImageClick = useCallback(
    (event: NDKEvent, clickedUrl: string) => {
      const startTime = performance.now()

      // Use all available events for modal, not just fetched ones
      const allFetchedEvents = Array.from(fetchedEventsMap.values())

      // Create a combined array of all events (fetched + unfetched)
      const allEvents = events
        .map((eventItem) => {
          // If we have the full event fetched, use it
          const fetchedEvent = allFetchedEvents.find((fe) => fe.id === eventItem.id)
          if (fetchedEvent) {
            return fetchedEvent
          }
          // If it's already a full event, use it
          if ("content" in eventItem) {
            return eventItem
          }
          // Skip unfetched events for now (they'll be fetched on demand)
          return null
        })
        .filter(Boolean) as NDKEvent[]

      // Ensure the clicked event is included in allEvents
      // Only add if not already present to prevent duplicates
      if (!allEvents.find((e) => e.id === event.id)) {
        allEvents.push(event)
      }

      // Calculate media from all available events for feed-wide browsing
      const mediaArray = calculateAllMedia(allEvents)
      const mediaIndex = mediaArray.findIndex(
        (media) => media.event.id === event.id && media.url === clickedUrl
      )

      if (mediaIndex === -1) {
        return
      }

      setModalMedia(mediaArray)
      setActiveItemIndex(mediaIndex)
      setShowModal(true)

      const duration = performance.now() - startTime

      // Debug: Log modal opening performance
      if (debugManager.isDebugEnabled()) {
        const debugSession = debugManager.getDebugSession()
        if (debugSession) {
          debugSession.publish("mediaFeed_performance", {
            operation: "handleImageClick",
            duration: Math.round(duration),
            allEventsCount: allEvents.length,
            mediaArrayLength: mediaArray.length,
            mediaIndex,
            timestamp: Date.now(),
          })
        }
      }
    },
    [events, fetchedEventsMap, calculateAllMedia, debugManager]
  )

  const handleEventFetched = useCallback(
    (event: NDKEvent) => {
      setFetchedEventsMap((prev) => {
        if (prev.has(event.id)) return prev

        const newMap = new Map(prev)
        newMap.set(event.id, event)

        // Limit memory usage by keeping only the most recent events
        if (newMap.size > MAX_FETCHED_EVENTS) {
          const entries = Array.from(newMap.entries())
          // Sort by event creation time and keep only the most recent
          entries.sort(([, a], [, b]) => (b.created_at || 0) - (a.created_at || 0))
          const limitedEntries = entries.slice(0, MAX_FETCHED_EVENTS)

          // Debug: Log when we're trimming events
          if (debugManager.isDebugEnabled()) {
            const debugSession = debugManager.getDebugSession()
            if (debugSession) {
              debugSession.publish("mediaFeed_memory", {
                operation: "trimFetchedEvents",
                oldSize: newMap.size,
                newSize: MAX_FETCHED_EVENTS,
                eventsRemoved: newMap.size - MAX_FETCHED_EVENTS,
                timestamp: Date.now(),
              })
            }
          }

          return new Map(limitedEntries)
        }

        return newMap
      })
    },
    [debugManager]
  )

  // Clean up events that are no longer visible
  useEffect(() => {
    const visibleEventIds = new Set(visibleEvents.map((e) => e.id))
    setFetchedEventsMap((prev) => {
      const newMap = new Map()
      let removedCount = 0

      for (const [id, event] of prev) {
        if (visibleEventIds.has(id)) {
          newMap.set(id, event)
        } else {
          removedCount++
        }
      }

      // Debug: Log cleanup activity
      if (removedCount > 0 && debugManager.isDebugEnabled()) {
        const debugSession = debugManager.getDebugSession()
        if (debugSession) {
          debugSession.publish("mediaFeed_memory", {
            operation: "cleanupInvisibleEvents",
            eventsRemoved: removedCount,
            remainingEvents: newMap.size,
            visibleEventsCount: visibleEvents.length,
            timestamp: Date.now(),
          })
        }
      }

      return newMap
    })
  }, [visibleEvents, debugManager])

  const isModalOpen = showModal
  const hasActiveItem = activeItemIndex !== null
  const hasModalMedia = modalMedia.length > 0
  const isValidIndex = activeItemIndex !== null && activeItemIndex < modalMedia.length
  const shouldShowModal = isModalOpen && hasActiveItem && hasModalMedia && isValidIndex

  // Memoize modal media array to prevent recreating on every render
  const modalMediaArray = useMemo(() => {
    return modalMedia.map((item) => ({
      id: item.url,
      url: item.url,
      type: item.type,
      event: item.event,
    }))
  }, [modalMedia])

  return (
    <>
      {shouldShowModal && (
        <MediaModal
          onClose={() => {
            setShowModal(false)
            setActiveItemIndex(null)
            setModalMedia([])
          }}
          media={modalMediaArray}
          showFeedItem={true}
          currentIndex={activeItemIndex}
        />
      )}

      <InfiniteScroll onLoadMore={loadMoreItems}>
        <div className="grid grid-cols-3 gap-px md:gap-1">
          {visibleEvents.map((item, index) => (
            <ImageGridItem
              key={`${item.id}_${index}`}
              event={item}
              index={index}
              setActiveItemIndex={handleImageClick}
              onEventFetched={handleEventFetched}
            />
          ))}
        </div>
      </InfiniteScroll>
    </>
  )
}
