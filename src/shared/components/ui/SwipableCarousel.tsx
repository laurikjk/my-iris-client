import {useEffect, ReactNode, CSSProperties} from "react"
import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import {SwipeItem, useSwipable} from "@/shared/hooks/useSwipable"

interface SwipableCarouselProps {
  items: SwipeItem[]
  renderItem: (
    item: SwipeItem,
    index: number,
    wasDragged: {current: boolean}
  ) => ReactNode
  initialIndex?: number
  threshold?: number
  onIndexChange?: (index: number) => void
  className?: string
  style?: CSSProperties
  onWasDraggedRef?: (ref: {current: boolean}) => void
  enableKeyboardNav?: boolean
  onClose?: () => void
  showArrows?: boolean
  arrowClassName?: string
}

export function SwipableCarousel({
  items,
  renderItem,
  initialIndex = 0,
  threshold = 0.5,
  onIndexChange,
  className = "",
  style,
  enableKeyboardNav = false,
  onClose,
  showArrows = false,
  arrowClassName = "btn btn-circle btn-ghost text-white",
}: SwipableCarouselProps) {
  const {
    currentIndex,
    isDragging,
    isTransitioning,
    containerRef,
    wasDragged,
    handlers,
    navigation,
    getTransform,
  } = useSwipable({
    items,
    initialIndex,
    threshold,
    onIndexChange,
  })

  // Media preloading - preload adjacent images and videos for smoother navigation
  useEffect(() => {
    if (items.length <= 1) return

    const preloadImage = (url: string) => {
      const img = new Image()
      img.src = url
    }

    const preloadVideo = (url: string) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.src = url
    }

    // Preload previous and next media
    const prevIndex = navigation.getPrevIndex()
    const nextIndex = navigation.getNextIndex()

    const prevItem = items[prevIndex]
    const nextItem = items[nextIndex]

    if (prevItem?.type === "image") {
      preloadImage(prevItem.url)
    } else if (prevItem?.type === "video") {
      preloadVideo(prevItem.url)
    }

    if (nextItem?.type === "image") {
      preloadImage(nextItem.url)
    } else if (nextItem?.type === "video") {
      preloadVideo(nextItem.url)
    }
  }, [currentIndex, items, navigation])

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNav) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        navigation.goToNext()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        navigation.goToPrev()
      } else if (e.key === "Escape" && onClose) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enableKeyboardNav, navigation, onClose])

  if (items.length === 0) return null

  const renderCarouselItems = () => {
    if (items.length === 1) {
      return (
        <div
          key={items[0].url}
          className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center"
        >
          {renderItem(items[0], 0, wasDragged)}
        </div>
      )
    }

    const prev = items[navigation.getPrevIndex()]
    const curr = items[currentIndex]
    const next = items[navigation.getNextIndex()]

    return (
      <>
        <div
          key={prev.url === next.url ? `${prev.url}-prev` : prev.url}
          className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center"
        >
          {renderItem(prev, navigation.getPrevIndex(), wasDragged)}
        </div>
        <div
          key={curr.url}
          className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center"
        >
          {renderItem(curr, currentIndex, wasDragged)}
        </div>
        <div
          key={next.url}
          className="w-full flex-shrink-0 flex-grow-0 flex justify-center items-center"
        >
          {renderItem(next, navigation.getNextIndex(), wasDragged)}
        </div>
      </>
    )
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{touchAction: "pan-y", ...style}}
    >
      <div
        ref={containerRef}
        className="flex w-full h-full select-none"
        style={{
          transform: items.length > 1 ? getTransform() : "translateX(0)",
          transition: isDragging
            ? "none"
            : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          willChange: "transform",
          cursor: (() => {
            if (items.length <= 1) return "default"
            return isDragging ? "grabbing" : "grab"
          })(),
          pointerEvents: isTransitioning ? "none" : "auto",
        }}
        onMouseDown={items.length > 1 ? handlers.onDragStart : undefined}
        onMouseMove={isDragging ? handlers.onDragMove : undefined}
        onMouseUp={handlers.onDragEnd}
        onMouseLeave={isDragging ? handlers.onDragEnd : undefined}
        onTouchStart={items.length > 1 ? handlers.onDragStart : undefined}
        onTouchMove={handlers.onDragMove}
        onTouchEnd={handlers.onDragEnd}
        onTransitionEnd={handlers.onTransitionEnd}
      >
        {renderCarouselItems()}
      </div>

      {showArrows && items.length > 1 && (
        <>
          <div className="absolute top-1/2 -translate-y-1/2 left-4 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigation.goToPrev()
              }}
              className={arrowClassName}
            >
              <RiArrowLeftSLine size={24} />
            </button>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-4 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigation.goToNext()
              }}
              className={arrowClassName}
            >
              <RiArrowRightSLine size={24} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SwipableCarousel
