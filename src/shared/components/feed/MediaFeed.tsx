import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT} from "./utils"
import imageEmbed from "@/shared/components/embed/images/Image"
import useHistoryState from "@/shared/hooks/useHistoryState"
import Video from "@/shared/components/embed/video/Video"
import PreloadImages from "../media/PreloadImages"
import {useState, useEffect, useMemo} from "react"
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

  const mediaEvents = useMemo(() => {
    return events.filter((event): event is NDKEvent => {
      if (!("content" in event)) return false
      const hasImageUrl = imageEmbed.regex.test(event.content)
      const hasVideoUrl = Video.regex.test(event.content)
      return hasImageUrl || hasVideoUrl
    })
  }, [events])

  const allMedia = useMemo(() => {
    const deduplicated = new Map<
      string,
      {type: "image" | "video"; url: string; event: NDKEvent}
    >()

    mediaEvents.forEach((event) => {
      const imageMatches = event.content.match(imageEmbed.regex) || []
      const videoMatches = event.content.match(Video.regex) || []

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
  }, [mediaEvents])

  const handlePrevItem = () => {
    if (activeItemIndex === null) return
    setActiveItemIndex(Math.max(0, activeItemIndex - 1))
  }

  const handleNextItem = () => {
    if (activeItemIndex === null) return
    setActiveItemIndex(Math.min(allMedia.length - 1, activeItemIndex + 1))
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
    if (mediaEvents.length > displayCount) {
      setDisplayCount((prev: number) => prev + DISPLAY_INCREMENT)
      return true
    }
    return false
  }

  return (
    <>
      {showModal && activeItemIndex !== null && (
        <>
          <MediaModal
            onClose={() => {
              setShowModal(false)
              setActiveItemIndex(null)
            }}
            onPrev={handlePrevItem}
            onNext={handleNextItem}
            mediaUrl={allMedia[activeItemIndex].url}
            mediaType={allMedia[activeItemIndex].type}
            showFeedItem={true}
            event={allMedia[activeItemIndex].event}
            currentIndex={activeItemIndex}
            totalCount={allMedia.length}
          />
          <PreloadImages
            key={activeItemIndex}
            images={allMedia.map((m) => m.url)}
            currentIndex={activeItemIndex}
          />
        </>
      )}

      <InfiniteScroll onLoadMore={loadMoreItems}>
        <div className="grid grid-cols-3 gap-px md:gap-1">
          {mediaEvents.slice(0, displayCount).map((event, index) => (
            <ImageGridItem
              key={event.id}
              event={event}
              index={index}
              setActiveItemIndex={(clickedUrl: string) => {
                const mediaIndex = allMedia.findIndex(
                  (media) => media.event.id === event.id && media.url === clickedUrl
                )
                setActiveItemIndex(mediaIndex)
                setShowModal(true)
              }}
            />
          ))}
        </div>
      </InfiniteScroll>
    </>
  )
}
