import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import React, {useEffect, useState, MouseEvent, useCallback, useRef} from "react"
import classNames from "classnames"

import MediaModal from "@/shared/components/media/MediaModal"
import {useSettingsStore} from "@/stores/settings"
import ImageComponent from "./ImageComponent"
import VideoComponent from "./VideoComponent"
import {EmbedEvent} from "../index"

// Move this to a shared hooks file later
function useWindowWidth() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  )

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return windowWidth
}

interface MediaItem {
  url: string
  type: "image" | "video"
  imeta?: string[]
}

interface CarouselProps {
  media: MediaItem[]
  event?: EmbedEvent
}

function Carousel({media, event}: CarouselProps) {
  const {content} = useSettingsStore()
  const windowWidth = useWindowWidth()
  const CarouselButton = ({
    direction,
    onClick,
  }: {
    direction: "left" | "right"
    onClick: (e: MouseEvent<HTMLButtonElement>) => void
  }) => (
    <button
      disabled={isTransitioning}
      onClick={(e) => onClick(e as MouseEvent<HTMLButtonElement>)}
      className={`absolute top-1/2 ${direction === "left" ? "left-4" : "right-4"} transform -translate-y-1/2 bg-gray-800 rounded-full opacity-50 text-white p-2 disabled:opacity-30`}
    >
      {direction === "left" ? (
        <RiArrowLeftSLine size={24} />
      ) : (
        <RiArrowRightSLine size={24} />
      )}
    </button>
  )

  const ImageIndicators = ({
    images,
    currentIndex,
  }: {
    images: MediaItem[]
    currentIndex: number
  }) => {
    const MAX_INDICATORS = 10
    const totalImages = images.length

    if (totalImages <= MAX_INDICATORS) {
      return (
        <div className="flex space-x-2 mt-2">
          {images.map((_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${index === currentIndex ? "bg-primary" : "bg-gray-300"}`}
            />
          ))}
        </div>
      )
    }

    // Calculate the window of indicators to show
    const windowSize = MAX_INDICATORS - 2 // Reserve 2 spots for ellipsis
    const halfWindow = Math.floor(windowSize / 2)
    let startIndex = currentIndex - halfWindow
    let endIndex = currentIndex + halfWindow

    // Adjust window if near the start or end
    if (startIndex < 0) {
      startIndex = 0
      endIndex = windowSize
    } else if (endIndex >= totalImages) {
      endIndex = totalImages - 1
      startIndex = endIndex - windowSize
    }

    return (
      <div className="flex items-center space-x-2 mt-2">
        {startIndex > 0 && (
          <>
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="text-gray-400">...</span>
          </>
        )}
        {Array.from({length: endIndex - startIndex + 1}).map((_, i) => {
          const index = startIndex + i
          return (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${
                index === currentIndex ? "bg-primary" : "bg-gray-300"
              }`}
            />
          )
        })}
        {endIndex < totalImages - 1 && (
          <>
            <span className="text-gray-400">...</span>
            <span className="h-2 w-2 rounded-full bg-gray-300" />
          </>
        )}
        <span className="text-sm text-gray-500 ml-2">
          {currentIndex + 1} / {totalImages}
        </span>
      </div>
    )
  }

  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)

  // NEW: explicit direction to avoid ambiguity when media.length === 2
  const [transitionDirection, setTransitionDirection] = useState<
    "none" | "prev" | "next"
  >("none")

  const dragStartX = useRef<number | null>(null)
  const dragLastX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wasDragged = useRef(false)

  // Helper to get prev/next indices (wrap around)
  const getPrevIndex = () => (currentIndex - 1 + media.length) % media.length
  const getNextIndex = () => (currentIndex + 1) % media.length

  // Mouse/touch handlers
  const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    wasDragged.current = false
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    dragStartX.current = clientX
    dragLastX.current = clientX
  }

  const onDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || dragStartX.current === null) return

    // Only preventDefault for mouse events, not touch events
    if (!("touches" in e)) {
      e.preventDefault()
    }

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const newDragX = clientX - dragStartX.current

    // Mark as dragged if moved more than a few pixels
    if (Math.abs(newDragX) > 5) {
      wasDragged.current = true
    }

    setDragX(newDragX)
    dragLastX.current = clientX
  }

  const onDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const containerWidth = containerRef.current?.clientWidth ?? windowWidth
    const currentThreshold = containerWidth * 0.5

    setIsTransitioning(true)

    if (Math.abs(dragX) > currentThreshold) {
      const dir = dragX > 0 ? "prev" : "next"
      setTransitionDirection(dir)
      setTargetIndex(dir === "prev" ? getPrevIndex() : getNextIndex())
    } else {
      // Snap back
      setTransitionDirection("none")
      setTargetIndex(null)
    }
  }

  const [blur, setBlur] = useState(
    content.blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )
  const [showModal, setShowModal] = useState(false)
  const [isMuted, setIsMuted] = useState(content.autoplayVideos)

  const nextImage = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation()
    setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length)
  }

  const prevImage = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation()
    setCurrentIndex((prevIndex) => (prevIndex - 1 + media.length) % media.length)
  }

  const onClickImage = () => {
    // Don't open modal if this was a drag
    if (wasDragged.current) return

    if (blur) {
      setBlur(false)
    } else {
      setShowModal(true)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        nextImage(e)
      } else if (e.key === "ArrowLeft") {
        prevImage(e)
      }
    }

    if (showModal) {
      window.addEventListener("keydown", handleKeyDown)
    } else {
      window.removeEventListener("keydown", handleKeyDown)
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showModal])

  const onCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const limitHeight = media.length > 1

  const renderMediaComponent = (item: MediaItem, index: number) => {
    if (item.type === "image") {
      return (
        <ImageComponent
          match={item.url}
          index={index}
          onClickImage={onClickImage}
          blur={blur}
          key={item.url}
          limitHeight={limitHeight}
          imeta={item.imeta}
        />
      )
    }

    return (
      <VideoComponent
        match={item.url}
        event={event as EmbedEvent}
        key={item.url}
        blur={blur}
        onClick={() => setBlur(false)}
        limitHeight={limitHeight}
        imeta={item.imeta}
        isMuted={isMuted}
        onMuteChange={setIsMuted}
      />
    )
  }

  const handleTransitionEnd = useCallback(
    (e?: React.TransitionEvent<HTMLDivElement>) => {
      if (e && e.propertyName && e.propertyName !== "transform") return
      if (!isTransitioning) return

      const committed = targetIndex !== null && targetIndex !== currentIndex

      // Temporarily disable transitions before changing styles
      if (containerRef.current) {
        containerRef.current.style.transition = "none"
      }

      if (committed) {
        setCurrentIndex(targetIndex as number)
      }

      setDragX(0)
      setIsTransitioning(false)
      setTransitionDirection("none")
      setTargetIndex(null)
      dragStartX.current = null
      dragLastX.current = null

      // Re-enable transitions after a brief delay
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = ""
        }
      }, 50)
    },
    [isTransitioning, targetIndex, currentIndex]
  )

  // Render three images: prev, current, next
  const renderCarouselImages = () => {
    const prev = media[getPrevIndex()]
    const curr = media[currentIndex]
    const next = media[getNextIndex()]

    // Base position is the middle slide (-100%). While dragging add pixel offset.
    let finalTransform = `translateX(calc(-100% + ${dragX}px))`

    if (isTransitioning) {
      // Drive end-state solely from direction. Never infer from indices.
      if (transitionDirection === "none") {
        finalTransform = `translateX(-100%)` // snap back
      } else if (transitionDirection === "prev") {
        finalTransform = `translateX(0%)` // show previous (left slide)
      } else {
        finalTransform = `translateX(-200%)` // show next (right slide)
      }
    }

    return (
      <div
        ref={containerRef}
        className="flex w-full h-full select-none"
        style={{
          transform: finalTransform,
          transition: isDragging
            ? "none"
            : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          willChange: "transform",
          cursor: isDragging ? "grabbing" : "grab",
          pointerEvents: isTransitioning ? "none" : "auto",
        }}
        onMouseDown={onDragStart}
        onMouseMove={isDragging ? onDragMove : undefined}
        onMouseUp={onDragEnd}
        onMouseLeave={isDragging ? onDragEnd : undefined}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center">
          {renderMediaComponent(prev, getPrevIndex())}
        </div>
        <div className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center">
          {renderMediaComponent(curr, currentIndex)}
        </div>
        <div className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center">
          {renderMediaComponent(next, getNextIndex())}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-full my-2 flex flex-col items-center gap-2">
        <div
          className={classNames(
            `relative w-full flex flex-col items-center justify-center overflow-hidden`,
            {
              "h-[600px]": limitHeight,
            }
          )}
          style={{touchAction: "pan-y"}}
        >
          {media.length > 1 ? renderCarouselImages() : renderMediaComponent(media[0], 0)}
          {media.length > 1 && (
            <>
              <CarouselButton direction="left" onClick={prevImage} />
              <CarouselButton direction="right" onClick={nextImage} />
            </>
          )}
          {showModal && (
            <MediaModal
              onClose={onCloseModal}
              onPrev={media.length > 1 ? prevImage : undefined}
              onNext={media.length > 1 ? nextImage : undefined}
              mediaUrl={media[currentIndex].url}
              mediaType={media[currentIndex].type}
              currentIndex={media.length > 1 ? currentIndex : undefined}
              totalCount={media.length > 1 ? media.length : undefined}
            />
          )}
        </div>
        {media.length > 1 && (
          <ImageIndicators images={media} currentIndex={currentIndex} />
        )}
      </div>
    </>
  )
}

export default Carousel
