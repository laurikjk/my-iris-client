import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import {useState, useMemo, useCallback, useEffect} from "react"
import useHistoryState from "@/shared/hooks/useHistoryState"
import PreloadImages from "../media/PreloadImages"
import MediaModal from "../media/MediaModal"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import ImageGridItem from "./ImageGridItem"

interface MediaFeedProps {
  events: (NDKEvent | {id: string})[]
}

// Limit memory usage by keeping only recent events
const MAX_FETCHED_EVENTS = 100
const PRELOAD_RANGE = 3 // Only preload 3 images before/after current

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

  const visibleEvents = useMemo(() => {
    return events.slice(0, displayCount)
  }, [events, displayCount])

  const calculateAllMedia = useCallback((events: NDKEvent[]) => {
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

    return Array.from(deduplicated.values())
  }, [])

  const handlePrevItem = () => {
    if (activeItemIndex === null) return
    setActiveItemIndex(Math.max(0, activeItemIndex - 1))
  }

  const handleNextItem = () => {
    if (activeItemIndex === null) return
    setActiveItemIndex(Math.min(modalMedia.length - 1, activeItemIndex + 1))
  }

  useEffect(() => {
    if (!showModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevItem()
      } else if (e.key === "ArrowRight") {
        handleNextItem()
      } else if (e.key === "Escape") {
        setShowModal(false)
        setActiveItemIndex(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showModal, activeItemIndex])

  const loadMoreItems = () => {
    if (events.length > displayCount) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
      return true
    }
    return false
  }

  const handleImageClick = (event: NDKEvent, clickedUrl: string) => {
    // Use all available events for modal, not just fetched ones
    const allFetchedEvents = Array.from(fetchedEventsMap.values())
    
    // Create a combined array of all events (fetched + unfetched)
    const allEvents = events.map(eventItem => {
      // If we have the full event fetched, use it
      const fetchedEvent = allFetchedEvents.find(fe => fe.id === eventItem.id)
      if (fetchedEvent) {
        return fetchedEvent
      }
      // If it's already a full event, use it
      if ('content' in eventItem) {
        return eventItem
      }
      // Skip unfetched events for now (they'll be fetched on demand)
      return null
    }).filter(Boolean) as NDKEvent[]

    // Calculate media from all available events
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
  }

  const handleEventFetched = useCallback((event: NDKEvent) => {
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
        return new Map(limitedEntries)
      }

      return newMap
    })
  }, [])

  // Clean up events that are no longer visible
  useEffect(() => {
    const visibleEventIds = new Set(visibleEvents.map((e) => e.id))
    setFetchedEventsMap((prev) => {
      const newMap = new Map()
      for (const [id, event] of prev) {
        if (visibleEventIds.has(id)) {
          newMap.set(id, event)
        }
      }
      return newMap
    })
  }, [visibleEvents])

  const isModalOpen = showModal
  const hasActiveItem = activeItemIndex !== null
  const hasModalMedia = modalMedia.length > 0
  const isValidIndex = activeItemIndex !== null && activeItemIndex < modalMedia.length
  const shouldShowModal = isModalOpen && hasActiveItem && hasModalMedia && isValidIndex

  // Calculate preload range for better memory management
  const preloadImages = useMemo(() => {
    if (!shouldShowModal || activeItemIndex === null) return []

    const start = Math.max(0, activeItemIndex - PRELOAD_RANGE)
    const end = Math.min(modalMedia.length, activeItemIndex + PRELOAD_RANGE + 1)

    return modalMedia.slice(start, end).map((m) => m.url)
  }, [shouldShowModal, activeItemIndex, modalMedia])

  // Calculate the current index within the preload range
  const currentPreloadIndex = useMemo(() => {
    if (!shouldShowModal || activeItemIndex === null) return 0

    const start = Math.max(0, activeItemIndex - PRELOAD_RANGE)
    return activeItemIndex - start
  }, [shouldShowModal, activeItemIndex])

  return (
    <>
      {shouldShowModal && (
        <>
          <MediaModal
            onClose={() => {
              setShowModal(false)
              setActiveItemIndex(null)
              setModalMedia([])
            }}
            onPrev={handlePrevItem}
            onNext={handleNextItem}
            mediaUrl={modalMedia[activeItemIndex].url}
            mediaType={modalMedia[activeItemIndex].type}
            showFeedItem={true}
            event={modalMedia[activeItemIndex].event}
            currentIndex={activeItemIndex}
            totalCount={modalMedia.length}
          />
          <PreloadImages images={preloadImages} currentIndex={currentPreloadIndex} />
        </>
      )}

      <InfiniteScroll onLoadMore={loadMoreItems}>
        <div className="grid grid-cols-3 gap-px md:gap-1">
          {visibleEvents.map((item, index) => (
            <ImageGridItem
              key={item.id}
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
