import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import {useMemo, useCallback, useState, useRef, useEffect} from "react"
import MediaModal from "../media/MediaModal"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import ImageGridItem from "./ImageGridItem"
import {useMediaExtraction} from "@/shared/hooks/useMediaExtraction"
import {useMediaModal} from "@/shared/hooks/useMediaModal"
import {useMediaCache} from "@/shared/hooks/useMediaCache"

interface MediaFeedProps {
  events: (NDKEvent | {id: string})[]
  eventsToHighlight?: Set<string>
}

export default function MediaFeed({events, eventsToHighlight}: MediaFeedProps) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use custom hooks for better organization
  const {calculateAllMedia} = useMediaExtraction()
  const {showModal, activeItemIndex, modalMedia, openModal, closeModal} = useMediaModal()
  const {fetchedEventsMap, handleEventFetched} = useMediaCache()

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Find the scroll container parent by traversing up the DOM
        let scrollContainer = containerRef.current.parentElement
        while (scrollContainer) {
          const overflow = window.getComputedStyle(scrollContainer).overflow
          if (
            overflow === "auto" ||
            overflow === "scroll" ||
            scrollContainer.classList.contains("feed-container")
          ) {
            break
          }
          scrollContainer = scrollContainer.parentElement
        }
        // Use the scroll container width, or fallback to current container
        const targetWidth =
          scrollContainer?.offsetWidth || containerRef.current.offsetWidth
        setContainerWidth(targetWidth)
      }
    }

    // Update width initially
    updateWidth()

    // Use ResizeObserver if available, otherwise fall back to window resize
    if (window.ResizeObserver && containerRef.current) {
      const resizeObserver = new ResizeObserver(updateWidth)
      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    } else {
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }
  }, [])

  // Determine gap based on container width
  const gridGap = useMemo(() => {
    if (containerWidth >= 800) return "gap-1"
    if (containerWidth >= 600) return "gap-0.5"
    return "gap-px"
  }, [containerWidth])

  const visibleEvents = useMemo(() => {
    return events.slice(0, displayCount)
  }, [events, displayCount])

  const loadMoreItems = useCallback(() => {
    if (events.length > displayCount) {
      setDisplayCount(displayCount + DISPLAY_INCREMENT)
      return true
    }
    return false
  }, [events.length, displayCount])

  const handleImageClick = useCallback(
    (event: NDKEvent, clickedUrl: string) => {
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
          if ("content" in eventItem && "tags" in eventItem) {
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

      // Use the modal hook to open the modal
      openModal(mediaArray, event, clickedUrl)
    },
    [events, fetchedEventsMap, calculateAllMedia, openModal]
  )

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
      {showModal && activeItemIndex !== null && modalMedia.length > 0 && (
        <MediaModal
          onClose={closeModal}
          media={modalMediaArray}
          showFeedItem={true}
          currentIndex={activeItemIndex}
        />
      )}

      <InfiniteScroll onLoadMore={loadMoreItems}>
        <div ref={containerRef} className={`grid grid-cols-3 ${gridGap}`}>
          {visibleEvents.map((item, index) => (
            <ImageGridItem
              key={`${item.id}_${index}`}
              event={item}
              index={index}
              setActiveItemIndex={handleImageClick}
              onEventFetched={handleEventFetched}
              highlightAsNew={eventsToHighlight?.has(item.id) || false}
            />
          ))}
        </div>
      </InfiniteScroll>
    </>
  )
}
