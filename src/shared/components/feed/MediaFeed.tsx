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

  const visibleEvents = useMemo(() => {
    return events.slice(0, displayCount)
  }, [events, displayCount])

  const [renderedEvents, setRenderedEvents] = useState<NDKEvent[]>([])

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
    const eventsForModal = renderedEvents.find((e) => e.id === event.id)
      ? renderedEvents
      : [...renderedEvents, event]
    const mediaArray = calculateAllMedia(eventsForModal)
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

  const handleEventRendered = useCallback((event: NDKEvent) => {
    setRenderedEvents((prev) => {
      if (prev.find((e) => e.id === event.id)) return prev
      return [...prev, event]
    })
  }, [])

  return (
    <>
      {showModal &&
        activeItemIndex !== null &&
        modalMedia.length > 0 &&
        activeItemIndex < modalMedia.length && (
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
            <PreloadImages
              key={activeItemIndex}
              images={modalMedia.map((m) => m.url)}
              currentIndex={activeItemIndex}
            />
          </>
        )}

      <InfiniteScroll onLoadMore={loadMoreItems}>
        <div className="grid grid-cols-3 gap-px md:gap-1">
          {visibleEvents.map((item, index) => {
            const key = item.id
            return (
              <ImageGridItem
                key={key}
                event={item}
                index={index}
                setActiveItemIndex={handleImageClick}
                onEventRendered={handleEventRendered}
              />
            )
          })}
        </div>
      </InfiniteScroll>
    </>
  )
}
