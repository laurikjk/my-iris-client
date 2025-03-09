import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import {useState, useEffect, useMemo, useCallback} from "react"
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

  const mediaEvents = useMemo(() => {
    return events.filter((event): event is NDKEvent => {
      if (!("content" in event)) return false
      const hasImageUrl = IMAGE_REGEX.test(event.content)
      const hasVideoUrl = VIDEO_REGEX.test(event.content)
      return hasImageUrl || hasVideoUrl
    })
  }, [events])

  const visibleMediaEvents = useMemo(() => {
    return mediaEvents.slice(0, displayCount)
  }, [mediaEvents, displayCount])

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
    const mediaArray = calculateAllMedia(visibleMediaEvents)
    const mediaIndex = mediaArray.findIndex(
      (media) => media.event.id === event.id && media.url === clickedUrl
    )
    setModalMedia(mediaArray)
    setActiveItemIndex(mediaIndex)
    setShowModal(true)
  }

  return (
    <>
      {showModal && activeItemIndex !== null && (
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
          {visibleMediaEvents.map((event, index) => (
            <ImageGridItem
              key={event.id}
              event={event}
              index={index}
              setActiveItemIndex={(clickedUrl: string) =>
                handleImageClick(event, clickedUrl)
              }
            />
          ))}
        </div>
      </InfiniteScroll>
    </>
  )
}
